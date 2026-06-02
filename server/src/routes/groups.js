import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db } from "../db/index.js";
import { logger } from "../lib/log.js";

const log = logger("groups");
export const groupsRouter = Router();

const insertGroup = db.prepare(
  `INSERT INTO groups (name, share_token) VALUES (?, ?)`
);
const selectGroupByToken = db.prepare(
  `SELECT * FROM groups WHERE share_token = ?`
);
const selectGroupById = db.prepare(`SELECT * FROM groups WHERE id = ?`);
const selectMembers = db.prepare(
  `SELECT * FROM members WHERE group_id = ? ORDER BY joined_at ASC`
);
const insertMember = db.prepare(
  `INSERT OR IGNORE INTO members (group_id, name) VALUES (?, ?)`
);
const selectTripsForGroup = db.prepare(`
  SELECT t.*,
    (SELECT COUNT(*) FROM places p WHERE p.trip_id = t.id) AS place_count,
    (SELECT COUNT(*) FROM guides g WHERE g.trip_id = t.id) AS guide_count
  FROM trips t
  WHERE t.group_id = ?
  ORDER BY t.created_at DESC
`);

function makeToken() {
  return randomBytes(9).toString("base64url"); // 12-char URL-safe token
}

function groupView(group) {
  if (!group) return null;
  return {
    ...group,
    members: selectMembers.all(group.id),
    trips: selectTripsForGroup.all(group.id),
  };
}

// POST /api/groups → create group
groupsRouter.post("/", (req, res) => {
  const { name, creator_name } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "name_required" });
  const token = makeToken();
  const info = insertGroup.run(name.trim(), token);
  if (creator_name?.trim()) {
    insertMember.run(info.lastInsertRowid, creator_name.trim());
  }
  log.info("group created", { id: info.lastInsertRowid, name, token });
  const group = selectGroupById.get(info.lastInsertRowid);
  res.status(201).json(groupView(group));
});

// GET /api/groups/:token → group + members + trips
groupsRouter.get("/:token", (req, res) => {
  const group = selectGroupByToken.get(req.params.token);
  if (!group) return res.status(404).json({ error: "not_found" });
  res.json(groupView(group));
});

// POST /api/groups/:token/join → add a member by display name
groupsRouter.post("/:token/join", (req, res) => {
  const group = selectGroupByToken.get(req.params.token);
  if (!group) return res.status(404).json({ error: "not_found" });
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: "name_required" });
  insertMember.run(group.id, name);
  log.info("group join", { group_id: group.id, name });
  res.json(groupView(group));
});
