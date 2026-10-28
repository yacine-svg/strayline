import { SITE } from "@/lib/site";

export function StatBadge() {
  return (
    <div className="pointer-events-none absolute right-8 bottom-8 z-20 hidden size-36 place-items-center md:grid lg:right-12">
      <svg viewBox="0 0 100 100" aria-hidden="true" className="stat-orbit absolute inset-0 size-full text-white">
        <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.8" strokeDasharray="1.5 3.5" />
        <circle cx="50" cy="50" r="48" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="22 280" style={{ stroke: "var(--accent)" }} />
      </svg>
      <p className="relative text-center">
        <span className="block font-display text-[1.75rem] leading-none font-black">{SITE.stat.value}</span>
        <span className="mt-2 block text-[10px] font-semibold tracking-[0.22em] text-white/75 uppercase">
          {SITE.stat.label}
        </span>
      </p>
    </div>
  );
}
