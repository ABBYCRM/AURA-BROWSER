import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { nimChatStream, buildAnswerPrompt } from "../lib/ai";
import type { SearchResult } from "../types";

interface Props {
  query: string;
  results: SearchResult[];
  apiKey: string;
  model: string;
  enabled: boolean;
  onCitationClick?: (url: string) => void;
}

export function AIAnswerPanel({
  query,
  results,
  apiKey,
  model,
  enabled,
  onCitationClick,
}: Props) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [usedCitations, setUsedCitations] = useState<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAnswer("");
    setError(null);
    setUsedCitations([]);
    if (!enabled || !apiKey || !query.trim()) return;

    // Don't run for raw URLs
    if (/^https?:\/\//i.test(query.trim()) || query.startsWith("__open_url__::")) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    const messages = buildAnswerPrompt(
      query,
      results.length ? results : undefined,
    );

    nimChatStream(
      apiKey,
      { messages, model, signal: ctrl.signal, max_tokens: 512, temperature: 0.4 },
      (delta) => setAnswer((a) => a + delta),
    )
      .then((full) => {
        // Extract [n] citations the model used
        const refs = Array.from(
          new Set(
            Array.from(full.matchAll(/\[(\d+)\]/g))
              .map((m) => parseInt(m[1], 10))
              .filter((n) => n >= 1 && n <= (results.length || 0)),
          ),
        );
        setUsedCitations(refs);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError(e?.message || "AI request failed");
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [query, results, apiKey, model, enabled]);

  if (!enabled) return null;
  if (dismissed) return null;
  if (!apiKey) {
    return (
      <div className="lm-result rounded-2xl p-4 mb-4 border border-dashed border-ink-300 dark:border-ink-700">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white">
            <Icon.Sparkle width={16} height={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium mb-0.5">AI answers are off</div>
            <div className="text-xs text-ink-500 leading-relaxed">
              Add a free <span className="font-mono">NVIDIA NIM</span> API key in{" "}
              <strong>Settings → AI assistant</strong> to enable a Llama 3.1
              "answer engine" above your web results — like Google's AI
              Overviews, but private and on-device-configurable.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !answer) {
    return (
      <div className="lm-result rounded-2xl p-4 mb-4 border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 shrink-0 rounded-full bg-red-500 flex items-center justify-center text-white">
            <Icon.X width={16} height={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium mb-0.5">
              AI answer unavailable
            </div>
            <div className="text-xs text-ink-500 break-words">
              {error}
            </div>
            <button
              onClick={() => {
                setError(null);
                // Force re-run by tweaking state
                setAnswer(" ");
                setTimeout(() => setAnswer(""), 0);
              }}
              className="mt-2 text-xs text-accent-600 dark:text-accent-400 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !answer) return null;

  return (
    <div
      data-ai-answer
      className="lm-result rounded-2xl p-5 mb-4 border border-accent-200 dark:border-accent-800 bg-gradient-to-br from-accent-50/40 to-white dark:from-accent-900/20 dark:to-ink-900 shadow-soft animate-fade-in"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white text-sm font-bold">
          ✦
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] uppercase tracking-wider text-accent-700 dark:text-accent-300 font-semibold flex items-center gap-1.5">
              <Icon.Sparkle width={11} height={11} />
              AI answer · {model.split("/").pop()}
              {loading && (
                <span className="ml-1 inline-flex items-center gap-1 text-ink-500 normal-case tracking-normal">
                  <span className="lm-spin w-2.5 h-2.5" />
                  thinking
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {answer && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(answer);
                  }}
                  className="p-1 rounded hover:bg-ink-200 dark:hover:bg-ink-800 text-ink-500"
                  title="Copy"
                >
                  <Icon.Note width={12} height={12} />
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="p-1 rounded hover:bg-ink-200 dark:hover:bg-ink-800 text-ink-500"
                title="Hide"
              >
                <Icon.Close width={12} height={12} />
              </button>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-ink-800 dark:text-ink-200 leading-relaxed">
            <FormattedAnswer text={answer} citations={results.slice(0, 6)} onCitationClick={onCitationClick} />
          </div>

          {usedCitations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-ink-200 dark:border-ink-700 flex items-center gap-2 flex-wrap text-[11px] text-ink-500">
              <span>Sources:</span>
              {usedCitations.slice(0, 6).map((n) => {
                const r = results[n - 1];
                if (!r) return null;
                return (
                  <a
                    key={n}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onCitationClick?.(r.url)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800 hover:bg-accent-100 dark:hover:bg-accent-900/40 text-ink-700 dark:text-ink-200"
                  >
                    [{n}] {r.displayUrl || r.title.slice(0, 30)}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormattedAnswer({
  text,
  citations,
  onCitationClick,
}: {
  text: string;
  citations: SearchResult[];
  onCitationClick?: (url: string) => void;
}) {
  if (!text) {
    return (
      <div className="space-y-1.5">
        <div className="h-3 bg-ink-200/60 dark:bg-ink-800 rounded animate-pulse w-11/12" />
        <div className="h-3 bg-ink-200/60 dark:bg-ink-800 rounded animate-pulse w-10/12" />
        <div className="h-3 bg-ink-200/60 dark:bg-ink-800 rounded animate-pulse w-8/12" />
      </div>
    );
  }
  // Render paragraphs, with [n] replaced by a small inline link
  const paragraphs = text.split(/\n\n+/);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {renderInlineCitations(p, citations, onCitationClick)}
        </p>
      ))}
    </>
  );
}

function renderInlineCitations(
  text: string,
  citations: SearchResult[],
  onCitationClick?: (url: string) => void,
) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = /\[(\d+)\]/.exec(part);
    if (m) {
      const n = parseInt(m[1], 10);
      const r = citations[n - 1];
      if (r) {
        return (
          <a
            key={i}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onCitationClick?.(r.url)}
            className="inline-flex items-center justify-center min-w-[1.4em] h-[1.4em] px-1 mx-0.5 rounded text-[0.75em] font-medium bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 hover:bg-accent-200 dark:hover:bg-accent-900/60 align-baseline"
            title={r.title}
          >
            {n}
          </a>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}
