// Proxy helpers for fetching page content past X-Frame-Options / CORS.
// Used by the in-app viewer and reader mode.

const PROXIES = [
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

export async function fetchPage(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  let lastErr: unknown = null;
  for (const wrap of PROXIES) {
    try {
      const res = await fetch(wrap(url), {
        signal,
        headers: { Accept: "text/html,application/xhtml+xml" },
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

// Try to load a URL in an iframe; resolves true if it rendered something usable.
// We use a load-timeout race: if no load event in 6s, we treat as blocked.
export function canIframeLoad(url: string, timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = url;
    let resolved = false;
    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      try {
        document.body.removeChild(iframe);
      } catch {
        /* noop */
      }
      resolve(ok);
    };
    iframe.onload = () => {
      // Some browsers still fire onload even when X-Frame-Options blocks.
      // Best-effort: try to detect a same-origin doc.
      try {
        const doc = iframe.contentDocument;
        if (doc && doc.body && (doc.body.innerHTML || "").length > 0) {
          finish(true);
          return;
        }
      } catch {
        /* cross-origin — treat as loaded (browser will block visually) */
        finish(true);
        return;
      }
      finish(false);
    };
    iframe.onerror = () => finish(false);
    setTimeout(() => finish(false), timeoutMs);
    document.body.appendChild(iframe);
  });
}

/* ---------------------- Reader mode extraction ---------------------- */

export interface ReaderDoc {
  title: string;
  byline?: string;
  siteName?: string;
  excerpt?: string;
  html: string;
  text: string;
  length: number; // estimated reading time in minutes
  image?: string;
}

const STRIP_TAGS = /<(script|style|noscript|svg|iframe|form|button|input|select|textarea|object|embed)[^>]*>[\s\S]*?<\/\1>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;

function nodeText(n: Element): string {
  return ((n.textContent || "") + " ").replace(/\s+/g, " ").trim();
}

function densityOf(n: Element): number {
  const txt = nodeText(n);
  if (!txt) return 0;
  return txt.length / Math.max(1, n.getElementsByTagName("*").length);
}

function pickRoot(doc: Document): Element | null {
  // Score each candidate by text-density × length, prefer <article>/<main>.
  const candidates = Array.from(
    doc.querySelectorAll("article, main, .post, .entry, .content, #content, #main, .article, [role=main]"),
  );
  candidates.push(...Array.from(doc.querySelectorAll("p, div, section")).filter((n) => n.children.length > 4));
  let best: Element | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const txt = nodeText(c);
    if (txt.length < 250) continue;
    const score = densityOf(c) * Math.log(txt.length + 1);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (!best) {
    // Fallback: body
    return doc.body;
  }
  return best;
}

function sanitizeCopy(root: Element): string {
  // Keep <p>, <h1-6>, <ul>, <ol>, <li>, <a>, <img>, <blockquote>, <pre>, <code>, <br>
  const allowed = new Set([
    "P", "H1", "H2", "H3", "H4", "H5", "H6",
    "UL", "OL", "LI", "A", "IMG", "FIGURE", "FIGCAPTION",
    "BLOCKQUOTE", "PRE", "CODE", "EM", "STRONG", "B", "I",
    "BR", "HR", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH",
  ]);
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      out.push(escapeHtml((n.textContent || "").replace(/\s+/g, " ")));
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName;
    if (!allowed.has(tag)) {
      el.childNodes.forEach(walk);
      return;
    }
    const attrs: string[] = [];
    if (tag === "A") {
      const href = (el as HTMLAnchorElement).getAttribute("href") || "";
      if (href && /^https?:|^mailto:|^#/.test(href)) {
        attrs.push(`href="${escapeAttr(href)}"`);
        attrs.push('target="_blank"');
        attrs.push('rel="noopener noreferrer"');
      }
    }
    if (tag === "IMG") {
      const src = (el as HTMLImageElement).getAttribute("src") || "";
      const alt = (el as HTMLImageElement).getAttribute("alt") || "";
      if (src) {
        attrs.push(`src="${escapeAttr(src)}"`);
        attrs.push(`alt="${escapeAttr(alt)}"`);
        attrs.push('loading="lazy"');
        out.push(`<img ${attrs.join(" ")} />`);
        return;
      }
    }
    out.push(`<${tag.toLowerCase()} ${attrs.join(" ")}>`.replace(/\s+>/, ">"));
    el.childNodes.forEach(walk);
    out.push(`</${tag.toLowerCase()}>`);
  };
  root.childNodes.forEach(walk);
  return out.join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}

export function toReaderDoc(html: string, sourceUrl: string): ReaderDoc {
  // Strip script/style and comments
  const clean = html.replace(STRIP_TAGS, "").replace(COMMENTS, "");
  const doc = new DOMParser().parseFromString(clean, "text/html");
  // Force <a href> to be absolute
  doc.querySelectorAll("a[href]").forEach((a) => {
    try {
      const u = new URL(a.getAttribute("href") || "", sourceUrl);
      a.setAttribute("href", u.toString());
    } catch {
      /* skip */
    }
  });
  doc.querySelectorAll("img[src]").forEach((img) => {
    try {
      const u = new URL(img.getAttribute("src") || "", sourceUrl);
      img.setAttribute("src", u.toString());
    } catch {
      /* skip */
    }
  });
  const title =
    doc.querySelector("title")?.textContent?.trim() ||
    doc.querySelector("h1")?.textContent?.trim() ||
    "Untitled";
  const ogImage = doc
    .querySelector('meta[property="og:image"]')
    ?.getAttribute("content") || undefined;
  const siteName =
    doc
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute("content") || new URL(sourceUrl).hostname;
  const byline =
    doc.querySelector('meta[name="author"]')?.getAttribute("content") || "";
  const description =
    doc
      .querySelector('meta[name="description"]')
      ?.getAttribute("content") || "";

  const root = pickRoot(doc) || doc.body;
  if (!root) {
    return {
      title,
      siteName,
      excerpt: description,
      html: "",
      text: "",
      length: 1,
      image: ogImage,
    };
  }
  // Remove junk nodes
  root.querySelectorAll(
    "nav, aside, footer, header, .ad, .ads, .advertisement, .sidebar, .share, .social, form, button, [role=navigation], [aria-hidden=true]",
  ).forEach((n) => n.remove());

  const html2 = sanitizeCopy(root);
  const text = (root.textContent || "").replace(/\s+/g, " ").trim();
  const length = Math.max(1, Math.round(text.split(/\s+/).length / 220));
  return {
    title,
    siteName,
    byline,
    excerpt: description,
    html: html2,
    text,
    length,
    image: ogImage || undefined,
  };
}
