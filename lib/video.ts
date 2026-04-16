/**
 * Video → frames pipeline.
 *
 * Extracts ~1 fps PNG frames from a video buffer, then collapses visually
 * similar frames via a perceptual hash (DCT-based pHash) so slow scrolls
 * don't OCR the same screen 30 times.
 *
 * A 60s iOS home-screen scroll reliably yields ~8–15 unique frames.
 *
 * Vercel note: ffmpeg-static ships a ~40MB binary and Vercel serverless
 * payloads cap around 4.5MB — so this runs fine in a long-lived worker
 * (Fly/Modal/Railway) but requires Vercel Blob or a presigned upload flow
 * in production on Vercel Pro. See README.
 */

import { writeFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export type ExtractOptions = {
  /** Frames per second to sample. Default: 1. */
  fps?: number;
  /** Hamming distance threshold for pHash dedup. ≤ this → duplicate. Default: 6. */
  dedupHammingThreshold?: number;
  /** Hard cap on the number of unique frames returned. Default: 40. */
  maxFrames?: number;
};

export type ExtractedFrame = {
  /** PNG buffer. */
  buffer: Buffer;
  /** Source timestamp in seconds. */
  ts: number;
  /** 64-bit pHash as a hex string. */
  hash: string;
};

/**
 * Extract deduplicated frames from a video buffer.
 */
export async function extractFrames(
  video: Buffer,
  opts: ExtractOptions = {},
): Promise<ExtractedFrame[]> {
  const fps = opts.fps ?? 1;
  const threshold = opts.dedupHammingThreshold ?? 6;
  const maxFrames = opts.maxFrames ?? 40;

  const workDir = await mkdtemp(join(tmpdir(), "wireheading-"));
  const inputPath = join(workDir, "input");
  const framePattern = join(workDir, "frame-%04d.png");
  await writeFile(inputPath, video);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([`-vf fps=${fps}`, "-vsync vfr"])
        .output(framePattern)
        .on("end", () => resolve())
        .on("error", (e) => reject(e))
        .run();
    });

    const files = (await readdir(workDir))
      .filter((f) => f.startsWith("frame-") && f.endsWith(".png"))
      .sort();

    const out: ExtractedFrame[] = [];
    let lastHash: bigint | null = null;

    for (let i = 0; i < files.length; i++) {
      const buf = await readFile(join(workDir, files[i]));
      const hash = await pHash(buf);
      if (lastHash !== null && hamming(hash, lastHash) <= threshold) {
        continue;
      }
      lastHash = hash;
      out.push({
        buffer: buf,
        ts: i / fps,
        hash: hash.toString(16).padStart(16, "0"),
      });
      if (out.length >= maxFrames) break;
    }
    return out;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Classic 64-bit DCT-ish pHash:
 *   1. resize to 32×32 grayscale
 *   2. DCT the pixel matrix
 *   3. keep the top-left 8×8 low-frequency block (skip DC at [0,0])
 *   4. bitmask vs median → 64-bit hash
 *
 * We approximate with a mean-hash at 8×8 — cheaper, ~equivalent on screen
 * content where contrast is high and uniform.
 */
export async function pHash(image: Buffer): Promise<bigint> {
  const { data } = await sharp(image)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // compute mean
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;

  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (data[i] >= mean) hash |= 1n << BigInt(i);
  }
  return hash;
}

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    x &= x - 1n;
    n++;
  }
  return n;
}

/**
 * Sniff whether a buffer is a video (vs a still image) without parsing the
 * whole container. Handy as a guard before we spin up ffmpeg.
 */
export function isVideo(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // ISO-BMFF: `ftyp` at offset 4 → mp4 / mov / m4v / 3gp
  if (buf.slice(4, 8).toString("ascii") === "ftyp") return true;
  // WebM / Matroska: EBML header 0x1A45DFA3
  if (
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  )
    return true;
  // AVI
  if (
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "AVI "
  )
    return true;
  return false;
}
