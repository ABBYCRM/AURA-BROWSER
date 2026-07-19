// AURA proxy server. Two routes:
//   POST /api/ai/chat   — proxy to NVIDIA NIM. Streams back to the client.
//   GET  /api/healthz   — health check.
//
// The user's NVIDIA NIM key is passed in via the `X-NVIDIA-NIM-Key` header
// (the client reads it from localStorage). The key never touches our code
// or any persistent storage — it's just a relay hop.

import express from "express";
import { createServer } from "node:http";

const app = express();
app.use(express.json({ limit: "1mb" }));

const NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "meta/llama-3.1-8b-instruct";
const PORT = Number(process.env.PORT || 8080);

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true, service: "aura-api", ts: Date.now() });
});

/**
 * POST /api/ai/chat
 * Body: { model?, messages, max_tokens?, temperature?, top_p?, stream? }
 * Header: X-NVIDIA-NIM-Key: nvapi-...
 *
 * Proxies to NVIDIA NIM and streams the response back (SSE) when
 * stream=true (the default).
 */
app.post("/api/ai/chat", async (req, res) => {
  const apiKey = req.header("X-NVIDIA-NIM-Key") || req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!apiKey) {
    return res.status(400).json({
      error: "Missing X-NVIDIA-NIM-Key header. Add a key in Settings → AI assistant.",
    });
  }
  if (!apiKey.startsWith("nvapi-")) {
    return res.status(400).json({ error: "Invalid API key format. NVIDIA NIM keys start with 'nvapi-'." });
  }

  const {
    model = DEFAULT_MODEL,
    messages,
    max_tokens = 512,
    temperature = 0.5,
    top_p = 0.9,
    stream = true,
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'messages' array." });
  }

  // Set up the upstream call
  const upstream = await fetch(NIM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens,
      temperature,
      top_p,
      stream,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    res.status(upstream.status).json({
      error: `NVIDIA NIM ${upstream.status}: ${text.slice(0, 300)}`,
    });
    return;
  }

  if (!stream) {
    const json = await upstream.json();
    return res.json(json);
  }

  // Stream SSE back to the client
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Forward chunks as-is
      if (buffer.length > 0) {
        res.write(buffer);
        buffer = "";
      }
    }
    if (buffer.length > 0) res.write(buffer);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    try {
      res.write(`data: ${JSON.stringify({ error: String(e?.message || e) })}\n\n`);
    } catch {
      /* noop */
    }
    res.end();
  }
});

// Root fallback to static if behind the same ingress (in case we deploy as service)
app.get("/", (_req, res) => res.json({ service: "aura-api", docs: "POST /api/ai/chat" }));

const server = createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[aura-api] listening on :${PORT}`);
});
