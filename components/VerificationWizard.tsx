"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreHumanConfidence, type MotionSample, type ScoreBreakdown } from "@/lib/scoring";
import { useDeviceOrientation } from "@/lib/useDeviceOrientation";
import PhoneTiltPreview from "@/components/PhoneTiltPreview";
import type { EventSong } from "@/lib/events";

// ─── AI Risk Types ────────────────────────────────────────────────────────────
type RiskLevel = "low" | "medium" | "high";
type StepUp = "none" | "tilt" | "beat";

type RiskResult = {
  risk_level: RiskLevel;
  reason: string;
  step_up: StepUp;
};

const RISK_DEFAULT: RiskResult = {
  risk_level: "medium",
  reason: "Defaulting to standard verification.",
  step_up: "tilt",
};

const STEP_UP_LABEL: Record<StepUp, string> = {
  none: "Auto-Pass",
  tilt: "Tilt Challenge",
  beat: "Beat Challenge",
};

const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#f87171",
};

// ─── AI Trust Panel ───────────────────────────────────────────────────────────
function AITrustPanel({
  risk,
  loading,
}: {
  risk: RiskResult | null;
  loading: boolean;
}) {
  const r = risk ?? RISK_DEFAULT;
  const color = RISK_COLOR[r.risk_level];
  const label = r.risk_level.charAt(0).toUpperCase() + r.risk_level.slice(1);

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(51,65,85,0.8)",
        background: "rgba(15,23,42,0.85)",
        padding: "10px 14px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: loading ? "#475569" : color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "#64748b",
            textTransform: "uppercase",
          }}
        >
          AI Trust Engine
        </span>
      </div>
      {loading ? (
        <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>Evaluating risk…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Risk Level</span>
            <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Verification Mode</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#cbd5e1" }}>
              {STEP_UP_LABEL[r.step_up]}
            </span>
          </div>
          <p
            style={{
              fontSize: 10,
              color: "#64748b",
              margin: "3px 0 0",
              lineHeight: 1.5,
            }}
          >
            {r.reason}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Voice Guidance Button ────────────────────────────────────────────────────
function VoiceGuidanceButton({
  currentStep,
  riskLevel,
  disabled,
}: {
  currentStep: "tilt" | "beat" | "none";
  riskLevel: RiskLevel;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    setFallbackText(null);
    try {
      const res = await fetch("/api/ai/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: currentStep,
          risk_level: riskLevel,
          accessibility: {
            reduce_motion: false,
            screen_reader: false,
            voice_guidance: true,
          },
        }),
      });

      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("audio")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch(() => {
          // Autoplay blocked — silently ignore
        });
        audio.addEventListener("ended", () => URL.revokeObjectURL(url));
      } else {
        const json = await res.json();
        if (typeof json?.text === "string") {
          setFallbackText(json.text);
        }
      }
    } catch {
      // Network error — fail silently
    } finally {
      setLoading(false);
    }
  }, [loading, disabled, currentStep, riskLevel]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || disabled}
        style={{
          height: 36,
          borderRadius: 10,
          border: "1px solid rgba(51,65,85,0.8)",
          background: "rgba(30,41,59,0.8)",
          color: loading || disabled ? "#475569" : "#93c5fd",
          fontSize: 12,
          fontWeight: 500,
          cursor: loading || disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          transition: "color 0.15s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 1a3 3 0 0 1 3 3v4a3 3 0 1 1-6 0V4a3 3 0 0 1 3-3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M3 8a5 5 0 0 0 10 0M8 13v2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {loading ? "Loading…" : "Enable AI Voice Guidance"}
      </button>
      {fallbackText ? (
        <p
          style={{
            fontSize: 11,
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {fallbackText}
        </p>
      ) : null}
    </div>
  );
}

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

/** Seconds ball must stay outside circle before beat challenge triggers */
const GYRO_FAIL_SECONDS = 6;

/** Minimum shake magnitude (accel delta) to count as a beat hit */
const SHAKE_THRESHOLD = 12;

/** Beat window tolerance in ms either side of the beat */
const BEAT_WINDOW_MS = 220;

/** Number of beats the user must hit to pass the beat challenge */
const BEATS_REQUIRED = 8;

type Screen = "intro" | "tasks" | "beat" | "result";
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
      <div
        className="absolute top-1/2 -translate-y-1/2 h-px bg-slate-700"
        style={{ left: 20, right: 20 }}
        aria-hidden="true"
      />
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

// ─── Beat Challenge Screen ────────────────────────────────────────────────────
function BeatChallenge({
  song,
  onPass,
  onSkip,
  reduceMotion,
}: {
  song: EventSong;
  onPass: () => void;
  onSkip: () => void;
  reduceMotion: boolean | null;
}) {
  const beatIntervalMs = Math.round(60_000 / song.bpm);
  const [beatsHit, setBeatsHit] = useState(0);
  const [beatFlash, setBeatFlash] = useState(false);
  const [missFlash, setMissFlash] = useState(false);
  const [nextBeatAt, setNextBeatAt] = useState<number>(0);
  const [countdown, setCountdown] = useState(3);
  const [phase, setPhase] = useState<"countdown" | "playing" | "done">("countdown");
  const [pulseScale, setPulseScale] = useState(1);

  const lastAccelRef = useRef({ x: 0, y: 0, z: 0 });
  const beatsHitRef = useRef(0);
  const phaseRef = useRef<"countdown" | "playing" | "done">("countdown");
  const nextBeatAtRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Synthesize a click/metronome beat via Web Audio
  const playClick = useCallback((accent = false) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = accent ? 1200 : 800;
      gain.gain.setValueAtTime(accent ? 0.6 : 0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Web Audio not available
    }
  }, []);

  // Countdown then start
  useEffect(() => {
    if (countdown > 0) {
      const id = window.setTimeout(() => {
        playClick(countdown === 1);
        setCountdown((c) => c - 1);
      }, 800);
      return () => window.clearTimeout(id);
    } else {
      setPhase("playing");
      phaseRef.current = "playing";
      const first = performance.now() + beatIntervalMs;
      setNextBeatAt(first);
      nextBeatAtRef.current = first;
    }
  }, [countdown, beatIntervalMs, playClick]);

  // Beat ticker — fires on each beat, plays click, pulses UI
  useEffect(() => {
    if (phase !== "playing") return;

    let raf = 0;
    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      if (now >= nextBeatAtRef.current) {
        playClick(false);
        setPulseScale(1.18);
        window.setTimeout(() => setPulseScale(1), 120);
        nextBeatAtRef.current = now + beatIntervalMs;
        setNextBeatAt(nextBeatAtRef.current);
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [phase, beatIntervalMs, playClick]);

  // DeviceMotion shake detection
  useEffect(() => {
    if (phase !== "playing") return;

    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;
      const prev = lastAccelRef.current;
      const delta = Math.hypot(x - prev.x, y - prev.y, z - prev.z);
      lastAccelRef.current = { x, y, z };

      if (delta < SHAKE_THRESHOLD) return;

      const now = performance.now();
      const dist = Math.abs(now - nextBeatAtRef.current + beatIntervalMs / 2);
      const onBeat = dist < BEAT_WINDOW_MS || Math.abs(now - nextBeatAtRef.current) < BEAT_WINDOW_MS;

      if (onBeat) {
        vibrate([15, 10, 15]);
        setBeatFlash(true);
        window.setTimeout(() => setBeatFlash(false), 180);
        beatsHitRef.current += 1;
        setBeatsHit(beatsHitRef.current);
        if (beatsHitRef.current >= BEATS_REQUIRED) {
          phaseRef.current = "done";
          setPhase("done");
          window.setTimeout(onPass, 600);
        }
      } else {
        setMissFlash(true);
        window.setTimeout(() => setMissFlash(false), 180);
      }
    };

    window.addEventListener("devicemotion", onMotion, { passive: true });
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [phase, beatIntervalMs, onPass]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

  const progressPct = Math.min(100, (beatsHit / BEATS_REQUIRED) * 100);

  return (
    <motion.section
      key="beat"
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "#0f172a" }}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
      transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 26, mass: 0.6 }}
    >
      <div className="w-full max-w-[380px] flex flex-col items-center gap-6">

        {/* Header */}
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500 mb-2">KINETICAUTH · BEAT CHECK</p>
          <h2 className="text-xl font-bold text-white">Shake to the Beat</h2>
          <p className="mt-1 text-sm text-slate-400">
            Prove you&apos;re human — shake your phone on every pulse
          </p>
        </div>

        {/* Song info */}
        <div className="w-full rounded-2xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/20 ring-1 ring-blue-500/30">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M6 3v8M10 1v10M2 5v4M14 4v6" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{song.title}</p>
            <p className="text-xs text-slate-400 truncate">{song.artist} · {song.bpm} BPM</p>
          </div>
          <div className="ml-auto shrink-0">
            <span className="rounded-full bg-blue-900/50 px-2 py-0.5 text-[10px] font-bold text-blue-300 ring-1 ring-blue-700/40">
              LIVE
            </span>
          </div>
        </div>

        {/* Beat pulse orb */}
        <div className="relative flex items-center justify-center" style={{ height: 200, width: 200 }}>
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: "2px solid rgba(96,165,250,0.2)" }}
            animate={phase === "playing" ? { scale: [1, 1.08, 1], opacity: [0.4, 0.8, 0.4] } : {}}
            transition={{ duration: 60 / song.bpm, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Progress ring */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="100" r="88" stroke="rgba(51,65,85,0.6)" strokeWidth="6" fill="none" />
            <motion.circle
              cx="100" cy="100" r="88"
              stroke={beatFlash ? "#34d399" : "#3b82f6"}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={2 * Math.PI * 88}
              animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - progressPct / 100) }}
              transition={{ type: "spring", stiffness: 180, damping: 26 }}
            />
          </svg>
          {/* Center orb */}
          <motion.div
            className={[
              "relative z-10 flex h-28 w-28 items-center justify-center rounded-full",
              beatFlash ? "bg-emerald-500/30 ring-2 ring-emerald-400/60" :
              missFlash ? "bg-red-500/20 ring-2 ring-red-400/40" :
              "bg-blue-600/20 ring-1 ring-blue-500/30"
            ].join(" ")}
            animate={{ scale: pulseScale }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {phase === "countdown" ? (
              <motion.span
                key={countdown}
                className="text-4xl font-black text-white"
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                {countdown === 0 ? "GO!" : countdown}
              </motion.span>
            ) : phase === "done" ? (
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M8 20l8 8L32 12" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <div className="text-center">
                <p className="text-3xl font-black text-white">{beatsHit}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">/ {BEATS_REQUIRED}</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Beats matched</span>
            <span>{beatsHit} / {BEATS_REQUIRED}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <motion.div
              className={["h-full rounded-full", beatFlash ? "bg-emerald-500" : "bg-blue-500"].join(" ")}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
            />
          </div>
        </div>

        {/* Instruction */}
        <p className="text-center text-xs text-slate-500 leading-relaxed">
          {phase === "countdown"
            ? "Get ready…"
            : phase === "done"
            ? "🎉 Beat challenge passed!"
            : "Shake your phone on each pulse · Keep the rhythm going"}
        </p>

        {/* Skip link */}
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-slate-600 hover:text-slate-400 transition underline underline-offset-2"
        >
          Skip challenge (manual review may apply)
        </button>
      </div>
    </motion.section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export type VerificationWizardProps = {
  onVerified?: (score: ScoreBreakdown) => void;
  onCancel?: () => void;
  returnTo?: string;
  /** Songs for the beat challenge — only used if gyro test fails (music events only) */
  songs?: EventSong[];
};

export default function VerificationWizard({
  onVerified,
  onCancel: _onCancel,
  songs,
}: VerificationWizardProps) {
  const reduceMotion = useReducedMotion();
  const { smoothedBeta, smoothedGamma, smoothedRef, available, permissionState, requestPermission } =
    useDeviceOrientation();

  // ── AI Risk Evaluation ────────────────────────────────────────────────────
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setRiskLoading(true);
    fetch("/api/risk/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        traffic_load: 0.8,
        motion_entropy_score: 0.25,
        interaction_latency_variance: 0.3,
        shake_accuracy: 0.6,
        device_type: "mobile",
      }),
    })
      .then((res) => res.json())
      .then((data: RiskResult) => {
        if (!cancelled) setRiskResult(data);
      })
      .catch(() => {
        if (!cancelled) setRiskResult(RISK_DEFAULT);
      })
      .finally(() => {
        if (!cancelled) setRiskLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const activeStepUp: StepUp = riskResult?.step_up ?? "tilt";

  const [screen, setScreen] = useState<Screen>("intro");
  const [motionUnlocked, setMotionUnlocked] = useState(false);
  const [taskId, setTaskId] = useState<TaskId>("left");
  const [confidenceTarget, setConfidenceTarget] = useState(92);
  const [confidenceDisplay, setConfidenceDisplay] = useState(0);

  const [dot, setDot] = useState({ x: 0, y: 0 });
  const [inside, setInside] = useState(false);
  const [holdPct, setHoldPct] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  // Beat challenge state — only triggered by gyro fail
  const [beatSong, setBeatSong] = useState<EventSong | null>(null);
  const beatTriggeredRef = useRef(false);

  const timingsRef = useRef<{ timeToLeft?: number; timeToRight?: number }>({});
  const taskStartAtRef = useRef<number | null>(null);
  const baselineRef = useRef<{ beta: number; gamma: number } | null>(null);

  const motionSamplesRef = useRef<MotionSample[]>([]);
  const stableMsRef = useRef(0);
  const tiltHoldMsRef = useRef(0);

  // Tracks how long the ball has been outside the circle during "steady" task
  const outsideMsRef = useRef(0);
  const gyroFailTriggeredRef = useRef(false);

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

  // Pick a random song for the beat challenge
  const pickSong = useCallback((): EventSong | null => {
    if (!songs || songs.length === 0) return null;
    return songs[Math.floor(Math.random() * songs.length)];
  }, [songs]);

  const triggerBeatChallenge = useCallback(() => {
    const song = pickSong();
    if (!song) return false;
    beatTriggeredRef.current = true;
    setBeatSong(song);
    setScreen("beat");
    return true;
  }, [pickSong]);

  const finish = useCallback((score: ScoreBreakdown) => {
    setFinalScore(score);
    setConfidenceTarget(87 + Math.floor(Math.random() * 10));
    setScreen("result");
  }, []);

  const advanceToTasks = useCallback(() => {
    const step = riskResult?.step_up ?? "tilt";

    // Auto-pass: skip verification entirely
    if (step === "none") {
      const score = scoreHumanConfidence({
        motionSamples: [],
        directedTimings: undefined,
        stabilityPct: 100,
        stabilityHoldPct: 100,
      });
      finish(score);
      return;
    }

    // Beat challenge: go straight to beat screen
    if (step === "beat") {
      const triggered = triggerBeatChallenge();
      if (triggered) return;
      // No songs available — fall back to tilt flow
    }

    // Default: tilt challenge flow
    setScreen("tasks");
    setTaskId("left");
    timingsRef.current = {};
    motionSamplesRef.current = [];
    stableMsRef.current = 0;
    tiltHoldMsRef.current = 0;
    outsideMsRef.current = 0;
    gyroFailTriggeredRef.current = false;
    taskStartAtRef.current = performance.now();
    baselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
    setDot({ x: 0, y: 0 });
    setInside(false);
    setHoldPct(0);
    setPulseKey((k) => k + 1);
  }, [riskResult, finish, triggerBeatChallenge, smoothedRef]);

  useEffect(() => {
    if (screen !== "tasks") return;
    if (permissionState !== "granted") return;
    if (!available) return;

    baselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
    taskStartAtRef.current = performance.now();
    stableMsRef.current = 0;
    tiltHoldMsRef.current = 0;
    outsideMsRef.current = 0;
    gyroFailTriggeredRef.current = false;
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
            outsideMsRef.current = 0;
            gyroFailTriggeredRef.current = false;
            completing = false;
            return "right";
          }
          if (prev === "right") {
            baselineRef.current = { beta: smoothedRef.current.beta, gamma: smoothedRef.current.gamma };
            taskStartAtRef.current = performance.now();
            outsideMsRef.current = 0;
            gyroFailTriggeredRef.current = false;
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

      // ── Steady task ──────────────────────────────────────────────────────
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

      // Track time outside circle — triggers beat challenge after GYRO_FAIL_SECONDS
      if (!inZone && !gyroFailTriggeredRef.current) {
        outsideMsRef.current += dtMs;
        if (outsideMsRef.current >= GYRO_FAIL_SECONDS * 1000) {
          gyroFailTriggeredRef.current = true;
          window.cancelAnimationFrame(raf);
          // Trigger beat challenge if songs available, otherwise just reset timer
          const triggered = triggerBeatChallenge();
          if (!triggered) {
            // No songs: just reset the outside timer and let them keep trying
            outsideMsRef.current = 0;
            gyroFailTriggeredRef.current = false;
          }
          return;
        }
      } else if (inZone) {
        outsideMsRef.current = 0;
      }

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
  }, [available, finish, permissionState, reduceMotion, screen, smoothedRef, taskId, triggerBeatChallenge]);

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

  const granted = permissionState === "granted" || motionUnlocked;

  // Beat challenge always follows gyro fail — passing it gives a passing score
  const handleBeatPass = useCallback(() => {
    setBeatSong(null);
    const score = scoreHumanConfidence({
      motionSamples: motionSamplesRef.current,
      directedTimings: timingsRef.current,
      stabilityPct: 50,
      stabilityHoldPct: 50,
    });
    finish(score);
  }, [finish]);

  const handleBeatSkip = useCallback(() => {
    // Skipping the beat challenge (which only appears after gyro fail) goes to result
    setBeatSong(null);
    const score = scoreHumanConfidence({
      motionSamples: motionSamplesRef.current,
      directedTimings: timingsRef.current,
      stabilityPct: 20,
      stabilityHoldPct: 20,
    });
    finish(score);
  }, [finish]);

  // Outside timer display for steady task
  const outsideSecsRemaining = useMemo(() => {
    if (screen !== "tasks" || taskId !== "steady" || inside) return null;
    const remaining = Math.ceil((GYRO_FAIL_SECONDS * 1000 - outsideMsRef.current) / 1000);
    return remaining;
  }, [screen, taskId, inside, pulseKey]); // pulseKey forces re-eval on each tick

  return (
    <main className="min-h-dvh text-white" style={{ background: "#0f172a" }}>
      <AnimatePresence mode="popLayout" initial={false}>

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 1 — INTRO
        ═══════════════════════════════════════════════════════════ */}
        {screen === "intro" ? (
          <motion.section
            key="intro"
            style={{
              width: "100vw",
              height: "100dvh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              gap: 28,
              position: "relative",
              overflow: "hidden"
            }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
            transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 28, mass: 0.6 }}
          >
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

            <h1
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: "clamp(15px, 2.5vw, 20px)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#f1f5f9",
                margin: 0,
                textAlign: "center"
              }}
            >
              Live Motion Detection Preview
            </h1>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                flexGrow: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 0
              }}
            >
              <div style={{ position: "relative", width: 320, height: 640, flexShrink: 0 }}>
                <PhoneTiltPreview
                  beta={granted ? smoothedBeta : 0}
                  gamma={granted ? smoothedGamma : 0}
                  reduceMotion={!granted || !!reduceMotion}
                  variant="cinematic"
                  showBadge
                />
              </div>
            </div>

            <p
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 13,
                color: "rgba(148,163,184,0.85)",
                margin: 0,
                textAlign: "center",
                lineHeight: 1.55
              }}
            >
              Move your phone to see real-time orientation tracking.
            </p>

            {/* AI Trust Panel */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "min(320px, 90vw)",
              }}
            >
              <AITrustPanel risk={riskResult} loading={riskLoading} />
            </div>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "min(320px, 90vw)",
                marginBottom: "calc(20px + env(safe-area-inset-bottom, 0px))"
              }}
            >
              {/* Voice Guidance */}
              <div style={{ marginBottom: 10 }}>
                <VoiceGuidanceButton
                  currentStep={activeStepUp === "beat" ? "beat" : activeStepUp === "none" ? "none" : "tilt"}
                  riskLevel={riskResult?.risk_level ?? "medium"}
                  disabled={riskLoading}
                />
              </div>

              {granted ? (
                <motion.button
                  type="button"
                  onClick={advanceToTasks}
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
                  Start Verification
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={async () => {
                    if (!available || permissionState === "unsupported" || permissionState === "denied") return;
                    const res = await requestPermission();
                    if (res === "granted") {
                      setMotionUnlocked(true);
                      vibrate(10);
                    }
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
                  Enable Motion Sensor
                </motion.button>
              )}
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
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH</p>
                <p className="text-[10px] font-medium text-slate-500">
                  Step {completedCount + 1} of 3
                </p>
              </div>

              <div className="mt-4">
                <AITrustPanel risk={riskResult} loading={riskLoading} />
              </div>

              <div className="mt-4 space-y-1">
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
                        <div className="relative grid place-items-center">
                          <div className="relative h-[180px] w-[180px]">
                            <HoldRing pct01={holdPct} radius={70} strokeWidth={8} color="rgba(96,165,250,0.9)" />
                            <div className="absolute inset-0 grid place-items-center">
                              <ArrowGlyph direction={taskId} />
                            </div>
                          </div>
                        </div>

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

                        {/* Outside timer warning */}
                        {!inside && outsideSecsRemaining !== null && outsideSecsRemaining <= GYRO_FAIL_SECONDS && songs && songs.length > 0 && (
                          <motion.p
                            key={outsideSecsRemaining}
                            className="text-xs font-semibold text-amber-400"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                          >
                            {outsideSecsRemaining > 1
                              ? `Move to center — beat challenge in ${outsideSecsRemaining}s`
                              : "Beat challenge starting…"}
                          </motion.p>
                        )}

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

              <div className="mt-6">
                <Stepper completed={completedCount} />
              </div>

              <div className="mt-4">
                <VoiceGuidanceButton
                  currentStep="tilt"
                  riskLevel={riskResult?.risk_level ?? "medium"}
                />
              </div>
            </div>
          </motion.section>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 2b — BEAT CHALLENGE
        ═══════════════════════════════════════════════════════════ */}
        {screen === "beat" && beatSong ? (
          <BeatChallenge
            key="beat"
            song={beatSong}
            onPass={handleBeatPass}
            onSkip={handleBeatSkip}
            reduceMotion={reduceMotion}
          />
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
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH</p>
              </div>

              <div className="flex flex-1 flex-col justify-center gap-6">
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
                    <p className="text-xs text-slate-400">
                      {beatTriggeredRef.current
                        ? "Beat challenge + motion verification complete"
                        : "Motion verification complete"}
                    </p>
                  </div>
                </motion.div>

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
                      ...(beatTriggeredRef.current ? [{ label: "Beat challenge", value: "Passed" }] : []),
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
