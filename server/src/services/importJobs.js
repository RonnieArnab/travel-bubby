import { randomUUID } from "node:crypto";
import { hash, normalizeImport, runImport } from "./importPipeline.js";

// Local single-worker queue. Completed jobs expire; polling survives client navigation.
export function createImportQueue(run = runImport) {
  const jobs = new Map(),
    inFlight = new Map(),
    pending = [];
  let running = false;
  async function drain() {
    if (running || !pending.length) return;
    running = true;
    const job = pending.shift();
    job.state = "running";
    job.stage = "metadata";
    try {
      job.result = await run(job.input, (stage) => {
        job.stage = stage;
      });
      job.state = "complete";
      job.stage = "complete";
    } catch (error) {
      job.state = "failed";
      job.error = error.message;
    } finally {
      delete job.input;
      inFlight.delete(job.key);
      job.finishedAt = Date.now();
      running = false;
      void drain();
    }
  }
  return {
    create(input) {
      const normalized = normalizeImport(input);
      const key = hash(JSON.stringify(normalized));
      if (inFlight.has(key)) return inFlight.get(key);
      for (const [id, job] of jobs)
        if (job.finishedAt && Date.now() - job.finishedAt > 3600000)
          jobs.delete(id);
      for (const [id, job] of jobs)
        if (jobs.size >= 100 && job.finishedAt) jobs.delete(id);
      if (pending.length >= 4 || jobs.size >= 100)
        throw Object.assign(
          new Error("The local extraction queue is full. Try again shortly."),
          { status: 429 },
        );
      const job = {
        id: randomUUID(),
        key,
        input: normalized,
        state: "queued",
        stage: "queued",
        createdAt: Date.now(),
      };
      jobs.set(job.id, job);
      inFlight.set(key, job.id);
      pending.push(job);
      void drain();
      return job.id;
    },
    get(id) {
      const job = jobs.get(id);
      if (!job) return null;
      const { input, key, ...publicJob } = job;
      return publicJob;
    },
  };
}
