"use client";

import { useState } from "react";
import { Button, Field, Notice, NumberField, SectionTitle, Segmented, SelectField } from "@/components/ui";
import { resolveGroupItems } from "@/features/job/expand";
import { useStudio } from "@/features/job/store";
import type { PhotoGroup } from "@/features/job/types";
import { LibraryDialog } from "./LibraryDialog";

export function PackagePicker({ group }: { group: PhotoGroup }) {
  const library = useStudio((state) => state.library);
  const setSelection = useStudio((state) => state.setSelection);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const { selection } = group;
  const enabled = library.packages.filter(
    (p) => p.enabled || (selection.kind === "package" && p.id === selection.packageId),
  );
  const unconfirmed = resolveGroupItems(group, library.packages)
    .map((item) => library.sizes.find((s) => s.id === item.photoSizeId))
    .filter((size) => size?.needsConfirmation);

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Print size</SectionTitle>
        <Button variant="ghost" size="sm" onClick={() => setLibraryOpen(true)}>
          Packages and sizes
        </Button>
      </div>

      <Segmented
        label="Print size type"
        value={selection.kind}
        options={[
          { value: "package", label: "Package" },
          { value: "single", label: "Single size" },
        ]}
        onChange={(kind) => {
          if (kind === selection.kind) return;
          if (kind === "package") {
            const first = enabled[0];
            if (first) {
              setSelection(group.id, { kind: "package", packageId: first.id, sets: 1 });
            }
          } else {
            setSelection(group.id, {
              kind: "single",
              photoSizeId: library.sizes[0].id,
              quantity: 1,
            });
          }
        }}
      />

      {selection.kind === "package" ? (
        <div className="grid grid-cols-[1fr_72px] gap-3">
          <Field label="Package">
            <SelectField
              value={selection.packageId}
              onChange={(packageId) => setSelection(group.id, { ...selection, packageId })}
            >
              {enabled.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} (₱{preset.pricePhp})
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Sets">
            <NumberField
              value={selection.sets}
              min={1}
              max={100}
              step={1}
              integer
              onCommit={(sets) => setSelection(group.id, { ...selection, sets })}
            />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_72px] gap-3">
          <Field label="Size">
            <SelectField
              value={selection.photoSizeId}
              onChange={(photoSizeId) => setSelection(group.id, { ...selection, photoSizeId })}
            >
              {library.sizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Copies">
            <NumberField
              value={selection.quantity}
              min={1}
              max={500}
              step={1}
              integer
              onCommit={(quantity) => setSelection(group.id, { ...selection, quantity })}
            />
          </Field>
        </div>
      )}

      {selection.kind === "package" ? (
        <ul className="text-xs text-muted">
          {resolveGroupItems(group, library.packages).map((item) => (
            <li key={item.photoSizeId} className="tabular-nums">
              {item.quantity} × {library.sizes.find((s) => s.id === item.photoSizeId)?.label ?? "Missing size"}
            </li>
          ))}
        </ul>
      ) : null}

      {unconfirmed.length > 0 ? (
        <Notice tone="warning">
          Passport sizes differ by issuing authority. Confirm {unconfirmed[0]?.widthMm} ×{" "}
          {unconfirmed[0]?.heightMm} mm under Packages and sizes before printing.
        </Notice>
      ) : null}

      <LibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </div>
  );
}
