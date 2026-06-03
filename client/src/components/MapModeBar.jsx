import { Map, Sparkles, Footprints, History, Crosshair } from "lucide-react";

export const MAP_MODES = [
  { id: "browse", label: "Browse", icon: Map },
  { id: "plan", label: "Plan", icon: Sparkles },
  { id: "walk", label: "Walk", icon: Footprints },
  { id: "history", label: "History", icon: History },
  { id: "near", label: "Near me", icon: Crosshair },
];

// Pill tab bar — controlled. The parent owns the active mode so switching
// doesn't navigate (modes are sub-views of MapPage, not routes).
export function MapModeBar({ mode, onChange }) {
  return (
    <nav className="map-mode-bar" aria-label="Map modes">
      {MAP_MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={mode === id ? "active" : ""}
          onClick={() => onChange(id)}
          aria-pressed={mode === id}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </nav>
  );
}
