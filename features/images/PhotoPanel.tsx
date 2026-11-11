"use client";

import { useEffect, useState } from "react";
import { Crop } from "lucide-react";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Field,
  Notice,
  NumberField,
  PanelSection,
  Segmented,
  SliderField,
  TextField,
  Toggle,
} from "@/components/ui";
import { BackgroundControls, SWATCHES } from "@/features/background/BackgroundControls";
import { createDefaultRecipe } from "@/features/job/defaults";
import { countGroupPrints, groupSizeIds } from "@/features/job/expand";
import { pickLook, resolveRecipe, sameLook } from "@/features/job/recipe";
import { useSelectedGroup, useStudio } from "@/features/job/store";
import type { EditRecipe, PhotoAsset, PhotoBorder, PhotoGroup, PhotoSize } from "@/features/job/types";
import { PackagePicker } from "@/features/packages/PackagePicker";
import { useGroupQuality } from "./quality";
import { canvasToBlob, renderPrint } from "./render";

type SectionId = "size" | "look" | "background" | "border";

const DEFAULT_RECIPE = createDefaultRecipe();
const PREVIEW_DPI = 60;

/** A small render of one size's crop, from the same renderer as the sheet. */
function useCropPreview(asset: PhotoAsset, recipe: EditRecipe, size: PhotoSize | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const signature = JSON.stringify([recipe, size, asset.url, asset.cutoutUrl]);

  useEffect(() => {
    if (!size) return;
    let cancelled = false;
    let made: string | null = null;
    const timer = setTimeout(async () => {
      try {
        const canvas = await renderPrint(asset, recipe, size, PREVIEW_DPI);
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.8);
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      } catch {
        // The preview is a convenience; the sheet still shows the real result.
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (made) URL.revokeObjectURL(made);
    };
    // The signature covers every input that changes the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return url;
}

function lookSummary(recipe: EditRecipe): string {
  const edited =
    recipe.area !== null ||
    recipe.rotationDeg !== DEFAULT_RECIPE.rotationDeg ||
    recipe.brightness !== DEFAULT_RECIPE.brightness ||
    recipe.contrast !== DEFAULT_RECIPE.contrast ||
    recipe.vibrance !== DEFAULT_RECIPE.vibrance ||
    recipe.temperature !== DEFAULT_RECIPE.temperature;
  return edited ? "Edited" : "Not edited";
}

function backgroundSummary(recipe: EditRecipe): string {
  if (recipe.background.mode === "keep") return "Original";
  const swatch = SWATCHES.find((s) => s.color.toLowerCase() === recipe.background.color.toLowerCase());
  return swatch?.label ?? recipe.background.color.toUpperCase();
}

function borderSummary(border: PhotoBorder): string {
  if (!border.enabled) return "Off";
  return `${border.style === "solid" ? "Solid" : "Dashed"} ${border.widthMm} mm`;
}

export function PhotoPanel() {
  const group = useSelectedGroup();
  const asset = useStudio((state) => (group ? state.assets[group.assetId] : undefined));
  // Kept outside the photo so sections stay as they were when switching photos.
  const [open, setOpen] = useState<SectionId[]>(["size"]);

  if (!group || !asset) {
    return (
      <div className="p-4 text-sm leading-relaxed text-muted">
        Add a photo to choose its package and adjust how it prints.
      </div>
    );
  }

  const toggle = (id: SectionId) =>
    setOpen((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  return <PhotoPanelBody key={group.id} group={group} asset={asset} open={open} onToggle={toggle} />;
}

function PhotoPanelBody({
  group,
  asset,
  open,
  onToggle,
}: {
  group: PhotoGroup;
  asset: PhotoAsset;
  open: SectionId[];
  onToggle: (id: SectionId) => void;
}) {
  const library = useStudio((state) => state.library);
  const editingSizeId = useStudio((state) => state.editingSizeId);
  const setEditingSize = useStudio((state) => state.setEditingSize);
  const renameGroup = useStudio((state) => state.renameGroup);
  const updateRecipe = useStudio((state) => state.updateRecipe);
  const setLookShared = useStudio((state) => state.setLookShared);
  const resetRecipes = useStudio((state) => state.resetRecipes);
  const setView = useStudio((state) => state.setView);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingShare, setConfirmingShare] = useState(false);
  const { lowest, isLow, minDpi } = useGroupQuality(group);
  const sizeIds = groupSizeIds(group, library.packages);
  const sizeId = editingSizeId && sizeIds.includes(editingSizeId) ? editingSizeId : sizeIds[0];
  const size = library.sizes.find((s) => s.id === sizeId);
  const recipe = resolveRecipe(group, sizeId);
  const shared = Boolean(group.sharedLook);
  const preview = useCropPreview(asset, recipe, size);
  const prints = countGroupPrints(group, library.packages);

  const { selection } = group;
  const pickedName =
    selection.kind === "package"
      ? (library.packages.find((p) => p.id === selection.packageId)?.name ?? "Missing package") +
        (selection.sets > 1 ? ` × ${selection.sets}` : "")
      : (library.sizes.find((s) => s.id === selection.photoSizeId)?.label ?? "Missing size");

  const toggleShared = (next: boolean) => {
    const differs = sizeIds.some(
      (id) => !sameLook(pickLook(resolveRecipe(group, id)), pickLook(recipe)),
    );
    // Sharing replaces the other sizes' colours, so that one direction asks first.
    if (next && differs) {
      setConfirmingShare(true);
    } else {
      setLookShared(group.id, sizeId, next);
    }
  };

  const patchBorder = (patch: Partial<PhotoBorder>) => {
    updateRecipe(group.id, sizeId, { border: { ...recipe.border, ...patch } }, "border");
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          {/* Object URLs of local files cannot pass through the image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt="" className="size-12 shrink-0 rounded-lg bg-page object-cover" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <TextField
              ariaLabel="Photo name"
              value={group.displayName}
              onChange={(name) => renameGroup(group.id, name)}
            />
            <p className="truncate text-xs text-muted tabular-nums">
              {asset.widthPx} × {asset.heightPx} px
              {Number.isFinite(lowest) ? ` • ${Math.round(lowest)} DPI at print size` : ""}
            </p>
          </div>
        </div>
        {isLow ? (
          <Notice tone="warning">
            This crop gives {Math.round(lowest)} DPI, under your {minDpi} DPI target. It will print
            at the right size but may look soft.
          </Notice>
        ) : null}
      </div>

      <PanelSection
        title="Print size"
        summary={`${pickedName} · ${prints} ${prints === 1 ? "print" : "prints"}`}
        open={open.includes("size")}
        onToggle={() => onToggle("size")}
      >
        <PackagePicker group={group} />
      </PanelSection>

      {size ? (
        <PanelSection
          title="Crop and colour"
          summary={lookSummary(recipe)}
          open={open.includes("look")}
          onToggle={() => onToggle("look")}
        >
          {sizeIds.length > 1 ? (
            <div role="radiogroup" aria-label="Editing size" className="flex flex-wrap gap-1.5">
              {sizeIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={id === sizeId}
                  onClick={() => setEditingSize(id)}
                  className={`h-8 rounded-lg border px-2.5 text-[13px] transition-colors duration-150 max-md:h-11 coarse:h-11 ${
                    id === sizeId
                      ? "border-primary bg-primary-soft font-medium text-ink"
                      : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {library.sizes.find((s) => s.id === id)?.label ?? id}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-page"
              aria-hidden
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="max-h-full max-w-full shadow-[0_0_0_1px_var(--border-subtle)]"
                />
              ) : null}
            </div>
            <Button className="flex-1" onClick={() => setView("crop")}>
              <Crop aria-hidden className="size-4" />
              Position crop
            </Button>
          </div>
          <SliderField
            label="Brightness"
            value={recipe.brightness}
            min={50}
            max={150}
            suffix="%"
            defaultValue={DEFAULT_RECIPE.brightness}
            onChange={(brightness) => updateRecipe(group.id, sizeId, { brightness }, "brightness")}
          />
          <SliderField
            label="Contrast"
            value={recipe.contrast}
            min={50}
            max={150}
            suffix="%"
            defaultValue={DEFAULT_RECIPE.contrast}
            onChange={(contrast) => updateRecipe(group.id, sizeId, { contrast }, "contrast")}
          />
          <SliderField
            label="Vibrance"
            value={recipe.vibrance}
            min={-100}
            max={100}
            defaultValue={DEFAULT_RECIPE.vibrance}
            onChange={(vibrance) => updateRecipe(group.id, sizeId, { vibrance }, "vibrance")}
          />
          <SliderField
            label="Temperature"
            value={recipe.temperature}
            min={-100}
            max={100}
            defaultValue={DEFAULT_RECIPE.temperature}
            onChange={(temperature) =>
              updateRecipe(group.id, sizeId, { temperature }, "temperature")
            }
          />
          {sizeIds.length > 1 ? (
            <Checkbox
              label="Use these edits on every size"
              description="Colour and background match across this photo's sizes. Each size keeps its own crop and border."
              checked={shared}
              onChange={toggleShared}
            />
          ) : null}
        </PanelSection>
      ) : null}

      {size ? (
        <PanelSection
          title="Background"
          summary={backgroundSummary(recipe)}
          open={open.includes("background")}
          onToggle={() => onToggle("background")}
        >
          <BackgroundControls group={group} asset={asset} sizeId={sizeId} recipe={recipe} />
        </PanelSection>
      ) : null}

      {size ? (
        <PanelSection
          title="Border"
          summary={borderSummary(recipe.border)}
          open={open.includes("border")}
          onToggle={() => onToggle("border")}
        >
          <Toggle
            label="Photo border"
            description="Drawn inside the print, so the finished size stays the same."
            checked={recipe.border.enabled}
            onChange={(enabled) => patchBorder({ enabled })}
          />
          {recipe.border.enabled ? (
            <>
              <Segmented
                label="Border style"
                value={recipe.border.style}
                options={[
                  { value: "solid", label: "Solid" },
                  { value: "dashed", label: "Dashed" },
                ]}
                onChange={(style) => patchBorder({ style })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Thickness">
                  <NumberField
                    value={recipe.border.widthMm}
                    min={0.1}
                    max={10}
                    suffix="mm"
                    onCommit={(widthMm) => patchBorder({ widthMm })}
                  />
                </Field>
                <Field label="Colour">
                  <input
                    type="color"
                    className="h-9 w-full rounded-lg border border-line bg-panel p-1 max-md:h-11 coarse:h-11"
                    value={recipe.border.color}
                    onChange={(event) => patchBorder({ color: event.target.value })}
                  />
                </Field>
              </div>
            </>
          ) : null}
        </PanelSection>
      ) : null}

      <div className="border-t border-line p-4">
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setConfirmingReset(true)}>
          Reset this photo
        </Button>
      </div>
      <ConfirmDialog
        open={confirmingShare}
        title="Use these edits on every size?"
        body={`Colour and background from ${size?.label ?? "this size"} replace the ones on this photo's other sizes. Crops and borders stay. Undo brings the old edits back.`}
        confirmLabel="Use on every size"
        confirmVariant="primary"
        onConfirm={() => setLookShared(group.id, sizeId, true)}
        onClose={() => setConfirmingShare(false)}
      />
      <ConfirmDialog
        open={confirmingReset}
        title="Reset this photo?"
        body="Crop, colour, background and border go back to their starting values for this photo only. Its package stays the same."
        confirmLabel="Reset photo"
        onConfirm={() => resetRecipes(group.id)}
        onClose={() => setConfirmingReset(false)}
      />
    </div>
  );
}
