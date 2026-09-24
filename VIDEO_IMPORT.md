# Video-to-place imports, without paid services

Paste a public video link into **Import link**. Travel Buddy gathers text first, makes at most one bounded local summary request, and shows separate place drafts with source excerpts. Generic advice such as “used camera shops” appears separately from named places. Nothing is saved to your collection until you review and save it.

## What runs where

| Step | Open-source tool | Behavior |
| --- | --- | --- |
| Public media and subtitles | [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Uses human captions first, then automatic captions. Supports public Instagram, YouTube, TikTok, Vimeo, Facebook, X and Dailymotion links where the platform permits access. |
| Speech when captions are missing | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | Whisper `small`, CPU/int8, local multilingual transcription. No cloud speech API. |
| Video frames | [FFmpeg](https://ffmpeg.org/) | Samples eight low-resolution frames from downloaded media. |
| Text in frames | [Tesseract](https://github.com/tesseract-ocr/tesseract) | Reads signs and overlays locally. English OCR by default; install language packs for other scripts. |
| Travel facts | [Ollama](https://docs.ollama.com/capabilities/structured-outputs) + [Qwen3 4B](https://ollama.com/library/qwen3:4b) | One structured, text-only request. Extracts up to eight named places, destination hints, notes, things to do, and source evidence. |
| Repeat imports | SQLite | Separate caches for evidence and successful summaries. A summary cache hit uses zero model calls. |

Whisper is itself a machine-learning model, but its inference runs locally. There are **no paid scraping, transcription, or LLM API calls** and no Gemini fallback. Local CPU/GPU time, disk space, electricity, and internet access are still required. The browser and extraction tools contact source platforms to retrieve media; summarization stays on your machine.

## Setup on macOS

Install Homebrew first if it is not already available, then run from the project root:

```sh
brew install ffmpeg tesseract ollama python@3.12
MEDIA_SETUP_PYTHON=python3.12 npm run setup:media
```

The setup script creates `server/.venv`, installs Python dependencies, and downloads Whisper `small` (~460 MB). Python 3.11–3.13 is recommended; this workspace was verified with Python 3.10. On Linux install FFmpeg, Tesseract, Python with venv support, and Ollama through their official installation instructions, then run `npm run setup:media`.

In one terminal:

```sh
npm run ai:serve
```

This starts Ollama on `127.0.0.1:11434`, sets `OLLAMA_NO_CLOUD=1`, and stores models in the ignored `server/data/models` directory. It does not install an automatic login service. In another terminal, download the model once (~2.5 GB):

```sh
ollama pull qwen3:4b
```

Then run the app normally:

```sh
npm run dev:server
# Another terminal:
npm run dev:client
```

If you already run Ollama, stop that instance before using `ai:serve`, or configure it to disable cloud inference and use its own existing model store. The API permits only loopback Ollama URLs and rejects remote/cloud model names. No API key is needed. Requests fail visibly if the local model is unavailable; the extracted text remains available to review.

## Keeping compute small

- Captions avoid speech transcription entirely. Turn off **Read text in sampled video frames** to also avoid downloading media when captions are available.
- A pasted transcript skips the entire video extraction worker.
- Imports process one at a time, with at most four waiting jobs. Concurrent duplicate imports share one job.
- Evidence is capped at 24,000 transcript characters, then deduplicated and sampled into a roughly 9 KB evidence budget. Long transcripts retain samples from both beginning and end. The interface discloses sampling.
- The local summary disables model thinking, uses an 8,192-token context, and limits output to 1,800 tokens. If the output is incomplete it is rejected; there is no automatic second model call.
- Successful transcript imports are cached for seven days. Metadata-only/blocked imports use a short 60-second cache so access can be retried. Cache keys include the canonical URL, pasted text, OCR setting, speech model/languages, selected spoken language and summary model name. After updating model weights under the same name, delete the relevant cache to regenerate immediately.
- Evidence cache and summary cache are separate: bringing Ollama online later doesn't re-download usable media.
- Each video is limited to 10 minutes and 40 MB. When platform metadata omits duration, FFprobe measures the downloaded file before transcription. The media worker has a four-minute deadline; a model request has a two-minute deadline. Temporary media is deleted after the worker completes or fails. Extracted text is stored in SQLite; expired cache rows are removed on later cache writes.
- Jobs remain in memory for up to an hour (at most 100), so polling resumes when you revisit the import page in the same browser tab. A server restart loses job IDs, but SQLite caches survive.

## Accuracy and platform limits

A scraper retrieves content; it cannot reliably identify an unnamed restaurant from scenery. This pipeline reads captions, speech and sampled written text. It does not send frames to a vision LLM. Speech recognition and OCR can misread venue names, and eight sampled frames can miss brief overlays. The small local summary model can also make mistakes. Each generated place must cite an existing evidence ID, but this is a traceability check, not proof that every generated claim is correct. Review the displayed quotations before saving.

Choose a spoken language in the import form if automatic speech-language detection gets an accent wrong.

Private posts, login-required media, region blocks, platform rate limits, deleted content, and changing platform extractors can prevent extraction. The app does not read your browser cookies or bypass those restrictions. A `/p/` Instagram link can also be a photo or carousel rather than one supported video. Paste the actual transcript/on-screen text in the fallback field when public retrieval fails. General non-video web links use page metadata only.

The model does not invent coordinates. After summarization, Photon searches OpenStreetMap for each named place. Strong matches with matching location context appear as suggested pins; multiple matches, vague names, and chains require you to choose a location. General advice without a named place remains a tip. Shared-trip guide imports still use the lightweight page extractor; the video workflow is on the main Import link page.

## Map pins and reel collections

- The import preview shows every matched place on one interactive map. Selecting a candidate fills latitude, longitude, address and its OpenStreetMap reference. You can refine the name/city search or enter coordinates manually.
- **Save all places as a collection** stores the reel URL, collection name, each place, and its coordinates in one database transaction. Repeat saves use the same reel collection and place keys, avoiding duplicate rows. A repeat save may fill a previously missing pin; it does not replace an existing pin. Names/context that change between extractions may need manual deduplication.
- Each reel collection appears in **Your collections**, linking to `/map?collection=ID`. That map only shows the collection’s places. Places awaiting a match remain saved as notes, and the map shows their unresolved count.
- Previously saved places have a **Find map pin** action, which uses the same search and saves coordinates without needing another video extraction.
- [Photon](https://github.com/komoot/photon) is open source (Apache 2.0), using OpenStreetMap data. The default endpoint is its free public demo at `https://photon.komoot.io/api/`, whose maintainers allow reasonable project usage without an availability guarantee. Requests are queued at least 1.1 seconds apart, successful searches are cached for 30 days, and empty searches for an hour. There is no autocomplete traffic or additional LLM call for coordinates. Only place names and location hints are sent to Photon.
- Set `PHOTON_URL` to your own Photon API endpoint for a larger deployment. The public demo is suitable for this small local app, not an unlimited production dependency. This implementation does not call the public Nominatim service.
- OSM coverage varies: a missing venue, translated name, or unspecified chain branch may still need manual correction. Matching scores are heuristics, not a guarantee. Map attribution credits OpenStreetMap; saved search pins retain their OSM object URL.

This is a local application. Its existing API has no account authentication; do not expose it to untrusted users without adding access control. The existing Node-only Render blueprint cannot run this local model stack as-is; use a host with Python, the system tools and sufficient model RAM/storage if deploying it. No paid deployment or external service was provisioned.

## Configuration

These are shell environment variables (the app does not automatically load `.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `MEDIA_PYTHON` | `server/.venv/bin/python`, otherwise `python3` | Worker interpreter |
| `WHISPER_MODEL` | `small` | Local speech model; download through setup after changing |
| `WHISPER_CACHE_DIR` | `server/data/whisper` | Speech model storage |
| `WHISPER_ALLOW_DOWNLOAD` | `0` | Keep model downloads out of import requests; setup downloads explicitly |
| `OCR_LANGUAGES` | `eng` | Tesseract language codes, e.g. `eng+jpn` after installing packs |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Loopback-only model server |
| `OLLAMA_MODEL` | `qwen3:4b` | Installed local model with structured-output support |
| `OLLAMA_MODELS` | `server/data/models` with `ai:serve` | Ollama model storage |
| `PHOTON_URL` | `https://photon.komoot.io/api/` | Configurable public or self-hosted geocoder |

## API and checks

`POST /api/extract/jobs` accepts `{ "url": "https://…", "readScreen": true, "language": "auto", "transcript": "optional actual transcript" }`, returns `202` and a job ID. Poll `GET /api/extract/jobs/:id` for state, stage and the final result. Results include extracted evidence, warnings, place summaries, cache flags and local-model token counts. Legacy `POST /api/extract/summarize` uses this same queue. `POST /api/extract` remains a lightweight metadata endpoint.

Public metadata URLs are validated, DNS addresses are pinned, redirects are checked individually, and local/private network addresses are rejected. The Python worker also rejects private DNS answers. Commands receive argument arrays, never interpolated shell input. These controls do not add user authentication.

`POST /api/reels/search` accepts `{ name, context, category?, kind? }` and returns candidates with coordinates and OSM references. `POST /api/reels/save` accepts `{ source_url, name, places: [{ key, name, lat?, lng?, address?, notes?, ... }] }` and returns the persisted collection and places. `GET /api/places` includes `collection_id` and `collection_name` for reopening grouped maps.

```sh
npm test --prefix server
server/.venv/bin/python -m unittest discover -s server/workers -p 'test_*.py'
npm run build --prefix client
```
