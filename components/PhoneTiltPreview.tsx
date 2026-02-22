"use client";

import { useEffect, useMemo, useRef } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type PhoneTiltVariant = "default" | "cinematic";

const VARIANT_TUNING: Record<PhoneTiltVariant, { maxDeg: number; deadzoneDeg: number; smoothing: number; parallax: number }> = {
  default: { maxDeg: 20, deadzoneDeg: 1.5, smoothing: 0.04, parallax: 1.0 },
  cinematic: { maxDeg: 18, deadzoneDeg: 0.35, smoothing: 0.22, parallax: 1.35 }
};

type PhoneTiltPreviewProps = {
  beta: number;
  gamma: number;
  reduceMotion?: boolean;
  variant?: PhoneTiltVariant;
  showBadge?: boolean;
};

export default function PhoneTiltPreview({
  beta,
  gamma,
  reduceMotion = false,
  variant = "default",
  showBadge = true
}: PhoneTiltPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);

  // Capture baseline on entry (Step 1 mount) so tilt is relative even if phone isn't flat.
  const baselineRef = useRef<{ beta: number; gamma: number } | null>(null);

  const latest = useRef({ beta: 0, gamma: 0 });
  const smoothed = useRef({ beta: 0, gamma: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    latest.current = { beta, gamma };
  }, [beta, gamma]);

  useEffect(() => {
    if (baselineRef.current) return;
    baselineRef.current = { beta, gamma };
    smoothed.current = { beta: 0, gamma: 0 };
  }, [beta, gamma]);

  useEffect(() => {
    const root = rootRef.current;
    const phone = phoneRef.current;
    const bg = bgRef.current;
    if (!root || !phone || !bg) return;

    const tune = VARIANT_TUNING[variant];

    if (reduceMotion) {
      phone.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
      root.style.boxShadow = "0 22px 70px rgba(0,0,0,0.55), 0 0 70px rgba(34,211,238,0.10)";
      bg.style.transform = "translate3d(0px, 0px, 0)";
      return;
    }

    let last = 0;
    const tick = (t: number) => {
      rafRef.current = window.requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      last = t;

      const base = baselineRef.current ?? { beta: 0, gamma: 0 };
      const relBeta = latest.current.beta - base.beta;
      const relGamma = latest.current.gamma - base.gamma;

      const targetBeta = clamp(relBeta, -tune.maxDeg, tune.maxDeg);
      const targetGamma = clamp(relGamma, -tune.maxDeg, tune.maxDeg);

      const db = targetBeta - smoothed.current.beta;
      const dg = targetGamma - smoothed.current.gamma;

      // Deadzone: ignore micro changes to reduce jitter.
      const nextBeta = Math.abs(db) < tune.deadzoneDeg ? smoothed.current.beta : smoothed.current.beta + db * tune.smoothing;
      const nextGamma = Math.abs(dg) < tune.deadzoneDeg ? smoothed.current.gamma : smoothed.current.gamma + dg * tune.smoothing;

      smoothed.current.beta = nextBeta;
      smoothed.current.gamma = nextGamma;

      const rx = -nextBeta;
      const ry = nextGamma;

      phone.style.transformOrigin = "center center";
      phone.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;

      const mag = Math.sqrt(rx * rx + ry * ry);
      const mag01 = clamp(mag / 28, 0, 1);

      const glow = variant === "cinematic" ? 0.20 + mag01 * 0.34 : 0.10 + mag01 * 0.22;
      const shadowX = clamp(ry * 0.55, -14, 14);
      const shadowY = 18 + clamp(rx * 0.35, -10, 10);
      const blur = 62 + mag01 * 54;

      root.style.boxShadow = `${shadowX}px ${shadowY}px ${blur}px rgba(0,0,0,0.62), 0 0 110px rgba(34,211,238,${glow}), 0 0 0 1px rgba(255,255,255,0.10) inset`;

      const px = clamp(-ry * 0.6 * tune.parallax, -18, 18);
      const py = clamp(-rx * 0.5 * tune.parallax, -16, 16);
      bg.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [reduceMotion, variant]);

  const baseShadow = useMemo(() => "0 22px 70px rgba(0,0,0,0.55), 0 0 70px rgba(34,211,238,0.10)", []);

  return (
    <div
      ref={rootRef}
      className="relative mx-auto h-full w-full overflow-hidden rounded-[28px] ring-1 ring-white/10"
      style={{ boxShadow: baseShadow }}
    >
      <div ref={bgRef} className="absolute inset-0 will-change-transform">
        <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_50%_25%,rgba(34,211,238,0.22)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,0)_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_65%_65%,rgba(52,211,153,0.14)_0%,rgba(0,0,0,0)_58%)] opacity-80" />
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 35%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.48) 70%, rgba(0,0,0,0.82) 100%)"
        }}
        aria-hidden="true"
      />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          ref={phoneRef}
          className={[
            "relative select-none",
            variant === "cinematic" ? "w-[82%] max-w-[310px]" : "w-[72%] max-w-[260px]"
          ].join(" ")}
          style={{
            aspectRatio: "9 / 19.5",
            transformStyle: "preserve-3d",
            transformOrigin: "center center",
            willChange: "transform"
          }}
        >
          <div className="absolute inset-0 rounded-[34px] bg-gradient-to-b from-white/14 to-white/[0.03] ring-1 ring-white/20" />
          <div
            className="pointer-events-none absolute inset-0 rounded-[34px]"
            style={{
              boxShadow: "0 0 0 1px rgba(34,211,238,0.28) inset, 0 0 48px rgba(34,211,238,0.14)"
            }}
            aria-hidden="true"
          />

          <div className="absolute inset-[10px] overflow-hidden rounded-[26px] bg-black/70 ring-1 ring-white/12">
            <div className="absolute -inset-10 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.46)_0%,rgba(99,102,241,0.16)_35%,rgba(0,0,0,1)_72%)]" />
            <div className="absolute -inset-10 bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.18)_0%,rgba(0,0,0,0)_55%)] opacity-70" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(255,255,255,0.0))] opacity-40" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0)_2px)] opacity-[0.10]" />

            {showBadge ? (
              <div className="absolute left-4 top-4 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/12">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/70">MOTION</p>
              </div>
            ) : null}
          </div>

          <div className="absolute left-1/2 top-[14px] h-2.5 w-16 -translate-x-1/2 rounded-full bg-white/10 ring-1 ring-white/10" />
          <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.03)_44%,rgba(255,255,255,0)_72%)]" />
        </div>
      </div>
    </div>
  );
}

