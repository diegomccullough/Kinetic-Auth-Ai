"use client";

import { useEffect, useMemo, useRef } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type PhoneTiltPreviewProps = {
  beta: number;
  gamma: number;
  /**
   * Scales degrees → visual rotation degrees.
   * Final transform uses rotateX(beta*factor) rotateY(gamma*factor).
   */
  factor?: number;
  reduceMotion?: boolean;
};

export default function PhoneTiltPreview({ beta, gamma, factor = 0.38, reduceMotion = false }: PhoneTiltPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const screenBgRef = useRef<HTMLDivElement | null>(null);

  const latest = useRef({ beta: 0, gamma: 0 });
  const smoothed = useRef({ beta: 0, gamma: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    latest.current = { beta, gamma };
  }, [beta, gamma]);

  const baseShadow = useMemo(() => {
    // Static shadow that looks good in absence of motion.
    return "0 22px 70px rgba(0,0,0,0.65), 0 0 60px rgba(56,189,248,0.10)";
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const phone = phoneRef.current;
    const screenBg = screenBgRef.current;
    if (!root || !phone || !screenBg) return;

    if (reduceMotion) {
      root.style.boxShadow = baseShadow;
      phone.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
      screenBg.style.transform = "translate3d(0px, 0px, 0) scale(1.04)";
      return;
    }

    let last = 0;
    const tick = (t: number) => {
      rafRef.current = window.requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      last = t;

      const targetBeta = clamp(latest.current.beta, -90, 90);
      const targetGamma = clamp(latest.current.gamma, -90, 90);

      // Smooth interpolation (avoid jitter).
      smoothed.current.beta = smoothed.current.beta + (targetBeta - smoothed.current.beta) * 0.08;
      smoothed.current.gamma = smoothed.current.gamma + (targetGamma - smoothed.current.gamma) * 0.08;

      const b = smoothed.current.beta;
      const g = smoothed.current.gamma;

      const rx = clamp(b * factor, -18, 18);
      const ry = clamp(g * factor, -22, 22);

      // Parallax offsets for inner screen layers.
      const px = clamp(-g * 0.55, -18, 18);
      const py = clamp(-b * 0.35, -14, 14);

      const lift = 8;
      phone.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${lift}px)`;

      // Dynamic shadow: reacts to tilt.
      const sx = clamp(ry * 0.9, -18, 18);
      const sy = clamp(rx * 1.1, -18, 18);
      const blur = 64 + Math.min(34, Math.abs(rx) + Math.abs(ry)) * 0.9;
      const glow = 0.12 + Math.min(0.18, (Math.abs(rx) + Math.abs(ry)) / 120);
      root.style.boxShadow = `${sx}px ${18 + sy}px ${blur}px rgba(0,0,0,0.55), 0 0 70px rgba(56,189,248,${glow})`;

      // Background parallax for polish.
      screenBg.style.transform = `translate3d(${px}px, ${py}px, 0) scale(1.08)`;
    };

    root.style.boxShadow = baseShadow;
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [baseShadow, factor, reduceMotion]);

  return (
    <div ref={rootRef} className="relative mx-auto h-[260px] w-[260px] rounded-[34px]">
      <div className="absolute inset-0 rounded-[34px] bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.10)_0%,rgba(0,0,0,0)_62%)] blur-2xl" />

      <div className="absolute inset-0 grid place-items-center">
        <div
          ref={phoneRef}
          className="relative h-[230px] w-[132px] rounded-[28px] bg-gradient-to-b from-white/10 to-white/[0.02] ring-1 ring-white/15"
          style={{ transformStyle: "preserve-3d", willChange: "transform" }}
        >
          {/* Glass edge */}
          <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(120%_90%_at_50%_0%,rgba(56,189,248,0.16)_0%,rgba(99,102,241,0.09)_34%,rgba(0,0,0,0)_70%)]" />

          {/* Screen well */}
          <div className="absolute inset-[10px] overflow-hidden rounded-[22px] bg-black/60 ring-1 ring-white/10">
            <div ref={screenBgRef} className="absolute inset-0 will-change-transform">
              <div className="absolute -inset-10 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.30)_0%,rgba(99,102,241,0.14)_30%,rgba(0,0,0,1)_68%)]" />
              <div className="absolute -inset-10 bg-[radial-gradient(circle_at_70%_65%,rgba(16,185,129,0.18)_0%,rgba(0,0,0,0)_55%)] opacity-70" />
            </div>

            {/* Subtle scanline/noise vibe */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0.0))] opacity-40" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0)_2px)] opacity-[0.08]" />

            {/* HUD chip */}
            <div className="absolute left-3 top-3 rounded-2xl bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold tracking-[0.20em] text-white/60">MOTION</p>
            </div>
            <div className="absolute bottom-4 left-1/2 h-9 w-[88px] -translate-x-1/2 rounded-2xl bg-white/[0.04] ring-1 ring-white/10" />
          </div>

          {/* Speaker notch */}
          <div className="absolute left-1/2 top-3 h-2 w-12 -translate-x-1/2 rounded-full bg-white/10 ring-1 ring-white/10" />

          {/* Glass highlight */}
          <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.02)_40%,rgba(255,255,255,0)_70%)]" />
        </div>
      </div>
    </div>
  );
}

