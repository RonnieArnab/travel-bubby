import { Link } from "react-router-dom";
import {
  Map,
  Footprints,
  Sparkles,
  Users,
  Bell,
  WifiOff,
  Link2,
  Compass,
  ArrowRight,
  Crosshair,
  Route,
} from "lucide-react";

// Public landing page at "/". Marketing-ish: hero, features, how-it-works,
// CTA band, footer. No data fetching — fully static.

const FEATURES = [
  {
    icon: Map,
    title: "One smart map",
    body: "Every place you've saved, pinned on a clean map. Visited spots fill in, unvisited stand out. Browse, plan, walk — all in one view.",
  },
  {
    icon: Footprints,
    title: "Walk tracker",
    body: "Drop into a market, hit Start, and we record your path. Every saved shop you pass within range auto-marks itself visited — so you never loop back to the same stall.",
  },
  {
    icon: Sparkles,
    title: "Import any link",
    body: "Paste an Instagram reel, YouTube short, or Google Maps URL. AI reads the caption and thumbnail, then writes a clean point-wise summary you can save and act on.",
  },
  {
    icon: Route,
    title: "Smart routes",
    body: "Standing somewhere new? We compute the shortest walking order through your nearest unvisited places. Drag to reorder, then start walking it.",
  },
  {
    icon: Users,
    title: "Trips with friends",
    body: "Create a shared group. Invite anyone with a link. Co-plan trips, add places, write guides for each other. Like a Google Doc for travel.",
  },
  {
    icon: Bell,
    title: "Geofence alerts",
    body: "Get a phone notification when you walk within range of a saved spot you've never visited. The reel you saved months ago surfaces at exactly the right moment.",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    body: "Map tiles cache for your area, walks record locally, and points auto-sync when you're back online. Designed for travel where signal is bad.",
  },
  {
    icon: Crosshair,
    title: "Have I been here?",
    body: "GPS-checks the spot you're standing in against everything you've saved. Warns you if it's a repeat so you can skip and try the next stall.",
  },
];

const STEPS = [
  {
    title: "Save places",
    body: "Add manually, drop a pin, or paste any reel / Maps link. AI fills in name, category, notes.",
  },
  {
    title: "Plan or walk",
    body: "Use Plan for an optimised route, or Walk to start tracking. Geofence pings you if you're near unvisited spots.",
  },
  {
    title: "Never re-visit",
    body: "Visited shops auto-mark as you pass. Replay any walk later to see exactly where you went.",
  },
];

export function LandingPage() {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <div>
          <span className="landing-eyebrow">
            <Sparkles size={14} />
            AI-powered travel companion
          </span>
          <h1>
            Travel without <br />
            <span className="gradient-text">revisiting the same shop</span>
          </h1>
          <p className="lede">
            Travel Buddy tracks where you've actually been, plans the shortest
            walking route through where you haven't, and reads your saved reels
            for you. Built for wandering markets, hopping cafes, and trips with
            friends.
          </p>
          <div className="landing-cta">
            <Link to="/map">
              <button className="accent">
                Open the map
                <ArrowRight size={16} />
              </button>
            </Link>
            <Link to="/import">
              <button className="secondary">
                <Link2 size={16} />
                Import a reel
              </button>
            </Link>
          </div>
        </div>

        <div className="hero-visual" aria-hidden>
          <svg viewBox="0 0 380 280" width="100%" height="auto">
            <defs>
              <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--bg-tint)" />
                <stop offset="100%" stopColor="var(--bg-muted)" />
              </linearGradient>
              <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-2)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="380" height="280" rx="12" fill="url(#bg)" />

            {/* Roads */}
            <path d="M0 80 L380 60" stroke="var(--line)" strokeWidth="3" fill="none" />
            <path d="M0 150 L380 170" stroke="var(--line)" strokeWidth="3" fill="none" />
            <path d="M0 220 L380 210" stroke="var(--line)" strokeWidth="3" fill="none" />
            <path d="M80 0 L100 280" stroke="var(--line)" strokeWidth="3" fill="none" />
            <path d="M200 0 L210 280" stroke="var(--line)" strokeWidth="3" fill="none" />
            <path d="M300 0 L290 280" stroke="var(--line)" strokeWidth="3" fill="none" />

            {/* Walk trail */}
            <path
              d="M50 230 C80 200, 120 200, 150 170 C180 140, 220 140, 240 110 C260 80, 290 80, 330 60"
              stroke="url(#trail)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="2 8"
            />

            {/* Visited pins (filled) */}
            <g>
              <circle cx="50" cy="230" r="9" fill="var(--ink)" />
              <circle cx="50" cy="230" r="4" fill="#fff" />
            </g>
            <g>
              <circle cx="150" cy="170" r="9" fill="var(--ink)" />
              <circle cx="150" cy="170" r="4" fill="#fff" />
            </g>

            {/* Just visited (checkmark pin) */}
            <g>
              <circle cx="240" cy="110" r="11" fill="var(--accent)" />
              <path d="M234 110 L238 114 L246 105" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* Unvisited (outlined) */}
            <g>
              <circle cx="330" cy="60" r="9" fill="var(--bg-elev)" stroke="var(--accent)" strokeWidth="2.5" />
            </g>

            {/* You-are-here pulse */}
            <g>
              <circle cx="240" cy="110" r="22" fill="var(--accent)" opacity="0.16">
                <animate attributeName="r" from="14" to="30" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.3" to="0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="feature-section">
        <h2>Everything you need on the road</h2>
        <p className="section-lede">
          A travel companion that actually remembers where you've been and
          knows where to go next.
        </p>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="feature-card">
              <div className="feature-icon"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="steps-section">
        <div className="steps-inner">
          <h2 style={{ textAlign: "center", fontFamily: "Space Grotesk, Inter, sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
            Three steps to a smarter trip
          </h2>
          <p className="section-lede" style={{ marginBottom: 36 }}>
            No accounts, no setup. Open it, save a few places, hit walk.
          </p>
          <div className="steps-grid">
            {STEPS.map((s, i) => (
              <div key={s.title} className="step">
                <span className="step-number">{i + 1}</span>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="landing-cta-band">
        <h2>Open the map and start saving</h2>
        <p>
          No sign-up. Your data stays on the server you control. Add to your
          home screen on iPhone to use it like a native app.
        </p>
        <Link to="/map">
          <button>
            Open Travel Buddy
            <ArrowRight size={16} />
          </button>
        </Link>
      </section>

      <footer className="landing-footer">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Compass size={14} />
          Travel Buddy · made for wanderers
        </div>
      </footer>
    </div>
  );
}
