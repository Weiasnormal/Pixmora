import { describe, expect, it } from "vitest";
import type { Placement } from "@/features/job/types";
import { findFreeSpot, withoutEmptySheets } from "./sheets";

const sheet = { widthMm: 100, heightMm: 100, insetMm: 0 };

function print(itemId: string, sheetIndex: number, xMm: number, yMm: number, size = 40): Placement {
  return {
    itemId,
    sheetIndex,
    groupId: "g",
    photoSizeId: "s",
    copyIndex: 0,
    xMm,
    yMm,
    widthMm: size,
    heightMm: size,
    rotated: false,
  };
}

describe("findFreeSpot", () => {
  it("puts a print in the top-left corner of an empty sheet", () => {
    expect(findFreeSpot(print("a", 0, 10, 10), 1, [], sheet, 1, 1)).toEqual({ xMm: 0, yMm: 0 });
  });

  it("lands beside the prints already there, keeping the gap", () => {
    const there = [print("b", 1, 0, 0)];
    expect(findFreeSpot(print("a", 0, 0, 0), 1, there, sheet, 2, 2)).toEqual({ xMm: 42, yMm: 0 });
  });

  it("reports a full sheet", () => {
    const full = [print("b", 1, 0, 0, 100)];
    expect(findFreeSpot(print("a", 0, 0, 0), 1, full, sheet, 1, 1)).toBeNull();
  });
});

describe("withoutEmptySheets", () => {
  it("drops blank sheets and renumbers the rest", () => {
    const result = withoutEmptySheets([print("a", 0, 0, 0), print("b", 2, 0, 0)]);
    expect(result.sheetCount).toBe(2);
    expect(result.placements.map((p) => p.sheetIndex)).toEqual([0, 1]);
  });
});
