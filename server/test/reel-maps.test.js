import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

const directory = await mkdtemp(join(tmpdir(), "reel-map-test-"));
process.env.DATA_DIR = directory;
const { createGeocoder, rankCandidates } =
  await import("../src/services/geocoder.js");
const { db } = await import("../src/db/index.js");
test.after(async () => {
  db.close();
  await rm(directory, { recursive: true, force: true });
});
const feature = (id, name, type, lat = 35.67, lng = 139.69) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: {
    osm_id: id,
    osm_type: "W",
    name,
    city: "Tokyo",
    country: "Japan",
    osm_key: type === "assembly_point" ? "emergency" : "amenity",
    osm_value: type,
  },
});
const features = [
  feature(1, "Meiji Jingu Main Shrine", "assembly_point"),
  feature(1, "Meiji Jingu Main Shrine", "place_of_worship"),
  feature(2, "Meiji Shrine Museum", "museum"),
];

test("geocoding deduplicates OSM features, caches queries and keeps branch ambiguity explicit", async () => {
  let calls = 0;
  const geocoder = createGeocoder({
    interval: 0,
    fetcher: async () => {
      calls++;
      return { ok: true, json: async () => ({ features }) };
    },
  });
  const input = {
    name: "Meiji Shrine",
    context: "Tokyo",
    kind: "named_place",
    category: "shrine",
  };
  const result = await geocoder.search(input);
  assert.equal(result.status, "matched");
  assert.equal(result.candidates.length, 2);
  assert.equal(result.selected.type, "place_of_worship");
  assert.equal(result.selected.lat, 35.67);
  assert.equal(result.selected.lng, 139.69);
  assert.equal((await geocoder.search(input)).cached, true);
  assert.equal(calls, 1);
  assert.equal(
    (await geocoder.search({ name: "ABC-MART", kind: "named_chain" })).status,
    "needs_context",
  );
  assert.equal(calls, 1);
  const ambiguous = await geocoder.search({ ...input, kind: "named_chain" });
  assert.equal(ambiguous.status, "needs_review");
  assert.equal(ambiguous.selected, null);
  assert.equal(
    rankCandidates([feature(3, "Broken", "museum", 300)], input).length,
    0,
  );
  const noContext = await geocoder.search({
    name: "Meiji Shrine",
    kind: "named_place",
  });
  assert.equal(noContext.selected, null);
});

test("saved reel groups are atomic, idempotent, persist coordinates and allow existing places to gain pins", async () => {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${port}/api`;
  let child,
    logs = "";
  async function start() {
    child = spawn(process.execPath, ["src/index.js"], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, DATA_DIR: directory, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (x) => {
      logs += x;
    });
    child.stderr.on("data", (x) => {
      logs += x;
    });
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(`${base}/health`)).ok) return;
      } catch {}
      if (child.exitCode != null) throw new Error(logs);
      await new Promise((r) => setTimeout(r, 40));
    }
    throw new Error(logs);
  }
  async function stop() {
    if (child && child.exitCode == null) {
      const done = once(child, "exit");
      child.kill();
      await done;
    }
  }
  const request = (path, data, method = "POST") =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  const input = {
    source_url: "https://www.instagram.com/p/test-reel/?igsh=share",
    name: "A Tokyo afternoon",
    places: [
      {
        key: "shrine",
        name: "Meiji Shrine",
        lat: 35.6748417,
        lng: 139.6996266,
        geocode_source: "photon",
        osm_url: "https://www.openstreetmap.org/way/469908925",
      },
      { key: "shop", name: "A shop to locate", lat: null, lng: null },
    ],
  };
  try {
    await start();
    const saved = await request("/reels/save", input);
    assert.equal(saved.status, 201);
    const first = await saved.json();
    assert.equal(first.places.length, 2);
    const duplicate = await (await request("/reels/save", input)).json();
    assert.equal(duplicate.collection.id, first.collection.id);
    assert.deepEqual(
      duplicate.places.map((p) => p.id),
      first.places.map((p) => p.id),
    );
    const invalid = await request("/reels/save", {
      ...input,
      source_url: "https://example.com/bad-reel",
      places: [
        { key: "ok", name: "Valid first" },
        { key: "bad", name: "Bad pin", lat: 100, lng: 4 },
      ],
    });
    assert.equal(invalid.status, 400);
    assert.equal((await (await fetch(`${base}/places`)).json()).length, 2);
    const shop = first.places.find((p) => p.import_key === "shop");
    assert.equal(
      (await request(`/places/${shop.id}`, { lat: 999, lng: 10 }, "PATCH"))
        .status,
      400,
    );
    assert.equal(
      (
        await request(
          `/places/${shop.id}`,
          {
            lat: 35.66,
            lng: 139.7,
            address: "Tokyo",
            geocode_source: "photon",
            osm_url: "https://www.openstreetmap.org/node/123",
          },
          "PATCH",
        )
      ).status,
      200,
    );
    await stop();
    await start();
    const restored = await (await fetch(`${base}/places`)).json();
    assert.equal(restored.length, 2);
    assert.ok(restored.every((p) => p.collection_id === first.collection.id));
    assert.ok(restored.every((p) => p.collection_name === "A Tokyo afternoon"));
    assert.equal(
      restored.find((p) => p.import_key === "shrine").lng,
      139.6996266,
    );
    assert.equal(
      restored.find((p) => p.import_key === "shop").geocode_source,
      "photon",
    );
  } finally {
    await stop();
  }
});
