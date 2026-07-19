// Lightweight localStorage abstraction with JSON serialization and namespacing

const NS = "aura:v1:";

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch (e) {
      console.warn("[aura] storage.set failed", key, e);
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(NS + key);
    } catch {
      /* noop */
    }
  },
  has(key: string): boolean {
    return localStorage.getItem(NS + key) != null;
  },
};

export const KEYS = {
  tabs: "tabs",
  activeTab: "activeTab",
  collections: "collections",
  savedItems: "savedItems",
  highlights: "highlights",
  stickies: "stickies",
  history: "history",
  settings: "settings",
  sidebarCollapsed: "sidebarCollapsed",
  panelCollapsed: "panelCollapsed",
};

// Generate a unique id (URL-safe, no external dep)
export function uid(prefix = "id"): string {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 9)
  );
}

// Format a date as a human-readable relative string
export function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// Domain from URL
export function domainOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Favicon URL (DuckDuckGo's icon service is CORS-friendly)
export function faviconUrl(url: string): string {
  const d = domainOf(url);
  return `https://icons.duckduckgo.com/ip3/${d}.ico`;
}

// Truncate
export function trunc(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

// Strip HTML
export function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

// Decode HTML entities (basic)
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Debounce
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
