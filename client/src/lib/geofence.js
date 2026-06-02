// Client-side geofence runner. Watches the user's GPS while the app is open
// and fires a Web Notification when the user enters a fence around a saved,
// unvisited place.
//
// Caveats called out in the README: we can't run when the tab is closed
// without a real Web Push setup (VAPID + server). This is the in-app version.

const COOLDOWN_KEY = "tb-geofence-cooldown";
const COOLDOWN_MS = 30 * 60 * 1000; // don't re-alert for the same place within 30 min

function loadCooldown() {
  try {
    return JSON.parse(localStorage.getItem(COOLDOWN_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCooldown(map) {
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(map));
}

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function ensureNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

function fireNotification(place, meters) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const body = `~${Math.round(meters)}m away${place.category ? ` · ${place.category}` : ""}${
    place.notes ? `\n${place.notes.slice(0, 120)}${place.notes.length > 120 ? "…" : ""}` : ""
  }`;
  const n = new Notification(`Saved spot nearby: ${place.name}`, {
    body,
    icon: "/icon-192.svg",
    tag: `tb-place-${place.id}`,
    renotify: false,
  });
  n.onclick = () => {
    window.focus();
    n.close();
  };
}

// Start the geofence loop. Returns a stop function.
//   getPlaces: () => Place[]   (must include lat/lng/visit_count/id/name/category/notes)
//   options: { radius_m=120, onAlert(place, distance) }
export function startGeofence(getPlaces, options = {}) {
  const { radius_m = 120, onAlert } = options;
  if (!navigator.geolocation) return () => {};

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const places = (getPlaces() || []).filter(
        (p) => p.lat != null && p.lng != null && (p.visit_count ?? 0) === 0
      );
      const cooldown = loadCooldown();
      const now = Date.now();
      let touched = false;
      for (const p of places) {
        const d = distanceMeters(here, p);
        if (d > radius_m) continue;
        const last = cooldown[p.id] ?? 0;
        if (now - last < COOLDOWN_MS) continue;
        cooldown[p.id] = now;
        touched = true;
        fireNotification(p, d);
        onAlert?.(p, d);
      }
      // Also clean up old cooldown entries for places that no longer exist.
      const ids = new Set(places.map((p) => p.id));
      for (const k of Object.keys(cooldown)) {
        if (!ids.has(Number(k)) && now - cooldown[k] > 24 * 60 * 60 * 1000) {
          delete cooldown[k];
          touched = true;
        }
      }
      if (touched) saveCooldown(cooldown);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
