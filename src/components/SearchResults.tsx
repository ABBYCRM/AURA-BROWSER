import { useEffect, useState } from "react";
import { SearchBar } from "./SearchBar";
import { ResultCard } from "./ResultCard";
import { KnowledgeCardPanel } from "./KnowledgeCard";
import { Icon } from "./icons";
import { runSearch } from "../lib/search";
import type { SearchResult, KnowledgeCard, SavedItem } from "../types";
import { detectIntent, VERTICAL_PORTALS } from "../lib/intent";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (q: string) => void;
  onOpen: (r: SearchResult) => void;
  onOpenExternal: (r: SearchResult) => void;
  onSave: (r: SearchResult) => void;
  onCite: (r: SearchResult) => void;
  isItemSaved: (url: string) => SavedItem | undefined;
  initialResults?: SearchResult[];
  initialKnowledge?: KnowledgeCard | null;
  onResultsLoaded?: (
    results: SearchResult[],
    knowledge: KnowledgeCard | null,
  ) => void;
  braveApiKey?: string;
}

type Filter = "all" | "web" | "wikipedia" | "news" | "topic";

export function SearchResults({
  query,
  onQueryChange,
  onSubmit,
  onOpen,
  onOpenExternal,
  onSave,
  onCite,
  isItemSaved,
  initialResults,
  initialKnowledge,
  onResultsLoaded,
  braveApiKey,
}: Props) {
  const [results, setResults] = useState<SearchResult[]>(initialResults || []);
  const [knowledge, setKnowledge] = useState<KnowledgeCard | null>(
    initialKnowledge || null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [elapsed, setElapsed] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [, setEngine] = useState("");
  const intent = detectIntent(query);

  useEffect(() => {
    if (!query.trim()) return;
    // Don't run search for raw URLs or our internal prefix
    if (/^https?:\/\//i.test(query.trim()) || query.startsWith("__open_url__::")) {
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setResults([]);
    setKnowledge(null);
    setSources([]);
    const t0 = performance.now();
    runSearch(query, ctrl.signal, { braveKey: braveApiKey })
      .then((resp) => {
        if (cancelled) return;
        setResults(resp.results);
        setKnowledge(resp.knowledge);
        setEngine(resp.engine);
        setSources(resp.sources);
        setElapsed(Math.round(performance.now() - t0));
        onResultsLoaded?.(resp.results, resp.knowledge);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Search failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [query]);

  const filtered = results.filter((r) => {
    if (filter === "all") return true;
    return r.kind === filter;
  });
  const counts = {
    all: results.length,
    web: results.filter((r) => r.kind === "web").length,
    wikipedia: results.filter((r) => r.kind === "wikipedia").length,
    topic: results.filter((r) => r.kind === "topic").length,
    news: results.filter((r) => r.kind === "news").length,
  };

  const portals =
    intent.vertical && intent.vertical !== "general"
      ? VERTICAL_PORTALS[intent.vertical]
      : null;

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-white/85 dark:bg-ink-950/85 backdrop-blur border-b border-ink-200 dark:border-ink-800">
        <div className="px-4 md:px-8 py-3 flex items-center gap-4">
          <div className="font-semibold text-lg tracking-tight lm-logo text-2xl shrink-0 hidden md:block">AURA</div>
          <div className="flex-1 max-w-2xl">
            <SearchBar
              value={query}
              onChange={onQueryChange}
              onSubmit={onSubmit}
              size="md"
            />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 max-w-3xl mx-auto">
        {/* Vertical portals — for commercial queries, show top destinations first */}
        {portals && portals.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center gap-1.5">
              <Icon.Sparkle width={12} height={12} /> Top places to look
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {portals.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:border-accent-500 hover:bg-ink-50 dark:hover:bg-ink-900 transition-colors"
                >
                  <div className="text-2xl mb-1">{p.emoji}</div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-[10px] text-ink-500 mt-0.5">
                    {p.description}
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-4 border-t border-ink-200 dark:border-ink-700" />
          </div>
        )}

        {/* Result meta */}
        {!loading && results.length > 0 && (
          <div className="text-xs text-ink-500 mb-3 flex items-center gap-3 flex-wrap">
            <span>About {results.length} result{results.length === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>{elapsed}ms</span>
            {sources.length > 0 && (
              <>
                <span>·</span>
                <span title={sources.join(" · ")}>
                  via {sources.slice(0, 2).join(" + ")}
                  {sources.length > 2 && ` +${sources.length - 2}`}
                </span>
              </>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-200 dark:border-ink-700 p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg bg-ink-200 dark:bg-ink-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 bg-ink-200 dark:bg-ink-800 rounded" />
                  <div className="h-5 w-3/4 bg-ink-200 dark:bg-ink-800 rounded" />
                  <div className="h-3 w-full bg-ink-200 dark:bg-ink-800 rounded" />
                  <div className="h-3 w-5/6 bg-ink-200 dark:bg-ink-800 rounded" />
                </div>
              </div>
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="h-3 w-32 bg-ink-200 dark:bg-ink-800 rounded" />
                <div className="h-5 w-3/4 bg-ink-200 dark:bg-ink-800 rounded" />
                <div className="h-3 w-full bg-ink-200 dark:bg-ink-800 rounded" />
                <div className="h-3 w-5/6 bg-ink-200 dark:bg-ink-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
            <div className="font-semibold mb-1">Search failed</div>
            <div className="opacity-80">{error}</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && results.length === 0 && !error && query && (
          <EmptyState
            query={query}
            intent={intent}
            sources={sources}
            onRetry={onSubmit.bind(null, query)}
          />
        )}

        {/* Knowledge card */}
        {!loading && knowledge && (
          <KnowledgeCardPanel
            card={knowledge}
            onOpen={(url, title) =>
              onOpen({
                id: "k",
                kind: "wikipedia",
                title,
                url,
                snippet: knowledge.abstract,
                source: knowledge.source,
              })
            }
            onOpenExternal={(url) =>
              onOpenExternal({
                id: "k",
                kind: "wikipedia",
                title: knowledge.title,
                url,
                snippet: knowledge.abstract,
              })
            }
          />
        )}

        {/* Filter chips */}
        {!loading && results.length > 0 && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <Icon.Filter className="opacity-50" width={14} height={14} />
            {(["all", "web", "wikipedia", "topic", "news"] as Filter[]).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs capitalize ${
                    filter === f
                      ? "bg-accent-500 text-white"
                      : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700"
                  }`}
                >
                  {f}{" "}
                  {counts[f] > 0 && (
                    <span className="opacity-70">({counts[f]})</span>
                  )}
                </button>
              ),
            )}
          </div>
        )}

        {/* Results list */}
        <div className="space-y-1">
          {filtered.map((r) => (
            <ResultCard
              key={r.id}
              result={r}
              onOpen={onOpen}
              onOpenExternal={onOpenExternal}
              onSave={onSave}
              onCite={onCite}
              isSaved={!!isItemSaved(r.url)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  query,
  intent,
  sources,
  onRetry,
}: {
  query: string;
  intent: ReturnType<typeof detectIntent>;
  sources: string[];
  onRetry: () => void;
}) {
  const sourcesTried = sources.length > 0;
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-3">{intent.isCommercial ? "🛍️" : "🔍"}</div>
      <div className="text-lg font-medium">
        {intent.isCommercial
          ? "Try one of the top destinations above"
          : `No results for "${query}"`}
      </div>
      <div className="text-sm text-ink-500 mt-2 max-w-md mx-auto">
        {sourcesTried
          ? `We checked ${sources.length} source${
              sources.length === 1 ? "" : "s"
            } but came up empty.`
          : "We couldn't reach any search source."}
        {" "}The free search APIs are rate-limited.
        {intent.isTopic &&
          " For encyclopedic answers, try rephrasing with a clearer topic."}
      </div>
      <div className="mt-4 flex gap-2 justify-center">
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-sm rounded-md border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800"
        >
          Retry search
        </button>
        <a
          href={`https://duckduckgo.com/?q=${encodeURIComponent(query)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-sm rounded-md bg-accent-500 text-white hover:bg-accent-600 inline-flex items-center gap-1"
        >
          Open on DuckDuckGo <Icon.External width={12} height={12} />
        </a>
      </div>
    </div>
  );
}
