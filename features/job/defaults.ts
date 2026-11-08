import { inchesToMm } from "@/features/layout/units";
import type {
  EditRecipe,
  LayoutOptions,
  PackagePreset,
  PaperPreset,
  PhotoSize,
  PrinterProfile,
} from "./types";

export const CUSTOM_PAPER_ID = "custom";

export const PAPER_PRESETS: PaperPreset[] = [
  { id: "a4", name: "A4", widthMm: 210, heightMm: 297 },
  { id: "letter", name: "Letter", widthMm: 215.9, heightMm: 279.4 },
  { id: "legal", name: "Legal", widthMm: 215.9, heightMm: 355.6 },
  { id: "4x6", name: "4 × 6 in", widthMm: inchesToMm(4), heightMm: inchesToMm(6) },
  { id: "5x7", name: "5 × 7 in", widthMm: inchesToMm(5), heightMm: inchesToMm(7) },
];

export const DEFAULT_PHOTO_SIZES: PhotoSize[] = [
  { id: "1x1", label: "1 × 1 in", widthMm: inchesToMm(1), heightMm: inchesToMm(1), allowRotation: false },
  { id: "2x2", label: "2 × 2 in", widthMm: inchesToMm(2), heightMm: inchesToMm(2), allowRotation: false },
  // Passport rules differ by issuing authority, so this starts unconfirmed.
  { id: "passport", label: "Passport", widthMm: 35, heightMm: 45, allowRotation: false, needsConfirmation: true },
  { id: "3r", label: "3R", widthMm: inchesToMm(3.5), heightMm: inchesToMm(5), allowRotation: true },
  { id: "4r", label: "4R", widthMm: inchesToMm(4), heightMm: inchesToMm(6), allowRotation: true },
  { id: "5r", label: "5R", widthMm: inchesToMm(5), heightMm: inchesToMm(7), allowRotation: true },
  { id: "6r", label: "6R", widthMm: inchesToMm(6), heightMm: inchesToMm(8), allowRotation: true },
];

const SEEDED_AT = 0;

export const DEFAULT_PACKAGES: PackagePreset[] = [
  {
    id: "package-1",
    name: "Package 1",
    pricePhp: 50,
    enabled: true,
    items: [{ photoSizeId: "2x2", quantity: 4 }],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: "package-2",
    name: "Package 2",
    pricePhp: 50,
    enabled: true,
    items: [{ photoSizeId: "1x1", quantity: 12 }],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: "package-3",
    name: "Package 3",
    pricePhp: 50,
    enabled: true,
    items: [
      { photoSizeId: "2x2", quantity: 2 },
      { photoSizeId: "1x1", quantity: 6 },
    ],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: "package-4",
    name: "Package 4",
    pricePhp: 50,
    enabled: true,
    items: [{ photoSizeId: "passport", quantity: 5 }],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
];

export const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [];

export const DEFAULT_OPTIONS: LayoutOptions = {
  paperId: "a4",
  customPaper: { widthMm: 210, heightMm: 297 },
  orientation: "portrait",
  borderlessRequested: true,
  insetMm: 5,
  gapXmm: 1,
  gapYmm: 1,
  allowItemRotation: false,
  cutGuides: false,
  printerProfileId: null,
  minDpi: 200,
};

export function createDefaultRecipe(): EditRecipe {
  return {
    pan: { x: 0, y: 0 },
    zoom: 1,
    rotationDeg: 0,
    area: null,
    brightness: 100,
    contrast: 100,
    vibrance: 0,
    temperature: 0,
    background: { mode: "keep", color: "#FFFFFF" },
    border: { enabled: false, style: "solid", widthMm: 0.3, color: "#202020" },
  };
}
