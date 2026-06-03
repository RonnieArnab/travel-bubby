import { useEffect, useMemo, useState } from "react";
import { Sparkles, Crosshair, Footprints, ChevronUp, ChevronDown, X, MapPin } from "lucide-react";
import { api } from "../../lib/api.js";

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
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

// Plan mode — captures GPS, calls /smart-route, lets user reorder. Passes
// the resulting route up so MapPage can draw the polyline.
export function PlanPanel({ me, onRouteChange, onToast, onSwitchToWalk }) {
  const [start, setStart] = useState(me);
  const [maxCount, setMaxCount] = useState(8);
  const [radius, setRadius] = useState(2000);
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState(null);
  const [stops, setStops] = useState([]);

  useEffect(() => { if (me && !start) setStart(me); }, [me, start]);

  function captureLocation() {
    if (!navigator.geolocation) return onToast?.({ kind: "warn", title: "Geolocation unavailable" });
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setBusy(false); },
      (err) => { onToast?.({ kind: "warn", title: "Location denied", body: err.message }); setBusy(false); },
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
      onRouteChange?.({ start: r.start, stops: r.route ?? [] });
      if (!r.route?.length) onToast?.({ kind: "warn", title: "No route", body: r.reason ?? "Nothing within range." });
    } catch (err) {
      onToast?.({ kind: "warn", title: "Plan failed", body: err.message });
    } finally { setBusy(false); }
  }

  function moveStop(idx, dir) {
    if (!start) return;
    setStops((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      const updated = withRecomputedLegs(start, next);
      onRouteChange?.({ start, stops: updated });
      return updated;
    });
  }
  function removeStop(idx) {
    if (!start) return;
    setStops((prev) => {
      const next = withRecomputedLegs(start, prev.filter((_, i) => i !== idx));
      onRouteChange?.({ start, stops: next });
      return next;
    });
  }

  const total = useMemo(() => stops.reduce((s, p) => s + (p.leg_distance_m || 0), 0), [stops]);

  return (
    <>
      <div className="panel-head">
        <div className="font-display" style={{ fontSize: 20, marginBottom: 4 }}>Plan a route</div>
        <div className="muted">Shortest walking order through your nearest unvisited places.</div>
        <div className="col" style={{ marginTop: 14, gap: 10 }}>
          <div>
            <label>Starting point</label>
            <input readOnly value={start ? `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}` : ""} placeholder="Use my location" />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Max stops</label>
              <input type="number" min={1} max={30} value={maxCount} onChange={(e) => setMaxCount(Number(e.target.value) || 8)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Radius (m)</label>
              <input type="number" min={100} max={10000} step={100} value={radius} onChange={(e) => setRadius(Number(e.target.value) || 2000)} />
            </div>
          </div>
          <div className="row">
            <button type="button" className="secondary" onClick={captureLocation} disabled={busy}>
              <Crosshair size={14} /> Use my location
            </button>
            <button onClick={plan} disabled={busy || !start}>
              <Sparkles size={14} /> {busy ? "Planning…" : "Plan"}
            </button>
          </div>
        </div>
      </div>

      <div className="panel-list">
        {!stops.length && (
          <div className="muted" style={{ padding: 16, textAlign: "center" }}>
            {busy ? "Computing…" : "Capture a starting point and tap Plan."}
          </div>
        )}
        {stops.length > 0 && (
          <>
            <div className="faint" style={{ padding: "8px 12px" }}>
              {stops.length} stops · {(total / 1000).toFixed(2)} km · reorder with arrows
            </div>
            {stops.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: "flex", gap: 10, padding: 10,
                  background: "var(--pill-bg)", borderRadius: "var(--radius-card)",
                  margin: "6px 8px", alignItems: "center",
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: "var(--invert-bg)", color: "var(--invert-fg)",
                  display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12,
                  flexShrink: 0,
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div className="faint">leg {p.leg_distance_m}m</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button className="ghost icon-only" style={{ padding: 4, minHeight: 24, minWidth: 24 }} onClick={() => moveStop(i, -1)} disabled={i === 0} aria-label="Up">
                    <ChevronUp size={14} />
                  </button>
                  <button className="ghost icon-only" style={{ padding: 4, minHeight: 24, minWidth: 24 }} onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} aria-label="Down">
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button className="ghost icon-only" style={{ padding: 6, minHeight: 28, minWidth: 28 }} onClick={() => removeStop(i)} aria-label="Remove">
                  <X size={14} />
                </button>
              </div>
            ))}
            <div style={{ padding: 12 }}>
              <button onClick={onSwitchToWalk} style={{ width: "100%" }}>
                <Footprints size={14} /> Start walking it
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
