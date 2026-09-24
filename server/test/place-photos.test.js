import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import Database from "better-sqlite3";

// Exercise the actual migration and HTTP handlers against disposable data.
test("place photos migrate safely, validate URLs, and persist across restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "travel-buddy-photos-"));
  const legacy = new Database(join(dir, "travel.db"));
  legacy.exec(`CREATE TABLE places (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    category TEXT, notes TEXT, lat REAL, lng REAL, address TEXT,
    source TEXT, source_url TEXT, created_at INTEGER NOT NULL DEFAULT 0
  ); INSERT INTO places (name, notes) VALUES ('Existing saved place', 'Keep this memory');`);
  legacy.close();
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${port}/api`;
  let child;
  let logs = "";
  async function start() {
    child = spawn(process.execPath, ["src/index.js"], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, DATA_DIR: dir, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      logs += chunk;
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        if ((await fetch(`${base}/health`)).ok) return;
      } catch {}
      if (child.exitCode !== null) throw new Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Server did not start: ${logs}`);
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
  }
  async function write(path, body, method = "POST") {
    return fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  try {
    await start();
    let existing = await (await fetch(`${base}/places/1`)).json();
    assert.equal(existing.notes, "Keep this memory");
    assert.equal(existing.image_url, null);
    const photo =
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e";
    const created = await write("/places", {
      name: "Kyoto memory",
      image_url: photo,
      lat: 35,
      lng: 135,
    });
    assert.equal(created.status, 201);
    const place = await created.json();
    assert.equal(place.image_url, photo);
    assert.equal(
      (
        await write("/places", {
          name: "Bad image",
          image_url: "javascript:alert(1)",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await write(
          `/places/${place.id}`,
          { image_url: "data:text/html,test" },
          "PATCH",
        )
      ).status,
      400,
    );
    await write(`/places/${place.id}`, { notes: "A new note" }, "PATCH");
    await stop();
    await start();
    const restored = await (await fetch(`${base}/places/${place.id}`)).json();
    assert.equal(restored.image_url, photo);
    assert.equal(restored.notes, "A new note");
    existing = await (await fetch(`${base}/places/1`)).json();
    assert.equal(existing.name, "Existing saved place");
    assert.equal(existing.notes, "Keep this memory");
    const cleared = await write(
      `/places/${place.id}`,
      { image_url: "" },
      "PATCH",
    );
    assert.equal((await cleared.json()).image_url, "");
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
