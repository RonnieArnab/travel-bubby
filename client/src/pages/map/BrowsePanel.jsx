import { useMemo, useState } from "react";
import { Search, MapPin, CheckCircle2, Circle, Flame } from "lucide-react";
import { MapEmpty } from "../../components/illustrations.jsx";

// Browse mode panel — list of all saved places, filter, click to focus.
// Heat toggle exposed here so it lives with the History/Walk-data tools.
export function BrowsePanel({ places, focused, onFocus, showHeat, onToggleHeat }) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return places;
    return places.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
    );
  }, [places, filter]);

  return (
    <>
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="font-display" style={{ fontSize: 22 }}>
              {places.length} place{places.length === 1 ? "" : "s"}
            </div>
            <div className="muted" style={{ marginTop: 2 }}>
              {places.filter((p) => p.visit_count > 0).length} visited · {places.filter((p) => !p.visit_count).length} new
            </div>
          </div>
          <button
            className={showHeat ? "sm" : "secondary sm"}
            onClick={onToggleHeat}
            title="Toggle walk heatmap"
          >
            <Flame size={14} />
            {showHeat ? "Heat on" : "Heat"}
          </button>
        </div>
        <div className="panel-search">
          <Search size={14} />
          <input
            placeholder="Search places…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="panel-list">
        {visible.length === 0 && (
          <div className="empty" style={{ padding: 24 }}>
            <MapEmpty />
            <h3>No places{filter ? " match" : " yet"}</h3>
            <p>{filter ? "Try a different search." : "Tap the + or import a link to add one."}</p>
          </div>
        )}
        {visible.map((p) => {
          const visited = (p.visit_count ?? 0) > 0;
          return (
            <div
              key={p.id}
              className={"map-panel-item" + (focused?.id === p.id ? " active" : "")}
              onClick={() => onFocus(p)}
            >
              <div className={`pin ${visited ? "visited" : "unvisited"}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </div>
                <div className="meta">
                  {p.category && <span>{p.category}</span>}
                  {p.category && <span>·</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {visited ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    {visited ? `${p.visit_count}×` : "new"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
