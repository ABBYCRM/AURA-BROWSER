// Search engines: DuckDuckGo HTML via CORS proxy + Wikipedia REST API
// All requests are made directly from the browser; the proxy is needed because
// DuckDuckGo's HTML endpoint doesn't send Access-Control-Allow-Origin.

import type { SearchResult, KnowledgeCard } from "../types";
import { decodeEntities, stripHtml, domainOf } from "./storage";

const CORS_PROXIES = [
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

async function fetchViaProxy(url: string, signal?: AbortSignal): Promise<string> {
  let lastErr: unknown = null;
  for (const wrap of CORS_PROXIES) {
    try {
      const res = await fetch(wrap(url), {
        signal,
        headers: { Accept: "text/html,application/json" },
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All proxies failed");
}

/* ----------------------------- DuckDuckGo ----------------------------- */

interface DDGRaw {
  title: string;
  href: string;
  snippet: string;
}

function parseDDG(html: string): DDGRaw[] {
  // DDG HTML lite page uses <a class="result__a" href="...">title</a> and
  // <a class="result__snippet">snippet</a>. We tolerate a few structural
  // variations just in case.
  const results: DDGRaw[] = [];
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Primary: result__a + result__snippet pairs
  const anchors = Array.from(
    doc.querySelectorAll("a.result__a, a.result-link, h2.result__title a"),
  );
  for (const a of anchors) {
    const title = (a.textContent || "").trim();
    let href = a.getAttribute("href") || "";
    if (!title || !href) continue;
    // DDG wraps real URL in a redirect like //duckduckgo.com/l/?uddg=...
    if (href.includes("uddg=")) {
      const m = href.match(/uddg=([^&]+)/);
      if (m) href = decodeURIComponent(m[1]);
    }
    if (href.startsWith("//")) href = "https:" + href;
    // Snippet is in the parent .result block
    const block =
      a.closest(".result, .web-result, .results_links, li") || a.parentElement;
    const snipEl = block?.querySelector(
      ".result__snippet, .result-snippet, .result__snippet.js-result-snippet",
    );
    const snippet = (snipEl?.textContent || "").trim();
    if (title && href) {
      results.push({ title, href, snippet });
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
  const raw = parseDDG(html);
  return raw.slice(0, 20).map((r, i) => ({
    id: `ddg_${i}_${Date.now()}`,
    kind: "web" as const,
    title: decodeEntities(r.title),
    url: r.href,
    displayUrl: domainOf(r.href),
    snippet: decodeEntities(stripHtml(r.snippet)),
  }));
}

/* ----------------------------- Wikipedia ----------------------------- */

export async function searchWikipedia(
  query: string,
  signal?: AbortSignal,
): Promise<{ card: KnowledgeCard | null; results: SearchResult[] }> {
  // 1) Get the matching titles
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=${encodeURIComponent(
    query,
  )}`;
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

  // 2) Build a knowledge card from the top hit
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
}

/* ----------------------------- Aggregator ----------------------------- */

export interface SearchResponse {
  results: SearchResult[];
  knowledge: KnowledgeCard | null;
  engine: string;
}

export async function runSearch(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  // Run DuckDuckGo and Wikipedia in parallel
  const [ddgP, wikiP] = [
    searchDuckDuckGo(query, signal).catch((e) => {
      console.warn("[search] DDG failed", e);
      return [] as SearchResult[];
    }),
    searchWikipedia(query, signal).catch((e) => {
      console.warn("[search] Wiki failed", e);
      return { card: null, results: [] as SearchResult[] };
    }),
  ];

  const [ddg, wiki] = await Promise.all([ddgP, wikiP]);

  // Interleave: put a couple of wiki results near the top if the query looks like a topic query
  const looksLikeTopic =
    ddg.length === 0 ||
    query.split(/\s+/).length <= 4 ||
    /^(what|who|when|where|why|how|define|meaning of)/i.test(query);
  const merged: SearchResult[] = looksLikeTopic
    ? [...wiki.results.slice(0, 3), ...ddg]
    : ddg;
  // Dedupe by URL
  const seen = new Set<string>();
  const dedup = merged.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return {
    results: dedup,
    knowledge: wiki.card,
    engine: "duckduckgo + wikipedia",
  };
}

/* --------------------------- Suggest / autocomplete --------------------- */

export async function suggest(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!query.trim()) return [];
  // DuckDuckGo's "ac" endpoint returns a JSON array of suggestions.
  // It doesn't always send CORS headers, so we route through a proxy.
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
