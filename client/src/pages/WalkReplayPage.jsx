import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import { Play, Pause, RotateCcw, Gauge, ChevronLeft, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api.js";
import { LIGHT_TILE, modernPin, meIcon } from "../lib/leafletIcon.js";

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points, { padding: [60, 60], maxZoom: 17 });
  }, [points, map]);
  return null;
}

export function WalkReplayPage() {
  const { id } = useParams();
  const [walk, setWalk] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0); // index into the points array
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(8); // points per second
  const [firedVisits, setFiredVisits] = useState([]); // visit ids whose timestamp has passed
  const tickRef = useRef(null);

  useEffect(() => {
    api.getWalk(id).then(setWalk).catch((e) => setError(e.message));
  }, [id]);

  const positions = useMemo(
    () => (walk?.points ?? []).map((p) => [p.lat, p.lng]),
    [walk]
  );

  // Tick: advance idx at "speed" points per second.
  useEffect(() => {
    if (!playing || !walk) return;
    const intervalMs = Math.max(50, 1000 / speed);
    tickRef.current = setInterval(() => {
      setIdx((i) => {
        if (!walk.points || i >= walk.points.length - 1) {
          setPlaying(false);
          return walk.points.length - 1;
        }
        return i + 1;
      });
    }, intervalMs);
    return () => clearInterval(tickRef.current);
  }, [playing, walk, speed]);

  // Fire visits as their visited_at falls before the current point's recorded_at.
  useEffect(() => {
    if (!walk?.points?.length || !walk.visits?.length) return;
    const cur = walk.points[idx];
    if (!cur) return;
    const fired = walk.visits
      .filter((v) => v.visited_at <= cur.recorded_at)
      .map((v) => v.id);
    setFiredVisits(fired);
  }, [idx, walk]);

  if (error) {
    return (
      <div className="page">
        <Link to="/walks" className="muted">← Walks</Link>
        <div className="empty">
          <h3>Couldn't load walk</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!walk) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 28, width: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 480, width: "100%" }} />
      </div>
    );
  }

  const total = walk.points?.length ?? 0;
  const cur = walk.points?.[idx];
  const trail = positions.slice(0, idx + 1);
  const head = cur ? [[cur.lat, cur.lng]] : [];
  const visitedPlaceIds = new Set(
    walk.visits.filter((v) => firedVisits.includes(v.id)).map((v) => v.place_id)
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/walks" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6, textDecoration: "none" }}>
            <ChevronLeft size={14} /> Walks
          </Link>
          <h1>{walk.name || `Walk #${walk.id}`}</h1>
          <p className="subtitle">
            {total} points · {walk.visits?.length ?? 0} auto-visits ·{" "}
            {new Date(walk.started_at).toLocaleString()}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)", gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden", height: 540 }}>
          <MapContainer
            center={positions[0] ?? [20.5937, 78.9629]}
            zoom={16}
            scrollWheelZoom
            style={{ height: "100%" }}
          >
            <TileLayer url={LIGHT_TILE.url} attribution={LIGHT_TILE.attribution} subdomains={LIGHT_TILE.subdomains} />

            {walk.visits.map((v) => (
              <Marker
                key={v.id}
                position={[v.place_lat, v.place_lng]}
                icon={modernPin(visitedPlaceIds.has(v.place_id) ? "visited" : "unvisited")}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>{v.place_name}</div>
                    <div className="faint" style={{ marginTop: 4 }}>{v.place_category || ""}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {trail.length > 1 && (
              <Polyline positions={trail} pathOptions={{ color: "#000000", weight: 4, opacity: 0.85 }} />
            )}
            {head.length > 0 && (
              <Marker position={head[0]} icon={meIcon()}>
                <Popup>
                  Point {idx + 1} / {total}
                  <br />
                  {cur && new Date(cur.recorded_at).toLocaleTimeString()}
                </Popup>
              </Marker>
            )}

            <FitBounds points={positions} />
          </MapContainer>
        </div>

        <div className="card col" style={{ minWidth: 0 }}>
          <div className="row" style={{ alignItems: "center", gap: 10 }}>
            <button onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Pause" : idx >= total - 1 ? "Replay" : "Play"}
            </button>
            <button className="secondary" onClick={() => { setIdx(0); setFiredVisits([]); }}>
              <RotateCcw size={14} />
              Restart
            </button>
          </div>

          <div>
            <label style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Progress</span>
              <span className="faint">{Math.min(idx + 1, total)} / {total}</span>
            </label>
            <input
              type="range"
              min={0}
              max={Math.max(0, total - 1)}
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              style={{ padding: 0, border: "none" }}
            />
          </div>

          <div>
            <label style={{ display: "flex", justifyContent: "space-between" }}>
              <span><Gauge size={12} style={{ marginRight: 4 }} /> Speed</span>
              <span className="faint">{speed} pt/s</span>
            </label>
            <input
              type="range"
              min={1}
              max={30}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ padding: 0, border: "none" }}
            />
          </div>

          <div className="divider" />

          <div className="section-label">Visits as they fire</div>
          <div className="col" style={{ gap: 6 }}>
            {walk.visits.map((v) => {
              const done = firedVisits.includes(v.id);
              return (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    background: done ? "var(--chip-gray)" : "var(--white)",
                    borderRadius: "var(--radius-card)",
                    border: done ? "1px solid transparent" : "1px solid var(--line-soft)",
                    opacity: done ? 1 : 0.55,
                    transition: "opacity 200ms",
                  }}
                >
                  <CheckCircle2 size={14} style={{ color: done ? "var(--black)" : "var(--muted-gray)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{v.place_name}</div>
                    <div className="faint">{new Date(v.visited_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              );
            })}
            {!walk.visits.length && (
              <div className="muted">No visits were auto-logged on this walk.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
