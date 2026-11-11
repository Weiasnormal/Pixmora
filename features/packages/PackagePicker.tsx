"use client";

import { Button, ChoiceCard, Field, Notice, SelectField, Stepper } from "@/components/ui";
import { resolveGroupItems } from "@/features/job/expand";
import { useStudio } from "@/features/job/store";
import type { PhotoGroup } from "@/features/job/types";
import { PackageContents } from "./PackageContents";

function Dot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`size-3.5 shrink-0 rounded-full border ${checked ? "border-4 border-primary" : "border-line-strong"}`}
    />
  );
}

export function PackagePicker({ group }: { group: PhotoGroup }) {
  const library = useStudio((state) => state.library);
  const setSelection = useStudio((state) => state.setSelection);
  const setPanelTab = useStudio((state) => state.setPanelTab);

  const { selection } = group;
  const enabled = library.packages.filter(
    (p) => p.enabled || (selection.kind === "package" && p.id === selection.packageId),
  );
  const unconfirmed = resolveGroupItems(group, library.packages)
    .map((item) => library.sizes.find((s) => s.id === item.photoSizeId))
    .filter((size) => size?.needsConfirmation);

  return (
    <>
      {enabled.length === 0 ? (
        <Notice
          action={
            <button
              type="button"
              className="font-medium underline underline-offset-2"
              onClick={() => setPanelTab("packages")}
            >
              Set up packages
            </button>
          }
        >
          You have no packages yet, so this photo prints as a single size.
        </Notice>
      ) : null}

      <div role="radiogroup" aria-label="Print size" className="flex flex-col gap-1.5">
        {enabled.map((preset) => {
          const checked = selection.kind === "package" && selection.packageId === preset.id;
          return (
            <ChoiceCard
              key={preset.id}
              checked={checked}
              onSelect={() =>
                setSelection(group.id, {
                  kind: "package",
                  packageId: preset.id,
                  sets: selection.kind === "package" ? selection.sets : 1,
                })
              }
            >
              <Dot checked={checked} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{preset.name}</span>
                <PackageContents items={preset.items} sizes={library.sizes} />
              </span>
              <span className="shrink-0 text-[13px] text-muted tabular-nums">₱{preset.pricePhp}</span>
            </ChoiceCard>
          );
        })}
        <ChoiceCard
          checked={selection.kind === "single"}
          onSelect={() => {
            if (selection.kind === "single") return;
            setSelection(group.id, {
              kind: "single",
              photoSizeId: library.sizes[0].id,
              quantity: 1,
            });
          }}
        >
          <Dot checked={selection.kind === "single"} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-ink">Single size</span>
            <span className="block text-[11px] text-muted">Any size, any number of copies</span>
          </span>
        </ChoiceCard>
      </div>

      {selection.kind === "package" ? (
        <Stepper
          label="Sets"
          value={selection.sets}
          max={100}
          onChange={(sets) => setSelection(group.id, { ...selection, sets })}
        />
      ) : (
        <>
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
          <Stepper
            label="Copies"
            value={selection.quantity}
            max={500}
            onChange={(quantity) => setSelection(group.id, { ...selection, quantity })}
          />
        </>
      )}

      {unconfirmed.length > 0 ? (
        <Notice tone="warning">
          Passport sizes differ by issuing authority. Confirm {unconfirmed[0]?.widthMm} ×{" "}
          {unconfirmed[0]?.heightMm} mm under Photo sizes in the Packages tab before printing.
        </Notice>
      ) : null}

      {enabled.length > 0 ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setPanelTab("packages")}>
          Edit packages
        </Button>
      ) : null}
    </>
  );
}
