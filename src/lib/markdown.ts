// Markdown export for research reports

import type {
  Collection,
  SavedItem,
  Highlight,
  StickyNote,
  HistoryEntry,
} from "../types";
import { relTime, domainOf } from "./storage";

export function exportCollectionAsMarkdown(
  collection: Collection,
  items: SavedItem[],
  highlights: Highlight[] = [],
  stickies: StickyNote[] = [],
): string {
  const out: string[] = [];
  out.push(`# ${collection.emoji ? collection.emoji + " " : ""}${collection.name}`);
  out.push("");
  if (collection.description) {
    out.push(`> ${collection.description}`);
    out.push("");
  }
  out.push(`*${items.length} item${items.length === 1 ? "" : "s"} · exported ${new Date().toLocaleString()}*`);
  out.push("");
  out.push("---");
  out.push("");

  for (const item of items) {
    out.push(`## ${item.title}`);
    out.push("");
    if (item.url) {
      out.push(`**Source:** [${domainOf(item.url)}](${item.url})  `);
    }
    if (item.source) {
      out.push(`**Publisher:** ${item.source}  `);
    }
    out.push(`**Saved:** ${relTime(item.createdAt)}`);
    if (item.tags?.length) {
      out.push(`**Tags:** ${item.tags.map((t) => "`" + t + "`").join(", ")}`);
    }
    out.push("");
    if (item.content) {
      out.push(item.content);
      out.push("");
    }
    const itemHighlights = highlights.filter((h) =>
      (item.highlights || []).includes(h.id),
    );
    if (itemHighlights.length) {
      out.push("### Highlights");
      out.push("");
      for (const h of itemHighlights) {
        out.push(`> ${h.text}`);
        if (h.note) out.push(`> — *${h.note}*`);
        out.push("");
      }
    }
    const itemStickies = stickies.filter((s) => s.url === item.url);
    if (itemStickies.length) {
      out.push("### Notes");
      out.push("");
      for (const s of itemStickies) {
        out.push(`- ${s.text}`);
      }
      out.push("");
    }
    out.push("---");
    out.push("");
  }
  return out.join("\n");
}

export function exportHistoryAsMarkdown(history: HistoryEntry[]): string {
  const out: string[] = [];
  out.push(`# Search History`);
  out.push("");
  out.push(`*${history.length} search${history.length === 1 ? "" : "es"} · exported ${new Date().toLocaleString()}*`);
  out.push("");
  for (const h of history.slice().reverse()) {
    out.push(`- **${h.query}** — ${h.resultsCount} result${h.resultsCount === 1 ? "" : "s"} · ${relTime(h.createdAt)}`);
  }
  return out.join("\n");
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : filename + ".md";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
