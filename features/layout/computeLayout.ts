import { expandPrintItems, resolveSheet, type Library } from "@/features/job/expand";
import type {
  LayoutOptions,
  LayoutResult,
  ManualPlacement,
  PhotoGroup,
  Placement,
} from "@/features/job/types";
import { computeUtilization, packItems } from "./pack";
import { findPlacementProblems, type PlacementProblem } from "./validate";

export type StudioLayout = LayoutResult & { problems: PlacementProblem[] };

export function computeLayout(
  groups: PhotoGroup[],
  library: Library,
  options: LayoutOptions,
  manual: Record<string, ManualPlacement>,
): StudioLayout {
  const packed = packItems(expandPrintItems(groups, library), {
    sheet: resolveSheet(options, library.profiles),
    gapXmm: options.gapXmm,
    gapYmm: options.gapYmm,
    allowItemRotation: options.allowItemRotation,
  });

  const placements: Placement[] = packed.placements.map((placement) => {
    const moved = manual[placement.itemId];
    return moved ? { ...placement, ...moved } : placement;
  });

  return {
    ...packed,
    placements,
    utilization: computeUtilization(placements, packed.sheet, packed.sheetCount),
    problems: findPlacementProblems(placements, packed.sheet),
  };
}

/** Everything that changes where prints land. Crops and colours do not. */
export function layoutSignature(
  groups: PhotoGroup[],
  library: Library,
  options: LayoutOptions,
): string {
  return JSON.stringify({
    items: expandPrintItems(groups, library).map((i) => [i.id, i.widthMm, i.heightMm, i.allowRotation]),
    sheet: resolveSheet(options, library.profiles),
    gaps: [options.gapXmm, options.gapYmm],
    rotation: options.allowItemRotation,
  });
}
