import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import { Sparkles, Crosshair, MapPin, Footprints, ChevronUp, ChevronDown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { tileForStyle, modernPin, meIcon } from "../lib/leafletIcon.js";
import { Toast } from "../components/Toast.jsx";
import { usePrefs } from "../lib/usePrefs.js";

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

// Recompute leg/cumulative distances when the user reorders stops by hand.
function withRecomputedLegs(start, stops) {
  let cum = 0;
  let prev = start;
  return stops.map((p) => {
    const leg = distanceMeters(prev, p);
    cum += leg;
    prev = p;
    return { ...p, leg_distance_m: Math.round(leg), cumulative_distance_m: Math.round(cum) };
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points, { padding: [60, 60], maxZoom: 16 });
  }, [points, map]);
  return null;
}

export function PlanPage() {
  const [start, setStart] = useState(null);
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState(null);
  const [stops, setStops] = useState([]); // editable copy of route.route
  const [maxCount, setMaxCount] = useState(8);
  const [radius, setRadius] = useState(2000);
  const [toast, setToast] = useState(null);
  const nav = useNavigate();
  const { mapStyle } = usePrefs();
  const tile = tileForStyle(mapStyle);

  function moveStop(idx, dir) {
    if (!start) return;
    setStops((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      return withRecomputedLegs(start, next);
    });
  }

  function removeStop(idx) {
    if (!start) return;
    setStops((prev) => withRecomputedLegs(start, prev.filter((_, i) => i !== idx)));
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setToast({ kind: "warn", title: "Geolocation unavailable" });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBusy(false);
      },
      (err) => {
        setToast({ kind: "warn", title: "Location denied", body: err.message });
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function plan() {
    if (!start) return;
    setBusy(true);
    try {
      const r = await api.smartRoute({
        lat: start.lat,
        lng: start.lng,
        max_count: maxCount,
        radius_m: radius,
        only_unvisited: true,
      });
      setRoute(r);
      setStops(r.route ?? []);
      if (!r.route?.length) {
        setToast({ kind: "warn", title: "No route", body: r.reason ?? "Nothing within range." });
      }
    } catch (err) {
      setToast({ kind: "warn", title: "Plan failed", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  const polyline = useMemo(() => {
    if (!stops.length || !route?.start) return [];
    return [
      [route.start.lat, route.start.lng],
      ...stops.map((p) => [p.lat, p.lng]),
    ];
  }, [stops, route]);

  const totalDistance = useMemo(
    () => stops.reduce((s, p) => s + (p.leg_distance_m || 0), 0),
    [stops]
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Plan a route</h1>
          <p className="subtitle">
            From where you are, the shortest walking path through your nearest
            unvisited saved places.
          </p>
        </div>
      </div>

      <div className="card col" style={{ maxWidth: 720, marginBottom: 16 }}>
        <div className="row" style={{ alignItems: "end", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Starting point</label>
            <input
              readOnly
              value={start ? `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}` : "—"}
              placeholder="Use my location to start"
            />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label>Max stops</label>
            <input
              type="number"
              min={1}
              max={30}
              value={maxCount}
              onChange={(e) => setMaxCount(Number(e.target.value) || 8)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label>Search radius (m)</label>
            <input
              type="number"
              min={100}
              max={10000}
              step={100}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value) || 2000)}
            />
          </div>
        </div>
        <div className="row">
          <button className="secondary" onClick={captureLocation} disabled={busy}>
            <Crosshair size={14} />
            Use my location
          </button>
          <button onClick={plan} disabled={busy || !start}>
            <Sparkles size={14} />
            {busy ? "Planning…" : "Plan route"}
          </button>
        </div>
      </div>

      {stops.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,380px)", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden", height: 540 }}>
            <MapContainer key={mapStyle} center={[route.start.lat, route.start.lng]} zoom={15} scrollWheelZoom style={{ height: "100%" }}>
              <TileLayer url={tile.url} attribution={tile.attribution} subdomains={tile.subdomains} />
              <Marker position={[route.start.lat, route.start.lng]} icon={meIcon()}>
                <Popup>Start</Popup>
              </Marker>
              {stops.map((p, i) => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={modernPin("unvisited")}>
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 700 }}>#{i + 1} {p.name}</div>
                      {p.category && <div className="faint" style={{ marginTop: 4 }}>{p.category}</div>}
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        Leg: {p.leg_distance_m}m · Total: {p.cumulative_distance_m}m
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
              <Polyline positions={polyline} pathOptions={{ color: "var(--black)", weight: 3, opacity: 0.7, dashArray: "6 6" }} />
              <FitBounds points={polyline} />
            </MapContainer>
          </div>

          <div className="card col" style={{ minWidth: 0 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Footprints size={18} />
              Suggested order
            </h3>
            <div className="muted" style={{ marginTop: -4 }}>
              {stops.length} stop{stops.length === 1 ? "" : "s"} ·{" "}
              {(totalDistance / 1000).toFixed(2)} km · drag the arrows to reorder
            </div>

            <div className="col" style={{ gap: 8, marginTop: 4 }}>
              {stops.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: 10,
                    background: "var(--pill-bg)",
                    borderRadius: "var(--radius-card)",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--invert-bg)", color: "var(--invert-fg)",
                      display: "grid", placeItems: "center",
                      fontWeight: 700, fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div className="faint">
                      {p.category ? `${p.category} · ` : ""}leg {p.leg_distance_m}m
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                      className="ghost icon-only"
                      style={{ padding: 4 }}
                      onClick={() => moveStop(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      className="ghost icon-only"
                      style={{ padding: 4 }}
                      onClick={() => moveStop(i, 1)}
                      disabled={i === stops.length - 1}
                      aria-label="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <button
                    className="ghost icon-only"
                    style={{ padding: 6 }}
                    onClick={() => removeStop(i)}
                    aria-label="Remove stop"
                    title="Remove from route"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="divider" />
            <div className="row">
              <button onClick={() => nav("/walk")}>
                <Footprints size={14} />
                Start walking it
              </button>
              <button className="secondary" onClick={() => setStops(route.route)}>
                Reset order
              </button>
            </div>
          </div>
        </div>
      )}

      {route && !route.route?.length && (
        <div className="empty">
          <div className="empty-icon"><MapPin size={22} /></div>
          <h3>No unvisited places nearby</h3>
          <p>{route.reason || "Try increasing the search radius, or add more places first."}</p>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
