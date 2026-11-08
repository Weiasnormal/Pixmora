import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pixmora",
    short_name: "Pixmora",
    description:
      "Prepare photos, mix print packages on one sheet, and export true-size PDFs from your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffad0d",
    icons: [192, 512].map((size) => ({
      src: `/brand/android-chrome-${size}x${size}.webp`,
      sizes: `${size}x${size}`,
      type: "image/webp",
    })),
  };
}
