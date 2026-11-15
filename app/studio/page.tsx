import type { Metadata } from "next";
import { pageMetadata } from "@/features/seo/site";
import { StudioWorkspace } from "@/features/studio/StudioWorkspace";

export const metadata: Metadata = pageMetadata({
  title: "ID Photo Print Layout Studio",
  description:
    "Add photos, pick 1x1, 2x2 or passport sizes, and Pixmora packs them onto A4, Letter or 4R paper. Export a true-size PDF or a 300 DPI PNG.",
  path: "/studio",
});

export default function StudioPage() {
  return <StudioWorkspace />;
}
