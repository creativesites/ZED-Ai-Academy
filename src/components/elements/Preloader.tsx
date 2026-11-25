import { BrandLogo } from "@/components/shared/brand-logo";
import { BRAND } from "@/lib/brand";

export default function Preloader() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-navy"
      role="status"
      aria-live="polite"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 15%, rgba(7,91,235,0.22), transparent 42%), " +
          "radial-gradient(circle at 85% 0%, rgba(101,0,245,0.16), transparent 36%)",
      }}
    >
      <div
        className="flex flex-col items-center gap-8"
        style={{ animation: "site-loader-fade-in 0.5s ease both" }}
      >
        {/* Emblem with pulse rings */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full border border-brand-electric/20"
            style={{ inset: -22, animation: "pulse-ring 2.2s cubic-bezier(0.215,0.61,0.355,1) 0.3s infinite" }}
          />
          <div
            className="absolute rounded-full border border-brand/30"
            style={{ inset: -10, animation: "pulse-ring 2.2s cubic-bezier(0.215,0.61,0.355,1) infinite" }}
          />
          <BrandLogo variant="emblemOnDark" priority className="relative h-[76px] w-auto" />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <p className="font-display text-sm font-extrabold tracking-[0.18em] text-white">{BRAND.name.toUpperCase()}</p>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-slate-400">{BRAND.tagline}</p>
          <span className="sr-only">Loading…</span>
        </div>

        {/* Indeterminate progress bar */}
        <div className="relative h-0.5 w-[140px] overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 w-[45%] rounded-full bg-gradient-cs"
            style={{ animation: "site-loader-bar 1.6s ease-in-out infinite" }}
          />
        </div>
      </div>
    </div>
  );
}
