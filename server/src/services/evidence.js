// Keep cheap, auditable evidence separate from model output.
export function buildEvidence(scraped, media, suppliedTranscript = "") {
  const all = [];
  const add = (source, text, seconds = null) => {
    if (typeof text !== "string" || !text.trim()) return;
    const normalized = text.replace(/\s+/g, " ").trim();
    // Small chunks make the budget useful for both English and multibyte scripts.
    for (const chunk of normalized.match(/.{1,300}(?:\s|$)|.{1,300}/gu) || []) {
      all.push({
        id: `e${all.length + 1}`,
        source,
        seconds,
        text: chunk.trim(),
      });
    }
  };
  add("title", media?.title || scraped.name);
  for (const line of (media?.description || scraped.notes || "")
    .slice(0, 8000)
    .split(/\n\s*\n/))
    add("caption", line);
  if (suppliedTranscript) add("provided_transcript", suppliedTranscript);
  else
    for (const item of media?.transcript || [])
      add(media.transcript_source || "transcript", item.text, item.start);
  for (const item of media?.screen_text || [])
    add("screen_text", item.text, item.start);
  const chosen = [];
  let bytes = 0;
  for (const [sources, budget] of [
    [["title", "caption"], 2400],
    [
      [
        "provided_transcript",
        "captions",
        "automatic_captions",
        "local_whisper",
        "transcript",
      ],
      5400,
    ],
    [["screen_text"], 1200],
  ]) {
    const candidates = all.filter((e) => sources.includes(e.source));
    const sizeOf = (items) =>
      items.reduce(
        (sum, item) => sum + Buffer.byteLength(JSON.stringify(item)),
        0,
      );
    let sample = candidates;
    // Reduce evenly across the complete transcript, retaining both ends.
    for (
      let count = candidates.length - 1;
      sizeOf(sample) > budget && count > 0;
      count--
    ) {
      sample = Array.from(
        { length: count },
        (_, i) =>
          candidates[
            count === 1
              ? 0
              : Math.round((i * (candidates.length - 1)) / (count - 1))
          ],
      );
    }
    const size = sizeOf(sample);
    if (size <= budget) {
      chosen.push(...sample);
      bytes += size;
    }
  }
  return {
    items: chosen,
    total_items: all.length,
    truncated: chosen.length < all.length,
    bytes,
  };
}
