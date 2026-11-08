"use client";

import { useState } from "react";
import { FileDown, ImageDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Modal, Notice, SelectField } from "@/components/ui";
import { useStudio } from "@/features/job/store";
import { useLayout } from "@/features/layout/useLayout";
import { useShortcuts } from "@/features/studio/shortcuts";
import {
  DEFAULT_EXPORT_DPI,
  downloadPdf,
  downloadPngs,
  exportBlocker,
  printPdf,
  type ExportSnapshot,
} from "./exportJob";

type Busy = "pdf" | "png" | "print" | null;

const PRINT_CHECKLIST = [
  "Choose the same paper size as this job.",
  "Turn on Borderless in the printer driver, if it is available.",
  "Turn off Fit to Page.",
  "Print at 100% or Actual Size.",
  "Measure one print with a ruler before running the full job.",
];

export function ExportActions() {
  const layout = useLayout();
  const cutGuides = useStudio((state) => state.options.cutGuides);
  const [busy, setBusy] = useState<Busy>(null);
  const [pngOpen, setPngOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [dpi, setDpi] = useState(DEFAULT_EXPORT_DPI);

  const blocker = exportBlocker(layout);

  const snapshot = (): ExportSnapshot => {
    const state = useStudio.getState();
    return {
      layout,
      groups: state.groups,
      assets: state.assets,
      library: state.library,
      cutGuides,
    };
  };

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<string>) => {
    setBusy(kind);
    try {
      toast.success(await action());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = () =>
    run("pdf", async () => `PDF ${await downloadPdf(snapshot())} is ready.`);

  /** Shortcuts reach this even while the buttons are disabled, so they explain why. */
  const whenReady = (action: () => void) => () => {
    if (blocker) {
      toast.error(blocker);
    } else if (busy === null) {
      action();
    }
  };

  useShortcuts({
    "mod+s": whenReady(() => void exportPdf()),
    "mod+shift+s": whenReady(() => setPngOpen(true)),
    "mod+p": whenReady(() => setPrintOpen(true)),
  });

  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label="Print"
        className="max-sm:w-11 max-sm:px-0"
        disabled={blocker !== null || busy !== null}
        title={blocker ?? undefined}
        onClick={() => setPrintOpen(true)}
      >
        {busy === "print" ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Printer aria-hidden className="size-4" />
        )}
        <span className="max-sm:hidden">Print</span>
      </Button>
      <Button
        aria-label="Export PNG"
        className="max-sm:w-11 max-sm:px-0"
        disabled={blocker !== null || busy !== null}
        title={blocker ?? undefined}
        onClick={() => setPngOpen(true)}
      >
        <ImageDown aria-hidden className="size-4" />
        <span className="max-sm:hidden">PNG</span>
      </Button>
      <Button
        variant="primary"
        disabled={blocker !== null || busy !== null}
        title={blocker ?? undefined}
        onClick={() => void exportPdf()}
      >
        {busy === "pdf" ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <FileDown aria-hidden className="size-4" />
        )}
        <span className="max-sm:hidden">Export PDF</span>
        <span className="sm:hidden">PDF</span>
      </Button>

      <Modal
        open={pngOpen}
        title="Export PNG"
        onClose={() => setPngOpen(false)}
        footer={
          <Button
            variant="primary"
            disabled={busy !== null}
            onClick={() => {
              setPngOpen(false);
              void run("png", async () => {
                const count = await downloadPngs(snapshot(), dpi);
                return count === 1 ? "PNG sheet is ready." : `${count} PNG sheets are ready.`;
              });
            }}
          >
            Export {layout.sheetCount === 1 ? "sheet" : `${layout.sheetCount} sheets`}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Resolution">
            <SelectField value={String(dpi)} onChange={(value) => setDpi(Number(value))}>
              <option value="150">150 DPI</option>
              <option value="300">300 DPI</option>
              <option value="600">600 DPI</option>
            </SelectField>
          </Field>
          <p className="text-[13px] leading-relaxed text-muted">
            Each sheet downloads as its own file. Edges stay within half a pixel of their true
            position. Use PDF when physical size matters most.
          </p>
        </div>
      </Modal>

      <Modal
        open={printOpen}
        title="Before you print"
        onClose={() => setPrintOpen(false)}
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setPrintOpen(false);
              void run("print", async () => {
                await printPdf(snapshot());
                return "The print dialog is opening.";
              });
            }}
          >
            Open print dialog
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-ink">
            {PRINT_CHECKLIST.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Notice>
            Pixmora can make a zero-margin file, but it cannot change printer settings or guarantee
            edge-to-edge output.
          </Notice>
        </div>
      </Modal>
    </div>
  );
}
