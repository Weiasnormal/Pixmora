import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, absoluteUrl } from "@/features/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path === "/studio" ? 0.9 : 0.7,
  }));
}
