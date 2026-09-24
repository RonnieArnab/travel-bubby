import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Check } from "lucide-react";
import { api } from "../lib/api.js";
import { hasPin } from "./ReelMap.jsx";

export function PlaceLocationPicker({ draft, kind, onChange, disabled }) {
  const [query, setQuery] = useState(draft.name);
  const [context, setContext] = useState(draft.searchContext || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function search() {
    setBusy(true);
    setError("");
    try {
      const result = await api.searchLocation({
        name: query,
        context,
        kind,
        category: draft.category,
      });
      if (alive.current)
        onChange({ geocoding: result, searchContext: context });
    } catch (err) {
      if (alive.current) setError(err.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const location = draft.geocoding;
  return (
    <section className="location-picker">
      <div className="card-title-row">
        <strong>
          <MapPin size={15} /> Find this place on the map
        </strong>
        {hasPin(draft) && (
          <span className="badge accent">
            <Check size={12} /> Pin ready
          </span>
        )}
      </div>
      <p className="faint">
        {location?.message ||
          "Search by place name and city, then choose the correct match."}
      </p>
      <label htmlFor="lookup-name">Place to search</label>
      <input
        id="lookup-name"
        value={query}
        disabled={disabled || busy}
        onChange={(e) => setQuery(e.target.value)}
      />
      <label htmlFor="lookup-context">City / neighborhood / country</label>
      <input
        id="lookup-context"
        value={context}
        disabled={disabled || busy}
        onChange={(e) => setContext(e.target.value)}
        placeholder="For example, Shibuya, Tokyo"
      />
      <button
        type="button"
        className="secondary sm"
        onClick={search}
        disabled={disabled || busy || !query.trim()}
      >
        <Search size={14} />
        {busy ? "Looking for places…" : "Search locations"}
      </button>
      {error && (
        <p role="alert" className="import-notice">
          {error}
        </p>
      )}
      <div className="location-matches">
        {location?.candidates?.map((candidate) => {
          const chosen =
            draft.osm_url === candidate.osm_url &&
            Number(draft.lat) === candidate.lat &&
            Number(draft.lng) === candidate.lng;
          return (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={chosen}
              disabled={disabled}
              className={`location-match ${chosen ? "selected" : ""}`}
              onClick={() =>
                onChange({
                  lat: candidate.lat,
                  lng: candidate.lng,
                  address: candidate.address,
                  osm_url: candidate.osm_url,
                  geocode_source: "photon",
                })
              }
            >
              <span>
                {chosen ? <Check size={15} /> : <MapPin size={15} />}{" "}
                {candidate.name}
              </span>
              <small>{candidate.address}</small>
              <small>
                {candidate.type?.replaceAll("_", " ")} ·{" "}
                {candidate.lat.toFixed(5)}, {candidate.lng.toFixed(5)}
              </small>
            </button>
          );
        })}
      </div>
      {hasPin(draft) && (
        <button
          type="button"
          className="ghost sm"
          disabled={disabled}
          onClick={() =>
            onChange({ lat: "", lng: "", osm_url: null, geocode_source: null })
          }
        >
          Remove this pin
        </button>
      )}
      <small className="faint">
        Place search by{" "}
        <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">
          Photon
        </a>{" "}
        · ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
      </small>
    </section>
  );
}
