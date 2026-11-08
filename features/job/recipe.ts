import { createDefaultRecipe } from "./defaults";
import type { EditRecipe, PhotoGroup, PhotoLook } from "./types";

export function pickLook(recipe: EditRecipe): PhotoLook {
  const { brightness, contrast, vibrance, temperature, background } = recipe;
  return { brightness, contrast, vibrance, temperature, background };
}

export function sameLook(a: PhotoLook, b: PhotoLook): boolean {
  return (
    a.brightness === b.brightness &&
    a.contrast === b.contrast &&
    a.vibrance === b.vibrance &&
    a.temperature === b.temperature &&
    a.background.mode === b.background.mode &&
    a.background.color === b.background.color
  );
}

/** What a size actually prints with. A shared look outranks the size's own colour values. */
export function resolveRecipe(group: PhotoGroup, sizeId: string): EditRecipe {
  return {
    ...(group.editsByPhotoSize[sizeId] ?? createDefaultRecipe()),
    ...group.sharedLook,
  };
}

export function patchRecipe(
  group: PhotoGroup,
  sizeId: string,
  patch: Partial<EditRecipe>,
): PhotoGroup {
  const stored = group.editsByPhotoSize[sizeId] ?? createDefaultRecipe();
  return {
    ...group,
    editsByPhotoSize: { ...group.editsByPhotoSize, [sizeId]: { ...stored, ...patch } },
    sharedLook: group.sharedLook
      ? pickLook({ ...resolveRecipe(group, sizeId), ...patch })
      : group.sharedLook,
  };
}

export function shareLook(group: PhotoGroup, sizeId: string): PhotoGroup {
  return { ...group, sharedLook: pickLook(resolveRecipe(group, sizeId)) };
}

/** Each size keeps the shared look as its own values, so unticking changes nothing on paper. */
export function unshareLook(group: PhotoGroup, sizeIds: string[]): PhotoGroup {
  const editsByPhotoSize = { ...group.editsByPhotoSize };
  for (const sizeId of sizeIds) editsByPhotoSize[sizeId] = resolveRecipe(group, sizeId);
  return { ...group, editsByPhotoSize, sharedLook: null };
}
