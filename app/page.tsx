import Image from "next/image";
import { PrintSheet } from "@/components/PrintSheet";
import "./homepage.css";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { DEMO_VIDEO, DemoVideo, WatchDemoButton } from "@/features/demo/DemoVideo";
import { Logo } from "@/components/Logo";
import { FeedbackLink } from "@/features/feedback/FeedbackDialog";
import type { PrintItem } from "@/features/job/types";
import { packItems } from "@/features/layout/pack";
import { FooterLinks } from "@/components/PageShell";
import { JsonLd } from "@/features/seo/JsonLd";
import { SITE_NAME, absoluteUrl, pageMetadata } from "@/features/seo/site";
import {
  BORDERLESS_INSET_MM,
  MARGIN_INSET_MM,
  SIZE_GUIDES,
  copiesPerSheet,
  getPaper,
  getPhotoSize,
} from "@/features/seo/sizes";

export const metadata = pageMetadata({
  title: "Pixmora: Print 1x1, 2x2 and Passport Photos on One Sheet",
  description:
    "Free ID photo layout tool. Mix 1x1, 2x2 and passport photos for several customers on one A4 sheet at true size. Photos never leave your browser.",
  path: "/",
  absoluteTitle: true,
});

function perA4(sizeId: string, insetMm: number): number {
  return copiesPerSheet(getPhotoSize(sizeId), getPaper("a4"), insetMm).count;
}

function faqItems() {
  return [
    {
      question: "Is Pixmora free?",
      answer: "Yes. There is no sign-up and no account. Open the Studio and add your photos.",
    },
    {
      question: "Are my photos uploaded?",
      answer:
        "No. Editing, packing and export all happen in your browser, and photos are cleared when you close the page.",
    },
    {
      question: "How many 2x2 pictures fit on one A4 sheet?",
      answer: `${perA4("2x2", BORDERLESS_INSET_MM)} without borders and with 1 mm between prints, or ${perA4("2x2", MARGIN_INSET_MM)} with a ${MARGIN_INSET_MM} mm page margin.`,
    },
    {
      question: "How many 1x1 pictures fit on one A4 sheet?",
      answer: `${perA4("1x1", BORDERLESS_INSET_MM)} without borders and with 1 mm between prints, or ${perA4("1x1", MARGIN_INSET_MM)} with a ${MARGIN_INSET_MM} mm page margin.`,
    },
    {
      question: "Can I put 1x1 and 2x2 pictures on the same sheet?",
      answer:
        "Yes. Give each photo its own package, such as four 2x2 prints for one customer and twelve 1x1 prints for the next, and Pixmora packs them all onto shared paper.",
    },
    {
      question: "Will my prints come out at the right size?",
      answer:
        "The PDF is made at the exact paper size. Print it at 100% or Actual Size with Fit to Page turned off, and measure one test print before a full job.",
    },
    {
      question: "Can I print without borders?",
      answer:
        "Pixmora can make a file with 0 mm margins. Whether the ink reaches the edge of the paper depends on your printer, paper and driver settings.",
    },
  ];
}

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



export default function Home() {
  const faq = faqItems();
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description:
        "Free browser tool that packs 1x1, 2x2, passport and R-size photo prints onto shared paper at their exact size.",
      applicationCategory: "PhotographyApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript",
      inLanguage: "en-PH",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "PHP" },
      featureList: [
        "Mix photo sizes and customers on one sheet",
        "True-size packing in millimetres",
        "Crop, rotate and colour adjustments",
        "Background removal on the device",
        "PDF and PNG export at 150, 300 or 600 DPI",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/brand/android-chrome-512x512.webp"),
    },
    {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: "Pixmora demo: two print orders on one A4 sheet",
      description:
        "A one-minute walkthrough of Pixmora: set up packages, frame and clean up a portrait, then pack 2x2 and 1x1 prints for two customers onto one sheet and export the PDF.",
      thumbnailUrl: [absoluteUrl(DEMO_VIDEO.posterLandscape)],
      uploadDate: "2026-11-12T19:00:00+08:00",
      duration: `PT${DEMO_VIDEO.durationSeconds}S`,
      contentUrl: absoluteUrl(DEMO_VIDEO.landscape),
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
  // The preview is the real packing engine's output for the demo job below.
  const demo = packItems([...copies("a", 4, 50.8), ...copies("b", 12, 25.4)], {
    sheet: SHEET,
    gapXmm: 1,
    gapYmm: 1,
    allowItemRotation: false,
  });

  return (
    <div className="pix-home flex min-h-full flex-col">
      <JsonLd data={structuredData} />
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
              <span className="eyebrow">Free 1x1, 2x2 and passport photo layout</span>
              Less Space. More Prints.
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted">
              Mix customers and ID picture sizes on one A4 sheet. Pixmora arranges each print at its
              exact size, right in your browser.
            </p>
            <Link
              href="/studio"
              className="mt-8 mr-2 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-ink transition-colors duration-150 ease-out hover:bg-primary-hover"
            >
              Open Studio
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <WatchDemoButton className="watch-demo">
              <Play aria-hidden className="size-4 fill-current" />
              <span className="max-sm:hidden">Watch the 1-minute demo</span>
              <span className="sm:hidden">Watch the demo</span>
            </WatchDemoButton>
            <p className="privacy">Photos stay in your browser.</p>
          </div>

          <figure>
            <PrintSheet>
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
            </PrintSheet>
            <figcaption className="mt-3 text-[13px] text-muted">
              Two customers, {demo.placements.length} prints, one A4 sheet. Packed by the same
              engine the Studio uses.
            </figcaption>
          </figure>
        </section>

        <section className="demo" aria-labelledby="demo-title">
          <h2 id="demo-title" className="text-2xl font-semibold tracking-tight">
            See it in one minute
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Two customers, two photo sizes, one A4 sheet, from the first photo to the PDF.
          </p>
          <DemoVideo />
        </section>

        <section className="bg-page">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
            <h2 className="text-2xl font-semibold tracking-tight">From photo to paper</h2>
            <ol className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Image className="step-art" src={`/workflow/step-${index + 1}.svg`} alt="" width={120} height={78} />
                  <h3 className="mt-2 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
          <div className="details">
            <h2>Print details</h2>
            <dl>
            <div>
            <dt>Borderless file margin</dt>
            <dd>0 mm</dd>
            <dd className="note">Edge-to-edge printing depends on your printer, paper and driver settings. <Link href="/help">Print guide</Link>
            </dd>
            </div>
            <div>
            <dt>Minimum gap</dt>
            <dd>0 mm</dd>
            </div>
            <div>
            <dt>Default PNG resolution</dt>
            <dd>300 DPI</dd>
            </div>
            </dl>
            </div>
        </section>
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Photo sizes</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SIZE_GUIDES.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/sizes/${guide.slug}`}
                  className="block h-full rounded-lg border border-line p-4 transition-colors duration-150 hover:border-line-strong"
                >
                  <span className="font-semibold">{guide.h1}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    Sizes in cm, mm and pixels, and how many fit on one sheet.
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="bg-page">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
            <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
            <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
              {faq.map((item) => (
                <div key={item.question}>
                  <h3 className="font-semibold">{item.question}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-[13px] text-muted sm:px-8">
          <span className="footer-brand"><Logo variant="icon" height={32} />Photo preparation and print layout.</span>
          <FooterLinks />
          <span className="text-muted">
            Ideas or problems? <FeedbackLink />
          </span>
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
