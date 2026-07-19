import { Icon } from "./icons";
import { faviconUrl } from "../lib/storage";
import type { Tab } from "../types";

interface Props {
  tabs: Tab[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  canBack: boolean;
  canForward: boolean;
}

export function TabsBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  onNew,
  onBack,
  onForward,
  onReload,
  canBack,
  canForward,
}: Props) {
  return (
    <div className="flex items-center bg-ink-100 dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800">
      {/* Nav buttons */}
      <div className="flex items-center gap-0.5 px-2 py-1.5">
        <button
          onClick={onBack}
          disabled={!canBack}
          className="p-1.5 rounded-md hover:bg-ink-200 dark:hover:bg-ink-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Back"
        >
          <Icon.ArrowLeft width={14} height={14} />
        </button>
        <button
          onClick={onForward}
          disabled={!canForward}
          className="p-1.5 rounded-md hover:bg-ink-200 dark:hover:bg-ink-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Forward"
        >
          <Icon.ArrowRight width={14} height={14} />
        </button>
        <button
          onClick={onReload}
          className="p-1.5 rounded-md hover:bg-ink-200 dark:hover:bg-ink-800"
          title="Reload"
        >
          <Icon.Reload width={14} height={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex items-end overflow-x-auto min-w-0">
        {tabs.map((t) => (
          <TabChip
            key={t.id}
            tab={t}
            active={t.id === activeId}
            onClick={() => onActivate(t.id)}
            onClose={(e) => {
              e.stopPropagation();
              onClose(t.id);
            }}
          />
        ))}
        <button
          onClick={onNew}
          className="m-1 p-1.5 rounded-md hover:bg-ink-200 dark:hover:bg-ink-800 shrink-0"
          title="New tab"
        >
          <Icon.Plus width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

function TabChip({
  tab,
  active,
  onClick,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  const favicon =
    tab.kind === "viewer" && tab.url
      ? faviconUrl(tab.url)
      : tab.kind === "search"
      ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231d5ff5' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E"
      : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6b75' stroke-width='2'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z'/%3E%3C/svg%3E";

  const title =
    tab.title || (tab.kind === "search" ? tab.query : tab.url) || "New Tab";

  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2 px-3 py-1.5 mr-0.5 max-w-[200px] rounded-t-lg text-xs ${
        active
          ? "bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100"
          : "bg-ink-50 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700"
      }`}
    >
      <img
        src={favicon}
        alt=""
        className="w-3.5 h-3.5 shrink-0"
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />
      <span className="truncate flex-1 text-left">{title}</span>
      <span
        onClick={onClose}
        className="p-0.5 rounded hover:bg-ink-300 dark:hover:bg-ink-600 opacity-0 group-hover:opacity-100"
        role="button"
        aria-label="Close tab"
      >
        <Icon.Close width={10} height={10} />
      </span>
    </button>
  );
}
