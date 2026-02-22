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
const DIRECTED_THRESHOLD_DEG = 18;

const STABLE_RADIUS_PX = 36;
const STABLE_TARGET_MS = 1650;
const MAX_OFFSET_PX = 92;

const STABILITY_WINDOW_SAMPLES = 60;
const STABILITY_THRESHOLD_PCT = 80;
const STABILITY_HOLD_MS = 1500;
const STABILITY_MAX_RMS_DEG = 22;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function mapTiltToPx(deg: number) {
  const unit = clamp(deg / CLAMP_TILT_DEG, -1, 1);
  return unit * MAX_OFFSET_PX;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
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

function PhoneModel({
  beta,
  gamma,
  reduceMotion
}: {
  beta: number;
  gamma: number;
  reduceMotion: boolean | null;
}) {
  const rx = clamp(-beta / 60, -0.65, 0.65) * 22;
  const ry = clamp(gamma / 60, -0.65, 0.65) * 28;

  return (
    <div className="relative mx-auto h-[240px] w-[240px]">
      <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.10)_0%,rgba(0,0,0,0)_62%)] blur-2xl" />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[210px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-[26px] bg-gradient-to-b from-white/10 to-white/[0.02] ring-1 ring-white/15"
        style={{ transformStyle: "preserve-3d" }}
        animate={reduceMotion ? undefined : { rotateX: rx, rotateY: ry }}
        transition={{ type: "spring", stiffness: 170, damping: 18, mass: 0.35 }}
      >
        <div className="absolute inset-[10px] rounded-[20px] bg-black/55 ring-1 ring-white/10" />
        <div className="absolute left-1/2 top-3 h-2 w-10 -translate-x-1/2 rounded-full bg-white/10 ring-1 ring-white/10" />
        <div className="absolute bottom-4 left-1/2 h-10 w-[84px] -translate-x-1/2 rounded-2xl bg-white/[0.04] ring-1 ring-white/10" />
        <div className="absolute inset-0 rounded-[26px] bg-[radial-gradient(circle_at_50%_25%,rgba(56,189,248,0.16)_0%,rgba(99,102,241,0.08)_35%,rgba(0,0,0,0)_72%)]" />
      </motion.div>
    </div>
  );
}

export default function VerifyPage() {
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<Step>("intro");
  const {
    beta,
    gamma,
    alpha,
    smoothedBeta,
    smoothedGamma,
    smoothedAlpha,
    smoothedRef,
    available,
    permissionState,
    requestPermission
  } = useDeviceOrientation();

  const baselineRef = useRef<Baseline | null>(null);

  const motionWindowRef = useRef<MotionSample[]>([]);
  const [score, setScore] = useState<ScoreBreakdown>(() =>
    scoreHumanConfidence({ motionSamples: [], directedTimings: undefined, stabilityPct: 0, stabilityHoldPct: 0 })
  );

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
  const [dot, setDot] = useState({ x: 0, y: 0 });
  const [inside, setInside] = useState(false);
  const devBufRef = useRef<number[]>([]);
  const stabilizeDoneRef = useRef(false);
  const [stabilizeSuccess, setStabilizeSuccess] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  const confetti = useMemo(() => {
    // Small deterministic-ish burst per success.
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

  useEffect(() => {
    if (step === "result") {
      vibrate(20);
    }
  }, [step]);

  // Set baseline when stabilization starts (neutral = orientation at start).
  useEffect(() => {
    if (step !== "stabilize") return;
    baselineRef.current = { ...smoothedRef.current };
    devBufRef.current = [];
    stableMsRef.current = 0;
    stabilizeDoneRef.current = false;
    setStabilizeSuccess(false);
    setStabilityPct(0);
    setStablePct(0);
    setDot({ x: 0, y: 0 });
    setInside(false);
  }, [smoothedAlpha, smoothedBeta, smoothedGamma, step]);

  // Reset directed state when entering directed.
  useEffect(() => {
    if (step !== "directed") return;
    setDirectedIdx(0);
    directedHoldRef.current = 0;
    setDirectedHoldPct(0);
    directedPromptStartRef.current = performance.now();
    setLastPassed(null);
    setTimings({});
    if (directedAdvanceTimerRef.current) window.clearTimeout(directedAdvanceTimerRef.current);
    directedAdvanceTimerRef.current = null;
  }, [step]);

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

  // Reset stabilization visuals when entering stabilize (baseline handled above).
  useEffect(() => {
    if (step !== "stabilize") return;
      stableMsRef.current = 0;
      setStablePct(0);
      setDot({ x: 0, y: 0 });
      setInside(false);
  }, [step]);

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

      // Replace heuristic confidence with scoring module (updated live).
      // We'll compute frame-local stability below when stabilizing.
      let frameStabilityPct = stabilityPct;
      let frameHoldPct = stablePct;

      if (step === "directed") {
        const current = directedSequence[directedIdx];
        const ok =
          current.id === "left"
            ? s.gamma < -DIRECTED_THRESHOLD_DEG
            : current.id === "right"
              ? s.gamma > DIRECTED_THRESHOLD_DEG
              : s.beta > DIRECTED_THRESHOLD_DEG;

        // Require the condition continuously for >= 250ms.
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

        const mag2 = dBeta * dBeta + dGamma * dGamma;
        const buf = devBufRef.current;
        buf.push(mag2);
        if (buf.length > STABILITY_WINDOW_SAMPLES) buf.shift();

        let mean = 0;
        for (const v of buf) mean += v;
        mean = buf.length ? mean / buf.length : 0;
        const rms = Math.sqrt(mean);
        const stability = clamp(100 * (1 - rms / STABILITY_MAX_RMS_DEG), 0, 100);
        frameStabilityPct = stability;

        setStabilityPct((prev) => (Math.abs(prev - stability) > 0.5 ? stability : prev));

        const stableEnough = stability >= STABILITY_THRESHOLD_PCT;

        const add = stableEnough ? dtMs : -dtMs * 0.9;
        stableMsRef.current = clamp(stableMsRef.current + add, 0, STABILITY_HOLD_MS);
        const pct = (stableMsRef.current / STABILITY_HOLD_MS) * 100;
        frameHoldPct = pct;

        setInside(stableEnough);
        setStablePct((prev) => (Math.abs(prev - pct) > 0.25 ? pct : prev));

        const x = mapTiltToPx(dGamma);
        const y = mapTiltToPx(dBeta);
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
          window.setTimeout(() => setStep("result"), 950);
        }
        return;
      }

      if (step === "intro") {
        // Keep scoring running (will reflect low/no motion).
        return;
      }

      if (step === "result") {
        // Freeze-ish: keep last computed score.
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
  }, [directedIdx, directedSequence, permissionState, stablePct, stabilityPct, step, timings]);

  const delta = useMemo(() => {
    const base = baselineRef.current;
    if (!base) return { beta: 0, gamma: 0 };
    return { beta: smoothedBeta - base.beta, gamma: smoothedGamma - base.gamma };
  }, [smoothedBeta, smoothedGamma]);

  const directed = directedSequence[directedIdx] ?? directedSequence[0];

  const content = (
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
            <p className="mt-2 text-2xl font-semibold tracking-tight">Quick verification required</p>
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
                  <li>Open <span className="font-semibold text-white/85">Settings</span></li>
                  <li>Scroll to <span className="font-semibold text-white/85">Safari</span></li>
                  <li>Enable <span className="font-semibold text-white/85">Motion &amp; Orientation Access</span></li>
                  <li>Return here and tap <span className="font-semibold text-white/85">Enable motion</span></li>
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
            <p className="mt-2 text-xl font-semibold tracking-tight">Tilt your phone</p>
            <p className="mt-1 text-sm text-white/65">Try gentle movements. The model mirrors your orientation.</p>
          </div>

          <PhoneTiltPreview beta={beta} gamma={gamma} reduceMotion={!!reduceMotion} />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">BETA</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{beta.toFixed(1)}°</p>
            </div>
            <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">GAMMA</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{gamma.toFixed(1)}°</p>
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
            <p className="mt-2 text-xl font-semibold tracking-tight">{directed.title}</p>
            <p className="mt-1 text-sm text-white/65">Follow the prompts. Hold briefly to confirm.</p>
          </div>

          <div className="relative">
            <PhoneTiltPreview beta={beta} gamma={gamma} />
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
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">BETA</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{smoothedBeta.toFixed(1)}°</p>
                </div>
                <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">GAMMA</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{smoothedGamma.toFixed(1)}°</p>
                </div>
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
            <p className="mt-2 text-xl font-semibold tracking-tight">Hold steady</p>
            <p className="mt-1 text-sm text-white/65">
              Neutral is your current orientation. We measure stability relative to that baseline.
            </p>
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
                <span>Stability</span>
                <span className="tabular-nums">{Math.round(stabilityPct)}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={[
                    "h-full rounded-full",
                    stabilityPct >= STABILITY_THRESHOLD_PCT
                      ? "bg-gradient-to-r from-emerald-300/90 to-sky-300/90"
                      : "bg-gradient-to-r from-sky-400 to-indigo-400"
                  ].join(" ")}
                  initial={false}
                  animate={{ width: `${Math.round(stabilityPct)}%` }}
                  transition={{ type: "tween", duration: 0.16, ease: "linear" }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                <span>Hold ≥ {STABILITY_THRESHOLD_PCT}%</span>
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
              <p className="mt-1 text-lg font-semibold tabular-nums">{delta.beta.toFixed(1)}°</p>
            </div>
            <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">Δ GAMMA</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{delta.gamma.toFixed(1)}°</p>
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
            <p className="text-xs font-semibold tracking-[0.22em] text-white/60">VERIFIED</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">Verified</p>
            <p className="mt-1 text-sm text-white/65">
              Human Confidence: <span className="font-semibold text-white">{score.humanConfidence}%</span> • Risk:{" "}
              <span className="font-semibold text-white">{score.riskLevel}</span>
            </p>
          </div>

          <motion.div
            className="relative mx-auto grid h-[190px] w-full place-items-center overflow-hidden rounded-[26px] bg-black/30 ring-1 ring-white/10"
            initial={reduceMotion ? false : { scale: 0.98, opacity: 0.9 }}
            animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.18)_0%,rgba(16,185,129,0.14)_28%,rgba(0,0,0,0)_70%)]" />
            <motion.div
              className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"
              animate={
                reduceMotion
                  ? undefined
                  : { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 70px rgba(16,185,129,0.16)", "0 0 0 rgba(0,0,0,0)"] }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="h-3 w-7 rounded-full bg-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.35)]" />
            </motion.div>
          </motion.div>

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
              <Link
                href="/?verified=true"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(16,185,129,0.10)]"
              >
                Continue to Checkout
              </Link>
            )}

            <Link
              href="/voice"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
            >
              Use voice verification instead
            </Link>

            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
            >
              Back to tickets
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <main className="min-h-dvh px-4 pb-10 pt-8">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(56,189,248,0.22)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,1)_76%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_25%,rgba(255,255,255,0.10)_0%,rgba(0,0,0,0)_62%)]" />

          <div className="relative px-5 pb-6 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.26em] text-white/60">SECURE CHECKOUT</p>
                <h1 className="mt-2 text-balance text-[28px] font-semibold leading-[1.05] tracking-tight">
                  Verification wizard
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <ProgressDots step={step} />
                <Link
                  href="/"
                  className="shrink-0 rounded-2xl bg-white/5 px-3 py-2 text-xs font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/10"
                >
                  Exit
                </Link>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] bg-white/[0.04] p-4 ring-1 ring-white/10">{content}</div>

            <div className="pointer-events-none fixed bottom-5 right-5 z-50">
              <div className="pointer-events-auto rounded-2xl bg-black/60 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">HUMAN CONFIDENCE</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">{clamp(score.humanConfidence, 0, 100)}%</p>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-white/45">
              Motion sensors are used only for this demo flow. Baselines reset per step where noted.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

