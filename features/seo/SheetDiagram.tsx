import type { LayoutResult } from "@/features/job/types";

/** A static, to-scale drawing of the first sheet of a layout. Server-rendered, no script. */
export function SheetDiagram({ layout, label }: { layout: LayoutResult; label: string }) {
  const { widthMm, heightMm } = layout.sheet;
  return (
    <div
      role="img"
      aria-label={label}
      className="relative w-full bg-panel outline-1 outline-line-strong"
      style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
    >
      {layout.placements
        .filter((placement) => placement.sheetIndex === 0)
        .map((placement) => (
          <div
            key={placement.itemId}
            className="absolute bg-primary"
            style={{
              left: `${(placement.xMm / widthMm) * 100}%`,
              top: `${(placement.yMm / heightMm) * 100}%`,
              width: `${(placement.widthMm / widthMm) * 100}%`,
              height: `${(placement.heightMm / heightMm) * 100}%`,
            }}
          />
        ))}
    </div>
  );
}
