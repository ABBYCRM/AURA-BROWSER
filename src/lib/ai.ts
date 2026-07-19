// NVIDIA NIM client for AURA. Routes through our /api/ai/chat proxy so the
// browser doesn't have to deal with CORS (the NIM API doesn't send ACAO).
// The user's NIM key is forwarded in the X-NVIDIA-NIM-Key header.
//
// The proxy forwards to:
//   https://integrate.api.nvidia.com/v1/chat/completions
//
// Supports streaming (preferred) and non-streaming. Streams via fetch +
// ReadableStream so we can render tokens as they arrive.

import { domainOf } from "./storage";

export const NIM_PROXY_PATH = "/api/ai/chat";
export const DEFAULT_MODEL = "meta/llama-3.1-8b-instruct";

export interface NIMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NIMRequest {
  model?: string;
  messages: NIMMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  // Pass `signal` for AbortController support
  signal?: AbortSignal;
}

export interface NIMChoice {
  index: number;
  message: { role: "assistant"; content: string };
  finish_reason: string;
}

export interface NIMResponse {
  id: string;
  choices: NIMChoice[];
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function nimChat(
  apiKey: string,
  req: NIMRequest,
): Promise<NIMResponse> {
  const res = await fetch(NIM_PROXY_PATH, {
    method: "POST",
    signal: req.signal,
    headers: {
      "Content-Type": "application/json",
      "X-NVIDIA-NIM-Key": apiKey,
    },
    body: JSON.stringify({
      model: req.model || DEFAULT_MODEL,
      messages: req.messages,
      max_tokens: req.max_tokens ?? 512,
      temperature: req.temperature ?? 0.5,
      top_p: req.top_p ?? 0.9,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI proxy ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Stream a chat completion. Calls `onDelta` with each new chunk of text.
 * Resolves with the full concatenated text.
 */
export async function nimChatStream(
  apiKey: string,
  req: NIMRequest,
  onDelta: (delta: string) => void,
): Promise<string> {
  const res = await fetch(NIM_PROXY_PATH, {
    method: "POST",
    signal: req.signal,
    headers: {
      "Content-Type": "application/json",
      "X-NVIDIA-NIM-Key": apiKey,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: req.model || DEFAULT_MODEL,
      messages: req.messages,
      max_tokens: req.max_tokens ?? 512,
      temperature: req.temperature ?? 0.5,
      top_p: req.top_p ?? 0.9,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let msg = `AI proxy ${res.status}: ${text.slice(0, 200)}`;
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch {
      /* keep msg */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE messages are separated by \n\n
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of raw.split("\n")) {
        const m = /^data:\s?(.*)$/.exec(line);
        if (!m) continue;
        const data = m[1].trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content || "";
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          /* ignore parse error */
        }
      }
    }
  }
  return full;
}

/* --------------------------- Prompt builders --------------------------- */

const SYSTEM_PROMPT = `You are AURA, a concise and trustworthy research assistant built into the AURA browser.
Your job is to answer the user's question directly, accurately, and briefly.

Rules:
- Lead with the answer in the first sentence. Don't bury it in preamble.
- Use 2–4 short paragraphs. No bullet walls. No "Sure, here's..." filler.
- Only use facts you're confident about. If unsure, say so explicitly.
- When the question asks for a list or steps, you may use bullets — but keep them tight.
- Never reference the system, the prompt, or any tools.
- Avoid phrases like "I can help with that" or "I am an AI assistant".`;

/**
 * Build a prompt for an AI answer given a search query and (optionally)
 * the top web results as context. If results are provided they're cited
 * inline as [n], where n is the index in the snippets array.
 */
export function buildAnswerPrompt(
  query: string,
  results: { title: string; url: string; snippet: string }[] = [],
): NIMMessage[] {
  const messages: NIMMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (results.length > 0) {
    const ctx = results
      .slice(0, 6)
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title} (${domainOf(r.url)})\n${r.snippet || "(no snippet)"}`,
      )
      .join("\n\n");
    messages.push({
      role: "user",
      content: `Use the sources below to answer. Cite the relevant ones with [n] inline.\n\nSources:\n${ctx}\n\nQuestion: ${query}`,
    });
  } else {
    messages.push({
      role: "user",
      content: `Question: ${query}`,
    });
  }
  return messages;
}
