import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Footprints } from "lucide-react";
import { usePlaces } from "../lib/usePlaces.js";
import { modernPin, meIcon, checkPin, trailDot, tileForStyle } from "../lib/leafletIcon.js";
import { api } from "../lib/api.js";
import { usePrefs } from "../lib/usePrefs.js";
import { HeatLayer } from "../components/HeatLayer.jsx";
import { MapStyleToggle } from "../components/MapStyleToggle.jsx";
import { MapModeBar } from "../components/MapModeBar.jsx";
import { Toast } from "../components/Toast.jsx";
import { BrowsePanel } from "./map/BrowsePanel.jsx";
import { PlanPanel } from "./map/PlanPanel.jsx";
import { WalkPanel } from "./map/WalkPanel.jsx";
import { HistoryPanel } from "./map/HistoryPanel.jsx";
import { NearMePanel } from "./map/NearMePanel.jsx";
import { enqueueWalkPoint, drainQueue, queueSize } from "../lib/offlineQueue.js";
import { ensureNotificationPermission, startGeofence } from "../lib/geofence.js";

const VALID_MODES = new Set(["browse", "plan", "walk", "history", "near"]);

function FitBounds({ points, focusId, deps }) {
  const map = useMap();
  useEffect(() => {
    if (focusId) return;
    if (!points?.length) return;
    map.fitBounds(points, { padding: [80, 80], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.8 });
  }, [target, map]);
  return null;
}

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

// Unified Map page. Single MapContainer at the top; the side panel and
// the conditional map layers swap based on `mode`. Walk-tracker state is
// hoisted here so it survives tab switches.
export function MapPage() {
  const { places, refresh } = usePlaces();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialMode = params.get("mode");
  const [mode, setMode] = useState(VALID_MODES.has(initialMode) ? initialMode : "browse");
  const [me, setMe] = useState(null);
  const [focused, setFocused] = useState(null);
  const [showHeat, setShowHeat] = useState(false);
  const [heatPoints, setHeatPoints] = useState([]);
  const [toast, setToast] = useState(null);
  const [planRoute, setPlanRoute] = useState(null); // { start, stops }
  const markerRefs = useRef({});
  const { mapStyle } = usePrefs();
  const tile = tileForStyle(mapStyle);

  // ─── Walk-tracker state (hoisted so it survives mode switches) ───
  const [walk, setWalk] = useState(null);
  const [walkPoints, setWalkPoints] = useState([]);
  const [autoVisits, setAutoVisits] = useState([]);
  const [walkName, setWalkName] = useState("");
  const [walkRadius, setWalkRadius] = useState(30);
  const [walkBusy, setWalkBusy] = useState(false);
  const [geofenceOn, setGeofenceOn] = useState(false);
  const [now, setNow] = useState(Date.now());
  const watchIdRef = useRef(null);
  const stopGeofenceRef = useRef(null);
  const placesRef = useRef([]);
  placesRef.current = places;

  // Keep ?mode= in URL in sync with state so the tab is sharable.
  useEffect(() => {
    const cur = params.get("mode");
    if (cur !== mode) setParams({ mode }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (showHeat && !heatPoints.length) {
      api.heatmapPoints().then((d) => setHeatPoints(d.map((p) => [p.lat, p.lng]))).catch(() => {});
    }
  }, [showHeat, heatPoints.length]);

  // Walk ticker
  useEffect(() => {
    if (!walk || walk.ended_at) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [walk]);

  const mapped = useMemo(() => places.filter((p) => p.lat != null && p.lng != null), [places]);
  const center = mapped[0] ? [mapped[0].lat, mapped[0].lng] : me ? [me.lat, me.lng] : [20.5937, 78.9629];

  const freshVisitIds = useMemo(() => new Set(autoVisits.map((v) => v.place_id)), [autoVisits]);
  const totalMeters = useMemo(() => {
    let d = 0;
    for (let i = 1; i < walkPoints.length; i++) d += distanceMeters(walkPoints[i - 1], walkPoints[i]);
    return d;
  }, [walkPoints]);
  const elapsed = walk ? (walk.ended_at ?? now) - walk.started_at : 0;

  function focusPlace(p) {
    setFocused({ lat: p.lat, lng: p.lng, id: p.id });
    const marker = markerRefs.current[p.id];
    if (marker) setTimeout(() => marker.openPopup(), 400);
  }

  async function logVisit(p) {
    await api.logVisit(p.id, "From map");
    await refresh();
  }

  // ─── Walk start/stop (hoisted) ───
  const startWalk = useCallback(async () => {
    setWalkBusy(true);
    try {
      const w = await api.startWalk({ name: walkName.trim() || null, radius: walkRadius });
      setWalk(w);
      setWalkPoints([]);
      setAutoVisits([]);
      if (!navigator.geolocation) {
        setToast({ kind: "warn", title: "Geolocation unavailable" });
        return;
      }
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setMe(c);
          setWalkPoints((prev) => [...prev, c]);
          try {
            const result = await api.appendWalkPoint(w.id, c);
            if (result.auto_visits?.length) {
              setAutoVisits((prev) => [...prev, ...result.auto_visits]);
              setToast({
                kind: "ok",
                title: `Visited ${result.auto_visits[0].place_name}`,
                body: result.auto_visits.length > 1 ? `+${result.auto_visits.length - 1} more nearby` : `~${result.auto_visits[0].distance_m}m from your path`,
              });
              refresh();
            }
          } catch {
            await enqueueWalkPoint(w.id, c);
          }
        },
        (err) => setToast({ kind: "warn", title: "GPS error", body: err.message }),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
      watchIdRef.current = id;
    } catch (err) {
      setToast({ kind: "warn", title: "Could not start", body: err.message });
    } finally { setWalkBusy(false); }
  }, [walkName, walkRadius, refresh]);

  const stopWalk = useCallback(async () => {
    if (!walk) return;
    setWalkBusy(true);
    try {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      await drainQueue().catch(() => {});
      const finished = await api.endWalk(walk.id);
      setWalk(finished);
      setToast({ kind: "ok", title: "Walk ended", body: `${autoVisits.length} place(s) marked visited.` });
    } catch (err) {
      setToast({ kind: "warn", title: "Stop failed", body: err.message });
    } finally { setWalkBusy(false); }
  }, [walk, autoVisits.length]);

  const toggleGeofence = useCallback(async () => {
    if (geofenceOn) {
      stopGeofenceRef.current?.();
      stopGeofenceRef.current = null;
      setGeofenceOn(false);
      return;
    }
    const perm = await ensureNotificationPermission();
    if (perm !== "granted") {
      setToast({ kind: "warn", title: "Notifications blocked", body: "Allow notifications in your browser to enable geofence alerts." });
      return;
    }
    stopGeofenceRef.current = startGeofence(() => placesRef.current, {
      radius_m: 120,
      onAlert: (place, d) => setToast({ kind: "ok", title: `Nearby unvisited: ${place.name}`, body: `~${Math.round(d)}m away` }),
    });
    setGeofenceOn(true);
  }, [geofenceOn]);

  useEffect(() => () => {
    if (watchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
    stopGeofenceRef.current?.();
  }, []);

  // ─── Pin chooser per mode ───
  function pinForPlace(p) {
    if (mode === "walk" && freshVisitIds.has(p.id)) return checkPin();
    if ((p.visit_count ?? 0) > 0) return modernPin("visited");
    return modernPin("unvisited");
  }

  // ─── Plan polyline ───
  const planPolyline = useMemo(() => {
    if (mode !== "plan" || !planRoute?.stops?.length) return [];
    return [
      [planRoute.start.lat, planRoute.start.lng],
      ...planRoute.stops.map((p) => [p.lat, p.lng]),
    ];
  }, [mode, planRoute]);

  const walkPolyline = useMemo(() => walkPoints.map((p) => [p.lat, p.lng]), [walkPoints]);

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

        {mapped.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinForPlace(p)}
            ref={(ref) => { if (ref) markerRefs.current[p.id] = ref; }}
          >
            <Popup>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{p.name}</div>
                {p.category && <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>{p.category}</div>}
                {p.address && <div style={{ fontSize: 13, marginBottom: 8 }}>{p.address}</div>}
                <div style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
                  {(p.visit_count ?? 0) > 0 ? `Visited ${p.visit_count}×` : "Not visited yet"}
                </div>
                <button className="sm" onClick={() => logVisit(p)}>Log a visit</button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Plan polyline (dashed) */}
        {planPolyline.length > 1 && (
          <Polyline positions={planPolyline} pathOptions={{ color: "var(--accent)", weight: 3, opacity: 0.85, dashArray: "6 8" }} />
        )}

        {/* Walk trail (solid) + breadcrumbs */}
        {walkPolyline.length > 1 && (
          <Polyline positions={walkPolyline} pathOptions={{ color: "var(--ink)", weight: 4, opacity: 0.85 }} />
        )}
        {mode === "walk" && walkPoints.filter((_, i) => i % 5 === 0).map((p, i) => (
          <Marker key={"dot-" + i} position={[p.lat, p.lng]} icon={trailDot()} />
        ))}

        <FitBounds points={mapped.map((p) => [p.lat, p.lng])} focusId={focused?.id} deps={[mode]} />
        <FlyTo target={focused} />
      </MapContainer>

      <MapStyleToggle />

      {/* Mode bar — floats top-center */}
      <div style={{
        position: "absolute",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 600,
        maxWidth: "calc(100% - 200px)",
      }}>
        <MapModeBar mode={mode} onChange={setMode} />
      </div>

      {/* Side panel — content swaps per mode, shell stays */}
      <div className="map-panel">
        {mode === "browse" && (
          <BrowsePanel
            places={mapped}
            focused={focused}
            onFocus={focusPlace}
            showHeat={showHeat}
            onToggleHeat={() => setShowHeat((v) => !v)}
          />
        )}
        {mode === "plan" && (
          <PlanPanel
            me={me}
            onRouteChange={setPlanRoute}
            onToast={setToast}
            onSwitchToWalk={() => setMode("walk")}
          />
        )}
        {mode === "walk" && (
          <WalkPanel
            walk={walk}
            points={walkPoints}
            totalMeters={totalMeters}
            autoVisits={autoVisits}
            elapsed={elapsed}
            name={walkName}
            radius={walkRadius}
            busy={walkBusy}
            geofenceOn={geofenceOn}
            hasPlaces={mapped.length > 0}
            onChangeName={setWalkName}
            onChangeRadius={setWalkRadius}
            onStart={startWalk}
            onStop={stopWalk}
            onToggleGeofence={toggleGeofence}
          />
        )}
        {mode === "history" && (
          <HistoryPanel onSelectWalk={(id) => nav(`/walks/${id}/replay`)} />
        )}
        {mode === "near" && (
          <NearMePanel onToast={setToast} onPlacesChanged={refresh} />
        )}
      </div>

      {/* FAB */}
      <div className="fab-stack">
        {mode !== "walk" && (
          <button className="fab" onClick={() => setMode("walk")} title="Start a walk">
            <Footprints size={18} />
            <span>Walk</span>
          </button>
        )}
        <button className="fab icon-only accent" onClick={() => nav("/add")} title="Add a place" aria-label="Add a place">
          <Plus size={20} />
        </button>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
