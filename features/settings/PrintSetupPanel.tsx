"use client";

import { useState } from "react";
import { FileDown, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Button,
  ChoiceCard,
  Field,
  Notice,
  NumberField,
  PanelSection,
  SectionTitle,
  Segmented,
  SelectField,
  Toggle,
} from "@/components/ui";
import { downloadCalibrationSheet } from "@/features/export/exportJob";
import { CUSTOM_PAPER_ID, PAPER_PRESETS } from "@/features/job/defaults";
import { resolveSheet } from "@/features/job/expand";
import { activeSheetOf, useStudio } from "@/features/job/store";
import type { Orientation } from "@/features/job/types";
import { useLayout } from "@/features/layout/useLayout";
import { inchesToMm, mmToInches } from "@/features/layout/units";
import { LibraryDialog } from "@/features/packages/LibraryDialog";

type GapPreset = "none" | "standard" | "custom";
type SectionId = "options" | "printer";

function gapPreset(x: number, y: number): GapPreset {
  if (x === 0 && y === 0) return "none";
  if (x === 1 && y === 1) return "standard";
  return "custom";
}

function SheetSummary() {
  const layout = useLayout();
  if (layout.totalItems === 0) {
    return (
      <div className="rounded-xl bg-page px-3 py-2.5 text-xs leading-relaxed text-muted">
        Add photos and the sheet count shows here.
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-page px-3 py-2.5" aria-live="polite">
      <p className="text-[13px] font-medium text-ink tabular-nums">
        {layout.sheetCount} {layout.sheetCount === 1 ? "sheet" : "sheets"} · {layout.totalItems}{" "}
        {layout.totalItems === 1 ? "print" : "prints"}
      </p>
      <p className="text-xs text-muted tabular-nums">
        {Math.round(layout.utilization * 100)}% of the paper used
      </p>
    </div>
  );
}

export function PrintSetupPanel() {
  // These settings belong to the open sheet. The DPI warning is the one shop-wide setting.
  const sheetOptions = useStudio((state) => activeSheetOf(state).options);
  const minDpi = useStudio((state) => state.options.minDpi);
  const options = { ...sheetOptions, minDpi };
  const sheetCount = useStudio((state) => state.sheets.length);
  const sheetNumber = useStudio(
    (state) => state.sheets.findIndex((s) => s.id === activeSheetOf(state).id) + 1,
  );
  const applyToAll = useStudio((state) => state.applyOptionsToAllSheets);
  const profiles = useStudio((state) => state.library.profiles);
  const updateOptions = useStudio((state) => state.updateOptions);
  const [unit, setUnit] = useState<"mm" | "in">("mm");
  const [printersOpen, setPrintersOpen] = useState(false);
  const [customGap, setCustomGap] = useState(false);
  const [open, setOpen] = useState<SectionId[]>([]);

  const preset = customGap ? "custom" : gapPreset(options.gapXmm, options.gapYmm);
  const toDisplay = (mm: number) => (unit === "mm" ? mm : Number(mmToInches(mm).toFixed(4)));
  const fromDisplay = (value: number) => (unit === "mm" ? value : inchesToMm(value));
  const toggle = (id: SectionId) =>
    setOpen((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  const profile = profiles.find((p) => p.id === options.printerProfileId);
  const extras = [
    options.allowItemRotation ? "Rotation on" : null,
    options.cutGuides ? "Cut guides" : null,
    `Warn below ${options.minDpi} DPI`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-5 p-4">
        <SheetSummary />

        {sheetCount > 1 ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
            <p className="text-[13px] font-medium text-ink">Sheet {sheetNumber} settings</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                applyToAll();
                toast.success(`All ${sheetCount} sheets now use these settings.`);
              }}
            >
              Use on all sheets
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <SectionTitle>Paper</SectionTitle>
          <div role="radiogroup" aria-label="Paper size" className="grid grid-cols-3 gap-1.5">
            {[...PAPER_PRESETS, { id: CUSTOM_PAPER_ID, name: "Custom" }].map((paper) => (
              <ChoiceCard
                key={paper.id}
                checked={options.paperId === paper.id}
                onSelect={() => updateOptions({ paperId: paper.id })}
                className="min-h-10 justify-center px-1 text-center text-[13px] font-medium text-ink max-md:min-h-11"
              >
                {paper.name}
              </ChoiceCard>
            ))}
          </div>
          {options.paperId === CUSTOM_PAPER_ID ? (
            <>
              <Segmented
                label="Paper measurement unit"
                value={unit}
                options={[
                  { value: "mm", label: "mm" },
                  { value: "in", label: "in" },
                ]}
                onChange={setUnit}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Width">
                  <NumberField
                    value={toDisplay(options.customPaper.widthMm)}
                    min={1}
                    suffix={unit}
                    onCommit={(value) =>
                      updateOptions(
                        { customPaper: { ...options.customPaper, widthMm: fromDisplay(value) } },
                        "paper",
                      )
                    }
                  />
                </Field>
                <Field label="Height">
                  <NumberField
                    value={toDisplay(options.customPaper.heightMm)}
                    min={1}
                    suffix={unit}
                    onCommit={(value) =>
                      updateOptions(
                        { customPaper: { ...options.customPaper, heightMm: fromDisplay(value) } },
                        "paper",
                      )
                    }
                  />
                </Field>
              </div>
            </>
          ) : null}
          <Segmented<Orientation>
            label="Paper orientation"
            value={options.orientation}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
            onChange={(orientation) => updateOptions({ orientation })}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Toggle
            label="Borderless"
            description="No margin on the file, so prints can reach the paper edge."
            checked={options.borderlessRequested}
            onChange={(borderlessRequested) => updateOptions({ borderlessRequested })}
          />
          {options.borderlessRequested ? (
            <Notice>
              Reaching the paper edge also needs a printer and driver that support it.{" "}
              <Link href="/help" target="_blank" className="font-medium underline underline-offset-2">
                Print guide
              </Link>
            </Notice>
          ) : (
            <Field label="Margin on every side">
              <NumberField
                value={options.insetMm}
                suffix="mm"
                onCommit={(insetMm) => updateOptions({ insetMm }, "inset")}
              />
            </Field>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <SectionTitle>Gap between photos</SectionTitle>
          <Segmented<GapPreset>
            label="Gap between photos"
            value={preset}
            options={[
              { value: "none", label: "None" },
              { value: "standard", label: "1 mm" },
              { value: "custom", label: "Custom" },
            ]}
            onChange={(next) => {
              setCustomGap(next === "custom");
              if (next === "none") updateOptions({ gapXmm: 0, gapYmm: 0 });
              if (next === "standard") updateOptions({ gapXmm: 1, gapYmm: 1 });
            }}
          />
          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Horizontal">
                <NumberField
                  value={options.gapXmm}
                  suffix="mm"
                  onCommit={(gapXmm) => updateOptions({ gapXmm }, "gap-x")}
                />
              </Field>
              <Field label="Vertical">
                <NumberField
                  value={options.gapYmm}
                  suffix="mm"
                  onCommit={(gapYmm) => updateOptions({ gapYmm }, "gap-y")}
                />
              </Field>
            </div>
          ) : null}
          {options.gapXmm === 0 || options.gapYmm === 0 ? (
            <Notice>At 0 mm, prints touch, so leave room for your cutting tool.</Notice>
          ) : null}
        </div>
      </div>

      <PanelSection
        title="More options"
        summary={extras.join(" · ")}
        open={open.includes("options")}
        onToggle={() => toggle("options")}
      >
        <Toggle
          label="Allow 90° rotation"
          description="Only sizes marked as rotatable turn. The photo stays upright within its print."
          checked={options.allowItemRotation}
          onChange={(allowItemRotation) => updateOptions({ allowItemRotation })}
        />
        <Toggle
          label="Cut guides"
          description="Adds thin lines around each print in the exported file."
          checked={options.cutGuides}
          onChange={(cutGuides) => updateOptions({ cutGuides })}
        />
        <Field label="Warn below">
          <NumberField
            value={options.minDpi}
            min={1}
            step={10}
            integer
            suffix="DPI"
            onCommit={(minDpi) => updateOptions({ minDpi }, "min-dpi")}
          />
        </Field>
      </PanelSection>

      <PanelSection
        title="Printer and calibration"
        summary={profile?.name ?? "No profile"}
        open={open.includes("printer")}
        onToggle={() => toggle("printer")}
      >
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Printer profile">
              <SelectField
                value={options.printerProfileId ?? ""}
                onChange={(id) => updateOptions({ printerProfileId: id || null })}
              >
                <option value="">None</option>
                {profiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.insetMm} mm inset)
                  </option>
                ))}
              </SelectField>
            </Field>
          </div>
          <Button className="h-9" onClick={() => setPrintersOpen(true)}>
            Manage
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Print the calibration sheet at 100%, then measure it to check your printer.
        </p>
        <Button
          onClick={() => {
            const sheet = resolveSheet(options, profiles);
            downloadCalibrationSheet(sheet).catch(() =>
              toast.error("The calibration sheet could not be created. Try again."),
            );
          }}
        >
          <FileDown aria-hidden className="size-4" />
          Download calibration sheet
        </Button>
      </PanelSection>

      {/* Phones have no room for the feedback button in the top bar, so it also lives here. */}
      <div className="border-t border-line p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => useStudio.getState().setFeedbackOpen(true)}
        >
          <MessageSquareText aria-hidden className="size-4" />
          Send feedback
        </Button>
      </div>

      <LibraryDialog open={printersOpen} onClose={() => setPrintersOpen(false)} initialTab="printers" />
    </div>
  );
}
