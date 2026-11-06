"use client";

import { useMemo } from "react";
import { useStudio } from "@/features/job/store";
import { computeLayout } from "./computeLayout";

/** Derived on every change, so a preview or export can never use stale placements. */
export function useLayout() {
  const groups = useStudio((state) => state.groups);
  const library = useStudio((state) => state.library);
  const options = useStudio((state) => state.options);
  const manual = useStudio((state) => state.manual);

  return useMemo(
    () => computeLayout(groups, library, options, manual),
    [groups, library, options, manual],
  );
}
