"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

const INTRO_AUTO_ADVANCE_AFTER_INTERACTION_MS = 1500;

const TASKS_TOTAL = 3;
const TILT_TASK_THRESHOLD_DEG = 16;
const TILT_TASK_HOLD_MS = 240;

const HOLD_STEADY_TARGET_MS = 1200;
const HOLD_STEADY_RADIUS_PX = 34;
const DOT_CLAMP_DEG = 28;
const DOT_MAX_OFFSET_PX = 98;
const DOT_PX_PER_DEG = DOT_MAX_OFFSET_PX / DOT_CLAMP_DEG;

type Screen = "intro" | "tasks" | "result";
type TaskId = "left" | "right" | "steady";

function prettyStat(label: "Entropy" | "Smoothness" | "Reaction" | "Stability", score: number) {
  if (label === "Entropy") return score >= 72 ? "High" : score >= 50 ? "Good" : "Low";
  if (label === "Smoothness") return score >= 68 ? "Natural" : score >= 50 ? "Stable" : "Rigid";
  if (label === "Reaction") return score >= 68 ? "Responsive" : score >= 50 ? "Normal" : "Slow";
  return score >= 70 ? "Confirmed" : score >= 50 ? "Mostly stable" : "Unstable";
}

function ringDashOffset(radius: number, pct: number) {
  const c = 2 * Math.PI * radius;
  return c * (1 - clamp(pct, 0, 100) / 100);
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

  const instruction = useMemo(() => {
    if (screen === "tasks") return taskId === "left" ? "Tilt left" : taskId === "right" ? "Tilt right" : "Hold steady";
    return "Tilt your phone";
  }, [screen, taskId]);

  const feedbackLine = useMemo(() => {
    if (screen !== "tasks") return "";
    if (taskId === "steady") return inside ? "Stability confirmed" : "Human motor noise detected";
    return "Human motor noise detected";
  }, [inside, screen, taskId]);

  const requestMotion = useCallback(async () => {
    const res = await requestPermission();
    if (res === "granted") vibrate(10);
  }, [requestPermission]);

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
      setScreen("result");
    },
    []
  );

  // Screen 1 auto-advance after first real motion interaction.
  useEffect(() => {
    if (screen !== "intro") return;
    if (permissionState !== "granted") return;
    if (!available) return;
    if (reduceMotion) return;

    let seen = false;
    let timer: number | null = null;
    let raf = 0;

    const tick = () => {
      const mag = Math.abs(smoothedRef.current.beta) + Math.abs(smoothedRef.current.gamma);
      if (!seen && mag > 2.4) {
        seen = true;
        timer = window.setTimeout(() => advanceToTasks(), INTRO_AUTO_ADVANCE_AFTER_INTERACTION_MS);
      }
      if (timer === null) raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      if (timer) window.clearTimeout(timer);
    };
  }, [advanceToTasks, available, permissionState, reduceMotion, screen, smoothedRef]);

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

        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 py-6">
          <AnimatePresence mode="popLayout" initial={false}>
            {screen === "intro" ? (
              <motion.section
                key="intro"
                className="flex min-h-dvh flex-col"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.30em] text-white/65">KINETICAUTH</p>
                </div>

                <div className="mt-6 space-y-4 text-center">
                  <h1 className="text-balance text-5xl font-semibold leading-[0.96] tracking-tight">Tilt your phone</h1>
                  <p className="text-sm text-white/70">Experience motion-based human verification.</p>
                </div>

                <div className="mt-6 flex-1">
                  <div className="mx-auto flex h-[72vh] max-h-[740px] min-h-[520px] w-full items-center justify-center">
                    <div className="w-full" style={{ transform: "scale(1.10)" }}>
                      <PhoneTiltPreview
                        beta={beta}
                        gamma={gamma}
                        reduceMotion={!!reduceMotion}
                        variant="cinematic"
                        showBadge={false}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {available && permissionState !== "granted" ? (
                    <Button onClick={requestMotion} variant="soft" className="ring-white/15">
                      Continue
                    </Button>
                  ) : (
                    <Button onClick={advanceToTasks} variant="soft" className="ring-white/15">
                      Continue
                    </Button>
                  )}
                  <p className="text-center text-xs text-white/45">Tip: gentle tilts read best.</p>
                </div>
              </motion.section>
            ) : null}

            {screen === "tasks" ? (
              <motion.section
                key="tasks"
                className="flex min-h-dvh flex-col"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
              >
                <div className="space-y-6">
                  <div className="space-y-4">
                    <p className="text-sm font-semibold tracking-tight text-white/80">Verification</p>
                    <p className="text-balance text-4xl font-semibold leading-[1.02] tracking-tight">{instruction}</p>
                  </div>

                  <motion.div
                    key={`zone-${taskId}-${pulseKey}`}
                    className="rounded-[26px] bg-white/[0.05] p-6 ring-1 ring-white/10"
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            boxShadow: [
                              "0 0 0 rgba(0,0,0,0)",
                              "0 0 80px rgba(34,211,238,0.18)",
                              "0 0 0 rgba(0,0,0,0)"
                            ]
                          }
                    }
                    transition={reduceMotion ? undefined : { duration: 0.55, ease: "easeOut" }}
                  >
                    <div className="mx-auto w-full max-w-[360px]">
                      <div className="relative aspect-square w-full overflow-hidden rounded-[22px] bg-black/35 ring-1 ring-white/10">
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              "radial-gradient(circle_at_50%_40%, rgba(34,211,238,0.14) 0%, rgba(99,102,241,0.10) 35%, rgba(0,0,0,0) 72%)"
                          }}
                          aria-hidden="true"
                        />

                        <div className="absolute inset-0 grid place-items-center">
                          {taskId === "steady" ? (
                            <div className="relative h-[78%] w-[78%]">
                              <div
                                className="absolute left-1/2 top-1/2 h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/15"
                                aria-hidden="true"
                              />
                              <motion.div
                                className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22D3EE]"
                                style={{
                                  boxShadow: inside
                                    ? "0 0 34px rgba(34,211,238,0.95), 0 0 64px rgba(99,102,241,0.22)"
                                    : "0 0 22px rgba(34,211,238,0.55)"
                                }}
                                animate={{ x: dot.x, y: dot.y, scale: inside ? 1.08 : 1 }}
                                transition={{ type: "tween", duration: 0.08, ease: "linear" }}
                              />
                            </div>
                          ) : (
                            <div className="grid place-items-center text-center">
                              <p className="text-7xl font-semibold leading-none text-white" aria-hidden="true">
                                {taskId === "left" ? "←" : "→"}
                              </p>
                              <p className="mt-3 text-sm text-white/70">Hold briefly to confirm.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 space-y-4">
                        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            className="h-full rounded-full kinetic-progress"
                            initial={false}
                            animate={{
                              width:
                                taskId === "left"
                                  ? `${Math.round(holdPct * 33)}%`
                                  : taskId === "right"
                                    ? `${33 + Math.round(holdPct * 33)}%`
                                    : `${66 + Math.round(holdPct * 34)}%`
                            }}
                            transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
                            style={{
                              boxShadow: reduceMotion
                                ? undefined
                                : taskId === "steady" && inside
                                  ? "0 0 22px rgba(34,211,238,0.55)"
                                  : "0 0 14px rgba(34,211,238,0.22)"
                            }}
                          />
                        </div>

                        <p className="text-center text-xs font-medium text-white/65">{feedbackLine}</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.section>
            ) : null}

            {screen === "result" ? (
              <motion.section
                key="result"
                className="flex min-h-dvh flex-col"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
              >
                <div className="space-y-6 text-center">
                  <div className="relative">
                    <motion.div
                      className="pointer-events-none absolute -inset-10 opacity-70"
                      animate={reduceMotion ? undefined : { opacity: [0.2, 0.75, 0.2], scale: [1, 1.02, 1] }}
                      transition={reduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      style={{
                        background:
                          "radial-gradient(circle_at_50%_45%, rgba(34,211,238,0.26) 0%, rgba(99,102,241,0.14) 35%, rgba(0,0,0,0) 72%)"
                      }}
                      aria-hidden="true"
                    />
                    <p className="text-xs font-semibold tracking-[0.30em] text-white/65">VERIFIED</p>
                    <h2 className="mt-4 text-6xl font-semibold leading-[0.95] tracking-tight">Verified</h2>
                    <p className="mt-4 text-sm text-white/70">Human verified successfully.</p>
                  </div>

                  <div className="rounded-[26px] bg-white/[0.05] p-6 ring-1 ring-white/10">
                    <p className="text-[10px] font-semibold tracking-[0.30em] text-white/60">HUMAN CONFIDENCE</p>
                    <div className="mt-4 grid place-items-center">
                      <div className="relative grid h-[150px] w-[150px] place-items-center">
                        <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                          <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.10)" strokeWidth="5" fill="none" />
                          <motion.circle
                            cx="22"
                            cy="22"
                            r="18"
                            stroke="rgba(34,211,238,0.95)"
                            strokeWidth="5"
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray={2 * Math.PI * 18}
                            initial={false}
                            animate={{ strokeDashoffset: ringDashOffset(18, finalScore.humanConfidence) }}
                            transition={{ type: "tween", duration: reduceMotion ? 0 : 0.75, ease: "easeOut" }}
                          />
                        </svg>
                        <div className="absolute inset-0 grid place-items-center">
                          <p className="text-6xl font-semibold tabular-nums tracking-tight text-white">
                            {finalScore.humanConfidence}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 text-left text-sm">
                      {(
                        [
                          ["Entropy", finalScore.entropyScore],
                          ["Smoothness", finalScore.smoothnessScore],
                          ["Reaction", finalScore.reactionScore],
                          ["Stability", finalScore.stabilityScore]
                        ] as const
                      ).map(([label, score]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10"
                        >
                          <span className="text-white/70">{label}</span>
                          <span className="font-semibold text-white">{prettyStat(label, score)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <Button
                    onClick={() => onVerified?.(finalScore)}
                    className="bg-white text-black ring-white/10 shadow-[0_18px_60px_rgba(34,211,238,0.14)] hover:bg-white/95"
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

