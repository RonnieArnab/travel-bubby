import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import {
  Play,
  Square,
  Footprints,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Wifi,
  WifiOff,
  Bell,
  BellOff,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { api } from "../lib/api.js";
import {
  LIGHT_TILE,
  modernPin,
  meIcon,
  trailDot,
  checkPin,
} from "../lib/leafletIcon.js";
import { Toast } from "../components/Toast.jsx";
import {
  enqueueWalkPoint,
  drainQueue,
  queueSize,
} from "../lib/offlineQueue.js";
import { ensureNotificationPermission, startGeofence } from "../lib/geofence.js";

const RADIUS_DEFAULT = 30;

function FollowMe({ point }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.panTo([point.lat, point.lng], { animate: true });
  }, [point, map]);
  return null;
}

function FitToData({ trail, places, me, deps }) {
  const map = useMap();
  useEffect(() => {
    const pts = [];
    if (trail?.length) pts.push(...trail);
    if (places?.length) pts.push(...places.map((p) => [p.lat, p.lng]));
    if (me) pts.push([me.lat, me.lng]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 16);
      return;
    }
    map.fitBounds(pts, { padding: [50, 50], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function WalkPage() {
  const [walk, setWalk] = useState(null);
  const [points, setPoints] = useState([]);
  const [me, setMe] = useState(null);
  const [autoVisits, setAutoVisits] = useState([]);
  const [allPlaces, setAllPlaces] = useState([]);
  const [radius, setRadius] = useState(RADIUS_DEFAULT);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [queued, setQueued] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [geofenceOn, setGeofenceOn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const watchIdRef = useRef(null);
  const stopGeofenceRef = useRef(null);
  const allPlacesRef = useRef([]);
  allPlacesRef.current = allPlaces;

  // Tick the live timer once a second while the walk is active.
  useEffect(() => {
    if (!walk || walk.ended_at) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [walk]);

  useEffect(() => {
    api.listPlaces().then(setAllPlaces).catch(() => {});
  }, []);

  // Get an initial location even before the walk starts so the map can center.
  useEffect(() => {
    if (!navigator.geolocation || me) return;
    const id = navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
    return () => id;
  }, [me]);

  // Online/offline awareness — drains the queue automatically on reconnect.
  useEffect(() => {
    const refreshQueued = async () => setQueued(await queueSize().catch(() => 0));
    refreshQueued();
    const onOnline = async () => {
      setIsOnline(true);
      const r = await drainQueue();
      if (r.drained) {
        setToast({
          kind: "ok",
          title: `Synced ${r.drained} queued point${r.drained === 1 ? "" : "s"}`,
          body: r.auto_visits?.length ? `+${r.auto_visits.length} auto-visit(s) recorded` : null,
        });
        if (r.auto_visits?.length) {
          setAutoVisits((prev) => [...prev, ...r.auto_visits]);
          api.listPlaces().then(setAllPlaces).catch(() => {});
        }
      }
      refreshQueued();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(refreshQueued, 5000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  async function startWalk() {
    setBusy(true);
    try {
      const w = await api.startWalk({ name: name.trim() || null, radius });
      setWalk(w);
      setPoints([]);
      setAutoVisits([]);
      if (!navigator.geolocation) {
        setToast({ kind: "warn", title: "Geolocation unavailable" });
        return;
      }
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          const c = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            t: Date.now(),
          };
          setMe(c);
          setPoints((prev) => [...prev, c]);
          try {
            const result = await api.appendWalkPoint(w.id, {
              lat: c.lat,
              lng: c.lng,
              accuracy: c.accuracy,
            });
            if (result.auto_visits?.length) {
              setAutoVisits((prev) => [...prev, ...result.auto_visits]);
              setToast({
                kind: "ok",
                title: `Visited ${result.auto_visits[0].place_name}`,
                body:
                  result.auto_visits.length > 1
                    ? `+${result.auto_visits.length - 1} more nearby`
                    : `~${result.auto_visits[0].distance_m}m from your path`,
              });
              api.listPlaces().then(setAllPlaces).catch(() => {});
            }
          } catch {
            await enqueueWalkPoint(w.id, {
              lat: c.lat,
              lng: c.lng,
              accuracy: c.accuracy,
            });
            setQueued(await queueSize());
          }
        },
        (err) => setToast({ kind: "warn", title: "GPS error", body: err.message }),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
      watchIdRef.current = id;
    } catch (err) {
      setToast({ kind: "warn", title: "Could not start walk", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function stopWalk() {
    if (!walk) return;
    setBusy(true);
    try {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      await drainQueue().catch(() => {});
      const finished = await api.endWalk(walk.id);
      setWalk(finished);
      setToast({
        kind: "ok",
        title: "Walk ended",
        body: `${autoVisits.length} place${autoVisits.length === 1 ? "" : "s"} marked visited.`,
      });
    } catch (err) {
      setToast({ kind: "warn", title: "Stop failed", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleGeofence() {
    if (geofenceOn) {
      stopGeofenceRef.current?.();
      stopGeofenceRef.current = null;
      setGeofenceOn(false);
      return;
    }
    const perm = await ensureNotificationPermission();
    if (perm !== "granted") {
      setToast({
        kind: "warn",
        title: "Notifications blocked",
        body: "Allow notifications in your browser to enable geofence alerts.",
      });
      return;
    }
    stopGeofenceRef.current = startGeofence(() => allPlacesRef.current, {
      radius_m: 120,
      onAlert: (place, d) => {
        setToast({
          kind: "ok",
          title: `Nearby unvisited: ${place.name}`,
          body: `~${Math.round(d)}m away`,
        });
      },
    });
    setGeofenceOn(true);
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      stopGeofenceRef.current?.();
    };
  }, []);

  const polyline = useMemo(() => points.map((p) => [p.lat, p.lng]), [points]);

  const totalMeters = useMemo(() => {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += distanceMeters(points[i - 1], points[i]);
    }
    return d;
  }, [points]);

  // Set of place IDs auto-visited on *this* walk — used to render the
  // distinctive check pin so fresh visits stand out from prior visits.
  const freshVisitIds = useMemo(
    () => new Set(autoVisits.map((v) => v.place_id)),
    [autoVisits]
  );

  const isActive = walk && !walk.ended_at;
  const elapsed = isActive ? now - walk.started_at : (walk?.ended_at ?? now) - (walk?.started_at ?? now);

  const placesWithCoords = allPlaces.filter((p) => p.lat != null && p.lng != null);

  const center = me
    ? [me.lat, me.lng]
    : placesWithCoords[0]
    ? [placesWithCoords[0].lat, placesWithCoords[0].lng]
    : [20.5937, 78.9629];

  // Pick the appropriate pin for each saved place.
  function pinForPlace(p) {
    if (freshVisitIds.has(p.id)) return checkPin();
    if ((p.visit_count ?? 0) > 0) return modernPin("visited");
    return modernPin("unvisited");
  }

  return (
    <div className="page walk-page">
      <div className="walk-header">
        <div className="row" style={{ alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: "var(--font-display, 'UberMove'), Inter, sans-serif" }}>
            Walk tracker
          </h1>
          <div style={{ flex: 1 }} />
          <span className={`health-pill ${isOnline ? "ok" : "warn"}`} style={{ width: "auto" }}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{isOnline ? "Online" : "Offline"}</span>
          </span>
          {queued > 0 && (
            <span className="health-pill warn" style={{ width: "auto" }}>
              <span>{queued} queued</span>
            </span>
          )}
          <button
            className={geofenceOn ? "" : "secondary"}
            onClick={toggleGeofence}
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            {geofenceOn ? <Bell size={14} /> : <BellOff size={14} />}
            {geofenceOn ? "Geofence on" : "Geofence"}
          </button>
        </div>
      </div>

      <div className="walk-shell">
        {/* Always-visible map. Before the walk: pins + your location. During:
            adds the polyline + breadcrumbs + check pins for fresh visits. */}
        <div className="walk-map">
          <MapContainer
            center={center}
            zoom={me ? 17 : placesWithCoords.length ? 13 : 4}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url={LIGHT_TILE.url} attribution={LIGHT_TILE.attribution} subdomains={LIGHT_TILE.subdomains} />

            {placesWithCoords.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={pinForPlace(p)}>
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    {p.category && <div style={{ fontSize: 12, color: "#4b4b4b", marginTop: 2 }}>{p.category}</div>}
                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 8,
                        fontWeight: 500,
                        color: freshVisitIds.has(p.id) ? "#000" : "#4b4b4b",
                      }}
                    >
                      {freshVisitIds.has(p.id)
                        ? "✓ Visited on this walk"
                        : (p.visit_count ?? 0) > 0
                        ? `Visited ${p.visit_count}× before`
                        : "Not visited yet"}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {polyline.length > 1 && (
              <Polyline positions={polyline} pathOptions={{ color: "#000000", weight: 4, opacity: 0.85 }} />
            )}

            {points
              .filter((_, i) => i % 5 === 0)
              .map((p, i) => (
                <Marker key={"dot-" + i} position={[p.lat, p.lng]} icon={trailDot()} />
              ))}

            {me && (
              <Marker position={[me.lat, me.lng]} icon={meIcon()}>
                <Popup>You are here</Popup>
              </Marker>
            )}

            <FollowMe point={isActive ? me : null} />
            <FitToData
              trail={polyline}
              places={isActive ? [] : placesWithCoords}
              me={me}
              deps={[walk?.id, allPlaces.length, me?.lat == null]}
            />
          </MapContainer>

          {/* Fixed legend overlay (top-right) */}
          <div className="map-legend">
            <div className="legend-row">
              <span className="legend-pin filled" />
              <span>Visited before</span>
            </div>
            <div className="legend-row">
              <span className="legend-pin outlined" />
              <span>Not yet visited</span>
            </div>
            <div className="legend-row">
              <span className="legend-pin check">✓</span>
              <span>Just visited (this walk)</span>
            </div>
          </div>
        </div>

        {/* Bottom sheet — collapsible on mobile, side panel on desktop. */}
        <div className={`walk-sheet ${sheetOpen ? "open" : "collapsed"}`}>
          <button
            className="ghost walk-sheet-toggle"
            onClick={() => setSheetOpen((v) => !v)}
            aria-label={sheetOpen ? "Collapse" : "Expand"}
          >
            {sheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          {!walk && (
            <div className="walk-sheet-section">
              <h3 style={{ marginBottom: 12 }}>Start a walk</h3>
              <div className="muted" style={{ marginBottom: 14 }}>
                We'll track your path and auto-mark every saved place you pass within {radius}m.
              </div>
              <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 2, minWidth: 0 }}>
                  <label>Walk name</label>
                  <input
                    placeholder="Sarojini Sunday loop"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <label>Radius (m)</label>
                  <input
                    type="number"
                    value={radius}
                    min={10}
                    max={200}
                    onChange={(e) => setRadius(Number(e.target.value) || RADIUS_DEFAULT)}
                  />
                </div>
              </div>
              <button onClick={startWalk} disabled={busy} style={{ width: "100%" }}>
                <Play size={16} />
                {busy ? "Starting…" : "Start walk"}
              </button>
              {placesWithCoords.length === 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: 12,
                    marginTop: 12,
                    background: "var(--chip-gray)",
                    borderRadius: "var(--radius-card)",
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div className="muted">
                    No saved places yet — without them there's nothing to auto-mark. Add a few first.
                  </div>
                </div>
              )}
            </div>
          )}

          {walk && (
            <>
              <div className="walk-sheet-section walk-stats">
                <div className="walk-stat">
                  <span className="label">Status</span>
                  <span className="value" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
                    {isActive ? (
                      <>
                        <span className="walk-recording-dot" />
                        Recording
                      </>
                    ) : (
                      <>Ended</>
                    )}
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
                  <button className="danger" onClick={stopWalk} disabled={busy} style={{ width: "100%" }}>
                    <Square size={16} />
                    Stop walk
                  </button>
                </div>
              )}

              <div className="walk-sheet-section walk-visited-list">
                <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, marginBottom: 10 }}>
                  <Footprints size={12} />
                  Visited on this walk
                </div>
                {autoVisits.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    Nothing yet. Walk near a saved shop and we'll mark it
                    instantly when you're within {walk.auto_radius_m}m.
                  </div>
                ) : (
                  <div className="col" style={{ gap: 8 }}>
                    {autoVisits.map((v) => (
                      <div
                        key={v.visit_id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 12px",
                          background: "var(--chip-gray)",
                          borderRadius: "var(--radius-card)",
                        }}
                      >
                        <CheckCircle2 size={16} style={{ marginTop: 2, color: "#000", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{v.place_name}</div>
                          <div className="faint">
                            {v.category ? `${v.category} · ` : ""}
                            {v.distance_m}m from your path
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="walk-sheet-section" style={{ paddingTop: 0 }}>
                <div className="faint" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} />
                  Walk #{walk.id} · started {new Date(walk.started_at).toLocaleTimeString()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
