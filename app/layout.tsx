import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "@/features/seo/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const TITLE = "Pixmora: Print 1x1, 2x2 and Passport Photos on One Sheet";
const DESCRIPTION =
  "Free ID photo layout tool. Mix 1x1, 2x2 and passport photos for several customers on one A4 sheet at true size. Photos never leave your browser.";

// Search engine ownership tags. Set these in Vercel once Search Console and Bing Webmaster give you the codes.
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: TITLE, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  // WebP is not a supported icon file convention, so these are declared here.
  icons: {
    icon: [32, 64, 96, 256].map((size) => ({
      url: `/brand/favicon-${size}x${size}.webp`,
      sizes: `${size}x${size}`,
      type: "image/webp",
    })),
    // iOS only reads PNG touch icons.
    apple: { url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_PH",
    title: TITLE,
    description: DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ ...SOCIAL_IMAGE, url: "/brand/pixmora-social-preview-1200x630.jpg" }],
  },
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
