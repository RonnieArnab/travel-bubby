"""Public media -> timestamped evidence. No LLM, cloud transcription, or cookies.
stdout is JSON-lines; all temporary media is deleted by the Node parent.
"""
import csv
import io
import html
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
from urllib.parse import urlparse

MAX_SECONDS = 600
MAX_BYTES = 40 * 1024 * 1024
MAX_TEXT = 24000


def emit(event, **data):
    print(json.dumps({"event": event, **data}, ensure_ascii=False), flush=True)


def public_dns():
    original = socket.getaddrinfo
    def guarded(*args, **kwargs):
        answers = original(*args, **kwargs)
        if any(not ipaddress.ip_address(a[4][0].split("%")[0]).is_global for a in answers):
            raise OSError("Private network destinations are not allowed")
        return answers
    socket.getaddrinfo = guarded


def dedupe_segments(segments):
    result = []
    previous = ""
    size = 0
    for seg in segments:
        text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", seg["text"]))).strip()
        if not text or text == previous:
            continue
        # Remove overlapping words in rolling automatic captions, not later repetitions.
        a, b = previous.split(), text.split()
        for n in range(min(len(a), len(b)), 0, -1):
            if a[-n:] == b[:n]:
                text = " ".join(b[n:]); break
        previous = " ".join(b)
        if not text:
            continue
        if size + len(text) > MAX_TEXT:
            break
        size += len(text)
        result.append({"start": round(max(0, float(seg.get("start", 0))), 2), "text": text[:1000]})
    return result


def parse_subtitles(text, ext):
    if ext == "json3":
        return dedupe_segments([{"start": e.get("tStartMs", 0) / 1000, "text": "".join(s.get("utf8", "") for s in e.get("segs", []))} for e in json.loads(text).get("events", [])])
    def seconds(value):
        parts = value.replace(",", ".").split(":")
        return sum(float(v) * (60 ** i) for i, v in enumerate(reversed(parts)))
    segments = []
    for block in re.split(r"\n\s*\n", text.replace("\r", "")):
        lines = block.splitlines()
        for i, line in enumerate(lines):
            if "-->" in line:
                segments.append({"start": seconds(line.split("-->")[0].strip()), "text": " ".join(lines[i+1:])})
                break
    return dedupe_segments(segments)


def choose_subtitle(info):
    for key, source in [("subtitles", "captions"), ("automatic_captions", "automatic_captions")]:
        languages = info.get(key) or {}
        preferred = [info.get("language"), "en", "en-orig", "en-US", "hi", "ja"] + list(languages)
        for lang in dict.fromkeys(preferred):
            if not lang or lang == "live_chat":
                continue
            entries = languages.get(lang, [])
            for ext in ["json3", "vtt", "srt"]:
                for entry in entries:
                    if entry.get("ext") == ext and entry.get("url", "").startswith("https://"):
                        return entry, lang, source
    return None


def run_local(args, timeout=40):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout


def local_transcribe(media, model_name, language="auto"):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=4,
                         download_root=os.environ.get("WHISPER_CACHE_DIR"),
                         local_files_only=os.environ.get("WHISPER_ALLOW_DOWNLOAD", "0") != "1")
    segments, info = model.transcribe(str(media), beam_size=1, vad_filter=True, condition_on_previous_text=False, language=None if language == "auto" else language, language_detection_segments=3, language_detection_threshold=0.8)
    return dedupe_segments([{"start": s.start, "text": s.text} for s in segments if s.no_speech_prob < 0.7]), info.language


def extract_screen_text(media, duration, workdir):
    ffmpeg = shutil.which("ffmpeg")
    tesseract = shutil.which("tesseract")
    if not ffmpeg or not tesseract:
        return [], "Screen text wasn't read: install FFmpeg and Tesseract to enable local OCR."
    output = []
    seen = set()
    for i in range(8):
        when = min(max(duration - .2, 0), duration * (i + .5) / 8)
        frame = workdir / f"frame-{i}.png"
        try:
            run_local([ffmpeg, "-nostdin", "-loglevel", "error", "-protocol_whitelist", "file,pipe", "-ss", str(when), "-i", str(media), "-frames:v", "1", "-vf", "scale=960:-2", "-y", str(frame)])
            tsv = run_local([tesseract, str(frame), "stdout", "-l", os.environ.get("OCR_LANGUAGES", "eng"), "--psm", "11", "tsv"], 15)
            lines = {}
            for word in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
                text = (word.get("text") or "").strip()
                confidence = float(word.get("conf") or -1)
                if not text or confidence < 60:
                    continue
                key = tuple(word.get(k) for k in ("block_num", "par_num", "line_num"))
                lines.setdefault(key, []).append(text)
            kept = 0
            for words in lines.values():
                line = " ".join(words)
                normalized = re.sub(r"\W+", "", line).lower()
                if len(normalized) >= 6 and normalized not in seen:
                    seen.add(normalized); output.append({"start": round(when, 2), "text": line[:250]})
                    kept += 1
                if kept >= 8:
                    break
            if len(output) >= 80:
                break
        except (subprocess.SubprocessError, OSError):
            return output, "Some sampled frames could not be read."
    return output, None


def extract(url, workdir, read_screen=True, language="auto"):
    import yt_dlp
    warnings = []
    class QuietLogger:
        def debug(self, _): pass
        def warning(self, _): pass
        def error(self, _): pass
    def limit_download(status):
        if status.get("downloaded_bytes", 0) > MAX_BYTES:
            raise RuntimeError("Download exceeds the 40 MB limit")
    options = {
        "quiet": True, "no_warnings": True, "logger": QuietLogger(), "noplaylist": True,
        "playlistend": 1, "socket_timeout": 12, "retries": 1, "fragment_retries": 1,
        "extractor_retries": 1, "proxy": "", "cachedir": False,
        "max_filesize": MAX_BYTES, "progress_hooks": [limit_download],
        "js_runtimes": {"node": {}}, "outtmpl": str(workdir / "media.%(ext)s"),
        "allowed_extractors": ["default", "-generic"],
    }
    emit("progress", stage="metadata")
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)
        if not info or info.get("_type") in ["playlist", "multi_video"]:
            raise ValueError("Use a link to one video, not a playlist or profile.")
        duration = info.get("duration")
        if info.get("is_live") or (duration and duration > MAX_SECONDS):
            raise ValueError("Use a recorded clip under 10 minutes.")
        result = {"title": (info.get("title") or "")[:500], "description": (info.get("description") or "")[:8000],
                  "duration": duration, "thumbnail": info.get("thumbnail"), "language": info.get("language"),
                  "transcript": [], "transcript_source": None, "screen_text": [], "warnings": warnings}
        chosen = choose_subtitle(info)
        if chosen:
            emit("progress", stage="captions")
            entry, caption_language, source = chosen
            try:
                with ydl.urlopen(entry["url"]) as response:
                    raw = response.read(2_000_001)
                if len(raw) > 2_000_000: raise ValueError("Subtitles too large")
                result["transcript"] = parse_subtitles(raw.decode("utf-8"), entry["ext"])
                if result["transcript"]:
                    result.update(transcript_source=source, language=caption_language)
            except Exception:
                warnings.append("The available captions could not be downloaded; trying audio instead.")
        want_ocr = read_screen and bool(shutil.which("tesseract")) and bool(shutil.which("ffmpeg"))
        if read_screen and not want_ocr:
            warnings.append("Screen text wasn't read: local FFmpeg or Tesseract is missing.")
        if not result["transcript"] or want_ocr or not duration:
            emit("progress", stage="download")
            # A single low-resolution file for OCR; audio-only when frames aren't needed.
            ydl.params["format"] = "best[height<=480]/worst" if want_ocr else "bestaudio/best"
            try:
                downloaded = ydl.extract_info(url, download=True)
                media = Path(ydl.prepare_filename(downloaded))
                if not media.is_file() or media.stat().st_size > MAX_BYTES:
                    raise ValueError("No media within the 40 MB size limit.")
                probe = shutil.which("ffprobe")
                if probe:
                    measured = run_local([probe, "-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(media)], 15)
                    duration = float(measured.strip())
                if not duration or duration <= 0 or duration > MAX_SECONDS:
                    raise ValueError("The downloaded clip must be under 10 minutes with a measurable duration.")
                result["duration"] = duration
                if not result["transcript"]:
                    emit("progress", stage="transcribing")
                    try:
                        segments, language = local_transcribe(media, os.environ.get("WHISPER_MODEL", "small"), language)
                        result.update(transcript=segments, language=language, transcript_source="local_whisper" if segments else None)
                        if not segments: warnings.append("No clear speech was detected in the audio.")
                    except Exception:
                        warnings.append("Local transcription unavailable. Install faster-whisper and download its model with the setup script.")
                if want_ocr:
                    emit("progress", stage="screen_text")
                    result["screen_text"], warning = extract_screen_text(media, duration, workdir)
                    if warning: warnings.append(warning)
            except ValueError as error:
                warnings.append(str(error))
            except Exception:
                warnings.append("Media could not be downloaded within the limits. The platform may require login or restrict downloads.")
        emit("result", result=result)


if __name__ == "__main__":
    try:
        url, folder, screen, language = sys.argv[1:]
        host = (urlparse(url).hostname or "").lower()
        domains = ("youtube.com", "youtu.be", "instagram.com", "tiktok.com", "vimeo.com", "facebook.com", "fb.watch", "dailymotion.com", "dai.ly", "x.com", "twitter.com")
        if urlparse(url).scheme not in ("http", "https") or not any(host == d or host.endswith("." + d) for d in domains):
            raise ValueError("This video platform is not supported.")
        public_dns()
        extract(url, Path(folder), screen == "1", language)
    except Exception:
        emit("error", message="Video extraction unavailable. Check the local tools, use a single public video link, or paste a transcript. Login-required and restricted videos are not bypassed.")
        sys.exit(1)
