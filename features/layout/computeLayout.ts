import { expandPrintItems, resolveSheet, type Library } from "@/features/job/expand";
import type {
  LayoutIssue,
  ManualPlacement,
  PhotoGroup,
  Placement,
  PrintItem,
  SheetPage,
  SheetSpec,
} from "@/features/job/types";
import { packItems } from "./pack";
import { findPlacementProblems, type PlacementProblem } from "./validate";

export type StudioLayout = {
  /** Every printed page in tab order. A placement's `sheetIndex` is its index here. */
  pages: SheetPage[];
  sheetCount: number;
  placements: Placement[];
  unplaced: PrintItem[];
  errors: LayoutIssue[];
  /** Placed print area as a share of all used paper, 0 to 1. */
  utilization: number;
  totalItems: number;
  problems: PlacementProblem[];
};

/** The sheet a group prints on. A group pointing at a removed sheet falls back to the first. */
function homeSheet(group: PhotoGroup, sheets: SheetSpec[]): SheetSpec {
  return sheets.find((sheet) => sheet.id === group.sheetId) ?? sheets[0];
}

/**
 * Each sheet is its own paper: its photos are packed with its own settings, and nothing on one
 * sheet moves because another changed. A sheet that holds more than its paper gets overflow
 * pages right after it, with the same settings.
 */
export function computeLayout(
  groups: PhotoGroup[],
  library: Library,
  sheets: SheetSpec[],
  manual: Record<string, ManualPlacement>,
): StudioLayout {
  const pages: SheetPage[] = [];
  const placements: Placement[] = [];
  const unplaced: PrintItem[] = [];
  const errors: LayoutIssue[] = [];
  let totalItems = 0;

  const packed = sheets.map((spec) => {
    const own = groups.filter((group) => homeSheet(group, sheets).id === spec.id);
    const bounds = resolveSheet(spec.options, library.profiles);
    const result = packItems(expandPrintItems(own, library), {
      sheet: bounds,
      gapXmm: spec.options.gapXmm,
      gapYmm: spec.options.gapYmm,
      allowItemRotation: spec.options.allowItemRotation,
    });
    return { spec, bounds, result };
  });

  // Prints moved by hand can land on a page past a sheet's own count, so that page exists too.
  const movedPages = new Map<string, number>();
  for (const placement of Object.values(manual)) {
    movedPages.set(
      placement.sheetId,
      Math.max(movedPages.get(placement.sheetId) ?? 0, placement.pageInSheet + 1),
    );
  }

  const firstPage = new Map<string, number>();
  for (const { spec, bounds, result } of packed) {
    firstPage.set(spec.id, pages.length);
    const count = Math.max(result.sheetCount, movedPages.get(spec.id) ?? 0, 1);
    for (let pageInSheet = 0; pageInSheet < count; pageInSheet += 1) {
      pages.push({
        sheetId: spec.id,
        pageInSheet,
        bounds,
        gapXmm: spec.options.gapXmm,
        gapYmm: spec.options.gapYmm,
        cutGuides: spec.options.cutGuides,
      });
    }
  }

  for (const { spec, result } of packed) {
    const start = firstPage.get(spec.id) ?? 0;
    totalItems += result.totalItems;
    unplaced.push(...result.unplaced);
    errors.push(...result.errors);
    for (const placement of result.placements) {
      const moved = manual[placement.itemId];
      const target = moved ? firstPage.get(moved.sheetId) : undefined;
      placements.push(
        moved && target !== undefined
          ? {
              ...placement,
              sheetIndex: target + moved.pageInSheet,
              xMm: moved.xMm,
              yMm: moved.yMm,
            }
          : { ...placement, sheetIndex: start + placement.sheetIndex },
      );
    }
  }

  const paperArea = pages.reduce((sum, page) => sum + page.bounds.widthMm * page.bounds.heightMm, 0);
  const printArea = placements.reduce((sum, p) => sum + p.widthMm * p.heightMm, 0);

  return {
    pages,
    sheetCount: pages.length,
    placements,
    unplaced,
    errors,
    utilization: paperArea > 0 ? printArea / paperArea : 0,
    totalItems,
    problems: findPlacementProblems(placements, pages),
  };
}

/** Everything that changes where prints land. Crops and colours do not. */
export function layoutSignature(
  groups: PhotoGroup[],
  library: Library,
  sheets: SheetSpec[],
): string {
  return JSON.stringify(
    sheets.map((spec) => ({
      id: spec.id,
      items: expandPrintItems(
        groups.filter((group) => homeSheet(group, sheets).id === spec.id),
        library,
      ).map((i) => [i.id, i.widthMm, i.heightMm, i.allowRotation]),
      sheet: resolveSheet(spec.options, library.profiles),
      gaps: [spec.options.gapXmm, spec.options.gapYmm],
      rotation: spec.options.allowItemRotation,
    })),
  );
}
