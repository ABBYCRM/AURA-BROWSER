import { Icon } from "./icons";
import { relTime } from "../lib/storage";
import type { Collection, HistoryEntry, SavedItem, Settings } from "../types";

export type SidebarView =
  | { kind: "home" }
  | { kind: "collections" }
  | { kind: "collection"; id: string }
  | { kind: "saved" }
  | { kind: "history" }
  | { kind: "settings" };

interface Props {
  view: SidebarView;
  onView: (v: SidebarView) => void;
  collapsed: boolean;
  onToggle: () => void;
  collections: Collection[];
  history: HistoryEntry[];
  savedItems: SavedItem[];
  settings: Settings;
  onNewCollection: () => void;
  onOpenSaved: (item: SavedItem) => void;
  onRemoveSaved: (id: string) => void;
  onClearHistory: () => void;
  onRemoveHistory: (id: string) => void;
  onUpdateSettings: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  onExportHistory: () => void;
  onExportCollection: (id: string) => void;
  onDeleteCollection: (id: string) => void;
}

export function Sidebar(props: Props) {
  const {
    view,
    onView,
    collapsed,
    onToggle,
    collections,
    history,
    savedItems,
    settings,
    onNewCollection,
    onOpenSaved,
    onRemoveSaved,
    onClearHistory,
    onRemoveHistory,
    onUpdateSettings,
    onExportHistory,
    onExportCollection,
    onDeleteCollection,
  } = props;

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 flex flex-col items-center py-2">
        <button
          onClick={onToggle}
          className="p-2 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
          title="Expand sidebar"
        >
          <Icon.Sidebar width={16} height={16} />
        </button>
        <div className="mt-2 flex flex-col gap-1">
          <SideBtn
            active={view.kind === "home"}
            onClick={() => onView({ kind: "home" })}
            icon={<Icon.Home width={16} height={16} />}
            title="Home"
          />
          <SideBtn
            active={view.kind === "collections" || view.kind === "collection"}
            onClick={() => onView({ kind: "collections" })}
            icon={<Icon.Collection width={16} height={16} />}
            title="Collections"
          />
          <SideBtn
            active={view.kind === "saved"}
            onClick={() => onView({ kind: "saved" })}
            icon={<Icon.Bookmark width={16} height={16} />}
            title="Saved"
          />
          <SideBtn
            active={view.kind === "history"}
            onClick={() => onView({ kind: "history" })}
            icon={<Icon.History width={16} height={16} />}
            title="History"
          />
          <SideBtn
            active={view.kind === "settings"}
            onClick={() => onView({ kind: "settings" })}
            icon={<Icon.Settings width={16} height={16} />}
            title="Settings"
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-r border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-ink-200 dark:border-ink-800">
        <button
          onClick={() => onView({ kind: "home" })}
          className="flex items-center gap-2 font-semibold"
        >
          <span className="lm-logo text-2xl">L</span>
          <span className="text-sm">Library</span>
        </button>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
          title="Collapse"
        >
          <Icon.Panel width={14} height={14} />
        </button>
      </div>

      {/* Primary nav */}
      <nav className="p-2 space-y-0.5 border-b border-ink-200 dark:border-ink-800">
        <NavItem
          active={view.kind === "home"}
          onClick={() => onView({ kind: "home" })}
          icon={<Icon.Home width={14} height={14} />}
          label="Home"
        />
        <NavItem
          active={view.kind === "collections" || view.kind === "collection"}
          onClick={() => onView({ kind: "collections" })}
          icon={<Icon.Collection width={14} height={14} />}
          label="Collections"
          right={
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNewCollection();
              }}
              className="p-1 rounded hover:bg-ink-200 dark:hover:bg-ink-700"
              title="New collection"
            >
              <Icon.Plus width={10} height={10} />
            </button>
          }
        />
        {view.kind === "collections" &&
          collections.map((c) => (
            <button
              key={c.id}
              onClick={() => onView({ kind: "collection", id: c.id })}
              className="w-full flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-md text-sm text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              <span>{c.emoji || "📁"}</span>
              <span className="truncate flex-1 text-left">{c.name}</span>
              <span className="text-[10px] text-ink-400">{c.itemIds.length}</span>
            </button>
          ))}
        <NavItem
          active={view.kind === "saved"}
          onClick={() => onView({ kind: "saved" })}
          icon={<Icon.Bookmark width={14} height={14} />}
          label="Saved"
          right={
            <span className="text-[10px] text-ink-400">{savedItems.length}</span>
          }
        />
        <NavItem
          active={view.kind === "history"}
          onClick={() => onView({ kind: "history" })}
          icon={<Icon.History width={14} height={14} />}
          label="History"
          right={
            <span className="text-[10px] text-ink-400">{history.length}</span>
          }
        />
        <NavItem
          active={view.kind === "settings"}
          onClick={() => onView({ kind: "settings" })}
          icon={<Icon.Settings width={14} height={14} />}
          label="Settings"
        />
      </nav>

      {/* View body */}
      <div className="flex-1 overflow-auto p-3">
        {view.kind === "home" && <HomeViewBody history={history} onView={onView} onSubmitSearch={() => { onView({ kind: "home" }); }} />}
        {view.kind === "saved" && (
          <SavedList
            items={savedItems}
            onOpen={onOpenSaved}
            onRemove={onRemoveSaved}
          />
        )}
        {view.kind === "history" && (
          <HistoryList
            history={history}
            onRemove={onRemoveHistory}
            onClear={onClearHistory}
            onExport={onExportHistory}
          />
        )}
        {view.kind === "collections" && (
          <CollectionsHome
            collections={collections}
            onOpen={(id) => onView({ kind: "collection", id })}
            onExport={onExportCollection}
            onDelete={onDeleteCollection}
            onNew={onNewCollection}
          />
        )}
        {view.kind === "collection" && (
          <CollectionView
            collection={collections.find((c) => c.id === view.id)!}
            savedItems={savedItems}
            onOpen={onOpenSaved}
            onBack={() => onView({ kind: "collections" })}
            onExport={() => onExportCollection(view.id)}
            onDelete={() => {
              if (confirm("Delete this collection? Items will remain in your saved library.")) {
                onDeleteCollection(view.id);
                onView({ kind: "collections" });
              }
            }}
          />
        )}
        {view.kind === "settings" && (
          <SettingsPanel settings={settings} onUpdate={onUpdateSettings} />
        )}
      </div>
    </aside>
  );
}

function SideBtn({
  active,
  onClick,
  icon,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-md ${active ? "bg-accent-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800"}`}
      title={title}
    >
      {icon}
    </button>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  right,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm ${
        active
          ? "bg-accent-500/10 text-accent-700 dark:text-accent-300 font-medium"
          : "text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
      }`}
    >
      <span className="opacity-70">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {right}
    </button>
  );
}

function HomeViewBody({
  history,
}: {
  history: HistoryEntry[];
  onView: (v: SidebarView) => void;
  onSubmitSearch: (q: string) => void;
}) {
  const recent = history.slice(-5).reverse();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
          Recent searches
        </h3>
        {recent.length === 0 ? (
          <div className="text-xs text-ink-400">No searches yet</div>
        ) : (
          <div className="space-y-1">
            {recent.map((h) => (
              <div
                key={h.id}
                className="text-xs text-ink-600 dark:text-ink-300 truncate flex items-center gap-1.5"
              >
                <Icon.Search className="opacity-50" width={10} height={10} />
                <span className="truncate">{h.query}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
          Tips
        </h3>
        <ul className="text-xs text-ink-500 space-y-1.5 list-disc pl-4">
          <li>Click <kbd className="px-1 rounded bg-ink-100 dark:bg-ink-800">Reader</kbd> to strip ads and annotate.</li>
          <li>Press <kbd className="px-1 rounded bg-ink-100 dark:bg-ink-800">/</kbd> on the home page to focus search.</li>
          <li>Drag a result to the sidebar to save it.</li>
        </ul>
      </div>
    </div>
  );
}

function SavedList({
  items,
  onOpen,
  onRemove,
}: {
  items: SavedItem[];
  onOpen: (i: SavedItem) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0)
    return (
      <div className="text-sm text-ink-500 text-center py-8">
        <div className="text-3xl mb-2">📌</div>
        No saved items yet
      </div>
    );
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div
          key={it.id}
          className="group p-2.5 rounded-lg border border-ink-200 dark:border-ink-700 hover:border-accent-500"
        >
          <button onClick={() => onOpen(it)} className="w-full text-left">
            <div className="text-sm font-medium line-clamp-2">{it.title}</div>
            {it.url && (
              <div className="text-[11px] text-ink-400 truncate mt-0.5">{it.url}</div>
            )}
          </button>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-ink-400">
            <span>{relTime(it.createdAt)}</span>
            <button
              onClick={() => onRemove(it.id)}
              className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500"
            >
              <Icon.Trash width={10} height={10} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryList({
  history,
  onRemove,
  onClear,
  onExport,
}: {
  history: HistoryEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onExport: () => void;
}) {
  if (history.length === 0)
    return (
      <div className="text-sm text-ink-500 text-center py-8">
        <div className="text-3xl mb-2">🕐</div>
        No search history yet
      </div>
    );
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-500">{history.length} entries</span>
        <div className="flex gap-1">
          <button
            onClick={onExport}
            className="px-2 py-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500"
            title="Export as Markdown"
          >
            <Icon.Download width={10} height={10} />
          </button>
          <button
            onClick={onClear}
            className="px-2 py-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500"
            title="Clear all"
          >
            <Icon.Trash width={10} height={10} />
          </button>
        </div>
      </div>
      {history.slice().reverse().map((h) => (
        <div
          key={h.id}
          className="group flex items-center justify-between gap-2 p-2 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
        >
          <div className="min-w-0">
            <div className="text-sm truncate">{h.query}</div>
            <div className="text-[10px] text-ink-400">
              {h.resultsCount} result{h.resultsCount === 1 ? "" : "s"} · {relTime(h.createdAt)}
            </div>
          </div>
          <button
            onClick={() => onRemove(h.id)}
            className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500"
          >
            <Icon.Close width={10} height={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

function CollectionsHome({
  collections,
  onOpen,
  onExport,
  onDelete,
  onNew,
}: {
  collections: Collection[];
  onOpen: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-2">
      <button
        onClick={onNew}
        className="w-full p-3 rounded-lg border-2 border-dashed border-ink-200 dark:border-ink-700 text-sm text-ink-500 hover:border-accent-500 hover:text-accent-500"
      >
        + New collection
      </button>
      {collections.map((c) => (
        <div
          key={c.id}
          className="group p-3 rounded-lg border border-ink-200 dark:border-ink-700 hover:border-accent-500"
        >
          <button onClick={() => onOpen(c.id)} className="w-full text-left">
            <div className="text-2xl mb-0.5">{c.emoji || "📁"}</div>
            <div className="font-medium text-sm">{c.name}</div>
            {c.description && (
              <div className="text-[11px] text-ink-500 mt-0.5 line-clamp-2">
                {c.description}
              </div>
            )}
            <div className="text-[10px] text-ink-400 mt-1">
              {c.itemIds.length} item{c.itemIds.length === 1 ? "" : "s"}
            </div>
          </button>
          <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => onExport(c.id)}
              className="p-1 rounded hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-500"
              title="Export as Markdown"
            >
              <Icon.Download width={10} height={10} />
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this collection?")) onDelete(c.id);
              }}
              className="p-1 rounded hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-500 hover:text-red-500"
              title="Delete"
            >
              <Icon.Trash width={10} height={10} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CollectionView({
  collection,
  savedItems,
  onOpen,
  onBack,
  onExport,
  onDelete,
}: {
  collection: Collection;
  savedItems: SavedItem[];
  onOpen: (i: SavedItem) => void;
  onBack: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  if (!collection) return null;
  const items = collection.itemIds
    .map((id) => savedItems.find((i) => i.id === id))
    .filter(Boolean) as SavedItem[];
  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="text-xs text-ink-500 hover:text-accent-500 flex items-center gap-1"
      >
        <Icon.ChevronLeft width={10} height={10} /> All collections
      </button>
      <div>
        <div className="text-3xl mb-1">{collection.emoji || "📁"}</div>
        <h2 className="font-semibold">{collection.name}</h2>
        {collection.description && (
          <p className="text-xs text-ink-500 mt-1">{collection.description}</p>
        )}
        <div className="flex gap-1 mt-2">
          <button
            onClick={onExport}
            className="text-[11px] px-2 py-1 rounded border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            Export .md
          </button>
          <button
            onClick={onDelete}
            className="text-[11px] px-2 py-1 rounded border border-ink-200 dark:border-ink-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <div className="text-xs text-ink-500 text-center py-6">
            No items yet — save search results to add some.
          </div>
        ) : (
          items.map((it) => (
            <button
              key={it.id}
              onClick={() => onOpen(it)}
              className="w-full text-left p-2 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              <div className="text-sm line-clamp-2">{it.title}</div>
              {it.url && (
                <div className="text-[10px] text-ink-400 truncate mt-0.5">
                  {it.url}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onUpdate,
}: {
  settings: Settings;
  onUpdate: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
          Appearance
        </h3>
        <div className="space-y-1.5">
          <label className="text-xs text-ink-500">Theme</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onUpdate("theme", t)}
                className={`px-2 py-1.5 rounded-md text-xs capitalize ${
                  settings.theme === t
                    ? "bg-accent-500 text-white"
                    : "border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
          Search
        </h3>
        <div className="space-y-1.5">
          <label className="text-xs text-ink-500">Default engine</label>
          <select
            value={settings.defaultEngine}
            onChange={(e) =>
              onUpdate("defaultEngine", e.target.value as any)
            }
            className="w-full px-2 py-1.5 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm"
          >
            <option value="duckduckgo">DuckDuckGo (default)</option>
            <option value="wikipedia">Wikipedia (focused)</option>
            <option value="startpage">Startpage</option>
            <option value="bing">Bing</option>
          </select>
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs text-ink-600 dark:text-ink-300">
          <input
            type="checkbox"
            checked={settings.safeSearch}
            onChange={(e) => onUpdate("safeSearch", e.target.checked)}
            className="rounded"
          />
          SafeSearch
        </label>
        <label className="flex items-center gap-2 mt-2 text-xs text-ink-600 dark:text-ink-300">
          <input
            type="checkbox"
            checked={settings.showKnowledgeCard}
            onChange={(e) => onUpdate("showKnowledgeCard", e.target.checked)}
            className="rounded"
          />
          Show knowledge card
        </label>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
          Privacy & network
        </h3>
        <label className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300">
          <input
            type="checkbox"
            checked={settings.enableCORSProxy}
            onChange={(e) => onUpdate("enableCORSProxy", e.target.checked)}
            className="rounded"
          />
          Use CORS proxy for cross-origin requests
        </label>
        <p className="text-[10px] text-ink-400 mt-1.5 leading-relaxed">
          All your data (searches, collections, highlights, notes) is stored
          locally in your browser. Nothing is sent to a server.
        </p>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
          Premium search
        </h3>
        <p className="text-[10px] text-ink-500 mb-1.5 leading-relaxed">
          Free public search APIs are rate-limited and get blocked. Add a{" "}
          <a
            href="https://brave.com/search/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-600 dark:text-accent-400 underline"
          >
            Brave Search API key
          </a>{" "}
          for unlimited, reliable web results. Stored only in this browser.
        </p>
        <input
          type="password"
          value={settings.braveApiKey || ""}
          onChange={(e) => onUpdate("braveApiKey", e.target.value)}
          placeholder="BSA-xxxxxxxx (optional)"
          className="w-full px-2 py-1.5 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-xs font-mono"
        />
        {settings.braveApiKey && (
          <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">
            ✓ Brave Search enabled
          </p>
        )}
      </div>
    </div>
  );
}
