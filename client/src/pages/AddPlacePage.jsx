import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Save, Compass } from "lucide-react";
import { api } from "../lib/api.js";
import { Toast } from "../components/Toast.jsx";

const empty = {
  name: "",
  category: "",
  notes: "",
  address: "",
  lat: "",
  lng: "",
  image_url: "",
};

export function AddPlacePage() {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const nav = useNavigate();

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function fillFromGps() {
    if (!navigator.geolocation) {
      setToast({ kind: "warn", title: "Geolocation unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("lat", pos.coords.latitude.toFixed(6));
        update("lng", pos.coords.longitude.toFixed(6));
        setToast({ kind: "ok", title: "Location captured" });
      },
      (err) =>
        setToast({
          kind: "warn",
          title: "Couldn't get location",
          body: err.message,
        }),
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api.createPlace({
        name: form.name.trim(),
        category: form.category.trim() || null,
        notes: form.notes.trim() || null,
        address: form.address.trim() || null,
        lat: form.lat === "" ? null : Number(form.lat),
        lng: form.lng === "" ? null : Number(form.lng),
        source: "manual",
        image_url: form.image_url.trim() || null,
      });
      setToast({ kind: "ok", title: "Saved" });
      setTimeout(() => nav("/places"), 500);
    } catch (err) {
      setToast({ kind: "warn", title: "Save failed", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">LEAVE A LITTLE PIN IN YOUR WORLD</div>
          <h1>
            Somewhere worth <em>saving.</em>
          </h1>
          <p className="subtitle">
            A market, viewpoint, restaurant, anywhere worth remembering.
          </p>
        </div>
      </div>

      <div className="form-layout">
        <form className="card col" onSubmit={submit} style={{ maxWidth: 640 }}>
          <div>
            <label htmlFor="place-name">Name *</label>
            <input
              id="place-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              placeholder="e.g. Sarojini Market"
            />
          </div>
          <div>
            <label htmlFor="place-category">Category</label>
            <input
              id="place-category"
              placeholder="market, restaurant, viewpoint, temple…"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="place-address">Address</label>
            <input
              id="place-address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>

          <div className="row">
            <div style={{ flex: 1 }}>
              <label htmlFor="place-lat">Latitude</label>
              <input
                id="place-lat"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={form.lat}
                onChange={(e) => update("lat", e.target.value)}
                placeholder="28.5733"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="place-lng">Longitude</label>
              <input
                id="place-lng"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={form.lng}
                onChange={(e) => update("lng", e.target.value)}
                placeholder="77.1989"
              />
            </div>
          </div>
          <div>
            <button type="button" className="secondary" onClick={fillFromGps}>
              <MapPin size={14} />
              Use my location
            </button>
          </div>

          <div>
            <label htmlFor="place-image">Photo URL (optional)</label>
            <input
              id="place-image"
              type="url"
              value={form.image_url}
              onChange={(e) => update("image_url", e.target.value)}
              placeholder="https://…/your-photo.jpg"
            />
            <p className="form-tip">
              Add a photo of this place. It will appear in your collection and
              on your map.
            </p>
          </div>
          <div>
            <label htmlFor="place-notes">Notes</label>
            <textarea
              id="place-notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="What's worth knowing? Best time to visit, what to order, etc."
            />
          </div>

          <div className="row" style={{ marginTop: 4 }}>
            <button disabled={busy || !form.name.trim()}>
              <Save size={14} />
              {busy ? "Saving…" : "Save place"}
            </button>
          </div>
        </form>
        <aside className="form-note">
          <Compass size={32} strokeWidth={1.3} />
          <h3>
            The little places
            <br />
            make the big memories.
          </h3>
          <p>
            A name, a location, and something you want to remember. That’s all
            you need to get started.
          </p>
          <p>
            Add coordinates to put this place on your map, or use your current
            location when you’re already there.
          </p>
        </aside>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
