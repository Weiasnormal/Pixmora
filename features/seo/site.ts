import type { Metadata } from "next";

export const SITE_NAME = "Pixmora";

/**
 * The public address of the site. Set SITE_URL once a custom domain is live.
 * Until then, Vercel's production address is used, and localhost during development.
 */
function resolveSiteUrl(): URL {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return new URL(configured);
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
}

export const SITE_URL = resolveSiteUrl();

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/** Every public page, in the order the sitemap lists them. */
export const PUBLIC_ROUTES = [
  "/",
  "/studio",
  "/sizes",
  "/sizes/1x1",
  "/sizes/2x2",
  "/sizes/passport",
  "/sizes/r-sizes",
  "/help",
  "/about",
  "/privacy",
] as const;

export const SOCIAL_IMAGE = {
  url: "/brand/pixmora-og-1200x630.jpg",
  width: 1200,
  height: 630,
  alt: "Pixmora: Smarter Photo Layouts for Better Prints",
};

const TWITTER_IMAGE = {
  url: "/brand/pixmora-social-preview-1200x630.jpg",
  width: 1200,
  height: 630,
  alt: SOCIAL_IMAGE.alt,
};

/**
 * Title, description, canonical URL and social cards for one page.
 * Titles get the "| Pixmora" suffix unless `absoluteTitle` is set.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_PH",
      url: path,
      title: fullTitle,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [TWITTER_IMAGE],
    },
  };
}
