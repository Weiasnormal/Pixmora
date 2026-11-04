import type {
  CropArea,
  EditRecipe,
  PhotoAsset,
  PhotoSize,
} from "@/features/job/types";
import { mmToPixels } from "@/features/layout/units";

const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = images.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The image could not be read."));
      image.src = url;
    });
    images.set(url, pending);
  }
  return pending;
}

export function rotatedBounds(width: number, height: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
  };
}

/** The centred crop used until the operator positions one by hand. */
export function defaultCropArea(
  widthPx: number,
  heightPx: number,
  size: Pick<PhotoSize, "widthMm" | "heightMm">,
): CropArea {
  const target = size.widthMm / size.heightMm;
  const width = Math.min(widthPx, heightPx * target);
  const height = width / target;
  return { x: (widthPx - width) / 2, y: (heightPx - height) / 2, width, height };
}

export function resolveCropArea(
  asset: PhotoAsset,
  recipe: EditRecipe,
  size: PhotoSize,
): CropArea {
  return recipe.area ?? defaultCropArea(asset.widthPx, asset.heightPx, size);
}

/** Manual fallback for browsers without canvas filters; matches CSS filter maths. */
function applyPixelAdjustments(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  brightness: number,
  contrast: number,
) {
  const frame = context.getImageData(0, 0, width, height);
  const b = brightness / 100;
  const c = contrast / 100;
  for (let i = 0; i < frame.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = frame.data[i + channel] * b;
      frame.data[i + channel] = (value - 127.5) * c + 127.5;
    }
  }
  context.putImageData(frame, 0, 0);
}

function drawBorder(
  context: CanvasRenderingContext2D,
  recipe: EditRecipe,
  width: number,
  height: number,
  size: PhotoSize,
) {
  const { border } = recipe;
  if (!border.enabled || border.widthMm <= 0) return;
  const stroke = border.widthMm * (width / size.widthMm);
  context.save();
  context.strokeStyle = border.color;
  context.lineWidth = stroke;
  if (border.style === "dashed") context.setLineDash([stroke * 3, stroke * 2]);
  // Drawn inward, so a border never grows the finished print.
  context.strokeRect(stroke / 2, stroke / 2, width - stroke, height - stroke);
  context.restore();
}

/**
 * The single renderer behind preview and export, so both always match. It
 * works from the original source each time, keeping edits non-destructive.
 */
export async function renderPrint(
  asset: PhotoAsset,
  recipe: EditRecipe,
  size: PhotoSize,
  dpi: number,
): Promise<HTMLCanvasElement> {
  const usesSolid = recipe.background.mode === "solid";
  const image = await loadImage(usesSolid && asset.cutoutUrl ? asset.cutoutUrl : asset.url);
  const area = resolveCropArea(asset, recipe, size);

  const width = Math.max(1, Math.round(mmToPixels(size.widthMm, dpi)));
  const height = Math.max(1, Math.round(mmToPixels(size.heightMm, dpi)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: false });
  if (!context) throw new Error("This browser could not start image rendering.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.fillStyle = usesSolid ? recipe.background.color : "#FFFFFF";
  context.fillRect(0, 0, width, height);

  const adjusted = recipe.brightness !== 100 || recipe.contrast !== 100;
  const hasFilter = typeof context.filter === "string";
  if (adjusted && hasFilter) {
    context.filter = `brightness(${recipe.brightness}%) contrast(${recipe.contrast}%)`;
  }

  const bounds = rotatedBounds(asset.widthPx, asset.heightPx, recipe.rotationDeg);
  context.save();
  context.scale(width / area.width, height / area.height);
  context.translate(-area.x + bounds.width / 2, -area.y + bounds.height / 2);
  context.rotate((recipe.rotationDeg * Math.PI) / 180);
  context.drawImage(image, -asset.widthPx / 2, -asset.heightPx / 2, asset.widthPx, asset.heightPx);
  context.restore();

  if (adjusted && hasFilter) context.filter = "none";
  if (adjusted && !hasFilter) {
    applyPixelAdjustments(context, width, height, recipe.brightness, recipe.contrast);
  }

  drawBorder(context, recipe, width, height, size);
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be saved."))),
      type,
      quality,
    );
  });
}

export function forgetImage(url: string) {
  images.delete(url);
}
