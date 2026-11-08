import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { PrintItem } from "@/features/job/types";
import { packItems } from "@/features/layout/pack";

const SHEET = { widthMm: 210, heightMm: 297, insetMm: 0 };

function copies(groupId: string, count: number, sizeMm: number): PrintItem[] {
  return Array.from({ length: count }, (_, copyIndex) => ({
    id: `${groupId}-${copyIndex}`,
    groupId,
    photoSizeId: `${sizeMm}`,
    copyIndex,
    widthMm: sizeMm,
    heightMm: sizeMm,
    allowRotation: false,
  }));
}

const STEPS = [
  { title: "Add your photos", body: "Drop in JPG, PNG or WebP files. Each photo keeps its own crop and settings." },
  { title: "Pick each package", body: "One customer takes 2 × 2 in, the next takes 1 × 1 in. Nothing carries over." },
  { title: "Let the sheet fill itself", body: "Every copy is packed onto shared paper at its true size, down to a 0 mm gap." },
  { title: "Export and print", body: "Download a PDF at the exact paper size, or a 300 DPI PNG." },
];

const MEASURES = [
  { value: "0 mm", label: "Software margin when borderless is on, the default for new jobs" },
  { value: "0 mm", label: "Smallest gap, set separately for horizontal and vertical spacing" },
  { value: "300 DPI", label: "Default PNG export, rendered fresh instead of captured from the screen" },
  { value: "No uploads", label: "Editing, packing and export all run in your browser" },
];

export default function Home() {
  // The preview is the real packing engine's output for the demo job below.
  const demo = packItems([...copies("a", 4, 50.8), ...copies("b", 12, 25.4)], {
    sheet: SHEET,
    gapXmm: 1,
    gapYmm: 1,
    allowItemRotation: false,
  });

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Pixmora home" className="shrink-0">
          <span className="sm:hidden">
            <Logo variant="icon" height={44} priority />
          </span>
          <span className="max-sm:hidden">
            <Logo height={44} priority />
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/help" className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink">
            Print guide
          </Link>
          <Link
            href="/studio"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-ink transition-colors duration-150 ease-out hover:bg-primary-hover"
          >
            Open Studio
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-8 md:grid-cols-[1fr_minmax(0,360px)] md:gap-16 md:pt-16">
          <div>
            <h1 className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              Less Space. More Prints.
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted">
              Pixmora prepares photos and packs them onto shared paper at their exact physical
              size. Mix customers and packages on one sheet, then print without opening a word
              processor.
            </p>
            <Link
              href="/studio"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-ink transition-colors duration-150 ease-out hover:bg-primary-hover"
            >
              Open Studio
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>

          <figure>
            <div
              className="relative w-full bg-panel outline-1 outline-line"
              style={{ aspectRatio: `${SHEET.widthMm} / ${SHEET.heightMm}` }}
            >
              {demo.placements.map((placement) => (
                <div
                  key={placement.itemId}
                  aria-hidden
                  className={`absolute ${placement.groupId === "a" ? "bg-primary" : "bg-line-strong"}`}
                  style={{
                    left: `${(placement.xMm / SHEET.widthMm) * 100}%`,
                    top: `${(placement.yMm / SHEET.heightMm) * 100}%`,
                    width: `${(placement.widthMm / SHEET.widthMm) * 100}%`,
                    height: `${(placement.heightMm / SHEET.heightMm) * 100}%`,
                  }}
                />
              ))}
            </div>
            <figcaption className="mt-3 text-[13px] text-muted">
              Two customers, {demo.placements.length} prints, one A4 sheet. Packed by the same
              engine the Studio uses.
            </figcaption>
          </figure>
        </section>

        <section className="bg-page">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
            <h2 className="text-2xl font-semibold tracking-tight">From photo to paper</h2>
            <ol className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="text-sm text-muted tabular-nums">{index + 1}</span>
                  <h3 className="mt-2 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
          <dl className="divide-y divide-line border-y border-line">
            {MEASURES.map((measure) => (
              <div key={measure.label} className="grid gap-1 py-5 sm:grid-cols-[200px_1fr] sm:items-baseline">
                <dt className="text-xl font-semibold tabular-nums">{measure.value}</dt>
                <dd className="text-sm leading-relaxed text-muted">{measure.label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-[68ch] text-sm leading-relaxed text-muted">
            Pixmora can create a zero-margin file, but edge-to-edge output depends on your printer,
            paper and driver settings.{" "}
            <Link href="/help" className="font-medium text-ink underline underline-offset-2">
              Read the print guide
            </Link>
            .
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-[13px] text-muted sm:px-8">
          <span>Pixmora: photo preparation and print layout.</span>
          <span className="flex items-center gap-2" aria-hidden>
            <span className="size-2 rounded-full bg-cyan" />
            <span className="size-2 rounded-full bg-magenta" />
            <span className="size-2 rounded-full bg-primary" />
            <span className="size-2 rounded-full bg-dark" />
          </span>
        </div>
      </footer>
    </div>
  );
}
