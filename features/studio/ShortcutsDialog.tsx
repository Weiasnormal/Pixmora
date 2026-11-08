"use client";

import { Modal, SectionTitle } from "@/components/ui";
import { SHORTCUT_GROUPS } from "./shortcuts";

function ShortcutList() {
  // Only rendered once the dialog opens, so this never runs on the server.
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd" : "Ctrl";

  return (
    <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <SectionTitle>{group.title}</SectionTitle>
          <dl className="flex flex-col gap-1.5">
            {group.entries.map((entry) => (
              <div key={entry.label} className="flex items-center justify-between gap-4">
                <dt className="min-w-0 text-[13px] text-muted">{entry.label}</dt>
                <dd className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  {entry.keys.map((combo, index) => (
                    <span key={combo.join("+")} className="flex items-center gap-1">
                      {index > 0 ? <span className="px-0.5 text-xs text-muted">or</span> : null}
                      {combo.map((key) => (
                        <kbd
                          key={key}
                          className="rounded-md border border-line bg-page px-1.5 py-0.5 font-sans text-xs text-ink"
                        >
                          {key === "mod" ? mod : key}
                        </kbd>
                      ))}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Keyboard shortcuts" onClose={onClose} wide>
      <ShortcutList />
    </Modal>
  );
}
