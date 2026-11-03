import Image from "next/image";

/** Source artwork is 2000 × 667; width always follows height, so the ratio never changes. */
const LOGO_RATIO = 2000 / 667;

export function Logo({ height = 36, priority = false }: { height?: number; priority?: boolean }) {
  const width = Math.round(height * LOGO_RATIO);
  return (
    <Image
      src="/brand/pixmora-logo.webp"
      alt="Pixmora"
      width={width}
      height={height}
      priority={priority}
      style={{ width, height, maxWidth: "none" }}
    />
  );
}
