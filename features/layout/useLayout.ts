"use client";

import { useMemo } from "react";
import { useStudio } from "@/features/job/store";
import { computeLayout } from "./computeLayout";

/** Derived on every change, so a preview or export can never use stale placements. */
export function useLayout() {
  const groups = useStudio((state) => state.groups);
  const library = useStudio((state) => state.library);
  const sheets = useStudio((state) => state.sheets);
  const manual = useStudio((state) => state.manual);

  return useMemo(
    () => computeLayout(groups, library, sheets, manual),
    [groups, library, sheets, manual],
  );
}
