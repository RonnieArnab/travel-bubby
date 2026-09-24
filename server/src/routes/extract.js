import { Router } from "express";
import { extractFromUrl } from "../services/extractor.js";
import { createImportQueue } from "../services/importJobs.js";
import { normalizeImport } from "../services/importPipeline.js";

export const extractRouter = Router();
const queue = createImportQueue();
const fail = (res, error) =>
  res
    .status(error.status || 500)
    .json({ error: "extract_failed", message: error.message });
extractRouter.post("/", async (req, res) => {
  try {
    const input = normalizeImport(req.body);
    res.json(await extractFromUrl(input.url));
  } catch (error) {
    fail(res, error);
  }
});
extractRouter.post("/jobs", (req, res) => {
  try {
    const id = queue.create(req.body);
    res.status(202).json({ id, status_url: `/api/extract/jobs/${id}` });
  } catch (error) {
    fail(res, error);
  }
});
extractRouter.get("/jobs/:id", (req, res) => {
  const job = queue.get(req.params.id);
  if (!job)
    return res
      .status(404)
      .json({
        error: "job_not_found",
        message:
          "This import expired or the server restarted. Submit the link again; cached evidence can still be reused.",
      });
  res.setHeader("Cache-Control", "no-store");
  res.json(job);
});
// Compatibility for old clients. Uses the same bounded queue, never a second LLM path.
extractRouter.post("/summarize", async (req, res) => {
  try {
    const id = queue.create(req.body);
    while (!res.destroyed) {
      const job = queue.get(id);
      if (job.state === "complete") return res.json(job.result);
      if (job.state === "failed") throw new Error(job.error);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  } catch (error) {
    if (!res.destroyed) fail(res, error);
  }
});
