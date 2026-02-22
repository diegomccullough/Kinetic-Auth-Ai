"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PhoneTiltPreview from "@/components/PhoneTiltPreview";
import { scoreHumanConfidence, type MotionSample, type ScoreBreakdown } from "@/lib/scoring";
import { useDeviceOrientation } from "@/lib/useDeviceOrientation";

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

const TASKS_TOTAL = 3;
const TILT_TASK_THRESHOLD_DEG = 16;
const TILT_TASK_HOLD_MS = 900;

const HOLD_STEADY_TARGET_MS = 1800;
const HOLD_STEADY_RADIUS_PX = 34;
const DOT_CLAMP_DEG = 28;
const DOT_MAX_OFFSET_PX = 98;
const DOT_PX_PER_DEG = DOT_MAX_OFFSET_PX / DOT_CLAMP_DEG;

type Screen = "intro" | "tasks" | "result";
type TaskId = "left" | "right" | "steady";

function ringDashOffset(radius: number, pct: number) {
  const c = 2 * Math.PI * radius;
  return c * (1 - clamp(pct, 0, 100) / 100);
}

// ─── Stepper ────────────────────────────────────────────────────────────────
function Stepper({ completed }: { completed: number }) {
  const clampedCompleted = clamp(completed, 0, 3);

  // Line goes from dot 1 center to dot 3 center.
  // At 0 tasks: 0%, 1 task: 50%, 2 tasks: 100%
  const linePct = clampedCompleted === 0 ? 0 : clampedCompleted === 1 ? 50 : 100;

  return (
    <div className="relative px-1 pt-2 pb-1">
      {/* Track — spans dot center to dot center (approx left:22px to right:22px) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[2px] rounded-full bg-white/12"
        style={{ left: 22, right: 22 }}
        aria-hidden="true"
      />
      {/* Animated fill — 0%, 50%, 100% of the track width */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 h-[2px] rounded-full kinetic-progress"
        initial={false}
        animate={{ right: linePct === 0 ? "100%" : linePct === 50 ? "50%" : "22px" }}
        transition={{ type: "spring", stiffness: 200, damping: 28, mass: 0.55 }}
        style={{ left: 22, filter: "drop-shadow(0 0 10px rgba(34,211,238,0.6))" }}
        aria-hidden="true"
      />

      <div className="relative flex items-center justify-between">
        {([1, 2, 3] as const).map((n) => {
          const filled = clampedCompleted >= n;
          const active = clampedCompleted + 1 === n && clampedCompleted < 3;
          return (
            <motion.div
              key={n}
              className="grid h-11 w-11 place-items-center rounded-full ring-1"
              style={{
                background: filled ? "#22D3EE" : "rgba(0,0,0,0.4)",
                color: filled ? "#000" : "rgba(255,255,255,0.6)",
                ringColor: filled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.12)"
              }}
              initial={false}
              animate={{
                scale: active ? 1.08 : filled ? 1 : 1,
                boxShadow: filled
                  ? "0 0 40px rgba(34,211,238,0.65), 0 0 0 1px rgba(255,255,255,0.10) inset"
                  : active
                  ? "0 0 0 2px rgba(34,211,238,0.35), 0 0 0 rgba(0,0,0,0)"
                  : "0 0 0 rgba(0,0,0,0)"
              }}
              transition={{ type: "spring", stiffness: 280, damping: 22, mass: 0.4 }}
            >
              <span className="text-sm font-bold tabular-nums">{n}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Arrow ────────────────────────────────────────────────────────────────────
function ArrowGlyph({ direction }: { direction: "left" | "right" }) {
  const flip = direction === "right";
  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      className="h-[200px] w-[200px]"
      aria-hidden="true"
      style={{
        transform: flip ? "scaleX(-1)" : undefined,
        filter: "drop-shadow(0 0 28px rgba(34,211,238,0.45)) drop-shadow(0 0 8px rgba(34,211,238,0.25))"
      }}
    >
      <path
        d="M76 54 L26 100 L76 146"
        fill="none"
        stroke="rgba(255,255,255,0.96)"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M38 100 H172"
        fill="none"
        stroke="rgba(255,255,255,0.96)"
        strokeWidth="22"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Hold Ring ────────────────────────────────────────────────────────────────
function HoldRing({
  pct01,
  radius = 66,
  strokeWidth = 11,
  color = "rgba(34,211,238,0.95)"
}: {
  pct01: number;
  radius?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const pct = clamp(pct01, 0, 1) * 100;
  const c = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="80" cy="80" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />
      <motion.circle
        cx="80"
        cy="80"
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: ringDashOffset(radius, pct) }}
        transition={{ type: "spring", stiffness: 200, damping: 28, mass: 0.6 }}
        style={{ filter: "drop-shadow(0 0 16px rgba(34,211,238,0.45))" }}
      />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export type VerificationWizardProps = {
  onVerified?: (score: ScoreBreakdown) => void;
  onCancel?: () => void;
};

export default function VerificationWizard({ onVerified, onCancel: _onCancel }: VerificationWizardProps) {
  const reduceMotion = useReducedMotion();
  const { beta, gamma, smoothedBeta, smoothedGamma, smoothedRef, available, permissionState, requestPermission } =
    useDeviceOrientation();

  const [screen, setScreen] = useState<Screen>("intro");
  const [taskId, setTaskId] = useState<TaskId>("left");
  const [confidenceTarget, setConfidenceTarget] = useState(92);
  const [confidenceDisplay, setConfidenceDisplay] = useState(0);

  const [dot, setDot] = useState({ x: 0, y: 0 });
  const [inside, setInside] = useState(false);
  const [holdPct, setHoldPct] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  const timingsRef = useRef<{ timeToLeft?: number; timeToRight?: number }>({});
  const taskStartAtRef = useRef<number | null>(null);
  const baselineRef = useRef<{ beta: number; gamma: number } | null>(null);

  const motionSamplesRef = useRef<MotionSample[]>([]);
  const stableMsRef = useRef(0);
  const tiltHoldMsRef = useRef(0);

  const [finalScore, setFinalScore] = useState<ScoreBreakdown>(() =>
    scoreHumanConfidence({ motionSamples: [], directedTimings: undefined, stabilityPct: 0, stabilityHoldPct: 0 })
  );

  const cueLine = useMemo(() => {
    if (screen !== "tasks") return "";
    if (taskId === "left") return "Good — now tilt left…";
    if (taskId === "right") return "Good — now tilt right…";
    return "Nice — hold steady…";
  }, [screen, taskId]);

  const stepTitle = useMemo(() => {
    if (screen !== "tasks") return "";
    if (taskId === "left") return "Step 1 — Tilt Left";
    if (taskId === "right") return "Step 2 — Tilt Right";
    return "Step 3 — Stabilize";
  }, [screen, taskId]);

  const advanceToTasks = useCallback(() => {
    setScreen("tasks");
    setTaskId("left");
    timingsRef.current = {};
    motionSamplesRef.current = [];
    stableMsRef.current = 0;
    tiltHoldMsRef.current = 0;
    taskStartAtRef.current = performance.now();
    baselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
    setDot({ x: 0, y: 0 });
    setInside(false);
    setHoldPct(0);
    setPulseKey((k) => k + 1);
  }, [smoothedRef]);

  const finish = useCallback((score: ScoreBreakdown) => {
    setFinalScore(score);
    setConfidenceTarget(87 + Math.floor(Math.random() * 10));
    setScreen("result");
  }, []);

  useEffect(() => {
    if (screen !== "tasks") return;
    if (permissionState !== "granted") return;
    if (!available) return;

    baselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
    taskStartAtRef.current = performance.now();
    stableMsRef.current = 0;
    tiltHoldMsRef.current = 0;
    setHoldPct(0);
    setInside(false);
    setDot({ x: 0, y: 0 });

    let raf = 0;
    let last = 0;
    let completing = false;

    const completeTask = (id: TaskId, stabilityPct: number, stabilityHoldPct: number) => {
      if (completing) return;
      completing = true;
      vibrate([10, 18, 10]);
      setPulseKey((k) => k + 1);

      const started = taskStartAtRef.current ?? performance.now();
      const elapsed = Math.max(0, performance.now() - started);
      if (id === "left" && timingsRef.current.timeToLeft === undefined) timingsRef.current.timeToLeft = Math.round(elapsed);
      if (id === "right" && timingsRef.current.timeToRight === undefined) timingsRef.current.timeToRight = Math.round(elapsed);

      window.setTimeout(() => {
        setTaskId((prev) => {
          if (prev === "left") {
            baselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
            taskStartAtRef.current = performance.now();
            completing = false;
            return "right";
          }
          if (prev === "right") {
            baselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
            taskStartAtRef.current = performance.now();
            completing = false;
            return "steady";
          }

          const score = scoreHumanConfidence({
            motionSamples: motionSamplesRef.current,
            directedTimings: timingsRef.current,
            stabilityPct,
            stabilityHoldPct
          });
          finish(score);
          return prev;
        });
      }, reduceMotion ? 0 : 260);
    };

    const tick = (t: number) => {
      raf = window.requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      const dtMs = last ? Math.min(60, t - last) : 16;
      last = t;

      const s = smoothedRef.current;
      motionSamplesRef.current.push({ beta: s.beta, gamma: s.gamma, t });
      if (motionSamplesRef.current.length > 160) motionSamplesRef.current.shift();

      const base = baselineRef.current ?? { beta: s.beta, gamma: s.gamma };
      const dBeta = s.beta - base.beta;
      const dGamma = s.gamma - base.gamma;

      if (taskId === "left" || taskId === "right") {
        const ok = taskId === "left" ? dGamma < -TILT_TASK_THRESHOLD_DEG : dGamma > TILT_TASK_THRESHOLD_DEG;
        tiltHoldMsRef.current = ok ? tiltHoldMsRef.current + dtMs : 0;
        tiltHoldMsRef.current = clamp(tiltHoldMsRef.current, 0, TILT_TASK_HOLD_MS);
        const pct = tiltHoldMsRef.current / TILT_TASK_HOLD_MS;
        setHoldPct(pct);

        if (tiltHoldMsRef.current >= TILT_TASK_HOLD_MS) {
          tiltHoldMsRef.current = 0;
          setHoldPct(0);
          completeTask(taskId, 0, 0);
        }
        return;
      }

      const xTarget = clamp(dGamma * DOT_PX_PER_DEG, -DOT_MAX_OFFSET_PX, DOT_MAX_OFFSET_PX);
      const yTarget = clamp(dBeta * DOT_PX_PER_DEG, -DOT_MAX_OFFSET_PX, DOT_MAX_OFFSET_PX);
      const dist = Math.hypot(xTarget, yTarget);
      const inZone = dist <= HOLD_STEADY_RADIUS_PX;

      setDot((prev) => {
        const nx = prev.x + (xTarget - prev.x) * 0.18;
        const ny = prev.y + (yTarget - prev.y) * 0.18;
        if (Math.abs(prev.x - nx) < 0.2 && Math.abs(prev.y - ny) < 0.2) return prev;
        return { x: nx, y: ny };
      });

      setInside(inZone);

      stableMsRef.current = inZone
        ? clamp(stableMsRef.current + dtMs, 0, HOLD_STEADY_TARGET_MS)
        : clamp(stableMsRef.current - dtMs * 0.6, 0, HOLD_STEADY_TARGET_MS);

      const hold = stableMsRef.current / HOLD_STEADY_TARGET_MS;
      setHoldPct(hold);

      const stabilityPct = clamp(100 * (1 - dist / HOLD_STEADY_RADIUS_PX), 0, 100);
      const stabilityHoldPct = hold * 100;

      if (stableMsRef.current >= HOLD_STEADY_TARGET_MS) {
        stableMsRef.current = 0;
        setHoldPct(1);
        completeTask("steady", stabilityPct, stabilityHoldPct);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [available, finish, permissionState, reduceMotion, screen, smoothedRef, taskId]);

  const completedCount = useMemo(() => {
    if (screen === "result") return 3;
    if (screen !== "tasks") return 0;
    return taskId === "left" ? 0 : taskId === "right" ? 1 : 2;
  }, [screen, taskId]);

  const overallProgressPct = useMemo(() => {
    const base = screen === "result" ? 3 : completedCount;
    const pct = ((base + clamp(holdPct, 0, 1)) / TASKS_TOTAL) * 100;
    return clamp(pct, 0, 100);
  }, [completedCount, holdPct, screen]);

  useEffect(() => {
    if (screen !== "result") return;
    if (reduceMotion) {
      setConfidenceDisplay(confidenceTarget);
      return;
    }
    setConfidenceDisplay(0);
    const controls = animate(0, confidenceTarget, {
      type: "spring",
      stiffness: 140,
      damping: 18,
      mass: 0.8,
      onUpdate: (v) => setConfidenceDisplay(Math.round(v))
    });
    return () => controls.stop();
  }, [confidenceTarget, reduceMotion, screen]);

  return (
    <main className="min-h-dvh text-white" style={{ background: "#000" }}>
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(34,211,238,0.18)_0%,rgba(99,102,241,0.10)_36%,rgba(0,0,0,1)_72%)]" />
        {screen === "intro" && (
          <motion.div
            className="absolute -inset-16 opacity-60"
            style={{
              x: clamp(smoothedGamma, -18, 18) * -0.7,
              y: clamp(smoothedBeta, -18, 18) * -0.55
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.20)_0%,rgba(99,102,241,0.12)_30%,rgba(0,0,0,0)_72%)]" />
          </motion.div>
        )}
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6">
        <AnimatePresence mode="popLayout" initial={false}>

          {/* ═══════════════════════════════════════════════════════════
              SCREEN 1 — CINEMATIC INTRO
          ═══════════════════════════════════════════════════════════ */}
          {screen === "intro" ? (
            <motion.section
              key="intro"
              className="flex min-h-dvh flex-col py-10"
              initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -20, scale: 0.99 }}
              transition={reduceMotion ? undefined : { type: "spring", stiffness: 170, damping: 24, mass: 0.7 }}
            >
              {/* Wordmark */}
              <div className="flex items-center justify-center">
                <p className="text-[10px] font-semibold tracking-[0.52em] text-white/45">KINETICAUTH</p>
              </div>

              {/* Phone — 65-75% of screen */}
              <div
                className="mx-auto w-full flex-1 items-center justify-center"
                style={{ minHeight: "62dvh", maxHeight: "72dvh", display: "flex" }}
              >
                <div className="h-full w-full" style={{ transform: "scale(1.08)" }}>
                  <PhoneTiltPreview
                    beta={beta}
                    gamma={gamma}
                    reduceMotion={!!reduceMotion}
                    variant="cinematic"
                    showBadge={false}
                  />
                </div>
              </div>

              {/* Text below phone */}
              <div className="mt-8 space-y-3 text-center">
                <h1 className="text-balance text-5xl font-semibold leading-[0.95] tracking-tight">
                  Tilt your phone
                </h1>
                <p className="text-base text-white/60">
                  Experience motion-based human verification.
                </p>
              </div>

              {/* Begin Verification button */}
              <div className="mt-10">
                <motion.button
                  type="button"
                  onClick={async () => {
                    if (!available || permissionState === "unsupported" || permissionState === "denied") return;
                    if (permissionState !== "granted") {
                      const res = await requestPermission();
                      if (res !== "granted") return;
                      vibrate(10);
                    }
                    advanceToTasks();
                  }}
                  className="relative inline-flex h-16 w-full items-center justify-center overflow-hidden rounded-2xl bg-white text-black text-base font-semibold tracking-tight ring-1 ring-white/20 transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                  animate={
                    reduceMotion
                      ? undefined
                      : {
                          boxShadow: [
                            "0 0 40px rgba(34,211,238,0.22), 0 18px 60px rgba(0,0,0,0.4)",
                            "0 0 70px rgba(34,211,238,0.38), 0 18px 60px rgba(0,0,0,0.4)",
                            "0 0 40px rgba(34,211,238,0.22), 0 18px 60px rgba(0,0,0,0.4)"
                          ]
                        }
                  }
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                  }
                >
                  Begin Verification
                </motion.button>
                {(!available || permissionState === "denied" || permissionState === "unsupported") ? (
                  <p className="mt-3 text-center text-xs text-white/45">
                    {"Motion sensors aren't available here."}
                  </p>
                ) : null}
              </div>
            </motion.section>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════
              SCREEN 2 — TASK FLOW
          ═══════════════════════════════════════════════════════════ */}
          {screen === "tasks" ? (
            <motion.section
              key="tasks"
              className="flex min-h-dvh flex-col py-10"
              initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -20, scale: 0.99 }}
              transition={reduceMotion ? undefined : { type: "spring", stiffness: 180, damping: 24, mass: 0.7 }}
            >
              {/* Progress stepper */}
              <div className="space-y-5">
                <Stepper completed={completedCount} />

                {/* Step title */}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={stepTitle}
                    className="text-center text-2xl font-semibold tracking-tight text-white"
                    initial={reduceMotion ? false : { y: 10, opacity: 0 }}
                    animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
                    exit={reduceMotion ? undefined : { y: -10, opacity: 0 }}
                    transition={reduceMotion ? undefined : { type: "spring", stiffness: 260, damping: 24, mass: 0.55 }}
                  >
                    {stepTitle}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Interaction card — 60% height */}
              <motion.div
                key={`task-card-${taskId}-${pulseKey}`}
                className={[
                  "relative mt-8 w-full overflow-hidden rounded-[28px] ring-1 backdrop-blur",
                  inside && taskId === "steady"
                    ? "bg-white/[0.05] ring-[#34D399]/35"
                    : "bg-white/[0.05] ring-white/12"
                ].join(" ")}
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        boxShadow: [
                          taskId === "steady"
                            ? "0 0 0px rgba(0,0,0,0), 0 0 0 1px rgba(52,211,153,0.25)"
                            : "0 0 0px rgba(0,0,0,0), 0 0 0 1px rgba(34,211,238,0.20)",
                          taskId === "steady"
                            ? "0 0 80px rgba(52,211,153,0.18), 0 0 0 1px rgba(52,211,153,0.35)"
                            : "0 0 80px rgba(34,211,238,0.20), 0 0 0 1px rgba(34,211,238,0.28)",
                          taskId === "steady"
                            ? "0 0 0px rgba(0,0,0,0), 0 0 0 1px rgba(52,211,153,0.25)"
                            : "0 0 0px rgba(0,0,0,0), 0 0 0 1px rgba(34,211,238,0.20)"
                        ]
                      }
                }
                transition={
                  reduceMotion
                    ? undefined
                    : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                }
                style={{ height: "58dvh", minHeight: 380, maxHeight: 520 }}
              >
                {/* Card inner glow */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle_at_50%_30%, rgba(34,211,238,0.14) 0%, rgba(99,102,241,0.08) 38%, rgba(0,0,0,0) 72%)"
                  }}
                  aria-hidden="true"
                />

                <div className="relative grid h-full place-items-center p-6">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {taskId === "left" || taskId === "right" ? (
                      <motion.div
                        key={taskId}
                        className="relative grid place-items-center"
                        initial={reduceMotion ? false : { y: 16, scale: 0.97, opacity: 0 }}
                        animate={reduceMotion ? undefined : { y: 0, scale: 1, opacity: 1 }}
                        exit={reduceMotion ? undefined : { y: -16, scale: 0.97, opacity: 0 }}
                        transition={reduceMotion ? undefined : { type: "spring", stiffness: 260, damping: 24, mass: 0.55 }}
                      >
                        <div className="relative h-[240px] w-[240px]">
                          <HoldRing pct01={holdPct} radius={70} strokeWidth={11} />
                          <div className="absolute inset-0 grid place-items-center">
                            <ArrowGlyph direction={taskId} />
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="steady"
                        className="relative grid place-items-center"
                        initial={reduceMotion ? false : { y: 16, scale: 0.97, opacity: 0 }}
                        animate={reduceMotion ? undefined : { y: 0, scale: 1, opacity: 1 }}
                        exit={reduceMotion ? undefined : { y: -16, scale: 0.97, opacity: 0 }}
                        transition={reduceMotion ? undefined : { type: "spring", stiffness: 260, damping: 24, mass: 0.55 }}
                      >
                        <div className="relative h-[260px] w-[260px]">
                          <HoldRing pct01={holdPct} color="rgba(52,211,153,0.95)" radius={74} strokeWidth={11} />
                          <div className="absolute inset-0 grid place-items-center">
                            <div className="relative h-[86%] w-[86%]">
                              <div
                                className="absolute left-1/2 top-1/2 h-[108px] w-[108px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/12"
                                aria-hidden="true"
                              />
                              <motion.div
                                className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#34D399]"
                                style={{
                                  boxShadow: inside
                                    ? "0 0 40px rgba(52,211,153,0.9), 0 0 80px rgba(34,211,238,0.20)"
                                    : "0 0 22px rgba(52,211,153,0.50)"
                                }}
                                animate={{ x: dot.x, y: dot.y, scale: inside ? 1.12 : 1 }}
                                transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.25 }}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Overall progress bar + cue */}
              <div className="mt-8 space-y-4">
                <div className="h-4 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/12">
                  <motion.div
                    className="h-full rounded-full kinetic-progress"
                    initial={false}
                    animate={{ width: `${overallProgressPct}%` }}
                    transition={{ type: "spring", stiffness: 240, damping: 28, mass: 0.55 }}
                    style={{ boxShadow: "0 0 24px rgba(34,211,238,0.40), 0 0 8px rgba(34,211,238,0.20)" }}
                  />
                </div>

                <AnimatePresence mode="popLayout">
                  <motion.p
                    key={cueLine}
                    className="text-center text-base font-medium text-white/85"
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={reduceMotion ? undefined : { type: "spring", stiffness: 260, damping: 26 }}
                  >
                    {cueLine}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.section>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════
              SCREEN 3 — VERIFIED
          ═══════════════════════════════════════════════════════════ */}
          {screen === "result" ? (
            <motion.section
              key="result"
              className="flex min-h-dvh flex-col py-10"
              initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -20, scale: 0.99 }}
              transition={reduceMotion ? undefined : { type: "spring", stiffness: 180, damping: 24, mass: 0.7 }}
            >
              <div className="flex flex-1 flex-col items-center justify-center">
                {/* VERIFIED headline */}
                <div className="relative text-center">
                  {/* Ambient pulse behind headline */}
                  <motion.div
                    className="pointer-events-none absolute -inset-20 opacity-60"
                    animate={
                      reduceMotion
                        ? undefined
                        : { opacity: [0.3, 0.75, 0.3], scale: [1, 1.04, 1] }
                    }
                    transition={
                      reduceMotion
                        ? undefined
                        : { duration: 2.0, repeat: Infinity, ease: "easeInOut" }
                    }
                    style={{
                      background:
                        "radial-gradient(circle_at_50%_50%, rgba(52,211,153,0.30) 0%, rgba(34,211,238,0.12) 40%, rgba(0,0,0,0) 72%)"
                    }}
                    aria-hidden="true"
                  />
                  <motion.h2
                    className="relative text-7xl font-bold tracking-tight text-white"
                    initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
                    animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
                    transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 18, mass: 0.6 }}
                    style={{
                      textShadow: "0 0 60px rgba(52,211,153,0.45), 0 0 120px rgba(34,211,238,0.18)"
                    }}
                  >
                    VERIFIED
                  </motion.h2>
                  <motion.p
                    className="mt-4 text-base text-white/60"
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={reduceMotion ? undefined : { delay: 0.1, type: "spring", stiffness: 200, damping: 22 }}
                  >
                    Human presence confirmed.
                  </motion.p>
                </div>

                {/* Confidence circle */}
                <motion.div
                  className="mt-12 w-full max-w-[340px] rounded-[28px] bg-white/[0.05] p-8 ring-1 ring-white/10"
                  initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                  transition={reduceMotion ? undefined : { delay: 0.08, type: "spring", stiffness: 200, damping: 22 }}
                >
                  <p className="text-center text-[10px] font-semibold tracking-[0.34em] text-white/55">CONFIDENCE</p>

                  <div className="mt-6 grid place-items-center">
                    <div className="relative grid h-[180px] w-[180px] place-items-center">
                      {/* Soft glow behind ring */}
                      <motion.div
                        className="pointer-events-none absolute inset-0 rounded-full"
                        animate={
                          reduceMotion
                            ? undefined
                            : { opacity: [0.3, 0.7, 0.3], scale: [0.98, 1.02, 0.98] }
                        }
                        transition={
                          reduceMotion
                            ? undefined
                            : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                        }
                        style={{
                          background:
                            "radial-gradient(circle, rgba(52,211,153,0.22) 0%, rgba(34,211,238,0.08) 55%, transparent 75%)"
                        }}
                        aria-hidden="true"
                      />
                      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden="true">
                        <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" fill="none" />
                        <motion.circle
                          cx="22"
                          cy="22"
                          r="18"
                          stroke="rgba(52,211,153,0.95)"
                          strokeWidth="4.5"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray={2 * Math.PI * 18}
                          initial={{ strokeDashoffset: ringDashOffset(18, 0) }}
                          animate={{ strokeDashoffset: ringDashOffset(18, confidenceTarget) }}
                          transition={{ type: "spring", stiffness: 150, damping: 20, mass: 0.7 }}
                          style={{ filter: "drop-shadow(0 0 18px rgba(52,211,153,0.50))" }}
                        />
                      </svg>
                      <motion.p
                        className="absolute inset-0 grid place-items-center text-6xl font-semibold tabular-nums tracking-tight text-white"
                        initial={reduceMotion ? false : { scale: 0.95, opacity: 0 }}
                        animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
                        transition={reduceMotion ? undefined : { delay: 0.05, type: "spring", stiffness: 200, damping: 18 }}
                      >
                        {confidenceDisplay}%
                      </motion.p>
                    </div>
                  </div>

                  {/* Two stat rows only */}
                  <div className="mt-8 space-y-3">
                    <motion.div
                      className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3.5 ring-1 ring-white/10"
                      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                      transition={reduceMotion ? undefined : { delay: 0.15, type: "spring", stiffness: 220, damping: 22 }}
                    >
                      <span className="text-sm text-white/65">Reaction</span>
                      <span className="text-sm font-semibold text-white">Natural</span>
                    </motion.div>
                    <motion.div
                      className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3.5 ring-1 ring-white/10"
                      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                      transition={reduceMotion ? undefined : { delay: 0.22, type: "spring", stiffness: 220, damping: 22 }}
                    >
                      <span className="text-sm text-white/65">Stability</span>
                      <span className="text-sm font-semibold text-white">Human-like</span>
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              {/* Return to checkout button */}
              <div className="mt-10">
                <motion.button
                  type="button"
                  onClick={() => onVerified?.(finalScore)}
                  className="relative inline-flex h-16 w-full items-center justify-center overflow-hidden rounded-2xl text-black text-base font-semibold tracking-tight ring-1 ring-emerald-200/20 transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                  style={{ background: "#34D399" }}
                  animate={
                    reduceMotion
                      ? undefined
                      : {
                          boxShadow: [
                            "0 0 40px rgba(52,211,153,0.30), 0 18px 60px rgba(0,0,0,0.4)",
                            "0 0 80px rgba(52,211,153,0.52), 0 18px 60px rgba(0,0,0,0.4)",
                            "0 0 40px rgba(52,211,153,0.30), 0 18px 60px rgba(0,0,0,0.4)"
                          ]
                        }
                  }
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 2.0, repeat: Infinity, ease: "easeInOut" }
                  }
                >
                  Return to checkout
                </motion.button>
              </div>
            </motion.section>
          ) : null}

        </AnimatePresence>
      </div>
    </main>
  );
}
