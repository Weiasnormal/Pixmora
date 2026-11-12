import type { Placement, SheetBounds } from "@/features/job/types";
import { isInsideRegion, violatesGap } from "./validate";

/** Only the sheets that hold a print, renumbered from zero, so exports skip blank pages. */
export function withoutEmptySheets(placements: Placement[]): {
  sheetCount: number;
  placements: Placement[];
} {
  const used = [...new Set(placements.map((p) => p.sheetIndex))].sort((a, b) => a - b);
  const renumber = new Map(used.map((sheetIndex, index) => [sheetIndex, index]));
  return {
    sheetCount: used.length,
    placements: placements.map((p) => ({ ...p, sheetIndex: renumber.get(p.sheetIndex) ?? 0 })),
  };
}

/**
 * The highest, then leftmost, free spot for a print on another sheet, keeping the job's gaps.
 * Candidates sit against the margin or against another print's far edge. Null means it is full.
 */
export function findFreeSpot(
  print: Placement,
  sheetIndex: number,
  placements: Placement[],
  sheet: SheetBounds,
  gapXmm: number,
  gapYmm: number,
): { xMm: number; yMm: number } | null {
  const onSheet = placements.filter((p) => p.sheetIndex === sheetIndex && p.itemId !== print.itemId);
  const xs = [sheet.insetMm, ...onSheet.map((p) => p.xMm + p.widthMm + gapXmm)];
  const ys = [sheet.insetMm, ...onSheet.map((p) => p.yMm + p.heightMm + gapYmm)];
  const candidates = ys
    .flatMap((y) => xs.map((x) => ({ x, y })))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const { x, y } of candidates) {
    const moved = { ...print, sheetIndex, xMm: x, yMm: y };
    if (!isInsideRegion(moved, sheet)) continue;
    if (onSheet.some((other) => violatesGap(moved, other, gapXmm, gapYmm))) continue;
    return { xMm: Number(x.toFixed(3)), yMm: Number(y.toFixed(3)) };
  }
  return null;
}
