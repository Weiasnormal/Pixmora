"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

// The tour is pure motion, so reduced motion skips it.
const CAPABLE = "(prefers-reduced-motion: no-preference)";
const SEEN_KEY = "pixmora-guide-seen";
const EDGE = 16;

export type GuidePane = "photos" | "sheet" | "settings";

type Point = { x: number; y: number };
type Anchor = "right" | "below" | "center";
type Step = {
  target?: string;
  at?: Anchor;
  /** Small screens hide panes, so a step opens the one holding its target. */
  pane?: GuidePane;
  /** Media query the step needs. */
  when?: string;
  text: string;
};

// In order. A step is skipped when its target is not on screen.
const STEPS: Step[] = [
  {
    target: '[data-guide="add-photos"]',
    pane: "photos",
    at: "below",
    text: "Start here. Add your photos. They stay in this browser and are never uploaded.",
  },
  {
    target: '[data-guide="sheet"]',
    pane: "sheet",
    at: "center",
    text: "Your sheet fills up here. Every print packs in at its exact size, and you can drag prints around.",
  },
  {
    target: '[data-guide="settings"] [role="radio"]:first-child',
    pane: "settings",
    at: "below",
    text: "Each photo keeps its own package, crop and colours here.",
  },
  {
    target: '[data-guide="settings"] [role="radio"]:last-child',
    pane: "settings",
    at: "below",
    text: "Paper size, gaps and borderless printing are set here.",
  },
  {
    target: '[data-guide="export"]',
    at: "below",
    text: "When the sheet looks right, print it or export a PDF or PNG.",
  },
  {
    target: '[data-guide="shortcuts"]',
    when: "(pointer: fine)",
    at: "below",
    text: "Keyboard shortcuts are here, with the print guide beside them.",
  },
  { pane: "sheet", text: "That's the tour. Happy printing!" },
];

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the tour just greets them again next visit.
  }
}

export function useGuideAvailable() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(CAPABLE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(CAPABLE).matches,
    () => false,
  );
}

const between = (min: number, max: number) => min + Math.random() * (max - min);

function runTour(
  parts: {
    root: HTMLElement;
    bubble: HTMLElement;
    typed: HTMLElement;
    rest: HTMLElement;
    live: HTMLElement;
    showPane: (pane: GuidePane) => void;
  },
  signal: AbortSignal,
) {
  const { root, bubble, typed, rest, live, showPane } = parts;
  // `goal` is where the hand is heading; `shown` follows it on a spring, so nothing ever snaps.
  const goal: Point = { x: window.innerWidth * 0.62, y: window.innerHeight * 0.5 };
  const shown = { ...goal, vx: 0, vy: 0 };
  const STIFFNESS = 170;
  const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.85;
  let clock = 0;
  let last = performance.now();
  let frame = 0;
  let stroke: {
    from: Point;
    to: () => Point;
    bow: number;
    at: number;
    length: number;
    done: () => void;
  } | null = null;
  let resting: (() => Point) | null = null;
  let timers: { at: number; done: () => void }[] = [];

  const tick = (now: number) => {
    const dt = Math.min(now - last, 50);
    last = now;
    clock += dt;

    if (stroke) {
      const p = Math.min((clock - stroke.at) / stroke.length, 1);
      const eased = p * p * p * (p * (p * 6 - 15) + 10); // minimum jerk, the curve of a real hand reaching
      const to = stroke.to();
      const dx = to.x - stroke.from.x;
      const dy = to.y - stroke.from.y;
      const size = Math.hypot(dx, dy) || 1;
      const arc = Math.sin(Math.PI * eased) * stroke.bow;
      goal.x = stroke.from.x + dx * eased - (dy / size) * arc;
      goal.y = stroke.from.y + dy * eased + (dx / size) * arc;
      if (p === 1) {
        const { done, to: settle } = stroke;
        resting = settle;
        stroke = null;
        done();
      }
    } else if (resting) {
      Object.assign(goal, resting()); // follows the target if the layout shifts mid-sentence
    }

    const seconds = dt / 1000;
    shown.vx += (STIFFNESS * (goal.x - shown.x) - DAMPING * shown.vx) * seconds;
    shown.vy += (STIFFNESS * (goal.y - shown.y) - DAMPING * shown.vy) * seconds;
    shown.x += shown.vx * seconds;
    shown.y += shown.vy * seconds;
    const driftX = Math.sin(clock / 760) * 1.3;
    const driftY = Math.cos(clock / 940) * 1.1;
    root.style.transform = `translate3d(${(shown.x + driftX).toFixed(1)}px,${(shown.y + driftY).toFixed(1)}px,0)`;

    timers = timers.filter((timer) => {
      if (timer.at > clock) return true;
      timer.done();
      return false;
    });
    frame = requestAnimationFrame(tick);
  };

  // Runs on the frame clock, so a backgrounded tab pauses the tour instead of skipping ahead.
  const sleep = (ms: number) =>
    new Promise<void>((done) => timers.push({ at: clock + ms, done }));
  const reach = (to: () => Point) =>
    new Promise<void>((done) => {
      const target = to();
      const distance = Math.hypot(target.x - goal.x, target.y - goal.y);
      stroke = {
        from: { ...goal },
        to,
        bow: Math.min(distance * between(0.06, 0.2), 54) * (Math.random() < 0.5 ? -1 : 1),
        at: clock,
        length: Math.min(Math.max(240 + Math.sqrt(distance) * 24, 340), 1050),
        done,
      };
    });

  const anchorOf = (element: Element, at: Anchor = "right") => () => {
    const box = element.getBoundingClientRect();
    if (at === "center") return { x: box.left + box.width / 2, y: box.top + box.height * 0.4 };
    if (at === "below") return { x: box.left + box.width / 2, y: box.bottom + 3 };
    return { x: box.right + 6, y: box.top + box.height / 2 };
  };

  // Keep the bubble inside the viewport, however close to an edge the target sits.
  function placeBubble() {
    const fits = Math.min(goal.x + 14, window.innerWidth - bubble.offsetWidth - EDGE);
    const left = Math.max(fits, EDGE) - goal.x;
    bubble.style.left = `${left}px`;
    bubble.classList.toggle("flip-x", left < 14);
    bubble.classList.toggle("flip-y", goal.y + bubble.offsetHeight + 40 > window.innerHeight);
  }

  async function say(text: string) {
    const letters = Array.from(text);
    live.textContent = text;
    typed.textContent = "";
    rest.textContent = text; // reserves the final size, so words never jump lines while typing
    bubble.classList.add("is-open");
    placeBubble();
    for (let index = 0; index < letters.length; index++) {
      if (signal.aborted) return;
      typed.textContent = letters.slice(0, index + 1).join("");
      rest.textContent = letters.slice(index + 1).join("");
      await sleep(/[.,!?]/.test(letters[index]) ? between(120, 220) : between(18, 42));
    }
    await sleep(1000 + letters.length * 16);
    bubble.classList.remove("is-open");
  }

  const onScreen = (element: Element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.top >= 0 && box.bottom <= window.innerHeight;
  };

  const finished = (async () => {
    root.style.transform = `translate3d(${shown.x}px,${shown.y}px,0)`;
    await sleep(120);
    root.classList.add("is-on");
    let lit: Element | null = null;
    for (const step of STEPS) {
      if (signal.aborted) break;
      if (step.when && !window.matchMedia(step.when).matches) continue;
      if (step.pane) {
        showPane(step.pane);
        await sleep(80); // lets the pane render before its target is measured
        if (signal.aborted) break;
      }
      const element = step.target ? document.querySelector(step.target) : null;
      if (step.target && (!element || !onScreen(element))) continue;
      lit?.removeAttribute("data-guide-on");
      lit = null;
      if (element) {
        await reach(anchorOf(element, step.at));
        element.setAttribute("data-guide-on", "");
        lit = element;
      } else {
        const main = document.querySelector("main")?.getBoundingClientRect();
        const open = {
          x: main ? main.left + main.width * 0.4 : window.innerWidth * 0.45,
          y: window.innerHeight * 0.4,
        };
        await reach(() => open);
      }
      if (signal.aborted) break;
      await sleep(between(90, 180));
      await say(step.text);
    }
    lit?.removeAttribute("data-guide-on");
    root.classList.remove("is-on");
    await sleep(260);
  })();

  frame = requestAnimationFrame(tick);
  signal.addEventListener("abort", () => {
    // Release anything still waiting so the sequence above can unwind and clean up.
    stroke?.done();
    stroke = null;
    timers.forEach((timer) => timer.done());
    timers = [];
    document.querySelector("[data-guide-on]")?.removeAttribute("data-guide-on");
    bubble.classList.remove("is-open");
    root.classList.remove("is-on");
    live.textContent = "";
  });
  // After an abort the tick keeps resolving the last short sleeps; it stops once they're done.
  return finished.finally(() => cancelAnimationFrame(frame));
}

/** A scripted cursor that walks first-time users through the Studio, typing as it goes. */
export function GuideCursor({
  running,
  onRunningChange,
  pane,
  onPaneChange,
}: {
  running: boolean;
  onRunningChange: (running: boolean) => void;
  pane: GuidePane;
  onPaneChange: (pane: GuidePane) => void;
}) {
  const available = useGuideAvailable();
  const root = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const typed = useRef<HTMLSpanElement>(null);
  const rest = useRef<HTMLSpanElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const currentPane = useRef(pane);

  useEffect(() => {
    currentPane.current = pane;
  });

  // Greet once, a beat after the Studio settles. Returning users have the top bar button.
  useEffect(() => {
    if (!available) return;
    const timer = window.setTimeout(() => {
      if (read(SEEN_KEY) || document.querySelector("dialog[open]")) return;
      write(SEEN_KEY, "1");
      onRunningChange(true);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [available, onRunningChange]);

  useEffect(() => {
    if (!running || !available) return;
    if (!root.current || !bubble.current || !typed.current || !rest.current || !live.current) return;
    const controller = new AbortController();
    const startPane = currentPane.current;
    // Any real input ends the tour, so it never talks over someone working or behind a dialog.
    const stop = () => onRunningChange(false);
    document.addEventListener("pointerdown", stop, true);
    document.addEventListener("keydown", stop, true);
    void runTour(
      {
        root: root.current,
        bubble: bubble.current,
        typed: typed.current,
        rest: rest.current,
        live: live.current,
        showPane: onPaneChange,
      },
      controller.signal,
    ).then(() => {
      if (!controller.signal.aborted) onRunningChange(false);
    });
    return () => {
      document.removeEventListener("pointerdown", stop, true);
      document.removeEventListener("keydown", stop, true);
      controller.abort();
      onPaneChange(startPane);
    };
  }, [running, available, onRunningChange, onPaneChange]);

  if (!available) return null;

  return (
    <>
      <div ref={root} aria-hidden className="guide-cursor">
        <svg viewBox="0 0 24 24" className="guide-arrow">
          <path
            d="M4 3l6.6 17 2.5-7 7-2.5z"
            fill="var(--brand-primary)"
            stroke="var(--text-primary)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
        <div ref={bubble} className="guide-bubble">
          <b>Pixmora</b>
          <span>
            <span ref={typed} />
            <span ref={rest} className="invisible" />
          </span>
        </div>
      </div>
      <p ref={live} role="status" className="sr-only" />
      {running ? (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 max-md:bottom-20 short:bottom-14">
          <Button size="sm" onClick={() => onRunningChange(false)}>
            Skip tour
            <kbd className="font-sans text-xs text-muted coarse:hidden">Esc</kbd>
          </Button>
        </div>
      ) : null}
    </>
  );
}
