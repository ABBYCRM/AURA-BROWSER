// Type definitions for the AURA research browser

export type ResultKind = "web" | "wikipedia" | "news" | "video" | "image" | "topic";

export interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  url: string;
  displayUrl?: string;
  snippet: string;
  thumbnail?: string;
  date?: string;
  source?: string;
  meta?: Record<string, string>;
}

export interface KnowledgeCard {
  title: string;
  abstract: string;
  url: string;
  imageUrl?: string;
  source: string;
  facts?: { label: string; value: string }[];
  relatedTopics?: { name: string; url: string }[];
}

export type TabKind = "home" | "search" | "viewer";

export interface Tab {
  id: string;
  kind: TabKind;
  title: string;
  favicon?: string;
  query?: string;
  url?: string;
  // search state
  results?: SearchResult[];
  knowledge?: KnowledgeCard | null;
  isLoading?: boolean;
  // viewer state
  history?: { url: string; title: string }[];
  historyIndex?: number;
  scrollY?: number;
  createdAt: number;
}

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "orange";

export interface Highlight {
  id: string;
  url: string;
  text: string;
  prefix: string; // surrounding context for re-anchoring
  suffix: string;
  color: HighlightColor;
  note?: string;
  createdAt: number;
}

export interface StickyNote {
  id: string;
  url: string;
  x: number; // page-relative percentage
  y: number;
  text: string;
  color: string;
  createdAt: number;
}

export type CollectionColor =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "pink"
  | "red"
  | "gray";

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: CollectionColor;
  emoji?: string;
  itemIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type SavedItemKind = "search" | "page" | "note" | "highlight";

export interface SavedItem {
  id: string;
  kind: SavedItemKind;
  title: string;
  url?: string;
  content?: string; // for notes
  thumbnail?: string;
  source?: string;
  tags: string[];
  highlights?: string[]; // highlight ids attached to this item
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  query: string;
  resultsCount: number;
  createdAt: number;
}

export interface Settings {
  defaultEngine: "duckduckgo" | "wikipedia" | "startpage" | "bing";
  safeSearch: boolean;
  region: string;
  openResultsIn: "iframe" | "newtab" | "reader";
  theme: "light" | "dark" | "system";
  showKnowledgeCard: boolean;
  enableCORSProxy: boolean;
  braveApiKey?: string;
  nvidiaNimApiKey?: string;
  nvidiaNimModel?: string;
  enableAiAnswer?: boolean;
}
