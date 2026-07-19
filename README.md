# AURA — Research Browser

A research browser for curious humans. Search the web, save to collections,
annotate pages, and export your research as Markdown.

## Features

- Google-like homepage with search, voice input, "I'm Feeling Curious"
- Real web search via DuckDuckGo + Wikipedia instant-answer cards
- In-app page viewer (iframe + CORS-proxy fallback for X-Frame-blocked sites)
- One-click **Reader mode** that strips ads/nav/scripts and lets you highlight
  and annotate
- **Collections** with emoji/color tags for organizing research
- **Tabs**, back/forward history, search history
- **Export to Markdown** — whole collections, single items, or all your
  search history
- **Dark mode** (light / dark / system)
- Everything in **localStorage** — zero backend, zero tracking

## Stack

- React 19 + TypeScript
- Vite 8
- TailwindCSS 3
- All client-side — no backend required

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
npm run preview    # serve the build
```

## Keyboard shortcuts

- `/` — focus the search bar (anywhere)
- `Ctrl/Cmd + T` — new tab
- `Ctrl/Cmd + W` — close current tab
- `Ctrl/Cmd + L` — search (prompts)
- `Ctrl/Cmd + D` — save current page to library

## Deployment

The app is a static site. The `dist/` directory produced by `npm run build`
can be served from any static host (Netlify, Vercel, Cloudflare Pages,
DigitalOcean App Platform, GitHub Pages, etc.).

A `app.yaml` is included for DigitalOcean App Platform:

```bash
doctl apps create --spec app.yaml
```
