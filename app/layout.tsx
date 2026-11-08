import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const TITLE = "Pixmora: Less Space. More Prints.";
const DESCRIPTION =
  "Prepare photos, mix print packages on one sheet, and export true-size PDFs from your browser.";

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const metadata: Metadata = {
  metadataBase: new URL(productionHost ? `https://${productionHost}` : "http://localhost:3000"),
  title: TITLE,
  description: DESCRIPTION,
  // WebP is not a supported icon file convention, so these are declared here.
  icons: {
    icon: [32, 64, 96, 256].map((size) => ({
      url: `/brand/favicon-${size}x${size}.webp`,
      sizes: `${size}x${size}`,
      type: "image/webp",
    })),
    apple: { url: "/brand/android-chrome-192x192.webp", sizes: "192x192", type: "image/webp" },
  },
  openGraph: {
    type: "website",
    siteName: "Pixmora",
    title: TITLE,
    description: DESCRIPTION,
    images: {
      url: "/brand/pixmora-og-1200x630.webp",
      width: 1200,
      height: 630,
      alt: "Pixmora: Smarter Photo Layouts for Better Prints",
    },
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: {
      url: "/brand/pixmora-social-preview.webp",
      alt: "Pixmora: Smarter Photo Layouts for Better Prints",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
