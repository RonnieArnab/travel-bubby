import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Copy, Users, Calendar, MapPin, BookOpen, ChevronLeft } from "lucide-react";
import { api } from "../lib/api.js";
import { usePrefs } from "../lib/usePrefs.js";
import { Toast } from "../components/Toast.jsx";

export function GroupDetailPage() {
  const { token } = useParams();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [tripName, setTripName] = useState("");
  const [tripLocation, setTripLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const prefs = usePrefs();

  async function load() {
    try {
      setGroup(await api.getGroup(token));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function addTrip(e) {
    e.preventDefault();
    if (!tripName.trim()) return;
    setBusy(true);
    try {
      await api.createTrip({
        group_id: group.id,
        name: tripName.trim(),
        location: tripLocation.trim() || null,
        created_by: prefs.displayName || null,
      });
      setTripName("");
      setTripLocation("");
      await load();
    } catch (err) {
      setToast({ kind: "warn", title: "Create trip failed", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/groups/${token}`;
    navigator.clipboard?.writeText(url).then(
      () => setToast({ kind: "ok", title: "Share link copied" }),
      () => setToast({ kind: "warn", title: "Copy failed", body: url })
    );
  }

  if (error) {
    return (
      <div className="page">
        <Link to="/groups" className="muted" style={{ display: "inline-flex", gap: 4, alignItems: "center", textDecoration: "none" }}>
          <ChevronLeft size={14} /> Groups
        </Link>
        <div className="empty">
          <h3>Couldn't load group</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!group) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 28, width: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200, width: "100%" }} />
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/groups" className="muted" style={{ display: "inline-flex", gap: 4, alignItems: "center", textDecoration: "none", marginBottom: 6 }}>
        <ChevronLeft size={14} /> Groups
      </Link>
      <div className="page-header">
        <div>
          <h1>{group.name}</h1>
          <p className="subtitle">
            Code <span className="tag" style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{group.share_token}</span>
            <button
              className="ghost sm"
              onClick={copyLink}
              style={{ marginLeft: 6 }}
            >
              <Copy size={12} /> Copy link
            </button>
          </p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 16 }}>
        <div className="col">
          <form className="card col" onSubmit={addTrip}>
            <h3>Add a trip</h3>
            <div className="row" style={{ gap: 12, alignItems: "end" }}>
              <div style={{ flex: 2, minWidth: 180 }}>
                <label>Trip name</label>
                <input
                  placeholder="Tokyo May 2026"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label>Location</label>
                <input
                  placeholder="Japan"
                  value={tripLocation}
                  onChange={(e) => setTripLocation(e.target.value)}
                />
              </div>
              <button disabled={busy || !tripName.trim()}>
                <Plus size={14} /> Add
              </button>
            </div>
          </form>

          <div className="section-label">Trips</div>
          {group.trips.length === 0 ? (
            <div className="card muted">No trips yet — add one above.</div>
          ) : (
            <div className="grid">
              {group.trips.map((t) => (
                <Link key={t.id} to={`/trips/${t.id}`} className="card hover" style={{ textDecoration: "none", color: "inherit" }}>
                  <h3>{t.name}</h3>
                  {t.location && <div className="faint">{t.location}</div>}
                  <div className="row" style={{ gap: 14, marginTop: 12, color: "var(--body-gray)", fontSize: 13 }}>
                    <span><MapPin size={11} /> {t.place_count ?? 0} places</span>
                    <span>·</span>
                    <span><BookOpen size={11} /> {t.guide_count ?? 0} guides</span>
                  </div>
                  <div className="faint" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={11} /> Created {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="col">
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={16} />
              Members
              <span className="badge" style={{ marginLeft: "auto" }}>{group.members.length}</span>
            </h3>
            <div className="col" style={{ gap: 6, marginTop: 10 }}>
              {group.members.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--pill-bg)", borderRadius: "var(--radius-pill)" }}>
                  <span>{m.name}</span>
                  <span className="faint">{new Date(m.joined_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            <div className="divider" />
            <div className="muted" style={{ fontSize: 13 }}>
              Anyone with the share link above can join this group and add to it.
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
