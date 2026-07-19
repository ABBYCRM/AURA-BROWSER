import { Icon } from "./icons";
import type { KnowledgeCard } from "../types";
import { faviconUrl } from "../lib/storage";

interface Props {
  card: KnowledgeCard;
  onOpen: (url: string, title: string) => void;
  onOpenExternal: (url: string) => void;
}

export function KnowledgeCardPanel({ card, onOpen, onOpenExternal }: Props) {
  return (
    <div className="lm-result rounded-2xl p-5 border border-ink-200 dark:border-ink-700 mb-4 cursor-pointer hover:shadow-soft transition-all"
      onClick={() => onOpen(card.url, card.title)}
    >
      <div className="flex items-start gap-4">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt=""
            className="w-24 h-24 object-cover rounded-lg bg-ink-100 dark:bg-ink-800 shrink-0"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : (
          <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center text-white text-3xl shrink-0">
            <Icon.Sparkle />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
            <img src={faviconUrl(card.url)} alt="" className="w-3.5 h-3.5" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            <span>{card.source}</span>
          </div>
          <h3 className="text-xl font-semibold text-accent-700 dark:text-accent-300 hover:underline">
            {card.title}
          </h3>
          <p className="text-sm text-ink-700 dark:text-ink-300 mt-1.5 leading-relaxed line-clamp-4">
            {card.abstract}
          </p>
          <div className="flex items-center gap-3 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onOpen(card.url, card.title)}
              className="text-xs text-accent-600 dark:text-accent-400 hover:underline"
            >
              Read more →
            </button>
            <button
              onClick={() => onOpenExternal(card.url)}
              className="text-xs text-ink-500 hover:underline"
            >
              Open externally
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
