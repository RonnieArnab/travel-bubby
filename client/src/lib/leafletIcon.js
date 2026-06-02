import L from "leaflet";

const iconBase = "https://unpkg.com/leaflet@1.9.4/dist/images";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${iconBase}/marker-icon-2x.png`,
  iconUrl: `${iconBase}/marker-icon.png`,
  shadowUrl: `${iconBase}/marker-shadow.png`,
});

// Black-and-white teardrop. visited = solid black; unvisited = white with a
// thick black ring; warn = filled red. No gradients. Drop shadow is a soft
// rgba(0,0,0,0.2) — within the Uber whisper-shadow range.
export function modernPin(kind = "unvisited") {
  const styles = {
    visited: { fill: "#000000", stroke: "#000000", inner: "#ffffff" },
    unvisited: { fill: "#ffffff", stroke: "#000000", inner: "#000000" },
    warn: { fill: "#c1121f", stroke: "#c1121f", inner: "#ffffff" },
    me: { fill: "#000000", stroke: "#000000", inner: "#ffffff" },
  };
  const { fill, stroke, inner } = styles[kind] ?? styles.unvisited;
  const html = `
    <div style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
      <svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.72 0 0 6.72 0 15c0 10.5 15 23 15 23s15-12.5 15-23C30 6.72 23.28 0 15 0z"
              fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <circle cx="15" cy="14" r="5" fill="${inner}"/>
      </svg>
    </div>`;
  return L.divIcon({
    className: "tb-marker",
    html,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
  });
}

// Pin for a place that was *just* auto-visited on the current walk. Black
// teardrop with a bold white check, plus a soft outer ring so it stands out
// from places that were visited on previous outings.
export function checkPin() {
  const html = `
    <div style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));">
      <svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.61 0 0 7.61 0 17c0 12 17 25 17 25s17-13 17-25C34 7.61 26.39 0 17 0z"
              fill="#000000" stroke="#ffffff" stroke-width="2.5"/>
        <path d="M11 17 L15 21 L23 12"
              fill="none" stroke="#ffffff" stroke-width="2.8"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;
  return L.divIcon({
    className: "tb-marker",
    html,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
  });
}

// "You are here" — pulsing black dot.
export function meIcon() {
  const html = `
    <div style="position: relative; width: 22px; height: 22px;">
      <div style="
        position: absolute; inset: 0;
        background: rgba(0, 0, 0, 0.18);
        border-radius: 50%;
        animation: tb-pulse 1.6s ease-out infinite;
      "></div>
      <div style="
        position: absolute; inset: 5px;
        background: #000000;
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
      "></div>
    </div>
    <style>
      @keyframes tb-pulse {
        0% { transform: scale(0.6); opacity: 0.9; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    </style>`;
  return L.divIcon({
    className: "tb-marker",
    html,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// Walk-trail breadcrumbs are tiny dots, used along the polyline to mark recent
// GPS samples. Kept minimal so they don't clutter the path.
export function trailDot() {
  const html = `<div style="
    width: 6px; height: 6px; border-radius: 50%;
    background: #000000; border: 1.5px solid #ffffff;
    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
  "></div>`;
  return L.divIcon({
    className: "tb-marker",
    html,
    iconSize: [9, 9],
    iconAnchor: [4.5, 4.5],
  });
}

// Light, near-monochrome map tile layer (CARTO Positron).
export const LIGHT_TILE = {
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
};

export const DARK_TILE = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
};

export const SATELLITE_TILE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
  subdomains: "",
};

export function tileForStyle(style) {
  if (style === "dark") return DARK_TILE;
  if (style === "satellite") return SATELLITE_TILE;
  return LIGHT_TILE;
}
