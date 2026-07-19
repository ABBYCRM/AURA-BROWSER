// useSettings — application settings, persisted.

import { useCallback, useEffect, useState } from "react";
import type { Settings } from "../types";
import { storage, KEYS } from "../lib/storage";

const defaults: Settings = {
  defaultEngine: "duckduckgo",
  safeSearch: true,
  region: "us-en",
  openResultsIn: "iframe",
  theme: "system",
  showKnowledgeCard: true,
  enableCORSProxy: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() =>
    storage.get<Settings>(KEYS.settings, defaults),
  );

  useEffect(() => storage.set(KEYS.settings, settings), [settings]);

  const update = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [k]: v }));
  }, []);

  const reset = useCallback(() => setSettings(defaults), []);

  return { settings, update, reset };
}
