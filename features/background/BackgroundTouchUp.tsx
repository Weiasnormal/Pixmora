"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Loader2, Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button, ConfirmDialog, IconButton, Segmented, SliderField, Toggle } from "@/components/ui";
import { resolveRecipe } from "@/features/job/recipe";
import { useSelectedGroup, useStudio } from "@/features/job/store";
import type { EditRecipe, PhotoAsset, PhotoGroup, PhotoSize } from "@/features/job/types";
import { useShortcuts } from "@/features/studio/shortcuts";

type Tool = "erase" | "restore" | "move";
type Point = { x: number; y: number };

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const MIN_BRUSH = 4;
const MAX_BRUSH = 160;
/** Undo snapshots are full copies, so large photos keep fewer of them. */
const HISTORY_BYTES = 240_000_000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be read."));
    image.src = url;
  });
}

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d")?.drawImage(source, 0, 0);
  return copy;
}

/** A round brush whose edge fades over `softness` of its radius. */
function brushFill(context: CanvasRenderingContext2D, x: number, y: number, radius: number, softness: number) {
  if (softness <= 0) return "#000";
  const gradient = context.createRadialGradient(x, y, radius * (1 - softness), x, y, radius);
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  return gradient;
}

function TouchUpSurface({
  group,
  asset,
  size,
  recipe,
}: {
  group: PhotoGroup;
  asset: PhotoAsset;
  size: PhotoSize;
  recipe: EditRecipe;
}) {
  const setCutout = useStudio((state) => state.setCutout);
  const updateRecipe = useStudio((state) => state.updateRecipe);
  const setView = useStudio((state) => state.setView);

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLImageElement | null>(null);
  const stampRef = useRef<HTMLCanvasElement | null>(null);
  const pastRef = useRef<HTMLCanvasElement[]>([]);
  const futureRef = useRef<HTMLCanvasElement[]>([]);
  const strokeRef = useRef<{ last: Point } | null>(null);
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>("erase");
  const [brush, setBrush] = useState(40);
  const [softness, setSoftness] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const [showRemoved, setShowRemoved] = useState(true);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [panning, setPanning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const backdrop = recipe.background.mode === "solid" ? recipe.background.color : "#FFFFFF";
  const scale = fit * zoom;

  // The cutout is edited at full resolution. Without one, editing starts from the whole photo.
  useEffect(() => {
    let active = true;
    Promise.all([loadImage(asset.url), loadImage(asset.cutoutUrl ?? asset.url)])
      .then(([original, start]) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!active || !canvas || !context) return;
        originalRef.current = original;
        canvas.width = asset.widthPx;
        canvas.height = asset.heightPx;
        context.drawImage(start, 0, 0, asset.widthPx, asset.heightPx);
        setReady(true);
      })
      .catch(() => toast.error("This photo could not be opened for touch-up."));
    return () => {
      active = false;
    };
  }, [asset]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const padding = 32;
      setFit(
        Math.min(
          (viewport.clientWidth - padding) / asset.widthPx,
          (viewport.clientHeight - padding) / asset.heightPx,
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [asset.widthPx, asset.heightPx]);

  const historyLimit = Math.max(3, Math.min(30, Math.floor(HISTORY_BYTES / (asset.widthPx * asset.heightPx * 4))));

  const toImagePoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * asset.widthPx) / rect.width,
      y: ((event.clientY - rect.top) * asset.heightPx) / rect.height,
    };
  };

  const stamp = (point: Point) => {
    const context = canvasRef.current?.getContext("2d");
    const original = originalRef.current;
    if (!context || !original) return;
    // The brush keeps its on-screen size, so it covers fewer pixels when zoomed in.
    const radius = brush / 2 / scale;
    const soft = softness / 100;

    if (tool === "erase") {
      context.save();
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = brushFill(context, point.x, point.y, radius, soft);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }

    // Restoring copies the original pixels back under the brush.
    const side = Math.ceil(radius * 2) + 2;
    const left = Math.floor(point.x - radius) - 1;
    const top = Math.floor(point.y - radius) - 1;
    const piece = (stampRef.current ??= document.createElement("canvas"));
    if (piece.width < side || piece.height < side) {
      piece.width = side;
      piece.height = side;
    }
    const pieceContext = piece.getContext("2d");
    if (!pieceContext) return;
    pieceContext.clearRect(0, 0, piece.width, piece.height);
    pieceContext.globalCompositeOperation = "source-over";
    pieceContext.drawImage(original, left, top, side, side, 0, 0, side, side);
    pieceContext.globalCompositeOperation = "destination-in";
    const centreX = point.x - left;
    const centreY = point.y - top;
    pieceContext.fillStyle = brushFill(pieceContext, centreX, centreY, radius, soft);
    pieceContext.beginPath();
    pieceContext.arc(centreX, centreY, radius, 0, Math.PI * 2);
    pieceContext.fill();
    context.drawImage(piece, 0, 0, side, side, left, top, side, side);
  };

  const strokeTo = (from: Point, to: Point) => {
    const radius = brush / 2 / scale;
    const spacing = Math.max(0.5, radius * 0.2);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      stamp({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }
  };

  const syncHistory = () =>
    setHistory({ undo: pastRef.current.length, redo: futureRef.current.length });

  const remember = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pastRef.current.push(copyCanvas(canvas));
    if (pastRef.current.length > historyLimit) pastRef.current.shift();
    futureRef.current = [];
    syncHistory();
  };

  const step = (from: HTMLCanvasElement[], to: HTMLCanvasElement[]) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const snapshot = from.pop();
    if (!canvas || !context || !snapshot) return;
    to.push(copyCanvas(canvas));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(snapshot, 0, 0);
    setDirty(true);
    syncHistory();
  };
  const undo = () => step(pastRef.current, futureRef.current);
  const redo = () => step(futureRef.current, pastRef.current);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!ready || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "move") {
      const viewport = viewportRef.current!;
      panRef.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      setPanning(true);
      return;
    }
    remember();
    const point = toImagePoint(event);
    stamp(point);
    strokeRef.current = { last: point };
    setDirty(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    setCursor({ x: event.clientX, y: event.clientY });
    if (panRef.current) {
      const viewport = viewportRef.current!;
      viewport.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x);
      viewport.scrollTop = panRef.current.top - (event.clientY - panRef.current.y);
      return;
    }
    if (!strokeRef.current) return;
    const point = toImagePoint(event);
    strokeTo(strokeRef.current.last, point);
    strokeRef.current.last = point;
  };

  const endStroke = () => {
    strokeRef.current = null;
    panRef.current = null;
    setPanning(false);
  };

  const zoomBy = (factor: number) =>
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z * factor).toFixed(2)))));
  const resizeBrush = (factor: number) =>
    setBrush((b) => Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, Math.round(b * factor))));

  const leave = () => {
    if (dirty) setConfirmingLeave(true);
    else setView("sheets");
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    canvas.toBlob((blob) => {
      setSaving(false);
      if (!blob) {
        toast.error("The touch-up could not be saved.");
        return;
      }
      setCutout(asset.id, URL.createObjectURL(blob));
      if (recipe.background.mode !== "solid") {
        updateRecipe(group.id, size.id, { background: { ...recipe.background, mode: "solid" } }, "background");
      }
      setView("sheets");
      toast.success("Background touch-up saved.");
    }, "image/png");
  };

  useShortcuts({
    e: () => setTool("erase"),
    r: () => setTool("restore"),
    h: () => setTool("move"),
    "[": () => resizeBrush(1 / 1.25),
    "]": () => resizeBrush(1.25),
    "mod+z": undo,
    "mod+shift+z": redo,
    "mod+y": redo,
    "mod+=": () => zoomBy(1.25),
    "mod++": () => zoomBy(1.25),
    "mod+-": () => zoomBy(1 / 1.25),
    "mod+0": () => setZoom(MIN_ZOOM),
    escape: leave,
  });

  const canUndo = history.undo > 0;
  const canRedo = history.redo > 0;
  const showCursor = ready && cursor && tool !== "move";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2.5 short:py-1">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">Touching up {group.displayName}</p>
          <p className="text-xs text-muted">
            Erase leftover background, or restore parts the removal took away.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Undo stroke" disabled={!canUndo} onClick={undo}>
            <Undo2 aria-hidden className="size-4" />
          </IconButton>
          <IconButton label="Redo stroke" disabled={!canRedo} onClick={redo}>
            <Redo2 aria-hidden className="size-4" />
          </IconButton>
          <Button size="sm" onClick={leave}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!ready || saving || !dirty} onClick={save}>
            {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-auto bg-dark"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={() => setCursor(null)}
      >
        <div className="grid min-h-full min-w-full place-items-center p-4" style={{ width: "max-content" }}>
          <div
            className="relative shadow-xl"
            style={{
              width: asset.widthPx * scale,
              height: asset.heightPx * scale,
              backgroundColor: backdrop,
              cursor: tool === "move" ? (panning ? "grabbing" : "grab") : "none",
            }}
          >
            {showRemoved ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL, shown as a faint guide
              <img
                src={asset.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 size-full opacity-30 select-none"
              />
            ) : null}
            <canvas ref={canvasRef} className="absolute inset-0 size-full" />
          </div>
        </div>
        {!ready ? (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
            <Loader2 aria-hidden className="size-5 animate-spin" />
          </div>
        ) : null}
      </div>

      {showCursor ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 rounded-full border border-white mix-blend-difference"
          style={{ left: cursor.x - brush / 2, top: cursor.y - brush / 2, width: brush, height: brush }}
        />
      ) : null}

      <div className="grid grid-cols-2 items-end gap-x-4 gap-y-2 border-t border-line bg-panel px-4 py-3 short:py-1 lg:grid-cols-[auto_1fr_1fr_1fr_auto]">
        <div className="col-span-2 lg:col-span-1">
          <Segmented<Tool>
            label="Brush"
            value={tool}
            options={[
              { value: "erase", label: "Erase" },
              { value: "restore", label: "Restore" },
              { value: "move", label: "Move" },
            ]}
            onChange={setTool}
          />
        </div>
        <SliderField label="Brush size" value={brush} min={MIN_BRUSH} max={MAX_BRUSH} suffix=" px" onChange={setBrush} />
        <SliderField label="Soft edge" value={softness} min={0} max={100} suffix="%" onChange={setSoftness} />
        <SliderField label="Zoom" value={zoom} min={MIN_ZOOM} max={MAX_ZOOM} step={0.05} suffix="×" onChange={setZoom} />
        <div className="col-span-2 lg:col-span-1">
          <Toggle label="Show removed areas" checked={showRemoved} onChange={setShowRemoved} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmingLeave}
        title="Discard this touch-up?"
        body="Your brush strokes on this photo will be lost. The background stays as it was before you opened touch-up."
        confirmLabel="Discard"
        onConfirm={() => setView("sheets")}
        onClose={() => setConfirmingLeave(false)}
      />
    </div>
  );
}

export function BackgroundTouchUp() {
  const group = useSelectedGroup();
  const sizeId = useStudio((state) => state.editingSizeId);
  const asset = useStudio((state) => (group ? state.assets[group.assetId] : undefined));
  const size = useStudio((state) => state.library.sizes.find((s) => s.id === sizeId));

  if (!group || !asset || !size) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted">
        Select a photo to touch up its background.
      </div>
    );
  }

  return (
    <TouchUpSurface
      key={asset.id}
      group={group}
      asset={asset}
      size={size}
      recipe={resolveRecipe(group, size.id)}
    />
  );
}
