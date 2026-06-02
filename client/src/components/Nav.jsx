import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Map,
  Bookmark,
  Plus,
  Link2,
  Crosshair,
  Compass,
  Footprints,
  Sparkles,
  History,
  Users,
  Sun,
  Moon,
  MoreHorizontal,
} from "lucide-react";
import { api } from "../lib/api.js";
import { setPrefs } from "../lib/prefs.js";
import { usePrefs } from "../lib/usePrefs.js";

// Order matters: the first 5 are pinned to the bottom-tab bar on mobile.
// The rest live in the "More" sheet on mobile and inline on desktop top nav.
const PRIMARY = [
  { to: "/", end: true, label: "Map", icon: Map },
  { to: "/walk", label: "Walk", icon: Footprints },
  { to: "/plan", label: "Plan", icon: Sparkles },
  { to: "/places", label: "Places", icon: Bookmark },
  { to: "/groups", label: "Groups", icon: Users },
];
const SECONDARY = [
  { to: "/walks", label: "Walk history", icon: History },
  { to: "/here", label: "Have I been here?", icon: Crosshair },
  { to: "/add", label: "Add place", icon: Plus },
  { to: "/import", label: "Import link", icon: Link2 },
];
const ALL = [...PRIMARY, ...SECONDARY];

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
      {/* Top nav — visible on desktop, slides up on mobile (replaced by bottom tabs). */}
      <header className="topnav">
        <NavLink to="/" end className="topnav-brand">
          <span className="brand-mark">
            <Compass size={18} strokeWidth={2.5} />
          </span>
          <span className="brand-text">Travel<span className="accent">Buddy</span></span>
        </NavLink>

        <nav className="topnav-pills">
          {ALL.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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

      {/* Bottom tab bar — visible only on mobile. */}
      <nav className="bottomnav" aria-label="Primary">
        {PRIMARY.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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

      {/* "More" sheet — secondary nav links + theme toggle on mobile. */}
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
                className="sheet-row sheet-row-button"
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
