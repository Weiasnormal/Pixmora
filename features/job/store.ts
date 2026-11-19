"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { forgetImage } from "@/features/images/render";
import { layoutSignature } from "@/features/layout/computeLayout";
import { DEFAULT_OPTIONS, DEFAULT_PHOTO_SIZES, DEFAULT_PRINTER_PROFILES } from "./defaults";
import { groupSizeIds, type Library } from "./expand";
import { patchRecipe, shareLook, unshareLook } from "./recipe";
import { SETTINGS_STORAGE_KEY, migrateSettings, repairSettings } from "./savedSettings";
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
  SheetSpec,
} from "./types";

export type WorkspaceView = "sheets" | "crop" | "touchup";
export type PanelTab = "photo" | "print" | "packages";
export type GuideTour = "setup" | "studio";

type Snapshot = {
  groups: PhotoGroup[];
  /** The papers in this job, in tab order. Each has its own settings and its own photos. */
  sheets: SheetSpec[];
  manual: Record<string, ManualPlacement>;
};

const HISTORY_LIMIT = 50;
/** Rapid changes to one control, such as a slider drag, form one undo step. */
const COALESCE_MS = 800;

type StudioState = Snapshot & {
  /** Saved print settings: where a new job's first sheet starts. Also holds the shop-wide DPI warning. */
  options: LayoutOptions;
  /** The sheet that is open. New photos are added to it and the Print tab edits it. */
  activeSheetId: string;
  /** Which page of the open sheet is shown, when it holds more than one paper's worth. */
  activePageInSheet: number;
  assets: Record<string, PhotoAsset>;
  library: Library;
  /** First visits set up packages before anything else. Saved with the library. */
  setupDone: boolean;
  /** Saved settings have been read, so first-visit screens know whether to show. */
  hydrated: boolean;
  panelTab: PanelTab;
  /** The cursor tour that is playing, if any. */
  guide: GuideTour | null;
  feedbackOpen: boolean;
  selectedGroupId: string | null;
  editingSizeId: string | null;
  view: WorkspaceView;
  /** Counts requests to open the crop or touch-up view, so phones can jump to it from any pane. */
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
  setPanelTab: (tab: PanelTab) => void;
  finishSetup: () => void;
  setGuide: (guide: GuideTour | null) => void;
  setFeedbackOpen: (open: boolean) => void;

  /** Changes the open sheet's settings. The DPI warning is shop-wide, so it changes for all. */
  updateOptions: (patch: Partial<LayoutOptions>, historyKey?: string) => void;
  /** Copies the open sheet's settings to every sheet. */
  applyOptionsToAllSheets: () => void;
  setManualPlacement: (itemId: string, placement: ManualPlacement) => void;
  resetManualPlacements: () => void;
  dismissManualNotice: () => void;
  /** Adds a sheet with the open sheet's settings and opens it. */
  addSheet: () => void;
  /** Removes a sheet and the photos on it. The last sheet stays. */
  removeSheet: (sheetId: string) => void;
  openSheet: (sheetId: string, pageInSheet?: number) => void;

  upsertPackage: (preset: PackagePreset) => void;
  removePackage: (packageId: string) => void;
  upsertSize: (size: PhotoSize) => void;
  removeSize: (sizeId: string) => void;
  upsertProfile: (profile: PrinterProfile) => void;
  removeProfile: (profileId: string) => void;
  resetSizes: () => void;

  undo: () => void;
  redo: () => void;
};

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function snapshotOf(state: Snapshot): Snapshot {
  return {
    groups: state.groups,
    sheets: state.sheets,
    manual: state.manual,
  };
}

function newSheet(options: LayoutOptions): SheetSpec {
  return { id: createId("sheet"), options: structuredClone(options) };
}

const FIRST_SHEET_ID = "sheet-1";

/** The open sheet, or the first one if it was removed. */
export function activeSheetOf(state: Pick<StudioState, "sheets" | "activeSheetId">): SheetSpec {
  return state.sheets.find((sheet) => sheet.id === state.activeSheetId) ?? state.sheets[0];
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
            layoutSignature(state.groups, state.library, state.sheets) !==
              layoutSignature(next.groups, state.library, next.sheets);

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
        sheets: [{ id: FIRST_SHEET_ID, options: DEFAULT_OPTIONS }],
        options: DEFAULT_OPTIONS,
        activeSheetId: FIRST_SHEET_ID,
        activePageInSheet: 0,
        manual: {},
        assets: {},
        library: {
          sizes: DEFAULT_PHOTO_SIZES,
          packages: [],
          profiles: DEFAULT_PRINTER_PROFILES,
        },
        setupDone: false,
        hydrated: false,
        panelTab: "photo",
        guide: null,
        feedbackOpen: false,
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
            // A photo goes on the sheet that is open, like putting it on that paper.
            sheetId: activeSheetOf(get()).id,
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
              : (state.groups.find((g) => g.sheetId === activeSheetOf(state).id)?.id ?? null);
            return {
              selectedGroupId,
              view: selectedGroupId ? state.view : "sheets",
            };
          });
        },

        clearJob() {
          set((state) => ({
            groups: [],
            sheets: [{ id: FIRST_SHEET_ID, options: state.options }],
            activeSheetId: FIRST_SHEET_ID,
            activePageInSheet: 0,
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
            cropRequests: state.cropRequests + (view === "sheets" ? 0 : 1),
          }));
        },

        setPanelTab(panelTab) {
          set({ panelTab });
        },

        finishSetup() {
          set({ setupDone: true, panelTab: "photo" });
        },

        setGuide(guide) {
          set({ guide });
        },

        setFeedbackOpen(feedbackOpen) {
          set({ feedbackOpen });
        },

        updateOptions(patch, historyKey) {
          const { minDpi, ...paper } = patch;
          if (minDpi !== undefined) {
            set((state) => ({
              options: { ...state.options, minDpi },
              sheets: state.sheets.map((sheet) => ({
                ...sheet,
                options: { ...sheet.options, minDpi },
              })),
            }));
          }
          if (Object.keys(paper).length === 0) return;
          const sheetId = activeSheetOf(get()).id;
          commit(
            (state) => ({
              sheets: state.sheets.map((sheet) =>
                sheet.id === sheetId ? { ...sheet, options: { ...sheet.options, ...paper } } : sheet,
              ),
            }),
            historyKey ? `options:${sheetId}:${historyKey}` : undefined,
          );
          // The last settings used become the starting point for the next job.
          set((state) => ({ options: { ...state.options, ...paper } }));
        },

        applyOptionsToAllSheets() {
          const source = activeSheetOf(get()).options;
          commit((state) => ({
            sheets: state.sheets.map((sheet) => ({ ...sheet, options: structuredClone(source) })),
          }));
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

        addSheet() {
          const sheet = newSheet(activeSheetOf(get()).options);
          commit((state) => {
            const index = state.sheets.findIndex((s) => s.id === activeSheetOf(state).id);
            const sheets = [...state.sheets];
            sheets.splice(index + 1, 0, sheet);
            return { sheets };
          });
          get().openSheet(sheet.id);
        },

        removeSheet(sheetId) {
          const state = get();
          if (state.sheets.length <= 1) return;
          const index = state.sheets.findIndex((s) => s.id === sheetId);
          if (index < 0) return;
          const removedGroups = new Set(
            state.groups.filter((g) => g.sheetId === sheetId).map((g) => g.id),
          );
          commit((current) => ({
            sheets: current.sheets.filter((s) => s.id !== sheetId),
            groups: current.groups.filter((g) => !removedGroups.has(g.id)),
            manual: Object.fromEntries(
              Object.entries(current.manual).filter(
                ([itemId, moved]) =>
                  moved.sheetId !== sheetId && !removedGroups.has(itemId.split(":")[0]),
              ),
            ),
          }));
          const remaining = get().sheets;
          get().openSheet(remaining[Math.max(index - 1, 0)].id);
        },

        openSheet(sheetId, pageInSheet = 0) {
          set((state) => {
            if (!state.sheets.some((s) => s.id === sheetId)) return {};
            const sameSheet = state.groups.find(
              (g) => g.id === state.selectedGroupId && g.sheetId === sheetId,
            );
            // The Photo tab follows the open sheet, so it never edits a photo on another paper.
            const group = sameSheet ?? state.groups.find((g) => g.sheetId === sheetId);
            return {
              activeSheetId: sheetId,
              activePageInSheet: pageInSheet,
              selectedGroupId: group?.id ?? null,
              editingSizeId:
                group && group.id === state.selectedGroupId
                  ? state.editingSizeId
                  : group
                    ? (groupSizeIds(group, state.library.packages)[0] ?? null)
                    : null,
              view: group ? state.view : "sheets",
            };
          });
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
          const clear = (options: LayoutOptions) =>
            options.printerProfileId === profileId ? { ...options, printerProfileId: null } : options;
          set((state) => ({
            options: clear(state.options),
            sheets: state.sheets.map((sheet) => ({ ...sheet, options: clear(sheet.options) })),
            library: {
              ...state.library,
              profiles: state.library.profiles.filter((p) => p.id !== profileId),
            },
          }));
        },

        resetSizes() {
          set((state) => ({ library: { ...state.library, sizes: DEFAULT_PHOTO_SIZES } }));
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
          const activeSheetId = activeSheetOf(state).id;
          const onSheet = state.groups.filter((g) => g.sheetId === activeSheetId);
          if (onSheet.some((g) => g.id === state.selectedGroupId)) {
            return { activeSheetId };
          }
          const group = onSheet[0];
          return {
            activeSheetId,
            selectedGroupId: group?.id ?? null,
            editingSizeId: group
              ? (groupSizeIds(group, state.library.packages)[0] ?? null)
              : null,
          };
        });
      }
    },
    {
      name: SETTINGS_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Packages and print defaults only. Customer photos are never stored.
      partialize: (state) => ({
        library: state.library,
        options: state.options,
        setupDone: state.setupDone,
      }),
      migrate: migrateSettings,
      // Runs on every load, not only after a version change, so damaged settings never reach the Studio.
      merge: (saved, current) => ({
        ...current,
        ...repairSettings(saved, {
          library: current.library,
          options: current.options,
          setupDone: current.setupDone,
        }),
      }),
      onRehydrateStorage: () => (state) => {
        useStudio.setState((current) => ({
          hydrated: true,
          panelTab: state?.setupDone ? "photo" : "packages",
          // A new job's first sheet starts from the saved settings.
          sheets:
            current.groups.length === 0 && current.sheets.length === 1
              ? [{ ...current.sheets[0], options: current.options }]
              : current.sheets,
        }));
      },
    },
  ),
);

export function useSelectedGroup(): PhotoGroup | null {
  return useStudio(
    (state) => state.groups.find((g) => g.id === state.selectedGroupId) ?? null,
  );
}

export { createId };
