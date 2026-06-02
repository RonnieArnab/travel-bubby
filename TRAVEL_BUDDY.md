# Travel Buddy

A small React + Node app for keeping track of places while you travel — saved
spots, "have I already been here?" GPS check, and link-import from Instagram /
WhatsApp / Google Maps shares.

> The legacy `src/` and root `package.json` belong to the older PLMS project and
> are left untouched. The new app lives in `client/` and `server/`.

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
- **Import link (AI-powered)** — paste an Instagram reel, YouTube short,
  WhatsApp share, or Google Maps URL. The server scrapes the page (Open Graph
  title, caption, thumbnail, coords from Maps) and sends it — including the
  thumbnail — to Google's **Gemini 2.5 Flash** (free tier). Gemini reads the
  caption like a person and returns a structured travel summary: 3–7
  actionable bullets, named things to do/order, location hint, suggested
  category, best time to visit, tags, and a confidence rating. You review,
  edit, save.

## Run

Two terminals.

```bash
# terminal 1
cd server
npm install
export GEMINI_API_KEY=AIza...   # free key from https://aistudio.google.com
                                # — without it /api/extract/summarize returns enabled=false
# Optional override (default is gemini-2.5-flash):
# export GEMINI_MODEL=gemini-2.0-flash
npm run dev   # http://localhost:4000

# terminal 2
cd client
npm install
npm run dev   # http://localhost:5173
```

If `GEMINI_API_KEY` is not set, the rest of the app still works — only the
"Extract & summarize" button on the Import page will fall back to raw scraped
content with a warning toast.

The Vite dev server proxies `/api/*` to `localhost:4000`.

The SQLite file lives at `server/data/travel.db` and is created on first run.

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
| POST   | `/api/extract/summarize` | `{url}` → scrape + Claude-generated structured travel summary |

## Notes on the reel / link extractor

Instagram doesn't expose coordinates in public Open Graph tags, so reels will
usually return only a title, caption, and thumbnail. Three workable patterns:

1. Open the location tag inside the reel, share the **Google Maps** link, and
   import that — coordinates come through cleanly.
2. Paste a `maps.app.goo.gl` short link directly; the server follows the
   redirect and pulls coords from the resolved URL.
3. Add the lat/lng manually in the import preview before saving.

For full reel transcript / location scraping you'd add a server-side worker
that uses a real Instagram API key or a scraping library — the `extractor.js`
service is the place to plug that in.

## Deploy (Render, single service)

Travel Buddy ships as one Render web service: Express serves both the API
and the built React app, and a 1 GB persistent disk holds the SQLite file
so your data survives deploys.

**Cost**: $7/mo (Starter web service) + $0.25/mo (1 GB disk) ≈ $7.25/mo.
Render's free tier doesn't include persistent disks, so the DB would reset
on every deploy — not workable for an app like this. (If you want truly
free, skip to the "Fly.io alternative" at the bottom.)

### One-time setup

1. **Push the repo to GitHub** (if you haven't yet). Make sure `.env` is in
   `.gitignore` — it is by default.

   ```bash
   git add .
   git commit -m "ready for deploy"
   git push origin main
   ```

2. **Rotate your Gemini key** if you ever committed it to source. Get a
   fresh one at <https://aistudio.google.com/app/apikey>.

3. **Connect Render to GitHub**:
   - Sign up at <https://render.com> (GitHub OAuth is easiest)
   - Dashboard → **New +** → **Blueprint**
   - Select your repo. Render finds `render.yaml` automatically.
   - Click **Apply**. It provisions the web service, the disk, and the
     env vars declared in `render.yaml`.

4. **Set your Gemini key** as a secret env var:
   - In the Render dashboard, open your service → **Environment**
   - You'll see `GEMINI_API_KEY` already listed (from `render.yaml`) but
     unset. Click it, paste your real key, **Save**.
   - The service redeploys automatically.

5. **Open your URL**: `https://travel-buddy-XXXX.onrender.com` (the URL is
   shown on the service's Overview page). API + frontend are both there.

### Updates

Push to `main` → Render rebuilds and deploys. That's it. Watch the build
logs from the dashboard if anything fails.

### Custom domain

Service → **Settings** → **Custom Domain** → add your domain. Render
provisions a Let's Encrypt cert automatically.

### Logs

Service → **Logs** tab. Our [`server/src/lib/log.js`](server/src/lib/log.js)
writes structured single-line entries that grep nicely in Render's log UI.

### Fly.io alternative (truly free)

If you want to stay free, Fly.io's "Hobby Plan" includes $5/mo of credit
that covers a small Node VM + a 1 GB volume. Tradeoff: more setup — you'll
need a `Dockerfile` and `fly.toml` instead of `render.yaml`, and the
`flyctl` CLI. The code changes we made (`DATA_DIR` env var, static
serving) work the same way; only the deploy config differs.
