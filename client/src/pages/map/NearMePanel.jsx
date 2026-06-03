import { useEffect, useState } from "react";
import { Crosshair, Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api.js";

// Near me mode — same logic as the old HereCheckPage in a side panel.
// "Have I been to the spot I'm standing on?"
export function NearMePanel({ onToast, onPlacesChanged }) {
  const [coords, setCoords] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [radius, setRadius] = useState(75);
  const [autoWatch, setAutoWatch] = useState(false);

  function check(c) {
    if (!c) return;
    setBusy(true);
    api.nearbyCheck(c.lat, c.lng, radius)
      .then(setResult)
      .catch((err) => onToast?.({ kind: "warn", title: "Check failed", body: err.message }))
      .finally(() => setBusy(false));
  }

  function getOnce() {
    if (!navigator.geolocation) return onToast?.({ kind: "warn", title: "Geolocation unavailable" });
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCoords(c); check(c); },
      (err) => onToast?.({ kind: "warn", title: "Location denied", body: err.message }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  useEffect(() => {
    if (!autoWatch || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => { const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCoords(c); check(c); },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWatch, radius]);

  async function logVisit() {
    if (!result?.match) return;
    await api.logVisit(result.match.id, "Logged from Near-me");
    onToast?.({ kind: "ok", title: "Visit logged" });
    onPlacesChanged?.();
    check(coords);
  }

  async function saveAsNew() {
    if (!coords) return;
    const name = prompt("Name for this new place?");
    if (!name) return;
    await api.createPlace({ name, lat: coords.lat, lng: coords.lng, source: "here-check" });
    onToast?.({ kind: "ok", title: "Place saved" });
    onPlacesChanged?.();
    check(coords);
  }

  const match = result?.match;
  const alreadyVisited = result?.already_visited;

  return (
    <>
      <div className="panel-head">
        <div className="font-display" style={{ fontSize: 20, marginBottom: 4 }}>Have I been here?</div>
        <div className="muted">GPS-checks the spot you're standing in.</div>
        <div className="col" style={{ marginTop: 12, gap: 10 }}>
          <div>
            <label>Match radius (m)</label>
            <input type="number" min={10} max={1000} value={radius} onChange={(e) => setRadius(Number(e.target.value) || 75)} />
          </div>
          <div className="row">
            <button onClick={getOnce} disabled={busy}>
              <Crosshair size={14} /> {busy ? "Checking…" : "Check now"}
            </button>
            <button type="button" className="secondary" onClick={() => setAutoWatch((v) => !v)}>
              {autoWatch ? <EyeOff size={14} /> : <Eye size={14} />}
              {autoWatch ? "Stop" : "Auto-watch"}
            </button>
          </div>
          {coords && (
            <div className="faint" style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </div>
          )}
        </div>
      </div>

      <div className="panel-list">
        {result && !match && (
          <div style={{ padding: 14 }}>
            <div className="muted" style={{ marginBottom: 10 }}>No saved place within {result.radius}m.</div>
            <button onClick={saveAsNew} style={{ width: "100%" }}>Save this spot</button>
          </div>
        )}

        {match && (
          <div style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 17, flex: 1 }}>{match.name}</h3>
              <span className={`badge ${alreadyVisited ? "warn" : "unvisited"}`}>
                {alreadyVisited ? `visited ${match.visit_count}×` : "not yet"}
              </span>
            </div>
            {match.category && <div className="muted">{match.category}</div>}
            <div className="faint">{result.distance_m}m away</div>

            <div style={{
              padding: "12px 14px",
              marginTop: 10,
              borderRadius: "var(--radius-card)",
              background: alreadyVisited ? "var(--warn-soft)" : "var(--accent-soft)",
              display: "flex", gap: 10, alignItems: "center",
              fontWeight: 600,
              color: alreadyVisited ? "var(--warn)" : "var(--accent)",
            }}>
              {alreadyVisited ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              {alreadyVisited
                ? "You've been here. Skip it?"
                : "First time. Worth checking out."}
            </div>

            <button onClick={logVisit} style={{ width: "100%", marginTop: 12 }}>Log visit</button>
          </div>
        )}
      </div>
    </>
  );
}
