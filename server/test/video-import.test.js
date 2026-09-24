import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { isPublicAddress, parsePublicUrl } from "../src/services/publicUrl.js";
import { buildEvidence } from "../src/services/evidence.js";
import {
  validateSummary,
  summarizeScraped,
  localModelConfig,
  parseStructuredContent,
} from "../src/services/summarizer.js";
import { detectSource } from "../src/services/extractor.js";

const directory = await mkdtemp(join(tmpdir(), "travel-import-tests-"));
process.env.DATA_DIR = directory;
const { canonicalUrl, normalizeImport } =
  await import("../src/services/importPipeline.js");
const { createImportQueue } = await import("../src/services/importJobs.js");
const { db } = await import("../src/db/index.js");
test.after(async () => {
  db.close();
  await rm(directory, { recursive: true, force: true });
});

test("structured model output accepts fenced JSON and reasoning wrappers", () => {
  assert.deepEqual(parseStructuredContent('```json\n{"places":[]}\n```'), {
    places: [],
  });
  assert.deepEqual(
    parseStructuredContent('<think>Checking the evidence.</think> {"places":[]}'),
    { places: [] },
  );
});

test("public imports reject private, disguised, credential and non-web links", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.16.0.5",
    "192.168.1.1",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  for (const url of [
    "http://127.1",
    "http://0x7f000001",
    "http://localhost",
    "http://a.local",
    "http://[::1]",
    "http://user:pass@example.com",
    "file:///etc/passwd",
    "https://example.com:8080",
  ])
    assert.throws(() => parsePublicUrl(url));
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  assert.equal(detectSource("https://evil.com/?youtube.com"), "web");
  assert.equal(detectSource("https://www.instagram.com/p/test/"), "instagram");
});
test("canonical URLs reuse a single video cache without losing distinct video IDs", () => {
  assert.equal(
    canonicalUrl("https://youtu.be/BaW_jenozKc?si=abc"),
    canonicalUrl("https://youtube.com/shorts/BaW_jenozKc?utm_source=share"),
  );
  assert.equal(
    canonicalUrl("https://instagram.com/p/one/?igsh=abc#fragment"),
    "https://instagram.com/p/one/",
  );
  assert.throws(() =>
    normalizeImport({
      url: "https://example.com",
      transcript: "x".repeat(24001),
    }),
  );
});
test("evidence budgets preserve early and late destinations, OCR, and timestamps", () => {
  const transcript = Array.from({ length: 150 }, (_, i) => ({
    start: i,
    text: `Stop ${i}: visit this named restaurant and order its signature food. `.repeat(
      4,
    ),
  }));
  const evidence = buildEvidence(
    { name: "Trip", notes: "caption spam ".repeat(900) },
    {
      transcript,
      transcript_source: "local_whisper",
      screen_text: [{ start: 40, text: "錦市場 京都" }],
    },
  );
  assert.ok(evidence.bytes <= 9000);
  assert.ok(evidence.truncated);
  assert.ok(evidence.items.some((item) => item.seconds === 0));
  assert.ok(evidence.items.some((item) => item.seconds === 149));
  assert.ok(evidence.items.some((item) => item.source === "screen_text"));
  assert.ok(
    buildEvidence({}, null, "日本語の文字".repeat(500)).items.length > 0,
  );
});
test("model output must cite supplied evidence; malformed places cannot escape validation", () => {
  const evidence = {
    items: [
      {
        id: "e1",
        text: "Nishiki Market in Kyoto",
        source: "provided_transcript",
      },
    ],
  };
  const result = validateSummary(
    {
      summary_points: [],
      places: [
        null,
        { name: "Invented", evidence_ids: ["unknown"] },
        {
          name: "Nishiki Market",
          kind: "named_place",
          evidence_ids: ["e1"],
          confidence: "invalid",
        },
      ],
    },
    evidence,
  );
  assert.equal(result.places.length, 1);
  assert.equal(result.places[0].confidence, "low");
  assert.equal(result.places[0].evidence[0].text, evidence.items[0].text);
});
test("queue deduplicates active imports, serializes work, and recovers after failure", async () => {
  let running = 0,
    peak = 0,
    calls = 0;
  const queue = createImportQueue(async (input) => {
    calls++;
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 10));
    running--;
    if (input.url.includes("fail")) throw new Error("fixture failure");
    return { success: true };
  });
  const one = queue.create({ url: "https://example.com/one" });
  assert.equal(queue.create({ url: "https://example.com/one" }), one);
  const bad = queue.create({ url: "https://example.com/fail" });
  const three = queue.create({ url: "https://example.com/three" });
  for (let i = 0; i < 100 && queue.get(three).state !== "complete"; i++)
    await new Promise((r) => setTimeout(r, 5));
  assert.equal(peak, 1);
  assert.equal(calls, 3);
  assert.equal(queue.get(bad).state, "failed");
  assert.equal(queue.get(three).state, "complete");
  assert.equal(queue.get(one).input, undefined);
});
test("local model makes one bounded text request and never falls back to a paid provider", async () => {
  const previousUrl = process.env.OLLAMA_URL,
    previousModel = process.env.OLLAMA_MODEL;
  let calls = 0;
  const server = createServer(async (req, res) => {
    calls++;
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    assert.equal(req.url, "/api/chat");
    assert.equal(data.think, false);
    assert.equal(data.stream, false);
    assert.equal(data.options.num_predict, 1800);
    assert.equal(data.messages.length, 2);
    assert.equal(data.messages[1].images, undefined);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        message: {
          content: JSON.stringify({
            summary_points: ["Visit Kyoto"],
            places: [
              {
                name: "Nishiki Market",
                kind: "named_place",
                location: "Kyoto",
                evidence_ids: ["e1"],
                notes: ["Try food"],
                confidence: "high",
              },
            ],
          }),
        },
        eval_count: 35,
        prompt_eval_count: 150,
      }),
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    process.env.OLLAMA_URL = `http://127.0.0.1:${server.address().port}`;
    const result = await summarizeScraped(
      { source: "instagram" },
      {
        items: [
          {
            id: "e1",
            source: "provided_transcript",
            text: "Visit Nishiki Market in Kyoto.",
          },
        ],
      },
    );
    assert.equal(result.enabled, true);
    assert.equal(calls, 1);
    assert.equal(result.usage.paid_api_calls, 0);
    process.env.OLLAMA_MODEL = "qwen3:cloud";
    assert.throws(localModelConfig);
    process.env.OLLAMA_MODEL = "qwen3:4b";
    process.env.OLLAMA_URL = "https://api.example.com";
    assert.equal(localModelConfig().remote, true);
  } finally {
    await new Promise((r) => server.close(r));
    if (previousUrl === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = previousUrl;
    if (previousModel === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = previousModel;
  }
});

test("persistent caches skip repeated media and LLM work, and preserve evidence when a model was unavailable", async () => {
  const { runImport } = await import("../src/services/importPipeline.js");
  let scrapeCalls = 0,
    mediaCalls = 0,
    modelCalls = 0,
    available = false;
  const services = {
    extractFromUrl: async (url) => {
      scrapeCalls++;
      return { name: "Japan", source: "youtube", sourceUrl: url, warnings: [] };
    },
    extractMedia: async () => {
      mediaCalls++;
      return {
        title: "Japan",
        transcript_source: "captions",
        transcript: [{ start: 0, text: "Visit Nishiki Market in Kyoto" }],
        warnings: [],
      };
    },
    summarizeScraped: async () => {
      modelCalls++;
      return available
        ? {
            enabled: true,
            summary: { places: [] },
            usage: { llm_calls: 1, paid_api_calls: 0 },
          }
        : { enabled: false, reason: "model unavailable" };
    },
  };
  const input = { url: "https://youtu.be/abcdefghijk", readScreen: false };
  const first = await runImport(input, () => {}, services);
  assert.equal(first.enabled, false);
  available = true;
  const second = await runImport(input, () => {}, services);
  assert.equal(second.cache.evidence_hit, true);
  assert.equal(second.cache.summary_hit, false);
  const third = await runImport(input, () => {}, services);
  assert.equal(third.cache.summary_hit, true);
  assert.equal(third.usage.llm_calls, 0);
  assert.equal(scrapeCalls, 1);
  assert.equal(mediaCalls, 1);
  assert.equal(modelCalls, 2);
  await runImport(
    { ...input, transcript: "Different supplied words" },
    () => {},
    services,
  );
  assert.equal(scrapeCalls, 2);
  assert.equal(mediaCalls, 1);
  assert.equal(modelCalls, 3);
});

test("generic shopping suggestions stay separate and unsupported numeric claims are dropped", () => {
  const evidence = {
    items: [
      { id: "e1", source: "caption", text: "ABC-MART sells shoes on sale." },
      {
        id: "e2",
        source: "caption",
        text: "Try used camera shops for cameras under $10.",
      },
    ],
  };
  const summary = validateSummary(
    {
      places: [
        {
          name: "ABC-MART",
          kind: "named_chain",
          notes: ["Shoes on sale", "Shoes cost $10"],
          evidence_ids: ["e1"],
        },
        {
          name: "Used camera shops",
          kind: "unnamed",
          notes: ["Cameras under $10"],
          evidence_ids: ["e2"],
        },
      ],
    },
    evidence,
  );
  assert.equal(summary.places.length, 1);
  assert.deepEqual(summary.places[0].notes, ["Shoes on sale"]);
  assert.equal(summary.unlocated_tips.length, 1);
  assert.throws(() =>
    normalizeImport({ url: "https://example.com", language: "not-a-language" }),
  );
  assert.equal(
    normalizeImport({ url: "https://example.com", language: "en" }).language,
    "en",
  );
});
