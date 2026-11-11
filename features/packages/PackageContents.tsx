import type { PackageItem, PhotoSize } from "@/features/job/types";

/** What a package holds, as small chips: "2 × 2 in · 4 pcs". */
export function PackageContents({
  items,
  sizes,
  price,
}: {
  items: PackageItem[];
  sizes: PhotoSize[];
  /** Shown after the sizes where the row has no room for a price column. */
  price?: number;
}) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {price !== undefined ? (
        <span className="pr-0.5 text-[11px] leading-tight text-ink tabular-nums">₱{price}</span>
      ) : null}
      {items.map((item, index) => (
        <span
          key={`${item.photoSizeId}-${index}`}
          className="rounded-md bg-page px-1.5 py-0.5 text-[11px] leading-tight text-muted tabular-nums"
        >
          {sizes.find((s) => s.id === item.photoSizeId)?.label ?? "Missing size"} ·{" "}
          {item.quantity} {item.quantity === 1 ? "pc" : "pcs"}
        </span>
      ))}
    </span>
  );
}
