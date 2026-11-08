"use client";

import { useEffect, useRef } from "react";

/** Combos that still fire while a text field has focus. Everything else leaves typing alone. */
const WORKS_IN_FIELDS = new Set(["mod+s", "mod+shift+s", "mod+p", "mod+o", "mod+/"]);

function comboOf(event: KeyboardEvent): string | null {
  if (event.altKey || event.isComposing) return null;
  const key = event.key.toLowerCase();
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  // Shift is already part of symbols such as "?" and "+", which differ by keyboard layout.
  const shiftIsPartOfKey = key.length === 1 && !/[a-z]/.test(key);
  if (event.shiftKey && !shiftIsPartOfKey) parts.push("shift");
  parts.push(key);
  return parts.join("+");
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.matches("textarea, select")) return true;
  return target.matches('input:not([type="range"], [type="checkbox"], [type="radio"], [type="color"])');
}

/** Bindings are keyed by combo, for example "mod+shift+z", "delete" or "?". */
export function useShortcuts(bindings: Record<string, () => void>) {
  const latest = useRef(bindings);

  useEffect(() => {
    latest.current = bindings;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const combo = comboOf(event);
      const run = combo ? latest.current[combo] : undefined;
      if (!combo || !run) return;
      if (isTyping(event.target) && !WORKS_IN_FIELDS.has(combo)) return;
      // An open dialog owns the keyboard, so nothing changes behind it.
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      if (!event.repeat) run();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export type ShortcutEntry = { label: string; keys: string[][] };

/** Listed in the overlay. "mod" shows as Ctrl or Cmd depending on the keyboard. */
export const SHORTCUT_GROUPS: { title: string; entries: ShortcutEntry[] }[] = [
  {
    title: "Photos",
    entries: [
      { label: "Add photos", keys: [["mod", "O"]] },
      { label: "Previous or next photo", keys: [["["], ["]"]] },
      { label: "Duplicate photo", keys: [["mod", "D"]] },
      { label: "Remove photo", keys: [["Delete"], ["Backspace"]] },
    ],
  },
  {
    title: "Editing",
    entries: [
      { label: "Undo", keys: [["mod", "Z"]] },
      { label: "Redo", keys: [["mod", "Shift", "Z"], ["mod", "Y"]] },
      { label: "Open or close crop", keys: [["C"]] },
      { label: "Leave crop", keys: [["Esc"]] },
      { label: "Rotate 90° right, in crop", keys: [["R"]] },
      { label: "Rotate 90° left, in crop", keys: [["Shift", "R"]] },
    ],
  },
  {
    title: "Sheet",
    entries: [
      { label: "Zoom in", keys: [["mod", "+"]] },
      { label: "Zoom out", keys: [["mod", "-"]] },
      { label: "Fit to screen", keys: [["mod", "0"]] },
      { label: "Previous or next sheet", keys: [["Page Up"], ["Page Down"]] },
      { label: "Move focused print 1 mm", keys: [["Arrows"]] },
      { label: "Move focused print 0.1 mm", keys: [["Shift", "Arrows"]] },
    ],
  },
  {
    title: "Export",
    entries: [
      { label: "Export PDF", keys: [["mod", "S"]] },
      { label: "Export PNG", keys: [["mod", "Shift", "S"]] },
      { label: "Print", keys: [["mod", "P"]] },
      { label: "Show these shortcuts", keys: [["?"], ["mod", "/"]] },
    ],
  },
];
