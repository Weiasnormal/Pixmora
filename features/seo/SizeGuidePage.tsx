import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "./JsonLd";
import { SheetDiagram } from "./SheetDiagram";
import { absoluteUrl } from "./site";
import {
  BORDERLESS_INSET_MM,
  GAP_MM,
  MARGIN_INSET_MM,
  SIZE_GUIDES,
  copiesPerSheet,
  formatCm,
  formatInches,
  formatMillimetres,
  getPaper,
  getPhotoSize,
  getSizeGuide,
  pixelsAt,
  type SizeGuideSlug,
} from "./sizes";

const cell = "border-t border-line py-2.5 pr-4 align-top";
const headCell = "pb-2 pr-4 text-left text-[13px] font-medium text-muted";

export function SizeGuidePage({ slug }: { slug: SizeGuideSlug }) {
  const guide = getSizeGuide(slug);
  const sizes = guide.sizeIds.map(getPhotoSize);
  const papers = guide.paperIds.map(getPaper);
  const featured = sizes.length === 1 ? sizes[0] : getPhotoSize("4r");
  const a4 = getPaper("a4");
  const diagram = copiesPerSheet(featured, a4, BORDERLESS_INSET_MM);
  const diagramNoun = sizes.length === 1 ? guide.printNoun : `${featured.label} photos`;
  const others = SIZE_GUIDES.filter((item) => item.slug !== slug);

  const rows = sizes.flatMap((size) =>
    papers.map((paper) => ({
      size,
      paper,
      borderless: copiesPerSheet(size, paper, BORDERLESS_INSET_MM).count,
      margin: copiesPerSheet(size, paper, MARGIN_INSET_MM).count,
    })),
  );

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Pixmora", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Photo sizes", item: absoluteUrl("/sizes") },
      { "@type": "ListItem", position: 3, name: guide.name, item: absoluteUrl(`/sizes/${slug}`) },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
        <Link href="/sizes" className="hover:text-ink">
          Photo sizes
        </Link>
        <span aria-hidden> / </span>
        <span>{guide.name}</span>
      </nav>

      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">{guide.h1}</h1>
      <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-muted">{guide.lead}</p>
      {guide.note ? (
        <p className="mt-5 max-w-[68ch] rounded-lg bg-primary-soft px-4 py-3 text-sm leading-relaxed">{guide.note}</p>
      ) : null}

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Size in inches, centimetres, millimetres and pixels</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr>
                <th className={headCell}>Size</th>
                <th className={headCell}>Inches</th>
                <th className={headCell}>Centimetres</th>
                <th className={headCell}>Millimetres</th>
                <th className={headCell}>Pixels at 300 DPI</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((size) => (
                <tr key={size.id}>
                  <th scope="row" className={`${cell} text-left font-medium`}>
                    {size.label}
                  </th>
                  <td className={cell}>
                    {formatInches(size.widthMm)} × {formatInches(size.heightMm)} in
                  </td>
                  <td className={cell}>
                    {formatCm(size.widthMm)} × {formatCm(size.heightMm)} cm
                  </td>
                  <td className={cell}>
                    {formatMillimetres(size.widthMm)} × {formatMillimetres(size.heightMm)} mm
                  </td>
                  <td className={cell}>
                    {pixelsAt(size.widthMm, 300)} × {pixelsAt(size.heightMm, 300)} px
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-muted">
          The pixel size is the smallest crop that prints sharply at 300 DPI. A smaller photo still
          prints at the right size, but it may look soft.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">How many fit on one sheet</h2>
        <div className="mt-6 grid items-start gap-8 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[24rem] text-sm">
              <thead>
                <tr>
                  {sizes.length > 1 ? <th className={headCell}>Size</th> : null}
                  <th className={headCell}>Paper</th>
                  <th className={headCell}>Borderless</th>
                  <th className={headCell}>{MARGIN_INSET_MM} mm margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.size.id}-${row.paper.id}`}>
                    {sizes.length > 1 ? <td className={`${cell} font-medium`}>{row.size.label}</td> : null}
                    <td className={cell}>{row.paper.name}</td>
                    <td className={`${cell} font-semibold`}>{row.borderless}</td>
                    <td className={`${cell} font-semibold`}>{row.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-muted">
              Counted by the same packing engine the Studio uses, with {GAP_MM} mm between prints.
              Most printers can&apos;t print to the very edge of the paper, so the margin column is the
              safer number. The <Link href="/help" className="underline hover:text-ink">print guide</Link>{" "}
              explains how to check yours.
            </p>
          </div>
          <figure className="mx-auto w-full max-w-[200px]">
            <SheetDiagram
              layout={diagram.layout}
              label={`${diagram.count} ${diagramNoun} on one A4 sheet`}
            />
            <figcaption className="mt-2 text-[13px] text-muted">
              {diagram.count} {diagramNoun} on one A4 sheet, borderless
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">How to print a sheet of {guide.printNoun}</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-muted marker:text-ink">
          <li>Open the Studio and add your photos. JPG, PNG and WebP all work.</li>
          <li>
            In the Packages tab, choose a package with {guide.printNoun}, or make one with the
            number of copies you need.
          </li>
          <li>Adjust each crop. Pixmora warns you when a photo is too small to print sharply.</li>
          <li>
            Download the PDF and print it at 100% or Actual Size, with scaling turned off.
          </li>
        </ol>
        <Link
          href="/studio"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-ink transition-colors duration-150 ease-out hover:bg-primary-hover"
        >
          Open Studio
          <ArrowRight aria-hidden className="size-4" />
        </Link>
        <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted">
          Need more than one size? Give each photo its own package, and Pixmora packs 1x1, 2x2 and
          passport prints together on the same sheet. Your photos stay on your device.
        </p>
      </section>

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="text-xl font-semibold">Other sizes</h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {others.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/sizes/${item.slug}`}
                className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium transition-colors duration-150 hover:border-line-strong"
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
