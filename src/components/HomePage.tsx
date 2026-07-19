import { useState } from "react";
import { SearchBar } from "./SearchBar";
import { Icon } from "./icons";
import { relTime } from "../lib/storage";
import type { HistoryEntry } from "../types";
import type { Collection, SavedItem } from "../types";

interface Props {
  onSearch: (q: string) => void;
  onLucky: () => void;
  history: HistoryEntry[];
  collections: Collection[];
  items: SavedItem[];
  onOpenSaved: (item: SavedItem) => void;
  onOpenCollection: (id: string) => void;
}

const SHORTCUTS: { label: string; url: string; emoji: string }[] = [
  { label: "Wikipedia", url: "https://en.wikipedia.org", emoji: "📚" },
  { label: "Hacker News", url: "https://news.ycombinator.com", emoji: "🟧" },
  { label: "MDN", url: "https://developer.mozilla.org", emoji: "🟦" },
  { label: "ArXiv", url: "https://arxiv.org", emoji: "📄" },
  { label: "GitHub", url: "https://github.com", emoji: "🐙" },
  { label: "Internet Archive", url: "https://archive.org", emoji: "🏛️" },
];

export function HomePage({
  onSearch,
  onLucky,
  history,
  collections,
  items,
  onOpenSaved,
  onOpenCollection,
}: Props) {
  const [q, setQ] = useState("");
  const recent = history.slice(-6).reverse();

  const submitOrNavigate = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return;
    // If it looks like a URL, open it in the current tab
    if (
      /^https?:\/\//i.test(trimmed) ||
      /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(trimmed) // bare domain like example.com
    ) {
      const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      // Defer to parent by calling onSearch which routes to viewer
      onSearch(`__open_url__::${url}`);
    } else {
      onSearch(trimmed);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="min-h-full flex flex-col items-center px-6 pt-[14vh] pb-20">
        {/* Logo */}
        <div className="text-center select-none">
          <h1 className="lm-logo text-7xl md:text-8xl tracking-tighter">AURA</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-2 text-sm md:text-base">
            A research browser for curious humans
          </p>
        </div>

        {/* Search bar */}
        <div className="mt-10 w-full flex justify-center">
          <SearchBar
            value={q}
            onChange={setQ}
            onSubmit={submitOrNavigate}
            onLucky={onLucky}
            size="lg"
            autoFocus
            placeholder="Search the web, or paste a URL"
          />
        </div>

        {/* Quick links row */}
        <div className="mt-10 grid grid-cols-3 md:grid-cols-6 gap-3 w-full max-w-3xl">
          {SHORTCUTS.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
            >
              <span className="text-2xl">{s.emoji}</span>
              <span className="text-[12px] text-ink-600 dark:text-ink-300">{s.label}</span>
            </a>
          ))}
        </div>

        {/* Recent searches */}
        {recent.length > 0 && (
          <div className="mt-14 w-full max-w-3xl">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3 flex items-center gap-2">
              <Icon.History width={14} height={14} /> Recent searches
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {recent.map((h) => (
                <button
                  key={h.id}
                  onClick={() => onSearch(h.query)}
                  className="text-left p-3 rounded-lg border border-ink-200 dark:border-ink-700 hover:border-accent-500 hover:bg-ink-50 dark:hover:bg-ink-900 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Icon.Search className="opacity-50" width={14} height={14} />
                    <span className="truncate">{h.query}</span>
                  </div>
                  <div className="text-[11px] text-ink-400 mt-1 ml-6">
                    {h.resultsCount} result{h.resultsCount === 1 ? "" : "s"} · {relTime(h.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pinned collections */}
        {collections.length > 0 && (
          <div className="mt-14 w-full max-w-3xl">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3 flex items-center gap-2">
              <Icon.Collection width={14} height={14} /> Your collections
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {collections.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onOpenCollection(c.id)}
                  className="text-left p-4 rounded-xl border border-ink-200 dark:border-ink-700 hover:border-accent-500 hover:bg-ink-50 dark:hover:bg-ink-900 transition-colors"
                >
                  <div className="text-2xl mb-1">{c.emoji || "📁"}</div>
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-[11px] text-ink-400 mt-0.5">
                    {c.itemIds.length} item{c.itemIds.length === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty-state hint */}
        {recent.length === 0 && collections.every((c) => c.itemIds.length === 0) && (
          <div className="mt-14 max-w-2xl w-full">
            <div className="rounded-2xl border border-dashed border-ink-200 dark:border-ink-700 p-6 text-center">
              <div className="text-3xl mb-2">✨</div>
              <div className="text-sm font-medium mb-1">Start your first search</div>
              <div className="text-xs text-ink-500 leading-relaxed">
                Try <span className="font-medium">"history of jazz"</span>, <span className="font-medium">"quantum entanglement explained"</span>, or paste a URL like <span className="font-mono text-accent-600 dark:text-accent-400">en.wikipedia.org</span>.
                Results from DuckDuckGo and Wikipedia show up here, and you can save anything to a collection.
              </div>
            </div>
          </div>
        )}

        {/* Quick stats footer */}
        {items.length > 0 && (
          <div className="mt-10 text-[11px] text-ink-400 flex items-center gap-3">
            <span>{items.length} saved item{items.length === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>{history.length} search{history.length === 1 ? "" : "es"}</span>
            <span>·</span>
            <span>Everything stored locally — your data never leaves your browser.</span>
          </div>
        )}

        {/* Saved items */}
        {items.length > 0 && (
          <div className="mt-14 w-full max-w-3xl">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3 flex items-center gap-2">
              <Icon.Bookmark width={14} height={14} /> Recently saved
            </h2>
            <div className="space-y-2">
              {items.slice(0, 5).map((it) => (
                <button
                  key={it.id}
                  onClick={() => onOpenSaved(it)}
                  className="w-full text-left p-3 rounded-lg border border-ink-200 dark:border-ink-700 hover:border-accent-500 hover:bg-ink-50 dark:hover:bg-ink-900 transition-colors flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{it.title}</div>
                    {it.url && (
                      <div className="text-[11px] text-ink-400 truncate">{it.url}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-400 whitespace-nowrap">
                    {relTime(it.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
