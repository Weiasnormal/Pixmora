import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { FeedbackLink } from "@/features/feedback/FeedbackDialog";

export const FOOTER_LINKS = [
  { href: "/sizes", label: "Photo sizes" },
  { href: "/help", label: "Print guide" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
];

export function FooterLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Site" className={`flex flex-wrap gap-x-5 gap-y-2 ${className}`}>
      {FOOTER_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="transition-colors duration-150 hover:text-ink">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Header, centred reading column and footer shared by the guide and info pages. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Pixmora home">
          <Logo height={40} />
        </Link>
        <Link
          href="/studio"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-ink transition-colors duration-150 ease-out hover:bg-primary-hover"
        >
          Open Studio
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-20 sm:px-8">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-[13px] text-muted sm:px-8">
          <FooterLinks />
          <span>
            Ideas or problems? <FeedbackLink />
          </span>
        </div>
      </footer>
    </div>
  );
}
