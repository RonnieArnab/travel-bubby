import { setPrefs } from "../lib/prefs.js";
import { usePrefs } from "../lib/usePrefs.js";

const STYLES = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "satellite", label: "Sat" },
];

export function MapStyleToggle() {
  const { mapStyle } = usePrefs();
  return (
    <div className="map-style-toggle">
      {STYLES.map((s) => (
        <button
          key={s.key}
          className={mapStyle === s.key ? "active" : ""}
          onClick={() => setPrefs({ mapStyle: s.key })}
          aria-pressed={mapStyle === s.key}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
