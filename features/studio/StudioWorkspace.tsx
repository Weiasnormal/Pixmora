"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { CircleHelp, Keyboard, MousePointer2, Redo2, Undo2 } from "lucide-react";
import { Toaster } from "sonner";
import { Logo } from "@/components/Logo";
import { IconButton, Segmented } from "@/components/ui";
import { ExportActions } from "@/features/export/ExportActions";
import { CropEditor } from "@/features/images/CropEditor";
import { PhotoPanel } from "@/features/images/PhotoPanel";
import { AddPhotoButton, PhotoQueue, useAddPhotos } from "@/features/job/PhotoQueue";
import { useStudio } from "@/features/job/store";
import { SheetPreview } from "@/features/layout/SheetPreview";
import { useLayout } from "@/features/layout/useLayout";
import { PrintSetupPanel } from "@/features/settings/PrintSetupPanel";
import { GuideCursor, useGuideAvailable, type GuidePane } from "./GuideCursor";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { useShortcuts } from "./shortcuts";

type RightTab = "photo" | "print";
type Pane = GuidePane;
type SidePane = Exclude<Pane, "sheet">;

function JobSummary() {
  const layout = useLayout();
  const groups = useStudio((state) => state.groups.filter((g) => g.enabled).length);
  if (layout.totalItems === 0) return null;
  return (
    <p className="hidden truncate text-[13px] text-muted tabular-nums lg:block" aria-live="polite">
      {layout.totalItems} {layout.totalItems === 1 ? "print" : "prints"} from {groups}{" "}
      {groups === 1 ? "group" : "groups"} | {layout.sheetCount}{" "}
      {layout.sheetCount === 1 ? "sheet" : "sheets"}
    </p>
  );
}

function HistoryButtons() {
  const canUndo = useStudio((state) => state.past.length > 0);
  const canRedo = useStudio((state) => state.future.length > 0);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);

  return (
    <>
      <IconButton label="Undo" disabled={!canUndo} onClick={undo}>
        <Undo2 aria-hidden className="size-4" />
      </IconButton>
      <IconButton label="Redo" disabled={!canRedo} onClick={redo}>
        <Redo2 aria-hidden className="size-4" />
      </IconButton>
    </>
  );
}

function TopBar({
  sidePane,
  onSidePane,
  onShortcuts,
  onGuide,
}: {
  sidePane: SidePane;
  onSidePane: (pane: SidePane) => void;
  onShortcuts: () => void;
  onGuide: () => void;
}) {
  const guideAvailable = useGuideAvailable();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 short:h-12 sm:px-4">
      <Link href="/" aria-label="Pixmora home" className="flex h-11 shrink-0 items-center">
        <span className="sm:hidden">
          <Logo variant="icon" height={36} />
        </span>
        <span className="max-sm:hidden">
          <Logo height={30} />
        </span>
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="sr-only">Pixmora Studio</h1>
        <JobSummary />
        <div className="hidden max-w-52 md:block lg:hidden">
          <Segmented<SidePane>
            label="Side panel"
            value={sidePane}
            options={[
              { value: "photos", label: "Photos" },
              { value: "settings", label: "Settings" },
            ]}
            onChange={onSidePane}
          />
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <div className="flex items-center gap-0.5 max-md:hidden">
          <HistoryButtons />
        </div>
        {guideAvailable ? (
          <IconButton label="Take the tour" onClick={onGuide}>
            <MousePointer2 aria-hidden className="size-4" />
          </IconButton>
        ) : null}
        <div className="flex items-center gap-0.5 max-sm:hidden">
          <IconButton label="Keyboard shortcuts" data-guide="shortcuts" onClick={onShortcuts}>
            <Keyboard aria-hidden className="size-4" />
          </IconButton>
          <Link
            href="/help"
            target="_blank"
            aria-label="Print guide"
            title="Print guide"
            className="inline-flex size-8 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-page max-md:size-11 coarse:size-11"
          >
            <CircleHelp aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
      <ExportActions />
    </header>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-page p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Logo variant="stacked" height={128} />
        <h2 className="mt-6 text-xl font-semibold tracking-tight">Add your first photo</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Drop JPG, PNG or WebP files here. They stay in this browser and are never uploaded.
        </p>
        <div className="mt-6 w-48">
          <AddPhotoButton variant="primary" />
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const [tab, setTab] = useState<RightTab>("photo");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3" data-guide="settings">
        <Segmented<RightTab>
          label="Settings section"
          value={tab}
          options={[
            { value: "photo", label: "Photo" },
            { value: "print", label: "Print setup" },
          ]}
          onChange={setTab}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "photo" ? <PhotoPanel /> : <PrintSetupPanel />}
      </div>
    </div>
  );
}

function Center() {
  const hasPhotos = useStudio((state) => state.groups.length > 0);
  const view = useStudio((state) => state.view);
  if (!hasPhotos) return <EmptyState />;
  return view === "crop" ? <CropEditor /> : <SheetPreview />;
}

function selectNeighbour(step: number) {
  const { groups, selectedGroupId, select } = useStudio.getState();
  if (groups.length === 0) return;
  const index = groups.findIndex((g) => g.id === selectedGroupId);
  const next = (index + step + groups.length) % groups.length;
  select(groups[next].id);
}

function toggleCrop() {
  const { groups, view, setView } = useStudio.getState();
  if (groups.length > 0) setView(view === "crop" ? "sheets" : "crop");
}

function leaveCrop() {
  const { view, setView } = useStudio.getState();
  if (view === "crop") setView("sheets");
}

function duplicateSelected() {
  const { selectedGroupId, duplicateGroup } = useStudio.getState();
  if (selectedGroupId) duplicateGroup(selectedGroupId);
}

export function StudioWorkspace() {
  const hasPhotos = useStudio((state) => state.groups.length > 0);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const addPhotos = useAddPhotos();
  const [pane, setPane] = useState<Pane>("sheet");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [guiding, setGuiding] = useState(false);

  useEffect(() => {
    void useStudio.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!hasPhotos) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPhotos]);

  // The crop view lives in the sheet pane, so opening it from another pane moves there.
  useEffect(
    () =>
      useStudio.subscribe((state, previous) => {
        if (state.cropRequests !== previous.cropRequests) setPane("sheet");
      }),
    [],
  );

  useShortcuts({
    "mod+z": undo,
    "mod+shift+z": redo,
    "mod+y": redo,
    "mod+d": duplicateSelected,
    "[": () => selectNeighbour(-1),
    "]": () => selectNeighbour(1),
    c: toggleCrop,
    escape: leaveCrop,
    "?": () => setShortcutsOpen(true),
    "mod+/": () => setShortcutsOpen(true),
  });

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void addPhotos([...event.dataTransfer.files]);
  };

  // Phones show one pane. Tablets keep the sheet beside one panel. Desktops show all three.
  const photosPane = pane === "photos" ? "flex" : "hidden lg:flex";
  const sheetPane = pane === "sheet" ? "flex" : "hidden md:flex";
  const settingsPane = {
    settings: "flex",
    sheet: "hidden md:flex",
    photos: "hidden lg:flex",
  }[pane];

  return (
    <div
      className="flex h-dvh flex-col bg-page"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <TopBar
        sidePane={pane === "photos" ? "photos" : "settings"}
        onSidePane={setPane}
        onShortcuts={() => setShortcutsOpen(true)}
        onGuide={() => setGuiding(true)}
      />
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Photo queue"
          className={`${photosPane} w-full shrink-0 flex-col border-line bg-panel md:order-last md:w-72 md:border-l lg:order-first lg:w-64 lg:border-r lg:border-l-0 xl:w-68`}
        >
          <PhotoQueue />
        </aside>
        <main data-guide="sheet" className={`${sheetPane} min-w-0 flex-1 flex-col`}>
          <div className="min-h-0 w-full flex-1">
            <Center />
          </div>
        </main>
        <aside
          aria-label="Photo and print settings"
          className={`${settingsPane} w-full shrink-0 flex-col border-line bg-panel md:order-last md:w-72 md:border-l xl:w-75`}
        >
          <SettingsPanel />
        </aside>
      </div>
      <nav
        aria-label="Studio sections"
        className="flex items-center gap-1 border-t border-line bg-panel p-2 short:py-0.5 md:hidden"
      >
        <div className="min-w-0 flex-1">
          <Segmented<Pane>
            label="Studio section"
            value={pane}
            options={[
              { value: "photos", label: "Photos" },
              { value: "sheet", label: "Sheet" },
              { value: "settings", label: "Settings" },
            ]}
            onChange={setPane}
          />
        </div>
        <HistoryButtons />
      </nav>
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <GuideCursor
        running={guiding}
        onRunningChange={setGuiding}
        pane={pane}
        onPaneChange={setPane}
      />
      <Toaster position="top-center" toastOptions={{ className: "text-[13px]" }} />
    </div>
  );
}
