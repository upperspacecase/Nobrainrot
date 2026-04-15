/**
 * Image preprocessing for OCR.
 *
 * The big accuracy win for iOS home-screen labels is per-icon cropping —
 * feeding a 60×20 label strip to an OCR engine is dramatically better than
 * feeding a full 1179×2556 screenshot.
 *
 * We assume a 4-column grid (standard iPhone home screen) and infer rows
 * from the image aspect ratio. Cell geometry follows iOS defaults closely
 * enough for the label strip to land inside the bottom ~22% of each cell.
 */

import sharp from "sharp";

export type LabelStrip = {
  /** PNG buffer of just the label region. */
  buffer: Buffer;
  /** 0-indexed grid position. */
  col: number;
  row: number;
  /** Source-image coordinates of the crop. */
  bbox: { x: number; y: number; w: number; h: number };
};

export async function getDimensions(
  image: Buffer,
): Promise<{ width: number; height: number }> {
  const meta = await sharp(image).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

/**
 * Slice a home-screen image into per-icon label strips.
 *
 * Geometry (fraction of image dimensions, calibrated against iOS 17/18):
 *   - Usable area:   y ∈ [0.08, 0.92]   (skip status bar + dock)
 *   - Cell grid:     4 columns × 6 rows
 *   - Label strip:   bottom 22% of each cell, inset 8% horizontally
 */
export async function extractLabelStrips(
  image: Buffer,
): Promise<LabelStrip[]> {
  const meta = await sharp(image).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (W === 0 || H === 0) return [];

  const gridTop = Math.round(H * 0.08);
  const gridBottom = Math.round(H * 0.92);
  const gridH = gridBottom - gridTop;
  const cols = 4;
  const rows = 6;
  const colW = Math.floor(W / cols);
  const rowH = Math.floor(gridH / rows);

  const strips: LabelStrip[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellX = c * colW;
      const cellY = gridTop + r * rowH;
      // label strip = bottom 22% of cell, inset 8% horizontally
      const stripW = Math.round(colW * 0.84);
      const stripH = Math.round(rowH * 0.22);
      const stripX = cellX + Math.round(colW * 0.08);
      const stripY = cellY + rowH - stripH;

      const cropped = await sharp(image)
        .extract({
          left: stripX,
          top: stripY,
          width: stripW,
          height: stripH,
        })
        // Upscale 3× for OCR legibility.
        .resize(stripW * 3, stripH * 3, { kernel: "lanczos3" })
        // Labels are white-on-varied. Invert + grayscale + threshold
        // lands black text on white — Tesseract/Paddle's preferred input.
        .grayscale()
        .negate()
        .normalize()
        .png()
        .toBuffer();

      strips.push({
        buffer: cropped,
        col: c,
        row: r,
        bbox: { x: stripX, y: stripY, w: stripW, h: stripH },
      });
    }
  }

  return strips;
}

/**
 * Light enhancement of a full frame without cropping — for providers
 * (like Claude Vision) that prefer the whole image.
 */
export async function enhanceFullFrame(image: Buffer): Promise<Buffer> {
  return sharp(image).normalize().png().toBuffer();
}
