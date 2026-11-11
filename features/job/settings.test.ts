import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, DEFAULT_PHOTO_SIZES, EXAMPLE_PACKAGES } from "./defaults";
import { migrateSettings } from "./store";

const library = { sizes: DEFAULT_PHOTO_SIZES, packages: EXAMPLE_PACKAGES, profiles: [] };

describe("migrateSettings", () => {
  it("lets browsers that saved packages before setup existed skip setup", () => {
    const migrated = migrateSettings({ library, options: DEFAULT_OPTIONS }, 1);
    expect(migrated.setupDone).toBe(true);
    expect(migrated.library.packages).toHaveLength(4);
  });

  it("keeps the saved setup state from version 2 on", () => {
    const migrated = migrateSettings({ library, options: DEFAULT_OPTIONS, setupDone: false }, 2);
    expect(migrated.setupDone).toBe(false);
  });
});
