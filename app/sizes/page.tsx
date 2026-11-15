import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { DEFAULT_PHOTO_SIZES } from "@/features/job/defaults";
import { pageMetadata } from "@/features/seo/site";
import {
  BORDERLESS_INSET_MM,
  SIZE_GUIDES,
  copiesPerSheet,
  formatCm,
  formatInches,
  formatMillimetres,
  getPaper,
} from "@/features/seo/sizes";

export const metadata = pageMetadata({
  title: "Photo and ID Picture Sizes: 1x1, 2x2, Passport and R Sizes",
  description:
    "Every common photo print size in inches, cm and mm: 1x1, 2x2, passport 35 × 45 mm, 3R, 4R, 5R and 6R, with how many fit on one A4 sheet.",
  path: "/sizes",
});

const cell = "border-t border-line py-2.5 pr-4 align-top";
const headCell = "pb-2 pr-4 text-left text-[13px] font-medium text-muted";

function guideFor(sizeId: string) {
  return SIZE_GUIDES.find((guide) => guide.sizeIds.includes(sizeId));
}

export default function SizesPage() {
  const a4 = getPaper("a4");
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight">Photo and ID picture sizes</h1>
      <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-muted">
        The print sizes photo counters in the Philippines use most, in inches, centimetres and
        millimetres, with how many fit on one A4 sheet without borders.
      </p>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr>
              <th className={headCell}>Size</th>
              <th className={headCell}>Inches</th>
              <th className={headCell}>Centimetres</th>
              <th className={headCell}>Millimetres</th>
              <th className={headCell}>Per A4 sheet</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_PHOTO_SIZES.map((size) => {
              const guide = guideFor(size.id);
              return (
                <tr key={size.id}>
                  <th scope="row" className={`${cell} text-left font-medium`}>
                    {guide ? (
                      <Link href={`/sizes/${guide.slug}`} className="underline hover:text-muted">
                        {size.label}
                      </Link>
                    ) : (
                      size.label
                    )}
                  </th>
                  <td className={cell}>
                    {formatInches(size.widthMm)} × {formatInches(size.heightMm)}
                  </td>
                  <td className={cell}>
                    {formatCm(size.widthMm)} × {formatCm(size.heightMm)}
                  </td>
                  <td className={cell}>
                    {formatMillimetres(size.widthMm)} × {formatMillimetres(size.heightMm)}
                  </td>
                  <td className={`${cell} font-semibold`}>
                    {copiesPerSheet(size, a4, BORDERLESS_INSET_MM).count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-muted">
        Counts use 1 mm between prints and no page margin. If your printer can&apos;t print to the
        edge, each size guide also lists the count with a 5 mm margin.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Size guides</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SIZE_GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/sizes/${guide.slug}`}
                className="block h-full rounded-lg border border-line p-4 transition-colors duration-150 hover:border-line-strong"
              >
                <span className="font-semibold">{guide.h1}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{guide.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
