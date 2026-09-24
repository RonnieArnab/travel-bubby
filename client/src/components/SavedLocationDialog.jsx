import { useEffect, useRef, useState } from "react";
import { PlaceLocationPicker } from "./PlaceLocationPicker.jsx";
import { ReelMap, hasPin } from "./ReelMap.jsx";
import { api } from "../lib/api.js";

export function SavedLocationDialog({ place, onClose, onSaved }) {
  const dialog = useRef(null);
  const [draft, setDraft] = useState({
    ...place,
    lat: place.lat ?? "",
    lng: place.lng ?? "",
    searchContext: place.address || "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.updatePlace(place.id, {
        lat: Number(draft.lat),
        lng: Number(draft.lng),
        address: draft.address,
        geocode_source: draft.geocode_source,
        osm_url: draft.osm_url,
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="saved-location-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="saved-location-title"
    >
      <div className="card-title-row">
        <h2 id="saved-location-title">Map {place.name}</h2>
        <button className="ghost sm" disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
      <ReelMap places={[draft]} selected={0} />
      <PlaceLocationPicker
        draft={draft}
        disabled={busy}
        onChange={(patch) =>
          setDraft((previous) => ({ ...previous, ...patch }))
        }
      />
      {error && <p role="alert">{error}</p>}
      <button disabled={busy || !hasPin(draft)} onClick={save}>
        {busy ? "Saving pin…" : "Save this map pin"}
      </button>
    </dialog>
  );
}
