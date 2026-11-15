import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { FeedbackLink } from "@/features/feedback/FeedbackDialog";
import { pageMetadata } from "@/features/seo/site";

export const metadata: Metadata = pageMetadata({
  title: "How to Print Photos at Actual Size",
  description:
    "Why prints come out smaller, and how to fix it: printer settings for actual size, borderless printing, DPI, and a calibration sheet to check your printer.",
  path: "/help",
});

const CHECKLIST = [
  "Select the same paper size in the print dialog as in Pixmora.",
  "Turn on Borderless in your printer driver, if your printer offers it for that paper.",
  "Turn off Fit to Page, Shrink, or any other scaling option.",
  "Print at 100% or Actual Size.",
  "Measure one printed photo with a ruler before running the full job.",
];

const CALIBRATION = [
  "Create a printer profile in the Studio for each printer and paper combination you use.",
  "Download the calibration sheet from Print setup.",
  "Print it at 100% on the paper and borderless setting you normally use.",
  "Measure the 25.4 mm and 50.8 mm squares and the 100 mm ruler, then check for clipped edges.",
  "Save a safe edge inset on the profile if the printer clips. Do not rescale the whole job.",
];

export default function HelpPage() {
  return (
    <PageShell>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Print guide: how to print photos at actual size
        </h1>
        <p className="mt-4 max-w-[62ch] leading-relaxed text-muted">
          What the file controls, what your printer controls, and how to check that a 2 × 2 in
          print really measures 2 × 2 in.
        </p>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Before every job</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-muted marker:text-ink">
            {CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">What borderless means here</h2>
          <div className="mt-4 max-w-[68ch] space-y-3 leading-relaxed text-muted">
            <p>
              Borderless in Pixmora means the document has 0 mm margins, so prints can sit at the
              edge of the file. It does not mean your printer will reach the edge of the paper.
            </p>
            <p>
              That depends on the printer model, paper size, driver settings and print dialog. A
              website cannot detect or change these. Some borderless modes also enlarge the page
              slightly and trim the edges, which matters for strict ID photo sizes.
            </p>
            <p>
              If your printer cannot print borderless, turn it off and enter a margin. Pixmora keeps
              photos at their true size and moves the overflow to another sheet, instead of
              shrinking them to fit.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Calibrate each printer</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-muted marker:text-ink">
            {CALIBRATION.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Resolution</h2>
          <p className="mt-4 max-w-[68ch] leading-relaxed text-muted">
            A 2 × 2 in print at 300 DPI needs a crop of about 600 × 600 pixels. Pixmora warns you
            when a crop falls below your quality threshold, and it never invents detail. The print
            stays at its exact size, but it may look soft.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Passport and ID photos</h2>
          <p className="mt-4 max-w-[68ch] leading-relaxed text-muted">
            Requirements differ by country and purpose. Check the size with the issuing authority,
            then set it under Photo sizes in the Studio’s Packages tab. The built-in passport size is only a
            starting value, and Pixmora asks you to confirm it. The{" "}
            <Link href="/sizes" className="underline hover:text-ink">photo size guides</Link> list
            1x1, 2x2, passport and R sizes in cm and mm.
          </p>
        </section>

        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-xl font-semibold">Something missing?</h2>
          <p className="mt-4 max-w-[68ch] leading-relaxed text-muted">
            If this guide didn’t answer your question, or a print came out wrong, tell us what
            happened. <FeedbackLink />
          </p>
        </section>
    </PageShell>
  );
}
