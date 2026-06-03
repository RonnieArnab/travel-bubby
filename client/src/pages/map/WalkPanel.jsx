import { Play, Square, Footprints, CheckCircle2, MapPin, Bell, BellOff, AlertTriangle } from "lucide-react";

function fmtDuration(ms) {
  if (!ms || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Walk mode panel — receives the walk state hoisted in MapPage so the tracker
// keeps running across tab switches. Renders form (pre-walk) or stats (active).
export function WalkPanel({
  walk,
  points,
  totalMeters,
  autoVisits,
  elapsed,
  name,
  radius,
  busy,
  geofenceOn,
  hasPlaces,
  onChangeName,
  onChangeRadius,
  onStart,
  onStop,
  onToggleGeofence,
}) {
  const isActive = walk && !walk.ended_at;

  return (
    <>
      <div className="panel-head">
        <div className="font-display" style={{ fontSize: 20, marginBottom: 4 }}>Walk tracker</div>
        <div className="muted">
          {isActive
            ? `Recording — every saved shop within ${walk.auto_radius_m}m auto-marks visited.`
            : "Hit start and we'll record your path and auto-visit places you pass."}
        </div>
      </div>

      {!walk && (
        <div className="walk-sheet-section">
          <div className="col" style={{ gap: 10 }}>
            <div>
              <label>Walk name</label>
              <input placeholder="Sarojini Sunday loop" value={name} onChange={(e) => onChangeName(e.target.value)} />
            </div>
            <div>
              <label>Auto-visit radius (m)</label>
              <input type="number" min={10} max={200} value={radius} onChange={(e) => onChangeRadius(Number(e.target.value) || 30)} />
            </div>
            <button onClick={onStart} disabled={busy} style={{ width: "100%" }}>
              <Play size={16} /> {busy ? "Starting…" : "Start walk"}
            </button>
            <button
              className={geofenceOn ? "" : "secondary"}
              onClick={onToggleGeofence}
              style={{ width: "100%" }}
            >
              {geofenceOn ? <Bell size={14} /> : <BellOff size={14} />}
              {geofenceOn ? "Geofence on" : "Enable geofence alerts"}
            </button>
            {!hasPlaces && (
              <div style={{ display: "flex", gap: 8, padding: 12, background: "var(--warn-soft)", borderRadius: "var(--radius-card)" }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div className="muted">No saved places yet — there's nothing to auto-mark. Add a few first.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {walk && (
        <>
          <div className="walk-sheet-section walk-stats">
            <div className="walk-stat">
              <span className="label">Status</span>
              <span className="value" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
                {isActive ? <><span className="walk-recording-dot" /> Recording</> : "Ended"}
              </span>
            </div>
            <div className="walk-stat">
              <span className="label">Time</span>
              <span className="value">{fmtDuration(elapsed)}</span>
            </div>
            <div className="walk-stat">
              <span className="label">Distance</span>
              <span className="value">{(totalMeters / 1000).toFixed(2)} km</span>
            </div>
            <div className="walk-stat">
              <span className="label">Visited</span>
              <span className="value">{autoVisits.length}</span>
            </div>
          </div>

          {isActive && (
            <div className="walk-sheet-section" style={{ paddingTop: 0 }}>
              <button className="danger" onClick={onStop} disabled={busy} style={{ width: "100%" }}>
                <Square size={16} /> Stop walk
              </button>
            </div>
          )}

          <div className="walk-sheet-section walk-visited-list">
            <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, marginBottom: 10 }}>
              <Footprints size={12} /> Visited on this walk
            </div>
            {autoVisits.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                Nothing yet — walk near a saved shop and we'll mark it the moment you're within {walk.auto_radius_m}m.
              </div>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                {autoVisits.map((v) => (
                  <div key={v.visit_id} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 12px", background: "var(--pill-bg)", borderRadius: "var(--radius-card)",
                  }}>
                    <CheckCircle2 size={16} style={{ marginTop: 2, color: "var(--accent)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{v.place_name}</div>
                      <div className="faint">
                        {v.category ? `${v.category} · ` : ""}{v.distance_m}m from your path
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="walk-sheet-section" style={{ paddingTop: 0 }}>
            <div className="faint" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} /> Walk #{walk.id} · started {new Date(walk.started_at).toLocaleTimeString()}
            </div>
          </div>
        </>
      )}
    </>
  );
}
