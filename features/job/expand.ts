import { CUSTOM_PAPER_ID, PAPER_PRESETS } from "./defaults";
import type {
  LayoutOptions,
  PackageItem,
  PackagePreset,
  PhotoGroup,
  PhotoSize,
  PrintItem,
  PrinterProfile,
  SheetBounds,
} from "./types";

export type Library = {
  sizes: PhotoSize[];
  packages: PackagePreset[];
  profiles: PrinterProfile[];
};

/** The sizes and copy counts a group asks for, after applying its sets. */
export function resolveGroupItems(
  group: PhotoGroup,
  packages: PackagePreset[],
): PackageItem[] {
  const { selection } = group;
  if (selection.kind === "single") {
    return [{ photoSizeId: selection.photoSizeId, quantity: selection.quantity }];
  }
  const preset = packages.find((p) => p.id === selection.packageId);
  if (!preset) return [];
  return preset.items.map((item) => ({
    photoSizeId: item.photoSizeId,
    quantity: item.quantity * selection.sets,
  }));
}

export function groupSizeIds(group: PhotoGroup, packages: PackagePreset[]): string[] {
  return [...new Set(resolveGroupItems(group, packages).map((i) => i.photoSizeId))];
}

export function countGroupPrints(group: PhotoGroup, packages: PackagePreset[]): number {
  return resolveGroupItems(group, packages).reduce((sum, i) => sum + i.quantity, 0);
}

/** One PrintItem per physical copy, across every enabled group. */
export function expandPrintItems(
  groups: PhotoGroup[],
  library: Pick<Library, "sizes" | "packages">,
): PrintItem[] {
  const items: PrintItem[] = [];
  for (const group of groups) {
    if (!group.enabled) continue;
    const copyBySize = new Map<string, number>();
    for (const { photoSizeId, quantity } of resolveGroupItems(group, library.packages)) {
      const size = library.sizes.find((s) => s.id === photoSizeId);
      if (!size) continue;
      for (let i = 0; i < quantity; i += 1) {
        const copyIndex = copyBySize.get(photoSizeId) ?? 0;
        copyBySize.set(photoSizeId, copyIndex + 1);
        items.push({
          id: `${group.id}:${photoSizeId}:${copyIndex}`,
          groupId: group.id,
          photoSizeId,
          copyIndex,
          widthMm: size.widthMm,
          heightMm: size.heightMm,
          allowRotation: size.allowRotation,
        });
      }
    }
  }
  return items;
}

export function resolveSheet(
  options: LayoutOptions,
  profiles: PrinterProfile[],
): SheetBounds {
  const preset =
    options.paperId === CUSTOM_PAPER_ID
      ? options.customPaper
      : (PAPER_PRESETS.find((p) => p.id === options.paperId) ?? PAPER_PRESETS[0]);
  const shortSide = Math.min(preset.widthMm, preset.heightMm);
  const longSide = Math.max(preset.widthMm, preset.heightMm);
  const profile = profiles.find((p) => p.id === options.printerProfileId);
  return {
    widthMm: options.orientation === "portrait" ? shortSide : longSide,
    heightMm: options.orientation === "portrait" ? longSide : shortSide,
    // A profile's calibrated inset still applies to a zero-margin document.
    insetMm: options.borderlessRequested ? (profile?.insetMm ?? 0) : options.insetMm,
  };
}
