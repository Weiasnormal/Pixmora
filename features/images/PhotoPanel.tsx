"use client";

import { useState } from "react";
import { Crop } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Field,
  Notice,
  NumberField,
  SectionTitle,
  Segmented,
  SelectField,
  SliderField,
  TextField,
  Toggle,
} from "@/components/ui";
import { BackgroundControls } from "@/features/background/BackgroundControls";
import { createDefaultRecipe } from "@/features/job/defaults";
import { groupSizeIds } from "@/features/job/expand";
import { useSelectedGroup, useStudio } from "@/features/job/store";
import type { PhotoAsset, PhotoBorder, PhotoGroup } from "@/features/job/types";
import { PackagePicker } from "@/features/packages/PackagePicker";
import { useGroupQuality } from "./quality";

export function PhotoPanel() {
  const group = useSelectedGroup();
  const asset = useStudio((state) => (group ? state.assets[group.assetId] : undefined));

  if (!group || !asset) {
    return (
      <div className="p-4 text-sm leading-relaxed text-muted">
        Add a photo to choose its package and adjust how it prints.
      </div>
    );
  }

  return <PhotoPanelBody key={group.id} group={group} asset={asset} />;
}

function PhotoPanelBody({ group, asset }: { group: PhotoGroup; asset: PhotoAsset }) {
  const library = useStudio((state) => state.library);
  const editingSizeId = useStudio((state) => state.editingSizeId);
  const setEditingSize = useStudio((state) => state.setEditingSize);
  const renameGroup = useStudio((state) => state.renameGroup);
  const updateRecipe = useStudio((state) => state.updateRecipe);
  const resetRecipes = useStudio((state) => state.resetRecipes);
  const setView = useStudio((state) => state.setView);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const { lowest, isLow, minDpi } = useGroupQuality(group);
  const sizeIds = groupSizeIds(group, library.packages);
  const sizeId = editingSizeId && sizeIds.includes(editingSizeId) ? editingSizeId : sizeIds[0];
  const size = library.sizes.find((s) => s.id === sizeId);
  const recipe = group.editsByPhotoSize[sizeId] ?? createDefaultRecipe();

  const patchBorder = (patch: Partial<PhotoBorder>) => {
    updateRecipe(group.id, sizeId, { border: { ...recipe.border, ...patch } }, "border");
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <TextField value={group.displayName} onChange={(name) => renameGroup(group.id, name)} />
        </Field>
        <p className="text-xs text-muted tabular-nums">
          {asset.widthPx} × {asset.heightPx} px
          {Number.isFinite(lowest) ? ` • ${Math.round(lowest)} DPI at print size` : ""}
        </p>
        {isLow ? (
          <Notice tone="warning">
            This crop gives {Math.round(lowest)} DPI, under your {minDpi} DPI target. It will print
            at the right size but may look soft.
          </Notice>
        ) : null}
      </div>

      <PackagePicker group={group} />

      {size ? (
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <SectionTitle>Crop and colour</SectionTitle>
          {sizeIds.length > 1 ? (
            <Field label="Editing crop for">
              <SelectField value={sizeId} onChange={setEditingSize}>
                {sizeIds.map((id) => (
                  <option key={id} value={id}>
                    {library.sizes.find((s) => s.id === id)?.label ?? id}
                  </option>
                ))}
              </SelectField>
            </Field>
          ) : null}
          <Button onClick={() => setView("crop")}>
            <Crop aria-hidden className="size-4" />
            Position crop
          </Button>
          <SliderField
            label="Brightness"
            value={recipe.brightness}
            min={50}
            max={150}
            suffix="%"
            onChange={(brightness) => updateRecipe(group.id, sizeId, { brightness }, "brightness")}
          />
          <SliderField
            label="Contrast"
            value={recipe.contrast}
            min={50}
            max={150}
            suffix="%"
            onChange={(contrast) => updateRecipe(group.id, sizeId, { contrast }, "contrast")}
          />
          <SliderField
            label="Vibrance"
            value={recipe.vibrance}
            min={-100}
            max={100}
            onChange={(vibrance) => updateRecipe(group.id, sizeId, { vibrance }, "vibrance")}
          />
          <SliderField
            label="Temperature"
            value={recipe.temperature}
            min={-100}
            max={100}
            onChange={(temperature) =>
              updateRecipe(group.id, sizeId, { temperature }, "temperature")
            }
          />
        </div>
      ) : null}

      {size ? <BackgroundControls group={group} asset={asset} sizeId={sizeId} recipe={recipe} /> : null}

      {size ? (
        <div className="flex flex-col gap-3 border-t border-line pt-5">
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
                    className="h-9 w-full rounded-lg border border-line bg-panel p-1"
                    value={recipe.border.color}
                    onChange={(event) => patchBorder({ color: event.target.value })}
                  />
                </Field>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-line pt-4">
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setConfirmingReset(true)}>
          Reset this photo
        </Button>
      </div>
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
