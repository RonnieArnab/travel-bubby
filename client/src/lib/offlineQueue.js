// IndexedDB-backed queue of API writes that failed (or were never attempted)
// because the network was unreachable. Drains on reconnect / on demand.
//
// Today we queue exactly one job type: walk-point appends. The data shape is
//   { id, walk_id, body: { lat, lng, accuracy }, queued_at }
// Extending to other write types: add a `type` field and switch in `drain()`.

const DB_NAME = "travelbuddy";
const DB_VERSION = 1;
const STORE = "outbox";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("walk_id", "walk_id");
        store.createIndex("queued_at", "queued_at");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store))
      .then((r) => (result = r))
      .catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function enqueueWalkPoint(walkId, body) {
  return tx("readwrite", (store) =>
    new Promise((resolve, reject) => {
      const req = store.add({
        type: "walk_point",
        walk_id: walkId,
        body,
        queued_at: Date.now(),
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })
  );
}

export async function queueSize() {
  return tx("readonly", (store) =>
    new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })
  );
}

export async function listQueue() {
  return tx("readonly", (store) =>
    new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })
  );
}

async function deleteEntry(id) {
  return tx("readwrite", (store) =>
    new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    })
  );
}

// Drain the queue against a posting function. Stops on first failure so we
// don't burn through the queue when the network is still flaky.
export async function drainQueue({ onSuccess } = {}) {
  if (!navigator.onLine) return { drained: 0, remaining: await queueSize() };
  const items = await listQueue();
  items.sort((a, b) => a.queued_at - b.queued_at);
  let drained = 0;
  const accumulatedVisits = [];
  for (const item of items) {
    try {
      const res = await fetch(`/api/walks/${item.walk_id}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.auto_visits) && data.auto_visits.length) {
        accumulatedVisits.push(...data.auto_visits);
      }
      await deleteEntry(item.id);
      drained++;
      onSuccess?.(item, data);
    } catch {
      break; // Network is still bad — try again later.
    }
  }
  return {
    drained,
    remaining: await queueSize(),
    auto_visits: accumulatedVisits,
  };
}

// Auto-drain on reconnect. Call once at app startup.
export function watchAutoDrain(callback) {
  const fire = async () => {
    if (!navigator.onLine) return;
    const r = await drainQueue();
    if (r.drained || r.remaining) callback?.(r);
  };
  window.addEventListener("online", fire);
  // Periodic retry while online too — covers the case where network is
  // technically up but the server was unreachable a moment ago.
  const interval = setInterval(fire, 15000);
  // First attempt soon after load.
  setTimeout(fire, 2500);
  return () => {
    window.removeEventListener("online", fire);
    clearInterval(interval);
  };
}
