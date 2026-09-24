import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Instagram,
  Youtube,
  Link2,
  Save,
  MapPin,
  Check,
  FileText,
  ScanText,
  LoaderCircle,
  ArrowRight,
} from "lucide-react";
import { api } from "../lib/api.js";
import { Toast } from "../components/Toast.jsx";
import { ReelMap, hasPin } from "../components/ReelMap.jsx";
import { PlaceLocationPicker } from "../components/PlaceLocationPicker.jsx";

const STAGES = {
  queued: "Waiting for the current import…",
  metadata: "Reading the public link…",
  captions: "Collecting video captions…",
  download: "Downloading a small media copy…",
  transcribing: "Listening to the video locally…",
  screen_text: "Reading text in sampled frames…",
  summarizing: "Turning the evidence into travel notes…",
  geocoding: "Finding the places on your map…",
};
const SOURCES = {
  provided_transcript: "Your pasted transcript",
  captions: "Video captions",
  automatic_captions: "Automatic captions",
  local_whisper: "Local audio transcription",
  screen_text: "On-screen text",
  title: "Post title",
  caption: "Post description",
};
const timestamp = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function placeKey(place, fallback) {
  const text = [
    place?.name || fallback || "manual-place",
    place?.location,
    place?.destination,
  ]
    .filter(Boolean)
    .join("|")
    .normalize("NFKC")
    .toLowerCase();
  let hash = 2166136261;
  for (const character of text)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `${text.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 70)}-${(hash >>> 0).toString(16)}`;
}
function makeDrafts(result) {
  const places = result.summary?.places || [];
  return (places.length ? places : [null]).map((place) => ({
    key: placeKey(place, result.scraped?.name),
    name: place?.name || result.scraped?.name || "",
    category: place?.category || "",
    address:
      place?.geocoding?.selected?.address ||
      [place?.location, place?.destination].filter(Boolean).join(", "),
    searchContext: [place?.location, place?.destination]
      .filter(Boolean)
      .join(", "),
    geocoding: place?.geocoding,
    geocode_source: place?.geocoding?.selected ? "photon" : null,
    osm_url: place?.geocoding?.selected?.osm_url || null,
    // A video can describe several places; page coordinates cannot identify each one.
    lat:
      place?.geocoding?.selected?.lat ??
      (!places.length ? (result.scraped?.lat ?? "") : ""),
    lng:
      place?.geocoding?.selected?.lng ??
      (!places.length ? (result.scraped?.lng ?? "") : ""),
    notes: place
      ? [
          ...(place.notes || []).map((note) => `• ${note}`),
          ...(place.things_to_do || []).map((note) => `Try / see: ${note}`),
          place.best_time ? `Best time: ${place.best_time}` : "",
          ...place.evidence.map(
            (e) =>
              `${SOURCES[e.source] || e.source}${e.seconds != null ? ` (${timestamp(e.seconds)})` : ""}: ${e.text}`,
          ),
        ]
          .filter(Boolean)
          .join("\n")
      : result.scraped?.notes || "",
    image_url: result.scraped?.image || "",
    saved: false,
  }));
}

export function ImportLinkPage() {
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [readScreen, setReadScreen] = useState(true);
  const [language, setLanguage] = useState("auto");
  const [jobId, setJobId] = useState(() =>
    sessionStorage.getItem("travel-import-job"),
  );
  const [stage, setStage] = useState("queued");
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState(0);
  const [toast, setToast] = useState(null);
  const [collectionName, setCollectionName] = useState("");
  const [collectionId, setCollectionId] = useState(null);
  const busy = starting || !!jobId;
  const edit = drafts[selected];
  const place = data?.summary?.places?.[selected];

  useEffect(() => {
    if (!jobId) return;
    sessionStorage.setItem("travel-import-job", jobId);
    const controller = new AbortController();
    let timer;
    const finish = () => {
      sessionStorage.removeItem("travel-import-job");
      setJobId(null);
    };
    async function poll() {
      try {
        const job = await api.getImport(jobId, controller.signal);
        if (controller.signal.aborted) return;
        setStage(job.stage);
        if (job.state === "complete") {
          setData(job.result);
          setDrafts(makeDrafts(job.result));
          setCollectionName(
            job.result.summary?.places?.length
              ? job.result.summary.places
                  .map((p) => p.name)
                  .join(" & ")
                  .slice(0, 140)
              : "Places from a reel",
          );
          setCollectionId(null);
          setSelected(0);
          finish();
        } else if (job.state === "failed") {
          setToast({
            kind: "warn",
            title: "Couldn’t read this link",
            body: job.error,
          });
          finish();
        } else timer = setTimeout(poll, 1000);
      } catch (error) {
        if (controller.signal.aborted) return;
        setToast({
          kind: "warn",
          title: "Import interrupted",
          body: `${error.message} Submit again to reuse any cached work.`,
        });
        finish();
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId]);

  async function extract(event) {
    event.preventDefault();
    setStarting(true);
    setData(null);
    setDrafts([]);
    setStage("queued");
    try {
      const job = await api.startImport({
        url: url.trim(),
        transcript: transcript.trim(),
        readScreen,
        language,
      });
      setJobId(job.id);
    } catch (error) {
      setToast({
        kind: "warn",
        title: "Couldn’t start import",
        body: error.message,
      });
    } finally {
      setStarting(false);
    }
  }
  function update(key, value) {
    setDrafts((previous) =>
      previous.map((draft, index) =>
        index === selected
          ? {
              ...draft,
              [key]: value,
              ...(["lat", "lng"].includes(key)
                ? { osm_url: null, geocode_source: "manual" }
                : {}),
            }
          : draft,
      ),
    );
  }
  async function save(event, all = false) {
    event?.preventDefault();
    const targets = (all ? drafts : [edit]).filter(
      (draft) => draft && !draft.saved,
    );
    if (!targets.length || saving) return;
    if (targets.some((draft) => !draft.name.trim())) {
      setToast({ kind: "warn", title: "Each place needs a name" });
      return;
    }
    for (const edit of targets) {
      if (
        (edit.lat === "") !== (edit.lng === "") ||
        (edit.lat !== "" &&
          (!Number.isFinite(Number(edit.lat)) ||
            Math.abs(Number(edit.lat)) > 90 ||
            !Number.isFinite(Number(edit.lng)) ||
            Math.abs(Number(edit.lng)) > 180))
      ) {
        setToast({
          kind: "warn",
          title: "Check the map coordinates",
          body: "Enter both valid coordinates, or leave both empty to save without a map pin.",
        });
        return;
      }
    }
    setSaving(true);
    try {
      const result = await api.saveReel({
        source_url: data.scraped.sourceUrl,
        name: collectionName,
        places: targets.map((edit) => ({
          key: edit.key,
          name: edit.name.trim(),
          category: edit.category.trim() || null,
          address: edit.address.trim() || null,
          notes: edit.notes.trim() || null,
          lat: edit.lat === "" ? null : Number(edit.lat),
          lng: edit.lng === "" ? null : Number(edit.lng),
          image_url: edit.image_url || null,
          source: data.scraped.source,
          source_url: data.scraped.sourceUrl,
          geocode_source: edit.geocode_source,
          osm_url: edit.osm_url,
        })),
      });
      setCollectionId(result.collection.id);
      const saved = new Map(result.places.map((p) => [p.key, p]));
      setDrafts((previous) =>
        previous.map((draft) =>
          saved.has(draft.key)
            ? {
                ...draft,
                lat: saved.get(draft.key).lat ?? "",
                lng: saved.get(draft.key).lng ?? "",
                address: saved.get(draft.key).address || "",
                saved: true,
                savedId: saved.get(draft.key).id,
              }
            : draft,
        ),
      );
      setToast({
        kind: "ok",
        title: `${targets.length} ${targets.length === 1 ? "place" : "places"} saved to your reel collection`,
      });
    } catch (error) {
      setToast({ kind: "warn", title: "Save failed", body: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page import-page">
      <div className="page-header">
        <div>
          <div className="section-kicker">
            A LITTLE INSPIRATION GOES A LONG WAY
          </div>
          <h1>
            Save now. <em>Go later.</em>
          </h1>
          <p className="subtitle">
            The places inside the video, not just the caption. Bring them into
            your next adventure.
          </p>
        </div>
      </div>
      <div className="import-layout">
        <form className="card col import-form" onSubmit={extract}>
          <h2>Found your next somewhere?</h2>
          <p className="muted">
            We collect captions, listen to the audio when needed, and read
            on-screen text. Then a local model gathers the details worth
            keeping.
          </p>
          <div className="source-chips">
            <span>
              <Instagram size={13} /> Instagram reels
            </span>
            <span>
              <Youtube size={14} /> YouTube shorts
            </span>
            <span>
              <Link2 size={12} /> Public links
            </span>
          </div>
          <div>
            <label htmlFor="reel-url">Your inspiration link</label>
            <input
              id="reel-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/…"
              required
              disabled={busy || saving}
            />
          </div>
          <details className="transcript-input">
            <summary>Have a transcript? Paste it here</summary>
            <p className="faint">
              Useful for private or restricted videos. Pasting text skips the
              video download and audio processing.
            </p>
            <label htmlFor="provided-transcript">
              Spoken words or on-screen text
            </label>
            <textarea
              id="provided-transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              maxLength={24000}
              disabled={busy || saving}
              placeholder="Paste the actual words from the video…"
              rows={5}
            />
          </details>
          <div>
            <label htmlFor="spoken-language">Spoken language</label>
            <select
              id="spoken-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={busy || saving || !!transcript.trim()}
            >
              {[
                ["auto", "Detect automatically"],
                ["en", "English"],
                ["ja", "Japanese"],
                ["hi", "Hindi"],
                ["es", "Spanish"],
                ["fr", "French"],
                ["ko", "Korean"],
                ["zh", "Chinese"],
                ["th", "Thai"],
                ["de", "German"],
                ["pt", "Portuguese"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small className="faint">
              Choose a language if automatic detection misreads an accent.
            </small>
          </div>
          <label className="screen-toggle" htmlFor="screen-text">
            <input
              id="screen-text"
              type="checkbox"
              checked={readScreen}
              onChange={(e) => setReadScreen(e.target.checked)}
              disabled={busy || saving || !!transcript.trim()}
            />
            <span>
              <ScanText size={15} /> Read text in sampled video frames
              <small>
                Helps with restaurant names and signs. Adds a small video
                download.
              </small>
            </span>
          </label>
          <div>
            <button disabled={busy || saving || !url.trim()}>
              {busy ? (
                <LoaderCircle size={15} className="import-spinner" />
              ) : (
                <Sparkles size={15} />
              )}
              {busy ? "Gathering your inspiration…" : "Extract & summarize"}
            </button>
          </div>
          <span className="form-tip">
            Public clips up to 10 minutes · Local processing · Review every
            place before saving
          </span>
        </form>
        <aside className="import-aside">
          <div className="aside-photo">
            <img src="/assets/kyoto.jpg" alt="A street in Kyoto" />
          </div>
          <h3>From reel to real life.</h3>
          <ol>
            <li>Share a link that made you want to go.</li>
            <li>Discover the places mentioned in the video.</li>
            <li>Check the evidence. Save your favorites.</li>
          </ol>
          <small>
            No paid scraping or AI service. Repeated imports reuse saved
            results.
          </small>
        </aside>
      </div>
      {busy && (
        <div className="card import-progress" role="status" aria-live="polite">
          <LoaderCircle size={22} className="import-spinner" />
          <div>
            <strong>{STAGES[stage] || "Processing your link…"}</strong>
            <p className="muted">
              Local transcription can take a few minutes. You can return to this
              page while it works.
            </p>
          </div>
        </div>
      )}
      {data && edit && (
        <>
          <section className="card reel-collection-preview">
            <div className="card-title-row">
              <div>
                <div className="section-kicker">
                  ONE REEL, A LITTLE ADVENTURE
                </div>
                <h2>Your places, together.</h2>
                <p className="muted">
                  {drafts.filter(hasPin).length} of {drafts.length} places
                  mapped.{" "}
                  {drafts.filter((d) => !hasPin(d)).length > 0
                    ? "Choose locations for the remaining places below, or save their notes for later."
                    : "Review your pins, then keep them as one collection."}
                </p>
              </div>
            </div>
            <label htmlFor="reel-collection-name">Collection name</label>
            <input
              id="reel-collection-name"
              value={collectionName}
              maxLength={160}
              disabled={saving || !!collectionId}
              onChange={(e) => setCollectionName(e.target.value)}
            />
            <ReelMap
              places={drafts}
              selected={selected}
              onSelect={(index) => {
                if (!saving) setSelected(index);
              }}
            />
            <div className="row">
              <button
                type="button"
                disabled={saving || drafts.every((d) => d.saved)}
                onClick={() => save(null, true)}
              >
                <Save size={15} />
                {saving ? "Saving…" : "Save all places as a collection"}
              </button>
              {collectionId && (
                <Link
                  className="action-link"
                  to={`/map?collection=${collectionId}`}
                >
                  Open this collection’s map <ArrowRight size={15} />
                </Link>
              )}
            </div>
          </section>
          <section
            className="card import-provenance"
            aria-label="Extraction details"
          >
            <div className="row">
              <span className="badge accent">
                <FileText size={12} />{" "}
                {SOURCES[data.extraction?.transcript_source] ||
                  "Page text only"}
              </span>
              {data.extraction?.screen_text_count > 0 && (
                <span className="badge">
                  {data.extraction.screen_text_count} screen-text snippets
                </span>
              )}
              {data.cache?.summary_hit && (
                <span className="badge">Reused cached result</span>
              )}
              {data.enabled && (
                <span className="badge">Summarized locally</span>
              )}
            </div>
            {!data.extraction?.transcript_source && (
              <p className="import-notice">
                The video’s speech wasn’t available. These results only use the
                page text and any readable frames. Paste a transcript above to
                include what was said.
              </p>
            )}
            {!data.enabled && <p className="import-notice">{data.reason}</p>}
            {data.summary && !data.summary.places.length && (
              <p className="import-notice">
                No named travel places were supported by the available text. You
                can enter a place manually below.
              </p>
            )}
            {data.extraction?.coverage === "sampled" && (
              <p className="faint">
                A selection of the extracted text was summarized to keep
                processing small. Some details may be missing.
              </p>
            )}
            {!!data.extraction?.warnings?.length && (
              <details>
                <summary>
                  Extraction notes ({data.extraction.warnings.length})
                </summary>
                <ul>
                  {data.extraction.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
            {data.extraction?.transcript && (
              <details>
                <summary>Read the extracted transcript</summary>
                <pre className="import-transcript">
                  {data.extraction.transcript}
                </pre>
              </details>
            )}
          </section>
          {!!data.summary?.unlocated_tips?.length && (
            <section className="card import-provenance">
              <h3>More tips · location not named</h3>
              <p className="muted">
                These suggestions don’t identify a specific place to save.
              </p>
              {data.summary.unlocated_tips.map((tip, i) => (
                <div key={i}>
                  <strong>{tip.name}</strong>
                  <ul className="bullets">
                    {tip.notes.map((note, n) => (
                      <li key={n}>{note}</li>
                    ))}
                  </ul>
                  <details>
                    <summary>Source wording</summary>
                    {tip.evidence.map((e) => (
                      <p key={e.id}>{e.text}</p>
                    ))}
                  </details>
                </div>
              ))}
            </section>
          )}
          {!!data.summary?.places?.length && (
            <div className="discovered-places">
              <div className="card-title-row">
                <h2>
                  {drafts.length} {drafts.length === 1 ? "place" : "places"} to
                  explore
                </h2>
                <Link to="/places">
                  Your collection <ArrowRight size={14} />
                </Link>
              </div>
              <div
                className="place-choice-list"
                aria-label="Choose a place to review"
              >
                {drafts.map((draft, index) => (
                  <button
                    type="button"
                    className={`place-choice ${selected === index ? "selected" : ""}`}
                    aria-pressed={selected === index}
                    key={index}
                    disabled={saving}
                    onClick={() => setSelected(index)}
                  >
                    <span>
                      {draft.saved ? <Check size={16} /> : <MapPin size={16} />}
                      {draft.name}
                    </span>
                    <small>
                      {data.summary.places[index]?.destination ||
                        "Location to verify"}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="import-results">
            <div className="col" style={{ minWidth: 0 }}>
              {data.scraped?.image && (
                <div className="card">
                  <img
                    className="preview-image"
                    src={data.scraped.image}
                    alt="Source video cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <small className="faint">
                    Source cover · notes come from extracted text
                  </small>
                </div>
              )}
              <div className="ai-card">
                <div className="ai-card-head">
                  <Sparkles size={18} />
                  <h3>{place ? "Your travel notes" : "What we could read"}</h3>
                  {place && (
                    <span className="badge">{place.confidence} confidence</span>
                  )}
                </div>
                <ul className="bullets">
                  {(
                    place?.notes ||
                    data.summary?.summary_points || [
                      data.scraped?.notes ||
                        "Add the missing details in the form.",
                    ]
                  ).map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
                {!!place?.things_to_do?.length && (
                  <>
                    <div className="section-label">Try / see</div>
                    <ul className="bullets">
                      {place.things_to_do.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </>
                )}
                {place?.best_time && (
                  <p>
                    <strong>Best time: </strong>
                    {place.best_time}
                  </p>
                )}
                {!!place?.evidence?.length && (
                  <div className="import-evidence">
                    <div className="section-label">
                      From the source · check the wording
                    </div>
                    {place.evidence.map((e) => (
                      <blockquote key={e.id}>
                        <span>
                          {SOURCES[e.source] || e.source}
                          {e.seconds != null && ` · ${timestamp(e.seconds)}`}
                        </span>
                        <p>{e.text}</p>
                      </blockquote>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <form className="card col import-save" onSubmit={save}>
              <div className="card-title-row">
                <h3>
                  {edit.saved
                    ? "Added to your collection"
                    : "Review & save this place"}
                </h3>
                <span className="badge">{data.scraped?.source}</span>
              </div>
              <p className="muted">
                Check names and locations against the source, especially when
                they came from automatic captions or speech recognition.
              </p>
              <fieldset
                disabled={saving || edit.saved}
                className="col import-fields"
              >
                <div>
                  <label htmlFor="place-name">Name</label>
                  <input
                    id="place-name"
                    required
                    value={edit.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="place-category">Category</label>
                  <input
                    id="place-category"
                    value={edit.category}
                    onChange={(e) => update("category", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="place-address">Address / destination</label>
                  <input
                    id="place-address"
                    value={edit.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </div>
                <PlaceLocationPicker
                  key={selected}
                  draft={edit}
                  kind={place?.kind}
                  disabled={saving || edit.saved}
                  onChange={(patch) =>
                    setDrafts((previous) =>
                      previous.map((draft, index) =>
                        index === selected ? { ...draft, ...patch } : draft,
                      ),
                    )
                  }
                />
                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label htmlFor="place-lat">Latitude</label>
                    <input
                      id="place-lat"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={edit.lat}
                      onChange={(e) => update("lat", e.target.value)}
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
                      value={edit.lng}
                      onChange={(e) => update("lng", e.target.value)}
                    />
                  </div>
                </div>
                <p className="faint">
                  A selected search result fills these coordinates
                  automatically. You can also enter a verified pin manually.
                </p>
                <div>
                  <label htmlFor="place-photo">Photo URL (optional)</label>
                  <input
                    id="place-photo"
                    type="url"
                    value={edit.image_url}
                    onChange={(e) => update("image_url", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="place-notes">Notes & source evidence</label>
                  <textarea
                    id="place-notes"
                    value={edit.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    rows={7}
                  />
                </div>
              </fieldset>
              <div className="row">
                <button disabled={saving || edit.saved}>
                  {edit.saved ? <Check size={14} /> : <Save size={14} />}
                  {edit.saved
                    ? "Saved"
                    : saving
                      ? "Saving…"
                      : "Save this place"}
                </button>
                <Link className="muted" to="/places">
                  View collection
                </Link>
              </div>
            </form>
          </div>
        </>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
