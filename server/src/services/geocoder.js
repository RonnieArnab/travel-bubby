import { createHash } from "node:crypto";
import { db } from "../db/index.js";

db.exec(
  `CREATE TABLE IF NOT EXISTS geocode_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
);
const read = db.prepare(
  "SELECT payload FROM geocode_cache WHERE cache_key = ? AND expires_at > ?",
);
const write = db.prepare(
  "INSERT OR REPLACE INTO geocode_cache VALUES (?, ?, ?)",
);
const clean = (value) =>
  typeof value === "string" ? value.trim().slice(0, 250) : "";
const normalize = (text) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export const validCoordinates = (lat, lng) =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

// Ranking is deliberately conservative. A chain never selects its own branch.
export function rankCandidates(features, place) {
  const tokens = normalize(clean(place.name)).split(" ").filter(Boolean);
  const context = normalize(
    clean(place.context || place.location || place.destination),
  );
  const category = normalize(clean(place.category));
  const unique = new Map();
  for (const feature of features) {
    const p = feature.properties || {},
      point = feature.geometry?.coordinates || [];
    const [lng, lat] = point;
    if (
      feature.geometry?.type !== "Point" ||
      !validCoordinates(lat, lng) ||
      !p.name
    )
      continue;
    const name = normalize(String(p.name));
    const overlap =
      tokens.filter((token) => name.split(" ").includes(token)).length /
      Math.max(tokens.length, 1);
    const address = [
      ...new Set(
        [
          p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
          p.district,
          p.city,
          p.state,
          p.country,
        ].filter(Boolean),
      ),
    ].join(", ");
    const contextMatches =
      !!context &&
      context
        .split(/[, ]+/)
        .filter(Boolean)
        .every((token) => normalize(address).includes(token));
    let score =
      overlap * 0.7 +
      (name === normalize(place.name) ? 0.15 : 0) +
      (contextMatches ? 0.2 : 0);
    const tag = `${p.osm_key} ${p.osm_value}`;
    if (/shrine|temple|worship|religious/.test(category))
      score += /place_of_worship/.test(tag) ? 0.22 : -0.2;
    if (/restaurant|cafe|food/.test(category))
      score += /restaurant|cafe|food_court|fast_food/.test(tag) ? 0.15 : -0.1;
    if (/shop|store|retail/.test(category))
      score += p.osm_key === "shop" ? 0.15 : -0.1;
    if (p.osm_key === "information" || p.osm_key === "emergency") score -= 0.25;
    const id = `${p.osm_type}:${p.osm_id}`;
    const candidate = {
      id,
      name: String(p.name),
      address,
      lat,
      lng,
      type: p.osm_value || p.type,
      score: Math.round(score * 100) / 100,
      context_match: contextMatches,
      name_match: overlap === 1,
      provider: "photon",
      osm_url:
        /^[NWR]$/.test(p.osm_type) && /^\d+$/.test(String(p.osm_id))
          ? `https://www.openstreetmap.org/${{ N: "node", W: "way", R: "relation" }[p.osm_type]}/${p.osm_id}`
          : null,
    };
    if (!unique.has(id) || unique.get(id).score < score)
      unique.set(id, candidate);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}

export function createGeocoder({ fetcher = fetch, interval = 1100 } = {}) {
  let tail = Promise.resolve(),
    lastRequest = 0,
    pending = 0;
  const active = new Map();
  async function search(place) {
    const name = clean(place.name),
      context = clean(
        place.context ||
          [place.location, place.destination].filter(Boolean).join(", "),
      );
    if (name.length < 2)
      throw Object.assign(new Error("Enter a place name."), { status: 400 });
    if (place.kind === "named_chain" && !context)
      return {
        status: "needs_context",
        candidates: [],
        message:
          "This is a chain. Add a city or neighborhood to choose the right branch.",
      };
    const endpoint = process.env.PHOTON_URL || "https://photon.komoot.io/api/";
    const query = [...new Set([name, context].filter(Boolean))].join(", ");
    const key = createHash("sha256")
      .update(JSON.stringify([endpoint, query.toLowerCase()]))
      .digest("hex");
    let features;
    const cached = read.get(key, Date.now());
    if (cached) features = JSON.parse(cached.payload);
    else {
      if (!active.has(key)) {
        if (pending >= 24)
          throw Object.assign(
            new Error("Place search is busy. Try again shortly."),
            { status: 429 },
          );
        pending++;
        const task = tail
          .then(async () => {
            const delay = interval - (Date.now() - lastRequest);
            if (delay > 0)
              await new Promise((resolve) => setTimeout(resolve, delay));
            lastRequest = Date.now();
            const url = new URL(endpoint);
            if (!["https:", "http:"].includes(url.protocol))
              throw new Error("Invalid Photon endpoint.");
            url.searchParams.set("q", query);
            url.searchParams.set("limit", "8");
            url.searchParams.set("lang", "en");
            const response = await fetcher(url, {
              headers: {
                "User-Agent": "TravelBuddy/0.3 (travel-reel place lookup)",
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(12000),
            });
            if (!response.ok)
              throw new Error(
                response.status === 429
                  ? "Place search is rate limited. Please try again later."
                  : "Place search is temporarily unavailable.",
              );
            const body = await response.json();
            if (!Array.isArray(body.features))
              throw new Error("Place search returned an invalid response.");
            const results = body.features.slice(0, 8);
            write.run(
              key,
              JSON.stringify(results),
              Date.now() + (results.length ? 30 * 86400000 : 3600000),
            );
            db.prepare(
              "DELETE FROM geocode_cache WHERE expires_at < ? OR cache_key NOT IN (SELECT cache_key FROM geocode_cache ORDER BY expires_at DESC LIMIT 2000)",
            ).run(Date.now());
            return results;
          })
          .finally(() => {
            pending--;
            active.delete(key);
          });
        active.set(key, task);
        tail = task.catch(() => {});
      }
      features = await active.get(key);
    }
    const candidates = rankCandidates(features, { ...place, name, context });
    const top = candidates[0];
    const confident =
      top &&
      place.kind !== "named_chain" &&
      top.name_match &&
      top.context_match &&
      top.score >= 0.9 &&
      (!candidates[1] || top.score - candidates[1].score >= 0.14);
    return {
      query,
      provider: "photon",
      cached: !!cached,
      status: confident
        ? "matched"
        : candidates.length
          ? "needs_review"
          : "not_found",
      candidates,
      selected: confident ? top : null,
      message: confident
        ? "Suggested map match — review before saving."
        : candidates.length
          ? "Choose the correct location below."
          : "No matching place found. Try its local name and city.",
    };
  }
  return { search };
}
export const geocoder = createGeocoder();
export async function locateImport(result, progress = () => {}) {
  if (!result.summary?.places?.length) return result;
  progress("geocoding");
  const places = [];
  for (const place of result.summary.places) {
    try {
      places.push({ ...place, geocoding: await geocoder.search(place) });
    } catch (error) {
      places.push({
        ...place,
        geocoding: { status: "error", candidates: [], message: error.message },
      });
    }
  }
  return { ...result, summary: { ...result.summary, places } };
}
