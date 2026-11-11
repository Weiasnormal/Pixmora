"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, Plus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  NumberField,
  SectionTitle,
  SelectField,
  TextField,
  Toggle,
} from "@/components/ui";
import { EXAMPLE_PACKAGES } from "@/features/job/defaults";
import { createId, useStudio } from "@/features/job/store";
import type { PackagePreset } from "@/features/job/types";
import { LibraryDialog } from "./LibraryDialog";
import { PackageContents } from "./PackageContents";

function PackageEditor({ preset }: { preset: PackagePreset }) {
  const sizes = useStudio((state) => state.library.sizes);
  const groups = useStudio((state) => state.groups);
  const upsertPackage = useStudio((state) => state.upsertPackage);
  const removePackage = useStudio((state) => state.removePackage);
  const [confirming, setConfirming] = useState(false);

  const save = (patch: Partial<PackagePreset>) => {
    upsertPackage({ ...preset, ...patch, updatedAt: Date.now() });
  };

  const inUse = groups.some(
    (g) => g.selection.kind === "package" && g.selection.packageId === preset.id,
  );

  return (
    <div className="flex flex-col gap-3 border-t border-line px-3 pt-3 pb-3">
      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
        <Field label="Name">
          <TextField value={preset.name} onChange={(name) => save({ name })} />
        </Field>
        <Field label="Price">
          <NumberField
            value={preset.pricePhp}
            step={1}
            suffix="₱"
            onCommit={(pricePhp) => save({ pricePhp })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">Sizes in this package</span>
        <ul className="flex flex-col gap-2">
          {preset.items.map((item, index) => (
            <li key={index} className="grid grid-cols-[minmax(0,1fr)_64px_auto] items-center gap-1.5">
              <SelectField
                ariaLabel="Photo size"
                value={item.photoSizeId}
                onChange={(photoSizeId) =>
                  save({
                    items: preset.items.map((entry, i) =>
                      i === index ? { ...entry, photoSizeId } : entry,
                    ),
                  })
                }
              >
                {sizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label}
                  </option>
                ))}
              </SelectField>
              <NumberField
                value={item.quantity}
                min={1}
                max={500}
                step={1}
                integer
                ariaLabel="Pieces"
                onCommit={(quantity) =>
                  save({
                    items: preset.items.map((entry, i) =>
                      i === index ? { ...entry, quantity } : entry,
                    ),
                  })
                }
              />
              <IconButton
                label="Remove this size"
                onClick={() => {
                  if (preset.items.length === 1) {
                    toast.error("A package needs at least one size.");
                  } else {
                    save({ items: preset.items.filter((_, i) => i !== index) });
                  }
                }}
              >
                <Trash2 aria-hidden className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          onClick={() =>
            save({ items: [...preset.items, { photoSizeId: sizes[0].id, quantity: 1 }] })
          }
        >
          <Plus aria-hidden className="size-3.5" />
          Add size
        </Button>
      </div>

      <Toggle
        label="Show when picking"
        description="Hidden packages stay saved but leave the Photo tab."
        checked={preset.enabled}
        onChange={(enabled) => save({ enabled })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          onClick={() =>
            upsertPackage({
              ...structuredClone(preset),
              id: createId("package"),
              name: `${preset.name} copy`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
          }
        >
          <Copy aria-hidden className="size-3.5" />
          Duplicate
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (inUse) {
              toast.error(`${preset.name} is used by a photo. Choose another package for that photo first.`);
            } else {
              setConfirming(true);
            }
          }}
        >
          <Trash2 aria-hidden className="size-3.5" />
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Delete ${preset.name}?`}
        body="This package is removed from your saved list."
        confirmLabel="Delete package"
        onConfirm={() => removePackage(preset.id)}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}

function PackageRow({
  preset,
  open,
  onToggle,
}: {
  preset: PackagePreset;
  open: boolean;
  onToggle: () => void;
}) {
  const sizes = useStudio((state) => state.library.sizes);
  return (
    <li className={`rounded-xl border ${open ? "border-line-strong" : "border-line"} bg-panel`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full min-w-0 items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-page"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-ink">{preset.name}</span>
            {preset.enabled ? null : (
              <span className="shrink-0 rounded-md bg-page px-1.5 text-[11px] text-muted">Hidden</span>
            )}
          </span>
          <PackageContents items={preset.items} sizes={sizes} />
        </span>
        <span className="shrink-0 text-[13px] text-ink tabular-nums">₱{preset.pricePhp}</span>
        <ChevronDown
          aria-hidden
          className={`mt-0.5 size-4 shrink-0 text-muted transition-transform duration-150 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <PackageEditor preset={preset} /> : null}
    </li>
  );
}

function ExampleCard({ example }: { example: PackagePreset }) {
  const sizes = useStudio((state) => state.library.sizes);
  const packages = useStudio((state) => state.library.packages);
  const upsertPackage = useStudio((state) => state.upsertPackage);
  // Browsers from before setup kept the examples under their own ids.
  const added = packages.some((p) => p.exampleId === example.id || p.id === example.id);

  return (
    <li className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-ink">{example.name}</span>
          <span className="shrink-0 rounded-md bg-primary-soft px-1.5 text-[11px] text-ink">Example</span>
        </span>
        <PackageContents items={example.items} sizes={sizes} price={example.pricePhp} />
      </span>
      {added ? (
        <span className="inline-flex h-8 shrink-0 items-center gap-1 px-1 text-[13px] text-muted max-md:h-11 coarse:h-11">
          <Check aria-hidden className="size-3.5" />
          Added
        </span>
      ) : (
        <Button
          size="sm"
          aria-label={`Use ${example.name}`}
          onClick={() => {
            const now = Date.now();
            upsertPackage({
              ...structuredClone(example),
              id: createId("package"),
              exampleId: example.id,
              createdAt: now,
              updatedAt: now,
            });
            toast.success(`${example.name} added. Open it to change its sizes or price.`);
          }}
        >
          Use
        </Button>
      )}
    </li>
  );
}

export function PackagesPanel() {
  const packages = useStudio((state) => state.library.packages);
  const sizes = useStudio((state) => state.library.sizes);
  const setupDone = useStudio((state) => state.setupDone);
  const finishSetup = useStudio((state) => state.finishSetup);
  const upsertPackage = useStudio((state) => state.upsertPackage);
  const [openId, setOpenId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const createPackage = () => {
    const now = Date.now();
    const id = createId("package");
    upsertPackage({
      id,
      name: `Package ${packages.length + 1}`,
      pricePhp: 0,
      enabled: true,
      items: [{ photoSizeId: sizes[0].id, quantity: 1 }],
      createdAt: now,
      updatedAt: now,
    });
    setOpenId(id);
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      <div data-guide="setup-intro" className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-ink">
          {setupDone ? "Your packages" : "Set up your packages"}
        </h2>
        <p className="text-xs leading-relaxed text-muted">
          {setupDone
            ? "The bundles you sell. Each photo picks one in its Photo tab."
            : "Add the bundles you sell, with their sizes and prices. Copy an example or start from scratch."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {packages.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {packages.map((preset) => (
              <PackageRow
                key={preset.id}
                preset={preset}
                open={openId === preset.id}
                onToggle={() => setOpenId(openId === preset.id ? null : preset.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-page px-3 py-3 text-xs leading-relaxed text-muted">
            No packages yet. Copy an example below, or make a new one.
          </p>
        )}
        <Button data-guide="new-package" className="w-full border-dashed" onClick={createPackage}>
          <Plus aria-hidden className="size-4" />
          New package
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <SectionTitle>Examples to copy</SectionTitle>
        <ul data-guide="examples" className="flex flex-col gap-2">
          {EXAMPLE_PACKAGES.map((example) => (
            <ExampleCard key={example.id} example={example} />
          ))}
        </ul>
      </section>

      {setupDone ? null : (
        <div data-guide="setup-done" className="flex flex-col gap-2 border-t border-line pt-4">
          {packages.length > 0 ? (
            <Button variant="primary" className="w-full" onClick={finishSetup}>
              Done, start adding photos
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="w-full" onClick={finishSetup}>
              Skip for now and use single sizes
            </Button>
          )}
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full" onClick={() => setLibraryOpen(true)}>
        <Ruler aria-hidden className="size-4" />
        Photo sizes and printers
      </Button>
      <LibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </div>
  );
}
