import type { Metadata } from "next";
import { DEFAULT_PHOTO_SIZES, PAPER_PRESETS } from "@/features/job/defaults";
import type { PaperPreset, PhotoSize } from "@/features/job/types";
import { MM_PER_INCH } from "@/features/layout/units";
import { sheetCapacity } from "./capacity";
import { pageMetadata } from "./site";

/** Studio defaults: 0 mm margin when borderless, 1 mm between prints. */
export const BORDERLESS_INSET_MM = 0;
export const MARGIN_INSET_MM = 5;
export const GAP_MM = 1;

export type SizeGuideSlug = "1x1" | "2x2" | "passport" | "r-sizes";

export type SizeGuide = {
  slug: SizeGuideSlug;
  /** Short name for links and breadcrumbs. */
  name: string;
  /** Plural for running text, such as "1x1 pictures". */
  printNoun: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  note?: string;
  sizeIds: string[];
  paperIds: string[];
};

export const SIZE_GUIDES: SizeGuide[] = [
  {
    slug: "1x1",
    printNoun: "1x1 pictures",
    name: "1x1 picture",
    title: "1x1 Picture Size in cm, mm and Pixels, with an A4 Layout",
    description:
      "A 1x1 ID picture is 2.54 × 2.54 cm (25.4 mm). See how many fit on A4, Letter and 4R paper, and print a true-size sheet free in your browser.",
    h1: "1x1 picture size",
    lead: "A 1x1 ID picture measures 1 × 1 inch: 2.54 × 2.54 cm, or 25.4 × 25.4 mm. It's the small square photo that school IDs, company IDs and many application forms ask for.",
    sizeIds: ["1x1"],
    paperIds: ["a4", "letter", "4x6"],
  },
  {
    slug: "2x2",
    printNoun: "2x2 pictures",
    name: "2x2 picture",
    title: "2x2 Picture Size in cm, mm and Pixels, with an A4 Layout",
    description:
      "A 2x2 ID picture is 5.08 × 5.08 cm (50.8 mm). See how many fit on A4, Letter and 4R paper, and print a true-size sheet free in your browser.",
    h1: "2x2 picture size",
    lead: "A 2x2 ID picture measures 2 × 2 inches: 5.08 × 5.08 cm, or 50.8 × 50.8 mm. Many IDs and application forms ask for it, and it's also the photo size for US passports and visas.",
    sizeIds: ["2x2"],
    paperIds: ["a4", "letter", "4x6"],
  },
  {
    slug: "passport",
    printNoun: "passport photos",
    name: "Passport photo",
    title: "Passport Photo Size 35 × 45 mm: cm, Inches and an A4 Layout",
    description:
      "Many countries use a 35 × 45 mm passport and visa photo (3.5 × 4.5 cm). See how many fit on A4, Letter and 4R paper, and print them at true size.",
    h1: "Passport photo size: 35 × 45 mm",
    lead: "Many countries use a passport and visa photo of 35 × 45 mm. That's 3.5 × 4.5 cm, or about 1.38 × 1.77 inches.",
    note: "Rules differ by country and by office, including the head size and background colour. Check the requirements of the office that will receive the photo before you print. Pixmora's passport size starts at 35 × 45 mm, and the Studio asks you to confirm it first.",
    sizeIds: ["passport"],
    paperIds: ["a4", "letter", "4x6"],
  },
  {
    slug: "r-sizes",
    printNoun: "R-size photos",
    name: "R photo sizes",
    title: "3R, 4R, 5R and 6R Photo Sizes in Inches, cm and mm",
    description:
      "3R is 3.5 × 5 in, 4R is 4 × 6 in, 5R is 5 × 7 in and 6R is 6 × 8 in. See each size in cm and mm, and how many fit on A4, Letter and Legal paper.",
    h1: "3R, 4R, 5R and 6R photo sizes",
    lead: "R sizes are the standard photo print sizes at photo shops in the Philippines. Here they are in inches, centimetres and millimetres, with how many of each fit on one sheet of paper.",
    sizeIds: ["3r", "4r", "5r", "6r"],
    paperIds: ["a4", "letter", "legal"],
  },
];

export function getSizeGuide(slug: SizeGuideSlug): SizeGuide {
  const guide = SIZE_GUIDES.find((item) => item.slug === slug);
  if (!guide) throw new Error(`Unknown size guide: ${slug}`);
  return guide;
}

export function getPhotoSize(id: string): PhotoSize {
  const size = DEFAULT_PHOTO_SIZES.find((item) => item.id === id);
  if (!size) throw new Error(`Unknown photo size: ${id}`);
  return size;
}

export function getPaper(id: string): PaperPreset {
  const paper = PAPER_PRESETS.find((item) => item.id === id);
  if (!paper) throw new Error(`Unknown paper: ${id}`);
  return paper;
}

function trim(value: number, digits: number): string {
  return Number(value.toFixed(digits)).toString();
}

export function formatInches(mm: number): string {
  return trim(mm / MM_PER_INCH, 2);
}

export function formatCm(mm: number): string {
  return trim(mm / 10, 2);
}

export function formatMillimetres(mm: number): string {
  return trim(mm, 1);
}

export function pixelsAt(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

/** How many copies fit on one sheet, using the same engine and defaults as the Studio. */
export function copiesPerSheet(size: PhotoSize, paper: PaperPreset, insetMm: number) {
  return sheetCapacity({
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    allowRotation: size.allowRotation,
    paper: { widthMm: paper.widthMm, heightMm: paper.heightMm },
    insetMm,
    gapMm: GAP_MM,
  });
}

export function sizeGuideMetadata(slug: SizeGuideSlug): Metadata {
  const guide = getSizeGuide(slug);
  return pageMetadata({ title: guide.title, description: guide.description, path: `/sizes/${slug}` });
}
