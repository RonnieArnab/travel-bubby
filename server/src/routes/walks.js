import { Router } from "express";
import { db } from "../db/index.js";
import { distanceMeters } from "../services/geo.js";
import { logger } from "../lib/log.js";

const log = logger("walks");

export const walksRouter = Router();

const insertWalk = db.prepare(
  `INSERT INTO walks (name, auto_radius_m) VALUES (?, ?)`
);
const endWalk = db.prepare(
  `UPDATE walks SET ended_at = strftime('%s','now') * 1000 WHERE id = ? AND ended_at IS NULL`
);
const selectWalk = db.prepare(`SELECT * FROM walks WHERE id = ?`);
const selectWalks = db.prepare(`
  SELECT
    w.*,
    (SELECT COUNT(*) FROM walk_points wp WHERE wp.walk_id = w.id) AS point_count,
    (SELECT COUNT(*) FROM visits v WHERE v.walk_id = w.id) AS visit_count
  FROM walks w
  ORDER BY w.started_at DESC
`);
const selectPoints = db.prepare(
  `SELECT * FROM walk_points WHERE walk_id = ? ORDER BY recorded_at ASC`
);
const selectWalkVisits = db.prepare(`
  SELECT v.*, p.name AS place_name, p.lat AS place_lat, p.lng AS place_lng, p.category AS place_category
  FROM visits v
  JOIN places p ON p.id = v.place_id
  WHERE v.walk_id = ?
  ORDER BY v.visited_at ASC
`);

const insertPoint = db.prepare(
  `INSERT INTO walk_points (walk_id, lat, lng, accuracy_m) VALUES (?, ?, ?, ?)`
);
const insertVisitForWalk = db.prepare(
  `INSERT INTO visits (place_id, walk_id, note) VALUES (?, ?, ?)`
);
const visitedInWalk = db.prepare(
  `SELECT 1 FROM visits WHERE place_id = ? AND walk_id = ? LIMIT 1`
);
const placesWithCoords = db.prepare(
  `SELECT id, name, lat, lng, category FROM places WHERE lat IS NOT NULL AND lng IS NOT NULL`
);

// POST /api/walks  → start a new walk.
walksRouter.post("/", (req, res) => {
  const { name, radius } = req.body ?? {};
  const r = Number.isFinite(radius) && radius > 0 ? Math.min(500, radius) : 30;
  const info = insertWalk.run(name?.trim() || null, r);
  log.info("walk started", { id: info.lastInsertRowid, name: name ?? null, radius_m: r });
  res.status(201).json(selectWalk.get(info.lastInsertRowid));
});

// POST /api/walks/:id/points  → append a GPS point.
// On each point we check all known places: if any are within auto_radius_m and
// haven't been auto-visited in *this* walk yet, we record a new visit.
// This is the graph-traversal logic that prevents re-marking the same shop.
walksRouter.post("/:id/points", (req, res) => {
  const walk = selectWalk.get(req.params.id);
  if (!walk) return res.status(404).json({ error: "walk_not_found" });
  if (walk.ended_at) return res.status(400).json({ error: "walk_already_ended" });

  const { lat, lng, accuracy } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "coords_required" });
  }

  const pointInfo = insertPoint.run(walk.id, lat, lng, accuracy ?? null);

  // Auto-detect nearby places and mark them visited (once per walk).
  const newlyVisited = [];
  const allPlaces = placesWithCoords.all();
  for (const p of allPlaces) {
    const d = distanceMeters({ lat, lng }, { lat: p.lat, lng: p.lng });
    if (d <= walk.auto_radius_m && !visitedInWalk.get(p.id, walk.id)) {
      const v = insertVisitForWalk.run(p.id, walk.id, `auto via walk #${walk.id}`);
      newlyVisited.push({
        visit_id: v.lastInsertRowid,
        place_id: p.id,
        place_name: p.name,
        category: p.category,
        distance_m: Math.round(d),
      });
    }
  }

  if (newlyVisited.length) {
    log.info("auto-visit", {
      walk_id: walk.id,
      count: newlyVisited.length,
      places: newlyVisited.map((v) => v.place_name),
    });
  } else {
    log.debug("walk-point", {
      walk_id: walk.id,
      point_id: pointInfo.lastInsertRowid,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
    });
  }

  res.status(201).json({
    point_id: pointInfo.lastInsertRowid,
    walk_id: walk.id,
    auto_visits: newlyVisited,
  });
});

// POST /api/walks/:id/end
walksRouter.post("/:id/end", (req, res) => {
  const walk = selectWalk.get(req.params.id);
  if (!walk) return res.status(404).json({ error: "walk_not_found" });
  endWalk.run(req.params.id);
  const finished = selectWalk.get(req.params.id);
  log.info("walk ended", {
    id: finished.id,
    duration_s: finished.ended_at && finished.started_at
      ? Math.round((finished.ended_at - finished.started_at) / 1000)
      : null,
  });
  res.json(finished);
});

walksRouter.get("/", (_req, res) => {
  res.json(selectWalks.all());
});

// GET /api/walks/heatmap → flat list of every recorded walk point.
// The client feeds this straight into a leaflet heatmap layer.
const selectAllPoints = db.prepare(
  `SELECT lat, lng FROM walk_points ORDER BY recorded_at ASC`
);
walksRouter.get("/heatmap", (_req, res) => {
  res.json(selectAllPoints.all());
});

walksRouter.get("/:id", (req, res) => {
  const walk = selectWalk.get(req.params.id);
  if (!walk) return res.status(404).json({ error: "walk_not_found" });
  res.json({
    ...walk,
    points: selectPoints.all(walk.id),
    visits: selectWalkVisits.all(walk.id),
  });
});
