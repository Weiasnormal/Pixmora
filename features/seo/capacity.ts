import type { LayoutResult, PrintItem } from "@/features/job/types";
import { packItems } from "@/features/layout/pack";

export type CapacityInput = {
  widthMm: number;
  heightMm: number;
  allowRotation: boolean;
  paper: { widthMm: number; heightMm: number };
  insetMm: number;
  gapMm: number;
};

function copies(count: number, input: CapacityInput): PrintItem[] {
  return Array.from({ length: count }, (_, copyIndex) => ({
    id: `copy-${copyIndex}`,
    groupId: "copies",
    photoSizeId: "size",
    copyIndex,
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    allowRotation: input.allowRotation,
  }));
}

function pack(count: number, input: CapacityInput): LayoutResult {
  return packItems(copies(count, input), {
    sheet: { ...input.paper, insetMm: input.insetMm },
    gapXmm: input.gapMm,
    gapYmm: input.gapMm,
    allowItemRotation: input.allowRotation,
  });
}

function fitsOnOneSheet(result: LayoutResult): boolean {
  return result.unplaced.length === 0 && result.sheetCount <= 1;
}

/**
 * The most copies of one print size that the Studio's packing engine fits on a
 * single sheet, with the layout it produces. Runs at build time for the size pages.
 */
export function sheetCapacity(input: CapacityInput): { count: number; layout: LayoutResult } {
  const usable =
    (input.paper.widthMm - 2 * input.insetMm + input.gapMm) *
    (input.paper.heightMm - 2 * input.insetMm + input.gapMm);
  const upper = Math.max(1, Math.ceil(usable / ((input.widthMm + input.gapMm) * (input.heightMm + input.gapMm))) + 1);

  let low = 0;
  let best = pack(0, input);
  let high = upper;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const result = pack(mid, input);
    if (fitsOnOneSheet(result)) {
      low = mid;
      best = result;
    } else {
      high = mid - 1;
    }
  }
  return { count: low, layout: best };
}
