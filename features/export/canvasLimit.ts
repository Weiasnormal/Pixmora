/**
 * Browsers cap how large a canvas can be, and the cap varies by device. iPhones and
 * iPads stop at about 16.7 million pixels, less than one A4 sheet at 600 DPI. Past the
 * cap, Safari draws nothing instead of failing, so the only reliable test is to draw
 * one pixel in the far corner and read it back.
 */

/** Every current browser handles at least this many pixels, so smaller sheets skip the test. */
export const ALWAYS_SAFE_PIXELS = 4096 * 4096;

const checked = new Map<string, boolean>();

export function canvasFits(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  if (width * height <= ALWAYS_SAFE_PIXELS) return true;
  const key = `${width}x${height}`;
  const known = checked.get(key);
  if (known !== undefined) return known;

  let fits = false;
  const canvas = document.createElement("canvas");
  try {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#000";
      context.fillRect(width - 1, height - 1, 1, 1);
      fits = context.getImageData(width - 1, height - 1, 1, 1).data[3] === 255;
    }
  } catch {
    fits = false;
  } finally {
    // Hand the memory back straight away; a test canvas can be hundreds of megabytes.
    canvas.width = 0;
    canvas.height = 0;
  }
  checked.set(key, fits);
  return fits;
}
