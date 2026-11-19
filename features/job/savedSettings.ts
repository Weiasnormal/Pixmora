import { DEFAULT_OPTIONS, DEFAULT_PHOTO_SIZES } from "./defaults";
import type { Library } from "./expand";
import type { LayoutOptions, PackageItem, PackagePreset, PhotoSize, PrinterProfile } from "./types";

/** The part of the Studio that is saved in the browser between visits. */
export type SavedSettings = {
  library: Library;
  options: LayoutOptions;
  setupDone: boolean;
};

/** Where the settings are kept in localStorage. */
export const SETTINGS_STORAGE_KEY = "pixmora-settings";

type Loose = Record<string, unknown>;

function isObject(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isSize(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Keeps the entries that pass, so one damaged entry never costs the rest. */
function validEntries<T>(value: unknown, read: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(read).filter((entry): entry is T => entry !== null);
}

function readSize(value: unknown): PhotoSize | null {
  if (!isObject(value)) return null;
  const { id, label, widthMm, heightMm, allowRotation, needsConfirmation } = value;
  if (!isText(id) || !isText(label) || !isSize(widthMm) || !isSize(heightMm)) return null;
  return {
    id,
    label,
    widthMm,
    heightMm,
    allowRotation: allowRotation === true,
    ...(needsConfirmation === true ? { needsConfirmation: true } : {}),
  };
}

function readPackageItem(value: unknown): PackageItem | null {
  if (!isObject(value)) return null;
  const { photoSizeId, quantity } = value;
  if (!isText(photoSizeId) || !Number.isInteger(quantity) || (quantity as number) < 1) return null;
  return { photoSizeId, quantity: quantity as number };
}

function readPackage(value: unknown): PackagePreset | null {
  if (!isObject(value)) return null;
  const { id, name, description, pricePhp, enabled, items, exampleId, createdAt, updatedAt } = value;
  const contents = validEntries(items, readPackageItem);
  if (!isText(id) || !isText(name) || !contents) return null;
  return {
    id,
    name,
    ...(isText(description) ? { description } : {}),
    pricePhp: isAmount(pricePhp) ? pricePhp : 0,
    enabled: enabled !== false,
    items: contents,
    ...(isText(exampleId) ? { exampleId } : {}),
    createdAt: isAmount(createdAt) ? createdAt : 0,
    updatedAt: isAmount(updatedAt) ? updatedAt : 0,
  };
}

function readProfile(value: unknown): PrinterProfile | null {
  if (!isObject(value)) return null;
  const { id, name, insetMm, notes } = value;
  if (!isText(id) || !isText(name) || !isAmount(insetMm)) return null;
  return { id, name, insetMm, ...(isText(notes) ? { notes } : {}) };
}

function readOptions(value: unknown): LayoutOptions {
  const saved = isObject(value) ? value : {};
  const fallback = DEFAULT_OPTIONS;
  const paper = isObject(saved.customPaper) ? saved.customPaper : {};
  const flag = (key: keyof LayoutOptions) =>
    typeof saved[key] === "boolean" ? (saved[key] as boolean) : (fallback[key] as boolean);
  const amount = (key: keyof LayoutOptions) =>
    isAmount(saved[key]) ? (saved[key] as number) : (fallback[key] as number);

  return {
    paperId: isText(saved.paperId) ? saved.paperId : fallback.paperId,
    customPaper: {
      widthMm: isSize(paper.widthMm) ? paper.widthMm : fallback.customPaper.widthMm,
      heightMm: isSize(paper.heightMm) ? paper.heightMm : fallback.customPaper.heightMm,
    },
    orientation:
      saved.orientation === "portrait" || saved.orientation === "landscape"
        ? saved.orientation
        : fallback.orientation,
    borderlessRequested: flag("borderlessRequested"),
    insetMm: amount("insetMm"),
    gapXmm: amount("gapXmm"),
    gapYmm: amount("gapYmm"),
    allowItemRotation: flag("allowItemRotation"),
    cutGuides: flag("cutGuides"),
    printerProfileId:
      isText(saved.printerProfileId) || saved.printerProfileId === null
        ? (saved.printerProfileId as string | null)
        : fallback.printerProfileId,
    minDpi: isSize(saved.minDpi) ? saved.minDpi : fallback.minDpi,
  };
}

/**
 * Turns whatever was found in storage into settings the Studio can run on.
 * Saved data can be damaged, edited by hand or left by an older version, so every
 * field is checked and anything unusable falls back to its default.
 */
export function repairSettings(saved: unknown, fallback: SavedSettings): SavedSettings {
  const settings = isObject(saved) ? saved : {};
  const library = isObject(settings.library) ? settings.library : {};
  const sizes = validEntries(library.sizes, readSize);
  return {
    library: {
      // A Studio with no photo sizes cannot lay anything out.
      sizes: sizes && sizes.length > 0 ? sizes : DEFAULT_PHOTO_SIZES,
      packages: validEntries(library.packages, readPackage) ?? fallback.library.packages,
      profiles: validEntries(library.profiles, readProfile) ?? fallback.library.profiles,
    },
    options: readOptions(settings.options),
    setupDone: typeof settings.setupDone === "boolean" ? settings.setupDone : fallback.setupDone,
  };
}

/** Settings saved before setup existed already had packages, so those users skip it. */
export function migrateSettings(saved: unknown, version: number): unknown {
  return version < 2 && isObject(saved) ? { ...saved, setupDone: true } : saved;
}
