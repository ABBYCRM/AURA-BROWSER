import { useState } from "react";
import { Icon } from "./icons";
import type { Collection, SavedItem } from "../types";

interface Props {
  item: SavedItem;
  collections: Collection[];
  onClose: () => void;
  onSaveTo: (collectionId: string) => void;
  onCreate: (init: { name: string; emoji?: string; color?: string }) => void;
  onRemoveFrom: (collectionId: string) => void;
}

export function SaveToCollectionModal({
  item,
  collections,
  onClose,
  onSaveTo,
  onCreate,
  onRemoveFrom,
}: Props) {
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📁");
  const memberSet = new Set(
    collections.filter((c) => c.itemIds.includes(item.id)).map((c) => c.id),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 rounded-2xl shadow-pop w-full max-w-md p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Save to collection</div>
            <div className="text-xs text-ink-500 mt-0.5 line-clamp-1">{item.title}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            <Icon.Close width={14} height={14} />
          </button>
        </div>

        <div className="space-y-1 max-h-64 overflow-auto">
          {collections.map((c) => {
            const member = memberSet.has(c.id);
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <span className="text-xl">{c.emoji || "📁"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-ink-400">
                    {c.itemIds.length} item{c.itemIds.length === 1 ? "" : "s"}
                  </div>
                </div>
                {member ? (
                  <button
                    onClick={() => onRemoveFrom(c.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => onSaveTo(c.id)}
                    className="text-xs px-2 py-1 rounded-md bg-accent-500 text-white hover:bg-accent-600"
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-ink-200 dark:border-ink-800">
          <div className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
            Create new
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              maxLength={2}
              className="w-12 text-center p-1.5 rounded-md border border-ink-200 dark:border-ink-700 bg-transparent text-lg"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="flex-1 px-2 py-1.5 rounded-md border border-ink-200 dark:border-ink-700 bg-transparent text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onCreate({ name: newName.trim(), emoji: newEmoji });
                  setNewName("");
                }
              }}
            />
            <button
              onClick={() => {
                if (newName.trim()) {
                  onCreate({ name: newName.trim(), emoji: newEmoji });
                  setNewName("");
                }
              }}
              disabled={!newName.trim()}
              className="px-3 py-1.5 rounded-md bg-accent-500 text-white text-sm disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
