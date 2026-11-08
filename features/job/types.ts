/** Physical length. All layout geometry is stored in millimetres. */
export type Millimeters = number;

export type PhotoSize = {
  id: string;
  label: string;
  widthMm: Millimeters;
  heightMm: Millimeters;
  allowRotation: boolean;
  /** Region-specific sizes (passport) stay flagged until the operator confirms them. */
  needsConfirmation?: boolean;
};

export type PackageItem = { photoSizeId: string; quantity: number };

export type PackagePreset = {
  id: string;
  name: string;
  description?: string;
  pricePhp: number;
  enabled: boolean;
  items: PackageItem[];
  createdAt: number;
  updatedAt: number;
};

export type PaperPreset = {
  id: string;
  name: string;
  widthMm: Millimeters;
  heightMm: Millimeters;
};

export type PrinterProfile = {
  id: string;
  name: string;
  /** Non-scaling safe inset, used when the printer cannot reach the paper edge. */
  insetMm: Millimeters;
  notes?: string;
};

export type PhotoAsset = {
  id: string;
  name: string;
  mime: string;
  widthPx: number;
  heightPx: number;
  /** In-memory object URL. Customer photos are never persisted. */
  url: string;
  /** Transparent cutout of the same dimensions, once background removal has run. */
  cutoutUrl?: string;
};

export type CropArea = { x: number; y: number; width: number; height: number };

export type PhotoBorder = {
  enabled: boolean;
  style: "solid" | "dashed";
  widthMm: Millimeters;
  color: string;
};

export type PhotoBackground = { mode: "keep" | "solid"; color: string };

export type EditRecipe = {
  /** Editor pan position, kept so a crop can be re-opened exactly. */
  pan: { x: number; y: number };
  zoom: number;
  rotationDeg: number;
  /** Crop in source pixels of the rotated image; null means centred default. */
  area: CropArea | null;
  brightness: number;
  contrast: number;
  /** -100 to 100. Lifts muted colours more than vivid ones. */
  vibrance: number;
  /** -100 (cooler) to 100 (warmer). */
  temperature: number;
  background: PhotoBackground;
  border: PhotoBorder;
};

/** The colour and background half of a recipe. It can be shared across sizes; a crop cannot. */
export type PhotoLook = Pick<
  EditRecipe,
  "brightness" | "contrast" | "vibrance" | "temperature" | "background"
>;

export type PhotoSelection =
  | { kind: "package"; packageId: string; sets: number }
  | { kind: "single"; photoSizeId: string; quantity: number };

export type PhotoGroup = {
  id: string;
  displayName: string;
  assetId: string;
  selection: PhotoSelection;
  editsByPhotoSize: Record<string, EditRecipe>;
  /** When set, every size of this group prints with this look instead of its own. */
  sharedLook?: PhotoLook | null;
  enabled: boolean;
};

export type Orientation = "portrait" | "landscape";

export type LayoutOptions = {
  paperId: string;
  customPaper: { widthMm: Millimeters; heightMm: Millimeters };
  orientation: Orientation;
  borderlessRequested: boolean;
  /** Edge inset applied when borderless is off, or set by a printer profile. */
  insetMm: Millimeters;
  gapXmm: Millimeters;
  gapYmm: Millimeters;
  allowItemRotation: boolean;
  cutGuides: boolean;
  printerProfileId: string | null;
  minDpi: number;
};

export type PrintItem = {
  id: string;
  groupId: string;
  photoSizeId: string;
  copyIndex: number;
  widthMm: Millimeters;
  heightMm: Millimeters;
  allowRotation: boolean;
};

export type Placement = {
  itemId: string;
  sheetIndex: number;
  groupId: string;
  photoSizeId: string;
  copyIndex: number;
  xMm: Millimeters;
  yMm: Millimeters;
  /** Size on paper. Width and height are swapped when `rotated` is true. */
  widthMm: Millimeters;
  heightMm: Millimeters;
  rotated: boolean;
};

export type ManualPlacement = {
  sheetIndex: number;
  xMm: Millimeters;
  yMm: Millimeters;
};

export type SheetBounds = {
  widthMm: Millimeters;
  heightMm: Millimeters;
  insetMm: Millimeters;
};

export type LayoutIssue = { code: string; message: string; itemId?: string };

export type LayoutResult = {
  sheet: SheetBounds;
  sheetCount: number;
  placements: Placement[];
  unplaced: PrintItem[];
  errors: LayoutIssue[];
  /** Placed print area as a share of all used paper, 0 to 1. */
  utilization: number;
  totalItems: number;
};
