"use client";

import { useEffect, useMemo, useRef } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type PhoneTiltPreviewProps = {
  beta: number;
  gamma: number;
  baselineBeta?: number;
  baselineGamma?: number;
  reduceMotion?: boolean;
};

export default function PhoneTiltPreview({
  beta,
  gamma,
  baselineBeta,
  baselineGamma,
  reduceMotion = false
}: PhoneTiltPreviewProps) {
  const internalBaselineRef = useRef<{ beta: number; gamma: number } | null>(null);

  useEffect(() => {
    if (baselineBeta !== undefined && baselineGamma !== undefined) return;
    if (internalBaselineRef.current) return;
    internalBaselineRef.current = { beta, gamma };
  }, [baselineBeta, baselineGamma, beta, gamma]);

  const base = useMemo(() => {
    if (baselineBeta !== undefined && baselineGamma !== undefined) return { beta: baselineBeta, gamma: baselineGamma };
    return internalBaselineRef.current ?? { beta, gamma };
  }, [baselineBeta, baselineGamma, beta, gamma]);

  const relativeBeta = beta - base.beta;
  const relativeGamma = gamma - base.gamma;

  const rx = reduceMotion ? 0 : clamp(relativeBeta * 3.2, -60, 60);
  const ry = reduceMotion ? 0 : clamp(relativeGamma * 3.2, -60, 60);

  const mag = Math.sqrt(rx * rx + ry * ry);
  const mag01 = clamp(mag / 75, 0, 1);

  const edgeGlow = 0.14 + mag01 * 0.34;
  const glowBlur = 42 + mag01 * 46;
  const shadowBlur = 70 + mag01 * 64;
  const shadowY = 20 + mag01 * 10;

  const bgShiftX = clamp(ry / 6, -12, 12);
  const bgShiftY = clamp(rx / 7, -10, 10);

  const phoneTransform = `perspective(1400px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  const baseShadow = `0 ${shadowY}px ${shadowBlur}px rgba(0,0,0,0.65), 0 0 ${glowBlur}px rgba(56,189,248,${edgeGlow})`;

  return (
    <div className="relative mx-auto flex h-[56dvh] w-full items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${bgShiftX}px, ${bgShiftY}px, 0)`,
          transition: "none"
        }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_50%_30%,rgba(56,189,248,0.22)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,0)_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_65%_60%,rgba(16,185,129,0.16)_0%,rgba(0,0,0,0)_58%)]" />
      </div>

      <div
        className="relative w-[75vw] max-w-[480px] select-none"
        style={{
          aspectRatio: "9 / 19.5",
          transform: phoneTransform,
          transformStyle: "preserve-3d",
          boxShadow: baseShadow,
          borderRadius: 34,
          transition: "none",
          willChange: "transform, box-shadow"
        }}
      >
        <div className="absolute inset-0 rounded-[34px] bg-gradient-to-b from-white/14 to-white/[0.03] ring-1 ring-white/20" />

        <div className="absolute inset-[10px] overflow-hidden rounded-[26px] bg-black/70 ring-1 ring-white/12">
          <div
            className="absolute -inset-12"
            style={{
              transform: `translate3d(${-bgShiftX * 1.2}px, ${-bgShiftY * 1.2}px, 0)`,
              transition: "none",
              willChange: "transform"
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.42)_0%,rgba(99,102,241,0.16)_35%,rgba(0,0,0,1)_70%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.22)_0%,rgba(0,0,0,0)_55%)] opacity-80" />
          </div>

          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(255,255,255,0.0))] opacity-40" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0)_2px)] opacity-[0.10]" />

          <div className="absolute left-4 top-4 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/12">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-white/70">KINETIC</p>
          </div>
        </div>

        <div className="absolute left-1/2 top-[14px] h-2.5 w-16 -translate-x-1/2 rounded-full bg-white/10 ring-1 ring-white/10" />
        <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.03)_44%,rgba(255,255,255,0)_72%)]" />
      </div>
    </div>
  );
}

