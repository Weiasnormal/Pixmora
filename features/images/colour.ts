/** Red and blue move by this share at either end of the temperature slider. */
const TEMPERATURE_RANGE = 0.25;
/** CSS has no vibrance, so the crop view's live preview leans on a gentler saturate(). */
const PREVIEW_VIBRANCE_SCALE = 0.5;

export function temperatureGain(temperature: number): number {
  return (temperature / 100) * TEMPERATURE_RANGE;
}

export function previewSaturation(vibrance: number): number {
  return 1 + (vibrance < 0 ? vibrance : vibrance * PREVIEW_VIBRANCE_SCALE) / 100;
}

/**
 * Works on RGBA data in place. Vibrance lifts muted colours more than vivid ones,
 * so already saturated areas such as skin hold up; negative values fade towards grey.
 */
export function applyColourShift(
  pixels: Uint8ClampedArray,
  vibrance: number,
  temperature: number,
) {
  const gain = temperatureGain(temperature);
  const amount = vibrance / 100;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    let red = pixels[i] * (1 + gain);
    let green = pixels[i + 1];
    let blue = pixels[i + 2] * (1 - gain);

    if (amount !== 0) {
      const high = Math.max(red, green, blue);
      const saturation = high === 0 ? 0 : (high - Math.min(red, green, blue)) / high;
      const strength = 1 + (amount > 0 ? amount * (1 - saturation) : amount);
      const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      red = luma + (red - luma) * strength;
      green = luma + (green - luma) * strength;
      blue = luma + (blue - luma) * strength;
    }

    pixels[i] = red;
    pixels[i + 1] = green;
    pixels[i + 2] = blue;
  }
}
