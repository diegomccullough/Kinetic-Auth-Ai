"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDeviceOrientation } from "@/lib/useDeviceOrientation";
import PhoneTiltPreview from "@/components/PhoneTiltPreview";
import { scoreHumanConfidence, type MotionSample, type ScoreBreakdown } from "@/lib/scoring";

type Step = "intro" | "freeTilt" | "directed" | "stabilize" | "result";
type Baseline = { beta: number; gamma: number; alpha: number };

const MAX_FPS = 60;
const CLAMP_TILT_DEG = 35;

const DIRECTED_HOLD_MS = 250;
const DIRECTED_THRESHOLD_DEG = 15;

const MAX_OFFSET_PX = 92;

const STABILITY_WINDOW_SAMPLES = 60; // frames
const STABILITY_AVG_DEVIATION_DEG = 3;
const STABILITY_HOLD_MS = 1500;
const STABILITY_VISUAL_MAX_DEG = 10;
const DOT_FACTOR_PX_PER_DEG = MAX_OFFSET_PX / CLAMP_TILT_DEG;

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

  const [step, setStep] = useState<Step>("intro");
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
        { id: "left", title: "Tilt LEFT", axis: "gamma" as const, dir: -1 },
        { id: "right", title: "Tilt RIGHT", axis: "gamma" as const, dir: 1 },
        { id: "forward", title: "Tilt FORWARD", axis: "beta" as const, dir: 1 }
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
  const [timings, setTimings] = useState<{
    timeToLeft?: number;
    timeToRight?: number;
    timeToForward?: number;
  }>({});

  const stableMsRef = useRef(0);
  const [stablePct, setStablePct] = useState(0);
  const [stabilityPct, setStabilityPct] = useState(0);
  const [avgDeviationDeg, setAvgDeviationDeg] = useState(0);
  const [dot, setDot] = useState({ x: 0, y: 0 });
  const [inside, setInside] = useState(false);
  const devBufRef = useRef<number[]>([]);
  const stabilizeDoneRef = useRef(false);
  const [stabilizeSuccess, setStabilizeSuccess] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

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

  const enableMotion = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  // Set baseline when stabilization starts (neutral = orientation at step entry).
  useEffect(() => {
    if (step !== "stabilize") return;
    baselineRef.current = { ...smoothedRef.current };
    devBufRef.current = [];
    stableMsRef.current = 0;
    stabilizeDoneRef.current = false;
    setStabilizeSuccess(false);
    setStabilityPct(0);
    setStablePct(0);
    setAvgDeviationDeg(0);
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
    };
  }, []);

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
        buf.push({ beta: s.beta, gamma: s.gamma, t });
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
          vibrate(14);
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

        const buf = devBufRef.current;
        const deviation = Math.sqrt(dBeta * dBeta + dGamma * dGamma);
        buf.push(deviation);
        if (buf.length > STABILITY_WINDOW_SAMPLES) buf.shift();

        let sum = 0;
        for (const v of buf) sum += v;
        const avg = buf.length ? sum / buf.length : 0;
        setAvgDeviationDeg((prev) => (Math.abs(prev - avg) > 0.05 ? avg : prev));

        const stability = clamp(100 * (1 - avg / STABILITY_VISUAL_MAX_DEG), 0, 100);
        frameStabilityPct = stability;
        setStabilityPct((prev) => (Math.abs(prev - stability) > 0.5 ? stability : prev));

        const stableEnough = avg < STABILITY_AVG_DEVIATION_DEG;
        stableMsRef.current = stableEnough ? clamp(stableMsRef.current + dtMs, 0, STABILITY_HOLD_MS) : stableMsRef.current;
        const pct = (stableMsRef.current / STABILITY_HOLD_MS) * 100;
        frameHoldPct = pct;

        setInside(stableEnough);
        setStablePct((prev) => (Math.abs(prev - pct) > 0.25 ? pct : prev));

        const x = clamp(dGamma * DOT_FACTOR_PX_PER_DEG, -MAX_OFFSET_PX, MAX_OFFSET_PX);
        const y = clamp(dBeta * DOT_FACTOR_PX_PER_DEG, -MAX_OFFSET_PX, MAX_OFFSET_PX);
        setDot((prev) => {
          const dx = Math.abs(prev.x - x);
          const dy = Math.abs(prev.y - y);
          if (dx < 0.15 && dy < 0.15) return prev;
          return { x, y };
        });

        if (pct >= 100 && !stabilizeDoneRef.current) {
          stabilizeDoneRef.current = true;
          setStabilizeSuccess(true);
          vibrate([18, 24, 18]);
          setConfettiKey((k) => k + 1);

          window.setTimeout(() => {
            setStep("result");
            const final = scoreRef.current;
            if (final.riskLevel !== "high") {
              onVerified?.(final);
            }
          }, 700);
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
  }, [directedIdx, directedSequence, onVerified, stablePct, stabilityPct, step, timings, smoothedRef]);

  const delta = useMemo(() => {
    const base = baselineRef.current;
    if (!base) return { beta: 0, gamma: 0 };
    return { beta: smoothedBeta - base.beta, gamma: smoothedGamma - base.gamma };
  }, [smoothedBeta, smoothedGamma]);

  const directed = directedSequence[directedIdx] ?? directedSequence[0];

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.26em] text-white/60">KINETICAUTH</p>
          <h2 className="mt-2 text-balance text-[22px] font-semibold leading-[1.05] tracking-tight text-white">
            Verification wizard
          </h2>
        </div>
        <ProgressDots step={step} />
      </div>

      <div className="rounded-[24px] bg-white/[0.04] p-4 ring-1 ring-white/10">
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
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">Quick verification required</p>
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
              className="space-y-4"
            >
              <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">STEP 1</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-white">Tilt your phone</p>
                <p className="mt-1 text-sm text-white/65">Try gentle movements. The model mirrors your orientation.</p>
              </div>

              <PhoneTiltPreview beta={smoothedBeta} gamma={smoothedGamma} reduceMotion={!!reduceMotion} />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">BETA</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white">{beta.toFixed(1)}°</p>
                </div>
                <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">GAMMA</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white">{gamma.toFixed(1)}°</p>
                </div>
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
              className="space-y-4"
            >
              <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">STEP 2</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-white">{directed.title}</p>
                <p className="mt-1 text-sm text-white/65">Follow the prompts. Hold briefly to confirm.</p>
              </div>

              <div className="relative">
                <PhoneTiltPreview beta={smoothedBeta} gamma={smoothedGamma} />
                <AnimatePresence>
                  {lastPassed ? (
                    <motion.div
                      key={`${lastPassed}-${directedCheckKey}`}
                      className="pointer-events-none absolute inset-0 grid place-items-center"
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
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

              <Card>
                <div className="p-4">
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>Progress</span>
                    <span className="tabular-nums">{directedIdx + 1}/3</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => {
                      const done = i < directedIdx;
                      const active = i === directedIdx;
                      return (
                        <div key={i} className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            className={[
                              "h-full rounded-full",
                              done ? "bg-emerald-300/90" : active ? "bg-gradient-to-r from-sky-400 to-indigo-400" : "bg-white/10"
                            ].join(" ")}
                            initial={false}
                            animate={{ width: done ? "100%" : active ? `${Math.round(directedHoldPct * 100)}%` : "0%" }}
                            transition={{ type: "tween", duration: 0.16, ease: "linear" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                    <span>Hold to confirm</span>
                    <span className="tabular-nums">{Math.round(directedHoldPct * 100)}%</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/55">
                    <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                      <p className="text-[10px] font-semibold tracking-[0.22em] text-white/55">LEFT</p>
                      <p className="mt-0.5 font-semibold tabular-nums">{timings.timeToLeft ?? "—"}ms</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                      <p className="text-[10px] font-semibold tracking-[0.22em] text-white/55">RIGHT</p>
                      <p className="mt-0.5 font-semibold tabular-nums">{timings.timeToRight ?? "—"}ms</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                      <p className="text-[10px] font-semibold tracking-[0.22em] text-white/55">FWD</p>
                      <p className="mt-0.5 font-semibold tabular-nums">{timings.timeToForward ?? "—"}ms</p>
                    </div>
                  </div>
                </div>
              </Card>

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
              className="space-y-4"
            >
              <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">STEP 3</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-white">Hold steady</p>
                <p className="mt-1 text-sm text-white/65">Neutral is your current orientation. We measure stability relative to that baseline.</p>
              </div>

              <div className="flex items-center justify-center">
                <div className="relative h-[290px] w-[290px]">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{
                      boxShadow: inside
                        ? "0 0 52px rgba(56,189,248,0.22), 0 0 96px rgba(99,102,241,0.16)"
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
                    <circle cx="150" cy="150" r="122" stroke="rgba(255,255,255,0.10)" strokeWidth="10" fill="none" />
                    <motion.circle
                      cx="150"
                      cy="150"
                      r="122"
                      stroke="rgba(56,189,248,0.95)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 122}
                      animate={{ strokeDashoffset: (2 * Math.PI * 122) * (1 - stablePct / 100) }}
                      transition={{ type: "tween", duration: 0.16, ease: "linear" }}
                    />
                  </svg>

                  <div className="absolute inset-0 grid place-items-center">
                    <div className="relative h-[242px] w-[242px] rounded-full">
                      <div className="absolute left-1/2 top-1/2 h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/10" />
                      <motion.div
                        className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200 shadow-[0_0_22px_rgba(56,189,248,0.65)]"
                        animate={{ x: dot.x, y: dot.y, scale: stablePct >= 100 ? 1.25 : 1 }}
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

              <Card>
                <div className="p-4">
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>Avg deviation</span>
                    <span className="tabular-nums">{avgDeviationDeg.toFixed(1)}°</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className={[
                        "h-full rounded-full",
                        avgDeviationDeg < STABILITY_AVG_DEVIATION_DEG
                          ? "bg-gradient-to-r from-emerald-300/90 to-sky-300/90"
                          : "bg-gradient-to-r from-sky-400 to-indigo-400"
                      ].join(" ")}
                      initial={false}
                      animate={{ width: `${Math.round(stabilityPct)}%` }}
                      transition={{ type: "tween", duration: 0.16, ease: "linear" }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                    <span>Hold avg &lt; {STABILITY_AVG_DEVIATION_DEG}°</span>
                    <span className="tabular-nums">{Math.round(stablePct)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                      initial={false}
                      animate={{ width: `${Math.round(stablePct)}%` }}
                      transition={{ type: "tween", duration: 0.16, ease: "linear" }}
                    />
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">Δ BETA</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white">{delta.beta.toFixed(1)}°</p>
                </div>
                <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">Δ GAMMA</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white">{delta.gamma.toFixed(1)}°</p>
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
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {score.riskLevel === "high" ? "Try voice verification" : "Verified"}
                </p>
                <p className="mt-1 text-sm text-white/65">
                  Human Confidence: <span className="font-semibold text-white">{score.humanConfidence}%</span> • Risk:{" "}
                  <span className="font-semibold text-white">{score.riskLevel}</span>
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
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
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
          <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">HUMAN CONFIDENCE</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{clamp(score.humanConfidence, 0, 100)}%</p>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-white/45">
        Motion sensors are used only for this demo flow. Baselines reset per step where noted.
      </p>
    </div>
  );
}

