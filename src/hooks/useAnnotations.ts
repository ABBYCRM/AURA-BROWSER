// useAnnotations — highlights + sticky notes per URL, persisted to localStorage.

import { useCallback, useEffect, useState } from "react";
import type { Highlight, HighlightColor, StickyNote } from "../types";
import { storage, KEYS, uid } from "../lib/storage";

export function useAnnotations() {
  const [highlights, setHighlights] = useState<Highlight[]>(() =>
    storage.get<Highlight[]>(KEYS.highlights, []),
  );
  const [stickies, setStickies] = useState<StickyNote[]>(() =>
    storage.get<StickyNote[]>(KEYS.stickies, []),
  );

  useEffect(() => storage.set(KEYS.highlights, highlights), [highlights]);
  useEffect(() => storage.set(KEYS.stickies, stickies), [stickies]);

  const addHighlight = useCallback(
    (h: Omit<Highlight, "id" | "createdAt">) => {
      const full: Highlight = { ...h, id: uid("hl"), createdAt: Date.now() };
      setHighlights((prev) => [full, ...prev]);
      return full;
    },
    [],
  );

  const updateHighlight = useCallback((id: string, patch: Partial<Highlight>) => {
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    );
  }, []);

  const removeHighlight = useCallback((id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const highlightsFor = useCallback(
    (url: string) => highlights.filter((h) => h.url === url),
    [highlights],
  );

  const addSticky = useCallback((s: Omit<StickyNote, "id" | "createdAt">) => {
    const full: StickyNote = { ...s, id: uid("st"), createdAt: Date.now() };
    setStickies((prev) => [...prev, full]);
    return full;
  }, []);

  const updateSticky = useCallback((id: string, patch: Partial<StickyNote>) => {
    setStickies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  const removeSticky = useCallback((id: string) => {
    setStickies((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const stickiesFor = useCallback(
    (url: string) => stickies.filter((s) => s.url === url),
    [stickies],
  );

  const removeFor = useCallback((url: string) => {
    setHighlights((prev) => prev.filter((h) => h.url !== url));
    setStickies((prev) => prev.filter((s) => s.url !== url));
  }, []);

  return {
    highlights,
    stickies,
    addHighlight,
    updateHighlight,
    removeHighlight,
    highlightsFor,
    addSticky,
    updateSticky,
    removeSticky,
    stickiesFor,
    removeFor,
  };
}

export const HIGHLIGHT_COLORS: { id: HighlightColor; bg: string; label: string }[] = [
  { id: "yellow", bg: "#fff3a8", label: "Yellow" },
  { id: "green", bg: "#bbf7d0", label: "Green" },
  { id: "blue", bg: "#bfdbfe", label: "Blue" },
  { id: "pink", bg: "#fbcfe8", label: "Pink" },
  { id: "orange", bg: "#fed7aa", label: "Orange" },
];
