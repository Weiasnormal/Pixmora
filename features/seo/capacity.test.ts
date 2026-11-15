import { describe, expect, it } from "vitest";
import { isInsideRegion, overlaps } from "@/features/layout/validate";
import { BORDERLESS_INSET_MM, MARGIN_INSET_MM, copiesPerSheet, getPaper, getPhotoSize } from "./sizes";

describe("copiesPerSheet", () => {
  it("fills A4 with at least a plain grid of 1x1 prints", () => {
    // A plain grid with 1 mm gaps holds 7 × 11 = 77.
    const { count, layout } = copiesPerSheet(getPhotoSize("1x1"), getPaper("a4"), BORDERLESS_INSET_MM);
    expect(count).toBeGreaterThanOrEqual(77);
    expect(layout.sheetCount).toBe(1);
    expect(layout.placements).toHaveLength(count);
  });

  it("fills A4 with at least a plain grid of 2x2 prints", () => {
    // 4 × 5 = 20 with 1 mm gaps.
    const { count } = copiesPerSheet(getPhotoSize("2x2"), getPaper("a4"), BORDERLESS_INSET_MM);
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it("fits fewer copies when the sheet has a margin", () => {
    const size = getPhotoSize("1x1");
    const borderless = copiesPerSheet(size, getPaper("a4"), BORDERLESS_INSET_MM).count;
    const margin = copiesPerSheet(size, getPaper("a4"), MARGIN_INSET_MM).count;
    expect(margin).toBeLessThan(borderless);
  });

  it("returns a layout that stays inside the paper", () => {
    const { layout } = copiesPerSheet(getPhotoSize("passport"), getPaper("letter"), MARGIN_INSET_MM);
    for (const placement of layout.placements) {
      expect(isInsideRegion(placement, layout.sheet)).toBe(true);
      for (const other of layout.placements) {
        if (other !== placement) expect(overlaps(placement, other)).toBe(false);
      }
    }
  });
});
