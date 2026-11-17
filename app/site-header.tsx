import Link from "next/link";
import type { ReactNode } from "react";

type Page = "search" | "how";

const links: Array<{ page: Page; href: string; label: string }> = [
  { page: "search", href: "/", label: "ค้นหางาน" },
  { page: "how", href: "/how-it-works", label: "ระบบทำงานยังไง" },
];

/** Sticky top bar shared by every page. `children` goes on the right (e.g. the data-source toggle). */
export function SiteHeader({ active, children }: { active: Page; children?: ReactNode }) {
  return (
    <header className="bg-topbar sticky top-0 z-30 text-white shadow-[0_8px_24px_-16px_rgb(16_22_45/0.6)]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6 sm:py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="bg-brand font-display grid h-10 w-10 place-items-center rounded-xl text-lg font-bold text-white shadow-[0_6px_16px_-6px_rgb(91_110_246/0.9)] ring-1 ring-white/20" aria-hidden="true">
            ว่าง
          </span>
          <span>
            <span className="font-display block text-lg font-semibold leading-tight">หางานพาร์ทไทม์ตามเวลาว่าง</span>
            <span className="hidden text-sm text-white/70 sm:block">AI Agent หางานที่ไม่ชนคาบเรียน สำหรับนักศึกษา</span>
          </span>
        </Link>
        <nav aria-label="เมนูหลัก" className="flex gap-1">
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
        {children ? <div className="ml-auto">{children}</div> : null}
      </div>
    </header>
  );
}
