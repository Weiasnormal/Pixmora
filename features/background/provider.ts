export type RemovalProgress = { stage: "download" | "processing"; percent: number | null };

/** Vendor-neutral, so another local model or a proxied API can replace it later. */
export type BackgroundRemovalProvider = {
  id: string;
  label: string;
  remove: (imageUrl: string, onProgress: (progress: RemovalProgress) => void) => Promise<Blob>;
};

const MODEL_ID = "Xenova/modnet";

type Cutout = { toBlob: (type: string) => Promise<Blob> };
type Segmenter = (input: string) => Promise<Cutout | Cutout[]>;

let segmenter: Promise<Segmenter> | null = null;

function loadSegmenter(onProgress: (progress: RemovalProgress) => void): Promise<Segmenter> {
  segmenter ??= import("@huggingface/transformers")
    .then(({ pipeline }) =>
      pipeline("background-removal", MODEL_ID, {
        dtype: "q8",
        progress_callback: (event: { status: string; progress?: number }) => {
          if (event.status === "progress") {
            onProgress({ stage: "download", percent: event.progress ?? null });
          }
        },
      }),
    )
    .then((loaded) => loaded as unknown as Segmenter)
    .catch((error) => {
      segmenter = null;
      throw error;
    });
  return segmenter;
}

/** MODNet (Apache-2.0) runs in the browser, so the photo itself never leaves it. */
export const localBackgroundRemoval: BackgroundRemovalProvider = {
  id: "local-modnet",
  label: "MODNet in this browser",
  async remove(imageUrl, onProgress) {
    const segment = await loadSegmenter(onProgress);
    onProgress({ stage: "processing", percent: null });
    const result = await segment(imageUrl);
    const cutout = Array.isArray(result) ? result[0] : result;
    return cutout.toBlob("image/png");
  },
};
