import type {
  LayoutIssue,
  LayoutResult,
  Placement,
  PrintItem,
  SheetBounds,
} from "@/features/job/types";
import { micronsToMm, mmToMicrons } from "./units";

export type PackOptions = {
  sheet: SheetBounds;
  gapXmm: number;
  gapYmm: number;
  allowItemRotation: boolean;
};

type Rect = { x: number; y: number; w: number; h: number };

type Heuristic = "top-left" | "short-side" | "best-area";
type SortOrder = "area" | "long-edge" | "height" | "width";

type Candidate = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  primary: number;
  secondary: number;
};

const HEURISTICS: Heuristic[] = ["top-left", "short-side", "best-area"];
const SORT_ORDERS: SortOrder[] = ["area", "long-edge", "height", "width"];

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortItems(items: PrintItem[], order: SortOrder): PrintItem[] {
  const rank = (item: PrintItem): number => {
    switch (order) {
      case "area":
        return item.widthMm * item.heightMm;
      case "long-edge":
        return Math.max(item.widthMm, item.heightMm);
      case "height":
        return item.heightMm;
      case "width":
        return item.widthMm;
    }
  };
  return [...items].sort(
    (a, b) =>
      rank(b) - rank(a) ||
      Math.max(b.widthMm, b.heightMm) - Math.max(a.widthMm, a.heightMm) ||
      compareIds(a.photoSizeId, b.photoSizeId) ||
      compareIds(a.groupId, b.groupId) ||
      a.copyIndex - b.copyIndex,
  );
}

function score(
  heuristic: Heuristic,
  free: Rect,
  w: number,
  h: number,
): [number, number] {
  const leftoverW = free.w - w;
  const leftoverH = free.h - h;
  switch (heuristic) {
    case "top-left":
      return [free.y + h, free.x];
    case "short-side":
      return [
        Math.min(leftoverW, leftoverH),
        Math.max(leftoverW, leftoverH),
      ];
    case "best-area":
      return [free.w * free.h - w * h, Math.min(leftoverW, leftoverH)];
  }
}

function better(next: Candidate, current: Candidate | null): boolean {
  if (!current) return true;
  if (next.primary !== current.primary) return next.primary < current.primary;
  if (next.secondary !== current.secondary) {
    return next.secondary < current.secondary;
  }
  if (next.y !== current.y) return next.y < current.y;
  if (next.x !== current.x) return next.x < current.x;
  return !next.rotated && current.rotated;
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/** MaxRects: keep every maximal free rectangle, including overlapping ones. */
class FreeSpace {
  rects: Rect[];

  constructor(width: number, height: number) {
    this.rects = [{ x: 0, y: 0, w: width, h: height }];
  }

  find(w: number, h: number, heuristic: Heuristic): Candidate | null {
    let best: Candidate | null = null;
    for (const free of this.rects) {
      if (w <= free.w && h <= free.h) {
        const [primary, secondary] = score(heuristic, free, w, h);
        const next = { x: free.x, y: free.y, w, h, rotated: false, primary, secondary };
        if (better(next, best)) best = next;
      }
    }
    return best;
  }

  place(used: Rect): void {
    const next: Rect[] = [];
    for (const free of this.rects) {
      if (!intersects(free, used)) {
        next.push(free);
        continue;
      }
      if (used.x > free.x) {
        next.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h });
      }
      if (used.x + used.w < free.x + free.w) {
        const x = used.x + used.w;
        next.push({ x, y: free.y, w: free.x + free.w - x, h: free.h });
      }
      if (used.y > free.y) {
        next.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
      }
      if (used.y + used.h < free.y + free.h) {
        const y = used.y + used.h;
        next.push({ x: free.x, y, w: free.w, h: free.y + free.h - y });
      }
    }
    this.rects = next.filter(
      (rect, i) =>
        !next.some(
          (other, j) =>
            i !== j &&
            contains(other, rect) &&
            (!contains(rect, other) || j < i),
        ),
    );
  }
}

type Attempt = {
  placements: Placement[];
  sheets: number;
  envelope: number;
};

function attempt(
  items: PrintItem[],
  options: PackOptions,
  heuristic: Heuristic,
): Attempt {
  const inset = mmToMicrons(options.sheet.insetMm);
  const gapX = mmToMicrons(options.gapXmm);
  const gapY = mmToMicrons(options.gapYmm);
  // Each item carries its gap on the right and bottom. Growing the bin by one
  // gap cancels the trailing gap, so prints can still reach the region edge.
  const binW = mmToMicrons(options.sheet.widthMm) - 2 * inset + gapX;
  const binH = mmToMicrons(options.sheet.heightMm) - 2 * inset + gapY;

  const sheets: FreeSpace[] = [];
  const placements: Placement[] = [];
  const extents: { right: number; bottom: number }[] = [];

  for (const item of items) {
    const w = mmToMicrons(item.widthMm);
    const h = mmToMicrons(item.heightMm);
    const canRotate = options.allowItemRotation && item.allowRotation && w !== h;

    let sheetIndex = -1;
    let found: Candidate | null = null;
    for (let i = 0; i < sheets.length; i += 1) {
      found = sheets[i].find(w + gapX, h + gapY, heuristic);
      if (!found && canRotate) {
        found = sheets[i].find(h + gapX, w + gapY, heuristic);
        if (found) found.rotated = true;
      }
      if (found) {
        sheetIndex = i;
        break;
      }
    }
    if (!found) {
      const space = new FreeSpace(binW, binH);
      found = space.find(w + gapX, h + gapY, heuristic);
      if (!found && canRotate) {
        found = space.find(h + gapX, w + gapY, heuristic);
        if (found) found.rotated = true;
      }
      if (!found) continue;
      sheets.push(space);
      extents.push({ right: 0, bottom: 0 });
      sheetIndex = sheets.length - 1;
    }

    sheets[sheetIndex].place({ x: found.x, y: found.y, w: found.w, h: found.h });
    const paperW = found.rotated ? h : w;
    const paperH = found.rotated ? w : h;
    const extent = extents[sheetIndex];
    extent.right = Math.max(extent.right, found.x + paperW);
    extent.bottom = Math.max(extent.bottom, found.y + paperH);

    placements.push({
      itemId: item.id,
      sheetIndex,
      groupId: item.groupId,
      photoSizeId: item.photoSizeId,
      copyIndex: item.copyIndex,
      xMm: micronsToMm(found.x + inset),
      yMm: micronsToMm(found.y + inset),
      widthMm: micronsToMm(paperW),
      heightMm: micronsToMm(paperH),
      rotated: found.rotated,
    });
  }

  return {
    placements,
    sheets: sheets.length,
    envelope: extents.reduce((sum, e) => sum + e.right * e.bottom, 0),
  };
}

function fitsSheet(item: PrintItem, options: PackOptions): boolean {
  const region = {
    w: mmToMicrons(options.sheet.widthMm) - 2 * mmToMicrons(options.sheet.insetMm),
    h: mmToMicrons(options.sheet.heightMm) - 2 * mmToMicrons(options.sheet.insetMm),
  };
  const w = mmToMicrons(item.widthMm);
  const h = mmToMicrons(item.heightMm);
  if (w <= region.w && h <= region.h) return true;
  return (
    options.allowItemRotation &&
    item.allowRotation &&
    h <= region.w &&
    w <= region.h
  );
}

export function computeUtilization(
  placements: Placement[],
  sheet: SheetBounds,
  sheetCount: number,
): number {
  if (sheetCount === 0) return 0;
  const used = placements.reduce((sum, p) => sum + p.widthMm * p.heightMm, 0);
  return used / (sheet.widthMm * sheet.heightMm * sheetCount);
}

/**
 * Deterministic space-efficient packing. Several sort orders and placement
 * heuristics run, and the fewest sheets win, then the smallest used envelope,
 * which leaves the largest clear area for cutting. Not proven globally optimal.
 */
export function packItems(items: PrintItem[], options: PackOptions): LayoutResult {
  const errors: LayoutIssue[] = [];
  const fitting: PrintItem[] = [];
  const unplaced: PrintItem[] = [];

  for (const item of items) {
    if (fitsSheet(item, options)) {
      fitting.push(item);
    } else {
      unplaced.push(item);
    }
  }
  const reported = new Set<string>();
  for (const item of unplaced) {
    if (reported.has(item.photoSizeId)) continue;
    reported.add(item.photoSizeId);
    errors.push({
      code: "item-too-large",
      itemId: item.id,
      message: `A ${item.widthMm} Ã— ${item.heightMm} mm print does not fit this paper at true size. Choose larger paper, change the orientation, or allow rotation.`,
    });
  }

  let best: Attempt = { placements: [], sheets: 0, envelope: 0 };
  let hasBest = false;
  for (const order of SORT_ORDERS) {
    const sorted = sortItems(fitting, order);
    for (const heuristic of HEURISTICS) {
      const next = attempt(sorted, options, heuristic);
      if (
        !hasBest ||
        next.sheets < best.sheets ||
        (next.sheets === best.sheets && next.envelope < best.envelope)
      ) {
        best = next;
        hasBest = true;
      }
    }
  }

  return {
    sheet: options.sheet,
    sheetCount: best.sheets,
    placements: best.placements,
    unplaced,
    errors,
    utilization: computeUtilization(best.placements, options.sheet, best.sheets),
    totalItems: items.length,
  };
}
