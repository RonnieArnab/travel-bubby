import { useState } from "react";
import { CheckCircle2, Trash2, MapPin, Bookmark, Tag, ExternalLink } from "lucide-react";
import { usePlaces } from "../lib/usePlaces.js";
import { api } from "../lib/api.js";
import { Toast } from "../components/Toast.jsx";
import { PlacesEmpty } from "../components/illustrations.jsx";

function fmt(ts) {
  if (!ts) return "—";
  const d = new Date(Number(ts));
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function PlacesPage() {
  const { places, loading, error, refresh } = usePlaces();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  const visible = places
    .filter((p) => {
      if (filter === "visited") return (p.visit_count ?? 0) > 0;
      if (filter === "unvisited") return !p.visit_count;
      return true;
    })
    .filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
      );
    });

  async function logVisit(p) {
    await api.logVisit(p.id, null);
    setToast({ kind: "ok", title: `Visit logged for ${p.name}` });
    await refresh();
  }

  async function remove(p) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await api.deletePlace(p.id);
    setToast({ kind: "warn", title: `Deleted ${p.name}` });
    await refresh();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Saved places</h1>
          <p className="subtitle">Everywhere you've been or want to go.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 180 }}>
            <option value="all">All ({places.length})</option>
            <option value="unvisited">Not yet visited</option>
            <option value="visited">Already visited</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 16, width: "60%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 36, width: "100%" }} />
            </div>
          ))}
        </div>
      )}

      {error && <div className="card" style={{ color: "var(--warn)" }}>{error}</div>}

      {!loading && visible.length === 0 && (
        <div className="empty">
          <PlacesEmpty />
          <h3>No places to show</h3>
          <p>Add one manually or import an Instagram reel / Maps link.</p>
        </div>
      )}

      <div className="grid">
        {visible.map((p) => {
          const visited = (p.visit_count ?? 0) > 0;
          return (
            <div className="card hover" key={p.id}>
              <div className="card-title-row">
                <h3>{p.name}</h3>
                <span className={`badge ${visited ? "visited" : "unvisited"}`}>
                  {visited ? `visited ${p.visit_count}×` : "new"}
                </span>
              </div>

              {p.category && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 13, marginBottom: 6 }}>
                  <Tag size={12} />
                  {p.category}
                </div>
              )}

              {p.address && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13, marginBottom: 8 }}>
                  <MapPin size={12} style={{ marginTop: 3, flexShrink: 0, color: "var(--text-faint)" }} />
                  <span>{p.address}</span>
                </div>
              )}

              {p.notes && (
                <div className="muted" style={{ marginTop: 8, marginBottom: 12 }}>
                  {p.notes.length > 180 ? p.notes.slice(0, 180) + "…" : p.notes}
                </div>
              )}

              <div className="divider" />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="faint">
                  Last visit: {fmt(p.last_visited_at)}
                </div>
                {p.source_url && (
                  <a href={p.source_url} target="_blank" rel="noreferrer" className="faint" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <ExternalLink size={11} />
                    {p.source}
                  </a>
                )}
              </div>

              <div className="row" style={{ marginTop: 14 }}>
                <button className="sm" onClick={() => logVisit(p)}>
                  <CheckCircle2 size={14} />
                  Log visit
                </button>
                <button className="ghost sm" onClick={() => remove(p)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
