"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { CircleHelp, Redo2, Undo2 } from "lucide-react";
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

type RightTab = "photo" | "print";
type MobileTab = "photos" | "sheet" | "settings";

function JobSummary() {
  const layout = useLayout();
  const groups = useStudio((state) => state.groups.filter((g) => g.enabled).length);
  if (layout.totalItems === 0) return null;
  return (
    <p className="hidden truncate text-[13px] text-muted tabular-nums md:block" aria-live="polite">
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

function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 sm:px-4">
      <Link href="/" aria-label="Pixmora home" className="shrink-0">
        <Logo height={30} />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="sr-only">Pixmora Studio</h1>
        <JobSummary />
      </div>
      <div className="flex items-center gap-0.5 max-sm:hidden">
        <HistoryButtons />
        <Link
          href="/help"
          target="_blank"
          aria-label="Print guide"
          title="Print guide"
          className="inline-flex size-8 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-page"
        >
          <CircleHelp aria-hidden className="size-4" />
        </Link>
      </div>
      <ExportActions />
    </header>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-page p-6">
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
      <div className="border-b border-line p-3">
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

export function StudioWorkspace() {
  const hasPhotos = useStudio((state) => state.groups.length > 0);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const addPhotos = useAddPhotos();
  const [mobileTab, setMobileTab] = useState<MobileTab>("sheet");

  useEffect(() => {
    void useStudio.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!hasPhotos) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPhotos]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, select, textarea")) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void addPhotos([...event.dataTransfer.files]);
  };

  const panel = (tab: MobileTab) => (mobileTab === tab ? "max-md:flex" : "max-md:hidden");

  return (
    <div
      className="flex h-dvh flex-col bg-page"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <TopBar />
      <div className="md:hidden">
        <div className="flex items-center gap-1 border-b border-line bg-panel p-2">
          <div className="min-w-0 flex-1">
            <Segmented<MobileTab>
              label="Studio section"
              value={mobileTab}
              options={[
                { value: "photos", label: "Photos" },
                { value: "sheet", label: "Sheet" },
                { value: "settings", label: "Settings" },
              ]}
              onChange={setMobileTab}
            />
          </div>
          <HistoryButtons />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Photo queue"
          className={`${panel("photos")} w-full shrink-0 flex-col border-r border-line bg-panel md:flex md:w-68`}
        >
          <PhotoQueue />
        </aside>
        <main className={`${panel("sheet")} min-w-0 flex-1 flex-col md:flex`}>
          <div className="min-h-0 w-full flex-1">
            <Center />
          </div>
        </main>
        <aside
          aria-label="Photo and print settings"
          className={`${panel("settings")} w-full shrink-0 flex-col border-l border-line bg-panel md:flex md:w-75`}
        >
          <SettingsPanel />
        </aside>
      </div>
      <Toaster position="top-center" toastOptions={{ className: "text-[13px]" }} />
    </div>
  );
}
