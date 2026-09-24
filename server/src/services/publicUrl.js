import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0)
    );
  }
  // Only globally routable unicast IPv6, excluding documentation/transition space.
  const ip = address.toLowerCase();
  return (
    isIP(ip) === 6 &&
    /^[23]/.test(ip) &&
    !/^2001:(db8|0:|10:|2:)/.test(ip) &&
    !ip.startsWith("2002:")
  );
}
export function parsePublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error("Enter a valid public https or http link."), {
      status: 400,
    });
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    url.href.length > 2048
  )
    throw Object.assign(
      new Error(
        "Use a public http or https link without credentials or a custom port.",
      ),
      { status: 400 },
    );
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    (isIP(host) && !isPublicAddress(host))
  )
    throw Object.assign(
      new Error("Local and private network links cannot be imported."),
      { status: 400 },
    );
  return url;
}

// Resolve and pin the address on every redirect to prevent DNS rebinding and SSRF.
export async function fetchPublicText(raw, redirects = 0) {
  const url = parsePublicUrl(raw);
  if (redirects > 4) throw new Error("Too many redirects.");
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), {
    all: true,
  });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("The link resolves to a private network address.");
  const selected = addresses[0];
  const response = await new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).get(
      url,
      {
        headers: {
          "User-Agent": "TravelBuddy/1.0 (public travel link importer)",
          Accept: "text/html,application/xhtml+xml",
        },
        lookup: (_host, options, cb) =>
          options.all
            ? cb(null, [selected])
            : cb(null, selected.address, selected.family),
        signal: AbortSignal.timeout(12000),
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          resolve({ redirect: new URL(res.headers.location, url).href });
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`The site returned HTTP ${res.statusCode}.`));
          return;
        }
        if (
          !/text\/html|application\/xhtml/i.test(
            res.headers["content-type"] || "",
          )
        ) {
          res.resume();
          reject(new Error("This link did not return a web page."));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 2_000_000)
            res.destroy(new Error("Page exceeds the 2 MB limit."));
          else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            html: Buffer.concat(chunks).toString("utf8"),
            finalUrl: url.href,
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
  });
  return response.redirect
    ? fetchPublicText(response.redirect, redirects + 1)
    : response;
}
