# Travel Buddy frontend

## Design and structure

The interface uses warm ivory, forest green, sage, terracotta, and restrained yellow accents. DM Sans handles interface text and Lora adds the journal-style editorial accents.

- `client/src/pages/LandingPage.jsx`: public landing page and destination previews.
- `client/src/components/TravelGlobe.jsx`: lazy-loaded Three.js globe using a real Earth texture, pointer controls, reduced-motion support, a no-WebGL fallback, and resource cleanup.
- `client/src/styles/landing.css`: marketing layout and responsive styles.
- `client/src/styles/theme.css`: shared product tokens, sidebar, mobile navigation, collections, forms, map panels, and dark mode.
- `client/src/styles.css`: base controls and existing feature styles. Retired landing styles have been removed.
- `client/src/components/PlaceImage.jsx`: reusable actual-photo cover with an explicit category illustration when a place has no photo.
- `client/src/lib/destinations.js`: destination metadata and real, explicitly labelled preview points. Previews never populate saved places automatically.
- `client/src/App.jsx`: lazy route boundaries keep the map and globe code out of unrelated screens.

## Run locally

Use Node 22. In separate terminals:

```sh
npm run dev:server
npm run dev:client
```

Open http://localhost:5173. Production client build:

```sh
npm run build --prefix client
```

## Photos and maps

Place photos use the optional `image_url` column, added by an idempotent SQLite migration. Manual saves accept an HTTP(S) photo URL; imported links retain the extracted thumbnail. Photo URLs persist in the API and appear in collections, the map panel, place popups, and shared-trip screens. Broken images fall back to category artwork in collections.

The default map uses OpenStreetMap tiles with visible attribution and browser-managed caching. Dark map mode applies a visual filter; satellite mode uses Esri imagery. A different provider can be configured with `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION`. Respect your chosen provider's usage limits; this UI does not prefetch areas for offline maps.

Photography and texture sources are recorded in `client/public/assets/credits.md`. Destination assets are local; Google Fonts and map tiles require a connection.

## Verification

```sh
npm test --prefix server
```

The integration test migrates a legacy database containing a saved place, saves a photo, rejects unsafe image URLs, updates notes, restarts the real HTTP server, and verifies that existing data and the photo persist. It uses disposable test data.

Browser checks covered the landing page, actual 3D canvas and image loading, desktop/mobile layouts, dark mode, place creation with a photo, map focus and photo popup, visit logging, group creation, and map-mode navigation. Mobile checks used a 390 × 844 viewport; desktop checks used 1280 and 1440 pixel widths.

## Existing feature boundaries

This is a frontend redesign with photo persistence, not a replacement for the extraction or routing engines. AI extraction still requires the server's configured provider key. Existing extraction reviews one proposed place at a time; fully automatic multi-place extraction and destination-folder creation are not implemented by this redesign. The collection tabs recognize Japan, Thailand, and Bali from saved address/name data and put other places under “Other places.” Shared trips continue to use the existing groups/trips API.

Walking routes retain the existing stop-order optimizer; map lines are not street-level turn-by-turn directions. Live GPS/geofence accuracy and physical revisit alerts were not field-tested. The site does not promise background GPS tracking when the browser is suspended.
