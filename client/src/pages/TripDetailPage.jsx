import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { ChevronLeft, Plus, Trash2, MapPin, BookOpen, Link2 } from "lucide-react";
import { api } from "../lib/api.js";
import { usePrefs } from "../lib/usePrefs.js";
import { tileForStyle, modernPin } from "../lib/leafletIcon.js";
import { Toast } from "../components/Toast.jsx";

export function TripDetailPage() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [guideTitle, setGuideTitle] = useState("");
  const [guideBody, setGuideBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const prefs = usePrefs();
  const tile = tileForStyle(prefs.mapStyle);

  async function load() {
    try { setTrip(await api.getTrip(id)); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function addGuide(e) {
    e.preventDefault();
    if (!guideTitle.trim()) return;
    setBusy(true);
    try {
      await api.addGuide(id, {
        title: guideTitle.trim(),
        body: guideBody.trim() || null,
        author_name: prefs.displayName || null,
      });
      setGuideTitle("");
      setGuideBody("");
      await load();
    } catch (err) {
      setToast({ kind: "warn", title: "Add guide failed", body: err.message });
    } finally { setBusy(false); }
  }

  async function removeGuide(g) {
    if (!confirm(`Delete "${g.title}"?`)) return;
    await api.deleteGuide(g.id);
    await load();
  }

  async function addPlaceFromUrl() {
    const url = prompt("Paste a link (Maps, Instagram, anywhere):");
    if (!url) return;
    setBusy(true);
    try {
      const data = await api.extract(url);
      await api.createPlace({
        name: data.name || "Untitled",
        notes: data.notes,
        lat: data.lat,
        lng: data.lng,
        source: data.source,
        source_url: data.sourceUrl,
        trip_id: trip.id,
        added_by: prefs.displayName || null,
      });
      setToast({ kind: "ok", title: "Place added" });
      await load();
    } catch (err) {
      setToast({ kind: "warn", title: "Add failed", body: err.message });
    } finally { setBusy(false); }
  }

  if (error) {
    return (
      <div className="page">
        <Link to="/groups" className="muted" style={{ display: "inline-flex", gap: 4, alignItems: "center", textDecoration: "none" }}>
          <ChevronLeft size={14} /> Groups
        </Link>
        <div className="empty"><h3>Couldn't load trip</h3><p>{error}</p></div>
      </div>
    );
  }
  if (!trip) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 28, width: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 360, width: "100%" }} />
      </div>
    );
  }

  const placesWithCoords = (trip.places ?? []).filter((p) => p.lat != null && p.lng != null);
  const center = placesWithCoords[0]
    ? [placesWithCoords[0].lat, placesWithCoords[0].lng]
    : [20.5937, 78.9629];

  return (
    <div className="page">
      <Link to={trip.group_token ? `/groups/${trip.group_token}` : "/groups"} className="muted" style={{ display: "inline-flex", gap: 4, alignItems: "center", textDecoration: "none", marginBottom: 6 }}>
        <ChevronLeft size={14} /> {trip.group_name || "Group"}
      </Link>
      <div className="page-header">
        <div>
          <h1>{trip.name}</h1>
          <p className="subtitle">
            {trip.location ? `${trip.location} · ` : ""}{trip.places.length} places · {trip.guides.length} guides
          </p>
        </div>
        <button onClick={addPlaceFromUrl} disabled={busy}>
          <Link2 size={14} /> Add place from link
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
        <div className="col">
          <div className="card" style={{ padding: 0, overflow: "hidden", height: 320 }}>
            <MapContainer center={center} zoom={placesWithCoords.length ? 13 : 4} scrollWheelZoom style={{ height: "100%" }}>
              <TileLayer url={tile.url} attribution={tile.attribution} subdomains={tile.subdomains} />
              {placesWithCoords.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={modernPin((p.visit_count ?? 0) > 0 ? "visited" : "unvisited")}>
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      {p.added_by && <div className="faint" style={{ marginTop: 4 }}>Added by {p.added_by}</div>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="section-label">Places</div>
          {trip.places.length === 0 ? (
            <div className="card muted">No places yet. Use "Add place from link" above to import an Instagram reel, Maps URL, or any web link.</div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {trip.places.map((p) => (
                <div key={p.id} className="card" style={{ padding: 14 }}>
                  <div className="card-title-row">
                    <h3 style={{ fontSize: 16 }}>{p.name}</h3>
                    <span className={`badge ${(p.visit_count ?? 0) > 0 ? "visited" : "unvisited"}`}>
                      {(p.visit_count ?? 0) > 0 ? `visited ${p.visit_count}×` : "new"}
                    </span>
                  </div>
                  {p.notes && <div className="muted">{p.notes.length > 200 ? p.notes.slice(0, 200) + "…" : p.notes}</div>}
                  <div className="faint" style={{ marginTop: 6, display: "flex", gap: 12 }}>
                    {p.category && <span>{p.category}</span>}
                    {p.added_by && <span>· added by {p.added_by}</span>}
                    {p.source_url && (
                      <a href={p.source_url} target="_blank" rel="noreferrer" className="faint">source</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col">
          <form className="card col" onSubmit={addGuide}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={16} /> Add a guide
            </h3>
            <div className="muted" style={{ marginTop: -4 }}>
              Tips, etiquette, must-tries, transit hacks — anything other members should know.
            </div>
            <div>
              <label>Title</label>
              <input
                placeholder="Where to eat in Shibuya"
                value={guideTitle}
                onChange={(e) => setGuideTitle(e.target.value)}
              />
            </div>
            <div>
              <label>Body</label>
              <textarea
                placeholder="Write your tips…"
                value={guideBody}
                onChange={(e) => setGuideBody(e.target.value)}
              />
            </div>
            <button disabled={busy || !guideTitle.trim()}>
              <Plus size={14} /> Add guide
            </button>
          </form>

          <div className="section-label">Guides</div>
          {trip.guides.length === 0 ? (
            <div className="card muted">No guides yet.</div>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {trip.guides.map((g) => (
                <div className="card" key={g.id} style={{ padding: 14 }}>
                  <div className="card-title-row">
                    <h3 style={{ fontSize: 16 }}>{g.title}</h3>
                    <button className="ghost sm" onClick={() => removeGuide(g)} aria-label="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {g.body && <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{g.body}</div>}
                  <div className="faint" style={{ marginTop: 6 }}>
                    {g.author_name ? `by ${g.author_name} · ` : ""}{new Date(g.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
