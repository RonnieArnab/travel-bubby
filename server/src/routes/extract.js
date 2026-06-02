import { Router } from "express";
import { extractFromUrl } from "../services/extractor.js";
import { summarizeScraped } from "../services/summarizer.js";

export const extractRouter = Router();

extractRouter.post("/", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url_required" });
  }
  try {
    const data = await extractFromUrl(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "extract_failed", message: String(err?.message ?? err) });
  }
});

// Scrape + AI-summarize. Returns both raw scrape and structured summary so the
// client can fall back to the raw fields when summarization isn't available.
extractRouter.post("/summarize", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url_required" });
  }
  try {
    const scraped = await extractFromUrl(url);
    const summary = await summarizeScraped(scraped);
    res.json({ scraped, ...summary });
  } catch (err) {
    res.status(500).json({
      error: "summarize_failed",
      message: String(err?.message ?? err),
    });
  }
});
