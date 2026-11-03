import { describe, expect, it } from "vitest";
import type { PrintItem, SheetBounds } from "@/features/job/types";
import { packItems, type PackOptions } from "./pack";
import { findPlacementProblems, violatesGap } from "./validate";

const A4: SheetBounds = { widthMm: 210, heightMm: 297, insetMm: 0 };

function items(
  groupId: string,
  count: number,
  widthMm: number,
  heightMm: number,
  allowRotation = false,
): PrintItem[] {
  return Array.from({ length: count }, (_, copyIndex) => ({
    id: `${groupId}-${widthMm}x${heightMm}-${copyIndex}`,
    groupId,
    photoSizeId: `${widthMm}x${heightMm}`,
    copyIndex,
    widthMm,
    heightMm,
    allowRotation,
  }));
}

function options(overrides: Partial<PackOptions> = {}): PackOptions {
  return {
    sheet: A4,
    gapXmm: 1,
    gapYmm: 1,
    allowItemRotation: false,
    ...overrides,
  };
}

/** Small seeded generator, so a failing random case can be replayed. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("packItems", () => {
  it("fits the worked mixed-customer example on one A4 sheet", () => {
    const job = [...items("a", 4, 50.8, 50.8), ...items("b", 12, 25.4, 25.4)];
    const result = packItems(job, options());

    expect(result.sheetCount).toBe(1);
    expect(result.placements).toHaveLength(16);
    expect(new Set(result.placements.map((p) => p.groupId))).toEqual(
      new Set(["a", "b"]),
    );
    expect(findPlacementProblems(result.placements, A4)).toEqual([]);
  });

  it("keeps exact dimensions on every print", () => {
    const job = [...items("a", 3, 50.8, 50.8), ...items("b", 5, 25.4, 25.4)];
    for (const placement of packItems(job, options()).placements) {
      expect([25.4, 50.8]).toContain(placement.widthMm);
      expect(placement.widthMm).toBe(placement.heightMm);
    }
  });

  it("uses an exactly full row when both gaps are zero", () => {
    const job = items("a", 8, 25.4, 25.4);
    const sheet = { widthMm: 203.2, heightMm: 25.4, insetMm: 0 };
    const result = packItems(job, options({ sheet, gapXmm: 0, gapYmm: 0 }));

    expect(result.sheetCount).toBe(1);
    expect(result.placements).toHaveLength(8);
  });

  it("touches the paper edge in borderless mode with no phantom strip", () => {
    const result = packItems(
      items("a", 2, 105, 148.5),
      options({ gapXmm: 0, gapYmm: 0 }),
    );
    const right = Math.max(...result.placements.map((p) => p.xMm + p.widthMm));

    expect(Math.min(...result.placements.map((p) => p.xMm))).toBe(0);
    expect(right).toBe(210);
  });

  it("applies horizontal and vertical gaps independently", () => {
    const job = items("a", 12, 25.4, 25.4);
    const result = packItems(job, options({ gapXmm: 1.5, gapYmm: 3 }));
    const xs = [...new Set(result.placements.map((p) => p.xMm))].sort((a, b) => a - b);
    const ys = [...new Set(result.placements.map((p) => p.yMm))].sort((a, b) => a - b);

    expect(xs[1] - xs[0]).toBeCloseTo(26.9, 6);
    expect(ys[1] - ys[0]).toBeCloseTo(28.4, 6);
  });

  it("changing only the vertical gap leaves horizontal spacing alone", () => {
    const job = items("a", 6, 25.4, 25.4);
    const xs = (gapYmm: number) =>
      [...new Set(packItems(job, options({ gapYmm })).placements.map((p) => p.xMm))];

    expect(xs(1)).toEqual(xs(5));
  });

  it("spreads overflow to further sheets without losing copies", () => {
    const result = packItems(items("a", 40, 50.8, 50.8), options());

    expect(result.sheetCount).toBeGreaterThan(1);
    expect(result.placements).toHaveLength(40);
    expect(result.unplaced).toEqual([]);
  });

  it("reports a print larger than the paper instead of shrinking it", () => {
    const result = packItems(items("a", 2, 300, 400), options());

    expect(result.placements).toEqual([]);
    expect(result.unplaced).toHaveLength(2);
    expect(result.errors[0].code).toBe("item-too-large");
    expect(result.sheetCount).toBe(0);
  });

  it("only rotates a print when both the job and its size allow it", () => {
    const sheet = { widthMm: 100, heightMm: 50, insetMm: 0 };
    const zeroGaps = { sheet, gapXmm: 0, gapYmm: 0 };

    const locked = packItems(items("a", 1, 50, 100, true), options(zeroGaps));
    expect(locked.errors[0].code).toBe("item-too-large");

    const notAllowed = packItems(
      items("a", 1, 50, 100, false),
      options({ ...zeroGaps, allowItemRotation: true }),
    );
    expect(notAllowed.errors[0].code).toBe("item-too-large");

    const rotated = packItems(
      items("a", 1, 50, 100, true),
      options({ ...zeroGaps, allowItemRotation: true }),
    );
    expect(rotated.placements[0]).toMatchObject({
      rotated: true,
      widthMm: 100,
      heightMm: 50,
    });
  });

  it("respects an edge inset", () => {
    const sheet = { ...A4, insetMm: 5 };
    const result = packItems(items("a", 30, 50.8, 50.8), options({ sheet }));

    expect(findPlacementProblems(result.placements, sheet)).toEqual([]);
    expect(Math.min(...result.placements.map((p) => p.xMm))).toBe(5);
  });

  it("returns identical placements for identical input", () => {
    const job = [...items("a", 4, 50.8, 50.8), ...items("b", 12, 25.4, 25.4)];

    expect(packItems(job, options())).toEqual(packItems(job, options()));
  });

  it("does not depend on the order the items arrive in", () => {
    const job = [...items("a", 4, 50.8, 50.8), ...items("b", 12, 25.4, 25.4)];
    const signature = (list: PrintItem[]) =>
      packItems(list, options())
        .placements.map((p) => `${p.itemId}:${p.xMm}:${p.yMm}`)
        .sort();

    expect(signature([...job].reverse())).toEqual(signature(job));
  });

  it("handles an empty job", () => {
    const result = packItems([], options());

    expect(result).toMatchObject({ sheetCount: 0, utilization: 0, totalItems: 0 });
  });

  it("holds its guarantees across randomized mixed jobs", () => {
    const sizes = [
      [25.4, 25.4],
      [50.8, 50.8],
      [35, 45],
      [89, 127],
      [102, 152],
      [127, 178],
    ];

    for (let seed = 1; seed <= 150; seed += 1) {
      const next = random(seed);
      const gapXmm = Number((next() * 4).toFixed(1));
      const gapYmm = Number((next() * 4).toFixed(1));
      const sheet = { ...A4, insetMm: next() > 0.5 ? 0 : 3 };
      const allowItemRotation = next() > 0.5;
      const job: PrintItem[] = [];
      const groups = 1 + Math.floor(next() * 4);
      for (let group = 0; group < groups; group += 1) {
        const [w, h] = sizes[Math.floor(next() * sizes.length)];
        job.push(...items(`g${group}`, 1 + Math.floor(next() * 25), w, h, next() > 0.5));
      }

      const result = packItems(job, { sheet, gapXmm, gapYmm, allowItemRotation });

      expect(result.placements).toHaveLength(job.length);
      expect(new Set(result.placements.map((p) => p.itemId)).size).toBe(job.length);
      expect(findPlacementProblems(result.placements, sheet)).toEqual([]);
      for (let a = 0; a < result.placements.length; a += 1) {
        for (let b = a + 1; b < result.placements.length; b += 1) {
          expect(
            violatesGap(result.placements[a], result.placements[b], gapXmm, gapYmm),
          ).toBe(false);
        }
      }
      for (const placement of result.placements) {
        const item = job.find((i) => i.id === placement.itemId)!;
        const area = placement.rotated
          ? [item.heightMm, item.widthMm]
          : [item.widthMm, item.heightMm];
        expect([placement.widthMm, placement.heightMm]).toEqual(area);
      }
    }
  });
});
