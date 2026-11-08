"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  Modal,
  NumberField,
  Segmented,
  SelectField,
  TextField,
  Toggle,
} from "@/components/ui";
import { createId, useStudio } from "@/features/job/store";
import type { PackagePreset, PhotoSize, PrinterProfile } from "@/features/job/types";
import { MM_PER_INCH, inchesToMm, mmToInches } from "@/features/layout/units";

type Unit = "mm" | "in";

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
    <li className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="Package name">
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

      <ul className="flex flex-col gap-2">
        {preset.items.map((item, index) => (
          <li key={index} className="grid grid-cols-[minmax(0,1fr)_72px_auto] items-center gap-2">
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
              ariaLabel="Quantity"
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
              disabled={preset.items.length === 1}
              onClick={() => save({ items: preset.items.filter((_, i) => i !== index) })}
            >
              <Trash2 aria-hidden className="size-4" />
            </IconButton>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() =>
            save({ items: [...preset.items, { photoSizeId: sizes[0].id, quantity: 1 }] })
          }
        >
          <Plus aria-hidden className="size-3.5" />
          Add size
        </Button>
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
          Delete
        </Button>
        <div className="ml-auto w-32">
          <Toggle label="Available" checked={preset.enabled} onChange={(enabled) => save({ enabled })} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Delete ${preset.name}?`}
        body="This package is removed from your saved list."
        confirmLabel="Delete package"
        onConfirm={() => removePackage(preset.id)}
        onClose={() => setConfirming(false)}
      />
    </li>
  );
}

function SizeEditor({ size, unit }: { size: PhotoSize; unit: Unit }) {
  const library = useStudio((state) => state.library);
  const groups = useStudio((state) => state.groups);
  const upsertSize = useStudio((state) => state.upsertSize);
  const removeSize = useStudio((state) => state.removeSize);
  const [confirming, setConfirming] = useState(false);

  const save = (patch: Partial<PhotoSize>) => upsertSize({ ...size, ...patch });
  const display = (mm: number) => (unit === "mm" ? mm : Number(mmToInches(mm).toFixed(4)));
  const toMm = (value: number) => (unit === "mm" ? value : inchesToMm(value));

  const inUse =
    library.packages.some((p) => p.items.some((i) => i.photoSizeId === size.id)) ||
    groups.some((g) => g.selection.kind === "single" && g.selection.photoSizeId === size.id);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_88px_88px_auto]">
        <div className="col-span-3 sm:col-span-1">
          <Field label="Name">
            <TextField value={size.label} onChange={(label) => save({ label })} />
          </Field>
        </div>
        <Field label="Width">
          <NumberField
            value={display(size.widthMm)}
            min={0.1}
            suffix={unit}
            onCommit={(value) => save({ widthMm: toMm(value), needsConfirmation: false })}
          />
        </Field>
        <Field label="Height">
          <NumberField
            value={display(size.heightMm)}
            min={0.1}
            suffix={unit}
            onCommit={(value) => save({ heightMm: toMm(value), needsConfirmation: false })}
          />
        </Field>
        <IconButton
          label={`Delete ${size.label}`}
          onClick={() => {
            if (inUse) {
              toast.error(`${size.label} is used by a package or photo. Remove it there first.`);
            } else {
              setConfirming(true);
            }
          }}
        >
          <Trash2 aria-hidden className="size-4" />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="w-52">
          <Toggle
            label="Can rotate 90°"
            checked={size.allowRotation}
            onChange={(allowRotation) => save({ allowRotation })}
          />
        </div>
        {size.needsConfirmation ? (
          <Button size="sm" onClick={() => save({ needsConfirmation: false })}>
            Confirm this size
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Delete ${size.label}?`}
        body="This size is removed from your saved list."
        confirmLabel="Delete size"
        onConfirm={() => removeSize(size.id)}
        onClose={() => setConfirming(false)}
      />
    </li>
  );
}

function ProfileList() {
  const profiles = useStudio((state) => state.library.profiles);
  const upsertProfile = useStudio((state) => state.upsertProfile);
  const removeProfile = useStudio((state) => state.removeProfile);
  const [deleting, setDeleting] = useState<PrinterProfile | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-muted">
        Keep one profile per printer and paper. Print the calibration sheet from Print setup, measure
        it, and save the inset your printer needs.
      </p>
      <ul className="flex flex-col gap-3">
        {profiles.map((profile) => (
          <li key={profile.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_96px_auto]">
            <div className="col-span-2 sm:col-span-1">
              <Field label="Printer and paper">
                <TextField
                  value={profile.name}
                  onChange={(name) => upsertProfile({ ...profile, name })}
                />
              </Field>
            </div>
            <Field label="Safe inset">
              <NumberField
                value={profile.insetMm}
                suffix="mm"
                onCommit={(insetMm) => upsertProfile({ ...profile, insetMm })}
              />
            </Field>
            <IconButton label={`Delete ${profile.name}`} onClick={() => setDeleting(profile)}>
              <Trash2 aria-hidden className="size-4" />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button
        onClick={() =>
          upsertProfile({ id: createId("profile"), name: "New printer", insetMm: 0 })
        }
      >
        <Plus aria-hidden className="size-4" />
        Add printer profile
      </Button>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "printer profile"}?`}
        body="This profile and its saved inset are removed. Jobs using it go back to no profile."
        confirmLabel="Delete profile"
        onConfirm={() => deleting && removeProfile(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

type Tab = "packages" | "sizes" | "printers";

export function LibraryDialog({
  open,
  onClose,
  initialTab = "packages",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const packages = useStudio((state) => state.library.packages);
  const sizes = useStudio((state) => state.library.sizes);
  const upsertPackage = useStudio((state) => state.upsertPackage);
  const upsertSize = useStudio((state) => state.upsertSize);
  const resetLibrary = useStudio((state) => state.resetLibrary);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [unit, setUnit] = useState<Unit>("mm");
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <Modal open={open} title="Packages and sizes" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Segmented
          label="Library section"
          value={tab}
          options={[
            { value: "packages", label: "Packages" },
            { value: "sizes", label: "Photo sizes" },
            { value: "printers", label: "Printers" },
          ]}
          onChange={setTab}
        />

        {tab === "packages" ? (
          <>
            <ul className="flex flex-col gap-3">
              {packages.map((preset) => (
                <PackageEditor key={preset.id} preset={preset} />
              ))}
            </ul>
            <Button
              onClick={() =>
                upsertPackage({
                  id: createId("package"),
                  name: "New package",
                  pricePhp: 0,
                  enabled: true,
                  items: [{ photoSizeId: sizes[0].id, quantity: 1 }],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                })
              }
            >
              <Plus aria-hidden className="size-4" />
              New package
            </Button>
          </>
        ) : null}

        {tab === "sizes" ? (
          <>
            <div className="w-40">
              <Segmented
                label="Measurement unit"
                value={unit}
                options={[
                  { value: "mm", label: "Millimetres" },
                  { value: "in", label: "Inches" },
                ]}
                onChange={setUnit}
              />
            </div>
            <ul className="flex flex-col gap-3">
              {sizes.map((size) => (
                <SizeEditor key={size.id} size={size} unit={unit} />
              ))}
            </ul>
            <Button
              onClick={() =>
                upsertSize({
                  id: createId("size"),
                  label: "Custom size",
                  widthMm: MM_PER_INCH,
                  heightMm: MM_PER_INCH,
                  allowRotation: false,
                })
              }
            >
              <Plus aria-hidden className="size-4" />
              New photo size
            </Button>
          </>
        ) : null}

        {tab === "printers" ? <ProfileList /> : null}

        {tab !== "printers" ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(true)}>
            Restore starting packages and sizes
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmingReset}
        title="Restore starting packages and sizes?"
        body="Your saved package and size changes are replaced. Printer profiles stay."
        confirmLabel="Restore"
        onConfirm={resetLibrary}
        onClose={() => setConfirmingReset(false)}
      />
    </Modal>
  );
}
