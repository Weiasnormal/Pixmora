"use client";

import { useMemo, useState } from "react";
import { friendlyMessage } from "@/features/errors";
import { FileDown, ImageDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Modal, Notice, SelectField } from "@/components/ui";
import { shouldAskAfterExport } from "@/features/feedback/prompt";
import { useStudio } from "@/features/job/store";
import { withoutEmptySheets } from "@/features/layout/sheets";
import { useLayout } from "@/features/layout/useLayout";
import { useShortcuts } from "@/features/studio/shortcuts";
import {
  DEFAULT_EXPORT_DPI,
  downloadPdf,
  downloadPngs,
  exportBlocker,
  pngFits,
  printPdf,
  type ExportSnapshot,
} from "./exportJob";

type Busy = "pdf" | "png" | "print" | null;

const DPI_CHOICES = [150, 300, 600];

const PRINT_CHECKLIST = [
  "Choose the same paper size as this job.",
  "Turn on Borderless in the printer driver, if it is available.",
  "Turn off Fit to Page.",
  "Print at 100% or Actual Size.",
  "Measure one print with a ruler before running the full job.",
];

export function ExportActions() {
  const layout = useLayout();
  const [busy, setBusy] = useState<Busy>(null);
  const [pngOpen, setPngOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [chosenDpi, setDpi] = useState(DEFAULT_EXPORT_DPI);

  const blocker = exportBlocker(layout);
  // Blank sheets added by hand are left out of exports.
  const printed = useMemo(() => withoutEmptySheets(layout.placements, layout.pages), [layout]);
  const printedSheets = printed.sheetCount;
  // Checked only while the PNG dialog is open, since the test briefly uses a lot of memory.
  const tooLarge = useMemo(
    () => (pngOpen ? DPI_CHOICES.filter((choice) => !pngFits(printed.pages, choice)) : []),
    [pngOpen, printed],
  );
  // A resolution this browser can't make falls back to the highest one it can.
  const dpi = tooLarge.includes(chosenDpi)
    ? (DPI_CHOICES.filter((choice) => !tooLarge.includes(choice)).at(-1) ?? DPI_CHOICES[0])
    : chosenDpi;

  const snapshot = (): ExportSnapshot => {
    const state = useStudio.getState();
    return {
      layout,
      groups: state.groups,
      assets: state.assets,
      library: state.library,
    };
  };

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<string>) => {
    setBusy(kind);
    try {
      const done = await action();
      // A finished export is when people know how it went, so that is when to ask.
      if (shouldAskAfterExport()) {
        toast.success(done, {
          description: "How did it go?",
          duration: 10_000,
          action: {
            label: "Rate Pixmora",
            onClick: () => useStudio.getState().setFeedbackOpen(true),
          },
        });
      } else {
        toast.success(done);
      }
    } catch (error) {
      toast.error(
        friendlyMessage(error, "Export didn't finish. Try again, and reload the page if it keeps failing."),
      );
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
    <div className="flex items-center gap-2" data-guide="export">
      <Button
        aria-label="Print"
        className="max-lg:w-11 max-lg:px-0"
        disabled={blocker !== null || busy !== null}
        title={blocker ?? undefined}
        onClick={() => setPrintOpen(true)}
      >
        {busy === "print" ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Printer aria-hidden className="size-4" />
        )}
        <span className="max-lg:hidden">Print</span>
      </Button>
      <Button
        aria-label="Export PNG"
        className="max-lg:w-11 max-lg:px-0"
        disabled={blocker !== null || busy !== null}
        title={blocker ?? undefined}
        onClick={() => setPngOpen(true)}
      >
        <ImageDown aria-hidden className="size-4" />
        <span className="max-lg:hidden">PNG</span>
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
            Export {printedSheets === 1 ? "sheet" : `${printedSheets} sheets`}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Resolution">
            <SelectField value={String(dpi)} onChange={(value) => setDpi(Number(value))}>
              {DPI_CHOICES.map((choice) => (
                <option key={choice} value={choice} disabled={tooLarge.includes(choice)}>
                  {choice} DPI{tooLarge.includes(choice) ? " (too large for this browser)" : ""}
                </option>
              ))}
            </SelectField>
          </Field>
          {tooLarge.length > 0 && (
            <Notice>
              This browser can&apos;t make {tooLarge.join(" or ")} DPI images this large. Export PDF
              keeps full quality on any device.
            </Notice>
          )}
          <p className="text-[13px] leading-relaxed text-muted">
            {printedSheets > 1
              ? `The ${printedSheets} sheets download together as one ZIP file of PNGs.`
              : "The sheet downloads as one PNG file."}{" "}
            Edges stay within half a pixel of their true position. Use PDF when physical size
            matters most.
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
