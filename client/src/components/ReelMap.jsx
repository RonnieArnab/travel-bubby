import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { modernPin, LIGHT_TILE } from "../lib/leafletIcon.js";

export const hasPin = (place) =>
  place.lat !== "" &&
  place.lng !== "" &&
  place.lat != null &&
  place.lng != null &&
  Number.isFinite(Number(place.lat)) &&
  Number.isFinite(Number(place.lng));
function Fit({ coordinates }) {
  const map = useMap();
  const key = JSON.stringify(coordinates);
  useEffect(() => {
    const points = JSON.parse(key);
    if (points.length)
      map.fitBounds(points, { padding: [35, 35], maxZoom: 16 });
    map.invalidateSize();
  }, [map, key]);
  return null;
}
export function ReelMap({ places, selected, onSelect }) {
  const pinned = places.map((p, index) => ({ ...p, index })).filter(hasPin);
  if (!pinned.length)
    return (
      <div className="reel-map-empty">
        <strong>Your reel’s map starts here</strong>
        <p>
          Find or choose a location below. Every matched place will appear
          together on this map.
        </p>
      </div>
    );
  return (
    <div className="reel-map" aria-label="Map of places mentioned in this reel">
      <MapContainer
        center={[Number(pinned[0].lat), Number(pinned[0].lng)]}
        zoom={14}
        scrollWheelZoom={false}
      >
        <TileLayer {...LIGHT_TILE} />
        <Fit coordinates={pinned.map((p) => [Number(p.lat), Number(p.lng)])} />
        {pinned.map((p) => (
          <Marker
            key={p.index}
            position={[Number(p.lat), Number(p.lng)]}
            icon={modernPin(p.index === selected ? "visited" : "unvisited")}
            eventHandlers={{ click: () => onSelect?.(p.index) }}
          >
            <Popup>
              <strong>{p.name}</strong>
              <p>{p.address}</p>
              {p.image_url && (
                <img
                  className="reel-popup-image"
                  src={p.image_url}
                  alt="Source video cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
