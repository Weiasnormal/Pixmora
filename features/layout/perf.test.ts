import { describe, expect, it } from "vitest";
import type { PrintItem } from "@/features/job/types";
import { packItems } from "./pack";

describe("packItems at the input limits", () => {
  it("stays responsive for the largest job the controls allow", () => {
    const items: PrintItem[] = Array.from({ length: 1200 }, (_, copyIndex) => ({
      id: `a-${copyIndex}`,
      groupId: "a",
      photoSizeId: "1x1",
      copyIndex,
      widthMm: 25.4,
      heightMm: 25.4,
      allowRotation: false,
    }));

    const started = performance.now();
    const result = packItems(items, {
      sheet: { widthMm: 210, heightMm: 297, insetMm: 0 },
      gapXmm: 1,
      gapYmm: 1,
      allowItemRotation: false,
    });

    expect(result.placements).toHaveLength(1200);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
