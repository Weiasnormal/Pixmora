"use client";

import { useId, useState } from "react";
import Cropper from "react-easy-crop";
import { RotateCcw, RotateCw } from "lucide-react";
import { Button, IconButton, SliderField } from "@/components/ui";
import { resolveRecipe } from "@/features/job/recipe";
import { useSelectedGroup, useStudio } from "@/features/job/store";
import type { CropArea, EditRecipe, PhotoAsset, PhotoGroup, PhotoSize } from "@/features/job/types";
import { formatSize } from "@/features/layout/units";
import { previewSaturation, temperatureGain } from "./colour";
import { defaultCropArea } from "./render";

function sameArea(a: CropArea, b: CropArea): boolean {
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

function CropSurface({
  group,
  asset,
  size,
  recipe,
}: {
  group: PhotoGroup;
  asset: PhotoAsset;
  size: PhotoSize;
  recipe: EditRecipe;
}) {
  const updateRecipe = useStudio((state) => state.updateRecipe);
  const setView = useStudio((state) => state.setView);
  const [pan, setPan] = useState(recipe.pan);
  const [zoom, setZoom] = useState(recipe.zoom);
  const [rotation, setRotation] = useState(recipe.rotationDeg);
  const temperatureFilterId = useId();

  const usesCutout = recipe.background.mode === "solid" && asset.cutoutUrl;
  const warmth = temperatureGain(recipe.temperature);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">Editing {group.displayName}</p>
          <p className="text-xs text-muted">
            {size.label} • finished size {formatSize(size.widthMm, size.heightMm)}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setView("sheets")}>
          Return to layout
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 bg-dark">
        {/* The live preview for temperature. Sheets and exports use the pixel renderer. */}
        <svg aria-hidden className="absolute size-0">
          <filter id={temperatureFilterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values={`${1 + warmth} 0 0 0 0  0 1 0 0 0  0 0 ${1 - warmth} 0 0  0 0 0 1 0`}
            />
          </filter>
        </svg>
        <Cropper
          image={usesCutout ? asset.cutoutUrl : asset.url}
          crop={pan}
          zoom={zoom}
          rotation={rotation}
          aspect={size.widthMm / size.heightMm}
          minZoom={1}
          maxZoom={6}
          objectFit="contain"
          style={{
            mediaStyle: {
              filter: `brightness(${recipe.brightness}%) contrast(${recipe.contrast}%) url(#${temperatureFilterId}) saturate(${previewSaturation(recipe.vibrance)})`,
              backgroundColor: usesCutout ? recipe.background.color : undefined,
            },
          }}
          onCropChange={setPan}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={(_, area) => {
            const current = recipe.area ?? defaultCropArea(asset.widthPx, asset.heightPx, size);
            const unchanged =
              sameArea(current, area) && zoom === recipe.zoom && rotation === recipe.rotationDeg;
            if (unchanged) return;
            updateRecipe(group.id, size.id, { pan, zoom, rotationDeg: rotation, area }, "crop");
          }}
        />
      </div>
      <div className="grid gap-4 border-t border-line bg-panel px-4 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <SliderField label="Zoom" value={Number(zoom.toFixed(2))} min={1} max={6} step={0.01} suffix="×" onChange={setZoom} />
        <SliderField label="Straighten" value={rotation} min={-180} max={180} suffix="°" onChange={setRotation} />
        <div className="flex gap-1">
          <IconButton label="Rotate 90° left" onClick={() => setRotation(((rotation - 90 + 540) % 360) - 180)}>
            <RotateCcw aria-hidden className="size-4" />
          </IconButton>
          <IconButton label="Rotate 90° right" onClick={() => setRotation(((rotation + 90 + 540) % 360) - 180)}>
            <RotateCw aria-hidden className="size-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

export function CropEditor() {
  const group = useSelectedGroup();
  const sizeId = useStudio((state) => state.editingSizeId);
  const asset = useStudio((state) => (group ? state.assets[group.assetId] : undefined));
  const size = useStudio((state) => state.library.sizes.find((s) => s.id === sizeId));

  if (!group || !asset || !size) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted">
        Select a photo to crop it.
      </div>
    );
  }

  return (
    <CropSurface
      key={`${group.id}:${size.id}`}
      group={group}
      asset={asset}
      size={size}
      recipe={resolveRecipe(group, size.id)}
    />
  );
}
