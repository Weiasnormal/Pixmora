import { canvasToBlob, renderPrint } from "@/features/images/render";
import { createDefaultRecipe } from "@/features/job/defaults";
import type { Library } from "@/features/job/expand";
import type { PhotoAsset, PhotoGroup, Placement, SheetBounds } from "@/features/job/types";
import type { StudioLayout } from "@/features/layout/computeLayout";
import {
  buildCalibrationPdf,
  buildPrintPdf,
  imageKey,
  pixelFrame,
  type EmbeddedImage,
} from "./pdf";

export const DEFAULT_EXPORT_DPI = 300;

/** A frozen copy of the job, so edits made during export cannot mix into it. */
export type ExportSnapshot = {
  layout: StudioLayout;
  groups: PhotoGroup[];
  assets: Record<string, PhotoAsset>;
  library: Library;
  cutGuides: boolean;
};

function createJobId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PX-${stamp}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export function exportBlocker(layout: StudioLayout): string | null {
  if (layout.totalItems === 0) return "Add a photo first.";
  if (layout.unplaced.length > 0) return "A print is larger than this paper.";
  if (layout.problems.length > 0) return "Fix the overlapping prints first.";
  return null;
}

function assertExportable(layout: StudioLayout) {
  const blocker = exportBlocker(layout);
  if (blocker) throw new Error(blocker);
}

function renderKeys(placements: Placement[]) {
  const seen = new Map<string, { groupId: string; photoSizeId: string }>();
  for (const { groupId, photoSizeId } of placements) {
    seen.set(imageKey(groupId, photoSizeId), { groupId, photoSizeId });
  }
  return seen;
}

async function renderCanvases(snapshot: ExportSnapshot, dpi: number) {
  const canvases = new Map<string, HTMLCanvasElement>();
  for (const [key, { groupId, photoSizeId }] of renderKeys(snapshot.layout.placements)) {
    const group = snapshot.groups.find((g) => g.id === groupId);
    const size = snapshot.library.sizes.find((s) => s.id === photoSizeId);
    const asset = group ? snapshot.assets[group.assetId] : undefined;
    if (!group || !size || !asset) {
      throw new Error("A photo in this layout is missing. Check the queue and try again.");
    }
    const recipe = group.editsByPhotoSize[photoSizeId] ?? createDefaultRecipe();
    canvases.set(key, await renderPrint(asset, recipe, size, dpi));
  }
  return canvases;
}

function traceLines(snapshot: ExportSnapshot): string[] {
  return snapshot.layout.placements.map((placement) => {
    const group = snapshot.groups.find((g) => g.id === placement.groupId);
    const size = snapshot.library.sizes.find((s) => s.id === placement.photoSizeId);
    return `Sheet ${placement.sheetIndex + 1}: ${group?.displayName} / ${size?.label} / copy ${placement.copyIndex + 1}`;
  });
}

export async function createPrintPdf(snapshot: ExportSnapshot, dpi = DEFAULT_EXPORT_DPI) {
  assertExportable(snapshot.layout);
  const canvases = await renderCanvases(snapshot, dpi);

  const images = new Map<string, EmbeddedImage>();
  for (const [key, canvas] of canvases) {
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
    images.set(key, { type: "jpeg", bytes: new Uint8Array(await blob.arrayBuffer()) });
  }

  const jobId = createJobId();
  const bytes = await buildPrintPdf({
    sheet: snapshot.layout.sheet,
    sheetCount: snapshot.layout.sheetCount,
    placements: snapshot.layout.placements,
    images,
    cutGuides: snapshot.cutGuides,
    jobId,
    trace: traceLines(snapshot),
  });
  return { bytes, jobId };
}

function drawSheet(
  snapshot: ExportSnapshot,
  sheetIndex: number,
  dpi: number,
  canvases: Map<string, HTMLCanvasElement>,
): HTMLCanvasElement {
  const { sheet, placements } = snapshot.layout;
  const page = document.createElement("canvas");
  page.width = Math.round((sheet.widthMm / 25.4) * dpi);
  page.height = Math.round((sheet.heightMm / 25.4) * dpi);
  const context = page.getContext("2d");
  if (!context) throw new Error("This browser could not start image rendering.");

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, page.width, page.height);
  context.imageSmoothingQuality = "high";

  for (const placement of placements) {
    if (placement.sheetIndex !== sheetIndex) continue;
    const source = canvases.get(imageKey(placement.groupId, placement.photoSizeId));
    if (!source) continue;
    const frame = pixelFrame(placement, dpi);
    context.save();
    if (placement.rotated) {
      context.translate(frame.x, frame.y + frame.height);
      context.rotate(-Math.PI / 2);
      context.drawImage(source, 0, 0, frame.height, frame.width);
    } else {
      context.drawImage(source, frame.x, frame.y, frame.width, frame.height);
    }
    context.restore();
    if (snapshot.cutGuides) {
      context.strokeStyle = "#999999";
      context.lineWidth = 1;
      context.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.width - 1, frame.height - 1);
    }
  }
  return page;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes.slice().buffer], { type: "application/pdf" });
}

export async function downloadPdf(snapshot: ExportSnapshot) {
  const { bytes, jobId } = await createPrintPdf(snapshot);
  triggerDownload(pdfBlob(bytes), `pixmora-${jobId}.pdf`);
  return jobId;
}

export async function downloadPngs(snapshot: ExportSnapshot, dpi: number) {
  assertExportable(snapshot.layout);
  const canvases = await renderCanvases(snapshot, dpi);
  for (let index = 0; index < snapshot.layout.sheetCount; index += 1) {
    const blob = await canvasToBlob(drawSheet(snapshot, index, dpi, canvases), "image/png");
    triggerDownload(blob, `pixmora-sheet-${index + 1}-${dpi}dpi.png`);
  }
  return snapshot.layout.sheetCount;
}

/** Opens the browser's print dialog for the same PDF the download produces. */
export async function printPdf(snapshot: ExportSnapshot) {
  const { bytes } = await createPrintPdf(snapshot);
  const url = URL.createObjectURL(pdfBlob(bytes));
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  document.body.appendChild(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120_000);
}

export async function downloadCalibrationSheet(sheet: SheetBounds) {
  const bytes = await buildCalibrationPdf(sheet);
  triggerDownload(pdfBlob(bytes), "pixmora-calibration.pdf");
}
