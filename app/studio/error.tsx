"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";
import { SETTINGS_STORAGE_KEY } from "@/features/job/savedSettings";

/**
 * Shown when the Studio crashes, instead of a blank page. If trying again does not
 * help, the saved packages and print settings may be the cause, so they can be reset.
 */
export default function StudioError({ error, retry }: { error: unknown; retry: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const resetSettings = () => {
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Storage is blocked, so nothing was saved that could have caused this.
    }
    window.location.reload();
  };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-16">
      <Link href="/" aria-label="Pixmora home" className="self-start">
        <Logo height={40} />
      </Link>
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">The Studio stopped working</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Something went wrong while showing this job. Try again first. Photos you added in this
        visit may need to be added again.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => retry()}>
          Try again
        </Button>
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
      </div>

      <div className="mt-10 border-t border-line pt-6">
        <h2 className="font-semibold">Still not working?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Your saved packages or print settings may be damaged. Resetting them starts the Studio
          fresh, and you will set up your packages again.
        </p>
        {confirmReset ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" onClick={resetSettings}>
              Yes, delete my packages and settings
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Keep them
            </Button>
          </div>
        ) : (
          <Button className="mt-4" variant="danger" onClick={() => setConfirmReset(true)}>
            Reset saved settings
          </Button>
        )}
      </div>
    </main>
  );
}
