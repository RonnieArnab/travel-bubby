import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { placesRouter } from "./routes/places.js";
import { visitsRouter } from "./routes/visits.js";
import { extractRouter } from "./routes/extract.js";
import { walksRouter } from "./routes/walks.js";
import { groupsRouter } from "./routes/groups.js";
import { tripsRouter } from "./routes/trips.js";
import { httpLogger, logger } from "./lib/log.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = logger("server");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(httpLogger());

// API routes — registered before the static handler so /api/* is never
// intercepted by the SPA fallback below.
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/places", placesRouter);
app.use("/api/visits", visitsRouter);
app.use("/api/extract", extractRouter);
app.use("/api/walks", walksRouter);
app.use("/api/groups", groupsRouter);
app.use("/api/trips", tripsRouter);

// In production, serve the built React app from ../../client/dist. The build
// step (run on the deploy host) produces that directory; if it doesn't exist
// (e.g. you ran the server in isolation without building the client), we skip
// the static handler so the server still works as an API-only deployment.
const clientDist = process.env.CLIENT_DIST
  ? resolve(process.env.CLIENT_DIST)
  : resolve(__dirname, "../../client/dist");

if (existsSync(clientDist)) {
  log.info("serving client", { from: clientDist });
  app.use(
    express.static(clientDist, {
      // Hashed asset filenames can be cached aggressively; index.html cannot.
      setHeaders: (res, path) => {
        if (path.endsWith("index.html") || path.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (/\.(js|css|woff2?|png|jpg|svg)$/i.test(path)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // SPA fallback — any non-API GET that didn't match a static file gets
  // index.html so client-side routes (e.g. /walks/3/replay) work on direct
  // navigation and reloads.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(resolve(clientDist, "index.html"));
  });
} else {
  log.warn("client/dist not found — serving API only", { expected_at: clientDist });
}

app.use((err, req, res, _next) => {
  logger("error").error(err.message || "unknown error", {
    path: req.originalUrl,
    method: req.method,
    stack: err.stack?.split("\n")[1]?.trim(),
  });
  res.status(500).json({ error: "internal_error", message: err.message });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  log.info("listening", {
    url: `http://localhost:${port}`,
    env: process.env.NODE_ENV || "development",
    log_level: process.env.LOG_LEVEL || "INFO",
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      ? "configured"
      : "missing",
  });
});
