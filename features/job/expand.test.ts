import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  DEFAULT_PACKAGES,
  DEFAULT_PHOTO_SIZES,
  createDefaultRecipe,
} from "./defaults";
import { countGroupPrints, expandPrintItems, resolveSheet } from "./expand";
import type { PhotoGroup, PhotoSelection } from "./types";

const library = { sizes: DEFAULT_PHOTO_SIZES, packages: DEFAULT_PACKAGES };

function group(id: string, selection: PhotoSelection): PhotoGroup {
  return {
    id,
    displayName: id,
    assetId: `asset-${id}`,
    selection,
    editsByPhotoSize: { "2x2": createDefaultRecipe() },
    enabled: true,
  };
}

describe("expandPrintItems", () => {
  it("turns Package 1 into four 50.8 mm copies", () => {
    const items = expandPrintItems(
      [group("a", { kind: "package", packageId: "package-1", sets: 1 })],
      library,
    );

    expect(items).toHaveLength(4);
    expect(items.every((i) => i.widthMm === 50.8 && i.heightMm === 50.8)).toBe(true);
  });

  it("expands a mixed-size package", () => {
    const items = expandPrintItems(
      [group("a", { kind: "package", packageId: "package-3", sets: 1 })],
      library,
    );

    expect(items.filter((i) => i.photoSizeId === "2x2")).toHaveLength(2);
    expect(items.filter((i) => i.photoSizeId === "1x1")).toHaveLength(6);
  });

  it("multiplies copies by the number of sets", () => {
    const a = group("a", { kind: "package", packageId: "package-1", sets: 3 });

    expect(countGroupPrints(a, DEFAULT_PACKAGES)).toBe(12);
  });

  it("gives every copy a unique, traceable id", () => {
    const items = expandPrintItems(
      [
        group("a", { kind: "package", packageId: "package-1", sets: 2 }),
        group("b", { kind: "single", photoSizeId: "1x1", quantity: 3 }),
      ],
      library,
    );

    expect(new Set(items.map((i) => i.id)).size).toBe(11);
  });

  it("leaves out disabled groups", () => {
    const disabled = {
      ...group("a", { kind: "package", packageId: "package-1", sets: 1 }),
      enabled: false,
    };

    expect(expandPrintItems([disabled], library)).toEqual([]);
  });
});

describe("resolveSheet", () => {
  it("starts borderless with a zero inset", () => {
    expect(resolveSheet(DEFAULT_OPTIONS, [])).toEqual({
      widthMm: 210,
      heightMm: 297,
      insetMm: 0,
    });
  });

  it("swaps dimensions for landscape", () => {
    const sheet = resolveSheet({ ...DEFAULT_OPTIONS, orientation: "landscape" }, []);

    expect(sheet).toMatchObject({ widthMm: 297, heightMm: 210 });
  });

  it("uses the entered margin when borderless is off", () => {
    const sheet = resolveSheet(
      { ...DEFAULT_OPTIONS, borderlessRequested: false, insetMm: 6 },
      [],
    );

    expect(sheet.insetMm).toBe(6);
  });

  it("keeps a printer profile's calibrated inset in borderless mode", () => {
    const sheet = resolveSheet(
      { ...DEFAULT_OPTIONS, printerProfileId: "shop" },
      [{ id: "shop", name: "Shop printer", insetMm: 3 }],
    );

    expect(sheet.insetMm).toBe(3);
  });
});
