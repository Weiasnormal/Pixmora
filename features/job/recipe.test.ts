import { describe, expect, it } from "vitest";
import { createDefaultRecipe } from "./defaults";
import { patchRecipe, resolveRecipe, shareLook, unshareLook } from "./recipe";
import type { PhotoGroup } from "./types";

function makeGroup(overrides: Partial<PhotoGroup> = {}): PhotoGroup {
  return {
    id: "g",
    displayName: "Photo",
    assetId: "a",
    selection: { kind: "package", packageId: "package-3", sets: 1 },
    editsByPhotoSize: {},
    enabled: true,
    ...overrides,
  };
}

const CROP = { x: 10, y: 20, width: 300, height: 300 };

describe("shared look", () => {
  it("keeps sizes independent until sharing is turned on", () => {
    const group = patchRecipe(makeGroup(), "2x2", { brightness: 120 });
    expect(resolveRecipe(group, "2x2").brightness).toBe(120);
    expect(resolveRecipe(group, "1x1").brightness).toBe(100);
  });

  it("gives every size the source size's colour and background", () => {
    const background = { mode: "solid" as const, color: "#1F5FBF" };
    const edited = patchRecipe(makeGroup(), "2x2", { vibrance: 30, temperature: -12, background });
    const shared = shareLook(edited, "2x2");

    expect(resolveRecipe(shared, "1x1")).toMatchObject({ vibrance: 30, temperature: -12, background });
  });

  it("sends later edits from any size to all of them", () => {
    const shared = shareLook(makeGroup(), "2x2");
    const edited = patchRecipe(shared, "1x1", { contrast: 130 });

    expect(resolveRecipe(edited, "2x2").contrast).toBe(130);
    expect(resolveRecipe(edited, "1x1").contrast).toBe(130);
  });

  it("covers sizes that join the group after sharing started", () => {
    const shared = shareLook(patchRecipe(makeGroup(), "2x2", { temperature: 40 }), "2x2");
    expect(resolveRecipe(shared, "passport").temperature).toBe(40);
  });

  it("never shares a crop, because crops belong to one ratio", () => {
    const cropped = patchRecipe(makeGroup(), "2x2", { area: CROP, zoom: 2, rotationDeg: 5 });
    const shared = patchRecipe(shareLook(cropped, "2x2"), "2x2", { zoom: 3 });

    expect(resolveRecipe(shared, "2x2").zoom).toBe(3);
    expect(resolveRecipe(shared, "1x1")).toMatchObject({ area: null, zoom: 1, rotationDeg: 0 });
  });

  it("keeps the print identical when sharing is turned off", () => {
    const shared = shareLook(patchRecipe(makeGroup(), "2x2", { vibrance: 25 }), "2x2");
    const unshared = unshareLook(shared, ["2x2", "1x1"]);

    expect(unshared.sharedLook).toBeNull();
    expect(resolveRecipe(unshared, "1x1").vibrance).toBe(25);
    const separate = patchRecipe(unshared, "1x1", { vibrance: 0 });
    expect(resolveRecipe(separate, "2x2").vibrance).toBe(25);
  });

  it("does not disturb the default recipe", () => {
    expect(resolveRecipe(makeGroup(), "2x2")).toEqual(createDefaultRecipe());
  });
});
