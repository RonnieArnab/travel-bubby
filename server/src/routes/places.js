import { Router } from "express";
import { db } from "../db/index.js";
import { distanceMeters } from "../services/geo.js";
import { logger } from "../lib/log.js";

const log = logger("places");

export const placesRouter = Router();

const REVISIT_RADIUS_M = 75;

const selectPlaceWithStats = db.prepare(`
  SELECT
    p.*,
    (SELECT COUNT(*) FROM visits v WHERE v.place_id = p.id) AS visit_count,
    (SELECT MAX(visited_at) FROM visits v WHERE v.place_id = p.id) AS last_visited_at
  FROM places p
  WHERE p.id = ?
`);

const selectAllPlaces = db.prepare(`
  SELECT
    p.*,
    (SELECT COUNT(*) FROM visits v WHERE v.place_id = p.id) AS visit_count,
    (SELECT MAX(visited_at) FROM visits v WHERE v.place_id = p.id) AS last_visited_at
  FROM places p
  ORDER BY p.created_at DESC
`);

const insertPlace = db.prepare(`
  INSERT INTO places (name, category, notes, lat, lng, address, source, source_url, trip_id, added_by)
  VALUES (@name, @category, @notes, @lat, @lng, @address, @source, @source_url, @trip_id, @added_by)
`);

const updatePlace = db.prepare(`
  UPDATE places SET
    name = COALESCE(@name, name),
    category = COALESCE(@category, category),
    notes = COALESCE(@notes, notes),
    lat = COALESCE(@lat, lat),
    lng = COALESCE(@lng, lng),
    address = COALESCE(@address, address)
  WHERE id = @id
`);

const deletePlace = db.prepare(`DELETE FROM places WHERE id = ?`);

placesRouter.get("/", (_req, res) => {
  res.json(selectAllPlaces.all());
});

placesRouter.get("/:id", (req, res) => {
  const place = selectPlaceWithStats.get(req.params.id);
  if (!place) return res.status(404).json({ error: "not_found" });
  res.json(place);
});

placesRouter.post("/", (req, res) => {
  const { name, category, notes, lat, lng, address, source, source_url, trip_id, added_by } =
    req.body ?? {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name_required" });
  }
  const info = insertPlace.run({
    name,
    category: category ?? null,
    notes: notes ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
    address: address ?? null,
    source: source ?? "manual",
    source_url: source_url ?? null,
    trip_id: trip_id ?? null,
    added_by: added_by ?? null,
  });
  res.status(201).json(selectPlaceWithStats.get(info.lastInsertRowid));
});

placesRouter.patch("/:id", (req, res) => {
  const existing = selectPlaceWithStats.get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not_found" });
  updatePlace.run({
    id: req.params.id,
    name: req.body?.name ?? null,
    category: req.body?.category ?? null,
    notes: req.body?.notes ?? null,
    lat: req.body?.lat ?? null,
    lng: req.body?.lng ?? null,
    address: req.body?.address ?? null,
  });
  res.json(selectPlaceWithStats.get(req.params.id));
});

placesRouter.delete("/:id", (req, res) => {
  deletePlace.run(req.params.id);
  res.status(204).end();
});

// "Have I been here?" — check the user's current coords against all known places.
// Returns the closest place within REVISIT_RADIUS_M (if any) plus its visit count.
placesRouter.post("/nearby-check", (req, res) => {
  const { lat, lng, radius } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "coords_required" });
  }
  const r = typeof radius === "number" ? radius : REVISIT_RADIUS_M;
  const all = selectAllPlaces.all();
  let closest = null;
  let closestDist = Infinity;
  for (const p of all) {
    if (p.lat == null || p.lng == null) continue;
    const d = distanceMeters({ lat, lng }, { lat: p.lat, lng: p.lng });
    if (d < closestDist) {
      closest = p;
      closestDist = d;
    }
  }
  if (!closest || closestDist > r) {
    return res.json({ match: null, radius: r });
  }
  res.json({
    match: closest,
    distance_m: Math.round(closestDist),
    already_visited: (closest.visit_count ?? 0) > 0,
    radius: r,
  });
});

// POST /api/places/smart-route
// Given a starting GPS point, suggest the optimal walking order to hit your
// nearest unvisited saved places. Nearest-neighbor seed + 2-opt improvement —
// sufficient quality for the small N (≤ 30) you'd realistically have nearby.
placesRouter.post("/smart-route", (req, res) => {
  const {
    lat,
    lng,
    max_count = 8,
    max_total_distance_m = null,
    only_unvisited = true,
    radius_m = 5000,
  } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "coords_required" });
  }

  const all = selectAllPlaces.all().filter((p) => p.lat != null && p.lng != null);
  const candidates = all
    .filter((p) => (only_unvisited ? (p.visit_count ?? 0) === 0 : true))
    .map((p) => ({
      ...p,
      _dist_from_start: distanceMeters({ lat, lng }, { lat: p.lat, lng: p.lng }),
    }))
    .filter((p) => p._dist_from_start <= radius_m)
    .sort((a, b) => a._dist_from_start - b._dist_from_start)
    .slice(0, Math.max(1, Math.min(30, max_count)));

  if (!candidates.length) {
    return res.json({
      start: { lat, lng },
      route: [],
      total_distance_m: 0,
      optimized: false,
      reason: only_unvisited
        ? "No unvisited saved places within range."
        : "No saved places within range.",
    });
  }

  // Distance helper for the local algorithm.
  const d = (a, b) => distanceMeters(a, b);
  const start = { lat, lng };

  // Nearest-neighbor seed.
  let remaining = candidates.slice();
  const seed = [];
  let cursor = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = d(cursor, remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const dd = d(cursor, remaining[i]);
      if (dd < bestDist) {
        bestDist = dd;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    seed.push(next);
    cursor = next;
  }

  // 2-opt: swap any two edges if it shortens the tour. Open path (no return
  // to start) → distance is start→p1→p2→…→pN.
  function tourDistance(tour) {
    let total = d(start, tour[0]);
    for (let i = 1; i < tour.length; i++) total += d(tour[i - 1], tour[i]);
    return total;
  }
  let best = seed.slice();
  let bestDist = tourDistance(best);
  let improved = true;
  let iters = 0;
  while (improved && iters < 50) {
    improved = false;
    iters++;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = best
          .slice(0, i)
          .concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const candDist = tourDistance(candidate);
        if (candDist + 0.5 < bestDist) {
          best = candidate;
          bestDist = candDist;
          improved = true;
        }
      }
    }
  }

  // Apply optional cap on cumulative distance.
  let cum = 0;
  let prev = start;
  const route = [];
  for (const p of best) {
    const leg = d(prev, p);
    if (max_total_distance_m && cum + leg > max_total_distance_m) break;
    cum += leg;
    route.push({
      ...p,
      _dist_from_start: undefined,
      leg_distance_m: Math.round(leg),
      cumulative_distance_m: Math.round(cum),
    });
    prev = p;
  }

  log.info("smart-route", {
    start: `${lat.toFixed(4)},${lng.toFixed(4)}`,
    candidates: candidates.length,
    chosen: route.length,
    total_m: Math.round(cum),
    iters_2opt: iters,
  });

  res.json({
    start,
    route,
    total_distance_m: Math.round(cum),
    optimized: true,
  });
});
