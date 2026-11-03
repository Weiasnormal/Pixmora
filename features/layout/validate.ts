import type { Placement, SheetBounds } from "@/features/job/types";

/** Below one micrometre is rounding noise, not a physical overlap. */
const EPSILON_MM = 0.0005;

export function isInsideRegion(placement: Placement, sheet: SheetBounds): boolean {
  return (
    placement.xMm >= sheet.insetMm - EPSILON_MM &&
    placement.yMm >= sheet.insetMm - EPSILON_MM &&
    placement.xMm + placement.widthMm <= sheet.widthMm - sheet.insetMm + EPSILON_MM &&
    placement.yMm + placement.heightMm <= sheet.heightMm - sheet.insetMm + EPSILON_MM
  );
}

export function overlaps(a: Placement, b: Placement): boolean {
  return (
    a.sheetIndex === b.sheetIndex &&
    a.xMm < b.xMm + b.widthMm - EPSILON_MM &&
    a.xMm + a.widthMm > b.xMm + EPSILON_MM &&
    a.yMm < b.yMm + b.heightMm - EPSILON_MM &&
    a.yMm + a.heightMm > b.yMm + EPSILON_MM
  );
}

/** True when two prints on a sheet sit closer than the configured gaps. */
export function violatesGap(
  a: Placement,
  b: Placement,
  gapXmm: number,
  gapYmm: number,
): boolean {
  return (
    a.sheetIndex === b.sheetIndex &&
    a.xMm < b.xMm + b.widthMm + gapXmm - EPSILON_MM &&
    a.xMm + a.widthMm + gapXmm > b.xMm + EPSILON_MM &&
    a.yMm < b.yMm + b.heightMm + gapYmm - EPSILON_MM &&
    a.yMm + a.heightMm + gapYmm > b.yMm + EPSILON_MM
  );
}

export type PlacementProblem = {
  itemId: string;
  kind: "out-of-bounds" | "overlap";
};

export function findPlacementProblems(
  placements: Placement[],
  sheet: SheetBounds,
): PlacementProblem[] {
  const problems: PlacementProblem[] = [];
  placements.forEach((placement, index) => {
    if (!isInsideRegion(placement, sheet)) {
      problems.push({ itemId: placement.itemId, kind: "out-of-bounds" });
    }
    for (let other = index + 1; other < placements.length; other += 1) {
      if (overlaps(placement, placements[other])) {
        problems.push({ itemId: placement.itemId, kind: "overlap" });
      }
    }
  });
  return problems;
}
