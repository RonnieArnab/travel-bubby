import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Save } from "lucide-react";
import { api } from "../lib/api.js";
import { Toast } from "../components/Toast.jsx";

const empty = {
  name: "",
  category: "",
  notes: "",
  address: "",
  lat: "",
  lng: "",
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
      (err) => setToast({ kind: "warn", title: "Couldn't get location", body: err.message })
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
          <h1>Add a place</h1>
          <p className="subtitle">A market, viewpoint, restaurant, anywhere worth remembering.</p>
        </div>
      </div>

      <form className="card col" onSubmit={submit} style={{ maxWidth: 640 }}>
        <div>
          <label>Name *</label>
          <input value={form.name} onChange={(e) => update("name", e.target.value)} required placeholder="e.g. Sarojini Market" />
        </div>
        <div>
          <label>Category</label>
          <input
            placeholder="market, restaurant, viewpoint, temple…"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
          />
        </div>
        <div>
          <label>Address</label>
          <input value={form.address} onChange={(e) => update("address", e.target.value)} />
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Latitude</label>
            <input value={form.lat} onChange={(e) => update("lat", e.target.value)} placeholder="28.5733" />
          </div>
          <div style={{ flex: 1 }}>
            <label>Longitude</label>
            <input value={form.lng} onChange={(e) => update("lng", e.target.value)} placeholder="77.1989" />
          </div>
        </div>
        <div>
          <button type="button" className="secondary" onClick={fillFromGps}>
            <MapPin size={14} />
            Use my location
          </button>
        </div>

        <div>
          <label>Notes</label>
          <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="What's worth knowing? Best time to visit, what to order, etc." />
        </div>

        <div className="row" style={{ marginTop: 4 }}>
          <button disabled={busy || !form.name.trim()}>
            <Save size={14} />
            {busy ? "Saving…" : "Save place"}
          </button>
        </div>
      </form>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
