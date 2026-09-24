import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const worker = fileURLToPath(
  new URL("../../workers/media_extract.py", import.meta.url),
);
const localPython = fileURLToPath(
  new URL("../../.venv/bin/python", import.meta.url),
);
const whisperCache = fileURLToPath(
  new URL("../../data/whisper", import.meta.url),
);

async function extractWithWorker(
  url,
  { readScreen = true, language = "auto", onProgress = () => {} } = {},
) {
  const endpoint = new URL(process.env.MEDIA_WORKER_URL);
  if (endpoint.protocol !== "https:" && process.env.NODE_ENV === "production")
    throw new Error("MEDIA_WORKER_URL must use HTTPS in production.");
  onProgress("download");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MEDIA_WORKER_TOKEN
        ? { Authorization: `Bearer ${process.env.MEDIA_WORKER_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ url, readScreen, language }),
    signal: AbortSignal.timeout(260000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {}
  if (!response.ok)
    throw new Error(
      body?.message || `Media worker returned HTTP ${response.status}.`,
    );
  const result = body?.result || body;
  if (!result || !Array.isArray(result.transcript))
    throw new Error("Media worker returned an invalid extraction.");
  if (result.transcript_source) onProgress("summarizing");
  return result;
}

export async function extractMedia(
  url,
  { readScreen = true, language = "auto", onProgress = () => {} } = {},
) {
  if (process.env.MEDIA_WORKER_URL)
    return extractWithWorker(url, { readScreen, language, onProgress });
  const directory = await mkdtemp(join(tmpdir(), "travel-media-"));
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(
        process.env.MEDIA_PYTHON ||
          (existsSync(localPython) ? localPython : "python3"),
        [worker, url, directory, readScreen ? "1" : "0", language],
        {
          detached: process.platform !== "win32",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            WHISPER_CACHE_DIR: process.env.WHISPER_CACHE_DIR || whisperCache,
            PYTHONUNBUFFERED: "1",
          },
        },
      );
      let buffer = "",
        bytes = 0,
        result,
        error;
      const kill = () => {
        try {
          if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {}
      };
      const timer = setTimeout(() => {
        error =
          "Video processing reached the 4-minute limit. Try a shorter clip or paste its transcript.";
        kill();
      }, 240000);
      child.stdout.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 500000) {
          error = "Video evidence exceeded the output limit.";
          kill();
          return;
        }
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          try {
            const message = JSON.parse(line);
            if (message.event === "progress") onProgress(message.stage);
            if (message.event === "result") result = message.result;
            if (message.event === "error") error = message.message;
          } catch {}
        }
      });
      child.stderr.resume(); // Do not expose cookies, media URLs or Python diagnostics to clients.
      child.on("error", () => {
        clearTimeout(timer);
        reject(
          new Error(
            "Local video tools are not installed. Run the media setup script.",
          ),
        );
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && result) resolve(result);
        else
          reject(
            new Error(
              error ||
                "Local video extraction failed. The platform may restrict this video.",
            ),
          );
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
