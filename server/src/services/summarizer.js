// Gemini-backed travel-summary service. Same contract as the previous
// Claude-based one: takes the scraped {source, name, notes, image, ...} object
// and returns { enabled, used_image, usage, summary } or { enabled: false,
// reason } when no API key is configured.
//
// We use Gemini's REST API directly (no SDK dependency) so the dev install
// stays small. The free tier on aistudio.google.com gives ~15 req/min and
// ~1500/day for gemini-2.5-flash, with vision included.

import { logger } from "../lib/log.js";

const log = logger("summarize");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const SYSTEM_PROMPT = `You are TravelBuddy AI, an extraction model for travel content.

You receive scraped data from social posts (Instagram reels, YouTube shorts, WhatsApp shares, Google Maps URLs, blog posts, etc.) and, when available, a thumbnail image.

Your job is to UNDERSTAND the content — do not parrot the title, description, or tag list. Read the caption like a person, look at the image, and extract what a traveller actually wants to know:

- WHAT the place is (a market, a viewpoint, a restaurant, a temple, a hidden alley shop, an experience…)
- WHERE it is (city, neighborhood, country if you can tell)
- WHY someone would go (the actual draw — best views at sunset, $2 momos, 18th-century mosaics, queue is short before 10am, etc.)
- WHAT to do / order / see specifically (named dishes, specific viewpoints, specific shops, ticketing tips)
- Practical notes (timing, cost, how to get there, gotchas) when the source mentions them

Write your summary as 3-7 SHORT bullet points, each one a concrete piece of information a traveller could act on. Avoid filler ("This reel showcases…", "The video discusses…"). Avoid lifting full sentences from the caption — paraphrase tightly.

If the source is too thin to summarize honestly (e.g. an Instagram reel where Open Graph only gave you a generic title), say so plainly in one bullet rather than inventing detail.

Always respond with the exact JSON schema you've been given. Set confidence: "high" only when the caption AND the image clearly support the summary; "medium" when one of them is weak; "low" when you're mostly guessing from a thin scrape.`;

// Gemini's responseSchema is OpenAPI 3.0-ish — types in UPPERCASE, no
// $schema, no additionalProperties, no minItems/maxItems on arrays.
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    suggested_name: {
      type: "STRING",
      description:
        "A concise, place-style name suitable as a saved-place title (e.g. 'Kumbhalgarh Fort', 'Tomoda Ramen, Shibuya'). NOT the social-post title.",
    },
    category: {
      type: "STRING",
      enum: [
        "restaurant",
        "cafe",
        "street_food",
        "market",
        "shop",
        "viewpoint",
        "landmark",
        "museum",
        "park",
        "beach",
        "temple",
        "bar",
        "hotel",
        "activity",
        "neighborhood",
        "transit",
        "other",
      ],
      description: "Best-fit category.",
    },
    location_hint: {
      type: "STRING",
      description: "Free-text location string. Empty string if unclear.",
    },
    summary_points: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "3–7 short bullet points of what a traveller actually needs to know.",
    },
    things_to_do: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "Specific dishes / sights / shops / activities. Empty if not applicable.",
    },
    tags: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "Short descriptive tags ('sunset', 'budget', 'queue-early'). Max 8.",
    },
    best_time: {
      type: "STRING",
      description:
        "When to visit if the content suggests it. Empty if unknown.",
    },
    confidence: {
      type: "STRING",
      enum: ["high", "medium", "low"],
    },
  },
  required: [
    "suggested_name",
    "category",
    "location_hint",
    "summary_points",
    "things_to_do",
    "tags",
    "best_time",
    "confidence",
  ],
  propertyOrdering: [
    "suggested_name",
    "category",
    "location_hint",
    "summary_points",
    "things_to_do",
    "tags",
    "best_time",
    "confidence",
  ],
};

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 TravelBuddy/0.2" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null; // 5 MB cap (Gemini inline limit is 20MB but we stay polite)
    return { mediaType: ct.split(";")[0], data: buf.toString("base64") };
  } catch (err) {
    log.warn("image fetch failed", { url, reason: err.message });
    return null;
  }
}

function buildUserParts(scraped, image) {
  const lines = [
    `Source: ${scraped.source}`,
    scraped.sourceUrl ? `URL: ${scraped.sourceUrl}` : null,
    scraped.name ? `Title (raw): ${scraped.name}` : null,
    scraped.notes ? `Caption / description (raw):\n${scraped.notes}` : null,
    scraped.lat != null && scraped.lng != null
      ? `Coordinates already detected: ${scraped.lat}, ${scraped.lng}`
      : null,
  ].filter(Boolean);

  const parts = [];
  if (image) {
    parts.push({
      inline_data: { mime_type: image.mediaType, data: image.data },
    });
    parts.push({
      text: "The image above is the post thumbnail. Use it as a primary signal for what the place actually looks like.",
    });
  }
  parts.push({
    text:
      "Below is what was scraped from the post. UNDERSTAND it (don't restate it) and produce the structured summary per the schema.\n\n" +
      lines.join("\n"),
  });
  return parts;
}

export async function summarizeScraped(scraped) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      enabled: false,
      reason:
        "GEMINI_API_KEY is not set on the server. Get a free key at aistudio.google.com, set it, and restart to enable AI summaries.",
    };
  }

  const t0 = Date.now();
  const image = await fetchImageAsBase64(scraped.image);

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: buildUserParts(scraped, image),
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_SCHEMA,
      maxOutputTokens: 2048,
      temperature: 0.4,
    },
  };

  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  log.info("summarize start", {
    model: MODEL,
    used_image: !!image,
    source: scraped.source,
  });

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    log.error("gemini fetch failed", { reason: err.message });
    throw new Error(`Gemini request failed: ${err.message}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    log.error("gemini non-2xx", {
      status: res.status,
      body: errText.slice(0, 300),
    });
    throw new Error(`Gemini returned ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  if (!text) {
    log.error("gemini empty response", { keys: Object.keys(data) });
    throw new Error(
      "Gemini returned no text content. Response: " +
        JSON.stringify(data).slice(0, 200),
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    log.error("gemini non-json", { snippet: text.slice(0, 200) });
    throw new Error("Gemini returned non-JSON: " + text.slice(0, 200));
  }

  const usage = data.usageMetadata ?? {};
  log.info("summarize done", {
    model: MODEL,
    ms: Date.now() - t0,
    in_tok: usage.promptTokenCount,
    out_tok: usage.candidatesTokenCount,
    confidence: parsed.confidence,
  });

  return {
    enabled: true,
    used_image: !!image,
    usage: {
      input_tokens: usage.promptTokenCount ?? 0,
      output_tokens: usage.candidatesTokenCount ?? 0,
      total_tokens: usage.totalTokenCount ?? 0,
    },
    summary: parsed,
  };
}
