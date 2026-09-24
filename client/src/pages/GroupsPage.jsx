import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Plus, LogIn, Calendar } from "lucide-react";
import { api } from "../lib/api.js";
import { usePrefs } from "../lib/usePrefs.js";
import {
  setPrefs,
  rememberJoinedGroup,
  forgetJoinedGroup,
} from "../lib/prefs.js";
import { Toast } from "../components/Toast.jsx";
import { GroupsEmpty } from "../components/illustrations.jsx";

// Lists groups the user has joined (tracked client-side in localStorage)
// + the create / join flows.

export function GroupsPage() {
  const prefs = usePrefs();
  const [createName, setCreateName] = useState("");
  const [yourName, setYourName] = useState(prefs.displayName || "");
  const [joinToken, setJoinToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const nav = useNavigate();

  async function create(e) {
    e.preventDefault();
    if (!createName.trim()) return;
    if (!yourName.trim()) {
      setToast({ kind: "warn", title: "Add your display name first" });
      return;
    }
    setBusy(true);
    try {
      const g = await api.createGroup({
        name: createName.trim(),
        creator_name: yourName.trim(),
      });
      setPrefs({ displayName: yourName.trim() });
      rememberJoinedGroup({
        token: g.share_token,
        name: yourName.trim(),
        group_name: g.name,
      });
      nav(`/groups/${g.share_token}`);
    } catch (err) {
      setToast({ kind: "warn", title: "Create failed", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function join(e) {
    e.preventDefault();
    if (!joinToken.trim() || !yourName.trim()) {
      setToast({ kind: "warn", title: "Need a group code and your name" });
      return;
    }
    setBusy(true);
    try {
      // Token may have been pasted as a full URL.
      const m = joinToken.trim().match(/groups\/([\w-]+)$/);
      const token = m ? m[1] : joinToken.trim();
      const g = await api.joinGroup(token, yourName.trim());
      setPrefs({ displayName: yourName.trim() });
      rememberJoinedGroup({ token, name: yourName.trim(), group_name: g.name });
      nav(`/groups/${token}`);
    } catch (err) {
      setToast({ kind: "warn", title: "Join failed", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">GOOD PLACES. BETTER COMPANY.</div>
          <h1>
            Your kind of <em>travel crew.</em>
          </h1>
          <p className="subtitle">
            Everyone’s wish list. One shared adventure. Bring your people and
            start a trip together.
          </p>
        </div>
      </div>

      <div className="crew-banner">
        <div>
          <span className="section-kicker">TAKE THE GROUP CHAT SOMEWHERE</span>
          <h2>
            The best souvenir?
            <br />
            <em>A story you share.</em>
          </h2>
          <p>Plan trips, collect places, and leave notes for your crew.</p>
        </div>
        <img src="/assets/bali.jpg" alt="A Balinese temple beside a lake" />
      </div>
      <div className="group-forms">
        <form className="card col" onSubmit={create}>
          <h3>Start a travel crew</h3>
          <div>
            <label htmlFor="crew-name">Group name</label>
            <input
              id="crew-name"
              placeholder="Lisbon planning, Family India trip…"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="crew-display-name">Your display name</label>
            <input
              id="crew-display-name"
              placeholder="What others will see"
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
            />
          </div>
          <button disabled={busy || !createName.trim() || !yourName.trim()}>
            <Plus size={14} />
            Create your crew
          </button>
        </form>

        <form className="card col" onSubmit={join}>
          <h3>Already have an invite?</h3>
          <div>
            <label htmlFor="crew-invite">Group code or share link</label>
            <input
              id="crew-invite"
              placeholder="abc123 or https://…/groups/abc123"
              value={joinToken}
              onChange={(e) => setJoinToken(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="join-display-name">Your display name</label>
            <input
              id="join-display-name"
              placeholder="What others will see"
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
            />
          </div>
          <button
            className="secondary"
            disabled={busy || !joinToken.trim() || !yourName.trim()}
          >
            <LogIn size={14} />
            Join
          </button>
        </form>
      </div>

      <div className="section-label" style={{ marginBottom: 8 }}>
        Your travel crews
      </div>
      {prefs.joinedGroups.length === 0 ? (
        <div className="empty">
          <GroupsEmpty />
          <h3>You haven't joined any groups</h3>
          <p>
            Create one above to start planning a trip with friends, or paste a
            code to join an existing one.
          </p>
        </div>
      ) : (
        <div className="grid">
          {prefs.joinedGroups.map((g) => (
            <Link
              key={g.token}
              to={`/groups/${g.token}`}
              className="card hover"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="card-title-row">
                <h3>{g.group_name || "Group"}</h3>
                <Users size={16} />
              </div>
              <div
                className="muted"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Calendar size={12} />
                Joined {new Date(g.joinedAt).toLocaleDateString()}
              </div>
              <div className="faint" style={{ marginTop: 6 }}>
                You: {g.name}
              </div>
              <div className="divider" />
              <button
                className="ghost sm"
                onClick={(e) => {
                  e.preventDefault();
                  forgetJoinedGroup(g.token);
                }}
              >
                Remove from list
              </button>
            </Link>
          ))}
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
