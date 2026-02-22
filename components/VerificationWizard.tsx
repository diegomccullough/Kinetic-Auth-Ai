"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PhoneTiltPreview from "@/components/PhoneTiltPreview";
import { Button } from "@/components/ui/Button";
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

function Stepper({ completed }: { completed: number }) {
  const clampedCompleted = clamp(completed, 0, 3);
  const linePct = clampedCompleted >= 2 ? 100 : clampedCompleted === 1 ? 50 : 0;

  return (
    <div className="relative mt-2">
      <div className="absolute left-4 right-4 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/10" aria-hidden="true" />
      <motion.div
        className="absolute left-4 top-1/2 h-[2px] -translate-y-1/2 rounded-full kinetic-progress"
        initial={false}
        animate={{ width: `${linePct}%` }}
        transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.55 }}
        style={{ filter: "drop-shadow(0 0 14px rgba(34,211,238,0.45))" }}
        aria-hidden="true"
      />

      <div className="relative flex items-center justify-between">
        {([1, 2, 3] as const).map((n) => {
          const filled = clampedCompleted >= n;
          const active = clampedCompleted + 1 === n && clampedCompleted < 3;
          return (
            <motion.div
              key={n}
              className={[
                "grid h-10 w-10 place-items-center rounded-full ring-1",
                filled ? "bg-[#22D3EE] text-black ring-white/10" : "bg-black/30 text-white/70 ring-white/15"
              ].join(" ")}
              initial={false}
              animate={{
                scale: active ? 1.06 : 1,
                boxShadow: filled
                  ? "0 0 36px rgba(34,211,238,0.55), 0 0 0 1px rgba(255,255,255,0.10) inset"
                  : "0 0 0 rgba(0,0,0,0)"
              }}
              transition={{ type: "spring", stiffness: 260, damping: 20, mass: 0.45 }}
            >
              <span className="text-xs font-semibold tabular-nums">{n}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ArrowGlyph({ direction }: { direction: "left" | "right" }) {
  const flip = direction === "right";
  return (
    <svg
      width="220"
      height="220"
      viewBox="0 0 220 220"
      className="h-[220px] w-[220px]"
      aria-hidden="true"
      style={{ transform: flip ? "scaleX(-1)" : undefined, filter: "drop-shadow(0 0 18px rgba(34,211,238,0.25))" }}
    >
      <path
        d="M82 60 L32 110 L82 160"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M44 110 H184"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="18"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HoldRing({
  pct01,
  radius = 66,
  strokeWidth = 10,
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
      <circle cx="80" cy="80" r={radius} stroke="rgba(255,255,255,0.10)" strokeWidth={strokeWidth} fill="none" />
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
        transition={{ type: "spring", stiffness: 220, damping: 30, mass: 0.6 }}
        style={{ filter: "drop-shadow(0 0 14px rgba(34,211,238,0.35))" }}
      />
    </svg>
  );
}

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
    return inside ? "Nice — hold steady…" : "Nice — hold steady…";
  }, [inside, screen, taskId]);

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

  const finish = useCallback(
    (score: ScoreBreakdown) => {
      setFinalScore(score);
      setConfidenceTarget(87 + Math.floor(Math.random() * 10)); // 87–96 keynote-style demo result
      setScreen("result");
    },
    []
  );

  // Task logic runs only on Screen 2.
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
    <main className="min-h-dvh text-white">
      <div className="relative min-h-dvh">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(34,211,238,0.22)_0%,rgba(99,102,241,0.14)_34%,rgba(0,0,0,1)_78%)]" />
          <motion.div
            className="absolute -inset-16 opacity-70"
            style={{
              x: screen === "intro" ? clamp(smoothedGamma, -18, 18) * -0.7 : 0,
              y: screen === "intro" ? clamp(smoothedBeta, -18, 18) * -0.55 : 0
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.22)_0%,rgba(99,102,241,0.16)_30%,rgba(0,0,0,0)_72%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(52,211,153,0.14)_0%,rgba(0,0,0,0)_58%)]" />
          </motion.div>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 35%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.52) 72%, rgba(0,0,0,0.90) 100%)"
            }}
          />
        </div>

        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 py-8">
          <AnimatePresence mode="popLayout" initial={false}>
            {screen === "intro" ? (
              <motion.section
                key="intro"
                className="flex min-h-dvh flex-col"
                initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -18, scale: 0.99 }}
                transition={reduceMotion ? undefined : { type: "spring", stiffness: 170, damping: 22, mass: 0.7 }}
              >
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold tracking-[0.38em] text-white/65">KINETICAUTH</p>
                </div>

                <div className="flex flex-1 flex-col justify-center">
                  <div className="mx-auto flex h-[70dvh] max-h-[760px] min-h-[520px] w-full items-center justify-center">
                    <div className="w-full" style={{ transform: "scale(1.14)" }}>
                      <PhoneTiltPreview
                        beta={beta}
                        gamma={gamma}
                        reduceMotion={!!reduceMotion}
                        variant="cinematic"
                        showBadge={false}
                      />
                    </div>
                  </div>

                  <div className="mt-8 space-y-3 text-center">
                    <h1 className="text-balance text-5xl font-semibold leading-[0.96] tracking-tight">Tilt your phone</h1>
                    <p className="text-sm text-white/70">Experience motion-based human verification.</p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <Button
                    onClick={async () => {
                      if (!available || permissionState === "unsupported" || permissionState === "denied") return;
                      if (permissionState !== "granted") {
                        const res = await requestPermission();
                        if (res !== "granted") return;
                        vibrate(10);
                      }
                      advanceToTasks();
                    }}
                    className="h-14 bg-white text-black ring-white/10 shadow-[0_18px_70px_rgba(34,211,238,0.18)] hover:bg-white/95"
                  >
                    Begin Verification
                  </Button>
                  {!available || permissionState === "denied" || permissionState === "unsupported" ? (
                    <p className="text-center text-xs text-white/55">Motion sensors aren’t available here.</p>
                  ) : null}
                </div>
              </motion.section>
            ) : null}

            {screen === "tasks" ? (
              <motion.section
                key="tasks"
                className="flex min-h-dvh flex-col"
                initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -18, scale: 0.99 }}
                transition={reduceMotion ? undefined : { type: "spring", stiffness: 180, damping: 22, mass: 0.7 }}
              >
                <div className="space-y-8">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.30em] text-white/55">VERIFICATION</p>
                    <Stepper completed={completedCount} />
                    <motion.p
                      className="mt-6 text-balance text-3xl font-semibold leading-[1.05] tracking-tight text-white"
                      initial={reduceMotion ? false : { y: 10, opacity: 0 }}
                      animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
                      transition={reduceMotion ? undefined : { type: "spring", stiffness: 240, damping: 22, mass: 0.6 }}
                    >
                      {stepTitle}
                    </motion.p>
                  </div>

                  <motion.div
                    key={`task-card-${taskId}-${pulseKey}`}
                    className={[
                      "relative w-full overflow-hidden rounded-[28px] bg-white/[0.05] p-6 ring-1 backdrop-blur",
                      inside && taskId === "steady" ? "ring-[#34D399]/30" : "ring-white/10"
                    ].join(" ")}
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            boxShadow: [
                              "0 0 0 rgba(0,0,0,0)",
                              taskId === "steady"
                                ? "0 0 96px rgba(52,211,153,0.14)"
                                : "0 0 96px rgba(34,211,238,0.18)",
                              "0 0 0 rgba(0,0,0,0)"
                            ]
                          }
                    }
                    transition={reduceMotion ? undefined : { type: "spring", stiffness: 160, damping: 20, mass: 0.8 }}
                    style={{ height: "60dvh", minHeight: 420, maxHeight: 560 }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(circle_at_50%_30%, rgba(34,211,238,0.16) 0%, rgba(99,102,241,0.10) 35%, rgba(0,0,0,0) 72%)"
                      }}
                      aria-hidden="true"
                    />

                    <div className="relative grid h-full place-items-center">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {taskId === "left" || taskId === "right" ? (
                          <motion.div
                            key={taskId}
                            className="relative grid place-items-center"
                            initial={reduceMotion ? false : { y: 14, scale: 0.98, opacity: 0 }}
                            animate={reduceMotion ? undefined : { y: 0, scale: 1, opacity: 1 }}
                            exit={reduceMotion ? undefined : { y: -14, scale: 0.98, opacity: 0 }}
                            transition={reduceMotion ? undefined : { type: "spring", stiffness: 240, damping: 22, mass: 0.6 }}
                          >
                            <div className="relative h-[240px] w-[240px]">
                              <HoldRing pct01={holdPct} />
                              <div className="absolute inset-0 grid place-items-center">
                                <ArrowGlyph direction={taskId} />
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="steady"
                            className="relative grid place-items-center"
                            initial={reduceMotion ? false : { y: 14, scale: 0.98, opacity: 0 }}
                            animate={reduceMotion ? undefined : { y: 0, scale: 1, opacity: 1 }}
                            exit={reduceMotion ? undefined : { y: -14, scale: 0.98, opacity: 0 }}
                            transition={reduceMotion ? undefined : { type: "spring", stiffness: 240, damping: 22, mass: 0.6 }}
                          >
                            <div className="relative h-[260px] w-[260px]">
                              <HoldRing pct01={holdPct} color="rgba(52,211,153,0.95)" radius={72} strokeWidth={10} />
                              <div className="absolute inset-0 grid place-items-center">
                                <div className="relative h-[86%] w-[86%]">
                                  <div
                                    className="absolute left-1/2 top-1/2 h-[108px] w-[108px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/15"
                                    aria-hidden="true"
                                  />
                                  <motion.div
                                    className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#34D399]"
                                    style={{
                                      boxShadow: inside
                                        ? "0 0 36px rgba(52,211,153,0.85), 0 0 72px rgba(34,211,238,0.18)"
                                        : "0 0 20px rgba(52,211,153,0.45)"
                                    }}
                                    animate={{ x: dot.x, y: dot.y, scale: inside ? 1.08 : 1 }}
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

                  <div className="space-y-4">
                    <div className="h-3.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                      <motion.div
                        className="h-full rounded-full kinetic-progress"
                        initial={false}
                        animate={{ width: `${overallProgressPct}%` }}
                        transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.55 }}
                        style={{ boxShadow: "0 0 22px rgba(34,211,238,0.28)" }}
                      />
                    </div>
                    <p className="text-center text-sm font-medium text-white/80">{cueLine}</p>
                  </div>
                </div>
              </motion.section>
            ) : null}

            {screen === "result" ? (
              <motion.section
                key="result"
                className="flex min-h-dvh flex-col"
                initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -18, scale: 0.99 }}
                transition={reduceMotion ? undefined : { type: "spring", stiffness: 180, damping: 22, mass: 0.7 }}
              >
                <div className="flex flex-1 flex-col justify-center">
                  <div className="space-y-8 text-center">
                    <div className="relative">
                      <motion.div
                        className="pointer-events-none absolute -inset-12 opacity-70"
                        animate={reduceMotion ? undefined : { opacity: [0.35, 0.8, 0.35], scale: [1, 1.02, 1] }}
                        transition={reduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                          background:
                            "radial-gradient(circle_at_50%_45%, rgba(52,211,153,0.24) 0%, rgba(34,211,238,0.12) 35%, rgba(0,0,0,0) 72%)"
                        }}
                        aria-hidden="true"
                      />
                      <p className="text-xs font-semibold tracking-[0.36em] text-white/70">VERIFIED</p>
                      <h2 className="mt-4 text-6xl font-semibold leading-[0.94] tracking-tight">VERIFIED</h2>
                      <p className="mt-4 text-sm text-white/70">Human presence confirmed.</p>
                    </div>

                    <div className="mx-auto w-full max-w-[360px] rounded-[28px] bg-white/[0.05] p-6 ring-1 ring-white/10">
                      <p className="text-[10px] font-semibold tracking-[0.30em] text-white/60">CONFIDENCE</p>
                      <div className="mt-6 grid place-items-center">
                        <div className="relative grid h-[170px] w-[170px] place-items-center">
                          <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden="true">
                            <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.10)" strokeWidth="5" fill="none" />
                            <motion.circle
                              cx="22"
                              cy="22"
                              r="18"
                              stroke="rgba(52,211,153,0.95)"
                              strokeWidth="5"
                              strokeLinecap="round"
                              fill="none"
                              strokeDasharray={2 * Math.PI * 18}
                              initial={{ strokeDashoffset: ringDashOffset(18, 0) }}
                              animate={{ strokeDashoffset: ringDashOffset(18, confidenceTarget) }}
                              transition={{ type: "spring", stiffness: 160, damping: 20, mass: 0.7 }}
                              style={{ filter: "drop-shadow(0 0 16px rgba(52,211,153,0.35))" }}
                            />
                          </svg>
                          <motion.p
                            className="absolute inset-0 grid place-items-center text-6xl font-semibold tabular-nums tracking-tight text-white"
                            initial={reduceMotion ? false : { scale: 0.98, opacity: 0 }}
                            animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
                            transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 18 }}
                          >
                            {confidenceDisplay}%
                          </motion.p>
                        </div>
                      </div>

                      <div className="mt-6 space-y-3 text-left text-sm">
                        <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                          <span className="text-white/70">Reaction</span>
                          <span className="font-semibold text-white">Natural</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                          <span className="text-white/70">Stability</span>
                          <span className="font-semibold text-white">Human-like</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button
                    onClick={() => onVerified?.(finalScore)}
                    className="h-14 bg-white text-black ring-white/10 shadow-[0_18px_70px_rgba(52,211,153,0.14)] hover:bg-white/95"
                  >
                    Return to checkout
                  </Button>
                </div>
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

