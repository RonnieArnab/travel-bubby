import { useEffect, useState } from "react";
import { Crosshair, Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api.js";
import { Toast } from "../components/Toast.jsx";
import { MapModeBar } from "../components/MapModeBar.jsx";

export function HereCheckPage() {
  const [coords, setCoords] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [radius, setRadius] = useState(75);
  const [autoWatch, setAutoWatch] = useState(false);

  function check(c) {
    if (!c) return;
    setBusy(true);
    api.nearbyCheck(c.lat, c.lng, radius)
      .then(setResult)
      .catch((err) => setToast({ kind: "warn", title: "Check failed", body: err.message }))
      .finally(() => setBusy(false));
  }

  function getOnce() {
    if (!navigator.geolocation) {
      setToast({ kind: "warn", title: "Geolocation unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        check(c);
      },
      (err) => setToast({ kind: "warn", title: "Location denied", body: err.message }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  useEffect(() => {
    if (!autoWatch || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        check(c);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWatch, radius]);

  async function logVisit() {
    if (!result?.match) return;
    await api.logVisit(result.match.id, "Logged from Here-check");
    setToast({ kind: "ok", title: "Visit logged" });
    check(coords);
  }

  async function saveAsNew() {
    if (!coords) return;
    const name = prompt("Name for this new place?");
    if (!name) return;
    await api.createPlace({
      name,
      lat: coords.lat,
      lng: coords.lng,
      source: "here-check",
    });
    setToast({ kind: "ok", title: "Place saved" });
    check(coords);
  }

  const match = result?.match;
  const alreadyVisited = result?.already_visited;

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}><MapModeBar /></div>
      <div className="page-header">
        <div>
          <h1>Have I been here?</h1>
          <p className="subtitle">GPS-checks the spot you're standing in against everything you've saved.</p>
        </div>
      </div>

      <div className="card col" style={{ maxWidth: 640 }}>
        <div className="row" style={{ alignItems: "end" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Match radius (meters)</label>
            <input
              type="number"
              value={radius}
              min={10}
              max={1000}
              onChange={(e) => setRadius(Number(e.target.value) || 75)}
            />
          </div>
          <button onClick={getOnce} disabled={busy}>
            <Crosshair size={14} />
            {busy ? "Checking…" : "Check now"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setAutoWatch((v) => !v)}
          >
            {autoWatch ? <EyeOff size={14} /> : <Eye size={14} />}
            {autoWatch ? "Stop watching" : "Auto-watch"}
          </button>
        </div>
        {coords && (
          <div className="faint" style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}
      </div>

      {result && !match && (
        <div className="card col" style={{ marginTop: 16, maxWidth: 640 }}>
          <h3>Nothing saved nearby</h3>
          <div className="muted">
            No saved place within {result.radius}m of where you are.
          </div>
          <div>
            <button onClick={saveAsNew}>Save this spot</button>
          </div>
        </div>
      )}

      {match && (
        <div className="card col" style={{ marginTop: 16, maxWidth: 640 }}>
          <div className="card-title-row">
            <h3>{match.name}</h3>
            <span className={`badge ${alreadyVisited ? "warn" : "unvisited"}`}>
              {alreadyVisited ? `visited ${match.visit_count}×` : "not yet visited"}
            </span>
          </div>
          {match.category && <div className="muted">{match.category}</div>}
          <div className="faint">{result.distance_m}m away</div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius)",
              background: alreadyVisited ? "rgba(251, 113, 133, 0.08)" : "rgba(52, 211, 153, 0.08)",
              border: `1px solid ${alreadyVisited ? "rgba(251, 113, 133, 0.25)" : "rgba(52, 211, 153, 0.25)"}`,
              display: "flex",
              gap: 10,
              alignItems: "center",
              fontWeight: 600,
              color: alreadyVisited ? "var(--warn)" : "var(--ok)",
            }}
          >
            {alreadyVisited ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {alreadyVisited
              ? "Heads up — you've been here before. Skip it?"
              : "First time here. Worth checking out."}
          </div>

          <div className="row">
            <button onClick={logVisit}>Log visit</button>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
