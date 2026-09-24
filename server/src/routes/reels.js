import { Router } from "express";
import { db } from "../db/index.js";
import { canonicalUrl } from "../services/importPipeline.js";
import { validCoordinates, geocoder } from "../services/geocoder.js";

export const reelsRouter = Router();
const failure = (res, error) =>
  res.status(error.status || 400).json({ message: error.message });
reelsRouter.post("/search", async (req, res) => {
  try {
    res.json(await geocoder.search(req.body || {}));
  } catch (error) {
    failure(res, error);
  }
});
const save = db.transaction(({ source_url, name, places }) => {
  db.prepare(
    "INSERT INTO reel_collections(name, source_url) VALUES (?, ?) ON CONFLICT(source_url) DO NOTHING",
  ).run(name, source_url);
  const collection = db
    .prepare("SELECT * FROM reel_collections WHERE source_url = ?")
    .get(source_url);
  const rows = [];
  for (const place of places) {
    const existing = db
      .prepare(
        "SELECT * FROM places WHERE collection_id = ? AND import_key = ?",
      )
      .get(collection.id, place.key);
    if (existing) {
      if (
        (existing.lat == null || existing.lng == null) &&
        validCoordinates(place.lat, place.lng)
      ) {
        db.prepare(
          "UPDATE places SET lat = ?, lng = ?, address = ?, geocode_source = ?, osm_url = ? WHERE id = ?",
        ).run(
          place.lat,
          place.lng,
          place.address,
          place.geocode_source,
          place.osm_url,
          existing.id,
        );
      }
      rows.push({
        key: place.key,
        ...db.prepare("SELECT * FROM places WHERE id = ?").get(existing.id),
      });
      continue;
    }
    const result = db
      .prepare(
        `INSERT INTO places(name, category, notes, address, lat, lng, source, source_url, image_url, collection_id, import_key, geocode_source, osm_url)
      VALUES (@name, @category, @notes, @address, @lat, @lng, @source, @source_url, @image_url, @collection_id, @key, @geocode_source, @osm_url)`,
      )
      .run({ ...place, source_url, collection_id: collection.id });
    rows.push({
      key: place.key,
      ...db
        .prepare("SELECT * FROM places WHERE id = ?")
        .get(result.lastInsertRowid),
    });
  }
  return { collection, places: rows };
});
reelsRouter.post("/save", (req, res) => {
  try {
    const body = req.body || {};
    const source_url = canonicalUrl(body.source_url || "");
    if (
      !Array.isArray(body.places) ||
      !body.places.length ||
      body.places.length > 20
    )
      throw new Error("Choose between 1 and 20 places to save.");
    const places = body.places.map((p) => {
      if (typeof p.name !== "string" || !p.name.trim())
        throw new Error("Each place needs a name.");
      if (typeof p.key !== "string" || !p.key || p.key.length > 100)
        throw new Error("Each place needs an import key.");
      if ((p.lat != null || p.lng != null) && !validCoordinates(p.lat, p.lng))
        throw new Error("Each map pin needs valid latitude and longitude.");
      if (p.image_url && !/^https?:\/\//i.test(p.image_url))
        throw new Error("Use an http or https photo URL.");
      const text = (value, max = 1000) =>
        typeof value === "string" ? value.trim().slice(0, max) : null;
      return {
        key: p.key,
        name: p.name.trim().slice(0, 160),
        category: text(p.category, 60),
        notes: text(p.notes, 16000),
        address: text(p.address),
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        source: text(p.source, 30) || "web",
        image_url: text(p.image_url, 4000),
        geocode_source: p.geocode_source === "photon" ? "photon" : "manual",
        osm_url:
          /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(
            p.osm_url || "",
          )
            ? p.osm_url
            : null,
      };
    });
    if (new Set(places.map((p) => p.key)).size !== places.length)
      throw new Error("A place cannot appear twice in the same save.");
    res.status(201).json(
      save({
        source_url,
        name:
          typeof body.name === "string" && body.name.trim()
            ? body.name.trim().slice(0, 160)
            : "Places from a reel",
        places,
      }),
    );
  } catch (error) {
    failure(res, error);
  }
});
