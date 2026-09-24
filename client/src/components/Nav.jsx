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
  ArrowUpRight,
  Footprints,
} from "lucide-react";
import { api } from "../lib/api.js";
import { setPrefs } from "../lib/prefs.js";
import { usePrefs } from "../lib/usePrefs.js";

const PRIMARY = [
  { to: "/places", label: "Your collections", icon: Bookmark },
  { to: "/map", label: "Explore the map", icon: Map },
  { to: "/groups", label: "Your travel crew", icon: Users },
  { to: "/import", label: "Save a link", icon: Link2 },
  { to: "/add", label: "Add a place", icon: Plus },
];
export function Nav() {
  const [healthy, setHealthy] = useState(null);
  const prefs = usePrefs();
  useEffect(() => {
    let alive = true;
    api
      .health()
      .then(() => alive && setHealthy(true))
      .catch(() => alive && setHealthy(false));
    return () => {
      alive = false;
    };
  }, []);
  const toggleTheme = () =>
    setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" });
  return (
    <>
      <header className="topnav">
        <NavLink to="/" end className="topnav-brand">
          <span className="brand-mark">
            <Compass size={23} />
          </span>
          <span className="brand-text">
            travel<span className="brand-light">buddy</span>
            <b>.</b>
          </span>
        </NavLink>
        <div className="sidebar-intro">A little curiosity goes a long way.</div>
        <div className="sidebar-label">YOUR NEXT CHAPTER</div>
        <nav className="topnav-pills" aria-label="Primary navigation">
          {PRIMARY.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                "pill-link" + (isActive ? " active" : "")
              }
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-inspiration">
            <img src="/assets/kyoto.jpg" alt="Kyoto's traditional streets" />
            <span>
              Good things happen
              <br />
              <em>off the beaten path.</em>
            </span>
            <NavLink to="/map?destination=japan">
              A little inspiration <ArrowUpRight size={14} />
            </NavLink>
          </div>
          <NavLink to="/map?mode=walk" className="sidebar-walk">
            <Footprints size={17} /> Go for a wander <ArrowUpRight size={14} />
          </NavLink>
        </div>
        <div className="topnav-tail">
          <span
            className={`health-pill ${healthy === true ? "ok" : healthy === false ? "warn" : ""}`}
          >
            <span className="dot" />
            <span>
              {healthy === null
                ? "Connecting"
                : healthy
                  ? "Ready to explore"
                  : "Server offline"}
            </span>
          </span>
          <button
            className="ghost icon-only theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${prefs.theme === "dark" ? "light" : "dark"} mode`}
          >
            {prefs.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>
      <nav className="bottomnav" aria-label="Mobile navigation">
        {PRIMARY.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              "tab-link" + (isActive ? " active" : "")
            }
          >
            <Icon size={20} />
            <span>
              {
                {
                  "Your collections": "Saved",
                  "Explore the map": "Map",
                  "Your travel crew": "Crew",
                  "Save a link": "Save link",
                  "Add a place": "Add place",
                }[label]
              }
            </span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
