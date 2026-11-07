import type { Metadata } from "next";
import { StudioWorkspace } from "@/features/studio/StudioWorkspace";

export const metadata: Metadata = {
  title: "Studio | Pixmora",
  description: "Prepare photos and build true-size print sheets.",
};

export default function StudioPage() {
  return <StudioWorkspace />;
}
