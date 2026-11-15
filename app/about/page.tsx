import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { pageMetadata } from "@/features/seo/site";

export const metadata = pageMetadata({
  title: "About Pixmora: Free ID Photo Layout Tool",
  description:
    "Pixmora is a free ID photo layout tool. It packs 1x1, 2x2 and passport photos onto shared paper at true size, right in your browser.",
  path: "/about",
  absoluteTitle: true,
});

export default function AboutPage() {
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight">About Pixmora</h1>
      <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-muted">
        Pixmora is a free tool for preparing photos and packing them onto paper at their exact
        size. Less Space. More Prints.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Why it exists</h2>
        <div className="mt-4 max-w-[68ch] space-y-3 leading-relaxed text-muted">
          <p>
            Print counters often lay out ID pictures by hand in a word processor: copy the photo,
            resize it, line up the copies, and hope a 2x2 still measures 2 × 2 inches on paper. When
            two customers want different sizes, that usually means two sheets and a lot of wasted
            paper.
          </p>
          <p>
            Pixmora does that part for you. Give each photo its own package, such as four 2x2 prints
            for one customer and twelve 1x1 prints for the next, and it packs them all onto shared
            paper at true size.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted marker:text-ink">
          <li>Everything runs in your browser. Photos are never uploaded to a server.</li>
          <li>Prints are placed in millimetres, with gaps down to 0 mm.</li>
          <li>You can crop, rotate, adjust colour, and replace a background on your device.</li>
          <li>Jobs export as a PDF at the exact paper size, or as PNG sheets at up to 600 DPI.</li>
          <li>A calibration sheet helps you check that your printer prints at actual size.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Where to start</h2>
        <p className="mt-4 max-w-[68ch] leading-relaxed text-muted">
          Open the <Link href="/studio" className="underline hover:text-ink">Studio</Link> to make a
          sheet, check the <Link href="/sizes" className="underline hover:text-ink">photo size guides</Link>,
          or read the <Link href="/help" className="underline hover:text-ink">print guide</Link> before
          your first job.
        </p>
      </section>
    </PageShell>
  );
}
