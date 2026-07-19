// useHistory — search history, persisted.

import { useCallback, useEffect, useState } from "react";
import type { HistoryEntry } from "../types";
import { storage, KEYS, uid } from "../lib/storage";

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    storage.get<HistoryEntry[]>(KEYS.history, []),
  );

  useEffect(() => storage.set(KEYS.history, history), [history]);

  const record = useCallback((query: string, resultsCount: number) => {
    if (!query.trim()) return;
    setHistory((prev) => {
      // De-dupe last identical query
      const next = [...prev];
      const idx = next.findIndex(
        (h) => h.query.toLowerCase() === query.toLowerCase(),
      );
      if (idx >= 0) next.splice(idx, 1);
      next.push({
        id: uid("h"),
        query,
        resultsCount,
        createdAt: Date.now(),
      });
      // Cap at 200
      return next.slice(-200);
    });
  }, []);

  const clear = useCallback(() => setHistory([]), []);
  const remove = useCallback((id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { history, record, clear, remove };
}
