"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function PrintSheet({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let active = true;
    import("./mountSheet").then(({ mountSheet }) => {
      if (active && ref.current) dispose = mountSheet(ref.current);
    }).catch(() => { /* The server-rendered sheet remains available. */ });
    return () => {
      active = false;
      dispose?.();
    };
  }, []);
  return <div ref={ref} className="relative w-full bg-panel outline-1 outline-line" style={{aspectRatio: "210 / 297"}}>{children}</div>;
}
