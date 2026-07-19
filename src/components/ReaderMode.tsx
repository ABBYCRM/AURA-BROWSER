import { useEffect, useRef, useState } from "react";
import { fetchPage, toReaderDoc, type ReaderDoc } from "../lib/proxy";
import { Icon } from "./icons";
import type { Highlight, HighlightColor, StickyNote } from "../types";
import { HIGHLIGHT_COLORS } from "../hooks/useAnnotations";

interface Props {
  url: string;
  onClose: () => void;
  // Annotation props
  highlights: Highlight[];
  stickies: StickyNote[];
  onAddHighlight: (h: Omit<Highlight, "id" | "createdAt">) => Highlight;
  onRemoveHighlight: (id: string) => void;
  onAddSticky: (s: Omit<StickyNote, "id" | "createdAt">) => StickyNote;
  onUpdateSticky: (id: string, patch: Partial<StickyNote>) => void;
  onRemoveSticky: (id: string) => void;
  onOpenExternal: () => void;
}

export function ReaderMode({
  url,
  onClose,
  highlights,
  stickies,
  onAddHighlight,
  onRemoveHighlight,
  onAddSticky,
  onUpdateSticky,
  onRemoveSticky,
  onOpenExternal,
}: Props) {
  const [doc, setDoc] = useState<ReaderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "highlight" | "sticky">("select");
  const [pendingHighlight, setPendingHighlight] = useState<{
    text: string;
    prefix: string;
    suffix: string;
    color: HighlightColor;
  } | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch & parse
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDoc(null);
    fetchPage(url)
      .then((html) => {
        if (cancelled) return;
        const r = toReaderDoc(html, url);
        setDoc(r);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Failed to load page");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Inject existing highlights into the rendered HTML
  useEffect(() => {
    if (!doc || !contentRef.current) return;
    const root = contentRef.current;
    // Remove old highlight markers
    root.querySelectorAll(".lm-highlight[data-hl]").forEach((n) => {
      const text = n.textContent || "";
      n.replaceWith(document.createTextNode(text));
    });
    root.querySelectorAll(".lm-sticky").forEach((n) => n.remove());
    // Re-normalize text nodes
    root.normalize();

    for (const h of highlights) {
      // Find text in any text node
      const text = h.text;
      if (!text) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const tn = node as Text;
        const idx = tn.textContent?.indexOf(text);
        if (idx === undefined || idx < 0) continue;
        // Verify context
        const parent = tn.textContent || "";
        if (
          h.prefix &&
          !parent.slice(Math.max(0, idx - h.prefix.length), idx).endsWith(h.prefix)
        ) {
          // Try to find a different occurrence
          continue;
        }
        const before = parent.slice(0, idx);
        const after = parent.slice(idx + text.length);
        const span = document.createElement("span");
        span.className = "lm-highlight";
        span.setAttribute("data-hl", h.id);
        span.style.background = HIGHLIGHT_COLORS.find((c) => c.id === h.color)?.bg || "";
        span.title = h.note || "Click to view";
        span.textContent = text;
        const frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode(before));
        frag.appendChild(span);
        frag.appendChild(document.createTextNode(after));
        tn.parentNode?.replaceChild(frag, tn);
        break;
      }
    }

    // Sticky notes — absolutely positioned
    for (const s of stickies) {
      const el = document.createElement("div");
      el.className = "lm-sticky";
      el.setAttribute("data-sticky", s.id);
      el.style.left = s.x + "%";
      el.style.top = s.y + "px";
      el.textContent = s.text;
      containerRef.current?.appendChild(el);
    }
  }, [doc, highlights, stickies]);

  // Selection -> highlight
  useEffect(() => {
    if (tool !== "highlight") return;
    const root = contentRef.current;
    if (!root) return;
    const onUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (text.length < 2) return;
      // Get prefix/suffix from container text
      const containerText = root.textContent || "";
      const idx = containerText.indexOf(text);
      const prefix = idx >= 0 ? containerText.slice(Math.max(0, idx - 30), idx) : "";
      const suffix =
        idx >= 0
          ? containerText.slice(idx + text.length, idx + text.length + 30)
          : "";
      setPendingHighlight({ text, prefix, suffix, color: "yellow" });
      setPendingNote("");
      sel.removeAllRanges();
    };
    root.addEventListener("mouseup", onUp);
    return () => root.removeEventListener("mouseup", onUp);
  }, [tool]);

  const savePending = () => {
    if (!pendingHighlight) return;
    onAddHighlight({
      url,
      text: pendingHighlight.text,
      prefix: pendingHighlight.prefix,
      suffix: pendingHighlight.suffix,
      color: pendingHighlight.color,
      note: pendingNote || undefined,
    });
    setPendingHighlight(null);
    setPendingNote("");
  };

  const addStickyHere = (e: React.MouseEvent) => {
    if (tool !== "sticky") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = e.clientY - rect.top;
    onAddSticky({
      url,
      x,
      y,
      text: "New note — click to edit",
      color: "#fff3a8",
    });
    setTool("select");
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="lm-spin w-8 h-8 text-accent-500 mx-auto mb-3" />
          <div className="text-sm text-ink-500">Fetching & cleaning article…</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-3">😕</div>
          <div className="font-semibold">Couldn't load this page in reader mode</div>
          <div className="text-sm text-ink-500 mt-1">{error}</div>
          <div className="flex gap-2 justify-center mt-4">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-ink-200 dark:border-ink-700 text-sm hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              Back to iframe
            </button>
            <button
              onClick={onOpenExternal}
              className="px-3 py-1.5 rounded-md bg-accent-500 text-white text-sm hover:bg-accent-600"
            >
              Open externally
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!doc) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-ink-950/90 backdrop-blur border-b border-ink-200 dark:border-ink-800">
        <div className="px-4 py-2 flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={() => setTool("select")}
              className={`p-1.5 rounded-md ${tool === "select" ? "bg-ink-200 dark:bg-ink-800" : "hover:bg-ink-100 dark:hover:bg-ink-800"}`}
              title="Select / read"
            >
              <Icon.ArrowRight width={14} height={14} />
            </button>
            <button
              onClick={() => setTool("highlight")}
              className={`p-1.5 rounded-md ${tool === "highlight" ? "bg-yellow-200 text-yellow-900" : "hover:bg-ink-100 dark:hover:bg-ink-800"}`}
              title="Highlight mode: select text to highlight"
            >
              <Icon.Highlighter width={14} height={14} />
            </button>
            <button
              onClick={() => setTool("sticky")}
              className={`p-1.5 rounded-md ${tool === "sticky" ? "bg-yellow-200 text-yellow-900" : "hover:bg-ink-100 dark:hover:bg-ink-800"}`}
              title="Sticky mode: click anywhere to add a note"
            >
              <Icon.Note width={14} height={14} />
            </button>
          </div>
          <div className="text-xs text-ink-500 truncate flex-1">
            {doc.siteName && <span className="font-medium">{doc.siteName}</span>}
            {doc.byline && <span> · {doc.byline}</span>}
            <span className="ml-2 opacity-60">{doc.length} min read</span>
          </div>
          <button
            onClick={onOpenExternal}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
            title="Open original"
          >
            <Icon.External width={12} height={12} /> Original
          </button>
          <button
            onClick={onClose}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
            title="Switch to iframe view"
          >
            <Icon.Globe width={12} height={12} /> Iframe
          </button>
        </div>
      </div>

      {/* Article */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto ${tool === "sticky" ? "cursor-crosshair" : ""}`}
        onClick={addStickyHere}
      >
        <article className="lm-reader" ref={contentRef}>
          {doc.image && (
            <img
              src={doc.image}
              alt=""
              className="w-full max-h-72 object-cover rounded-xl mb-6 -mt-2"
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
            />
          )}
          <div className="text-xs uppercase tracking-wider text-accent-600 dark:text-accent-400 font-semibold">
            {doc.siteName}
          </div>
          <h1>{doc.title}</h1>
          {doc.byline && (
            <div className="text-sm text-ink-500 mb-6">By {doc.byline}</div>
          )}
          <div dangerouslySetInnerHTML={{ __html: doc.html }} />
          <div className="mt-12 pt-6 border-t border-ink-200 dark:border-ink-800 text-sm text-ink-500">
            Source:{" "}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent-600 dark:text-accent-400 hover:underline break-all">
              {url}
            </a>
          </div>
        </article>
      </div>

      {/* Pending highlight dialog */}
      {pendingHighlight && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPendingHighlight(null)}
        >
          <div
            className="bg-white dark:bg-ink-900 rounded-2xl shadow-pop w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold mb-2">Add highlight</div>
            <div
              className="text-sm p-3 rounded-lg mb-3 line-clamp-3"
              style={{ background: HIGHLIGHT_COLORS.find((c) => c.id === pendingHighlight.color)?.bg }}
            >
              "{pendingHighlight.text}"
            </div>
            <div className="flex items-center gap-2 mb-3">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPendingHighlight({ ...pendingHighlight, color: c.id })}
                  className={`w-7 h-7 rounded-full border-2 ${pendingHighlight.color === c.id ? "border-ink-900 dark:border-white" : "border-transparent"}`}
                  style={{ background: c.bg }}
                  title={c.label}
                />
              ))}
            </div>
            <textarea
              autoFocus
              value={pendingNote}
              onChange={(e) => setPendingNote(e.target.value)}
              placeholder="Add a note (optional)…"
              className="w-full text-sm p-2.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-transparent outline-none focus:border-accent-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setPendingHighlight(null)}
                className="px-3 py-1.5 text-sm rounded-md border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                onClick={savePending}
                className="px-3 py-1.5 text-sm rounded-md bg-accent-500 text-white hover:bg-accent-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Highlight / sticky list (floating) */}
      {(highlights.length > 0 || stickies.length > 0) && (
        <div className="fixed bottom-4 right-4 z-30 max-w-xs">
          <details className="bg-white dark:bg-ink-900 rounded-xl shadow-pop border border-ink-200 dark:border-ink-700 overflow-hidden group">
            <summary className="px-3 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer select-none">
              <Icon.Highlighter width={12} height={12} />
              {highlights.length} highlight{highlights.length === 1 ? "" : "s"} ·{" "}
              {stickies.length} note{stickies.length === 1 ? "" : "s"} on this page
            </summary>
            <div className="max-h-72 overflow-auto p-2 space-y-2">
              {highlights.map((h) => (
                <div
                  key={h.id}
                  className="p-2 rounded-md bg-ink-50 dark:bg-ink-800 text-xs"
                >
                  <div
                    className="px-1.5 py-0.5 rounded inline-block"
                    style={{ background: HIGHLIGHT_COLORS.find((c) => c.id === h.color)?.bg }}
                  >
                    {h.text}
                  </div>
                  {h.note && <div className="mt-1 text-ink-500 italic">"{h.note}"</div>}
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={() => onRemoveHighlight(h.id)}
                      className="text-ink-400 hover:text-red-500"
                    >
                      <Icon.Trash width={10} height={10} />
                    </button>
                  </div>
                </div>
              ))}
              {stickies.map((s) => (
                <div
                  key={s.id}
                  className="p-2 rounded-md bg-ink-50 dark:bg-ink-800 text-xs"
                >
                  <textarea
                    value={s.text}
                    onChange={(e) => onUpdateSticky(s.id, { text: e.target.value })}
                    className="w-full bg-transparent outline-none resize-none"
                    rows={2}
                  />
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={() => onRemoveSticky(s.id)}
                      className="text-ink-400 hover:text-red-500"
                    >
                      <Icon.Trash width={10} height={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
