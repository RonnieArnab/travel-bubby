import { createHash } from "node:crypto";
import { db } from "../db/index.js";
import { extractFromUrl, detectSource } from "./extractor.js";
import { extractMedia } from "./media.js";
import { buildEvidence } from "./evidence.js";
import { summarizeScraped, localModelConfig } from "./summarizer.js";
import { parsePublicUrl } from "./publicUrl.js";
import { locateImport } from "./geocoder.js";

// Cache extracted evidence independently: enabling a local model later won't re-download a reel.
db.exec(
  `CREATE TABLE IF NOT EXISTS import_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
);
const get = db.prepare(
  "SELECT payload FROM import_cache WHERE cache_key = ? AND expires_at > ?",
);
const put = db.prepare(
  "INSERT OR REPLACE INTO import_cache (cache_key, payload, expires_at) VALUES (?, ?, ?)",
);
const purge = db.prepare(
  "DELETE FROM import_cache WHERE expires_at <= ? OR cache_key NOT IN (SELECT cache_key FROM import_cache ORDER BY expires_at DESC LIMIT 200)",
);
export function canonicalUrl(raw) {
  const u = parsePublicUrl(raw.trim());
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|fbclid$|igsh$|si$)/.test(key)) u.searchParams.delete(key);
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
      u.hostname,
    )
  ) {
    const id =
      u.hostname === "youtu.be"
        ? u.pathname.slice(1)
        : u.searchParams.get("v") ||
          u.pathname.match(/^\/(shorts|embed)\/([\w-]+)/)?.[2];
    if (/^[\w-]{11}$/.test(id || ""))
      return `https://www.youtube.com/watch?v=${id}`;
  }
  u.searchParams.sort();
  return u.href;
}
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function normalizeImport(input) {
  if (typeof input?.url !== "string")
    throw Object.assign(new Error("A link is required."), { status: 400 });
  if (
    input.transcript != null &&
    (typeof input.transcript !== "string" || input.transcript.length > 24000)
  )
    throw Object.assign(
      new Error("A pasted transcript must contain at most 24,000 characters."),
      { status: 400 },
    );
  const language = input.language || "auto";
  if (
    ![
      "auto",
      "en",
      "ja",
      "hi",
      "es",
      "fr",
      "ko",
      "zh",
      "th",
      "de",
      "pt",
    ].includes(language)
  )
    throw Object.assign(new Error("Choose a supported spoken language."), {
      status: 400,
    });
  return {
    url: canonicalUrl(input.url),
    transcript: input.transcript?.trim() || "",
    readScreen: input.readScreen !== false,
    language,
  };
}
const readCache = (key) => {
  const row = get.get(key, Date.now());
  return row ? JSON.parse(row.payload) : null;
};
const writeCache = (key, value, ttl) => {
  put.run(key, JSON.stringify(value), Date.now() + ttl);
  purge.run(Date.now());
};
const VIDEO_SOURCES = new Set([
  "youtube",
  "instagram",
  "tiktok",
  "vimeo",
  "facebook",
  "twitter",
  "dailymotion",
]);
export async function runImport(input, onProgress = () => {}, services = {}) {
  const { url, transcript, readScreen, language } = normalizeImport(input);
  const model = localModelConfig().model;
  const evidenceKey = hash(
    JSON.stringify([
      "evidence-v2",
      url,
      transcript,
      readScreen,
      language,
      process.env.WHISPER_MODEL || "small",
      process.env.OCR_LANGUAGES || "eng",
    ]),
  );
  const summaryKey = hash(JSON.stringify(["summary-v3", evidenceKey, model]));
  const cached = readCache(summaryKey);
  if (cached)
    return (services.locateImport || locateImport)(
      {
        ...cached,
        cache: { evidence_hit: true, summary_hit: true },
        usage: {
          ...cached.usage,
          input_tokens: 0,
          output_tokens: 0,
          llm_calls: 0,
          paid_api_calls: 0,
        },
      },
      onProgress,
    );
  let extracted = readCache(evidenceKey);
  const evidenceHit = !!extracted;
  if (!extracted) {
    onProgress("metadata");
    const scraped = await (services.extractFromUrl || extractFromUrl)(url);
    let media = null;
    if (!transcript && VIDEO_SOURCES.has(detectSource(url))) {
      try {
        media = await (services.extractMedia || extractMedia)(url, {
          readScreen,
          language,
          onProgress,
        });
      } catch (err) {
        scraped.warnings.push(err.message);
      }
    }
    if (media) {
      scraped.name = media.title || scraped.name;
      scraped.notes = media.description || scraped.notes;
      scraped.image = media.thumbnail || scraped.image;
      scraped.warnings.push(...media.warnings);
    }
    const evidence = buildEvidence(scraped, media, transcript);
    extracted = {
      scraped,
      evidence,
      extraction: {
        transcript_source: transcript
          ? "provided_transcript"
          : media?.transcript_source || null,
        language: media?.language || null,
        duration_seconds: media?.duration || null,
        screen_text_count: media?.screen_text?.length || 0,
        transcript:
          transcript ||
          (media?.transcript || [])
            .map((s) => `[${s.start}s] ${s.text}`)
            .join("\n"),
        coverage: evidence.truncated ? "sampled" : "available_evidence",
        warnings: scraped.warnings,
      },
    };
    // Only meaningful extraction is cached; short TTL for blocked/metadata-only videos.
    writeCache(
      evidenceKey,
      extracted,
      extracted.extraction.transcript_source ? 7 * 86400000 : 60000,
    );
  }
  onProgress("summarizing");
  const summarized = await (services.summarizeScraped || summarizeScraped)(
    extracted.scraped,
    extracted.evidence,
  );
  const result = {
    ...extracted,
    ...summarized,
    cache: { evidence_hit: evidenceHit, summary_hit: false },
  };
  if (summarized.enabled)
    writeCache(
      summaryKey,
      result,
      extracted.extraction.transcript_source ? 7 * 86400000 : 60000,
    );
  return (services.locateImport || locateImport)(result, onProgress);
}
