// Extract place info from a pasted URL (WhatsApp share, Instagram reel, Google Maps).
// We do best-effort parsing without needing third-party APIs:
//  - Google Maps: pull lat/lng from /@lat,lng or !3dlat!4dlng patterns and the page title.
//  - Instagram: pull caption / og:title / og:description from public OG tags.
//  - Anything else: read OG tags so the user at least gets a title back.

import { logger } from "../lib/log.js";

const log = logger("extract");

const UA =
  "Mozilla/5.0 (compatible; TravelBuddy/0.1; +https://example.com/bot)";

async function fetchHtml(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
    });
    if (!res.ok) {
      log.warn("fetch non-2xx", { url, status: res.status, ms: Date.now() - t0 });
      throw new Error(`Fetch failed: ${res.status}`);
    }
    const html = await res.text();
    log.debug("fetched", { url, final: res.url, bytes: html.length, ms: Date.now() - t0 });
    return { html, finalUrl: res.url };
  } catch (err) {
    log.warn("fetch error", { url, reason: err.message, ms: Date.now() - t0 });
    throw err;
  }
}

function pickMeta(html, names) {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      "i"
    );
    const m2 = html.match(re2);
    if (m2) return decodeEntities(m2[1]);
  }
  return null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractCoordsFromMapsUrl(url) {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const bang = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bang) return { lat: parseFloat(bang[1]), lng: parseFloat(bang[2]) };
  const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  return null;
}

function extractCoordsFromHtml(html) {
  const m =
    html.match(/"latitude":\s*(-?\d+\.\d+)[^}]*"longitude":\s*(-?\d+\.\d+)/) ||
    html.match(/"lat":\s*(-?\d+\.\d+)[^}]*"lng":\s*(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

function detectSource(url) {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("google.com/maps") || u.includes("goo.gl/maps") || u.includes("maps.app.goo.gl"))
    return "google_maps";
  if (u.includes("wa.me") || u.includes("whatsapp.com")) return "whatsapp";
  return "web";
}

export async function extractFromUrl(rawUrl) {
  const url = rawUrl.trim();
  const source = detectSource(url);
  log.info("extract start", { source, url });

  let html = "";
  let finalUrl = url;
  try {
    const r = await fetchHtml(url);
    html = r.html;
    finalUrl = r.finalUrl;
  } catch {
    // Fall through with what we have.
  }

  const title =
    pickMeta(html, ["og:title", "twitter:title"]) ||
    (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null);
  const description = pickMeta(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const image = pickMeta(html, ["og:image", "twitter:image"]);

  const coords =
    extractCoordsFromMapsUrl(finalUrl) ||
    extractCoordsFromMapsUrl(url) ||
    extractCoordsFromHtml(html);

  const result = {
    source,
    sourceUrl: finalUrl || url,
    name: title?.trim() || null,
    notes: description?.trim() || null,
    image: image || null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  };
  log.info("extract done", {
    source,
    has_title: !!result.name,
    has_image: !!result.image,
    has_coords: result.lat != null && result.lng != null,
  });
  return result;
}
