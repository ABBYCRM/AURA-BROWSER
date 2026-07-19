// Search backends for AURA. Aggregates multiple sources in a deterministic
// priority order, with captcha / network-failure detection so we can fall
// back gracefully instead of returning garbage results.
//
// Source priority (per intent):
//   1. Optional Brave Search API key (user-provided) — best quality
//   2. DuckDuckGo HTML via CORS proxy — usually works
//   3. Wikipedia REST API — topic queries
//   4. HackerNews Algolia — tech queries
//   5. OpenAlex — academic queries
//   6. DuckDuckGo JSON API — instant-answer fallback
//
// All results are merged and de-duplicated by URL.

import type { SearchResult, KnowledgeCard } from "../types";
import { decodeEntities, stripHtml, domainOf, uid } from "./storage";
import { detectIntent, type QueryIntent } from "./intent";

/* --------------------------------- CORS fetch --------------------------------- */

const PROXIES: ((u: string) => string)[] = [
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
];

// Detect the well-known captcha / interstitial pages.
function isBlocked(html: string): boolean {
  if (!html) return true;
  const lower = html.toLowerCase();
  if (lower.includes("anomaly-modal")) return true;
  if (lower.includes("please complete the following challenge")) return true;
  if (lower.includes("captcha")) return true;
  if (lower.includes("cloudflare") && lower.includes("forbidden"))
    return true;
  if (lower.startsWith("error code:")) return true;
  if (lower.startsWith("<html><head><title>500")) return true;
  if (lower.startsWith("<html><head><title>403")) return true;
  if (lower.length < 200) return true; // not a real result page
  return false;
}

async function fetchViaProxy(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  for (const wrap of PROXIES) {
    try {
      const res = await fetch(wrap(url), {
        signal,
        headers: { Accept: "text/html,application/json" },
      });
      if (!res.ok) continue;
      const txt = await res.text();
      if (isBlocked(txt)) continue;
      return txt;
    } catch {
      /* try next */
    }
  }
  return null;
}

/* --------------------------------- DuckDuckGo HTML --------------------------------- */

function parseDDG(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Newer DDG layout
  const articles = doc.querySelectorAll("article, div.result, .web-result, .result");
  if (articles.length > 0) {
    for (const block of Array.from(articles)) {
      const titleEl = block.querySelector(
        "a.result__a, a.result-link, h2 a, a[data-testid='result-title-a']",
      );
      const snipEl = block.querySelector(
        ".result__snippet, .result-snippet, [data-result='snippet'], .result__snippet",
      );
      if (!titleEl) continue;
      const title = (titleEl.textContent || "").trim();
      let href = titleEl.getAttribute("href") || "";
      if (href.includes("uddg=")) {
        const m = href.match(/uddg=([^&]+)/);
        if (m) href = decodeURIComponent(m[1]);
      }
      if (href.startsWith("//")) href = "https:" + href;
      const snippet = (snipEl?.textContent || "").trim();
      if (title && href) {
        results.push({
          id: uid("ddg"),
          kind: "web",
          title: decodeEntities(title),
          url: href,
          displayUrl: domainOf(href),
          snippet: decodeEntities(stripHtml(snippet)),
        });
      }
    }
  }
  return results;
}

export async function searchDuckDuckGo(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
    query,
  )}&kl=us-en`;
  const html = await fetchViaProxy(url, signal);
  if (!html) return [];
  return parseDDG(html).slice(0, 20);
}

/* --------------------------------- Wikipedia --------------------------------- */

export async function searchWikipedia(
  query: string,
  signal?: AbortSignal,
): Promise<{ card: KnowledgeCard | null; results: SearchResult[] }> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=${encodeURIComponent(
    query,
  )}`;
  try {
    const searchRes = await fetch(searchUrl, { signal });
    if (!searchRes.ok) return { card: null, results: [] };
    const searchJson = await searchRes.json();
    const hits: { title: string; snippet: string; pageid: number }[] =
      searchJson?.query?.search || [];

    const results: SearchResult[] = hits.map((h) => ({
      id: `wiki_${h.pageid}`,
      kind: "wikipedia",
      title: decodeEntities(h.title),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        h.title.replace(/ /g, "_"),
      )}`,
      displayUrl: "en.wikipedia.org",
      snippet: decodeEntities(stripHtml(h.snippet)),
      source: "Wikipedia",
    }));

    if (!hits.length) return { card: null, results };

    const top = hits[0];
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      top.title,
    )}`;
    try {
      const sumRes = await fetch(summaryUrl, { signal });
      if (sumRes.ok) {
        const s = await sumRes.json();
        const card: KnowledgeCard = {
          title: s.title || top.title,
          abstract: stripHtml(s.extract || ""),
          url:
            s.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${encodeURIComponent(top.title)}`,
          imageUrl: s.thumbnail?.source,
          source: "Wikipedia",
        };
        return { card, results };
      }
    } catch {
      /* ignore */
    }
    return { card: null, results };
  } catch {
    return { card: null, results: [] };
  }
}

/* --------------------------------- HackerNews Algolia --------------------------------- */

export async function searchHackerNews(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
        query,
      )}&hitsPerPage=10`,
      { signal },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits || [])
      .filter((h: any) => h.title || h.story_title)
      .map((h: any, i: number) => ({
        id: `hn_${i}_${Date.now()}`,
        kind: "web" as const,
        title: h.title || h.story_title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        displayUrl: h.url
          ? domainOf(h.url)
          : "news.ycombinator.com",
        snippet:
          h._highlightResult?.comment_text?.value
            ? stripHtml(h._highlightResult.comment_text.value)
            : `${h.points || 0} points · ${h.num_comments || 0} comments${
                h.author ? " · by " + h.author : ""
              }`,
        source: "Hacker News",
      }));
  } catch {
    return [];
  }
}

/* --------------------------------- OpenAlex (academic) --------------------------------- */

export async function searchOpenAlex(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(
        query,
      )}&per_page=10`,
      { signal },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || [])
      .filter((w: any) => w.title)
      .map((w: any, i: number) => {
        const authors = (w.authorships || [])
          .slice(0, 3)
          .map((a: any) => a.author?.display_name)
          .filter(Boolean)
          .join(", ");
        const venue = w.primary_location?.source?.display_name || w.host_venue?.display_name;
        const year = w.publication_year;
        return {
          id: `oa_${i}_${Date.now()}`,
          kind: "web" as const,
          title: decodeEntities(stripHtml(w.title)),
          url: w.doi
            ? `https://doi.org/${w.doi}`
            : w.id
            ? `https://openalex.org/${w.id}`
            : "https://openalex.org",
          displayUrl: "openalex.org",
          snippet: `${authors ? authors + ". " : ""}${venue ? venue + ". " : ""}${year ? year + ". " : ""}${
            w.abstract_inverted_index
              ? Object.keys(w.abstract_inverted_index)
                  .slice(0, 30)
                  .join(" ")
                  .slice(0, 200)
              : ""
          }`,
          source: "OpenAlex",
        };
      });
  } catch {
    return [];
  }
}

/* --------------------------------- DuckDuckGo JSON (instant answer) --------------------------------- */

export async function searchDDGInstant(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(
        query,
      )}&format=json&no_html=1&skip_disambig=1`,
      { signal },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const out: SearchResult[] = [];
    if (data.Abstract && data.AbstractURL) {
      out.push({
        id: "ddg_ia",
        kind: "topic",
        title: data.Heading || query,
        url: data.AbstractURL,
        displayUrl: domainOf(data.AbstractURL),
        snippet: data.Abstract,
        source: data.AbstractSource || "DuckDuckGo",
      });
    }
    for (const t of (data.RelatedTopics || []).slice(0, 8)) {
      if (t.Text && t.FirstURL) {
        out.push({
          id: uid("ddg_rt"),
          kind: "topic",
          title: t.Text.split(" - ")[0].slice(0, 80),
          url: t.FirstURL,
          displayUrl: domainOf(t.FirstURL),
          snippet: t.Text,
          source: "DuckDuckGo",
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/* --------------------------------- Optional Brave Search API --------------------------------- */

export async function searchBrave(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
        query,
      )}&count=20`,
      {
        signal,
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.web?.results || []).map((r: any, i: number) => ({
      id: `brave_${i}_${Date.now()}`,
      kind: "web" as const,
      title: r.title,
      url: r.url,
      displayUrl: domainOf(r.url),
      snippet: r.description,
      source: "Brave",
    }));
  } catch {
    return [];
  }
}

/* --------------------------------- Aggregator --------------------------------- */

export interface SearchResponse {
  results: SearchResult[];
  knowledge: KnowledgeCard | null;
  engine: string;
  sources: string[];
  intent: QueryIntent;
  /** True if every source returned nothing — UI should show a "no results" state. */
  empty: boolean;
}

export async function runSearch(
  query: string,
  signal?: AbortSignal,
  opts?: { braveKey?: string },
): Promise<SearchResponse> {
  const intent = detectIntent(query);
  const sources: string[] = [];
  let results: SearchResult[] = [];
  let knowledge: KnowledgeCard | null = null;
  let engine = "aura";

  // 1. Brave (if user provided a key) — best quality
  if (opts?.braveKey) {
    const brave = await searchBrave(query, opts.braveKey, signal);
    if (brave.length) {
      results = brave;
      sources.push(`Brave (${brave.length})`);
      engine = "brave";
    }
  }

  // 2. DuckDuckGo HTML
  if (results.length < 5) {
    const ddg = await searchDuckDuckGo(query, signal);
    if (ddg.length) {
      results = [...results, ...ddg];
      if (!engine.includes("brave")) engine = "duckduckgo";
      sources.push(`DuckDuckGo (${ddg.length})`);
    }
  }

  // 3. Wikipedia — only for topic-ish queries
  if (!intent.isCommercial) {
    const wiki = await searchWikipedia(query, signal);
    if (wiki.card) {
      knowledge = wiki.card;
      sources.push("Wikipedia card");
    }
    if (wiki.results.length && results.length < 10) {
      results = [...results, ...wiki.results];
    }
  } else {
    sources.push("Wikipedia skipped (commercial query)");
  }

  // 4. HackerNews as universal fallback (never fails, always useful)
  if (intent.isTech || results.length < 5) {
    const hn = await searchHackerNews(query, signal);
    if (hn.length) {
      results = [...results, ...hn];
      sources.push(`HackerNews (${hn.length})`);
    }
  }

  // 5. OpenAlex for academic queries
  if (intent.isAcademic) {
    const oa = await searchOpenAlex(query, signal);
    if (oa.length) {
      results = [...results, ...oa];
      sources.push(`OpenAlex (${oa.length})`);
    }
  }

  // 6. DDG JSON instant answer as final fallback
  if (results.length === 0) {
    const ia = await searchDDGInstant(query, signal);
    if (ia.length) {
      results = ia;
      sources.push(`DuckDuckGo instant (${ia.length})`);
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  const dedup = results.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return {
    results: dedup,
    knowledge,
    engine: engine || "aura",
    sources,
    intent,
    empty: dedup.length === 0,
  };
}

/* --------------------------- Suggest / autocomplete --------------------- */

export async function suggest(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!query.trim()) return [];
  const target = `https://duckduckgo.com/ac/?q=${encodeURIComponent(
    query,
  )}&type=list`;
  const urls = [
    target,
    `https://corsproxy.io/?${encodeURIComponent(target)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { signal });
      if (!res.ok) continue;
      const arr = await res.json();
      if (Array.isArray(arr) && Array.isArray(arr[1])) return arr[1].slice(0, 8);
    } catch {
      /* try next */
    }
  }
  return [];
}
