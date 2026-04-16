/**
 * Share link codec.
 *
 * Results travel entirely in the URL fragment (`location.hash`) — nothing
 * hits the server on share, nothing is stored. We gzip + base64url the
 * JSON to fit a full report (dozens of apps) in a ~2–4 KB hash.
 *
 * Uses the Web Compression Streams API, which is available on both
 * modern browsers and Node ≥ 18. No dependency needed.
 */

export type SharePayload = {
  v: 1;
  summary: unknown;
  scored: unknown;
  unmatched?: unknown;
  generated_at: string;
};

export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = JSON.stringify(payload);
  const compressed = await gzip(new TextEncoder().encode(json));
  return bytesToBase64Url(compressed);
}

export async function decodeShare(hash: string): Promise<SharePayload | null> {
  const clean = hash.replace(/^#/, "");
  if (!clean) return null;
  try {
    const bytes = base64UrlToBytes(clean);
    const decompressed = await gunzip(bytes);
    const json = new TextDecoder().decode(decompressed);
    const obj = JSON.parse(json) as SharePayload;
    if (obj.v !== 1) return null;
    return obj;
  } catch {
    return null;
  }
}

// ── bytes helpers ──

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : Buffer.from(bin, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin =
    typeof atob === "function"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── compression ──

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
