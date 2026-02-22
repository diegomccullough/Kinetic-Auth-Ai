"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDeviceOrientation } from "@/lib/useDeviceOrientation";
import PhoneTiltPreview from "@/components/PhoneTiltPreview";
import { scoreHumanConfidence, type MotionSample, type ScoreBreakdown } from "@/lib/scoring";
import AnimatedNumber from "@/components/AnimatedNumber";
import { DEMO_MODE } from "@/lib/demoMode";
import MotionVarianceGraph from "@/components/MotionVarianceGraph";
import LiveAnalysisOverlay, { type SignalQuality } from "@/components/LiveAnalysisOverlay";

type Step = "intro" | "freeTilt" | "directed" | "stabilize" | "result";
type Baseline = { beta: number; gamma: number; alpha: number };

const MAX_FPS = 60;
const CLAMP_TILT_DEG = 35;

const DIRECTED_HOLD_MS = 250;
const DIRECTED_THRESHOLD_DEG = 18;

const MAX_OFFSET_PX = 92;

const STABILITY_HOLD_MS = 1500;
const DOT_FACTOR_PX_PER_DEG = MAX_OFFSET_PX / CLAMP_TILT_DEG;
const STABILITY_INNER_RADIUS_PX = 39;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

function ProgressDots({ step }: { step: Step }) {
  const steps: Step[] = ["intro", "freeTilt", "directed", "stabilize"];
  const idx = steps.indexOf(step);
  const doneIdx = step === "result" ? steps.length - 1 : idx;

  return (
    <div className="flex items-center gap-2">
      {steps.map((_, i) => {
        const active = i === idx && step !== "result";
        const done = i <= doneIdx && (step === "result" || i < idx);
        return (
          <div
            key={i}
            className={[
              "h-2 w-2 rounded-full ring-1 transition-colors",
              done ? "bg-emerald-300 ring-emerald-300/40" : active ? "bg-white ring-white/40" : "bg-white/20 ring-white/20"
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

export type VerificationWizardProps = {
  onVerified?: (score: ScoreBreakdown) => void;
  onCancel?: () => void;
};

export default function VerificationWizard({ onVerified, onCancel }: VerificationWizardProps) {
  const reduceMotion = useReducedMotion();
  const demo = DEMO_MODE;

  const [step, setStep] = useState<Step>("intro");
  const [simulateBot, setSimulateBot] = useState(false);
  const {
    beta,
    gamma,
    smoothedBeta,
    smoothedGamma,
    smoothedRef,
    available,
    permissionState,
    requestPermission
  } = useDeviceOrientation();

  const baselineRef = useRef<Baseline | null>(null);
  const directedBaselineRef = useRef<{ beta: number; gamma: number } | null>(null);

  const motionWindowRef = useRef<MotionSample[]>([]);
  const [score, setScore] = useState<ScoreBreakdown>(() =>
    scoreHumanConfidence({ motionSamples: [], directedTimings: undefined, stabilityPct: 0, stabilityHoldPct: 0 })
  );
  const scoreRef = useRef(score);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const directedSequence = useMemo(
    () =>
      [
        { id: "left", title: "TILT LEFT", axis: "gamma" as const, dir: -1 },
        { id: "right", title: "TILT RIGHT", axis: "gamma" as const, dir: 1 },
        { id: "forward", title: "TILT FORWARD", axis: "beta" as const, dir: 1 }
      ] as const,
    []
  );
  const [directedIdx, setDirectedIdx] = useState(0);
  const directedHoldRef = useRef(0);
  const [directedHoldPct, setDirectedHoldPct] = useState(0);
  const directedPromptStartRef = useRef<number | null>(null);
  const directedAdvanceTimerRef = useRef<number | null>(null);
  const [directedCheckKey, setDirectedCheckKey] = useState(0);
  const [lastPassed, setLastPassed] = useState<null | "left" | "right" | "forward">(null);
  const [showDirectedCheck, setShowDirectedCheck] = useState(false);
  const directedCheckDelayRef = useRef<number | null>(null);
  const [timings, setTimings] = useState<{
    timeToLeft?: number;
    timeToRight?: number;
    timeToForward?: number;
  }>({});

  const stableMsRef = useRef(0);
  const [stablePct, setStablePct] = useState(0);
  const [stabilityPct, setStabilityPct] = useState(0);
  const [dot, setDot] = useState({ x: 0, y: 0 });
  const [inside, setInside] = useState(false);
  const stabilizeDoneRef = useRef(false);
  const [stabilizeSuccess, setStabilizeSuccess] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [baselinePulse, setBaselinePulse] = useState(0);

  const [confidenceDisplay, setConfidenceDisplay] = useState(0);

  const [bursts, setBursts] = useState<{ id: string; text: string; x: number }[]>([]);
  const lastBurstAtPctRef = useRef(0);

  const [climaxOpen, setClimaxOpen] = useState(false);
  const [climaxTarget, setClimaxTarget] = useState(0);
  const [climaxDisplay, setClimaxDisplay] = useState(0);
  const [climaxKey, setClimaxKey] = useState(0);

  const confetti = useMemo(() => {
    const colors = ["bg-sky-300", "bg-indigo-300", "bg-emerald-300", "bg-fuchsia-300"];
    return Array.from({ length: 18 }, (_, i) => {
      const left = 10 + Math.random() * 80;
      const top = 18 + Math.random() * 60;
      const dx = (Math.random() - 0.5) * 220;
      const dy = -140 - Math.random() * 120;
      const rot = (Math.random() - 0.5) * 220;
      const cls = colors[i % colors.length];
      return { left, top, dx, dy, rot, cls };
    });
  }, [confettiKey]);

  const startVerification = useCallback(async () => {
    const res = await requestPermission();
    if (res === "granted") {
      vibrate(10);
      setStep("freeTilt");
    }
  }, [requestPermission]);

  const startBotSimulation = useCallback(async () => {
    setSimulateBot(true);
    const res = await requestPermission();
    if (res === "granted") {
      vibrate(10);
      setStep("freeTilt");
    }
  }, [requestPermission]);

  const enableMotion = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  // Set baseline when stabilization starts (neutral = orientation at step entry).
  useEffect(() => {
    if (step !== "stabilize") return;
    baselineRef.current = { ...smoothedRef.current };
    setBaselinePulse((p) => p + 1);
    stableMsRef.current = 0;
    stabilizeDoneRef.current = false;
    setStabilizeSuccess(false);
    setStabilityPct(0);
    setStablePct(0);
    setDot({ x: 0, y: 0 });
    setInside(false);
  }, [step, smoothedRef]);

  // Reset directed state when entering directed.
  useEffect(() => {
    if (step !== "directed") return;
    setDirectedIdx(0);
    directedHoldRef.current = 0;
    setDirectedHoldPct(0);
    directedPromptStartRef.current = performance.now();
    setLastPassed(null);
    setTimings({});
    directedBaselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
    if (directedAdvanceTimerRef.current) window.clearTimeout(directedAdvanceTimerRef.current);
    directedAdvanceTimerRef.current = null;
  }, [step, smoothedRef]);

  // On entering each directed prompt, snapshot a baseline (baseline-relative detection).
  useEffect(() => {
    if (step !== "directed") return;
    directedBaselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
    setBaselinePulse((p) => p + 1);
    directedHoldRef.current = 0;
    setDirectedHoldPct(0);
    directedPromptStartRef.current = performance.now();
  }, [directedIdx, step, smoothedRef]);

  useEffect(() => {
    // Reset motion window when entering motion-heavy steps.
    if (step === "freeTilt" || step === "directed" || step === "stabilize") {
      motionWindowRef.current = [];
    }
  }, [step]);

  useEffect(() => {
    return () => {
      if (directedAdvanceTimerRef.current) window.clearTimeout(directedAdvanceTimerRef.current);
      if (directedCheckDelayRef.current) window.clearTimeout(directedCheckDelayRef.current);
    };
  }, []);

  useEffect(() => {
    if (directedCheckDelayRef.current) window.clearTimeout(directedCheckDelayRef.current);
    directedCheckDelayRef.current = null;

    if (!lastPassed) {
      setShowDirectedCheck(false);
      return;
    }

    if (!demo) {
      setShowDirectedCheck(true);
      return;
    }

    setShowDirectedCheck(false);
    directedCheckDelayRef.current = window.setTimeout(() => setShowDirectedCheck(true), 200);

    return () => {
      if (directedCheckDelayRef.current) window.clearTimeout(directedCheckDelayRef.current);
      directedCheckDelayRef.current = null;
    };
  }, [demo, lastPassed]);

  // Main RAF loop for directed + stabilize + live confidence.
  useEffect(() => {
    let raf = 0;
    let last = 0;

    const tick = (t: number) => {
      raf = window.requestAnimationFrame(tick);
      if (t - last < 1000 / MAX_FPS) return;
      const dtMs = last ? Math.min(60, t - last) : 16;
      last = t;

      const s = smoothedRef.current;
      if (!s) return;

      // Maintain a rolling motion window (~1.6s @ 60fps).
      if (step === "freeTilt" || step === "directed" || step === "stabilize") {
        const buf = motionWindowRef.current;
        const sb = simulateBot ? 0 : s.beta;
        const sg = simulateBot ? 0 : s.gamma;
        buf.push({ beta: sb, gamma: sg, t });
        if (buf.length > 96) buf.shift();
      }

      let frameStabilityPct = stabilityPct;
      let frameHoldPct = stablePct;

      if (step === "directed") {
        const current = directedSequence[directedIdx];
        const base = directedBaselineRef.current ?? { beta: s.beta, gamma: s.gamma };
        const dBeta = s.beta - base.beta;
        const dGamma = s.gamma - base.gamma;
        const ok =
          current.id === "left"
            ? dGamma < -DIRECTED_THRESHOLD_DEG
            : current.id === "right"
              ? dGamma > DIRECTED_THRESHOLD_DEG
              : dBeta > DIRECTED_THRESHOLD_DEG;

        directedHoldRef.current = ok ? directedHoldRef.current + dtMs : 0;
        directedHoldRef.current = clamp(directedHoldRef.current, 0, DIRECTED_HOLD_MS);
        const holdPct = directedHoldRef.current / DIRECTED_HOLD_MS;
        setDirectedHoldPct((p) => (Math.abs(p - holdPct) > 0.02 ? holdPct : p));

        if (directedHoldRef.current >= DIRECTED_HOLD_MS && !directedAdvanceTimerRef.current) {
          const id = current.id;
          const started = directedPromptStartRef.current ?? performance.now();
          const elapsed = Math.max(0, performance.now() - started);

          setLastPassed(id);
          vibrate(30);
          setDirectedCheckKey((k) => k + 1);
          setTimings((prev) => {
            if (id === "left" && prev.timeToLeft === undefined) return { ...prev, timeToLeft: Math.round(elapsed) };
            if (id === "right" && prev.timeToRight === undefined) return { ...prev, timeToRight: Math.round(elapsed) };
            if (id === "forward" && prev.timeToForward === undefined) return { ...prev, timeToForward: Math.round(elapsed) };
            return prev;
          });

          directedHoldRef.current = 0;
          setDirectedHoldPct(0);

          directedAdvanceTimerRef.current = window.setTimeout(() => {
            directedAdvanceTimerRef.current = null;
            setLastPassed(null);
            setDirectedIdx((i) => {
              const next = i + 1;
              directedPromptStartRef.current = performance.now();
              if (next >= directedSequence.length) {
                window.setTimeout(() => setStep("stabilize"), 250);
                return i;
              }
              return next;
            });
          }, 520);
        }
        return;
      }

      if (step === "stabilize") {
        const base = baselineRef.current ?? s;
        const dBeta = s.beta - base.beta;
        const dGamma = s.gamma - base.gamma;

        const x = clamp(dGamma * DOT_FACTOR_PX_PER_DEG, -MAX_OFFSET_PX, MAX_OFFSET_PX);
        const y = clamp(dBeta * DOT_FACTOR_PX_PER_DEG, -MAX_OFFSET_PX, MAX_OFFSET_PX);

        const dist = Math.sqrt(x * x + y * y);
        const insideTarget = simulateBot ? false : dist <= STABILITY_INNER_RADIUS_PX;

        // Stability percent is distance-based (for UI + scoring).
        const stability = clamp(100 * (1 - dist / STABILITY_INNER_RADIUS_PX), 0, 100);
        frameStabilityPct = stability;
        setStabilityPct((prev) => (Math.abs(prev - stability) > 0.8 ? stability : prev));

        // Accumulate only while inside. Outside pauses + slight decay.
        stableMsRef.current = insideTarget
          ? clamp(stableMsRef.current + dtMs, 0, STABILITY_HOLD_MS)
          : clamp(stableMsRef.current - dtMs * 0.55, 0, STABILITY_HOLD_MS);

        const pct = (stableMsRef.current / STABILITY_HOLD_MS) * 100;
        frameHoldPct = pct;

        setInside(insideTarget);
        setStablePct((prev) => (Math.abs(prev - pct) > 0.25 ? pct : prev));

        setDot((prev) => {
          const dx = Math.abs(prev.x - x);
          const dy = Math.abs(prev.y - y);
          if (dx < 0.15 && dy < 0.15) return prev;
          return { x, y };
        });

        // Micro burst drama while stabilizing (visual only).
        if (!simulateBot && insideTarget) {
          const pctNow = Math.round(pct);
          if (pctNow >= lastBurstAtPctRef.current + 12) {
            lastBurstAtPctRef.current = pctNow;
            const amount = 10 + Math.floor(Math.random() * 7);
            const id = `${t}-${Math.random().toString(16).slice(2)}`;
            setBursts((prev) => [...prev.slice(-5), { id, text: `+${amount}% stability acquired`, x: (Math.random() - 0.5) * 36 }]);
            window.setTimeout(() => {
              setBursts((prev) => prev.filter((b) => b.id !== id));
            }, 900);
          }
        }

        if (pct >= 100 && !stabilizeDoneRef.current) {
          stabilizeDoneRef.current = true;
          setStabilizeSuccess(true);
          vibrate([18, 24, 18]);
          setConfettiKey((k) => k + 1);

          const finalBreakdown = scoreHumanConfidence({
            motionSamples: motionWindowRef.current,
            directedTimings: timings,
            stabilityPct: frameStabilityPct,
            stabilityHoldPct: frameHoldPct
          });
          setScore(finalBreakdown);
          scoreRef.current = finalBreakdown;
          setClimaxTarget(finalBreakdown.humanConfidence);
          setClimaxKey((k) => k + 1);
          if (demo) setClimaxOpen(true);

          window.setTimeout(() => {
            setClimaxOpen(false);
            setStep("result");
            if (finalBreakdown.riskLevel !== "high") {
              onVerified?.(finalBreakdown);
            }
          }, demo ? 950 : 700);
        }
        return;
      }

      const breakdown = scoreHumanConfidence({
        motionSamples: motionWindowRef.current,
        directedTimings: timings,
        stabilityPct: frameStabilityPct,
        stabilityHoldPct: frameHoldPct
      });

      setScore((prev) => {
        if (Math.abs(prev.humanConfidence - breakdown.humanConfidence) < 1 && prev.riskLevel === breakdown.riskLevel) {
          const diff =
            prev.entropyScore !== breakdown.entropyScore ||
            prev.smoothnessScore !== breakdown.smoothnessScore ||
            prev.reactionScore !== breakdown.reactionScore ||
            prev.stabilityScore !== breakdown.stabilityScore;
          return diff ? breakdown : prev;
        }
        return breakdown;
      });
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [directedIdx, directedSequence, onVerified, stablePct, stabilityPct, step, timings, smoothedRef, simulateBot]);

  const signalQuality: SignalQuality = useMemo(() => {
    if (!available) return "weak";
    const buf = motionWindowRef.current;
    if (buf.length < 24) return "moderate";
    // Estimate variance quickly (recent speed variance proxy).
    let sum = 0;
    let sum2 = 0;
    let c = 0;
    for (let i = Math.max(1, buf.length - 28); i < buf.length; i++) {
      const p0 = buf[i - 1]!;
      const p1 = buf[i]!;
      const dt = Math.max(8, Math.min(60, p1.t - p0.t)) / 1000;
      const v = Math.hypot(p1.beta - p0.beta, p1.gamma - p0.gamma) / dt;
      sum += v;
      sum2 += v * v;
      c++;
    }
    const mean = c ? sum / c : 0;
    const varr = c ? sum2 / c - mean * mean : 0;
    if (simulateBot) return "weak";
    if (varr > 1200) return "strong";
    if (varr > 260) return "moderate";
    return "weak";
  }, [available, simulateBot, step]);

  const noiseDetected = useMemo(() => {
    if (simulateBot) return false;
    // "Human motor noise" = non-trivial micro corrections.
    return score.entropyScore >= 45 || score.smoothnessScore >= 45;
  }, [score.entropyScore, score.smoothnessScore, simulateBot]);

  const showAnalysisHUD = step === "freeTilt" || step === "directed" || step === "stabilize";

  // Confidence drama (display only): rise gradually, especially during stabilization.
  const confidenceTarget = useMemo(() => {
    const baseTarget = simulateBot ? 22 : score.humanConfidence;
    const stabilizeTarget = step === "stabilize" ? clamp(32 + stablePct * 0.62, 0, 100) : baseTarget;
    const target = simulateBot ? Math.min(baseTarget, 28) : Math.max(baseTarget, stabilizeTarget);
    return clamp(target, 0, 100);
  }, [score.humanConfidence, simulateBot, stablePct, step]);

  useEffect(() => {
    const controls = animate(confidenceDisplay, confidenceTarget, {
      duration: step === "stabilize" ? 0.85 : 0.55,
      ease: [0.2, 0.9, 0.2, 1],
      onUpdate: (v) => setConfidenceDisplay(v)
    });
    return () => controls.stop();
  }, [confidenceDisplay, confidenceTarget, step]);

  // Simulated bot: auto-flag as high risk after a brief “analysis” window.
  useEffect(() => {
    if (!simulateBot) return;
    if (!showAnalysisHUD) return;
    const id = window.setTimeout(() => {
      const flagged = scoreHumanConfidence({ motionSamples: Array.from({ length: 32 }, (_, i) => ({ beta: 0, gamma: 0, t: i * 16 })) });
      setScore({ ...flagged, riskLevel: "high", humanConfidence: Math.min(28, flagged.humanConfidence) });
      setStep("result");
      vibrate([8, 22, 8]);
    }, 2400);
    return () => window.clearTimeout(id);
  }, [showAnalysisHUD, simulateBot]);

  useEffect(() => {
    if (!climaxOpen) return;
    setClimaxDisplay(0);
    const controls = animate(0, climaxTarget, {
      duration: reduceMotion ? 0 : 0.75,
      ease: [0.18, 0.9, 0.2, 1],
      onUpdate: (v) => setClimaxDisplay(v)
    });
    return () => controls.stop();
  }, [climaxOpen, climaxTarget, reduceMotion]);

  const delta = useMemo(() => {
    const base = baselineRef.current;
    if (!base) return { beta: 0, gamma: 0 };
    return { beta: smoothedBeta - base.beta, gamma: smoothedGamma - base.gamma };
  }, [smoothedBeta, smoothedGamma]);

  const directed = directedSequence[directedIdx] ?? directedSequence[0];
  const directedArrow = directed?.id === "left" ? "←" : directed?.id === "right" ? "→" : "↓";

  return (
    <div className="relative">
      <AnimatePresence>
        {demo && climaxOpen ? (
          <motion.div
            key={`climax-${climaxKey}`}
            className="fixed inset-0 z-[200] grid place-items-center bg-black/65 backdrop-blur-md"
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="relative px-6 text-center">
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.86 }}
                animate={reduceMotion ? undefined : { opacity: [0, 1, 0.45], scale: [0.86, 1.06, 1.12] }}
                transition={{ duration: 0.95, ease: "easeOut" }}
                style={{
                  background:
                    "radial-gradient(circle at 50% 45%, rgba(56,189,248,0.28) 0%, rgba(99,102,241,0.14) 34%, rgba(0,0,0,0) 70%)",
                  filter: "blur(2px)"
                }}
                aria-hidden="true"
              />

              <p className="text-xs font-semibold tracking-[0.34em] text-white/65">HUMAN CONFIDENCE:</p>
              <div className="mt-4 flex items-baseline justify-center gap-2">
                <motion.span
                  className="bg-gradient-to-r from-sky-200 via-white to-sky-200 bg-clip-text text-6xl font-semibold tabular-nums tracking-tight text-transparent sm:text-7xl"
                  style={{ backgroundSize: "220% 100%" }}
                  animate={reduceMotion ? undefined : { backgroundPosition: ["0% 0%", "220% 0%"] }}
                  transition={reduceMotion ? undefined : { duration: 1.15, repeat: Infinity, ease: "linear" }}
                >
                  {Math.round(climaxDisplay)}%
                </motion.span>
              </div>
              <p className="mt-3 text-sm text-white/60">Behavioral entropy analysis</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.26em] text-white/60">KINETICAUTH</p>
          <h2
            className={[
              "mt-2 text-balance font-semibold leading-[1.05] tracking-tight text-white",
              demo ? "text-[28px]" : "text-[22px]"
            ].join(" ")}
          >
            Verification wizard
          </h2>
        </div>
        <ProgressDots step={step} />
      </div>

      <div className="relative rounded-[24px] bg-white/[0.04] p-4 ring-1 ring-white/10 overflow-hidden">
        {demo ? (
          <motion.div
            className="pointer-events-none absolute -inset-16 opacity-70"
            style={{
              x: clamp(smoothedGamma, -18, 18) * 0.55,
              y: clamp(smoothedBeta, -18, 18) * 0.45
            }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.18)_0%,rgba(99,102,241,0.12)_34%,rgba(0,0,0,0)_74%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.10)_0%,rgba(0,0,0,0)_58%)]" />
          </motion.div>
        ) : null}
        {demo ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 35%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.46) 72%, rgba(0,0,0,0.82) 100%)"
            }}
            aria-hidden="true"
          />
        ) : null}
        <AnimatePresence initial={false}>
          {showAnalysisHUD ? (
            <motion.div
              key="analysis-hud"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 z-20"
            >
              <LiveAnalysisOverlay
                enabled={showAnalysisHUD}
                simulateBot={simulateBot}
                signalQuality={signalQuality}
                baselinePulse={baselinePulse}
                noiseDetected={noiseDetected}
              />
              <div className="absolute right-3 top-3 z-30">
                <MotionVarianceGraph samplesRef={motionWindowRef} enabled={showAnalysisHUD} reduceMotion={!!reduceMotion} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="popLayout" initial={false}>
          {step === "intro" ? (
            <motion.div
              key="intro"
              initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">QUICK VERIFICATION</p>
                <p className={[
                  "mt-2 font-semibold tracking-tight text-white",
                  demo ? "text-3xl" : "text-2xl"
                ].join(" ")}>
                  Quick verification required
                </p>
                <p className="mt-2 text-sm text-white/65">
                  This demo uses device orientation to confirm a human-held device. On iOS Safari, motion access requires a tap.
                </p>
              </div>

              {!available || permissionState === "unsupported" ? (
                <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
                  Motion not supported; use voice verification.
                </div>
              ) : null}

              {permissionState === "denied" ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-400/15">
                    Motion permission was denied. To unblock on iPhone:
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
                    <ol className="list-decimal space-y-1 pl-5">
                      <li>
                        Open <span className="font-semibold text-white/85">Settings</span>
                      </li>
                      <li>
                        Scroll to <span className="font-semibold text-white/85">Safari</span>
                      </li>
                      <li>
                        Enable <span className="font-semibold text-white/85">Motion &amp; Orientation Access</span>
                      </li>
                      <li>
                        Return here and tap <span className="font-semibold text-white/85">Enable motion</span>
                      </li>
                    </ol>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <Button
                  onClick={startVerification}
                  disabled={!available || permissionState === "unsupported"}
                  className={!available || permissionState === "unsupported" ? "opacity-60" : undefined}
                >
                  Start verification
                </Button>

                <button
                  type="button"
                  onClick={startBotSimulation}
                  className="w-full rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 ring-1 ring-rose-300/20 hover:bg-rose-500/15"
                >
                  Simulate bot attempt (demo)
                </button>

                {simulateBot ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSimulateBot(false);
                      setStep("intro");
                    }}
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm font-medium text-white/70 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    Exit bot simulation
                  </button>
                ) : null}

                {available && permissionState !== "granted" ? (
                  <button
                    type="button"
                    onClick={enableMotion}
                    className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
                  >
                    Enable motion
                  </button>
                ) : null}

                <Link
                  href="/voice"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                >
                  Use voice verification instead
                </Link>

                {onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </motion.div>
          ) : null}

          {step === "freeTilt" ? (
            <motion.div
              key="freeTilt"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex h-[72dvh] flex-col overflow-hidden"
            >
              <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">STEP 1</p>
                <p className={["mt-2 font-semibold tracking-tight text-white", demo ? "text-5xl" : "text-4xl"].join(" ")}>
                  Tilt your phone
                </p>
                <p className="mt-2 text-sm text-white/65">Cinematic mode — smooth, premium motion.</p>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[28px] bg-black/25 ring-1 ring-white/10">
                <PhoneTiltPreview beta={simulateBot ? 0 : beta} gamma={simulateBot ? 0 : gamma} reduceMotion={!!reduceMotion} />
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep("directed")}
                  className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
                >
                  Continue
                </button>
                <Link
                  href="/voice"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                >
                  Use voice verification instead
                </Link>
                <button
                  type="button"
                  onClick={() => setStep("intro")}
                  className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                >
                  Back
                </button>
              </div>
            </motion.div>
          ) : null}

          {step === "directed" ? (
            <motion.div
              key="directed"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex h-[68dvh] flex-col overflow-hidden"
            >
              <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">STEP 2</p>
                <p className={["mt-2 font-semibold leading-none tracking-tight text-white", demo ? "text-8xl" : "text-7xl"].join(" ")}>
                  {directedArrow}
                </p>
                <p className={["mt-3 font-semibold tracking-tight text-white", demo ? "text-7xl leading-none" : "text-5xl"].join(" ")}>
                  {directed.title}
                </p>
                <p className="mt-3 text-sm text-white/65">Hold for {DIRECTED_HOLD_MS}ms to confirm.</p>
              </div>

              <div className="relative mt-4 min-h-0 flex-1 overflow-hidden rounded-[28px] bg-black/25 ring-1 ring-white/10">
                <div className="absolute inset-0 grid place-items-center">
                  <motion.div
                    className="grid h-[220px] w-[220px] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.16)_0%,rgba(99,102,241,0.10)_35%,rgba(0,0,0,0)_70%)] ring-1 ring-white/10"
                    animate={
                      reduceMotion
                        ? undefined
                        : { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 110px rgba(56,189,248,0.16)", "0 0 0 rgba(0,0,0,0)"] }
                    }
                    transition={reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <motion.div
                      className="text-[110px] font-semibold leading-none text-white"
                      initial={false}
                      animate={reduceMotion ? undefined : { scale: [1, 1.04, 1] }}
                      transition={reduceMotion ? undefined : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                      aria-hidden="true"
                    >
                      {directedArrow}
                    </motion.div>
                  </motion.div>
                </div>

                <AnimatePresence>
                  {lastPassed && (!demo || showDirectedCheck) ? (
                    <motion.div
                      key={`${lastPassed}-${directedCheckKey}`}
                      className="pointer-events-none absolute inset-0 grid place-items-center"
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.20)_0%,rgba(56,189,248,0.10)_38%,rgba(0,0,0,0)_72%)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 0.55, ease: "easeOut" }}
                      />
                      <motion.div
                        className="grid h-24 w-24 place-items-center rounded-[26px] bg-emerald-400/10 ring-1 ring-emerald-300/25"
                        animate={{ boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 90px rgba(16,185,129,0.18)", "0 0 0 rgba(0,0,0,0)"] }}
                        transition={{ duration: 0.9, ease: "easeInOut" }}
                      >
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <motion.path
                            d="M20 6L9 17l-5-5"
                            stroke="rgba(167,243,208,0.95)"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                          />
                        </svg>
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="mt-4 rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-xs text-white/55">
                  <span>
                    Progress <span className="font-semibold text-white/80">{directedIdx + 1}/3</span>
                  </span>
                  <span className="tabular-nums">{Math.round(directedHoldPct * 100)}%</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => {
                    const done = i < directedIdx;
                    const active = i === directedIdx;
                    return (
                      <div key={i} className={["overflow-hidden rounded-full bg-white/10", demo ? "h-3" : "h-2"].join(" ")}>
                        <motion.div
                          className={done ? "h-full bg-emerald-300/90" : "h-full bg-gradient-to-r from-sky-400 to-indigo-400"}
                          initial={false}
                          animate={{ width: done ? "100%" : active ? `${Math.round(directedHoldPct * 100)}%` : "0%" }}
                          transition={{ type: "tween", duration: 0.12, ease: "linear" }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep("freeTilt")}
                  className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                >
                  Back
                </button>
                <Link
                  href="/voice"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
                >
                  Use voice verification instead
                </Link>
              </div>
            </motion.div>
          ) : null}

          {step === "stabilize" ? (
            <motion.div
              key="stabilize"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex h-[68dvh] flex-col overflow-hidden"
            >
              <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">STEP 3</p>
                <p className={["mt-2 font-semibold tracking-tight text-white", demo ? "text-5xl" : "text-4xl"].join(" ")}>
                  Hold steady
                </p>
                <p className="mt-2 text-sm text-white/65">Keep the dot centered until complete.</p>
              </div>

              <div className="flex items-center justify-center">
                <div className={["relative", demo ? "h-[300px] w-[300px]" : "h-[250px] w-[250px]"].join(" ")}>
                  <div className="pointer-events-none absolute inset-0 z-30">
                    <AnimatePresence initial={false}>
                      {bursts.map((b) => (
                        <motion.div
                          key={b.id}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: -18, scale: 1 }}
                          exit={{ opacity: 0, y: -28, scale: 1.02 }}
                          transition={{ duration: 0.55, ease: "easeOut" }}
                          className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-300/20"
                          style={{ marginLeft: b.x }}
                        >
                          {b.text}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {demo ? (
                    <motion.div
                      className="pointer-events-none absolute -inset-16 opacity-80"
                      style={{ x: dot.x * 0.08, y: dot.y * 0.08 }}
                      aria-hidden="true"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.22)_0%,rgba(99,102,241,0.14)_30%,rgba(0,0,0,0)_70%)]" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.14)_0%,rgba(0,0,0,0)_55%)]" />
                    </motion.div>
                  ) : null}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{
                      boxShadow: inside
                        ? demo
                          ? "0 0 80px rgba(56,189,248,0.32), 0 0 140px rgba(99,102,241,0.22)"
                          : "0 0 52px rgba(56,189,248,0.22), 0 0 96px rgba(99,102,241,0.16)"
                        : demo
                          ? "0 0 52px rgba(56,189,248,0.12)"
                          : "0 0 34px rgba(56,189,248,0.08)"
                    }}
                    transition={{ type: "spring", stiffness: 170, damping: 18 }}
                  />
                  <motion.div
                    className="absolute inset-[6px] rounded-full ring-1 ring-white/10"
                    animate={reduceMotion ? undefined : { opacity: [0.12, 0.22, 0.12], scale: [1, 1.01, 1] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden="true"
                  />
                  <div className="absolute inset-[18px] rounded-full bg-white/[0.03] ring-1 ring-white/10" />

                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 300 300" aria-hidden="true">
                    <circle
                      cx="150"
                      cy="150"
                      r="122"
                      stroke="rgba(255,255,255,0.10)"
                      strokeWidth={demo ? 14 : 10}
                      fill="none"
                    />
                    <motion.circle
                      cx="150"
                      cy="150"
                      r="122"
                      stroke="rgba(56,189,248,0.95)"
                      strokeWidth={demo ? 14 : 10}
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 122}
                      animate={{ strokeDashoffset: (2 * Math.PI * 122) * (1 - stablePct / 100) }}
                      transition={{ type: "tween", duration: 0.16, ease: "linear" }}
                    />
                  </svg>

                  <div className="absolute inset-0 grid place-items-center">
                    <div className={["relative rounded-full", demo ? "h-[250px] w-[250px]" : "h-[208px] w-[208px]"].join(" ")}>
                      <div
                        className={[
                          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/10",
                          demo ? "h-[94px] w-[94px]" : "h-[78px] w-[78px]"
                        ].join(" ")}
                      />
                      <motion.div
                        className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200 shadow-[0_0_22px_rgba(56,189,248,0.65)]"
                        animate={{
                          x: dot.x,
                          y: dot.y,
                          scale: stablePct >= 100 ? 1.25 : inside ? 1.1 : 1,
                          boxShadow: inside
                            ? demo
                              ? "0 0 52px rgba(56,189,248,1)"
                              : "0 0 30px rgba(56,189,248,0.95)"
                            : demo
                              ? "0 0 28px rgba(56,189,248,0.65)"
                              : "0 0 18px rgba(56,189,248,0.45)"
                        }}
                        transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.28 }}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {inside && stablePct < 100 ? (
                      <motion.div
                        className="absolute inset-[10px] rounded-full ring-1 ring-sky-300/25"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.28, 0.65, 0.28], scale: [1, 1.02, 1] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
                      />
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence>
                    {stablePct > 85 && stablePct < 100 ? (
                      <motion.div
                        className="absolute inset-[2px] rounded-full ring-1 ring-emerald-300/18"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.12, 0.32, 0.12], scale: [1, 1.015, 1] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.95, repeat: Infinity, ease: "easeInOut" }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence>
                    {stabilizeSuccess ? (
                      <motion.div
                        key="stabilize-success"
                        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.22)_0%,rgba(56,189,248,0.14)_35%,rgba(0,0,0,0)_70%)]" />
                        {confetti.map((p, i) => (
                          <motion.div
                            key={i}
                            className={`absolute h-2.5 w-1.5 rounded-full ${p.cls}`}
                            style={{ left: `${p.left}%`, top: `${p.top}%` }}
                            initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.9 }}
                            animate={{ opacity: [0, 1, 1, 0], x: p.dx, y: p.dy, rotate: p.rot, scale: [0.9, 1, 1] }}
                            transition={{ duration: 1.05, ease: "easeOut" }}
                          />
                        ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>

              <div className="rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-xs text-white/55">
                  <span>Hold steady</span>
                  <span className="tabular-nums">{Math.round(stablePct)}%</span>
                </div>
                  <div className={["mt-2 overflow-hidden rounded-full bg-white/10", demo ? "h-3" : "h-2"].join(" ")}>
                  <motion.div
                    className={[
                      "h-full rounded-full",
                      inside ? "bg-gradient-to-r from-emerald-300/90 to-sky-300/90" : "bg-gradient-to-r from-sky-400 to-indigo-400"
                    ].join(" ")}
                    initial={false}
                    animate={{ width: `${Math.round(stablePct)}%` }}
                    transition={{ type: "tween", duration: 0.12, ease: "linear" }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep("directed")}
                  className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                >
                  Back
                </button>
                <Link
                  href="/voice"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
                >
                  Use voice verification instead
                </Link>
              </div>
            </motion.div>
          ) : null}

          {step === "result" ? (
            <motion.div
              key="result"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="space-y-5"
            >
              <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">
                  {score.riskLevel === "high" ? "REVIEW NEEDED" : "VERIFIED"}
                </p>
                <p className={["mt-2 font-semibold tracking-tight text-white", demo ? "text-5xl" : "text-2xl"].join(" ")}>
                  {score.riskLevel === "high" ? "Try voice verification" : "Verified"}
                </p>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.22em] ring-1",
                      score.riskLevel === "low"
                        ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/25"
                        : score.riskLevel === "medium"
                          ? "bg-amber-400/15 text-amber-100 ring-amber-300/25"
                          : "bg-rose-500/15 text-rose-100 ring-rose-300/25"
                    ].join(" ")}
                  >
                    {score.riskLevel.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-white/50">Trust model v1.3</span>
                </div>

                {simulateBot ? (
                  <div className="mx-auto mt-3 max-w-[340px] rounded-2xl bg-rose-500/10 px-4 py-3 text-left ring-1 ring-rose-300/20">
                    <p className="text-xs font-semibold tracking-[0.22em] text-rose-200/90">AUTOMATION WARNING</p>
                    <p className="mt-1 text-sm font-semibold text-rose-100">Motion pattern too linear.</p>
                    <p className="mt-0.5 text-sm text-rose-100/90">Automation signature detected.</p>
                  </div>
                ) : null}
                <p className="mt-1 text-sm text-white/65">
                  Human Confidence:{" "}
                  <span className="font-semibold text-white tabular-nums">
                    {demo ? <AnimatedNumber value={score.humanConfidence} duration={0.65} format={(n) => `${Math.round(n)}%`} /> : `${score.humanConfidence}%`}
                  </span>{" "}
                  • Risk: <span className="font-semibold text-white">{score.riskLevel}</span>
                </p>
              </div>

              <Card>
                <div className="p-4">
                  <p className="text-xs font-semibold tracking-[0.22em] text-white/60">SCORE BREAKDOWN</p>
                  <div className="mt-3 space-y-3">
                    {(
                      [
                        ["Entropy", score.entropyScore],
                        ["Smoothness", score.smoothnessScore],
                        ["Reaction", score.reactionScore],
                        ["Stability", score.stabilityScore]
                      ] as const
                    ).map(([label, val]) => (
                      <div key={label}>
                        <div className="flex items-center justify-between text-xs text-white/55">
                          <span>{label}</span>
                          <span className="tabular-nums">{val}%</span>
                        </div>
                        <div className={["mt-2 w-full overflow-hidden rounded-full bg-white/10", demo ? "h-2" : "h-1.5"].join(" ")}>
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                            initial={false}
                            animate={{ width: `${val}%` }}
                            transition={{ type: "tween", duration: 0.22, ease: "linear" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="space-y-3">
                {score.riskLevel === "high" ? (
                  <Link
                    href="/voice"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(16,185,129,0.10)]"
                  >
                    Continue with Voice Verification
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onVerified?.(score)}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(16,185,129,0.10)]"
                  >
                    Return to checkout
                  </button>
                )}

                <Link
                  href="/voice"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                >
                  Use voice verification instead
                </Link>

                {onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                  >
                    Back to tickets
                  </button>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50">
        <div className="pointer-events-auto rounded-2xl bg-black/60 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className={["relative", demo ? "h-14 w-14" : "h-11 w-11"].join(" ")}>
              <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.12)" strokeWidth={demo ? 5 : 4} fill="none" />
                <motion.circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke={
                    confidenceDisplay < 50
                      ? "rgba(244,63,94,1)"
                      : confidenceDisplay < 75
                        ? "rgba(251,191,36,1)"
                        : "rgba(52,211,153,1)"
                  }
                  strokeWidth={demo ? 5 : 4}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 18}
                  animate={{ strokeDashoffset: (2 * Math.PI * 18) * (1 - clamp(confidenceDisplay, 0, 100) / 100) }}
                  transition={{ type: "spring", stiffness: 140, damping: 20 }}
                  style={
                    demo
                      ? {
                          filter:
                            confidenceDisplay < 50
                              ? "drop-shadow(0 0 16px rgba(244,63,94,0.55))"
                              : confidenceDisplay < 75
                                ? "drop-shadow(0 0 16px rgba(251,191,36,0.55))"
                                : "drop-shadow(0 0 16px rgba(52,211,153,0.55))"
                        }
                      : undefined
                  }
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                {demo ? (
                  <AnimatedNumber
                    value={clamp(confidenceDisplay, 0, 100)}
                    duration={0.65}
                    format={(n) => `${Math.round(n)}%`}
                    className="text-[12px] font-semibold tabular-nums text-white"
                  />
                ) : (
                  <motion.span
                    className="text-[11px] font-semibold tabular-nums text-white"
                    key={Math.round(confidenceDisplay)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {clamp(Math.round(confidenceDisplay), 0, 100)}%
                  </motion.span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">HUMAN CONFIDENCE</p>
              <p className="mt-0.5 text-[11px] text-white/55">{simulateBot ? "Automation classifier" : "Behavioral entropy analysis"}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-white/45">
        Motion sensors are used only for this demo flow. Baselines reset per step where noted.
      </p>
    </div>
  );
}

