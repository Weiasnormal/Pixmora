import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, DEFAULT_PHOTO_SIZES, EXAMPLE_PACKAGES } from "./defaults";
import { migrateSettings, repairSettings, type SavedSettings } from "./savedSettings";

const library = { sizes: DEFAULT_PHOTO_SIZES, packages: EXAMPLE_PACKAGES, profiles: [] };
const fallback: SavedSettings = {
  library: { sizes: DEFAULT_PHOTO_SIZES, packages: [], profiles: [] },
  options: DEFAULT_OPTIONS,
  setupDone: false,
};

/** What the store does on load: migrate old versions, then repair. */
function load(saved: unknown, version = 2): SavedSettings {
  return repairSettings(migrateSettings(saved, version), fallback);
}

describe("migrateSettings", () => {
  it("lets browsers that saved packages before setup existed skip setup", () => {
    const migrated = load({ library, options: DEFAULT_OPTIONS }, 1);
    expect(migrated.setupDone).toBe(true);
    expect(migrated.library.packages).toHaveLength(4);
  });

  it("keeps the saved setup state from version 2 on", () => {
    const migrated = load({ library, options: DEFAULT_OPTIONS, setupDone: false });
    expect(migrated.setupDone).toBe(false);
  });
});

describe("repairSettings", () => {
  it("keeps valid saved settings exactly as they were", () => {
    const options = { ...DEFAULT_OPTIONS, paperId: "letter", gapXmm: 2, printerProfileId: "p1" };
    const profiles = [{ id: "p1", name: "Shop printer", insetMm: 3 }];
    const saved = { library: { ...library, profiles }, options, setupDone: true };
    expect(load(saved)).toEqual(saved);
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a number", 42],
    ["an empty library", { library: {}, options: {}, setupDone: true }],
    ["lists of the wrong type", { library: { sizes: "x", packages: {}, profiles: 3 } }],
  ])("falls back to defaults when storage holds %s", (_label, saved) => {
    const repaired = load(saved);
    expect(repaired.library.sizes).toEqual(DEFAULT_PHOTO_SIZES);
    expect(repaired.library.packages).toEqual([]);
    expect(repaired.library.profiles).toEqual([]);
    expect(repaired.options).toEqual(DEFAULT_OPTIONS);
  });

  it("drops only the damaged entries and keeps the rest", () => {
    const repaired = load({
      library: {
        sizes: [DEFAULT_PHOTO_SIZES[0], { id: "broken", widthMm: -1 }],
        packages: [
          EXAMPLE_PACKAGES[0],
          { id: "no-items", name: "Broken" },
          { ...EXAMPLE_PACKAGES[1], items: [{ photoSizeId: "1x1", quantity: 0 }, { photoSizeId: "2x2", quantity: 3 }] },
        ],
        profiles: [{ id: "p", name: "No inset" }],
      },
      setupDone: true,
    });
    expect(repaired.library.sizes).toEqual([DEFAULT_PHOTO_SIZES[0]]);
    expect(repaired.library.packages.map((p) => p.id)).toEqual(["package-1", "package-2"]);
    expect(repaired.library.packages[1].items).toEqual([{ photoSizeId: "2x2", quantity: 3 }]);
    expect(repaired.library.profiles).toEqual([]);
  });

  it("replaces print settings that are missing or out of range", () => {
    const repaired = load({
      library,
      options: { paperId: 7, orientation: "sideways", gapXmm: -2, minDpi: 0, cutGuides: true, customPaper: null },
    });
    expect(repaired.options).toEqual({ ...DEFAULT_OPTIONS, cutGuides: true });
  });
});
