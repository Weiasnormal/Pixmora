import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { Placement, SheetBounds } from "@/features/job/types";
import { mmToPixels, mmToPoints } from "@/features/layout/units";

export type EmbeddedImage = { bytes: Uint8Array; type: "jpeg" | "png" };

export type PdfJob = {
  sheet: SheetBounds;
  sheetCount: number;
  placements: Placement[];
  images: Map<string, EmbeddedImage>;
  cutGuides: boolean;
  jobId: string;
  /** One readable line per copy, so every print traces back to its group. */
  trace: string[];
};

export function imageKey(groupId: string, photoSizeId: string): string {
  return `${groupId}|${photoSizeId}`;
}

/** Converts a top-left mm placement to pdf-lib's bottom-left point origin. */
export function pdfImageFrame(placement: Placement, pageHeightMm: number) {
  const left = mmToPoints(placement.xMm);
  const bottom = mmToPoints(pageHeightMm - placement.yMm - placement.heightMm);
  const width = mmToPoints(placement.widthMm);
  const height = mmToPoints(placement.heightMm);
  if (!placement.rotated) {
    return { x: left, y: bottom, width, height, rotate: 0 };
  }
  // pdf-lib turns around the image's own corner, so a 90° print starts at the
  // right edge of its frame, with the unrotated width and height.
  return { x: left + width, y: bottom, width: height, height: width, rotate: 90 };
}

/** Pixel rectangle for PNG export; each edge rounds by at most half a pixel. */
export function pixelFrame(placement: Placement, dpi: number) {
  const left = Math.round(mmToPixels(placement.xMm, dpi));
  const top = Math.round(mmToPixels(placement.yMm, dpi));
  const right = Math.round(mmToPixels(placement.xMm + placement.widthMm, dpi));
  const bottom = Math.round(mmToPixels(placement.yMm + placement.heightMm, dpi));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export async function buildPrintPdf(job: PdfJob): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Pixmora print job ${job.jobId}`);
  pdf.setCreator("Pixmora");
  pdf.setProducer("Pixmora");
  pdf.setSubject(job.jobId);
  pdf.setKeywords(job.trace);

  const embedded = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>>>();
  for (const [key, image] of job.images) {
    embedded.set(
      key,
      image.type === "jpeg" ? await pdf.embedJpg(image.bytes) : await pdf.embedPng(image.bytes),
    );
  }

  const pageWidth = mmToPoints(job.sheet.widthMm);
  const pageHeight = mmToPoints(job.sheet.heightMm);

  for (let index = 0; index < job.sheetCount; index += 1) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    for (const placement of job.placements) {
      if (placement.sheetIndex !== index) continue;
      const image = embedded.get(imageKey(placement.groupId, placement.photoSizeId));
      if (!image) {
        throw new Error("A photo was missing while building the PDF. Try exporting again.");
      }
      const frame = pdfImageFrame(placement, job.sheet.heightMm);
      page.drawImage(image, {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        rotate: degrees(frame.rotate),
      });
      if (job.cutGuides) {
        page.drawRectangle({
          x: mmToPoints(placement.xMm),
          y: mmToPoints(job.sheet.heightMm - placement.yMm - placement.heightMm),
          width: mmToPoints(placement.widthMm),
          height: mmToPoints(placement.heightMm),
          borderColor: rgb(0.6, 0.6, 0.6),
          borderWidth: 0.25,
        });
      }
    }
  }

  return pdf.save();
}

/** A true-size test page: measure these with a ruler after printing. */
export async function buildCalibrationPdf(sheet: SheetBounds): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Pixmora printer calibration");
  pdf.setCreator("Pixmora");
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const pageHeight = mmToPoints(sheet.heightMm);
  const page = pdf.addPage([mmToPoints(sheet.widthMm), pageHeight]);
  const dark = rgb(0.125, 0.125, 0.125);

  const label = (text: string, xMm: number, yMm: number, size = 9) => {
    page.drawText(text, {
      x: mmToPoints(xMm),
      y: pageHeight - mmToPoints(yMm),
      size,
      font,
      color: dark,
    });
  };

  const box = (xMm: number, yMm: number, widthMm: number, heightMm: number) => {
    page.drawRectangle({
      x: mmToPoints(xMm),
      y: pageHeight - mmToPoints(yMm + heightMm),
      width: mmToPoints(widthMm),
      height: mmToPoints(heightMm),
      borderColor: dark,
      borderWidth: 0.5,
    });
  };

  const left = Math.min(20, sheet.widthMm * 0.1);
  label("Pixmora calibration sheet", left, 18, 13);
  label("Print at 100% / Actual Size. Turn Fit to Page off, then measure each box.", left, 25);

  let y = 34;
  if (y + 25.4 < sheet.heightMm) {
    box(left, y, 25.4, 25.4);
    label("25.4 mm square (1 in)", left + 30, y + 13);
    y += 33;
  }
  if (y + 50.8 < sheet.heightMm) {
    box(left, y, 50.8, 50.8);
    label("50.8 mm square (2 in)", left + 55, y + 26);
    y += 58;
  }
  if (y + 16 < sheet.heightMm && left + 100 < sheet.widthMm) {
    const yRule = y + 6;
    page.drawLine({
      start: { x: mmToPoints(left), y: pageHeight - mmToPoints(yRule) },
      end: { x: mmToPoints(left + 100), y: pageHeight - mmToPoints(yRule) },
      thickness: 0.5,
      color: dark,
    });
    for (let mm = 0; mm <= 100; mm += 10) {
      const tick = mm % 50 === 0 ? 4 : 2;
      page.drawLine({
        start: { x: mmToPoints(left + mm), y: pageHeight - mmToPoints(yRule) },
        end: { x: mmToPoints(left + mm), y: pageHeight - mmToPoints(yRule + tick) },
        thickness: 0.5,
        color: dark,
      });
    }
    label("100 mm ruler", left, yRule + 9);
  }

  return pdf.save();
}
