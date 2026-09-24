import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  CheckCircle2,
  Circle,
  Flame,
  Plus,
  ArrowUpRight,
  MapPin,
} from "lucide-react";
import { PlaceImage } from "../../components/PlaceImage.jsx";

export function BrowsePanel({
  places,
  focused,
  onFocus,
  showHeat,
  onToggleHeat,
  destination,
  loading,
  error,
}) {
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("all");
  const visible = useMemo(
    () =>
      places.filter(
        (p) =>
          `${p.name} ${p.category || ""} ${p.address || ""}`
            .toLowerCase()
            .includes(filter.trim().toLowerCase()) &&
          (status === "all" ||
            (status === "visited" ? p.visit_count > 0 : !p.visit_count)),
      ),
    [places, filter, status],
  );
  return (
    <>
      <div className="panel-head">
        <div className="panel-eyebrow">
          {destination
            ? "A LITTLE DESTINATION INSPIRATION"
            : "YOUR WORLD, ONE PIN AT A TIME"}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              className="font-display"
              style={{ fontSize: 24, fontWeight: 500 }}
            >
              {destination ? `Hello, ${destination.name}.` : "Places to go"}
            </div>
            <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
              {places.length} {places.length === 1 ? "place" : "places"} ·{" "}
              {places.filter((p) => p.visit_count > 0).length} visited
            </div>
          </div>
          {!destination && (
            <button
              className={showHeat ? "sm" : "secondary sm"}
              onClick={onToggleHeat}
              aria-pressed={showHeat}
              title="Toggle walk heatmap"
            >
              <Flame size={14} /> Heat
            </button>
          )}
        </div>
        <div className="panel-search">
          <Search size={14} />
          <input
            aria-label="Search map places"
            placeholder="A place, a craving, a little adventure…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {!destination && (
          <div className="filter-tabs" style={{ marginTop: 12 }}>
            {[
              ["all", "All places"],
              ["unvisited", "Want to go"],
              ["visited", "Been there"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={status === id ? "selected" : ""}
                aria-pressed={status === id}
                onClick={() => setStatus(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="panel-list">
        {loading && !destination && (
          <p className="muted" style={{ padding: 20 }}>
            Finding your saved places…
          </p>
        )}
        {error && !destination && (
          <p role="alert" className="muted" style={{ padding: 20 }}>
            Your places couldn’t be loaded. Check your connection and try again.
          </p>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="empty" style={{ padding: "26px 20px" }}>
            <MapPin
              size={30}
              style={{ color: "var(--accent)", marginBottom: 8 }}
            />
            <h3 style={{ fontSize: 18 }}>
              {places.length
                ? "Nothing here just yet"
                : "Every adventure starts somewhere."}
            </h3>
            <p style={{ fontSize: 11 }}>
              {places.length
                ? "Try another search or filter."
                : "Save a reel or add a place to start putting your world on the map."}
            </p>
            {!places.length && (
              <Link to="/map?destination=japan" className="action-link">
                Take a peek at Kyoto <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        )}
        {visible.map((p) => (
          <button
            key={p.id}
            className={`map-panel-item${focused?.id === p.id ? " active" : ""}`}
            onClick={() => onFocus(p)}
            aria-pressed={focused?.id === p.id}
          >
            <PlaceImage place={p} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name">{p.name}</div>
              <div className="meta">
                <span>{p.category || "Saved place"}</span>
                <span>·</span>
                {p.visit_count > 0 ? (
                  <CheckCircle2 size={11} />
                ) : (
                  <Circle size={11} />
                )}
                <span>{p.visit_count > 0 ? "Visited" : "To explore"}</span>
              </div>
              <div className="map-item-address">
                {p.address || "Location pinned"}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="map-panel-footer">
        <span>
          {destination
            ? "Real places. Your next chapter."
            : "A little less scrolling, a little more going."}
        </span>
        <Link to="/import" aria-label="Save a new link">
          <Plus size={14} /> Save
        </Link>
      </div>
    </>
  );
}
