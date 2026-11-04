import { createId } from "@/features/job/store";
import type { PhotoAsset } from "@/features/job/types";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PIXELS = 100_000_000;

export type ImportResult =
  | { ok: true; asset: PhotoAsset }
  | { ok: false; message: string };

function decode(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("decode failed"));
    image.src = url;
  });
}

export async function importPhoto(file: File): Promise<ImportResult> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return {
      ok: false,
      message: `${file.name} is not supported. Save it as JPG, PNG or WebP and add it again.`,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `${file.name} is larger than 40 MB. Export a smaller copy and add it again.`,
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const { width, height } = await decode(url);
    if (width * height > MAX_PIXELS) {
      URL.revokeObjectURL(url);
      return {
        ok: false,
        message: `${file.name} is over 100 megapixels. Resize it and add it again.`,
      };
    }
    return {
      ok: true,
      asset: {
        id: createId("asset"),
        name: file.name,
        mime: file.type,
        widthPx: width,
        heightPx: height,
        url,
      },
    };
  } catch {
    URL.revokeObjectURL(url);
    return {
      ok: false,
      message: `${file.name} could not be opened. The file may be damaged, so try exporting it again.`,
    };
  }
}
