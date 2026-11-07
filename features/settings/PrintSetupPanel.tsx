"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Button,
  Field,
  Notice,
  NumberField,
  SectionTitle,
  Segmented,
  SelectField,
  Toggle,
} from "@/components/ui";
import { downloadCalibrationSheet } from "@/features/export/exportJob";
import { CUSTOM_PAPER_ID, PAPER_PRESETS } from "@/features/job/defaults";
import { resolveSheet } from "@/features/job/expand";
import { useStudio } from "@/features/job/store";
import type { Orientation } from "@/features/job/types";
import { inchesToMm, mmToInches } from "@/features/layout/units";
import { LibraryDialog } from "@/features/packages/LibraryDialog";

type GapPreset = "tight" | "standard" | "custom";

function gapPreset(x: number, y: number): GapPreset {
  if (x === 0 && y === 0) return "tight";
  if (x === 1 && y === 1) return "standard";
  return "custom";
}

export function PrintSetupPanel() {
  const options = useStudio((state) => state.options);
  const profiles = useStudio((state) => state.library.profiles);
  const updateOptions = useStudio((state) => state.updateOptions);
  const [unit, setUnit] = useState<"mm" | "in">("mm");
  const [printersOpen, setPrintersOpen] = useState(false);

  const preset = gapPreset(options.gapXmm, options.gapYmm);
  const toDisplay = (mm: number) => (unit === "mm" ? mm : Number(mmToInches(mm).toFixed(4)));
  const fromDisplay = (value: number) => (unit === "mm" ? value : inchesToMm(value));

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-3">
        <SectionTitle>Paper</SectionTitle>
        <Field label="Paper size">
          <SelectField
            value={options.paperId}
            onChange={(paperId) => updateOptions({ paperId })}
          >
            {PAPER_PRESETS.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.name}
              </option>
            ))}
            <option value={CUSTOM_PAPER_ID}>Custom size</option>
          </SelectField>
        </Field>
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

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <SectionTitle>Margins</SectionTitle>
        <Toggle
          label="Borderless"
          description="Creates a zero-margin document."
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
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Printer profile">
              <SelectField
                value={options.printerProfileId ?? ""}
                onChange={(id) => updateOptions({ printerProfileId: id || null })}
              >
                <option value="">None</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.insetMm} mm inset)
                  </option>
                ))}
              </SelectField>
            </Field>
          </div>
          <Button className="h-9" onClick={() => setPrintersOpen(true)}>
            Manage
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <SectionTitle>Gaps between photos</SectionTitle>
        <Segmented<GapPreset>
          label="Gap preset"
          value={preset}
          options={[
            { value: "tight", label: "Tight" },
            { value: "standard", label: "Standard" },
            { value: "custom", label: "Custom", disabled: preset !== "custom" },
          ]}
          onChange={(next) => {
            if (next === "tight") updateOptions({ gapXmm: 0, gapYmm: 0 });
            if (next === "standard") updateOptions({ gapXmm: 1, gapYmm: 1 });
          }}
        />
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
        {options.gapXmm === 0 || options.gapYmm === 0 ? (
          <Notice>At 0 mm, prints touch, so leave room for your cutting tool.</Notice>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <SectionTitle>Print options</SectionTitle>
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
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <SectionTitle>Calibration</SectionTitle>
        <p className="text-xs leading-relaxed text-muted">
          Print this at 100%, then measure it to check your printer.
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
      </div>

      <LibraryDialog open={printersOpen} onClose={() => setPrintersOpen(false)} initialTab="printers" />
    </div>
  );
}
