import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Footprints, Play, Calendar, MapPin } from "lucide-react";
import { api } from "../../lib/api.js";
import { WalksEmpty } from "../../components/illustrations.jsx";

function fmtDuration(start, end) {
  if (!end) return "ongoing";
  const s = Math.max(0, Math.floor((end - start) / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h) return `${h}h ${m % 60}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// History mode — list past walks. Each item links to /walks/:id/replay
// for the full animated playback view (kept as a dedicated route).
export function HistoryPanel({ onSelectWalk }) {
  const [walks, setWalks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listWalks().then(setWalks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="panel-head">
        <div className="font-display" style={{ fontSize: 20, marginBottom: 4 }}>Walks</div>
        <div className="muted">{walks.length} past walk{walks.length === 1 ? "" : "s"}</div>
      </div>
      <div className="panel-list">
        {loading && (
          <div style={{ padding: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />
            ))}
          </div>
        )}
        {!loading && walks.length === 0 && (
          <div className="empty" style={{ padding: 24 }}>
            <WalksEmpty />
            <h3>No walks yet</h3>
            <p>Switch to the Walk tab and hit Start.</p>
          </div>
        )}
        {walks.map((w) => (
          <div key={w.id} className="map-panel-item" onClick={() => onSelectWalk?.(w.id)} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Footprints size={14} style={{ color: "var(--accent)" }} />
              <div className="name" style={{ flex: 1 }}>{w.name || `Walk #${w.id}`}</div>
              <span className={`badge ${w.ended_at ? "" : "accent"}`}>
                {w.ended_at ? "ended" : "live"}
              </span>
            </div>
            <div className="meta">
              <Calendar size={11} />
              {new Date(w.started_at).toLocaleDateString()} · {w.point_count ?? 0} pts · {w.visit_count ?? 0} visits · {fmtDuration(w.started_at, w.ended_at)}
            </div>
            <Link
              to={`/walks/${w.id}/replay`}
              onClick={(e) => e.stopPropagation()}
              style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}
            >
              <Play size={12} /> Open replay
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
