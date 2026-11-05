"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Modal, SectionTitle } from "@/components/ui";
import { useStudio } from "@/features/job/store";
import type { EditRecipe, PhotoAsset, PhotoGroup } from "@/features/job/types";
import { localBackgroundRemoval, type RemovalProgress } from "./provider";

const SWATCHES = [
  { label: "White", color: "#FFFFFF" },
  { label: "Blue", color: "#1F5FBF" },
  { label: "Red", color: "#C8102E" },
];

/** Consent lasts for this tab; the model download only happens once. */
let consented = false;

export function BackgroundControls({
  group,
  asset,
  sizeId,
  recipe,
}: {
  group: PhotoGroup;
  asset: PhotoAsset;
  sizeId: string;
  recipe: EditRecipe;
}) {
  const updateRecipe = useStudio((state) => state.updateRecipe);
  const setCutout = useStudio((state) => state.setCutout);
  const [progress, setProgress] = useState<RemovalProgress | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const setBackground = (background: EditRecipe["background"]) => {
    updateRecipe(group.id, sizeId, { background }, "background");
  };

  const run = async () => {
    setProgress({ stage: "download", percent: null });
    try {
      const blob = await localBackgroundRemoval.remove(asset.url, setProgress);
      setCutout(asset.id, URL.createObjectURL(blob));
      setBackground({ ...recipe.background, mode: "solid" });
      toast.success("Background removed. Choose a colour for it.");
    } catch (error) {
      console.error("Background removal failed", error);
      toast.error(
        "Background removal did not finish. Check your connection for the first download, then try again.",
      );
    } finally {
      setProgress(null);
    }
  };

  const status =
    progress?.stage === "processing"
      ? "Removing background…"
      : progress?.percent != null
        ? `Downloading model ${Math.round(progress.percent)}%`
        : "Preparing…";

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <SectionTitle>Background</SectionTitle>
      {asset.cutoutUrl ? (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Background colour">
            {SWATCHES.map((swatch) => {
              const active =
                recipe.background.mode === "solid" && recipe.background.color === swatch.color;
              return (
                <button
                  key={swatch.color}
                  type="button"
                  aria-label={swatch.label}
                  aria-pressed={active}
                  title={swatch.label}
                  onClick={() => setBackground({ mode: "solid", color: swatch.color })}
                  className={`size-8 rounded-lg border border-line ${active ? "ring-2 ring-primary ring-offset-1" : ""}`}
                  style={{ backgroundColor: swatch.color }}
                />
              );
            })}
            <input
              type="color"
              aria-label="Custom background colour"
              className="h-8 w-10 rounded-lg border border-line bg-panel p-0.5"
              value={recipe.background.color}
              onChange={(event) => setBackground({ mode: "solid", color: event.target.value })}
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={recipe.background.mode === "keep"}
            onClick={() => setBackground({ ...recipe.background, mode: "keep" })}
          >
            Use original background
          </Button>
        </>
      ) : (
        <Button
          disabled={progress !== null}
          onClick={() => {
            if (consented) {
              void run();
            } else {
              setConsentOpen(true);
            }
          }}
        >
          {progress ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden className="size-4" />
          )}
          {progress ? status : "Remove background"}
        </Button>
      )}

      <Modal
        open={consentOpen}
        title="Remove the background?"
        onClose={() => setConsentOpen(false)}
        footer={
          <>
            <Button onClick={() => setConsentOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                consented = true;
                setConsentOpen(false);
                void run();
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Your photo stays in this browser. The first run downloads an AI model from Hugging Face
          and its runtime from jsDelivr, then your browser keeps them. Results can miss fine detail
          such as hair, so check the edges before printing.
        </p>
      </Modal>
    </div>
  );
}
