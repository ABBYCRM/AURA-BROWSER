// useCollections — saved items + collections state, persisted to localStorage.

import { useCallback, useEffect, useState } from "react";
import type { Collection, CollectionColor, SavedItem, SavedItemKind } from "../types";
import { storage, KEYS, uid } from "../lib/storage";

const defaultCollections: Collection[] = [
  {
    id: "col_default",
    name: "Reading List",
    description: "Things to read later",
    color: "blue",
    emoji: "📚",
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "col_cited",
    name: "Citations",
    description: "Sources for my paper / project",
    color: "purple",
    emoji: "🔖",
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "col_inspiration",
    name: "Inspiration",
    description: "Cool ideas, designs, references",
    color: "orange",
    emoji: "✨",
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export function useCollections() {
  const [items, setItems] = useState<SavedItem[]>(() =>
    storage.get<SavedItem[]>(KEYS.savedItems, []),
  );
  const [collections, setCollections] = useState<Collection[]>(() => {
    const stored = storage.get<Collection[]>(KEYS.collections, []);
    if (!stored.length) return defaultCollections;
    // Backfill: ensure the defaults exist for new users
    const ids = new Set(stored.map((c) => c.id));
    const merged = [...stored];
    for (const d of defaultCollections) {
      if (!ids.has(d.id)) merged.push(d);
    }
    return merged;
  });

  useEffect(() => storage.set(KEYS.savedItems, items), [items]);
  useEffect(() => storage.set(KEYS.collections, collections), [collections]);

  const saveItem = useCallback(
    (
      partial: Omit<SavedItem, "id" | "createdAt"> & { id?: string },
    ): SavedItem => {
      let saved: SavedItem;
      if (partial.id) {
        saved = (items.find((i) => i.id === partial.id) || {
          ...partial,
          id: partial.id,
          createdAt: Date.now(),
        }) as SavedItem;
        // merge
        saved = { ...saved, ...partial, id: partial.id };
        setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
      } else {
        saved = {
          ...partial,
          id: uid("it"),
          createdAt: Date.now(),
        } as SavedItem;
        setItems((prev) => [saved, ...prev]);
      }
      return saved;
    },
    [items],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setCollections((prev) =>
      prev.map((c) => ({
        ...c,
        itemIds: c.itemIds.filter((x) => x !== id),
        updatedAt: Date.now(),
      })),
    );
  }, []);

  const addToCollection = useCallback((itemId: string, collectionId: string) => {
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== collectionId) return c;
        if (c.itemIds.includes(itemId)) return c;
        return {
          ...c,
          itemIds: [itemId, ...c.itemIds],
          updatedAt: Date.now(),
        };
      }),
    );
  }, []);

  const removeFromCollection = useCallback(
    (itemId: string, collectionId: string) => {
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                itemIds: c.itemIds.filter((x) => x !== itemId),
                updatedAt: Date.now(),
              }
            : c,
        ),
      );
    },
    [],
  );

  const createCollection = useCallback(
    (init: { name: string; description?: string; color?: CollectionColor; emoji?: string }) => {
      const c: Collection = {
        id: uid("col"),
        name: init.name,
        description: init.description,
        color: init.color || "gray",
        emoji: init.emoji,
        itemIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setCollections((prev) => [c, ...prev]);
      return c;
    },
    [],
  );

  const updateCollection = useCallback(
    (id: string, patch: Partial<Collection>) => {
      setCollections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
        ),
      );
    },
    [],
  );

  const deleteCollection = useCallback((id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const itemsByCollection = useCallback(
    (collectionId: string): SavedItem[] => {
      const col = collections.find((c) => c.id === collectionId);
      if (!col) return [];
      return col.itemIds
        .map((id) => items.find((i) => i.id === id))
        .filter(Boolean) as SavedItem[];
    },
    [collections, items],
  );

  const isItemSaved = useCallback(
    (url: string): SavedItem | undefined => {
      return items.find((i) => i.url === url);
    },
    [items],
  );

  return {
    items,
    collections,
    saveItem,
    removeItem,
    addToCollection,
    removeFromCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    itemsByCollection,
    isItemSaved,
  };
}

export function makeSearchItem(args: {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
  thumbnail?: string;
  query?: string;
}): Omit<SavedItem, "id" | "createdAt"> {
  return {
    kind: "search" as SavedItemKind,
    title: args.title,
    url: args.url,
    content: args.snippet,
    source: args.source,
    thumbnail: args.thumbnail,
    tags: args.query ? [args.query] : [],
  };
}
