import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, CheckCircle2, Circle, Plus, Footprints, Flame } from "lucide-react";
import { usePlaces } from "../lib/usePlaces.js";
import { modernPin, meIcon, tileForStyle } from "../lib/leafletIcon.js";
import { api } from "../lib/api.js";
import { usePrefs } from "../lib/usePrefs.js";
import { HeatLayer } from "../components/HeatLayer.jsx";
import { MapStyleToggle } from "../components/MapStyleToggle.jsx";
import { MapEmpty } from "../components/illustrations.jsx";

function FitBounds({ points, focusId }) {
  const map = useMap();
  useEffect(() => {
    if (focusId) return;
    if (!points.length) return;
    const bounds = points.map((p) => [p.lat, p.lng]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }, [points, map, focusId]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), {
      animate: true,
      duration: 0.8,
    });
  }, [target, map]);
  return null;
}

export function MapPage() {
  const { places, refresh } = usePlaces();
  const [me, setMe] = useState(null);
  const [filter, setFilter] = useState("");
  const [focused, setFocused] = useState(null);
  const [showHeat, setShowHeat] = useState(false);
  const [heatPoints, setHeatPoints] = useState([]);
  const markerRefs = useRef({});
  const nav = useNavigate();
  const { mapStyle } = usePrefs();
  const tile = tileForStyle(mapStyle);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Lazy-load the heatmap data when toggled on for the first time.
  useEffect(() => {
    if (showHeat && !heatPoints.length) {
      fetch("/api/walks/heatmap")
        .then((r) => r.json())
        .then((data) => setHeatPoints(data.map((p) => [p.lat, p.lng])))
        .catch(() => {});
    }
  }, [showHeat, heatPoints.length]);

  const mapped = useMemo(
    () => places.filter((p) => p.lat != null && p.lng != null),
    [places]
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
    );
  }, [mapped, filter]);

  const center = mapped[0]
    ? [mapped[0].lat, mapped[0].lng]
    : me
    ? [me.lat, me.lng]
    : [20.5937, 78.9629];

  async function logVisit(p) {
    await api.logVisit(p.id, "From map");
    await refresh();
  }

  function focusPlace(p) {
    setFocused({ lat: p.lat, lng: p.lng, id: p.id });
    const marker = markerRefs.current[p.id];
    if (marker) setTimeout(() => marker.openPopup(), 400);
  }

  return (
    <div className="page full map-shell">
      <MapContainer
        key={mapStyle}
        center={center}
        zoom={mapped.length ? 13 : 4}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer url={tile.url} attribution={tile.attribution} subdomains={tile.subdomains} />
        {showHeat && <HeatLayer points={heatPoints} />}
        {me && (
          <Marker position={[me.lat, me.lng]} icon={meIcon()}>
            <Popup>You are here</Popup>
          </Marker>
        )}
        {mapped.map((p) => {
          const visited = (p.visit_count ?? 0) > 0;
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={modernPin(visited ? "visited" : "unvisited")}
              ref={(ref) => { if (ref) markerRefs.current[p.id] = ref; }}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{p.name}</div>
                  {p.category && <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>{p.category}</div>}
                  {p.address && <div style={{ fontSize: 13, marginBottom: 8 }}>{p.address}</div>}
                  <div style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
                    {visited ? `Visited ${p.visit_count}×` : "Not visited yet"}
                  </div>
                  <button className="sm" onClick={() => logVisit(p)}>Log a visit</button>
                </div>
              </Popup>
            </Marker>
          );
        })}
        <FitBounds points={mapped} focusId={focused?.id} />
        <FlyTo target={focused} />
      </MapContainer>

      <MapStyleToggle />

      <div className="map-panel">
        <div className="panel-head">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="font-display" style={{ fontSize: 22 }}>
                {mapped.length} place{mapped.length === 1 ? "" : "s"}
              </div>
              <div className="muted" style={{ marginTop: 2 }}>
                {mapped.filter((p) => p.visit_count > 0).length} visited · {mapped.filter((p) => !p.visit_count).length} new
              </div>
            </div>
            <button
              className={showHeat ? "sm" : "secondary sm"}
              onClick={() => setShowHeat((v) => !v)}
              title="Toggle walk heatmap"
            >
              <Flame size={14} />
              {showHeat ? "Heat on" : "Heat"}
            </button>
          </div>
          <div className="panel-search">
            <Search size={14} />
            <input
              placeholder="Search places…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="panel-list">
          {visible.length === 0 && (
            <div className="empty" style={{ padding: 24 }}>
              <MapEmpty />
              <h3>No places yet</h3>
              <p>Tap the + button or import a link to add your first place.</p>
            </div>
          )}
          {visible.map((p) => {
            const visited = (p.visit_count ?? 0) > 0;
            return (
              <div
                key={p.id}
                className={"map-panel-item" + (focused?.id === p.id ? " active" : "")}
                onClick={() => focusPlace(p)}
              >
                <div className={`pin ${visited ? "visited" : "unvisited"}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div className="meta">
                    {p.category && <span>{p.category}</span>}
                    {p.category && <span>·</span>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {visited ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                      {visited ? `${p.visit_count}×` : "new"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating action stack — Uber-style pill buttons. */}
      <div className="fab-stack">
        <button className="fab" onClick={() => nav("/walk")} title="Start a walk">
          <Footprints size={18} />
          <span>Walk</span>
        </button>
        <button className="fab icon-only" onClick={() => nav("/add")} title="Add a place" aria-label="Add a place">
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
