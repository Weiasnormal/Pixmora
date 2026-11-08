import { describe, expect, it } from "vitest";
import { applyColourShift, previewSaturation } from "./colour";

function shifted(rgba: number[], vibrance: number, temperature: number): number[] {
  const pixels = new Uint8ClampedArray(rgba);
  applyColourShift(pixels, vibrance, temperature);
  return [...pixels];
}

const spread = ([red, green, blue]: number[]) =>
  Math.max(red, green, blue) - Math.min(red, green, blue);

describe("applyColourShift", () => {
  it("leaves pixels alone at zero", () => {
    expect(shifted([120, 80, 200, 255], 0, 0)).toEqual([120, 80, 200, 255]);
  });

  it("warms by raising red and lowering blue", () => {
    const [red, green, blue] = shifted([100, 100, 100, 255], 0, 100);
    expect(red).toBe(125);
    expect(green).toBe(100);
    expect(blue).toBe(75);
  });

  it("cools by doing the opposite", () => {
    const [red, , blue] = shifted([100, 100, 100, 255], 0, -100);
    expect(red).toBe(75);
    expect(blue).toBe(125);
  });

  it("clamps rather than wrapping bright pixels", () => {
    expect(shifted([250, 250, 250, 255], 0, 100)[0]).toBe(255);
  });

  it("keeps neutral greys neutral under vibrance", () => {
    expect(shifted([128, 128, 128, 255], 100, 0)).toEqual([128, 128, 128, 255]);
  });

  it("lifts muted colours more than vivid ones", () => {
    const muted = [140, 120, 110, 255];
    const vivid = [230, 40, 30, 255];
    const mutedGain = spread(shifted(muted, 60, 0)) / spread(muted);
    const vividGain = spread(shifted(vivid, 60, 0)) / spread(vivid);
    expect(mutedGain).toBeGreaterThan(vividGain);
    expect(vividGain).toBeGreaterThanOrEqual(1);
  });

  it("fades to grey at the bottom of the vibrance slider", () => {
    expect(spread(shifted([200, 60, 90, 255], -100, 0))).toBeLessThanOrEqual(1);
  });

  it("preserves alpha and skips fully transparent pixels", () => {
    expect(shifted([100, 100, 100, 128], 0, 100)[3]).toBe(128);
    expect(shifted([100, 120, 140, 0], 50, 100)).toEqual([100, 120, 140, 0]);
  });
});

describe("previewSaturation", () => {
  it("is neutral at zero and reaches grey at the bottom", () => {
    expect(previewSaturation(0)).toBe(1);
    expect(previewSaturation(-100)).toBe(0);
  });
});
