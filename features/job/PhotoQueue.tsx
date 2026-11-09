"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Copy, Crop, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, ConfirmDialog, IconButton } from "@/components/ui";
import { ACCEPTED_TYPES, importPhoto } from "@/features/images/importPhotos";
import { useGroupQuality } from "@/features/images/quality";
import { useShortcuts } from "@/features/studio/shortcuts";
import { countGroupPrints } from "./expand";
import { useStudio } from "./store";
import type { PhotoGroup } from "./types";

export function useAddPhotos() {
  const addPhoto = useStudio((state) => state.addPhoto);
  return async (files: Iterable<File>) => {
    for (const file of files) {
      const result = await importPhoto(file);
      if (result.ok) {
        addPhoto(result.asset);
      } else {
        toast.error(result.message);
      }
    }
  };
}

export function AddPhotoButton({
  variant = "secondary",
  shortcut = false,
}: {
  variant?: "primary" | "secondary";
  /** Only one button on the page takes the shortcut, or the file picker opens twice. */
  shortcut?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addPhotos = useAddPhotos();
  const count = useStudio((state) => state.groups.length);

  useShortcuts(shortcut ? { "mod+o": () => inputRef.current?.click() } : {});

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={ACCEPTED_TYPES.join(",")}
        data-testid="photo-input"
        onChange={(event) => {
          if (event.target.files) void addPhotos([...event.target.files]);
          event.target.value = "";
        }}
      />
      <Button
        variant={variant}
        className="w-full"
        data-guide={shortcut ? "add-photos" : undefined}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus aria-hidden className="size-4" />
        {count === 0 ? "Add photos" : "Add Another Photo"}
      </Button>
    </>
  );
}

function selectionLabel(group: PhotoGroup, packageName?: string, sizeLabel?: string): string {
  if (group.selection.kind === "package") {
    const sets = group.selection.sets > 1 ? ` × ${group.selection.sets}` : "";
    return `${packageName ?? "Missing package"}${sets}`;
  }
  return sizeLabel ?? "Missing size";
}

function GroupCard({ group, onRemove }: { group: PhotoGroup; onRemove: () => void }) {
  const asset = useStudio((state) => state.assets[group.assetId]);
  const library = useStudio((state) => state.library);
  const selected = useStudio((state) => state.selectedGroupId === group.id);
  const select = useStudio((state) => state.select);
  const setView = useStudio((state) => state.setView);
  const duplicateGroup = useStudio((state) => state.duplicateGroup);
  const setGroupEnabled = useStudio((state) => state.setGroupEnabled);
  const { lowest, isLow } = useGroupQuality(group);

  const prints = countGroupPrints(group, library.packages);
  const { selection } = group;
  const label = selectionLabel(
    group,
    selection.kind === "package"
      ? library.packages.find((p) => p.id === selection.packageId)?.name
      : undefined,
    selection.kind === "single"
      ? library.sizes.find((s) => s.id === selection.photoSizeId)?.label
      : undefined,
  );

  return (
    <li
      className={`rounded-xl border transition-colors duration-150 ease-out ${
        selected ? "border-primary bg-primary-soft" : "border-line bg-panel hover:bg-page"
      } ${group.enabled ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => select(group.id)}
        className="flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left"
      >
        {/* Object URLs of local files cannot pass through the image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset?.url} alt="" className="size-12 shrink-0 rounded-lg bg-page object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{group.displayName}</span>
          <span className="block truncate text-xs text-muted">
            {label} • {prints} {prints === 1 ? "print" : "prints"}
          </span>
        </span>
        {isLow ? (
          <span title={`Lowest resolution ${Math.round(lowest)} DPI`} className="shrink-0">
            <AlertTriangle aria-label="Low resolution" className="size-4 text-ink" />
          </span>
        ) : null}
      </button>
      <div className="flex items-center gap-0.5 px-2 pb-1.5">
        <label className="mr-auto flex h-8 items-center gap-2 pl-0.5 text-xs text-muted max-md:h-11 coarse:h-11">
          <input
            type="checkbox"
            className="size-3.5 accent-primary max-md:size-5 coarse:size-5"
            checked={group.enabled}
            onChange={(event) => setGroupEnabled(group.id, event.target.checked)}
          />
          In this print
        </label>
        <IconButton
          label={`Crop ${group.displayName}`}
          onClick={() => {
            select(group.id);
            setView("crop");
          }}
        >
          <Crop aria-hidden className="size-4" />
        </IconButton>
        <IconButton label={`Duplicate ${group.displayName}`} onClick={() => duplicateGroup(group.id)}>
          <Copy aria-hidden className="size-4" />
        </IconButton>
        <IconButton label={`Remove ${group.displayName}`} onClick={onRemove}>
          <Trash2 aria-hidden className="size-4" />
        </IconButton>
      </div>
    </li>
  );
}

export function PhotoQueue() {
  const groups = useStudio((state) => state.groups);
  const packages = useStudio((state) => state.library.packages);
  const removeGroup = useStudio((state) => state.removeGroup);
  const clearJob = useStudio((state) => state.clearJob);
  const selected = useStudio(
    (state) => state.groups.find((g) => g.id === state.selectedGroupId) ?? null,
  );
  const [removing, setRemoving] = useState<PhotoGroup | null>(null);
  const [clearing, setClearing] = useState(false);

  const removeSelected = () => {
    // Delete is an easy slip while brushing, so touch-up never removes the photo.
    if (selected && useStudio.getState().view !== "touchup") setRemoving(selected);
  };
  useShortcuts({ delete: removeSelected, backspace: removeSelected });

  const total = groups
    .filter((g) => g.enabled)
    .reduce((sum, g) => sum + countGroupPrints(g, packages), 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold">Photos</h2>
        <span className="text-xs text-muted tabular-nums">
          {groups.length} {groups.length === 1 ? "group" : "groups"} • {total}{" "}
          {total === 1 ? "print" : "prints"}
        </span>
      </div>
      <div className="px-4 pb-3">
        <AddPhotoButton shortcut />
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} onRemove={() => setRemoving(group)} />
        ))}
      </ul>
      {groups.length > 0 ? (
        <div className="border-t border-line p-3">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setClearing(true)}>
            Clear job
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.displayName ?? "photo"}?`}
        body="Its copies leave the layout. Other photos stay as they are, and Undo brings this one back."
        confirmLabel="Remove photo"
        onConfirm={() => removing && removeGroup(removing.id)}
        onClose={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={clearing}
        title="Clear this job?"
        body="All photos and edits are removed from this browser and memory. This cannot be undone."
        confirmLabel="Clear job"
        onConfirm={clearJob}
        onClose={() => setClearing(false)}
      />
    </div>
  );
}
