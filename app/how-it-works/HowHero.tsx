"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* ---------- Scroll reveal ---------- */

/** Marks <html> so `.reveal` blocks start hidden only when JS runs (no-JS and reduced-motion users see everything). */
export function useRevealReady() {
  useEffect(() => {
    document.documentElement.classList.add("reveal-ready");
    return () => document.documentElement.classList.remove("reveal-ready");
  }, []);
}

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    const fallback = window.setTimeout(() => setVisible(true), 1200);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);
  return (
    <div ref={ref} className={`reveal min-w-0 ${visible ? "is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------- Count-up number ---------- */

function CountUp({ to, duration = 1400 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const length = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = length ? Math.min(1, (now - start) / length) : 1;
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);
  return <>{value}</>;
}

/* ---------- Hero ---------- */

// Fixed star positions (no Math.random) so server and client render the same markup.
const STARS = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 37.7) % 100}%`,
  top: `${(i * 53.3 + 11) % 100}%`,
  delay: `${(i % 9) * 0.37}s`,
  size: i % 5 === 0 ? 3 : 2,
}));

const FLOW = [
  { icon: "🎓", label: "นักศึกษา", sub: "งาน + ตารางเรียน", glow: "rgb(96 165 250 / 80%)" },
  { icon: "🖥️", label: "เว็บแอป", sub: "Next.js API", glow: "rgb(129 140 248 / 80%)" },
  { icon: "🧠", label: "ThaiLLM", sub: "วางแผน · อ่านประกาศ", glow: "rgb(192 132 252 / 85%)" },
  { icon: "🌐", label: "Google Jobs", sub: "ผ่าน SerpApi", glow: "rgb(52 211 153 / 80%)" },
  { icon: "🛡️", label: "โค้ดตรวจซ้ำ", sub: "ชนคาบ · งานหลอก", glow: "rgb(251 191 36 / 80%)" },
  { icon: "✨", label: "งานที่ใช่", sub: "จัดอันดับให้แล้ว", glow: "rgb(244 114 182 / 85%)" },
];

const STATS: Array<{ value: number; suffix?: string; label: string }> = [
  { value: 10, label: "ขั้นตอนตั้งแต่กดค้นหาจนได้งาน" },
  { value: 3, label: "โมเดล AI · ThaiLLM, DeepSeek, OpenThai OCR" },
  { value: 0, label: "API key ที่ส่งไปถึงเบราว์เซอร์" },
  { value: 60, suffix: " นาที", label: "เก็บผลค้นหาไว้ ไม่เปลืองโควตา" },
];

const PROMISES = [
  "ตรวจการชนคาบเรียนด้วยโค้ด ไม่ใช่ AI",
  "AI อ่านประกาศ แล้วโค้ดตรวจซ้ำ",
  "API key อยู่ที่เซิร์ฟเวอร์เท่านั้น",
  "ตารางเรียนไม่ถูกส่งออกนอกเครื่อง*",
];

export function HowHero() {
  return (
    <section className="hero-cosmic" aria-labelledby="how-title">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-orb left-[-8rem] top-[-8rem] h-[28rem] w-[28rem] [--orb:#4f6bff]" aria-hidden="true" />
      <div className="hero-orb right-[-8rem] top-0 h-[30rem] w-[30rem] [--orb:#a855f7] [animation-delay:-6s]" aria-hidden="true" />
      <div className="hero-orb bottom-[-10rem] left-1/3 h-[26rem] w-[34rem] opacity-40 [--orb:#22d3ee] [animation-delay:-11s]" aria-hidden="true" />
      {STARS.map((star, i) => (
        <span
          key={i}
          className="hero-star"
          style={{ left: star.left, top: star.top, width: star.size, height: star.size, animationDelay: star.delay }}
          aria-hidden="true"
        />
      ))}

      <div className="mx-auto max-w-[1560px] px-4 pb-14 pt-12 sm:px-6 lg:pb-20 lg:pt-20">
        <Reveal>
          <p className="glass-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white/85">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#4ade80] shadow-[0_0_10px_2px_rgb(74_222_128/0.7)]" />
            Behind the scenes · AI Agent Architecture
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h1 id="how-title" className="mt-5 max-w-5xl text-4xl font-bold leading-[1.15] sm:text-5xl lg:text-6xl">
            เบื้องหลัง <span className="text-aurora">AI Agent</span>
            <br className="hidden sm:block" /> ที่หางานให้ลงตัวกับตารางเรียน
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/75 sm:text-lg">
            ตั้งแต่ตอนกดค้นหา จนถึงตอนที่ AI ออกไปหาประกาศจากเว็บต่าง ๆ อ่านทีละประกาศ แล้วให้โค้ดตรวจซ้ำทุกคำตอบ
            ทั้งหมดอยู่ในหน้านี้ พร้อมบันทึกการค้นหาครั้งล่าสุดของคุณแบบทีละขั้น
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#diagram-title" className="btn-primary font-display rounded-2xl px-5 py-3 text-sm font-semibold sm:text-base">
              ดูแผนภาพระบบ ↓
            </a>
            <a href="#tracking-title" className="glass-dark rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 sm:text-base">
              ดูการค้นหาล่าสุดของฉัน
            </a>
          </div>
        </Reveal>

        {/* Mini data flow with light running along the connectors */}
        <Reveal delay={320}>
          <ol className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:items-center lg:gap-0" aria-label="ภาพรวมการไหลของข้อมูล">
            {FLOW.map((node, i) => (
              <li key={node.label} className="contents">
                <div
                  className="glass-dark node-glow rounded-2xl px-4 py-3 lg:min-w-0 lg:flex-1"
                  style={{ ["--node-glow" as string]: node.glow, ["--beam-delay" as string]: `${i * 0.35}s` }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl" aria-hidden="true">{node.icon}</span>
                    <div className="min-w-0">
                      <p className="font-display truncate text-sm font-semibold">{node.label}</p>
                      <p className="truncate text-[11px] text-white/60">{node.sub}</p>
                    </div>
                  </div>
                </div>
                {i < FLOW.length - 1 && (
                  <div className="beam hidden w-10 shrink-0 lg:block xl:w-14" style={{ ["--beam-delay" as string]: `${i * 0.35}s` }} aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={400}>
          <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="glass-dark rounded-2xl px-5 py-4">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-display text-4xl font-bold tabular-nums text-white sm:text-5xl">
                  <CountUp to={stat.value} />
                  {stat.suffix ? <span className="text-xl text-white/70 sm:text-2xl">{stat.suffix}</span> : null}
                </dd>
                <dd className="mt-1 text-xs leading-5 text-white/65 sm:text-sm">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={480}>
          <ul className="mt-6 flex flex-wrap gap-2 text-xs sm:text-sm">
            {PROMISES.map((promise) => (
              <li key={promise} className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white/85">
                <span className="text-[#4ade80]" aria-hidden="true">✓</span>
                {promise}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Chapter heading ---------- */

export function Chapter({ n, kicker, title, sub, id, right }: { n: string; kicker: string; title: string; sub: string; id: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-end gap-4">
        <span className="chapter-num text-6xl sm:text-7xl" aria-hidden="true">{n}</span>
        <div className="pb-1">
          <p className="text-brand text-xs font-bold uppercase tracking-[0.18em]">{kicker}</p>
          <h2 id={id} className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-muted sm:text-base">{sub}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

/* ---------- Timetable OCR pipeline ---------- */

const OCR_FLOW = [
  { icon: "📷", title: "รูปตารางเรียน", detail: "อัปโหลด ลากวาง หรือ Ctrl+V ภาพแคป · รูปอยู่ในหน่วยความจำ ไม่ถูกเก็บ", tone: "from-[#60a5fa] to-[#6366f1]" },
  { icon: "🔎", title: "OpenThai2.0-OCR", detail: "อ่านตัวอักษรไทย/อังกฤษบน CPU · ขยายภาพ 2 เท่า หาเส้นตาราง และป้ายสีประจำวัน", tone: "from-[#6366f1] to-[#a855f7]" },
  { icon: "🧠", title: "DeepSeek", detail: "อ่านข้อความพร้อมตำแหน่ง แปลงเป็น วัน · เวลาเริ่ม · เวลาจบ เป็น JSON", tone: "from-[#a855f7] to-[#ec4899]" },
  { icon: "🛡️", title: "โค้ดตรวจซ้ำ", detail: "วันต้องถูกต้อง เวลาต้องเป็น HH:MM และเริ่มก่อนจบ · ตัดช่วงที่ผิดทิ้ง", tone: "from-[#ec4899] to-[#f59e0b]" },
  { icon: "✅", title: "นักศึกษายืนยัน", detail: "ติ๊กเลือกช่วงที่ถูก แล้วกดใช้ · ตารางเดิมเปลี่ยนเมื่อกดยืนยันเท่านั้น", tone: "from-[#f59e0b] to-[#22c55e]" },
];

export function OcrPipeline() {
  return (
    <div className="panel-glow p-5 sm:p-8">
      <ol className="grid gap-4 md:grid-cols-5 md:gap-3">
        {OCR_FLOW.map((step, i) => (
          <li key={step.title} className="relative">
            <div className="group h-full rounded-2xl border border-line bg-sunken p-4 transition duration-300 hover:-translate-y-1 hover:bg-surface hover:shadow-[0_18px_40px_-20px_rgb(99_102_241/0.55)]">
              <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br ${step.tone} text-2xl shadow-lg transition duration-300 group-hover:scale-110 group-hover:rotate-3`} aria-hidden="true">
                {step.icon}
              </span>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-faint">ขั้นที่ {i + 1}</p>
              <h3 className="mt-0.5 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">{step.detail}</p>
            </div>
            {i < OCR_FLOW.length - 1 && (
              <span className="absolute -right-3 top-9 z-10 hidden h-6 w-6 place-items-center rounded-full bg-brand text-xs text-white shadow md:grid" aria-hidden="true">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
