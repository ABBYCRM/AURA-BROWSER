import { useState } from "react";
import { Icon } from "./icons";
import { faviconUrl } from "../lib/storage";
import type { SearchResult } from "../types";

interface Props {
  result: SearchResult;
  onOpen: (r: SearchResult) => void;
  onOpenExternal: (r: SearchResult) => void;
  onSave: (r: SearchResult) => void;
  onCite: (r: SearchResult) => void;
  isSaved: boolean;
}

export function ResultCard({
  result,
  onOpen,
  onOpenExternal,
  onSave,
  onCite,
  isSaved,
}: Props) {
  const [hover, setHover] = useState(false);
  return (
    <article
      className="lm-result group rounded-lg p-3 -mx-3 cursor-pointer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(result)}
    >
      <div className="flex items-center gap-2 mb-1">
        <img
          src={faviconUrl(result.url)}
          alt=""
          width={16}
          height={16}
          className="w-4 h-4 rounded-sm bg-ink-100 dark:bg-ink-800"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
        <div className="text-xs text-ink-500 dark:text-ink-400 truncate flex items-center gap-1.5">
          <span className="truncate max-w-[260px]">{result.displayUrl || result.url}</span>
          {result.source && (
            <>
              <span className="opacity-50">·</span>
              <span>{result.source}</span>
            </>
          )}
        </div>
      </div>
      <h3 className="text-[18px] md:text-[20px] font-medium text-accent-700 dark:text-accent-300 leading-snug hover:underline">
        {result.title}
      </h3>
      <p className="text-sm text-ink-700 dark:text-ink-300 mt-1 leading-relaxed">
        {result.snippet}
      </p>
      <div
        className={`flex items-center gap-1 mt-2 transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onSave(result)}
          className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-ink-200 dark:hover:bg-ink-700 ${isSaved ? "text-accent-600 dark:text-accent-400" : "text-ink-500"}`}
          title={isSaved ? "Saved" : "Save to collection"}
        >
          {isSaved ? <Icon.BookmarkFilled width={12} height={12} /> : <Icon.Bookmark width={12} height={12} />}
          {isSaved ? "Saved" : "Save"}
        </button>
        <button
          onClick={() => onCite(result)}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-500"
          title="Cite this source"
        >
          <Icon.Quote width={12} height={12} /> Cite
        </button>
        <button
          onClick={() => onOpenExternal(result)}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-500"
          title="Open in new tab"
        >
          <Icon.External width={12} height={12} /> Open
        </button>
      </div>
    </article>
  );
}
