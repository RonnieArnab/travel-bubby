import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

// Renders a leaflet.heat layer over `points` (array of [lat, lng]).
// Reattaches when `points` changes; cleans up on unmount.
export function HeatLayer({ points, options }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    const layer = L.heatLayer(points, {
      radius: 20,
      blur: 22,
      minOpacity: 0.25,
      maxZoom: 18,
      ...options,
    }).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, options]);
  return null;
}
