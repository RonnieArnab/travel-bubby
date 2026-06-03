import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Footprints, Play, Calendar, MapPin } from "lucide-react";
import { api } from "../lib/api.js";
import { WalksEmpty } from "../components/illustrations.jsx";
import { MapModeBar } from "../components/MapModeBar.jsx";

function fmtDuration(start, end) {
  if (!end) return "ongoing";
  const s = Math.max(0, Math.floor((end - start) / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h) return `${h}h ${m % 60}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function WalksPage() {
  const [walks, setWalks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listWalks()
      .then(setWalks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}><MapModeBar /></div>
      <div className="page-header">
        <div>
          <h1>Walks</h1>
          <p className="subtitle">Past outings — replay any to see your path and the visits as they fired.</p>
        </div>
        <Link to="/walk"><button><Footprints size={14} /> New walk</button></Link>
      </div>

      {loading && (
        <div className="grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 18, width: "60%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: "40%", marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 36, width: "100%" }} />
            </div>
          ))}
        </div>
      )}

      {!loading && walks.length === 0 && (
        <div className="empty">
          <WalksEmpty />
          <h3>No walks yet</h3>
          <p>Start a walk and we'll record the path so you can replay it later.</p>
        </div>
      )}

      <div className="grid">
        {walks.map((w) => (
          <div className="card hover" key={w.id}>
            <div className="card-title-row">
              <h3>{w.name || `Walk #${w.id}`}</h3>
              <span className={`badge ${w.ended_at ? "" : "accent"}`}>
                {w.ended_at ? "ended" : "live"}
              </span>
            </div>
            <div className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={12} />
              {new Date(w.started_at).toLocaleString()}
            </div>
            <div className="row" style={{ gap: 16, marginTop: 12, color: "var(--body-gray)", fontSize: 14 }}>
              <span><MapPin size={12} style={{ marginRight: 4 }} />{w.point_count ?? 0} pts</span>
              <span>·</span>
              <span>{w.visit_count ?? 0} visits</span>
              <span>·</span>
              <span>{fmtDuration(w.started_at, w.ended_at)}</span>
            </div>
            <div className="divider" />
            <div className="row">
              <Link to={`/walks/${w.id}/replay`}><button className="sm"><Play size={14} /> Replay</button></Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
