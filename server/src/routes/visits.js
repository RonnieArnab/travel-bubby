import { Router } from "express";
import { db } from "../db/index.js";

export const visitsRouter = Router();

const insertVisit = db.prepare(`
  INSERT INTO visits (place_id, note) VALUES (?, ?)
`);

const visitsForPlace = db.prepare(`
  SELECT * FROM visits WHERE place_id = ? ORDER BY visited_at DESC
`);

const placeExists = db.prepare(`SELECT id FROM places WHERE id = ?`);

visitsRouter.get("/place/:placeId", (req, res) => {
  res.json(visitsForPlace.all(req.params.placeId));
});

visitsRouter.post("/", (req, res) => {
  const { place_id, note } = req.body ?? {};
  if (!place_id) return res.status(400).json({ error: "place_id_required" });
  if (!placeExists.get(place_id)) {
    return res.status(404).json({ error: "place_not_found" });
  }
  const info = insertVisit.run(place_id, note ?? null);
  res.status(201).json({ id: info.lastInsertRowid, place_id, note: note ?? null });
});
