"use client";

import { createDefaultRecipe } from "@/features/job/defaults";
import { groupSizeIds } from "@/features/job/expand";
import { useStudio } from "@/features/job/store";
import type { PhotoGroup } from "@/features/job/types";
import { effectiveDpi } from "@/features/layout/units";
import { resolveCropArea } from "./render";

/** The weakest crop across every size this group prints at. */
export function useGroupQuality(group: PhotoGroup) {
  const asset = useStudio((state) => state.assets[group.assetId]);
  const library = useStudio((state) => state.library);
  const minDpi = useStudio((state) => state.options.minDpi);

  let lowest = Number.POSITIVE_INFINITY;
  if (asset) {
    for (const sizeId of groupSizeIds(group, library.packages)) {
      const size = library.sizes.find((s) => s.id === sizeId);
      if (!size) continue;
      const recipe = group.editsByPhotoSize[sizeId] ?? createDefaultRecipe();
      const area = resolveCropArea(asset, recipe, size);
      lowest = Math.min(lowest, effectiveDpi(area.width, area.height, size.widthMm, size.heightMm));
    }
  }
  return { lowest, isLow: Number.isFinite(lowest) && lowest < minDpi, minDpi };
}
