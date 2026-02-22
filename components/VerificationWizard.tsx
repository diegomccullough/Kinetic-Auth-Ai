"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreHumanConfidence, type MotionSample, type ScoreBreakdown } from "@/lib/scoring";
import { useDeviceOrientation } from "@/lib/useDeviceOrientation";
import PhoneTiltPreview from "@/components/PhoneTiltPreview";

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
  const linePct = clampedCompleted === 0 ? 0 : clampedCompleted === 1 ? 50 : 100;

  return (
    <div className="relative px-1 pt-2 pb-1">
      {/* Track */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-px bg-slate-700"
        style={{ left: 20, right: 20 }}
        aria-hidden="true"
      />
      {/* Fill */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 h-px bg-blue-500"
        initial={false}
        animate={{ right: linePct === 0 ? "100%" : linePct === 50 ? "50%" : "20px" }}
        transition={{ type: "spring", stiffness: 200, damping: 28, mass: 0.55 }}
        style={{ left: 20 }}
        aria-hidden="true"
      />

      <div className="relative flex items-center justify-between">
        {([1, 2, 3] as const).map((n) => {
          const filled = clampedCompleted >= n;
          const active = clampedCompleted + 1 === n && clampedCompleted < 3;
          return (
            <motion.div
              key={n}
              className="grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold"
              style={{
                background: filled ? "#3b82f6" : active ? "#1e293b" : "#0f172a",
                borderColor: filled ? "#3b82f6" : active ? "#3b82f6" : "#334155",
                color: filled ? "#fff" : active ? "#93c5fd" : "#475569"
              }}
              initial={false}
              animate={{ scale: active ? 1.05 : 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 24, mass: 0.4 }}
            >
              {filled ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span>{n}</span>
              )}
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
      width="120"
      height="120"
      viewBox="0 0 200 200"
      className="h-[120px] w-[120px]"
      aria-hidden="true"
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      <path
        d="M76 54 L26 100 L76 146"
        fill="none"
        stroke="rgba(147,197,253,0.9)"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M38 100 H172"
        fill="none"
        stroke="rgba(147,197,253,0.9)"
        strokeWidth="20"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Hold Ring ────────────────────────────────────────────────────────────────
function HoldRing({
  pct01,
  radius = 66,
  strokeWidth = 8,
  color = "rgba(96,165,250,0.9)"
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
      <circle cx="80" cy="80" r={radius} stroke="rgba(51,65,85,0.8)" strokeWidth={strokeWidth} fill="none" />
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
  const { smoothedBeta, smoothedGamma, smoothedRef, available, permissionState, requestPermission } =
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
    if (taskId === "left") return "Tilt left until the ring fills…";
    if (taskId === "right") return "Now tilt right…";
    return "Hold steady in the center…";
  }, [screen, taskId]);

  const stepTitle = useMemo(() => {
    if (screen !== "tasks") return "";
    if (taskId === "left") return "Step 1 — Tilt Left";
    if (taskId === "right") return "Step 2 — Tilt Right";
    return "Step 3 — Hold Steady";
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

  const granted = permissionState === "granted";

  return (
    <main className="min-h-dvh text-white" style={{ background: "#0f172a" }}>
      <AnimatePresence mode="popLayout" initial={false}>

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 1 — INTRO (full-screen hero)
        ═══════════════════════════════════════════════════════════ */}
        {screen === "intro" ? (
          <motion.section
            key="intro"
            style={{
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden"
            }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
            transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 28, mass: 0.6 }}
          >
            {/* Ambient background glow */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,211,238,0.07) 0%, transparent 70%)",
                zIndex: 0
              }}
            />

            {/* Title */}
            <h1
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: "clamp(15px, 2.5vw, 20px)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#f1f5f9",
                margin: "0 0 32px 0",
                textAlign: "center"
              }}
            >
              Live Motion Detection Preview
            </h1>

            {/* PhoneTiltPreview hero */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: 320,
                height: 640,
                flexShrink: 0
              }}
            >
              <PhoneTiltPreview
                beta={granted ? smoothedBeta : 0}
                gamma={granted ? smoothedGamma : 0}
                reduceMotion={!granted || !!reduceMotion}
                variant="cinematic"
                showBadge
              />
            </div>

            {/* Subtitle */}
            <p
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 13,
                color: "rgba(148,163,184,0.85)",
                margin: "32px 0 0 0",
                textAlign: "center",
                lineHeight: 1.55
              }}
            >
              Move your phone to see real-time orientation tracking.
            </p>

            {/* Start verification CTA */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                marginTop: 28,
                width: "min(320px, 90vw)"
              }}
            >
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
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 14,
                  background: "#1d4ed8",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  border: "none",
                  cursor: "pointer"
                }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              >
                {permissionState === "needs_gesture" ? "Enable Motion Sensor" : "Start Verification"}
              </motion.button>
              <p
                style={{
                  marginTop: 10,
                  textAlign: "center",
                  fontSize: 11,
                  color: "rgba(100,116,139,0.8)"
                }}
              >
                {(!available || permissionState === "denied" || permissionState === "unsupported")
                  ? "Motion sensors unavailable on this device."
                  : "No data leaves your device · Takes ~5 seconds"}
              </p>
            </div>
          </motion.section>
        ) : null}

          {/* ═══════════════════════════════════════════════════════════
              SCREEN 2 — TASK FLOW
          ═══════════════════════════════════════════════════════════ */}
          {screen === "tasks" ? (
            <motion.section
              key="tasks"
              className="min-h-dvh"
              style={{ background: "#0f172a" }}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
              transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 26, mass: 0.6 }}
            >
              <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 py-10">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH</p>
                <p className="text-[10px] font-medium text-slate-500">
                  Step {completedCount + 1} of 3
                </p>
              </div>

              {/* Step label */}
              <div className="mt-6 space-y-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={stepTitle}
                    className="text-xl font-semibold tracking-tight text-white"
                    initial={reduceMotion ? false : { y: 8, opacity: 0 }}
                    animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
                    exit={reduceMotion ? undefined : { y: -8, opacity: 0 }}
                    transition={reduceMotion ? undefined : { type: "spring", stiffness: 280, damping: 26, mass: 0.5 }}
                  >
                    {stepTitle}
                  </motion.p>
                </AnimatePresence>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={cueLine}
                    className="text-sm text-slate-400"
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={reduceMotion ? undefined : { type: "spring", stiffness: 260, damping: 26 }}
                  >
                    {cueLine}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Interaction area */}
              <div
                className={[
                  "relative mt-6 w-full overflow-hidden rounded-2xl border",
                  inside && taskId === "steady"
                    ? "border-emerald-700/40 bg-slate-800/60"
                    : "border-slate-700/50 bg-slate-800/60"
                ].join(" ")}
                style={{ height: "52dvh", minHeight: 320, maxHeight: 480 }}
              >
                <div className="relative grid h-full place-items-center p-6">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {taskId === "left" || taskId === "right" ? (
                      <motion.div
                        key={taskId}
                        className="flex w-full flex-col items-center gap-8"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={reduceMotion ? undefined : { opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={reduceMotion ? undefined : { duration: 0.2 }}
                      >
                        {/* Arrow + ring */}
                        <div className="relative grid place-items-center">
                          <div className="relative h-[180px] w-[180px]">
                            <HoldRing pct01={holdPct} radius={70} strokeWidth={8} color="rgba(96,165,250,0.9)" />
                            <div className="absolute inset-0 grid place-items-center">
                              <ArrowGlyph direction={taskId} />
                            </div>
                          </div>
                        </div>

                        {/* Tilt bar */}
                        <div className="w-full px-4 space-y-1.5">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>← Left</span>
                            <span>Right →</span>
                          </div>
                          <div className="relative h-2 w-full rounded-full bg-slate-700">
                            <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600" />
                            <motion.div
                              className="absolute inset-y-0 w-3 -translate-x-1/2 rounded-full bg-blue-400"
                              style={{ left: `${50 + clamp(smoothedGamma, -28, 28) * (50 / 28)}%` }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="steady"
                        className="flex w-full flex-col items-center gap-8"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={reduceMotion ? undefined : { opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={reduceMotion ? undefined : { duration: 0.2 }}
                      >
                        {/* Stability target */}
                        <div className="relative grid place-items-center">
                          <div className="relative h-[180px] w-[180px]">
                            <HoldRing pct01={holdPct} color={inside ? "rgba(52,211,153,0.9)" : "rgba(148,163,184,0.5)"} radius={74} strokeWidth={8} />
                            <div className="absolute inset-0 grid place-items-center">
                              <div className="relative h-[86%] w-[86%]">
                                <div
                                  className={[
                                    "absolute left-1/2 top-1/2 h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 rounded-full border",
                                    inside ? "border-emerald-500/40" : "border-slate-600/50"
                                  ].join(" ")}
                                  aria-hidden="true"
                                />
                                <motion.div
                                  className={[
                                    "absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
                                    inside ? "bg-emerald-400" : "bg-blue-400"
                                  ].join(" ")}
                                  animate={{ x: dot.x, y: dot.y, scale: inside ? 1.1 : 1 }}
                                  transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.25 }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Stability bar */}
                        <div className="w-full px-4 space-y-1.5">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Stability</span>
                            <span>{inside ? "Holding…" : "Move to center"}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                            <motion.div
                              className={["h-full rounded-full", inside ? "bg-emerald-500" : "bg-slate-600"].join(" ")}
                              animate={{ width: `${holdPct * 100}%` }}
                              transition={{ type: "spring", stiffness: 240, damping: 28, mass: 0.55 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Overall progress bar */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Overall progress</span>
                  <span>{Math.round(overallProgressPct)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    className="h-full rounded-full bg-blue-500"
                    initial={false}
                    animate={{ width: `${overallProgressPct}%` }}
                    transition={{ type: "spring", stiffness: 240, damping: 28, mass: 0.55 }}
                  />
                </div>
              </div>

              {/* Step tracker */}
              <div className="mt-6">
                <Stepper completed={completedCount} />
              </div>
              </div>
            </motion.section>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════
              SCREEN 3 — RESULT
          ═══════════════════════════════════════════════════════════ */}
          {screen === "result" ? (
            <motion.section
              key="result"
              className="min-h-dvh"
              style={{ background: "#0f172a" }}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
              transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 26, mass: 0.6 }}
            >
              <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 py-10">
              {/* Wordmark */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH</p>
              </div>

              <div className="flex flex-1 flex-col justify-center gap-6">
                {/* Status badge */}
                <motion.div
                  className="flex items-center gap-3"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={reduceMotion ? undefined : { type: "spring", stiffness: 220, damping: 24 }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M4 9l3.5 3.5L14 5.5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-white">Identity confirmed</p>
                    <p className="text-xs text-slate-400">Motion verification complete</p>
                  </div>
                </motion.div>

                {/* Verification summary card */}
                <motion.div
                  className="w-full rounded-2xl border border-slate-700/60 bg-slate-800/50"
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={reduceMotion ? undefined : { delay: 0.06, type: "spring", stiffness: 220, damping: 24 }}
                >
                  <div className="border-b border-slate-700/60 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Verification Summary</p>
                  </div>
                  <div className="divide-y divide-slate-700/40">
                    {[
                      { label: "Motion signature", value: "Valid" },
                      { label: "Behavioral timing", value: "Natural" },
                      { label: "Device integrity", value: "Verified" },
                    ].map((row, i) => (
                      <motion.div
                        key={row.label}
                        className="flex items-center justify-between px-4 py-3"
                        initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                        animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                        transition={reduceMotion ? undefined : { delay: 0.1 + i * 0.07, type: "spring", stiffness: 240, damping: 24 }}
                      >
                        <p className="text-sm text-slate-400">{row.label}</p>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                          <p className="text-sm font-medium text-slate-200">{row.value}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Risk level */}
                <motion.div
                  className="w-full rounded-2xl border border-slate-700/60 bg-slate-800/50"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={reduceMotion ? undefined : { delay: 0.22, type: "spring", stiffness: 220, damping: 24 }}
                >
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <p className="text-sm text-slate-400">Risk level</p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-700">
                        <div className="h-full w-1/5 rounded-full bg-emerald-500" />
                      </div>
                      <span className="text-sm font-semibold text-emerald-400">Low</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-700/40 px-4 py-3">
                    <p className="text-xs text-slate-500">
                      Confidence score: <span className="font-semibold text-slate-300">{confidenceDisplay}%</span> · Human motion patterns detected
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Return to checkout */}
              <div className="mt-8">
                <p className="mb-3 text-center text-xs text-slate-500">
                  Returning you to checkout automatically…
                </p>
                <motion.button
                  type="button"
                  onClick={() => onVerified?.(finalScore)}
                  className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-blue-600 text-white text-[15px] font-semibold tracking-tight transition-colors hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={reduceMotion ? undefined : { delay: 0.3, type: "spring", stiffness: 220, damping: 24 }}
                >
                  Return to checkout
                </motion.button>
              </div>
              </div>
            </motion.section>
          ) : null}

        </AnimatePresence>
    </main>
  );
}
