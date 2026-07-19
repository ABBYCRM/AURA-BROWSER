// useTabs — browser-tab state model.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Tab, SearchResult, KnowledgeCard } from "../types";
import { storage, KEYS, uid } from "../lib/storage";

const newHomeTab = (): Tab => ({
  id: uid("tab"),
  kind: "home",
  title: "New Tab",
  createdAt: Date.now(),
});

export function useTabs() {
  // Initialize from storage exactly once to avoid creating phantom tab IDs
  // when the useState lazy initializer is called multiple times.
  const initial = useMemo(() => {
    const stored = storage.get<Tab[]>(KEYS.tabs, []);
    if (stored.length) {
      const storedActive = storage.get<string | null>(KEYS.activeTab, null);
      const validActive = storedActive && stored.some((t) => t.id === storedActive)
        ? storedActive
        : stored[0].id;
      return { tabs: stored, activeId: validActive };
    }
    const fresh = [newHomeTab()];
    return { tabs: fresh, activeId: fresh[0].id };
  }, []);

  const [tabs, setTabs] = useState<Tab[]>(initial.tabs);
  const [activeId, setActiveId] = useState<string>(initial.activeId);

  useEffect(() => storage.set(KEYS.tabs, tabs), [tabs]);
  useEffect(() => storage.set(KEYS.activeTab, activeId), [activeId]);

  const active = tabs.find((t) => t.id === activeId) || tabs[0];

  const updateTab = useCallback(
    (id: string, patch: Partial<Tab>) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const newTab = useCallback((init?: Partial<Tab>) => {
    const tab: Tab = {
      id: uid("tab"),
      kind: "home",
      title: "New Tab",
      createdAt: Date.now(),
      ...init,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    return tab;
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length === 1) {
          // never leave the user with zero tabs
          const fresh = newHomeTab();
          setActiveId(fresh.id);
          return [fresh];
        }
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (id === activeId) {
          const fallback = next[Math.max(0, idx - 1)] || next[0];
          setActiveId(fallback.id);
        }
        return next;
      });
    },
    [activeId],
  );

  const closeOthers = useCallback((id: string) => {
    setTabs((prev) => {
      const kept = prev.find((t) => t.id === id);
      if (!kept) return prev;
      setActiveId(kept.id);
      return [kept];
    });
  }, []);

  const setSearchState = useCallback(
    (
      id: string,
      state: {
        title?: string;
        query?: string;
        results?: SearchResult[];
        knowledge?: KnowledgeCard | null;
        isLoading?: boolean;
      },
    ) => {
      updateTab(id, { kind: "search", ...state });
    },
    [updateTab],
  );

  const setViewerState = useCallback(
    (
      id: string,
      state: {
        url?: string;
        title?: string;
        favicon?: string;
        history?: { url: string; title: string }[];
        historyIndex?: number;
        scrollY?: number;
      },
    ) => {
      updateTab(id, { kind: "viewer", ...state });
    },
    [updateTab],
  );

  return {
    tabs,
    active,
    activeId,
    setActiveId,
    newTab,
    closeTab,
    closeOthers,
    updateTab,
    setSearchState,
    setViewerState,
  };
}
