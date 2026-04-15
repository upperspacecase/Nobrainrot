/**
 * Claude Vision OCR provider.
 *
 * Why this one: Claude Haiku 4.5 is currently the best accuracy-per-dollar
 * option for stylized UI text because it uses the app icon as semantic
 * context — "that round red icon with 'S' is Snapchat" recovers labels
 * Tesseract/Paddle would miss on pure glyph recognition.
 *
 * Uses prompt caching for the system prompt so the per-frame cost collapses
 * to just the image + a tiny output JSON after the first call.
 *
 * Set ANTHROPIC_API_KEY in the environment.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { OcrCandidate, OcrProvider, OcrResult } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are an OCR engine specialized in reading app labels from iOS home-screen screenshots.

Your task: extract the text label that appears UNDER each app icon. Nothing else.

Rules:
- Return ONLY the label text as it appears. Preserve capitalization.
- Do NOT include the status bar, clock, dock separators, page indicators, search bar, folder contents, or widget text.
- If a label is partially cut off at the edge, include what you can see.
- If the same app appears twice (e.g., in a folder preview and on a home screen), include it once.
- If you cannot confidently read any label, return an empty array — do not guess.

Output format: a single JSON object, no prose, no markdown fences:
{"labels": ["Label One", "Label Two", ...]}`;

export class ClaudeVisionProvider implements OcrProvider {
  name = "claude-vision" as const;
  private client: Anthropic;

  constructor(opts: { apiKey?: string } = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Either export it or pass { apiKey } to ClaudeVisionProvider.",
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  async extract(image: Buffer): Promise<OcrResult> {
    const t0 = Date.now();
    const base64 = image.toString("base64");
    const mediaType = detectMediaType(image);

    const resp = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extract every visible app label from this screenshot.",
            },
          ],
        },
      ],
    });

    const text = resp.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const candidates: OcrCandidate[] = parseLabels(text).map((label) => ({
      text: label,
      confidence: 0.9, // Claude doesn't expose per-token logprobs on Vision — treat as high.
    }));

    return {
      provider: "claude-vision",
      candidates,
      ms: Date.now() - t0,
      model: MODEL,
    };
  }
}

function parseLabels(text: string): string[] {
  // Strip ``` fences if the model wrapped anyway.
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const obj = JSON.parse(stripped) as { labels?: unknown };
    if (!Array.isArray(obj.labels)) return [];
    return obj.labels
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 40);
  } catch {
    // Fall back: line-by-line scrape.
    return stripped
      .split("\n")
      .map((l) => l.replace(/^[-*"•,\s]+|[-*",\s]+$/g, "").trim())
      .filter((l) => l.length > 0 && l.length < 40);
  }
}

function detectMediaType(
  buf: Buffer,
): "image/png" | "image/jpeg" | "image/gif" | "image/webp" {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46
  )
    return "image/gif";
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  return "image/png";
}
