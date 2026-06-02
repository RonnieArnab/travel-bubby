import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// In production we mount a persistent disk at $DATA_DIR (e.g. /var/data on
// Render). Locally we fall back to ./server/data which lives in .gitignore.
const dataDir = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(__dirname, "../../data");
mkdirSync(dataDir, { recursive: true });
const dbPath = resolve(dataDir, "travel.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    notes TEXT,
    lat REAL,
    lng REAL,
    address TEXT,
    source TEXT,
    source_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    visited_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    note TEXT,
    walk_id INTEGER REFERENCES walks(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_visits_place ON visits(place_id);

  -- A "walk" is a single tracked outing (e.g. wandering a market).
  -- Points are the GPS breadcrumb trail; visits link back to places that the
  -- user walked past close enough to be considered visited.
  CREATE TABLE IF NOT EXISTS walks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    started_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    ended_at INTEGER,
    auto_radius_m INTEGER NOT NULL DEFAULT 30
  );

  CREATE TABLE IF NOT EXISTS walk_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    walk_id INTEGER NOT NULL REFERENCES walks(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    accuracy_m REAL,
    recorded_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_walk_points_walk ON walk_points(walk_id);
  CREATE INDEX IF NOT EXISTS idx_visits_walk ON visits(walk_id);
`);

// Backfill: visits table predates walk_id; older databases won't have the column.
const visitsCols = db.prepare("PRAGMA table_info(visits)").all();
if (!visitsCols.some((c) => c.name === "walk_id")) {
  db.exec("ALTER TABLE visits ADD COLUMN walk_id INTEGER REFERENCES walks(id) ON DELETE SET NULL");
}

// Groups, trips, members, guides — collaborative collections of places.
// "Group" = a workspace shared by a share_token. Anyone with the token can
// pick a display name and add to it (no auth in v1).
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    starts_on TEXT,
    ends_on TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    created_by TEXT
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    joined_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    UNIQUE(group_id, name)
  );

  CREATE TABLE IF NOT EXISTS guides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    author_name TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_trips_group ON trips(group_id);
  CREATE INDEX IF NOT EXISTS idx_guides_trip ON guides(trip_id);
  CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
`);

// Backfill: places gets trip_id (nullable) so existing places still work.
const placesCols = db.prepare("PRAGMA table_info(places)").all();
if (!placesCols.some((c) => c.name === "trip_id")) {
  db.exec("ALTER TABLE places ADD COLUMN trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL");
}
if (!placesCols.some((c) => c.name === "added_by")) {
  db.exec("ALTER TABLE places ADD COLUMN added_by TEXT");
}
