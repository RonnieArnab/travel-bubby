# Travel Buddy

A small React + Node app for keeping track of places while you travel — saved
spots, "have I already been here?" GPS check, and link-import from Instagram /
WhatsApp / Google Maps shares.

The app lives in `client/` and `server/`; root scripts start and build both.

## Layout

```
server/    Express API + SQLite (better-sqlite3)
client/    Vite + React + Leaflet
```

## Features

- **Map** — saved places shown as pins (purple = unvisited, green = visited).
- **Have I been here?** — uses browser geolocation to look up the nearest
  saved place and warn if you've already visited (default radius 75 m).
- **Saved places** — list view with visit counts, filter by visited / unvisited,
  log a visit or delete.
- **Add place** — manual entry with "use my location" GPS capture.
- **Import link** — public reels and shorts become individually reviewable place drafts. The open-source pipeline uses captions first, local speech transcription and OCR when needed, then one local Ollama summary with evidence citations. See [VIDEO_IMPORT.md](VIDEO_IMPORT.md) for setup, limits, and supported sources.

## Run locally

Follow [the video tools setup](VIDEO_IMPORT.md#setup-on-macos) once, then start the local summarizer with `npm run ai:serve`.

```sh
# Terminal 2
npm run dev:server
# Terminal 3
npm run dev:client
```

The frontend is at http://localhost:5173. The Vite server proxies `/api/*` to `localhost:4000`. SQLite lives at `server/data/travel.db`. No paid API key is needed. Without Ollama, imports preserve readable source text for manual review.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET    | `/api/health` | Health check |
| GET    | `/api/places` | List all places (with visit counts) |
| POST   | `/api/places` | Create a place |
| GET    | `/api/places/:id` | Single place |
| PATCH  | `/api/places/:id` | Update fields |
| DELETE | `/api/places/:id` | Delete |
| POST   | `/api/places/nearby-check` | `{lat,lng,radius?}` → closest match |
| POST   | `/api/visits` | `{place_id, note?}` |
| GET    | `/api/visits/place/:placeId` | Visit history |
| POST   | `/api/extract` | `{url}` → parsed name/notes/lat/lng |
| POST   | `/api/extract/jobs` | `{url, transcript?, readScreen?}` → queued video import |
| GET    | `/api/extract/jobs/:id` | Progress, evidence and local summary |
| POST   | `/api/extract/summarize` | Compatibility endpoint using the same local queue |

## Extraction and deployment

See [VIDEO_IMPORT.md](VIDEO_IMPORT.md) for the video pipeline, installation, caching, API usage and known limitations. Place names extracted from speech need review; map pins require verified coordinates.

The existing `render.yaml` deploys the Node server and frontend with persistent SQLite. It does not install Python, speech models, OCR or Ollama. The full local extraction stack needs a machine with those dependencies and enough RAM/storage; it cannot run as-is on the Node-only blueprint. No deployment is performed by running the local setup scripts.
