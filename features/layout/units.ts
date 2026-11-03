export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72;

export function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function mmToPoints(mm: number): number {
  return (mm * POINTS_PER_INCH) / MM_PER_INCH;
}

export function mmToPixels(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

/** The DPI a crop delivers at a physical print size, limited by its weaker axis. */
export function effectiveDpi(
  cropWidthPx: number,
  cropHeightPx: number,
  printWidthMm: number,
  printHeightMm: number,
): number {
  return Math.min(
    cropWidthPx / mmToInches(printWidthMm),
    cropHeightPx / mmToInches(printHeightMm),
  );
}

/** Whole-micrometre rounding keeps packing exact, so 8 × 25.4 mm fits 203.2 mm. */
export function mmToMicrons(mm: number): number {
  return Math.round(mm * 1000);
}

export function micronsToMm(microns: number): number {
  return microns / 1000;
}

export function isValidLength(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function formatMm(mm: number): string {
  return `${Number(mm.toFixed(2))} mm`;
}

export function formatSize(widthMm: number, heightMm: number): string {
  return `${Number(widthMm.toFixed(2))} × ${Number(heightMm.toFixed(2))} mm`;
}
