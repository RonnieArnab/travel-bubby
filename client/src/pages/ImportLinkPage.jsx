import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Link2,
  Save,
  X,
  Tag,
  Clock,
  MapPin,
  ListChecks,
  Image as ImageIcon,
} from "lucide-react";
import { api } from "../lib/api.js";
import { Toast } from "../components/Toast.jsx";

const PLACEHOLDER =
  "https://www.instagram.com/reel/...  ·  https://maps.app.goo.gl/...  ·  https://youtube.com/shorts/...";

export function ImportLinkPage() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null); // { scraped, summary, enabled, used_image, reason }
  const [edit, setEdit] = useState(null); // editable form derived from summary/scraped
  const [toast, setToast] = useState(null);
  const nav = useNavigate();

  function deriveEdit(payload) {
    const s = payload.summary;
    const sc = payload.scraped;
    return {
      name: s?.suggested_name || sc?.name || "",
      category: s?.category || "",
      address: s?.location_hint || "",
      lat: sc?.lat ?? "",
      lng: sc?.lng ?? "",
      // Notes is the rich text we'll store: bullet summary + things to do.
      notes: buildNotes(s, sc),
      source: sc?.source,
      source_url: sc?.sourceUrl,
    };
  }

  function buildNotes(s, sc) {
    if (!s) return sc?.notes || "";
    const parts = [];
    if (s.summary_points?.length) {
      parts.push(s.summary_points.map((b) => `• ${b}`).join("\n"));
    }
    if (s.things_to_do?.length) {
      parts.push(
        `\nTry / see:\n` + s.things_to_do.map((b) => `• ${b}`).join("\n"),
      );
    }
    if (s.best_time) parts.push(`\nBest time: ${s.best_time}`);
    return parts.join("\n");
  }

  async function doExtract(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setData(null);
    setEdit(null);
    try {
      const result = await api.summarize(url.trim());
      setData(result);
      setEdit(deriveEdit(result));
      if (!result.enabled) {
        setToast({
          kind: "warn",
          title: "AI summary disabled",
          body: result.reason ?? "Server has no Anthropic API key set.",
          duration: 6000,
        });
      }
    } catch (err) {
      setToast({ kind: "warn", title: "Extraction failed", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!edit?.name?.trim()) {
      setToast({ kind: "warn", title: "Add a name before saving" });
      return;
    }
    setBusy(true);
    try {
      await api.createPlace({
        name: edit.name.trim(),
        category: edit.category?.trim() || null,
        notes: edit.notes?.trim() || null,
        address: edit.address?.trim() || null,
        lat: edit.lat === "" ? null : Number(edit.lat),
        lng: edit.lng === "" ? null : Number(edit.lng),
        source: edit.source,
        source_url: edit.source_url,
      });
      setToast({ kind: "ok", title: "Saved" });
      setTimeout(() => nav("/places"), 600);
    } catch (err) {
      setToast({ kind: "warn", title: "Save failed", body: err.message });
    } finally {
      setBusy(false);
    }
  }

  function update(k, v) {
    setEdit((p) => ({ ...p, [k]: v }));
  }

  const summary = data?.summary;
  const scraped = data?.scraped;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Import a link</h1>
          <p className="subtitle">
            Paste a reel, short, or share link — Travel Buddy reads the caption,
            looks at the thumbnail, and writes a clean, point-wise summary you
            can save.
          </p>
        </div>
      </div>

      <form className="card col" onSubmit={doExtract} style={{ maxWidth: 760 }}>
        <div>
          <label>URL</label>
          <div style={{ position: "relative" }}>
            <Link2
              size={16}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-faint)",
              }}
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={PLACEHOLDER}
              required
              style={{ paddingLeft: 40 }}
            />
          </div>
        </div>
        <div>
          <button disabled={busy || !url.trim()}>
            <Sparkles size={14} />
            {busy ? "Reading & understanding…" : "Extract & summarize"}
          </button>
        </div>
      </form>

      {busy && !data && (
        <div className="card col" style={{ marginTop: 16, maxWidth: 760 }}>
          <div className="skeleton" style={{ height: 18, width: "40%" }} />
          <div className="skeleton" style={{ height: 220, width: "100%" }} />
          <div className="skeleton" style={{ height: 14, width: "90%" }} />
          <div className="skeleton" style={{ height: 14, width: "75%" }} />
          <div className="skeleton" style={{ height: 14, width: "82%" }} />
        </div>
      )}

      {data && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 380px)",
            gap: 16,
            marginTop: 18,
          }}>
          {/* Left: AI summary + thumbnail */}
          <div className="col" style={{ minWidth: 0 }}>
            {scraped?.image && (
              <div className="card" style={{ padding: 14 }}>
                <img
                  className="preview-image"
                  src={scraped.image}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div
                  className="faint"
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                  <ImageIcon size={11} />
                  Thumbnail{" "}
                  {data.used_image
                    ? "was analyzed by Claude"
                    : "(image not used in summary)"}
                </div>
              </div>
            )}

            {summary ? (
              <div className="ai-card">
                <div className="ai-card-head">
                  <div
                    className="brand-mark"
                    style={{ width: 28, height: 28, borderRadius: 8 }}>
                    <Sparkles size={14} />
                  </div>
                  <h3>AI-extracted travel summary</h3>
                  <span className="badge accent">
                    {summary.confidence} confidence
                  </span>
                </div>

                <ul className="bullets" style={{ marginBottom: 6 }}>
                  {summary.summary_points?.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>

                {summary.things_to_do?.length > 0 && (
                  <>
                    <div className="section-label">
                      <ListChecks
                        size={11}
                        style={{
                          display: "inline-block",
                          marginRight: 6,
                          verticalAlign: "-2px",
                        }}
                      />
                      Things to do / try
                    </div>
                    <ul className="bullets">
                      {summary.things_to_do.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </>
                )}

                <div className="section-label">Quick info</div>
                <div>
                  {summary.location_hint && (
                    <div className="kv-row">
                      <div className="k">
                        <MapPin size={11} style={{ verticalAlign: "-2px" }} />{" "}
                        Location
                      </div>
                      <div className="v">{summary.location_hint}</div>
                    </div>
                  )}
                  {summary.category && (
                    <div className="kv-row">
                      <div className="k">
                        <Tag size={11} style={{ verticalAlign: "-2px" }} />{" "}
                        Category
                      </div>
                      <div className="v">
                        {summary.category.replace(/_/g, " ")}
                      </div>
                    </div>
                  )}
                  {summary.best_time && (
                    <div className="kv-row">
                      <div className="k">
                        <Clock size={11} style={{ verticalAlign: "-2px" }} />{" "}
                        Best time
                      </div>
                      <div className="v">{summary.best_time}</div>
                    </div>
                  )}
                </div>

                {summary.tags?.length > 0 && (
                  <>
                    <div className="section-label">Tags</div>
                    <div className="row">
                      {summary.tags.map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="muted">
                  AI summary not available — using raw scraped content.{" "}
                  {data.reason ? `(${data.reason})` : ""}
                </div>
                {scraped?.notes && (
                  <div
                    style={{
                      marginTop: 10,
                      whiteSpace: "pre-wrap",
                      fontSize: 14,
                    }}>
                    {scraped.notes}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: editable save form */}
          <div
            className="card col"
            style={{ alignSelf: "start", position: "sticky", top: 20 }}>
            <div className="card-title-row">
              <h3>Save as place</h3>
              <span className="badge">{scraped?.source}</span>
            </div>
            <div className="muted">
              Edit anything before saving — the summary is the model's read, not
              yours.
            </div>

            <div>
              <label>Name</label>
              <input
                value={edit.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div>
              <label>Category</label>
              <input
                value={edit.category}
                onChange={(e) => update("category", e.target.value)}
              />
            </div>
            <div>
              <label>Address / location</label>
              <input
                value={edit.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Latitude</label>
                <input
                  value={edit.lat}
                  onChange={(e) => update("lat", e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Longitude</label>
                <input
                  value={edit.lng}
                  onChange={(e) => update("lng", e.target.value)}
                />
              </div>
            </div>
            {(edit.lat === "" || edit.lng === "") && (
              <div className="faint" style={{ lineHeight: 1.5 }}>
                Tip — Instagram rarely exposes coordinates. Open the post's
                location tag in Google Maps and import that link instead, or
                paste lat/lng manually.
              </div>
            )}
            <div>
              <label>Notes</label>
              <textarea
                value={edit.notes}
                onChange={(e) => update("notes", e.target.value)}
                style={{ minHeight: 140 }}
              />
            </div>

            <div className="row" style={{ marginTop: 4 }}>
              <button onClick={save} disabled={busy}>
                <Save size={14} />
                Save place
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setData(null);
                  setEdit(null);
                }}>
                <X size={14} />
                Discard
              </button>
            </div>

            {data.usage && (
              <div className="faint" style={{ marginTop: 6 }}>
                Tokens — in: {data.usage.input_tokens} · out:{" "}
                {data.usage.output_tokens}
                {data.usage.cache_read_input_tokens > 0 &&
                  ` · cached: ${data.usage.cache_read_input_tokens}`}
              </div>
            )}
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
