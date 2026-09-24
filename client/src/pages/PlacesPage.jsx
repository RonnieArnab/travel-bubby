import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Trash2,
  MapPin,
  Bookmark,
  ExternalLink,
  Search,
  Plus,
  Globe2,
  Footprints,
  Link2,
} from "lucide-react";
import { usePlaces } from "../lib/usePlaces.js";
import { api } from "../lib/api.js";
import { Toast } from "../components/Toast.jsx";
import { PlaceImage } from "../components/PlaceImage.jsx";
import { DESTINATIONS, destinationFor } from "../lib/destinations.js";
import { usePrefs } from "../lib/usePrefs.js";
import { SavedLocationDialog } from "../components/SavedLocationDialog.jsx";

export function PlacesPage() {
  const { places, loading, error, refresh } = usePlaces();
  const [filter, setFilter] = useState("all");
  const [destination, setDestination] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [locating, setLocating] = useState(null);
  const prefs = usePrefs();
  const visited = places.filter((p) => p.visit_count > 0).length;
  const reelCollections = useMemo(() => {
    const groups = new Map();
    for (const place of places) {
      if (!place.collection_id) continue;
      if (!groups.has(place.collection_id))
        groups.set(place.collection_id, {
          id: place.collection_id,
          name: place.collection_name,
          places: [],
        });
      groups.get(place.collection_id).places.push(place);
    }
    return [...groups.values()];
  }, [places]);
  const collections = useMemo(() => {
    const grouped = new Map();
    for (const p of places) {
      const d = destinationFor(p);
      const key = d?.id || "other";
      if (!grouped.has(key))
        grouped.set(key, {
          id: key,
          name: d?.name || "Other places",
          image: d?.image,
          count: 0,
        });
      grouped.get(key).count++;
    }
    return [...grouped.values()];
  }, [places]);
  const visible = places.filter(
    (p) =>
      (filter !== "visited" || p.visit_count > 0) &&
      (filter !== "unvisited" || !p.visit_count) &&
      (destination === "all" ||
        (destinationFor(p)?.id || "other") === destination) &&
      `${p.name} ${p.category || ""} ${p.address || ""} ${p.notes || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function act(p, remove = false) {
    if (remove && !confirm(`Delete "${p.name}"?`)) return;
    setBusyId(p.id);
    try {
      if (remove) await api.deletePlace(p.id);
      else await api.logVisit(p.id, null);
      await refresh();
      setToast({
        kind: "ok",
        title: remove
          ? `Removed ${p.name}`
          : `Another memory made at ${p.name}`,
      });
    } catch (e) {
      setToast({
        kind: "warn",
        title: "Couldn't update this place",
        body: e.message,
      });
    } finally {
      setBusyId(null);
    }
  }
  return (
    <div className="page collections-page">
      <div className="workspace-topline">
        <span>
          <CompassLabel /> YOUR TRAVEL JOURNAL
        </span>
        <Link to="/map">
          Open your map <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="page-header">
        <div>
          <div className="section-kicker">
            {prefs.displayName
              ? `HEY, ${prefs.displayName.toUpperCase()}`
              : "A WORLD OF POSSIBILITIES"}
          </div>
          <h1>
            Someday starts <em>here.</em>
          </h1>
          <p className="subtitle">
            All the places you’ve saved. All the stories still to come.
          </p>
        </div>
        <Link to="/import" className="action-link">
          <Plus size={17} /> Save a new place
        </Link>
      </div>
      <div className="journal-banner">
        <div>
          <span className="section-kicker">FROM YOUR FEED TO YOUR FEET</span>
          <h2>
            Less “where was that reel?”
            <br />
            More <em>“let’s go there.”</em>
          </h2>
          <p>Give your inspiration a place to live.</p>
          <Link to="/import">
            Drop in a link <ArrowUpRight size={15} />
          </Link>
        </div>
        <img src="/assets/kyoto.jpg" alt="Traditional street in Kyoto, Japan" />
        <span className="banner-location">
          <MapPin size={12} /> Kyoto, Japan
        </span>
      </div>
      <div className="journal-stats">
        <div>
          <span className="stat-icon">
            <Bookmark size={18} />
          </span>
          <b>{places.length}</b>
          <span>places saved</span>
        </div>
        <div>
          <span className="stat-icon peach">
            <Globe2 size={18} />
          </span>
          <b>{collections.length}</b>
          <span>collections</span>
        </div>
        <div>
          <span className="stat-icon butter">
            <Footprints size={18} />
          </span>
          <b>{visited}</b>
          <span>memories made</span>
        </div>
      </div>
      <div className="collection-heading">
        <h2>
          Your collections <span>{places.length}</span>
        </h2>
        <Link to="/groups">
          <span>Better with friends</span> <ArrowUpRight size={15} />
        </Link>
      </div>
      {!!reelCollections.length && (
        <section
          className="reel-collection-list"
          aria-label="Saved reel collections"
        >
          {reelCollections.map((collection) => (
            <Link
              className="card reel-collection-link"
              key={collection.id}
              to={`/map?collection=${collection.id}`}
            >
              <span className="badge">
                <Link2 size={12} /> FROM ONE REEL
              </span>
              <h3>{collection.name}</h3>
              <p>
                {collection.places.length} places ·{" "}
                {
                  collection.places.filter(
                    (p) => p.lat != null && p.lng != null,
                  ).length
                }{" "}
                map pins
              </p>
              <span>
                Explore this reel’s map <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </section>
      )}
      {collections.length > 0 && (
        <div className="collection-tabs">
          <button
            onClick={() => setDestination("all")}
            className={destination === "all" ? "selected" : ""}
          >
            <Globe2 size={15} /> All destinations
          </button>
          {collections.map((d) => (
            <button
              key={d.id}
              onClick={() => setDestination(d.id)}
              className={destination === d.id ? "selected" : ""}
            >
              {d.image && <img src={d.image} alt="" />} {d.name}
              <span>{d.count}</span>
            </button>
          ))}
        </div>
      )}
      <div className="library-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search saved places"
            placeholder="Find that little place…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs" aria-label="Filter places">
          {[
            ["all", "All places"],
            ["unvisited", "Want to go"],
            ["visited", "Been there"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          We couldn’t load your saved places. {error}
          <button className="secondary sm" onClick={refresh}>
            Try again
          </button>
        </div>
      )}
      {loading && (
        <div className="grid">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 280, borderRadius: 16 }}
            />
          ))}
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div className="journal-empty">
          <span className="empty-icon">
            <Bookmark size={29} strokeWidth={1.4} />
          </span>
          <h3>
            {places.length
              ? "No places match just yet"
              : "Your next adventure starts with a save."}
          </h3>
          <p>
            {places.length
              ? "Try another search or destination."
              : "That café, that hidden beach, that must-visit market. Save a link and make it more than a someday."}
          </p>
          <Link className="action-link" to="/import">
            <Link2 size={15} /> Save your first link
          </Link>
        </div>
      )}
      <div className="place-grid">
        {visible.map((p) => (
          <article key={p.id} className="saved-place-card">
            <PlaceImage place={p}>
              <span className={`place-status ${p.visit_count ? "been" : ""}`}>
                {p.visit_count ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <Bookmark size={12} />
                )}
                {p.visit_count ? "Been there" : "Want to go"}
              </span>
              {p.category && (
                <span className="cover-category">
                  {p.category.replaceAll("_", " ")}
                </span>
              )}
            </PlaceImage>
            <div className="saved-place-body">
              <h3>{p.name}</h3>
              <p className="place-address">
                <MapPin size={13} /> {p.address || "Location to be added"}
              </p>
              {p.notes && <p className="place-notes">{p.notes}</p>}
              <div className="place-card-actions">
                {p.lat != null && p.lng != null ? (
                  <Link to={`/map?place=${p.id}`}>
                    View on map <ArrowUpRight size={14} />
                  </Link>
                ) : (
                  <button className="ghost sm" onClick={() => setLocating(p)}>
                    Find map pin <MapPin size={14} />
                  </button>
                )}
                {p.source_url && (
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open source for ${p.name}`}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  className="ghost icon-only"
                  disabled={busyId === p.id}
                  onClick={() => act(p)}
                  title="Log a visit"
                  aria-label={`Log a visit to ${p.name}`}
                >
                  <CheckCircle2 size={17} />
                </button>
                <button
                  className="ghost icon-only"
                  disabled={busyId === p.id}
                  onClick={() => act(p, true)}
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!loading && places.length === 0 && (
        <section className="inspiration-row">
          <div className="collection-heading">
            <h2>A little inspiration</h2>
            <span>Explore destination previews</span>
          </div>
          <div className="inspiration-grid">
            {DESTINATIONS.map((d) => (
              <Link key={d.id} to={`/map?destination=${d.id}`}>
                <img src={d.image} alt={d.location} loading="lazy" />
                <div>
                  <b>{d.name}</b>
                  <small>{d.tag}</small>
                </div>
                <ArrowUpRight size={19} />
              </Link>
            ))}
          </div>
        </section>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
      {locating && (
        <SavedLocationDialog
          place={locating}
          onClose={() => setLocating(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
function CompassLabel() {
  return <Globe2 size={13} />;
}
