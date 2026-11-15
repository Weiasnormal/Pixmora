"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Play, X } from "lucide-react";

/** Phones get the 9:16 cut, everything wider gets the 16:9 cut. Matches the md breakpoint. */
const MOBILE_QUERY = "(max-width: 767px)";
const OPEN_EVENT = "pixmora:open-demo";

export const DEMO_VIDEO = {
  landscape: "/demo/pixmora-demo-landscape.mp4",
  portrait: "/demo/pixmora-demo-portrait.mp4",
  captions: "/demo/pixmora-demo-captions.vtt",
  previewLandscape: "/demo/pixmora-preview-landscape.mp4",
  previewPortrait: "/demo/pixmora-preview-portrait.mp4",
  posterLandscape: "/demo/pixmora-preview-landscape.jpg",
  posterPortrait: "/demo/pixmora-preview-portrait.jpg",
  durationSeconds: 59,
};

function isMobile(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** Opens the full demo with sound. Must run inside a click so browsers allow the audio. */
function openDemo() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function WatchDemoButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={openDemo} className={className} aria-haspopup="dialog">
      {children}
    </button>
  );
}

/**
 * A muted preview loop that plays while it is on screen, and a dialog with the
 * full 59-second demo and its sound. Nothing heavy loads until it is needed:
 * the preview waits until it scrolls into view, and the full video waits for a click.
 */
export function DemoVideo() {
  const previewRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);

  // Preview loop: pick the cut for this screen, and play only while visible.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduceMotion || saveData) return;

    const mobile = window.matchMedia(MOBILE_QUERY);
    let visible = false;
    const pickSource = () => {
      const src = mobile.matches ? DEMO_VIDEO.previewPortrait : DEMO_VIDEO.previewLandscape;
      if (preview.getAttribute("src") === src) return;
      preview.dataset.ready = "false";
      preview.src = src;
      if (visible) preview.play().catch(() => {});
    };
    const onPlaying = () => (preview.dataset.ready = "true");
    preview.addEventListener("playing", onPlaying);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          if (!preview.getAttribute("src")) pickSource();
          preview.play().catch(() => {});
        } else {
          preview.pause();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(preview);
    const onBreakpoint = () => {
      if (preview.getAttribute("src")) pickSource();
    };
    mobile.addEventListener("change", onBreakpoint);
    return () => {
      observer.disconnect();
      mobile.removeEventListener("change", onBreakpoint);
      preview.removeEventListener("playing", onPlaying);
    };
  }, []);

  // Full demo: open on request, stop the sound when the dialog closes.
  useEffect(() => {
    const dialog = dialogRef.current;
    const player = playerRef.current;
    if (!dialog || !player) return;

    const open = () => {
      const mobile = isMobile();
      const src = mobile ? DEMO_VIDEO.portrait : DEMO_VIDEO.landscape;
      if (player.getAttribute("src") !== src) {
        player.src = src;
        player.poster = mobile ? DEMO_VIDEO.posterPortrait : DEMO_VIDEO.posterLandscape;
      }
      // The portrait cut has captions burned in, so only the landscape cut shows the subtitle track.
      const track = player.textTracks[0];
      if (track) track.mode = mobile ? "disabled" : "showing";
      dialog.dataset.orientation = mobile ? "portrait" : "landscape";
      previewRef.current?.pause();
      if (!dialog.open) dialog.showModal();
      player.currentTime = 0;
      player.play().catch(() => {});
    };
    const onClose = () => {
      player.pause();
      const preview = previewRef.current;
      if (preview?.getAttribute("src")) preview.play().catch(() => {});
    };
    window.addEventListener(OPEN_EVENT, open);
    dialog.addEventListener("close", onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, open);
      dialog.removeEventListener("close", onClose);
    };
  }, []);

  // Stop the sound right away; the dialog's close event can arrive a moment later.
  const closeDialog = () => {
    playerRef.current?.pause();
    dialogRef.current?.close();
  };

  return (
    <>
      <button
        type="button"
        onClick={openDemo}
        aria-haspopup="dialog"
        aria-label="Play the 1-minute Pixmora demo with sound"
        className="demo-card"
      >
        <picture>
          <source media={MOBILE_QUERY} srcSet={DEMO_VIDEO.posterPortrait} />
          <img src={DEMO_VIDEO.posterLandscape} alt="" loading="lazy" decoding="async" />
        </picture>
        <video ref={previewRef} muted loop playsInline preload="none" aria-hidden tabIndex={-1} data-ready="false" />
        <span className="demo-badge">
          <span className="demo-play" aria-hidden>
            <Play className="size-4 fill-current" />
          </span>
          Watch the demo
          <span className="demo-length">0:59</span>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="demo-dialog"
        aria-label="Pixmora demo video"
        onClick={(event) => {
          // A click on the dark backdrop lands on the dialog itself.
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <video ref={playerRef} controls playsInline preload="none">
          <track kind="captions" src={DEMO_VIDEO.captions} srcLang="en" label="English" />
        </video>
        <button
          type="button"
          className="demo-close"
          aria-label="Close the demo"
          onClick={closeDialog}
        >
          <X className="size-5" aria-hidden />
        </button>
      </dialog>
    </>
  );
}
