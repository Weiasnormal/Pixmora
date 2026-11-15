import { PageShell } from "@/components/PageShell";
import { pageMetadata } from "@/features/seo/site";

export const metadata = pageMetadata({
  title: "Privacy: Your Photos Never Leave Your Device",
  description:
    "Pixmora edits, packs and exports your photos in the browser. Photos are never uploaded, saved or sent anywhere. Here's exactly what is and isn't stored.",
  path: "/privacy",
});

const SECTIONS = [
  {
    title: "Your photos",
    body: [
      "Photos you add stay in your browser's memory while the page is open. They are never uploaded to a server and never saved, so they are cleared when you close or reload the page.",
      "Cropping, colour adjustments, background removal, packing and export all happen on your device.",
    ],
  },
  {
    title: "Background removal",
    body: [
      "The first time you remove a background, your browser downloads the MODNet model from Hugging Face. Your photos are not sent with that request. The model then runs on your device.",
    ],
  },
  {
    title: "Settings saved in your browser",
    body: [
      "Your packages, photo sizes, printer profiles and print defaults are kept in your browser's local storage so they are still there next time. They stay on your device. Clearing your browser's site data removes them.",
    ],
  },
  {
    title: "Feedback",
    body: [
      "If you send feedback, your rating and message are emailed to the Pixmora team. Your email address is included only if you type it in. The page you were on, your screen size and your browser are included unless you untick that box. Photos are never attached.",
    ],
  },
  {
    title: "Hosting",
    body: [
      "The site is hosted on Vercel, which keeps standard server logs, such as IP addresses and the pages requested, to run and protect the service.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-muted">
        Short version: your photos never leave your device.
      </p>
      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-12">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <div className="mt-4 max-w-[68ch] space-y-3 leading-relaxed text-muted">
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </PageShell>
  );
}
