import Link from "next/link";
import type { ReactNode } from "react";

type Page = "search" | "how";

const links: Array<{ page: Page; href: string; label: string }> = [
  { page: "search", href: "/", label: "ค้นหางาน" },
  { page: "how", href: "/how-it-works", label: "ระบบทำงานยังไง" },
];

/**
 * Sticky top bar shared by every page. `children` goes on the right (e.g. the data-source toggle).
 * Below lg it collapses to a single 56px app bar (see `.app-bar` in globals.css); the nav becomes
 * one icon button that jumps to the other page.
 */
export function SiteHeader({ active, children }: { active: Page; children?: ReactNode }) {
  const other = links.find((link) => link.page !== active) ?? links[0];

  return (
    <header className="app-bar bg-topbar sticky top-0 z-30 text-white shadow-[0_8px_24px_-16px_rgb(16_22_45/0.6)]">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2.5 px-4 sm:px-6 lg:h-auto lg:flex-wrap lg:gap-x-5 lg:gap-y-2 lg:py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 lg:gap-3">
          <span className="bg-brand font-display grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-bold text-white shadow-[0_6px_16px_-6px_rgb(91_110_246/0.9)] ring-1 ring-white/20 lg:h-10 lg:w-10 lg:text-lg" aria-hidden="true">
            ว่าง
          </span>
          <span className="min-w-0">
            <span className="font-display block truncate text-base font-semibold leading-tight lg:hidden">หางานว่าง</span>
            <span className="font-display hidden text-lg font-semibold leading-tight lg:block">หางานพาร์ทไทม์ตามเวลาว่าง</span>
            <span className="hidden text-sm text-white/70 lg:block">AI Agent หางานที่ไม่ชนคาบเรียน สำหรับนักศึกษา</span>
          </span>
        </Link>

        <nav aria-label="เมนูหลัก" className="hidden gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.page}
              href={link.href}
              aria-current={active === link.page ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                active === link.page ? "bg-white/15 text-white ring-1 ring-white/15" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {children}
          <Link
            href={other.href}
            aria-label={other.label}
            title={other.label}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition active:bg-white/20 lg:hidden"
          >
            {other.page === "how" ? (
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
              </svg>
            ) : (
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
