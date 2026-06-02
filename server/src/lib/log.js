// Tiny structured logger. Output format:
//   2026-05-07T10:23:45.123Z  INFO  http      GET /api/places 200 12ms ip=127.0.0.1
//   2026-05-07T10:23:45.456Z  WARN  walks     append-point id=3 lat=12.97 lng=77.59 visited=2
//   2026-05-07T10:23:45.789Z  ERROR extract   fetch failed url=https://… reason="connect ECONNREFUSED"
//
// Always one line per event, ISO timestamp, fixed-width level + module columns,
// then a free-form message and key=value pairs. Survives `grep | awk` triage.

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
const LEVEL = (process.env.LOG_LEVEL || "INFO").toUpperCase();
const MIN = LEVELS[LEVEL] ?? LEVELS.INFO;
const COLOR = process.stdout.isTTY && process.env.NO_COLOR == null;

const C = {
  dim: COLOR ? "\x1b[2m" : "",
  reset: COLOR ? "\x1b[0m" : "",
  cyan: COLOR ? "\x1b[36m" : "",
  yellow: COLOR ? "\x1b[33m" : "",
  red: COLOR ? "\x1b[31m" : "",
  gray: COLOR ? "\x1b[90m" : "",
  bold: COLOR ? "\x1b[1m" : "",
};

const LEVEL_COLOR = {
  DEBUG: C.gray,
  INFO: C.cyan,
  WARN: C.yellow,
  ERROR: C.red,
};

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function fmtKv(meta) {
  if (!meta) return "";
  const parts = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined) continue;
    let s;
    if (v === null) s = "null";
    else if (typeof v === "string") s = /[\s"=]/.test(v) ? JSON.stringify(v) : v;
    else if (typeof v === "object") s = JSON.stringify(v);
    else s = String(v);
    parts.push(`${k}=${s}`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function emit(level, mod, msg, meta) {
  if (LEVELS[level] < MIN) return;
  const ts = new Date().toISOString();
  const line =
    `${C.dim}${ts}${C.reset}  ` +
    `${LEVEL_COLOR[level] ?? ""}${pad(level, 5)}${C.reset} ` +
    `${C.bold}${pad(mod, 9)}${C.reset} ` +
    `${msg}${C.dim}${fmtKv(meta)}${C.reset}`;
  if (level === "ERROR") console.error(line);
  else console.log(line);
}

export function logger(mod) {
  return {
    debug: (msg, meta) => emit("DEBUG", mod, msg, meta),
    info: (msg, meta) => emit("INFO", mod, msg, meta),
    warn: (msg, meta) => emit("WARN", mod, msg, meta),
    error: (msg, meta) => emit("ERROR", mod, msg, meta),
  };
}

// Express request logger middleware. Logs once on response finish so the
// status code and latency are accurate.
export function httpLogger() {
  const log = logger("http");
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const meta = {
        ip: req.ip,
        bytes: res.getHeader("content-length"),
      };
      const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`;
      const lvl = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
      emit(lvl, "http", msg, meta);
    });
    next();
  };
}
