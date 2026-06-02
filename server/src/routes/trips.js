import { Router } from "express";
import { db } from "../db/index.js";
import { logger } from "../lib/log.js";

const log = logger("trips");
export const tripsRouter = Router();

const selectTrip = db.prepare(`
  SELECT t.*,
    g.name AS group_name,
    g.share_token AS group_token
  FROM trips t
  LEFT JOIN groups g ON g.id = t.group_id
  WHERE t.id = ?
`);
const insertTrip = db.prepare(
  `INSERT INTO trips (group_id, name, location, starts_on, ends_on, created_by)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const selectPlacesForTrip = db.prepare(`
  SELECT p.*,
    (SELECT COUNT(*) FROM visits v WHERE v.place_id = p.id) AS visit_count
  FROM places p
  WHERE p.trip_id = ?
  ORDER BY p.created_at DESC
`);
const selectGuidesForTrip = db.prepare(
  `SELECT * FROM guides WHERE trip_id = ? ORDER BY created_at DESC`
);
const insertGuide = db.prepare(
  `INSERT INTO guides (trip_id, title, body, author_name) VALUES (?, ?, ?, ?)`
);
const deleteGuide = db.prepare(`DELETE FROM guides WHERE id = ?`);
const deleteTrip = db.prepare(`DELETE FROM trips WHERE id = ?`);

// POST /api/trips → create a trip in a group
tripsRouter.post("/", (req, res) => {
  const { group_id, name, location, starts_on, ends_on, created_by } =
    req.body ?? {};
  if (!group_id) return res.status(400).json({ error: "group_id_required" });
  if (!name?.trim()) return res.status(400).json({ error: "name_required" });
  const info = insertTrip.run(
    group_id,
    name.trim(),
    location ?? null,
    starts_on ?? null,
    ends_on ?? null,
    created_by ?? null
  );
  log.info("trip created", { id: info.lastInsertRowid, group_id, name });
  res.status(201).json(selectTrip.get(info.lastInsertRowid));
});

// GET /api/trips/:id → trip + places + guides
tripsRouter.get("/:id", (req, res) => {
  const trip = selectTrip.get(req.params.id);
  if (!trip) return res.status(404).json({ error: "not_found" });
  res.json({
    ...trip,
    places: selectPlacesForTrip.all(trip.id),
    guides: selectGuidesForTrip.all(trip.id),
  });
});

// DELETE /api/trips/:id
tripsRouter.delete("/:id", (req, res) => {
  deleteTrip.run(req.params.id);
  res.status(204).end();
});

// POST /api/trips/:id/guides → add a tip / note authored by a member
tripsRouter.post("/:id/guides", (req, res) => {
  const trip = selectTrip.get(req.params.id);
  if (!trip) return res.status(404).json({ error: "trip_not_found" });
  const { title, body, author_name } = req.body ?? {};
  if (!title?.trim()) return res.status(400).json({ error: "title_required" });
  const info = insertGuide.run(trip.id, title.trim(), body ?? null, author_name ?? null);
  log.info("guide added", { trip_id: trip.id, id: info.lastInsertRowid, author: author_name });
  res.status(201).json({
    id: info.lastInsertRowid,
    trip_id: trip.id,
    title,
    body: body ?? null,
    author_name: author_name ?? null,
    created_at: Date.now(),
  });
});

tripsRouter.delete("/guides/:guideId", (req, res) => {
  deleteGuide.run(req.params.guideId);
  res.status(204).end();
});
