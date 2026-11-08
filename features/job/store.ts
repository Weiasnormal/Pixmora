"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { forgetImage } from "@/features/images/render";
import { layoutSignature } from "@/features/layout/computeLayout";
import {
  DEFAULT_OPTIONS,
  DEFAULT_PACKAGES,
  DEFAULT_PHOTO_SIZES,
  DEFAULT_PRINTER_PROFILES,
} from "./defaults";
import { groupSizeIds, type Library } from "./expand";
import { patchRecipe, shareLook, unshareLook } from "./recipe";
import type {
  EditRecipe,
  LayoutOptions,
  ManualPlacement,
  PackagePreset,
  PhotoAsset,
  PhotoGroup,
  PhotoSelection,
  PhotoSize,
  PrinterProfile,
} from "./types";

export type WorkspaceView = "sheets" | "crop";

type Snapshot = {
  groups: PhotoGroup[];
  options: LayoutOptions;
  manual: Record<string, ManualPlacement>;
};

const HISTORY_LIMIT = 50;
/** Rapid changes to one control, such as a slider drag, form one undo step. */
const COALESCE_MS = 800;

type StudioState = Snapshot & {
  assets: Record<string, PhotoAsset>;
  library: Library;
  selectedGroupId: string | null;
  editingSizeId: string | null;
  view: WorkspaceView;
  /** Counts requests to open the crop view, so phones can jump to it from any pane. */
  cropRequests: number;
  manualNotice: boolean;
  past: Snapshot[];
  future: Snapshot[];
  lastChange: { key: string; at: number } | null;

  addPhoto: (asset: PhotoAsset) => void;
  duplicateGroup: (groupId: string) => void;
  removeGroup: (groupId: string) => void;
  clearJob: () => void;
  renameGroup: (groupId: string, displayName: string) => void;
  setGroupEnabled: (groupId: string, enabled: boolean) => void;
  setSelection: (groupId: string, selection: PhotoSelection) => void;
  updateRecipe: (
    groupId: string,
    sizeId: string,
    patch: Partial<EditRecipe>,
    historyKey?: string,
  ) => void;
  setLookShared: (groupId: string, sizeId: string, shared: boolean) => void;
  resetRecipes: (groupId: string) => void;
  setCutout: (assetId: string, cutoutUrl: string | undefined) => void;

  select: (groupId: string | null) => void;
  setEditingSize: (sizeId: string) => void;
  setView: (view: WorkspaceView) => void;

  updateOptions: (patch: Partial<LayoutOptions>, historyKey?: string) => void;
  setManualPlacement: (itemId: string, placement: ManualPlacement) => void;
  resetManualPlacements: () => void;
  dismissManualNotice: () => void;

  upsertPackage: (preset: PackagePreset) => void;
  removePackage: (packageId: string) => void;
  upsertSize: (size: PhotoSize) => void;
  removeSize: (sizeId: string) => void;
  upsertProfile: (profile: PrinterProfile) => void;
  removeProfile: (profileId: string) => void;
  resetLibrary: () => void;

  undo: () => void;
  redo: () => void;
};

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function snapshotOf(state: Snapshot): Snapshot {
  return { groups: state.groups, options: state.options, manual: state.manual };
}

function firstEnabledPackage(packages: PackagePreset[]): PackagePreset | undefined {
  return packages.find((p) => p.enabled);
}

function revokeUnused(
  assets: Record<string, PhotoAsset>,
  groups: PhotoGroup[],
  past: Snapshot[],
  future: Snapshot[],
): Record<string, PhotoAsset> {
  const inUse = new Set<string>();
  for (const list of [groups, ...past.map((s) => s.groups), ...future.map((s) => s.groups)]) {
    for (const group of list) inUse.add(group.assetId);
  }
  const kept: Record<string, PhotoAsset> = {};
  for (const [id, asset] of Object.entries(assets)) {
    if (inUse.has(id)) {
      kept[id] = asset;
    } else {
      URL.revokeObjectURL(asset.url);
      forgetImage(asset.url);
      if (asset.cutoutUrl) {
        URL.revokeObjectURL(asset.cutoutUrl);
        forgetImage(asset.cutoutUrl);
      }
    }
  }
  return kept;
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      /** Single entry point for undoable edits; it also retires stale manual moves. */
      function commit(
        recipe: (state: StudioState) => Partial<Snapshot>,
        historyKey?: string,
      ) {
        set((state) => {
          const patch = recipe(state);
          const next = { ...snapshotOf(state), ...patch };
          const now = Date.now();
          const coalesce =
            historyKey !== undefined &&
            state.lastChange?.key === historyKey &&
            now - state.lastChange.at < COALESCE_MS;

          const moved = Object.keys(next.manual).length > 0;
          const stale =
            moved &&
            patch.manual === undefined &&
            layoutSignature(state.groups, state.library, state.options) !==
              layoutSignature(next.groups, state.library, next.options);

          return {
            ...next,
            manual: stale ? {} : next.manual,
            manualNotice: stale || state.manualNotice,
            past: coalesce
              ? state.past
              : [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT),
            future: [],
            lastChange: historyKey ? { key: historyKey, at: now } : null,
          };
        });
      }

      return {
        groups: [],
        options: DEFAULT_OPTIONS,
        manual: {},
        assets: {},
        library: {
          sizes: DEFAULT_PHOTO_SIZES,
          packages: DEFAULT_PACKAGES,
          profiles: DEFAULT_PRINTER_PROFILES,
        },
        selectedGroupId: null,
        editingSizeId: null,
        view: "sheets",
        cropRequests: 0,
        manualNotice: false,
        past: [],
        future: [],
        lastChange: null,

        addPhoto(asset) {
          const id = createId("group");
          const preset = firstEnabledPackage(get().library.packages);
          const selection: PhotoSelection = preset
            ? { kind: "package", packageId: preset.id, sets: 1 }
            : { kind: "single", photoSizeId: get().library.sizes[0].id, quantity: 1 };
          const group: PhotoGroup = {
            id,
            displayName: asset.name.replace(/\.[^.]+$/, "") || "Photo",
            assetId: asset.id,
            selection,
            editsByPhotoSize: {},
            enabled: true,
          };
          set((state) => ({ assets: { ...state.assets, [asset.id]: asset } }));
          commit((state) => ({ groups: [...state.groups, group] }));
          set((state) => ({
            selectedGroupId: id,
            editingSizeId: groupSizeIds(group, state.library.packages)[0] ?? null,
          }));
        },

        duplicateGroup(groupId) {
          const source = get().groups.find((g) => g.id === groupId);
          if (!source) return;
          const copy: PhotoGroup = {
            ...structuredClone(source),
            id: createId("group"),
            displayName: `${source.displayName} copy`,
          };
          commit((state) => {
            const index = state.groups.findIndex((g) => g.id === groupId);
            const groups = [...state.groups];
            groups.splice(index + 1, 0, copy);
            return { groups };
          });
          set({ selectedGroupId: copy.id });
        },

        removeGroup(groupId) {
          commit((state) => ({
            groups: state.groups.filter((g) => g.id !== groupId),
          }));
          set((state) => {
            const stillSelected = state.groups.some((g) => g.id === state.selectedGroupId);
            const selectedGroupId = stillSelected
              ? state.selectedGroupId
              : (state.groups[0]?.id ?? null);
            return {
              selectedGroupId,
              view: selectedGroupId ? state.view : "sheets",
            };
          });
        },

        clearJob() {
          set((state) => ({
            groups: [],
            manual: {},
            past: [],
            future: [],
            lastChange: null,
            selectedGroupId: null,
            editingSizeId: null,
            view: "sheets",
            manualNotice: false,
            assets: revokeUnused(state.assets, [], [], []),
          }));
        },

        renameGroup(groupId, displayName) {
          commit(
            (state) => ({
              groups: state.groups.map((g) => (g.id === groupId ? { ...g, displayName } : g)),
            }),
            `rename:${groupId}`,
          );
        },

        setGroupEnabled(groupId, enabled) {
          commit((state) => ({
            groups: state.groups.map((g) => (g.id === groupId ? { ...g, enabled } : g)),
          }));
        },

        setSelection(groupId, selection) {
          commit(
            (state) => ({
              groups: state.groups.map((g) => (g.id === groupId ? { ...g, selection } : g)),
            }),
            `selection:${groupId}`,
          );
          set((state) => {
            const group = state.groups.find((g) => g.id === groupId);
            if (!group || state.selectedGroupId !== groupId) return {};
            const sizes = groupSizeIds(group, state.library.packages);
            return sizes.includes(state.editingSizeId ?? "")
              ? {}
              : { editingSizeId: sizes[0] ?? null };
          });
        },

        updateRecipe(groupId, sizeId, patch, historyKey) {
          commit(
            (state) => ({
              groups: state.groups.map((g) =>
                g.id === groupId ? patchRecipe(g, sizeId, patch) : g,
              ),
            }),
            historyKey ? `${historyKey}:${groupId}:${sizeId}` : undefined,
          );
        },

        setLookShared(groupId, sizeId, shared) {
          commit((state) => ({
            groups: state.groups.map((g) => {
              if (g.id !== groupId) return g;
              return shared
                ? shareLook(g, sizeId)
                : unshareLook(g, groupSizeIds(g, state.library.packages));
            }),
          }));
        },

        resetRecipes(groupId) {
          commit((state) => ({
            groups: state.groups.map((g) =>
              g.id === groupId ? { ...g, editsByPhotoSize: {}, sharedLook: null } : g,
            ),
          }));
        },

        setCutout(assetId, cutoutUrl) {
          set((state) => {
            const asset = state.assets[assetId];
            if (!asset) return {};
            if (asset.cutoutUrl) {
              URL.revokeObjectURL(asset.cutoutUrl);
              forgetImage(asset.cutoutUrl);
            }
            return { assets: { ...state.assets, [assetId]: { ...asset, cutoutUrl } } };
          });
        },

        select(groupId) {
          set((state) => {
            const group = state.groups.find((g) => g.id === groupId);
            return {
              selectedGroupId: groupId,
              editingSizeId: group
                ? (groupSizeIds(group, state.library.packages)[0] ?? null)
                : null,
            };
          });
        },

        setEditingSize(sizeId) {
          set({ editingSizeId: sizeId });
        },

        setView(view) {
          set((state) => ({
            view,
            cropRequests: state.cropRequests + (view === "crop" ? 1 : 0),
          }));
        },

        updateOptions(patch, historyKey) {
          commit(
            (state) => ({ options: { ...state.options, ...patch } }),
            historyKey ? `options:${historyKey}` : undefined,
          );
        },

        setManualPlacement(itemId, placement) {
          commit((state) => ({ manual: { ...state.manual, [itemId]: placement } }));
        },

        resetManualPlacements() {
          commit(() => ({ manual: {} }));
        },

        dismissManualNotice() {
          set({ manualNotice: false });
        },

        upsertPackage(preset) {
          set((state) => {
            const exists = state.library.packages.some((p) => p.id === preset.id);
            return {
              library: {
                ...state.library,
                packages: exists
                  ? state.library.packages.map((p) => (p.id === preset.id ? preset : p))
                  : [...state.library.packages, preset],
              },
            };
          });
        },

        removePackage(packageId) {
          set((state) => ({
            library: {
              ...state.library,
              packages: state.library.packages.filter((p) => p.id !== packageId),
            },
          }));
        },

        upsertSize(size) {
          set((state) => {
            const exists = state.library.sizes.some((s) => s.id === size.id);
            return {
              library: {
                ...state.library,
                sizes: exists
                  ? state.library.sizes.map((s) => (s.id === size.id ? size : s))
                  : [...state.library.sizes, size],
              },
            };
          });
        },

        removeSize(sizeId) {
          set((state) => ({
            library: {
              ...state.library,
              sizes: state.library.sizes.filter((s) => s.id !== sizeId),
            },
          }));
        },

        upsertProfile(profile) {
          set((state) => {
            const exists = state.library.profiles.some((p) => p.id === profile.id);
            return {
              library: {
                ...state.library,
                profiles: exists
                  ? state.library.profiles.map((p) => (p.id === profile.id ? profile : p))
                  : [...state.library.profiles, profile],
              },
            };
          });
        },

        removeProfile(profileId) {
          set((state) => ({
            options:
              state.options.printerProfileId === profileId
                ? { ...state.options, printerProfileId: null }
                : state.options,
            library: {
              ...state.library,
              profiles: state.library.profiles.filter((p) => p.id !== profileId),
            },
          }));
        },

        resetLibrary() {
          set((state) => ({
            library: {
              sizes: DEFAULT_PHOTO_SIZES,
              packages: DEFAULT_PACKAGES,
              profiles: state.library.profiles,
            },
          }));
        },

        undo() {
          set((state) => {
            const previous = state.past.at(-1);
            if (!previous) return {};
            return {
              ...previous,
              past: state.past.slice(0, -1),
              future: [snapshotOf(state), ...state.future],
              lastChange: null,
            };
          });
          settleSelection();
        },

        redo() {
          set((state) => {
            const [next, ...future] = state.future;
            if (!next) return {};
            return {
              ...next,
              past: [...state.past, snapshotOf(state)],
              future,
              lastChange: null,
            };
          });
          settleSelection();
        },
      };

      function settleSelection() {
        set((state) => {
          if (state.groups.some((g) => g.id === state.selectedGroupId)) return {};
          const group = state.groups[0];
          return {
            selectedGroupId: group?.id ?? null,
            editingSizeId: group
              ? (groupSizeIds(group, state.library.packages)[0] ?? null)
              : null,
          };
        });
      }
    },
    {
      name: "pixmora-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Packages and print defaults only. Customer photos are never stored.
      partialize: (state) => ({ library: state.library, options: state.options }),
    },
  ),
);

export function useSelectedGroup(): PhotoGroup | null {
  return useStudio(
    (state) => state.groups.find((g) => g.id === state.selectedGroupId) ?? null,
  );
}

export { createId };
