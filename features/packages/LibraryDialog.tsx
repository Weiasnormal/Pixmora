"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  Modal,
  NumberField,
  Segmented,
  TextField,
  Toggle,
} from "@/components/ui";
import { createId, useStudio } from "@/features/job/store";
import type { PhotoSize, PrinterProfile } from "@/features/job/types";
import { MM_PER_INCH, inchesToMm, mmToInches } from "@/features/layout/units";

type Unit = "mm" | "in";

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

type Tab = "sizes" | "printers";

export function LibraryDialog({
  open,
  onClose,
  initialTab = "sizes",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const sizes = useStudio((state) => state.library.sizes);
  const upsertSize = useStudio((state) => state.upsertSize);
  const resetSizes = useStudio((state) => state.resetSizes);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [unit, setUnit] = useState<Unit>("mm");
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <Modal open={open} title="Photo sizes and printers" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Segmented
          label="Library section"
          value={tab}
          options={[
            { value: "sizes", label: "Photo sizes" },
            { value: "printers", label: "Printers" },
          ]}
          onChange={setTab}
        />

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
            <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(true)}>
              Restore starting photo sizes
            </Button>
          </>
        ) : null}

        {tab === "printers" ? <ProfileList /> : null}
      </div>

      <ConfirmDialog
        open={confirmingReset}
        title="Restore starting photo sizes?"
        body="Your photo size changes are replaced with the starting list. Packages and printer profiles stay."
        confirmLabel="Restore"
        onConfirm={resetSizes}
        onClose={() => setConfirmingReset(false)}
      />
    </Modal>
  );
}
