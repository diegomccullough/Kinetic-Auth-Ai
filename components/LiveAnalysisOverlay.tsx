"use client";

import { motion, useReducedMotion } from "framer-motion";

export type SignalQuality = "strong" | "moderate" | "weak";

export type LiveAnalysisOverlayProps = {
  enabled: boolean;
  simulateBot: boolean;
  signalQuality: SignalQuality;
  baselinePulse: number; // increment to pulse "baseline recalibrated"
  noiseDetected: boolean;
};

export default function LiveAnalysisOverlay({ enabled, simulateBot, signalQuality, baselinePulse, noiseDetected }: LiveAnalysisOverlayProps) {
  const reduceMotion = useReducedMotion();
  void simulateBot;
  void signalQuality;
  void baselinePulse;
  void noiseDetected;

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
    </div>
  );
}

