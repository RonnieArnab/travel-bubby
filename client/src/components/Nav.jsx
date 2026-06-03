import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Map,
  Bookmark,
  Plus,
  Link2,
  Compass,
  Users,
  Sun,
  Moon,
  MoreHorizontal,
  Home,
} from "lucide-react";
import { api } from "../lib/api.js";
import { setPrefs } from "../lib/prefs.js";
import { usePrefs } from "../lib/usePrefs.js";

// Main nav — no map sub-features anymore. Walk / Plan / Walk history / Near me
// all live inside the Map page as tabs (MapModeBar).
const PRIMARY = [
  { to: "/map", label: "Map", icon: Map },
  { to: "/places", label: "Places", icon: Bookmark },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/import", label: "Import", icon: Link2 },
];
const SECONDARY = [
  { to: "/add", label: "Add place", icon: Plus },
];

export function Nav() {
  const [healthy, setHealthy] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const prefs = usePrefs();

  useEffect(() => {
    let alive = true;
    api.health()
      .then(() => alive && setHealthy(true))
      .catch(() => alive && setHealthy(false));
    return () => { alive = false; };
  }, []);

  function toggleTheme() {
    setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" });
  }

  return (
    <>
      <header className="topnav">
        <NavLink to="/" end className="topnav-brand">
          <span className="brand-mark">
            <Compass size={18} strokeWidth={2.5} />
          </span>
          <span className="brand-text">Travel<span className="accent">Buddy</span></span>
        </NavLink>

        <nav className="topnav-pills">
          {PRIMARY.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => "pill-link" + (isActive ? " active" : "")}
            >
              <Icon size={15} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
          {SECONDARY.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => "pill-link" + (isActive ? " active" : "")}
            >
              <Icon size={15} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="topnav-tail">
          <button
            className="ghost icon-only theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${prefs.theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {prefs.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className={`health-pill ${healthy === true ? "ok" : healthy === false ? "warn" : ""}`}>
            <span className="dot" />
            <span>{healthy === null ? "…" : healthy ? "online" : "offline"}</span>
          </span>
        </div>
      </header>

      {/* Bottom tab bar — mobile only. Exactly 5 thumb-reachable slots. */}
      <nav className="bottomnav" aria-label="Primary">
        <NavLink to="/" end className={({ isActive }) => "tab-link" + (isActive ? " active" : "")}>
          <Home size={20} />
          <span>Home</span>
        </NavLink>
        {PRIMARY.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => "tab-link" + (isActive ? " active" : "")}
          >
            <Icon size={20} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          className="tab-link"
          onClick={() => setMoreOpen(true)}
          aria-label="More"
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">More</div>
            <div className="sheet-list">
              {SECONDARY.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className="sheet-row"
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
              <button
                className="sheet-row"
                onClick={() => { toggleTheme(); setMoreOpen(false); }}
              >
                {prefs.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                <span>{prefs.theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
