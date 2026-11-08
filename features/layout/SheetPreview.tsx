"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, ConfirmDialog, IconButton, Notice } from "@/components/ui";
import { imageKey } from "@/features/export/pdf";
import { useStudio } from "@/features/job/store";
import type { Placement, SheetBounds } from "@/features/job/types";
import { useShortcuts } from "@/features/studio/shortcuts";
import { formatSize } from "./units";
import { usePrintImages } from "./usePrintImages";
import { useLayout } from "./useLayout";
import { isInsideRegion, overlaps } from "./validate";

const FRAME_PADDING = 32;
const SNAP_MM = 1.5;
const ZOOM_STEPS = [1, 1.5, 2, 3];

type Drag = {
  itemId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

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
  sheet,
  placements,
  scale,
  images,
  groupNames,
  sizeLabels,
  gapX,
  gapY,
  allPlacements,
}: {
  sheet: SheetBounds;
  placements: Placement[];
  scale: number;
  images: Record<string, string>;
  groupNames: Record<string, string>;
  sizeLabels: Record<string, string>;
  gapX: number;
  gapY: number;
  allPlacements: Placement[];
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
      sheetIndex: placement.sheetIndex,
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
  };

  const onPointerUp = (placement: Placement) => {
    if (drag?.itemId === placement.itemId && offset) {
      tryPlace(placement, offset.x, offset.y);
    }
    setDrag(null);
    setOffset(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, placement: Placement) => {
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
            onPointerUp={() => onPointerUp(placement)}
            onPointerCancel={() => {
              setDrag(null);
              setOffset(null);
            }}
            onKeyDown={(event) => onKeyDown(event, placement)}
            className={`print-tile absolute touch-none overflow-hidden bg-page select-none ${
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
  const options = useStudio((state) => state.options);
  const manual = useStudio((state) => state.manual);
  const manualNotice = useStudio((state) => state.manualNotice);
  const resetManualPlacements = useStudio((state) => state.resetManualPlacements);
  const dismissManualNotice = useStudio((state) => state.dismissManualNotice);
  const images = usePrintImages(layout.placements);

  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [zoomIndex, setZoomIndex] = useState(0);
  const [requestedSheet, setRequestedSheet] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setFrame({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { sheet } = layout;
  const fit = Math.min(
    Math.max(frame.width - FRAME_PADDING * 2, 120) / sheet.widthMm,
    Math.max(frame.height - FRAME_PADDING * 2, 120) / sheet.heightMm,
  );
  const scale = fit * ZOOM_STEPS[zoomIndex];
  const sheetIndex = clampIndex(requestedSheet, layout.sheetCount);
  const placements = layout.placements.filter((p) => p.sheetIndex === sheetIndex);

  const groupNames = Object.fromEntries(groups.map((g) => [g.id, g.displayName]));
  const sizeLabels = Object.fromEntries(sizes.map((s) => [s.id, s.label]));
  const hasManual = Object.keys(manual).length > 0;

  const zoomIn = () => setZoomIndex(Math.min(zoomIndex + 1, ZOOM_STEPS.length - 1));
  const zoomOut = () => setZoomIndex(Math.max(zoomIndex - 1, 0));

  useShortcuts({
    "mod+=": zoomIn,
    "mod++": zoomIn,
    "mod+-": zoomOut,
    "mod+0": () => setZoomIndex(0),
    pageup: () => setRequestedSheet(Math.max(sheetIndex - 1, 0)),
    pagedown: () => setRequestedSheet(clampIndex(sheetIndex + 1, layout.sheetCount)),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-panel px-4 py-2">
        <div className="flex items-center gap-1">
          <IconButton
            label="Previous sheet"
            disabled={sheetIndex === 0}
            onClick={() => setRequestedSheet(sheetIndex - 1)}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </IconButton>
          <span className="min-w-[88px] text-center text-[13px] tabular-nums">
            Sheet {layout.sheetCount === 0 ? 0 : sheetIndex + 1} of {layout.sheetCount}
          </span>
          <IconButton
            label="Next sheet"
            disabled={sheetIndex >= layout.sheetCount - 1}
            onClick={() => setRequestedSheet(sheetIndex + 1)}
          >
            <ChevronRight aria-hidden className="size-4" />
          </IconButton>
        </div>
        <p className="text-xs text-muted tabular-nums">
          {formatSize(sheet.widthMm, sheet.heightMm)} • {Math.round(layout.utilization * 100)}% of
          paper used
        </p>
        <div className="flex items-center gap-1">
          {hasManual ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(true)}>
              Reset to optimized
            </Button>
          ) : null}
          <IconButton
            label="Zoom out"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex(zoomIndex - 1)}
          >
            <Minus aria-hidden className="size-4" />
          </IconButton>
          <span className="w-10 text-center text-xs text-muted tabular-nums">
            {ZOOM_STEPS[zoomIndex] * 100}%
          </span>
          <IconButton
            label="Zoom in"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex(zoomIndex + 1)}
          >
            <Plus aria-hidden className="size-4" />
          </IconButton>
        </div>
      </div>

      {layout.errors.length > 0 || layout.problems.length > 0 || manualNotice ? (
        <div className="flex flex-col gap-2 border-b border-line bg-panel px-4 py-2">
          {layout.errors.map((error) => (
            <Notice key={error.code + error.itemId} tone="error">
              {error.message}
            </Notice>
          ))}
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
        <div className="flex min-h-full min-w-full w-max items-center justify-center" style={{ padding: FRAME_PADDING }}>
          {frame.width > 0 ? (
            <SheetCanvas
              key={sheetIndex}
              sheet={sheet}
              placements={placements}
              allPlacements={placements}
              scale={scale}
              images={images}
              groupNames={groupNames}
              sizeLabels={sizeLabels}
              gapX={options.gapXmm}
              gapY={options.gapYmm}
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
    </div>
  );
}
