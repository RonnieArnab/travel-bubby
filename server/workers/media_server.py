"""Small HTTP wrapper for the open-source media extractor.

Run this on a machine with FFmpeg, yt-dlp, Tesseract (optional), and the
faster-whisper dependencies installed. The Node app can call it with
MEDIA_WORKER_URL, which keeps heavy media work off a small Render web service.
"""
import contextlib
import io
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from media_extract import extract, public_dns


TOKEN = os.environ.get("MEDIA_WORKER_TOKEN", "")
SLOT = threading.BoundedSemaphore(1)


def run_extraction(payload):
    url = str(payload.get("url", "")).strip()
    parsed = urlparse(url)
    domains = (
        "youtube.com", "youtu.be", "instagram.com", "tiktok.com", "vimeo.com",
        "facebook.com", "fb.watch", "dailymotion.com", "dai.ly", "x.com", "twitter.com",
    )
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in ("http", "https") or not any(
        host == domain or host.endswith("." + domain) for domain in domains
    ):
        raise ValueError("This video platform is not supported.")
    public_dns()
    import tempfile

    output = io.StringIO()
    with tempfile.TemporaryDirectory(prefix="travel-media-worker-") as folder:
        with contextlib.redirect_stdout(output):
            extract(
                url,
                Path(folder),
                bool(payload.get("readScreen", True)),
                payload.get("language", "auto"),
            )
    for line in output.getvalue().splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("event") == "result":
            return event["result"]
        if event.get("event") == "error":
            raise RuntimeError(event.get("message", "Media extraction failed."))
    raise RuntimeError("Media extraction did not return a result.")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def _json(self, status, body):
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True})
        else:
            self._json(404, {"message": "Not found."})

    def do_POST(self):
        if self.path != "/extract":
            self._json(404, {"message": "Not found."})
            return
        if TOKEN and self.headers.get("Authorization") != f"Bearer {TOKEN}":
            self._json(401, {"message": "Unauthorized."})
            return
        acquired = False
        try:
            acquired = SLOT.acquire(blocking=False)
            if not acquired:
                self._json(429, {"message": "The media worker is busy. Try again shortly."})
                return
            size = int(self.headers.get("Content-Length", "0"))
            if size > 65536:
                raise ValueError("Request is too large.")
            payload = json.loads(self.rfile.read(size))
            self._json(200, {"result": run_extraction(payload)})
        except Exception as error:
            self._json(400, {"message": str(error)})
        finally:
            if acquired:
                SLOT.release()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8787"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
