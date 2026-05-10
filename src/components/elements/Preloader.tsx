export default function Preloader() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(253,85,35,0.22), transparent 40%), " +
          "radial-gradient(circle at 80% 0%, rgba(255,184,112,0.2), transparent 34%), " +
          "linear-gradient(180deg, rgba(6,46,57,1), rgba(8,56,70,1))",
      }}
    >
      {/* Animated content wrapper */}
      <div
        className="flex flex-col items-center gap-8"
        style={{ animation: "site-loader-fade-in 0.5s ease both" }}
      >
        {/* Logo mark with pulse rings */}
        <div className="relative flex items-center justify-center">
          {/* Outer pulse ring */}
          <div
            className="absolute rounded-[1.75rem] border border-[#fd5523]/20"
            style={{
              inset: -20,
              animation: "pulse-ring 2.2s cubic-bezier(0.215,0.61,0.355,1) 0.3s infinite",
            }}
          />
          {/* Inner pulse ring */}
          <div
            className="absolute rounded-[1.5rem] border border-[#fd5523]/30"
            style={{
              inset: -10,
              animation: "pulse-ring 2.2s cubic-bezier(0.215,0.61,0.355,1) infinite",
            }}
          />
          {/* Logo square */}
          <div
            className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[1.25rem]"
            style={{
              background: "rgba(253,85,35,0.1)",
              border: "1.5px solid rgba(253,85,35,0.35)",
              boxShadow: "0 0 40px rgba(253,85,35,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Subtle inner glow */}
            <div
              className="absolute inset-0 rounded-[1.25rem]"
              style={{
                background: "radial-gradient(circle at 40% 30%, rgba(253,85,35,0.2), transparent 70%)",
              }}
            />
            <span
              className="relative font-black text-[2.5rem] leading-none tracking-[-0.04em] text-[#fd5523]"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Z
            </span>
          </div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-1.5">
          <p
            className="text-[0.6rem] font-black uppercase tracking-[0.35em] text-white"
            style={{ letterSpacing: "0.35em" }}
          >
            ZED AI ACADEMY
          </p>
          <p
            className="text-[0.55rem] uppercase tracking-[0.2em]"
            style={{ color: "rgba(253,141,105,0.6)", letterSpacing: "0.2em" }}
          >
            Learn AI Skills That Matter
          </p>
        </div>

        {/* Indeterminate progress bar */}
        <div
          className="relative overflow-hidden rounded-full"
          style={{
            width: 140,
            height: 2,
            background: "rgba(255,255,255,0.07)",
          }}
        >
          <div
            className="absolute inset-y-0 w-[45%] rounded-full bg-[#fd5523]"
            style={{
              animation: "site-loader-bar 1.6s ease-in-out infinite",
              boxShadow: "0 0 8px rgba(253,85,35,0.6)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
