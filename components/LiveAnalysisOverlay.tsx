"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export type SignalQuality = "strong" | "moderate" | "weak";

export type LiveAnalysisOverlayProps = {
  enabled: boolean;
  simulateBot: boolean;
  signalQuality: SignalQuality;
  baselinePulse: number; // increment to pulse "baseline recalibrated"
  noiseDetected: boolean;
};

function pickLines(input: {
  simulateBot: boolean;
  signalQuality: SignalQuality;
  baselineRecalibrated: boolean;
  noiseDetected: boolean;
  phase: number;
}) {
  if (input.simulateBot) {
    return ["Analyzing motion entropy…", "Motion pattern too linear.", "Automation signature detected."];
  }

  const base = "Analyzing motion entropy…";
  const quality = `Signal quality: ${input.signalQuality}`;
  const baseline = "Baseline recalibrated";
  const noise = "Human motor noise detected";

  // Keep it feeling “intelligent” by rotating the secondary lines based on conditions.
  const secondaryPool = [
    input.baselineRecalibrated ? baseline : quality,
    input.noiseDetected ? noise : quality,
    quality
  ];

  const a = secondaryPool[input.phase % secondaryPool.length]!;
  const b = secondaryPool[(input.phase + 1) % secondaryPool.length]!;

  return [base, a, b];
}

export default function LiveAnalysisOverlay({ enabled, simulateBot, signalQuality, baselinePulse, noiseDetected }: LiveAnalysisOverlayProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const baselineSeenRef = useRef(0);
  const [baselineFlashUntil, setBaselineFlashUntil] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setPhase((p) => p + 1), 1150);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (baselinePulse === baselineSeenRef.current) return;
    baselineSeenRef.current = baselinePulse;
    // Force an immediate “baseline recalibrated” moment.
    setBaselineFlashUntil(Date.now() + 1600);
    setPhase((p) => p + 1);
  }, [baselinePulse, enabled]);

  const baselineRecalibrated = baselineFlashUntil > Date.now();

  const lines = useMemo(
    () => pickLines({ simulateBot, signalQuality, baselineRecalibrated, noiseDetected, phase }),
    [baselineRecalibrated, noiseDetected, phase, signalQuality, simulateBot]
  );

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[24px]">
      {/* Subtle animated grid */}
      <motion.div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "38px 38px"
        }}
        animate={reduceMotion ? undefined : { backgroundPosition: ["0px 0px", "38px 38px"] }}
        transition={reduceMotion ? undefined : { duration: 9.5, repeat: Infinity, ease: "linear" }}
        aria-hidden="true"
      />

      {/* Micro scan-line */}
      <motion.div
        className="absolute left-0 right-0 h-10 opacity-40"
        style={{
          background:
            "linear-gradient(to bottom, rgba(56,189,248,0) 0%, rgba(56,189,248,0.12) 45%, rgba(56,189,248,0) 100%)",
          mixBlendMode: "screen"
        }}
        animate={reduceMotion ? undefined : { y: ["-15%", "115%"] }}
        transition={reduceMotion ? undefined : { duration: 6.8, repeat: Infinity, ease: "linear" }}
        aria-hidden="true"
      />

      {/* Telemetry text */}
      <div className="absolute bottom-3 left-3 rounded-xl bg-black/35 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${phase}-${simulateBot}-${signalQuality}-${baselineRecalibrated}-${noiseDetected}`}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="space-y-0.5"
          >
            {lines.map((l, i) => (
              <p
                key={i}
                className={[
                  "text-[10px] font-medium tracking-[0.18em]",
                  simulateBot && i > 0 ? "text-rose-200/90" : i === 0 ? "text-white/70" : "text-white/60"
                ].join(" ")}
              >
                {l}
              </p>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

