"use client";

import { useEffect, useRef, useState } from "react";
import { canvasToBlob, renderPrint } from "@/features/images/render";
import { resolveRecipe } from "@/features/job/recipe";
import { useStudio } from "@/features/job/store";
import type { Placement } from "@/features/job/types";
import { imageKey } from "@/features/export/pdf";

const PREVIEW_DPI = 120;
const DEBOUNCE_MS = 120;

/** Preview images come from the export renderer, drawn at a lighter DPI. */
export function usePrintImages(placements: Placement[]): Record<string, string> {
  const groups = useStudio((state) => state.groups);
  const assets = useStudio((state) => state.assets);
  const sizes = useStudio((state) => state.library.sizes);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cache = useRef(new Map<string, { recipe: string; url: string }>());

  const needed = [...new Set(placements.map((p) => imageKey(p.groupId, p.photoSizeId)))]
    .sort()
    .join(",");

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      const next: Record<string, string> = {};
      const wanted = needed ? needed.split(",") : [];

      for (const key of wanted) {
        const [groupId, sizeId] = key.split("|");
        const group = groups.find((g) => g.id === groupId);
        const size = sizes.find((s) => s.id === sizeId);
        const asset = group ? assets[group.assetId] : undefined;
        if (!group || !size || !asset) continue;

        const recipe = resolveRecipe(group, sizeId);
        const signature = JSON.stringify([recipe, size, asset.url, asset.cutoutUrl]);
        const cached = cache.current.get(key);
        if (cached?.recipe === signature) {
          next[key] = cached.url;
          continue;
        }

        try {
          const canvas = await renderPrint(asset, recipe, size, PREVIEW_DPI);
          const blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          if (cached) URL.revokeObjectURL(cached.url);
          cache.current.set(key, { recipe: signature, url });
          next[key] = url;
        } catch {
          // A failed thumbnail leaves its tile empty; export reports the real error.
        }
      }

      if (cancelled) return;
      for (const [key, entry] of cache.current) {
        if (wanted.includes(key)) continue;
        URL.revokeObjectURL(entry.url);
        cache.current.delete(key);
      }
      setUrls(next);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needed, groups, assets, sizes]);

  return urls;
}
