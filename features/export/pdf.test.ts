import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { Placement, SheetBounds } from "@/features/job/types";
import { mmToPoints } from "@/features/layout/units";
import {
  buildCalibrationPdf,
  buildPrintPdf,
  imageKey,
  pdfImageFrame,
  pixelFrame,
  type EmbeddedImage,
} from "./pdf";

const A4: SheetBounds = { widthMm: 210, heightMm: 297, insetMm: 0 };

const WHITE_PIXEL: EmbeddedImage = {
  type: "png",
  bytes: Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
    ),
    (c) => c.charCodeAt(0),
  ),
};

function placement(overrides: Partial<Placement> = {}): Placement {
  return {
    itemId: "a:2x2:0",
    sheetIndex: 0,
    groupId: "a",
    photoSizeId: "2x2",
    copyIndex: 0,
    xMm: 0,
    yMm: 0,
    widthMm: 50.8,
    heightMm: 50.8,
    rotated: false,
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    sheet: A4,
    sheetCount: 1,
    placements: [placement()],
    images: new Map([[imageKey("a", "2x2"), WHITE_PIXEL]]),
    cutGuides: false,
    jobId: "job-1",
    trace: ["Customer A / 2 × 2 in / copy 1"],
    ...overrides,
  };
}

describe("buildPrintPdf", () => {
  it("creates pages at the exact physical paper size", async () => {
    const pdf = await PDFDocument.load(await buildPrintPdf(job()));
    const { width, height } = pdf.getPage(0).getSize();

    expect(width).toBeCloseTo(595.276, 2);
    expect(height).toBeCloseTo(841.89, 2);
  });

  it("writes one page per sheet", async () => {
    const bytes = await buildPrintPdf(
      job({
        sheetCount: 2,
        placements: [placement(), placement({ itemId: "a:2x2:1", sheetIndex: 1 })],
      }),
    );

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });

  it("records the job and each copy in the metadata", async () => {
    const pdf = await PDFDocument.load(await buildPrintPdf(job()));

    expect(pdf.getSubject()).toBe("job-1");
    expect(pdf.getKeywords()).toContain("Customer A");
  });

  it("refuses to build a page with a missing photo", async () => {
    await expect(buildPrintPdf(job({ images: new Map() }))).rejects.toThrow(/missing/);
  });
});

describe("pdfImageFrame", () => {
  it("measures a 2 × 2 in print as exactly 144 points", () => {
    const frame = pdfImageFrame(placement(), 297);

    expect(frame.width).toBeCloseTo(144, 6);
    expect(frame.height).toBeCloseTo(144, 6);
  });

  it("flips the y axis from the top of the page", () => {
    const frame = pdfImageFrame(placement({ yMm: 10 }), 297);

    expect(frame.y).toBeCloseTo(mmToPoints(297 - 10 - 50.8), 6);
  });

  it("keeps a rotated print inside its placed frame", () => {
    const frame = pdfImageFrame(
      placement({ xMm: 10, yMm: 20, widthMm: 152.4, heightMm: 101.6, rotated: true }),
      297,
    );

    expect(frame.rotate).toBe(90);
    expect(frame.x).toBeCloseTo(mmToPoints(10 + 152.4), 6);
    expect(frame.width).toBeCloseTo(mmToPoints(101.6), 6);
    expect(frame.height).toBeCloseTo(mmToPoints(152.4), 6);
  });
});

describe("pixelFrame", () => {
  it("renders 2 × 2 in as 600 px at 300 DPI", () => {
    expect(pixelFrame(placement(), 300)).toEqual({ x: 0, y: 0, width: 600, height: 600 });
  });

  it("stays within one pixel of the true size anywhere on the sheet", () => {
    for (let xMm = 0; xMm < 150; xMm += 0.37) {
      const { width } = pixelFrame(placement({ xMm }), 300);
      expect(Math.abs(width - 600)).toBeLessThanOrEqual(1);
    }
  });

  it("leaves no pixel seam between touching prints", () => {
    const left = pixelFrame(placement({ xMm: 3.3 }), 300);
    const right = pixelFrame(placement({ xMm: 3.3 + 50.8 }), 300);

    expect(left.x + left.width).toBe(right.x);
  });
});

describe("buildCalibrationPdf", () => {
  it("matches the selected paper", async () => {
    const pdf = await PDFDocument.load(await buildCalibrationPdf(A4));
    const { width, height } = pdf.getPage(0).getSize();

    expect(width).toBeCloseTo(mmToPoints(210), 6);
    expect(height).toBeCloseTo(mmToPoints(297), 6);
  });
});
