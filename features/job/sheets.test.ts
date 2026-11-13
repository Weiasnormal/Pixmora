import { beforeEach, describe, expect, it } from "vitest";
import { computeLayout } from "@/features/layout/computeLayout";
import { DEFAULT_OPTIONS, DEFAULT_PHOTO_SIZES } from "./defaults";
import { activeSheetOf, useStudio } from "./store";
import type { PhotoAsset } from "./types";

const initial = useStudio.getState();

function asset(id: string): PhotoAsset {
  return { id, name: `${id}.jpg`, mime: "image/jpeg", widthPx: 1200, heightPx: 1200, url: `blob:${id}` };
}

function layout() {
  const state = useStudio.getState();
  return computeLayout(state.groups, state.library, state.sheets, state.manual);
}

/** The page indexes a photo's prints sit on. */
function pagesOf(groupId: string): number[] {
  return [
    ...new Set(layout().placements.filter((p) => p.groupId === groupId).map((p) => p.sheetIndex)),
  ];
}

beforeEach(() => {
  useStudio.setState(initial, true);
});

describe("sheets are separate papers", () => {
  it("adds a photo to the open sheet, not the first one", () => {
    const studio = useStudio.getState();
    studio.addPhoto(asset("woman"));
    studio.addSheet();
    const sheet2 = useStudio.getState().activeSheetId;
    useStudio.getState().addPhoto(asset("dragon"));

    const [woman, dragon] = useStudio.getState().groups;
    expect(woman.sheetId).toBe("sheet-1");
    expect(dragon.sheetId).toBe(sheet2);
    expect(pagesOf(woman.id)).toEqual([0]);
    expect(pagesOf(dragon.id)).toEqual([1]);
  });

  it("keeps a duplicated photo on its own sheet", () => {
    useStudio.getState().addSheet();
    useStudio.getState().addPhoto(asset("dragon"));
    const original = useStudio.getState().groups[0];
    useStudio.getState().duplicateGroup(original.id);

    expect(useStudio.getState().groups.map((g) => g.sheetId)).toEqual([
      original.sheetId,
      original.sheetId,
    ]);
  });

  it("changes settings on the open sheet only, and leaves the other sheet's prints in place", () => {
    useStudio.getState().addPhoto(asset("woman"));
    const before = layout().placements.filter((p) => p.sheetIndex === 0);
    useStudio.getState().addSheet();
    useStudio.getState().updateOptions({ orientation: "landscape", gapXmm: 4, cutGuides: true });

    const [sheet1, sheet2] = useStudio.getState().sheets;
    expect(sheet1.options.orientation).toBe("portrait");
    expect(sheet1.options.gapXmm).toBe(DEFAULT_OPTIONS.gapXmm);
    expect(sheet2.options).toMatchObject({ orientation: "landscape", gapXmm: 4, cutGuides: true });

    const pages = layout().pages;
    expect(pages[0].bounds.widthMm).toBeLessThan(pages[0].bounds.heightMm);
    expect(pages[1].bounds.widthMm).toBeGreaterThan(pages[1].bounds.heightMm);
    expect(pages[1].cutGuides).toBe(true);
    expect(layout().placements.filter((p) => p.sheetIndex === 0)).toEqual(before);
  });

  it("starts a new sheet with the open sheet's settings", () => {
    useStudio.getState().updateOptions({ paperId: "letter" });
    useStudio.getState().addSheet();

    expect(activeSheetOf(useStudio.getState()).options.paperId).toBe("letter");
  });

  it("copies the open sheet's settings to every sheet on request", () => {
    useStudio.getState().addSheet();
    useStudio.getState().updateOptions({ paperId: "legal" });
    useStudio.getState().applyOptionsToAllSheets();

    expect(useStudio.getState().sheets.map((s) => s.options.paperId)).toEqual(["legal", "legal"]);
  });

  it("keeps the DPI warning shop-wide", () => {
    useStudio.getState().addSheet();
    useStudio.getState().updateOptions({ minDpi: 250 });

    const state = useStudio.getState();
    expect(state.options.minDpi).toBe(250);
    expect(state.sheets.every((s) => s.options.minDpi === 250)).toBe(true);
  });

  it("puts extra prints on overflow pages right after their own sheet", () => {
    useStudio.setState({
      library: {
        ...useStudio.getState().library,
        sizes: DEFAULT_PHOTO_SIZES,
        packages: [],
      },
    });
    useStudio.getState().addPhoto(asset("woman"));
    useStudio.getState().addSheet();
    useStudio.getState().addPhoto(asset("crowd"));
    const crowd = useStudio.getState().groups[1];
    // Forty 4R prints need several A4 papers.
    useStudio.getState().setSelection(crowd.id, { kind: "single", photoSizeId: "4r", quantity: 40 });
    useStudio.getState().addSheet();

    const pages = layout().pages;
    const sheets = useStudio.getState().sheets;
    expect(pages[0].sheetId).toBe(sheets[0].id);
    expect(pages.at(-1)?.sheetId).toBe(sheets[2].id);
    const crowdPages = pages.filter((p) => p.sheetId === sheets[1].id);
    expect(crowdPages.length).toBeGreaterThan(1);
    expect(crowdPages.map((p) => p.pageInSheet)).toEqual(crowdPages.map((_, i) => i));
    expect(new Set(pagesOf(crowd.id))).toEqual(new Set(crowdPages.map((p) => pages.indexOf(p))));
  });

  it("removes a sheet with its photos, and undo brings both back", () => {
    useStudio.getState().addPhoto(asset("woman"));
    useStudio.getState().addSheet();
    const sheet2 = useStudio.getState().activeSheetId;
    useStudio.getState().addPhoto(asset("dragon"));

    useStudio.getState().removeSheet(sheet2);
    expect(useStudio.getState().sheets).toHaveLength(1);
    expect(useStudio.getState().groups.map((g) => g.displayName)).toEqual(["woman"]);
    expect(useStudio.getState().activeSheetId).toBe("sheet-1");

    useStudio.getState().undo();
    expect(useStudio.getState().sheets).toHaveLength(2);
    expect(useStudio.getState().groups.map((g) => g.displayName)).toEqual(["woman", "dragon"]);
  });

  it("never removes the last sheet", () => {
    useStudio.getState().removeSheet("sheet-1");
    expect(useStudio.getState().sheets).toHaveLength(1);
  });

  it("selects a photo on the sheet that is opened", () => {
    useStudio.getState().addPhoto(asset("woman"));
    useStudio.getState().addSheet();
    expect(useStudio.getState().selectedGroupId).toBeNull();
    useStudio.getState().addPhoto(asset("dragon"));
    const [woman, dragon] = useStudio.getState().groups;
    expect(useStudio.getState().selectedGroupId).toBe(dragon.id);

    useStudio.getState().openSheet("sheet-1");
    expect(useStudio.getState().selectedGroupId).toBe(woman.id);
  });

  it("moves a print by hand onto another sheet's paper", () => {
    useStudio.getState().addPhoto(asset("woman"));
    useStudio.getState().addSheet();
    const sheet2 = useStudio.getState().activeSheetId;
    const print = layout().placements[0];
    useStudio.getState().setManualPlacement(print.itemId, {
      sheetId: sheet2,
      pageInSheet: 0,
      xMm: 5,
      yMm: 5,
    });

    const moved = layout().placements.find((p) => p.itemId === print.itemId);
    expect(moved).toMatchObject({ sheetIndex: 1, xMm: 5, yMm: 5 });
    expect(layout().problems).toEqual([]);
  });
});
