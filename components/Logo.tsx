import Image from "next/image";

/** Width always follows height, so each artwork's ratio never changes. */
const LOGOS = {
  primary: { src: "/brand/pixmora-logo-primary.webp", ratio: 2172 / 724 },
  stacked: { src: "/brand/pixmora-logo-stacked.webp", ratio: 1 },
  icon: { src: "/brand/pixmora-icon.webp", ratio: 1 },
};

export function Logo({
  height = 36,
  priority = false,
  variant = "primary",
}: {
  height?: number;
  priority?: boolean;
  variant?: keyof typeof LOGOS;
}) {
  const { src, ratio } = LOGOS[variant];
  const width = Math.round(height * ratio);
  return (
    <Image
      src={src}
      alt="Pixmora"
      width={width}
      height={height}
      priority={priority}
      style={{ width, height, maxWidth: "none" }}
    />
  );
}
