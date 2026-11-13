"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, ConfirmDialog, IconButton, Notice } from "@/components/ui";
import { imageKey } from "@/features/export/pdf";
import { useStudio } from "@/features/job/store";
import type { Placement, SheetBounds, SheetPage } from "@/features/job/types";
import { useShortcuts } from "@/features/studio/shortcuts";
import { findFreeSpot } from "./sheets";
import { formatSize } from "./units";
import { usePrintImages } from "./usePrintImages";
import { useLayout } from "./useLayout";
import { isInsideRegion, overlaps } from "./validate";

const FRAME_PADDING = 32;
const FRAME_PADDING_NARROW = 12;
const NARROW_FRAME = 480;
const SNAP_MM = 1.5;
const ZOOM_STEPS = [1, 1.5, 2, 3, 4];
const MIN_ZOOM = ZOOM_STEPS[0];
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];
/** How strongly one unit of wheel movement zooms. A mouse notch is about 22%. */
const WHEEL_ZOOM_RATE = 0.0025;

const clampZoom = (zoom: number) => Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);

type Drag = {
  itemId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

/** The sheet tab under the pointer, so a print dragged onto a tab can move to that sheet. */
function tabAt(clientX: number, clientY: number): number | null {
  const tab = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-sheet-tab]");
  return tab ? Number(tab.dataset.sheetTab) : null;
}

function clampIndex(index: number, count: number): number {
  return Math.min(index, Math.max(count - 1, 0));
}

/** Pulls an edge onto a nearby print or the printable region, keeping exact gaps. */
function snap(
  value: number,
  length: number,
  lines: number[],
): number {
  let best = value;
  let distance = SNAP_MM;
  for (const line of lines) {
    for (const candidate of [line, line - length]) {
      const gap = Math.abs(candidate - value);
      if (gap < distance) {
        distance = gap;
        best = candidate;
      }
    }
  }
  return best;
}

function SheetCanvas({
  page,
  sheet,
  placements,
  scale,
  images,
  groupNames,
  sizeLabels,
  gapX,
  gapY,
  allPlacements,
  zoomed,
  sheetCount,
  onMoveToSheet,
  onTabHover,
}: {
  page: SheetPage;
  sheet: SheetBounds;
  placements: Placement[];
  scale: number;
  images: Record<string, string>;
  groupNames: Record<string, string>;
  sizeLabels: Record<string, string>;
  gapX: number;
  gapY: number;
  allPlacements: Placement[];
  zoomed: boolean;
  sheetCount: number;
  onMoveToSheet: (placement: Placement, sheetIndex: number) => void;
  onTabHover: (sheetIndex: number | null) => void;
}) {
  const selectedGroupId = useStudio((state) => state.selectedGroupId);
  const select = useStudio((state) => state.select);
  const setManualPlacement = useStudio((state) => state.setManualPlacement);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  const tryPlace = (placement: Placement, xMm: number, yMm: number): boolean => {
    const candidate = {
      ...placement,
      xMm: Number(xMm.toFixed(3)),
      yMm: Number(yMm.toFixed(3)),
    };
    const clash = allPlacements.some(
      (other) => other.itemId !== placement.itemId && overlaps(candidate, other),
    );
    if (clash || !isInsideRegion(candidate, sheet)) {
      toast.error(
        clash
          ? "That spot overlaps another print, so it was not moved."
          : "That spot is outside the printable area, so it was not moved.",
      );
      return false;
    }
    setManualPlacement(placement.itemId, {
      sheetId: page.sheetId,
      pageInSheet: page.pageInSheet,
      xMm: candidate.xMm,
      yMm: candidate.yMm,
    });
    return true;
  };

  const snappedPosition = (placement: Placement, dx: number, dy: number) => {
    const others = placements.filter((p) => p.itemId !== placement.itemId);
    const xLines = [
      sheet.insetMm,
      sheet.widthMm - sheet.insetMm,
      ...others.flatMap((p) => [p.xMm - gapX, p.xMm + p.widthMm + gapX]),
    ];
    const yLines = [
      sheet.insetMm,
      sheet.heightMm - sheet.insetMm,
      ...others.flatMap((p) => [p.yMm - gapY, p.yMm + p.heightMm + gapY]),
    ];
    return {
      x: snap(placement.xMm + dx, placement.widthMm, xLines),
      y: snap(placement.yMm + dy, placement.heightMm, yLines),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, placement: Placement) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    select(placement.groupId);
    setDrag({
      itemId: placement.itemId,
      startX: event.clientX,
      startY: event.clientY,
      originX: placement.xMm,
      originY: placement.yMm,
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>, placement: Placement) => {
    if (drag?.itemId !== placement.itemId) return;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    setOffset(snappedPosition(placement, dx, dy));
    onTabHover(tabAt(event.clientX, event.clientY));
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>, placement: Placement) => {
    const tab = tabAt(event.clientX, event.clientY);
    onTabHover(null);
    if (drag?.itemId === placement.itemId && tab !== null && tab !== placement.sheetIndex) {
      onMoveToSheet(placement, tab);
    } else if (drag?.itemId === placement.itemId && offset) {
      tryPlace(placement, offset.x, offset.y);
    }
    setDrag(null);
    setOffset(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, placement: Placement) => {
    if (event.shiftKey && (event.key === "PageUp" || event.key === "PageDown")) {
      const target = placement.sheetIndex + (event.key === "PageDown" ? 1 : -1);
      if (target >= 0 && target < sheetCount) {
        event.preventDefault();
        onMoveToSheet(placement, target);
      }
      return;
    }
    const step = event.shiftKey ? 0.1 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    tryPlace(placement, placement.xMm + move[0], placement.yMm + move[1]);
  };

  return (
    <div
      data-testid="sheet"
      data-sheet
      className="relative shrink-0 bg-panel shadow-[0_0_0_1px_var(--border-subtle)]"
      style={{ width: sheet.widthMm * scale, height: sheet.heightMm * scale }}
    >
      {sheet.insetMm > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute border border-dashed border-line-strong"
          style={{
            inset: sheet.insetMm * scale,
          }}
        />
      ) : null}
      {placements.map((placement) => {
        const moving = drag?.itemId === placement.itemId && offset;
        const x = moving ? offset.x : placement.xMm;
        const y = moving ? offset.y : placement.yMm;
        const url = images[imageKey(placement.groupId, placement.photoSizeId)];
        const name = groupNames[placement.groupId] ?? "Photo";
        const label = sizeLabels[placement.photoSizeId] ?? "";

        return (
          <button
            key={placement.itemId}
            type="button"
            data-testid="print-tile"
            aria-label={`${name}, ${label}, copy ${placement.copyIndex + 1}. Use arrow keys to move.`}
            title={`${name} • ${label}`}
            onPointerDown={(event) => onPointerDown(event, placement)}
            onPointerMove={(event) => onPointerMove(event, placement)}
            onPointerUp={(event) => onPointerUp(event, placement)}
            onPointerCancel={() => {
              onTabHover(null);
              setDrag(null);
              setOffset(null);
            }}
            onKeyDown={(event) => onKeyDown(event, placement)}
            // Zoomed in, a finger on a print has to pan the sheet, or nothing could scroll.
            className={`print-tile absolute overflow-hidden bg-page select-none ${zoomed ? "touch-auto" : "touch-none"} ${
              moving ? "z-10 cursor-grabbing" : "cursor-grab"
            } ${selectedGroupId === placement.groupId ? "outline-1 -outline-offset-1 outline-primary" : ""}`}
            style={{
              left: x * scale,
              top: y * scale,
              width: placement.widthMm * scale,
              height: placement.heightMm * scale,
            }}
          >
            {url ? (
              // Blob previews come from the local renderer, not a remote image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                draggable={false}
                className="absolute top-1/2 left-1/2 max-w-none"
                style={{
                  width: (placement.rotated ? placement.heightMm : placement.widthMm) * scale,
                  height: (placement.rotated ? placement.widthMm : placement.heightMm) * scale,
                  transform: `translate(-50%, -50%) rotate(${placement.rotated ? -90 : 0}deg)`,
                }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SheetPreview() {
  const layout = useLayout();
  const groups = useStudio((state) => state.groups);
  const sizes = useStudio((state) => state.library.sizes);
  const sheets = useStudio((state) => state.sheets);
  const activeSheetId = useStudio((state) => state.activeSheetId);
  const activePageInSheet = useStudio((state) => state.activePageInSheet);
  const openSheet = useStudio((state) => state.openSheet);
  const manual = useStudio((state) => state.manual);
  const manualNotice = useStudio((state) => state.manualNotice);
  const resetManualPlacements = useStudio((state) => state.resetManualPlacements);
  const setManualPlacement = useStudio((state) => state.setManualPlacement);
  const addSheet = useStudio((state) => state.addSheet);
  const removeSheet = useStudio((state) => state.removeSheet);
  const dismissManualNotice = useStudio((state) => state.dismissManualNotice);
  const images = usePrintImages(layout.placements);

  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const zoomRef = useRef(zoom);
  /** The sheet point under the pointer during a wheel zoom, kept there after the resize. */
  const anchor = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const [dropTab, setDropTab] = useState<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setFrame({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The open tab is the open sheet's page, so adding a photo always lands on what is shown.
  const sheetNumber = (sheetId: string) => sheets.findIndex((s) => s.id === sheetId) + 1;
  const sheetPages = layout.pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => page.sheetId === activeSheetId);
  const sheetIndex =
    sheetPages[clampIndex(activePageInSheet, sheetPages.length)]?.index ??
    clampIndex(0, layout.sheetCount);
  const page = layout.pages[sheetIndex];
  const sheet = page.bounds;
  const tabLabel = (target: SheetPage) =>
    target.pageInSheet === 0
      ? `Sheet ${sheetNumber(target.sheetId)}`
      : `Sheet ${sheetNumber(target.sheetId)} · page ${target.pageInSheet + 1}`;
  const openPage = (index: number) => {
    const target = layout.pages[index];
    if (target) openSheet(target.sheetId, target.pageInSheet);
  };
  const padding = frame.width < NARROW_FRAME ? FRAME_PADDING_NARROW : FRAME_PADDING;
  const fit = Math.min(
    Math.max(frame.width - padding * 2, 120) / sheet.widthMm,
    Math.max(frame.height - padding * 2, 120) / sheet.heightMm,
  );
  const scale = fit * zoom;
  const placements = layout.placements.filter((p) => p.sheetIndex === sheetIndex);
  const emptySheet = placements.length === 0 && layout.sheetCount > 0;
  const pageUse =
    placements.reduce((sum, p) => sum + p.widthMm * p.heightMm, 0) /
    (sheet.widthMm * sheet.heightMm);
  const photosOnSheet = groups.filter((g) => g.sheetId === page.sheetId).length;
  // The last sheet stays, so there is always a paper to add photos to.
  const canRemoveSheet = sheets.length > 1;

  // Narrow screens scroll the tab row, so keep the open sheet's tab in view.
  useEffect(() => {
    tabsRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sheetIndex, layout.sheetCount]);

  const moveToSheet = (placement: Placement, target: number) => {
    const targetPage = layout.pages[target];
    if (!targetPage) return;
    // The print takes the paper and gaps of the sheet it moves to.
    const spot = findFreeSpot(
      placement,
      target,
      layout.placements,
      targetPage.bounds,
      targetPage.gapXmm,
      targetPage.gapYmm,
    );
    if (!spot) {
      toast.error(`${tabLabel(targetPage)} has no room for this print.`);
      return;
    }
    setManualPlacement(placement.itemId, {
      sheetId: targetPage.sheetId,
      pageInSheet: targetPage.pageInSheet,
      ...spot,
    });
    openSheet(targetPage.sheetId, targetPage.pageInSheet);
  };

  const groupNames = Object.fromEntries(groups.map((g) => [g.id, g.displayName]));
  const sizeLabels = Object.fromEntries(sizes.map((s) => [s.id, s.label]));
  const hasManual = Object.keys(manual).length > 0;

  // Buttons and keys step through set levels, from wherever the wheel left the zoom.
  const zoomIn = () => setZoom(ZOOM_STEPS.find((step) => step > zoom + 0.01) ?? MAX_ZOOM);
  const zoomOut = () =>
    setZoom([...ZOOM_STEPS].reverse().find((step) => step < zoom - 0.01) ?? MIN_ZOOM);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Ctrl or Cmd with the wheel zooms the sheet, as does a trackpad pinch, which browsers send
  // as a Ctrl wheel. React wheel listeners are passive, so this one is added by hand to stop
  // the browser zooming the whole page instead.
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const sheetBox = element.querySelector("[data-sheet]")?.getBoundingClientRect();
      if (!sheetBox) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      const next = clampZoom(zoomRef.current * Math.exp(-event.deltaY * unit * WHEEL_ZOOM_RATE));
      if (next === zoomRef.current) return;
      anchor.current = {
        x: event.clientX,
        y: event.clientY,
        fx: (event.clientX - sheetBox.left) / sheetBox.width,
        fy: (event.clientY - sheetBox.top) / sheetBox.height,
      };
      zoomRef.current = next;
      setZoom(next);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useLayoutEffect(() => {
    const element = frameRef.current;
    const point = anchor.current;
    anchor.current = null;
    const sheetBox = element?.querySelector("[data-sheet]")?.getBoundingClientRect();
    if (!element || !point || !sheetBox) return;
    element.scrollLeft += sheetBox.left + point.fx * sheetBox.width - point.x;
    element.scrollTop += sheetBox.top + point.fy * sheetBox.height - point.y;
  }, [scale]);

  useShortcuts({
    "mod+=": zoomIn,
    "mod++": zoomIn,
    "mod+-": zoomOut,
    "mod+0": () => setZoom(MIN_ZOOM),
    pageup: () => openPage(Math.max(sheetIndex - 1, 0)),
    pagedown: () => openPage(clampIndex(sheetIndex + 1, layout.sheetCount)),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sized by this panel, not the screen, because tablet panes are narrower than phones held sideways. */}
      <div className="@container border-b border-line bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-2 short:py-0.5 max-sm:px-2 @xl:gap-x-4">
          <div className="flex min-w-0 items-center gap-1">
            <div ref={tabsRef} role="tablist" aria-label="Sheets" className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {layout.pages.map((tab, index) => (
                <button
                  key={`${tab.sheetId}:${tab.pageInSheet}`}
                  type="button"
                  role="tab"
                  aria-selected={index === sheetIndex}
                  data-sheet-tab={index}
                  onClick={() => openPage(index)}
                  className={`h-8 shrink-0 rounded-lg border px-3 text-[13px] whitespace-nowrap tabular-nums transition-colors duration-150 ease-out max-md:h-11 coarse:h-11 ${
                    dropTab === index
                      ? "border-primary bg-primary-soft text-ink"
                      : index === sheetIndex
                        ? "border-line-strong bg-panel font-medium text-ink"
                        : "border-transparent text-muted hover:bg-page hover:text-ink"
                  }`}
                >
                  {tabLabel(tab)}
                </button>
              ))}
            </div>
            <IconButton label="Add sheet" data-guide="add-sheet" onClick={addSheet}>
              <Plus aria-hidden className="size-4" />
            </IconButton>
            {canRemoveSheet ? (
              <IconButton
                label={`Remove Sheet ${sheetNumber(page.sheetId)}`}
                onClick={() =>
                  photosOnSheet > 0 ? setConfirmingRemove(true) : removeSheet(page.sheetId)
                }
              >
                <Trash2 aria-hidden className="size-4" />
              </IconButton>
            ) : null}
          </div>
          <p className="text-xs text-muted tabular-nums @max-xl:order-last @max-xl:w-full @max-xl:px-2">
            {formatSize(sheet.widthMm, sheet.heightMm)} • {Math.round(pageUse * 100)}% of paper
            used
          </p>
          <div className="flex flex-wrap items-center gap-1 max-sm:gap-0">
            {hasManual ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(true)}>
                Reset to optimized
              </Button>
            ) : null}
            <div data-guide="zoom" className="flex items-center gap-1 max-sm:gap-0">
              <IconButton label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={zoomOut}>
                <Minus aria-hidden className="size-4" />
              </IconButton>
              <span className="w-10 text-center text-xs text-muted tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <IconButton label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={zoomIn}>
                <Plus aria-hidden className="size-4" />
              </IconButton>
            </div>
          </div>
        </div>
      </div>

      {layout.errors.length > 0 || layout.problems.length > 0 || manualNotice || emptySheet ? (
        <div className="flex flex-col gap-2 border-b border-line bg-panel px-4 py-2">
          {layout.errors.map((error) => (
            <Notice key={error.code + error.itemId} tone="error">
              {error.message}
            </Notice>
          ))}
          {emptySheet ? (
            <Notice
              action={
                canRemoveSheet && photosOnSheet === 0 ? (
                  <button
                    type="button"
                    className="font-medium underline underline-offset-2"
                    onClick={() => removeSheet(page.sheetId)}
                  >
                    Remove sheet
                  </button>
                ) : undefined
              }
            >
              {tabLabel(page)} is empty. Photos you add now go on this sheet, or drag a print
              onto its tab. Empty sheets are left out of exports.
            </Notice>
          ) : null}
          {layout.problems.length > 0 ? (
            <Notice tone="error">
              Some prints overlap or leave the printable area, so export is blocked until they are
              fixed.
            </Notice>
          ) : null}
          {manualNotice ? (
            <Notice
              action={
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={dismissManualNotice}
                >
                  Dismiss
                </button>
              }
            >
              The job changed, so your manual moves were replaced with a new optimized layout. Use
              Undo to get them back.
            </Notice>
          ) : null}
        </div>
      ) : null}

      <div ref={frameRef} className="min-h-0 flex-1 overflow-auto bg-page">
        <div className="flex min-h-full min-w-full w-max items-center justify-center" style={{ padding }}>
          {frame.width > 0 ? (
            <SheetCanvas
              key={sheetIndex}
              page={page}
              sheet={sheet}
              placements={placements}
              allPlacements={placements}
              scale={scale}
              images={images}
              groupNames={groupNames}
              sizeLabels={sizeLabels}
              gapX={page.gapXmm}
              gapY={page.gapYmm}
              zoomed={zoom > MIN_ZOOM}
              sheetCount={layout.sheetCount}
              onMoveToSheet={moveToSheet}
              onTabHover={setDropTab}
            />
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingReset}
        title="Reset to the optimized layout?"
        body="Prints you moved by hand go back to their optimized spots. Undo brings your moves back."
        confirmLabel="Reset layout"
        onConfirm={resetManualPlacements}
        onClose={() => setConfirmingReset(false)}
      />
      <ConfirmDialog
        open={confirmingRemove}
        title={`Remove Sheet ${sheetNumber(page.sheetId)}?`}
        body={`Its ${photosOnSheet === 1 ? "photo is" : `${photosOnSheet} photos are`} removed with it. Undo brings the sheet back.`}
        confirmLabel="Remove sheet"
        onConfirm={() => removeSheet(page.sheetId)}
        onClose={() => setConfirmingRemove(false)}
      />
    </div>
  );
}
