import { useCallback, useEffect, useState } from "react";
import { Icon } from "./components/icons";
import { HomePage } from "./components/HomePage";
import { SearchResults } from "./components/SearchResults";
import { Viewer } from "./components/Viewer";
import { ReaderMode } from "./components/ReaderMode";
import { Sidebar, type SidebarView } from "./components/Sidebar";
import { TabsBar } from "./components/TabsBar";
import { SaveToCollectionModal } from "./components/SaveToCollectionModal";
import { useTabs } from "./hooks/useTabs";
import { useCollections, makeSearchItem } from "./hooks/useCollections";
import { useAnnotations } from "./hooks/useAnnotations";
import { useHistory } from "./hooks/useHistory";
import { useSettings } from "./hooks/useSettings";
import { storage, KEYS, domainOf } from "./lib/storage";
import { exportCollectionAsMarkdown, exportHistoryAsMarkdown, downloadMarkdown } from "./lib/markdown";
import type { SearchResult, SavedItem } from "./types";

export default function App() {
  const tabs = useTabs();
  const { settings, update: updateSettings } = useSettings();
  const collections = useCollections();
  const annotations = useAnnotations();
  const history = useHistory();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    storage.get<boolean>(KEYS.sidebarCollapsed, false),
  );
  const [view, setView] = useState<SidebarView>(() => {
    return storage.get<SidebarView | null>("sidebarView", null) || { kind: "home" };
  });
  const [saveModal, setSaveModal] = useState<SavedItem | null>(null);
  const [pendingReader, setPendingReader] = useState<{ url: string; title: string } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = storage.get<"light" | "dark" | "system">(KEYS.settings + ".theme", "system");
    return stored === "dark" || stored === "light" ? stored : "light";
  });

  useEffect(() => storage.set(KEYS.sidebarCollapsed, sidebarCollapsed), [sidebarCollapsed]);
  useEffect(() => storage.set("sidebarView", view), [view]);

  /* ----------------------- Theme handling ----------------------- */
  useEffect(() => {
    const root = document.documentElement;
    const apply = (t: "light" | "dark") => {
      setTheme(t);
      if (t === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };
    if (settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      apply(settings.theme);
    }
  }, [settings.theme]);

  /* ----------------------- Search / open results ----------------------- */
  const runSearch = useCallback(
    (q: string) => {
      const id = tabs.activeId;
      if (!q.trim()) return;
      // Special prefix: open a URL directly
      if (q.startsWith("__open_url__::")) {
        const url = q.slice("__open_url__::".length);
        try {
          const u = new URL(url);
          tabs.setViewerState(id, {
            title: u.hostname,
            url: u.toString(),
            history: [{ url: u.toString(), title: u.hostname }],
            historyIndex: 0,
          });
        } catch {
          // fall through to search
          tabs.setSearchState(id, {
            title: q,
            query: q,
            isLoading: true,
          });
        }
        return;
      }
      tabs.setSearchState(id, {
        title: q,
        query: q,
        isLoading: true,
      });
    },
    [tabs],
  );

  const openResult = useCallback(
    (r: SearchResult) => {
      const id = tabs.activeId;
      const newHistory = [{ url: r.url, title: r.title }];
      tabs.setViewerState(id, {
        url: r.url,
        title: r.title,
        favicon: undefined,
        history: newHistory,
        historyIndex: 0,
      });
    },
    [tabs],
  );

  const openExternal = useCallback((r: SearchResult) => {
    window.open(r.url, "_blank", "noopener,noreferrer");
  }, []);

  const openUrlInTab = useCallback(
    (url: string, title: string) => {
      const id = tabs.activeId;
      tabs.setViewerState(id, {
        url,
        title,
        history: [{ url, title }],
        historyIndex: 0,
      });
    },
    [tabs],
  );

  const openSaved = useCallback(
    (it: SavedItem) => {
      if (it.url) {
        openUrlInTab(it.url, it.title);
      }
    },
    [openUrlInTab],
  );

  /* ----------------------- Save / cite / collect ----------------------- */
  const saveResult = useCallback(
    (r: SearchResult) => {
      const existing = collections.isItemSaved(r.url);
      if (existing) {
        // Toggle off
        collections.removeItem(existing.id);
        return;
      }
      const item = makeSearchItem({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: r.source,
        query: tabs.active?.query,
      });
      const saved = collections.saveItem(item);
      setSaveModal(saved);
    },
    [collections, tabs.active?.query],
  );

  const citeResult = useCallback(
    (r: SearchResult) => {
      // Save + auto-add to "Citations" collection
      const existing = collections.isItemSaved(r.url);
      let item = existing;
      if (!item) {
        item = collections.saveItem(
          makeSearchItem({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            source: r.source,
            query: tabs.active?.query,
          }),
        );
      }
      collections.addToCollection(item.id, "col_cited");
      setSaveModal(item);
    },
    [collections, tabs.active?.query],
  );

  const saveCurrentPage = useCallback(() => {
    const t = tabs.active;
    if (!t || !t.url) return;
    const existing = collections.isItemSaved(t.url);
    if (existing) {
      collections.removeItem(existing.id);
      return;
    }
    const item = collections.saveItem({
      kind: "page",
      title: t.title,
      url: t.url,
      content: "",
      source: domainOf(t.url),
      tags: [],
    });
    setSaveModal(item);
  }, [tabs.active, collections]);

  /* ----------------------- Back / forward / reload ----------------------- */
  const back = useCallback(() => {
    const t = tabs.active;
    if (!t || !t.history || t.historyIndex == null) return;
    if (t.historyIndex > 0) {
      const idx = t.historyIndex - 1;
      const entry = t.history[idx];
      tabs.setViewerState(t.id, {
        historyIndex: idx,
        url: entry.url,
        title: entry.title,
      });
    }
  }, [tabs]);

  const forward = useCallback(() => {
    const t = tabs.active;
    if (!t || !t.history || t.historyIndex == null) return;
    if (t.historyIndex < t.history.length - 1) {
      const idx = t.historyIndex + 1;
      const entry = t.history[idx];
      tabs.setViewerState(t.id, {
        historyIndex: idx,
        url: entry.url,
        title: entry.title,
      });
    }
  }, [tabs]);

  const reload = useCallback(() => {
    // Force re-render of active tab by toggling a key
    const t = tabs.active;
    if (!t) return;
    if (t.kind === "viewer") {
      // Bump historyIndex-equivalent by nudging
      tabs.updateTab(t.id, { scrollY: Date.now() });
    } else if (t.kind === "search" && t.query) {
      runSearch(t.query);
    }
  }, [tabs, runSearch]);

  /* ----------------------- New tab / home ----------------------- */
  const newTab = useCallback(() => {
    tabs.newTab({ kind: "home", title: "New Tab" });
  }, [tabs]);



  const lucky = useCallback(() => {
    const list = [
      "black hole information paradox",
      "octopus intelligence",
      "industrial revolution causes",
      "deep sea creatures",
      "origins of language",
      "how do vaccines work",
      "lost city of z",
    ];
    const q = list[Math.floor(Math.random() * list.length)];
    runSearch(q);
  }, [runSearch]);

  /* ----------------------- Keyboard shortcuts ----------------------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === "t") {
        e.preventDefault();
        newTab();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        tabs.closeTab(tabs.activeId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        const t = tabs.active;
        if (t) runSearch(prompt("Search:") || t.query || "");
      } else if ((e.ctrlKey || e.metaKey) && e.key === "d" && tabs.active?.url) {
        e.preventDefault();
        saveCurrentPage();
      } else if (e.key === "Escape" && saveModal) {
        setSaveModal(null);
      } else if (e.key === "/" && !isInput) {
        // Press / anywhere to focus the search bar
        e.preventDefault();
        const input = document.querySelector(
          'input[placeholder*="Search"]',
        ) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [tabs, newTab, runSearch, saveModal, saveCurrentPage]);

  /* ----------------------- Record search in history ----------------------- */
  useEffect(() => {
    const t = tabs.active;
    if (t?.kind === "search" && t.query && t.results && t.results.length > 0) {
      history.record(t.query, t.results.length);
    }
  }, [tabs.active?.id, (tabs.active as any)?.results?.length, history]);

  /* ----------------------- Reader mode ----------------------- */
  const openInReader = useCallback(
    (url: string, title: string) => {
      setPendingReader({ url, title });
    },
    [],
  );



  /* ----------------------- Export handlers ----------------------- */
  const exportCol = useCallback(
    (id: string) => {
      const col = collections.collections.find((c) => c.id === id);
      if (!col) return;
      const items = collections.itemsByCollection(id);
      const highlights = annotations.highlights;
      const stickies = annotations.stickies;
      const md = exportCollectionAsMarkdown(col, items, highlights, stickies);
      downloadMarkdown(`${col.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`, md);
    },
    [collections, annotations],
  );

  const exportHist = useCallback(() => {
    const md = exportHistoryAsMarkdown(history.history);
    downloadMarkdown("search-history.md", md);
  }, [history.history]);

  /* ----------------------- Render ----------------------- */
  const t = tabs.active;
  const canBack = t?.kind === "viewer" && (t.historyIndex || 0) > 0;
  const canForward =
    t?.kind === "viewer" &&
    t.history &&
    t.historyIndex != null &&
    t.historyIndex < t.history.length - 1;

  return (
    <div className={`h-full flex flex-col ${theme === "dark" ? "dark" : ""}`}>
      <div className="h-full flex bg-[var(--bg)] text-[var(--fg)]">
        <Sidebar
          view={view}
          onView={setView}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          collections={collections.collections}
          history={history.history}
          savedItems={collections.items}
          settings={settings}
          onNewCollection={() => {
            const name = prompt("Collection name?");
            if (name?.trim()) {
              const c = collections.createCollection({ name: name.trim() });
              setView({ kind: "collection", id: c.id });
            }
          }}
          onOpenSaved={openSaved}
          onRemoveSaved={(id) => collections.removeItem(id)}
          onClearHistory={() => {
            if (confirm("Clear all search history?")) history.clear();
          }}
          onRemoveHistory={(id) => history.remove(id)}
          onUpdateSettings={updateSettings}
          onExportHistory={exportHist}
          onExportCollection={exportCol}
          onDeleteCollection={(id) => collections.deleteCollection(id)}
        />

        <main className="flex-1 flex flex-col min-w-0">
          <TabsBar
            tabs={tabs.tabs}
            activeId={tabs.activeId}
            onActivate={tabs.setActiveId}
            onClose={tabs.closeTab}
            onNew={newTab}
            onBack={back}
            onForward={forward}
            onReload={reload}
            canBack={!!canBack}
            canForward={!!canForward}
          />

          {/* Active tab content */}
          <div className="flex-1 min-h-0 relative">
            {t?.kind === "home" && (
              <HomePage
                onSearch={(q) => runSearch(q)}
                onLucky={lucky}
                history={history.history}
                collections={collections.collections}
                items={collections.items}
                onOpenSaved={openSaved}
                onOpenCollection={(id) => setView({ kind: "collection", id })}
              />
            )}

            {t?.kind === "search" && t.query && (
              <SearchResults
                query={t.query}
                onQueryChange={(q) => tabs.setSearchState(t.id, { query: q })}
                onSubmit={(q) => {
                  tabs.setSearchState(t.id, { query: q, title: q });
                }}
                onOpen={openResult}
                onOpenExternal={openExternal}
                onSave={saveResult}
                onCite={citeResult}
                isItemSaved={collections.isItemSaved}
                onResultsLoaded={(results, knowledge) =>
                  tabs.setSearchState(t.id, { results, knowledge, isLoading: false })
                }
                braveApiKey={settings.braveApiKey}
                key={`${t.id}_${settings.braveApiKey || "free"}_${t.query}`}
              />
            )}

            {t?.kind === "viewer" && t.url && !pendingReader && (
              <Viewer
                key={t.url}
                url={t.url}
                title={t.title}
                onOpenInReader={(url, title) => openInReader(url, title)}
                onOpenExternal={() => window.open(t.url!, "_blank", "noopener,noreferrer")}
                onTitleChange={(title) => tabs.setViewerState(t.id, { title })}
              />
            )}

            {t?.kind === "viewer" && pendingReader && (
              <ReaderMode
                key={pendingReader.url + "_reader"}
                url={pendingReader.url}
                onClose={() => setPendingReader(null)}
                highlights={annotations.highlightsFor(pendingReader.url)}
                stickies={annotations.stickiesFor(pendingReader.url)}
                onAddHighlight={annotations.addHighlight}
                onRemoveHighlight={annotations.removeHighlight}
                onAddSticky={annotations.addSticky}
                onUpdateSticky={annotations.updateSticky}
                onRemoveSticky={annotations.removeSticky}
                onOpenExternal={() =>
                  window.open(pendingReader.url, "_blank", "noopener,noreferrer")
                }
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating action: save current page */}
      {t?.kind === "viewer" && (
        <button
          onClick={saveCurrentPage}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 shadow-pop text-sm hover:bg-ink-50 dark:hover:bg-ink-800"
          title="Save this page (Ctrl+D)"
        >
          {collections.isItemSaved(t.url || "") ? (
            <Icon.BookmarkFilled className="text-accent-500" width={14} height={14} />
          ) : (
            <Icon.Bookmark width={14} height={14} />
          )}
          {collections.isItemSaved(t.url || "") ? "Saved" : "Save page"}
        </button>
      )}

      {/* Save modal */}
      {saveModal && (
        <SaveToCollectionModal
          item={saveModal}
          collections={collections.collections}
          onClose={() => setSaveModal(null)}
          onSaveTo={(cid) => {
            collections.addToCollection(saveModal.id, cid);
            setSaveModal(null);
          }}
          onRemoveFrom={(cid) => {
            collections.removeFromCollection(saveModal.id, cid);
          }}
          onCreate={(init) => {
            const c = collections.createCollection({
              name: init.name,
              emoji: init.emoji,
              color: "gray",
            });
            collections.addToCollection(saveModal.id, c.id);
          }}
        />
      )}
    </div>
  );
}
