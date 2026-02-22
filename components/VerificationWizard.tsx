"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreHumanConfidence, type MotionSample, type ScoreBreakdown } from "@/lib/scoring";
import { useDeviceOrientation } from "@/lib/useDeviceOrientation";
import PhoneTiltPreview from "@/components/PhoneTiltPreview";
import type { EventSong } from "@/lib/events";
import { evaluateRisk } from "@/lib/riskClient";

// ─── Accessibility Detection Hook ──────────────────────────────────────────────
function useAccessibilityFeatures() {
  const reduceMotion = useReducedMotion();
  const [screenReaderActive, setScreenReaderActive] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [hasMotionSensor, setHasMotionSensor] = useState(true);

  useEffect(() => {
    // Detect desktop vs mobile
    const checkDesktop = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsDesktop(!isMobile);
    };
    checkDesktop();

    // Check for motion sensor availability
    const checkMotionSensor = () => {
      if (typeof DeviceMotionEvent === "undefined") {
        setHasMotionSensor(false);
      } else if (typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function") {
        // iOS - sensor exists but needs permission
        setHasMotionSensor(true);
      } else {
        // Check if we actually get motion events
        let received = false;
        const handler = () => { received = true; };
        window.addEventListener("devicemotion", handler, { once: true });
        setTimeout(() => {
          window.removeEventListener("devicemotion", handler);
          if (!received) setHasMotionSensor(false);
        }, 1000);
      }
    };
    checkMotionSensor();

    // Detect screen reader - check for common indicators
    const checkScreenReader = () => {
      // Check for aria-live regions being announced (indirect detection)
      const hasReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Screen readers often trigger reduced motion
      // Also check for high contrast mode which often accompanies screen readers
      const hasHighContrast = window.matchMedia("(prefers-contrast: more)").matches;
      // Check for forced colors (Windows High Contrast Mode)
      const hasForcedColors = window.matchMedia("(forced-colors: active)").matches;
      
      setScreenReaderActive(hasReducedMotion || hasHighContrast || hasForcedColors);
    };
    checkScreenReader();

    // Listen for preference changes
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const contrastQuery = window.matchMedia("(prefers-contrast: more)");
    
    const updateAccessibility = () => checkScreenReader();
    motionQuery.addEventListener("change", updateAccessibility);
    contrastQuery.addEventListener("change", updateAccessibility);

    return () => {
      motionQuery.removeEventListener("change", updateAccessibility);
      contrastQuery.removeEventListener("change", updateAccessibility);
    };
  }, []);

  return {
    reduceMotion: !!reduceMotion,
    screenReaderActive,
    isDesktop,
    hasMotionSensor,
    needsAlternativeTest: isDesktop || !hasMotionSensor,
  };
}

// ─── Speech Synthesis Helper ───────────────────────────────────────────────────
function speakInstruction(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  
  // Try to use a natural voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Natural")) 
    || voices.find(v => v.lang.startsWith("en"));
  if (preferredVoice) utterance.voice = preferredVoice;
  
  window.speechSynthesis.speak(utterance);
}

// ─── Accessibility Badge Component ─────────────────────────────────────────────
function AccessibilityBadge({ 
  isActive, 
  compact = false 
}: { 
  isActive: boolean; 
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          borderRadius: 8,
          background: isActive ? "rgba(59, 130, 246, 0.15)" : "rgba(71, 85, 105, 0.2)",
          border: isActive ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(71, 85, 105, 0.3)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="4" r="2" fill={isActive ? "#60a5fa" : "#64748b"} />
          <path 
            d="M12 6v4M8 14l4-4 4 4M8 14v4M16 14v4" 
            stroke={isActive ? "#60a5fa" : "#64748b"} 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        </svg>
        <span style={{ 
          fontSize: 10, 
          color: isActive ? "#93c5fd" : "#64748b", 
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          {isActive ? "A11Y ON" : "A11Y OFF"}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 12,
        background: isActive ? "rgba(59, 130, 246, 0.15)" : "rgba(71, 85, 105, 0.2)",
        border: isActive ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(71, 85, 105, 0.3)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="4" r="2" fill={isActive ? "#60a5fa" : "#64748b"} />
        <path 
          d="M12 6v4M8 14l4-4 4 4M8 14v4M16 14v4" 
          stroke={isActive ? "#60a5fa" : "#64748b"} 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
      <span style={{ 
        fontSize: 12, 
        color: isActive ? "#93c5fd" : "#64748b", 
        fontWeight: 500 
      }}>
        {isActive ? "Accessibility features: ON" : "Accessibility features: OFF"}
      </span>
      {isActive && (
        <span style={{
          marginLeft: "auto",
          fontSize: 10,
          color: "#60a5fa",
          background: "rgba(59, 130, 246, 0.2)",
          padding: "2px 6px",
          borderRadius: 4,
          fontWeight: 600,
        }}>
          ACTIVE
        </span>
      )}
    </div>
  );
}

// ─── AI Risk Types ────────────────────────────────────────────────────────────
type RiskLevel = "low" | "medium" | "high";
type StepUp = "none" | "tilt" | "beat";

type RiskResult = {
  risk_level: RiskLevel;
  reason: string;
  step_up: StepUp;
};

export type VerificationTrace = {
  lastRiskRequest: Record<string, unknown> | null;
  lastRiskResponse: RiskResult | null;
  lastDecision: string | null;
  lastNarratePayload: Record<string, unknown> | null;
  lastNarrateResult: string | null;
  updatedAt: string | null;
};

type CurrentStep = "preview" | "tilt" | "analyzing" | "step_up_overview" | "beat" | "complete";

const RISK_DEFAULT: RiskResult = {
  risk_level: "medium",
  reason: "Fallback (risk engine unavailable).",
  step_up: "tilt",
};

const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#f87171",
};

const DEMO_RISK_PAYLOAD = {
  traffic_load: 0.85,
  motion_entropy_score: 0.25,
  interaction_latency_variance: 0.30,
  tilt_fail_count: 0,
  device_type: "mobile",
} as const;

// ─── Trust chip (compact) ─────────────────────────────────────────────────────
function TrustChip({
  risk,
  loading,
}: {
  risk: RiskResult | null;
  loading: boolean;
}) {
  const label = risk ? risk.risk_level.charAt(0).toUpperCase() + risk.risk_level.slice(1) : "…";
  const color = risk ? RISK_COLOR[risk.risk_level] : "#475569";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? "#475569" : color, flexShrink: 0 }} />
      Trust: {loading ? "…" : label}
    </span>
  );
}

// ─── Debug Drawer ─────────────────────────────────────────────────────────────
function DebugDrawer({
  currentStep,
  tiltFailCount,
  risk,
  trace,
  open,
  onOpen,
  onClose,
}: {
  currentStep: string;
  tiltFailCount: number;
  risk: RiskResult | null;
  trace: VerificationTrace;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const r = risk ?? RISK_DEFAULT;
  return (
    <div className="fixed right-4 top-20 z-50">
      <button
        type="button"
        onClick={open ? onClose : onOpen}
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          background: "rgba(15,23,42,0.92)", border: "1px solid rgba(51,65,85,0.9)",
          color: "#64748b", borderRadius: 8, padding: "4px 10px", cursor: "pointer",
        }}
      >
        {open ? "✕ Debug" : "Debug"}
      </button>
      {open && (
      <div className="max-h-[80vh] overflow-y-auto" style={{
        marginTop: 6, background: "rgba(10,15,28,0.97)", border: "1px solid rgba(51,65,85,0.8)",
        borderRadius: 12, padding: "12px 14px", width: 280,
        fontSize: 10, color: "#94a3b8", lineHeight: 1.6,
      }}>
        <p style={{ margin: "0 0 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "#475569", textTransform: "uppercase" }}>
          AI Debug Trace
        </p>
        <Row label="currentStep" value={currentStep} />
        <Row label="tiltFailCount" value={String(tiltFailCount)} />
        <Row label="risk_level" value={r.risk_level} color={RISK_COLOR[r.risk_level]} />
        <Row label="reason" value={r.reason} wrap />
        <Row label="step_up" value={r.step_up} />
        {trace.lastDecision != null && <Row label="lastDecision" value={trace.lastDecision} wrap />}
        {trace.updatedAt && <Row label="updatedAt" value={trace.updatedAt} />}
        {trace.lastRiskRequest != null && (
          <div style={{ marginTop: 8 }}>
            <p style={{ margin: "0 0 3px", fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>lastRiskRequest</p>
            <pre style={{ margin: 0, fontSize: 9, color: "#64748b", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(trace.lastRiskRequest, null, 2)}
            </pre>
          </div>
        )}
        {trace.lastRiskResponse != null && (
          <div style={{ marginTop: 8 }}>
            <p style={{ margin: "0 0 3px", fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>lastRiskResponse</p>
            <pre style={{ margin: 0, fontSize: 9, color: "#64748b", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(trace.lastRiskResponse, null, 2)}
            </pre>
          </div>
        )}
        {trace.lastNarratePayload != null && (
          <div style={{ marginTop: 8 }}>
            <p style={{ margin: "0 0 3px", fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>lastNarratePayload</p>
            <pre style={{ margin: 0, fontSize: 9, color: "#64748b", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(trace.lastNarratePayload, null, 2)}
            </pre>
          </div>
        )}
        {trace.lastNarrateResult != null && (
          <div style={{ marginTop: 8 }}>
            <p style={{ margin: "0 0 3px", fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>lastNarrateResult</p>
            <pre style={{ margin: 0, fontSize: 9, color: "#64748b", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {trace.lastNarrateResult}
            </pre>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function Row({ label, value, color, wrap }: { label: string; value: string; color?: string; wrap?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2, alignItems: wrap ? "flex-start" : "center", flexWrap: wrap ? "wrap" : "nowrap" }}>
      <span style={{ color: "#475569", flexShrink: 0 }}>{label}</span>
      <span style={{ color: color ?? "#cbd5e1", textAlign: "right", wordBreak: wrap ? "break-word" : "normal" }}>{value}</span>
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
const SHAKE_THRESHOLD = 18;

/** Beat window tolerance in ms either side of the beat */
const BEAT_WINDOW_MS = 250;

/** Cooldown in ms after a shake is registered before another can count */
const SHAKE_COOLDOWN_MS = 400;

/** Number of beats the user must hit to pass the beat challenge */
const BEATS_REQUIRED = 10;

/** Seconds before multi-drag challenge triggers if user doesn't drag */
const DRAG_TIMEOUT_SECONDS = 10;

/** Number of tickets to drag in multi-drag challenge */
const MULTI_DRAG_REQUIRED = 5;

type Screen = "intro" | "tasks" | "analyzing" | "step_up_overview" | "beat" | "drag" | "multi_drag" | "result";
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

// ─── Step-Up Overview (user must press Continue before beat challenge starts) ─
function StepUpOverviewScreen({ onContinue, reduceMotion, accessibilityActive }: { onContinue: () => void; reduceMotion: boolean | null; accessibilityActive: boolean }) {
  return (
    <motion.section
      key="step_up_overview"
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "#0f172a" }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={reduceMotion ? undefined : { duration: 0.35, ease: "easeOut" }}
    >
      <div className="w-full max-w-[360px] flex flex-col gap-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(239,68,68,0.12)",
              border: "1.5px solid rgba(239,68,68,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center flex flex-col gap-3">
          <div className="flex items-center justify-center gap-3">
            <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH · STEP-UP</p>
            <AccessibilityBadge isActive={accessibilityActive} compact />
          </div>
          <h2 className="text-xl font-bold text-white leading-snug">Enhanced Verification Required</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            We detected inconsistent motion patterns during verification. To protect queue fairness, we need one additional step.
          </p>
        </div>

        {/* Reasons */}
        <ul className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {["Failed behavioral verification", "Elevated automation risk"].map((item) => (
            <li
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "rgba(148,163,184,0.85)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
              {item}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <motion.button
          type="button"
          onClick={onContinue}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 14,
            background: "#1d4ed8",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            border: "none",
            cursor: "pointer",
          }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        >
          Continue
        </motion.button>
      </div>
    </motion.section>
  );
}

// ─── Analyzing Screen (shown for 1.5 s after tilt failure, before step-up) ───
function AnalyzingScreen() {
  const [meterPct, setMeterPct] = useState(0);

  useEffect(() => {
    // Animate risk meter from 0 → 100 % over ~1200 ms
    const controls = animate(0, 100, {
      duration: 1.2,
      ease: "easeIn",
      onUpdate: (v) => setMeterPct(Math.round(v)),
    });
    return () => controls.stop();
  }, []);

  const meterColor =
    meterPct < 40 ? "#22c55e" : meterPct < 70 ? "#f59e0b" : "#ef4444";

  return (
    <motion.section
      key="analyzing"
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "#0f172a" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3 }}
    >
      <div className="w-full max-w-[380px] flex flex-col items-center gap-8">
        {/* Label */}
        <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">
          KINETICAUTH · RISK ANALYSIS
        </p>

        {/* Pulsing spinner ring */}
        <motion.div
          className="w-16 h-16 rounded-full border-2 border-slate-700 flex items-center justify-center"
          animate={{ boxShadow: ["0 0 0px #ef444400", "0 0 18px #ef4444aa", "0 0 0px #ef444400"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-t-transparent"
            style={{ borderColor: meterColor, borderTopColor: "transparent" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>

        {/* Headline */}
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-bold text-white">Analyzing behavioral signals…</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[280px] mx-auto">
            Evaluating motion stability, completion timing, and anomaly signals…
          </p>
        </div>

        {/* Risk meter */}
        <div className="w-full flex flex-col gap-2">
          <div className="flex justify-between text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
            <span>Risk Level</span>
            <motion.span
              style={{ color: meterColor }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              {meterPct < 40 ? "LOW" : meterPct < 70 ? "MEDIUM" : "HIGH"}
            </motion.span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ width: `${meterPct}%`, background: meterColor }}
              transition={{ duration: 0.05 }}
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// ─── Beat placeholder (when no song / demo) ────────────────────────────────────
function BeatPlaceholder({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.section
      key="beat-placeholder"
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "#0f172a" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-full max-w-[380px] flex flex-col items-center gap-6">
        <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH · STEP-UP</p>
        <h2 className="text-xl font-bold text-white">Beat Challenge (Step-Up)</h2>
        <p className="text-sm text-slate-400 text-center">
          Additional verification step after tilt failure at high risk.
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="w-full max-w-[280px] h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          Complete
        </button>
      </div>
    </motion.section>
  );
}

// ─── Beat Challenge Screen ────────────────────────────────────────────────────
function BeatChallenge({
  song,
  onPass,
  onSkip,
  reduceMotion,
  accessibilityActive,
}: {
  song: EventSong;
  onPass: () => void;
  onSkip: () => void;
  reduceMotion: boolean | null;
  accessibilityActive: boolean;
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
  const lastShakeAtRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const trackAudioRef = useRef<HTMLAudioElement | null>(null);

  const useTrackAudio = Boolean(song.audioSrc);

  // Synthesize a click/metronome beat via Web Audio (used when no track audio)
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
        if (!useTrackAudio) playClick(countdown === 1);
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
  }, [countdown, beatIntervalMs, playClick, useTrackAudio]);

  // Play track audio from public/music/ when phase becomes "playing"
  useEffect(() => {
    if (phase !== "playing" || !song.audioSrc) return;

    const audio = new Audio(song.audioSrc);
    trackAudioRef.current = audio;
    audio.volume = 1;
    audio.loop = true;
    const played = audio.play();
    if (typeof played?.then === "function") {
      played.catch((err) => {
        console.error(`[BeatChallenge] Failed to play audio "${song.audioSrc}":`, err.message);
      });
    }
    audio.onerror = () => {
      console.error(`[BeatChallenge] Audio file not found or cannot be played: "${song.audioSrc}"`);
    };

    return () => {
      audio.pause();
      audio.src = "";
      audio.load();
      trackAudioRef.current = null;
    };
  }, [phase, song.audioSrc]);

  // Beat ticker — fires on each beat, plays click only when no track, pulses UI
  useEffect(() => {
    if (phase !== "playing") return;

    let raf = 0;
    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      if (now >= nextBeatAtRef.current) {
        if (!useTrackAudio) playClick(false);
        setPulseScale(1.18);
        window.setTimeout(() => setPulseScale(1), 120);
        nextBeatAtRef.current = now + beatIntervalMs;
        setNextBeatAt(nextBeatAtRef.current);
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [phase, beatIntervalMs, playClick, useTrackAudio]);

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

      // Cooldown: ignore shakes that happen too soon after the last registered shake
      if (now - lastShakeAtRef.current < SHAKE_COOLDOWN_MS) return;

      const dist = Math.abs(now - nextBeatAtRef.current + beatIntervalMs / 2);
      const onBeat = dist < BEAT_WINDOW_MS || Math.abs(now - nextBeatAtRef.current) < BEAT_WINDOW_MS;

      if (onBeat) {
        lastShakeAtRef.current = now;
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
        // Also apply cooldown to misses to prevent spam
        lastShakeAtRef.current = now;
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
      const track = trackAudioRef.current;
      if (track) {
        track.pause();
        track.src = "";
        track.load();
        trackAudioRef.current = null;
      }
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
          <div className="flex items-center justify-center gap-3 mb-2">
            <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH · BEAT CHECK</p>
            <AccessibilityBadge isActive={accessibilityActive} compact />
          </div>
          <h2 className="text-xl font-bold text-white">Shake to the Beat</h2>
          <p className="mt-1 text-sm text-slate-400">
            {song.audioSrc
              ? `${song.artist} is playing — shake your phone on every pulse`
              : "Prove you&apos;re human — shake your phone on every pulse"}
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

// ─── Drag Challenge (alternative for desktop/accessibility) ────────────────────
function DragChallenge({
  onPass,
  onTimeout,
  reduceMotion,
  accessibilityMode,
}: {
  onPass: () => void;
  onTimeout: () => void;
  reduceMotion: boolean | null;
  accessibilityMode: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [ticketPos, setTicketPos] = useState({ x: 0, y: 0 });
  const [isDropped, setIsDropped] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DRAG_TIMEOUT_SECONDS);
  const containerRef = useRef<HTMLDivElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasStartedRef = useRef(false);

  // Speak instructions for accessibility
  useEffect(() => {
    if (accessibilityMode) {
      speakInstruction("Drag and drop verification. Drag the ticket to the stage area to verify you are human. You have 10 seconds.");
    }
  }, [accessibilityMode]);

  // Countdown timer
  useEffect(() => {
    if (isDropped) return;
    
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          if (!hasStartedRef.current) {
            onTimeout();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isDropped, onTimeout]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    hasStartedRef.current = true;
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX - ticketPos.x, y: clientY - ticketPos.y };
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setTicketPos({
      x: clientX - dragStartRef.current.x,
      y: clientY - dragStartRef.current.y,
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Check if ticket is over the stage
    const container = containerRef.current;
    const ticket = ticketRef.current;
    if (!container || !ticket) return;

    const stageEl = container.querySelector("[data-stage]");
    if (!stageEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const ticketRect = ticket.getBoundingClientRect();
    const ticketCenter = {
      x: ticketRect.left + ticketRect.width / 2,
      y: ticketRect.top + ticketRect.height / 2,
    };

    const isOverStage =
      ticketCenter.x >= stageRect.left &&
      ticketCenter.x <= stageRect.right &&
      ticketCenter.y >= stageRect.top &&
      ticketCenter.y <= stageRect.bottom;

    if (isOverStage) {
      setIsDropped(true);
      vibrate([20, 10, 20]);
      if (accessibilityMode) {
        speakInstruction("Ticket dropped successfully. Verification complete.");
      }
      setTimeout(onPass, 800);
    }
  }, [isDragging, onPass, accessibilityMode]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  return (
    <motion.section
      key="drag"
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "#0f172a" }}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
      transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 26, mass: 0.6 }}
    >
      <div ref={containerRef} className="w-full max-w-[380px] flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH · DRAG TEST</p>
            <AccessibilityBadge isActive={accessibilityMode} compact />
          </div>
          <h2 className="text-xl font-bold text-white">Drag the Ticket</h2>
          <p className="mt-1 text-sm text-slate-400">
            Drag the ticket onto the stage to verify
          </p>
        </div>

        {/* Timer */}
        <div className={`rounded-full px-4 py-1.5 text-sm font-semibold ${timeLeft <= 3 ? "bg-red-900/50 text-red-300" : "bg-slate-800 text-slate-300"}`}>
          {timeLeft}s remaining
        </div>

        {/* Stage area */}
        <div
          data-stage
          className={`relative w-full h-40 rounded-2xl border-2 border-dashed transition-colors ${
            isDropped
              ? "border-emerald-500 bg-emerald-900/20"
              : isDragging
              ? "border-blue-400 bg-blue-900/20"
              : "border-slate-600 bg-slate-800/30"
          }`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-2 opacity-40">
              <rect x="4" y="20" width="40" height="24" rx="2" stroke="currentColor" strokeWidth="2" className="text-slate-500" />
              <path d="M4 28h40" stroke="currentColor" strokeWidth="2" className="text-slate-500" />
              <circle cx="24" cy="12" r="8" stroke="currentColor" strokeWidth="2" className="text-slate-500" />
            </svg>
            <p className="text-sm text-slate-500">
              {isDropped ? "✓ Ticket placed!" : "Drop ticket here"}
            </p>
          </div>
        </div>

        {/* Draggable ticket */}
        {!isDropped && (
          <div
            ref={ticketRef}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="absolute select-none z-10 cursor-grab"
            style={{
              transform: `translate(${ticketPos.x}px, ${ticketPos.y}px)`,
              touchAction: "none",
              cursor: isDragging ? "grabbing" : "grab",
            }}
          >
            <motion.div
              className="w-32 h-20 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg border border-blue-500/30 flex flex-col items-center justify-center"
              animate={{ scale: isDragging ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mb-1">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="white" strokeWidth="1.5" />
                <path d="M3 10h18" stroke="white" strokeWidth="1.5" />
                <circle cx="7" cy="15" r="1.5" fill="white" />
              </svg>
              <p className="text-xs font-semibold text-white">TICKET</p>
            </motion.div>
          </div>
        )}

        {/* Instructions */}
        <p className="text-center text-xs text-slate-500 leading-relaxed">
          {accessibilityMode && "Accessibility mode active · "}
          Click and drag the ticket to the stage area above
        </p>
      </div>
    </motion.section>
  );
}

// ─── Multi-Drag Challenge (with music) ─────────────────────────────────────────
const MULTI_DRAG_TIME_LIMIT_SECONDS = 15;

function MultiDragChallenge({
  song,
  onPass,
  onSkip,
  reduceMotion,
  accessibilityMode,
}: {
  song: EventSong;
  onPass: () => void;
  onSkip: () => void;
  reduceMotion: boolean | null;
  accessibilityMode: boolean;
}) {
  const [ticketsPlaced, setTicketsPlaced] = useState(0);
  const [currentTicketPos, setCurrentTicketPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [timeLeft, setTimeLeft] = useState(MULTI_DRAG_TIME_LIMIT_SECONDS);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Countdown timer
  useEffect(() => {
    if (isComplete) return;
    
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          // Time's up - fail the challenge
          if (accessibilityMode) {
            speakInstruction("Time's up. Verification failed.");
          }
          setTimeout(onSkip, 500);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isComplete, onSkip, accessibilityMode]);

  // Play music and speak instructions
  useEffect(() => {
    if (accessibilityMode) {
      speakInstruction(`Multi-drag challenge. Drag ${MULTI_DRAG_REQUIRED} tickets to the stage in ${MULTI_DRAG_TIME_LIMIT_SECONDS} seconds while music plays. ${song.artist} is now playing.`);
    }

    // Play music
    if (song.audioSrc) {
      const audio = new Audio(song.audioSrc);
      audioRef.current = audio;
      audio.volume = 0.7;
      audio.loop = true;
      audio.play().catch(() => {});
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [song, accessibilityMode]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX - currentTicketPos.x, y: clientY - currentTicketPos.y };
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setCurrentTicketPos({
      x: clientX - dragStartRef.current.x,
      y: clientY - dragStartRef.current.y,
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const container = containerRef.current;
    const ticket = ticketRef.current;
    if (!container || !ticket) return;

    const stageEl = container.querySelector("[data-stage]");
    if (!stageEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const ticketRect = ticket.getBoundingClientRect();
    const ticketCenter = {
      x: ticketRect.left + ticketRect.width / 2,
      y: ticketRect.top + ticketRect.height / 2,
    };

    const isOverStage =
      ticketCenter.x >= stageRect.left &&
      ticketCenter.x <= stageRect.right &&
      ticketCenter.y >= stageRect.top &&
      ticketCenter.y <= stageRect.bottom;

    if (isOverStage) {
      vibrate([15, 10, 15]);
      const newCount = ticketsPlaced + 1;
      setTicketsPlaced(newCount);
      setCurrentTicketPos({ x: 0, y: 0 });

      if (newCount >= MULTI_DRAG_REQUIRED) {
        setIsComplete(true);
        if (accessibilityMode) {
          speakInstruction("All tickets placed. Verification complete.");
        }
        setTimeout(onPass, 600);
      } else if (accessibilityMode) {
        speakInstruction(`Ticket ${newCount} placed. ${MULTI_DRAG_REQUIRED - newCount} remaining.`);
      }
    } else {
      // Reset position if not dropped on stage
      setCurrentTicketPos({ x: 0, y: 0 });
    }
  }, [isDragging, ticketsPlaced, onPass, accessibilityMode]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const progressPct = (ticketsPlaced / MULTI_DRAG_REQUIRED) * 100;

  return (
    <motion.section
      key="multi-drag"
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "#0f172a" }}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
      transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 26, mass: 0.6 }}
    >
      <div ref={containerRef} className="w-full max-w-[380px] flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH · MULTI-DRAG</p>
            <AccessibilityBadge isActive={accessibilityMode} compact />
          </div>
          <h2 className="text-xl font-bold text-white">Place All Tickets</h2>
          <p className="mt-1 text-sm text-slate-400">
            Drag each ticket to the stage in {MULTI_DRAG_TIME_LIMIT_SECONDS} seconds
          </p>
        </div>

        {/* Timer */}
        <div className={`rounded-full px-4 py-1.5 text-sm font-semibold ${timeLeft <= 5 ? "bg-red-900/50 text-red-300" : "bg-slate-800 text-slate-300"}`}>
          {timeLeft}s remaining
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
            <p className="text-xs text-slate-400 truncate">{song.artist}</p>
          </div>
          <div className="ml-auto shrink-0">
            <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-700/40">
              ♪ PLAYING
            </span>
          </div>
        </div>

        {/* Stage area with placed tickets */}
        <div
          data-stage
          className={`relative w-full h-44 rounded-2xl border-2 border-dashed transition-colors ${
            isDragging ? "border-blue-400 bg-blue-900/20" : "border-slate-600 bg-slate-800/30"
          }`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-2 opacity-40">
              <rect x="4" y="20" width="40" height="24" rx="2" stroke="currentColor" strokeWidth="2" className="text-slate-500" />
              <path d="M4 28h40" stroke="currentColor" strokeWidth="2" className="text-slate-500" />
              <circle cx="24" cy="12" r="8" stroke="currentColor" strokeWidth="2" className="text-slate-500" />
            </svg>
            <p className="text-sm text-slate-500">Drop tickets here</p>
          </div>
          
          {/* Placed tickets visualization */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-1">
            {Array.from({ length: ticketsPlaced }).map((_, i) => (
              <motion.div
                key={i}
                className="w-8 h-5 rounded bg-emerald-600/80 border border-emerald-500/50"
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
            ))}
          </div>
        </div>

        {/* Draggable ticket */}
        {ticketsPlaced < MULTI_DRAG_REQUIRED && (
          <div
            ref={ticketRef}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className={`select-none ${isDragging ? "z-50 fixed" : ""}`}
            style={{
              transform: isDragging ? `translate(${currentTicketPos.x}px, ${currentTicketPos.y}px)` : undefined,
              touchAction: "none",
              cursor: isDragging ? "grabbing" : "grab",
            }}
          >
            <motion.div
              className="w-28 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg border border-blue-500/30 flex flex-col items-center justify-center"
              animate={{ scale: isDragging ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mb-0.5">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="white" strokeWidth="1.5" />
                <path d="M3 10h18" stroke="white" strokeWidth="1.5" />
              </svg>
              <p className="text-[10px] font-semibold text-white">TICKET #{ticketsPlaced + 1}</p>
            </motion.div>
          </div>
        )}

        {/* Progress */}
        <div className="w-full space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Tickets placed</span>
            <span>{ticketsPlaced} / {MULTI_DRAG_REQUIRED}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
            />
          </div>
        </div>

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

// ─── Tilt Challenge (owns the full left → right → steady sequence) ───────────
type TiltAccumulatedData = {
  motionSamples: MotionSample[];
  directedTimings: { timeToLeft?: number; timeToRight?: number };
};

function TiltChallenge({
  smoothedGamma,
  smoothedRef,
  reduceMotion,
  available,
  permissionState,
  songs,
  risk,
  riskLoading,
  onSuccess,
  onFailure,
  accessibilityActive,
}: {
  smoothedGamma: number;
  smoothedRef: { current: { beta: number; gamma: number; alpha: number } };
  reduceMotion: boolean | null;
  available: boolean;
  permissionState: string;
  songs?: EventSong[];
  risk: RiskResult | null;
  riskLoading: boolean;
  onSuccess: (score: ScoreBreakdown) => void;
  onFailure: (accumulated: TiltAccumulatedData) => void;
  accessibilityActive: boolean;
}) {
  const [taskId, setTaskId] = useState<TaskId>("left");
  const [holdPct, setHoldPct] = useState(0);
  const [dot, setDot] = useState({ x: 0, y: 0 });
  const [inside, setInside] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  const timingsRef = useRef<{ timeToLeft?: number; timeToRight?: number }>({});
  const taskStartAtRef = useRef<number | null>(null);
  const baselineRef = useRef<{ beta: number; gamma: number } | null>(null);
  const motionSamplesRef = useRef<MotionSample[]>([]);
  const stableMsRef = useRef(0);
  const tiltHoldMsRef = useRef(0);
  const outsideMsRef = useRef(0);
  const gyroFailTriggeredRef = useRef(false);

  const completedCount = taskId === "left" ? 0 : taskId === "right" ? 1 : 2;
  const cueLine =
    taskId === "left" ? "Tilt left until the ring fills…" :
    taskId === "right" ? "Now tilt right…" :
    "Hold steady in the center…";
  const stepTitle =
    taskId === "left" ? "Step 1 — Tilt Left" :
    taskId === "right" ? "Step 2 — Tilt Right" :
    "Step 3 — Hold Steady";
  const overallProgressPct = clamp(
    ((completedCount + clamp(holdPct, 0, 1)) / TASKS_TOTAL) * 100,
    0, 100
  );
  const outsideSecsRemaining =
    taskId !== "steady" || inside
      ? null
      : Math.ceil((GYRO_FAIL_SECONDS * 1000 - outsideMsRef.current) / 1000);

  // Motion tracking — re-runs on taskId change (next step) or on mount
  useEffect(() => {
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
          // steady complete → success
          const score = scoreHumanConfidence({
            motionSamples: motionSamplesRef.current,
            directedTimings: timingsRef.current,
            stabilityPct,
            stabilityHoldPct,
          });
          onSuccess(score);
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
        setHoldPct(tiltHoldMsRef.current / TILT_TASK_HOLD_MS);

        if (tiltHoldMsRef.current >= TILT_TASK_HOLD_MS) {
          tiltHoldMsRef.current = 0;
          setHoldPct(0);
          completeTask(taskId, 0, 0);
        }
        return;
      }

      // ── Steady task ────────────────────────────────────────────────────────
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

      if (!inZone && !gyroFailTriggeredRef.current) {
        outsideMsRef.current += dtMs;
        if (outsideMsRef.current >= GYRO_FAIL_SECONDS * 1000) {
          gyroFailTriggeredRef.current = true;
          window.cancelAnimationFrame(raf);
          onFailure({
            motionSamples: [...motionSamplesRef.current],
            directedTimings: { ...timingsRef.current },
          });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, permissionState, reduceMotion, smoothedRef, taskId]);

  return (
    <motion.section
      key="tasks"
      className="min-h-[100dvh] overflow-hidden w-full"
      style={{ background: "#0f172a" }}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
      transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 26, mass: 0.6 }}
    >
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-6 py-10">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH</p>
          <div className="flex items-center gap-3">
            <AccessibilityBadge isActive={accessibilityActive} compact />
            <TrustChip risk={risk} loading={riskLoading} />
            <p className="text-[10px] font-medium text-slate-500">Step {completedCount + 1} of 3</p>
          </div>
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
              : "border-slate-700/50 bg-slate-800/60",
          ].join(" ")}
          style={{ minHeight: 320 }}
        >
          <div className="relative grid place-items-center p-6">
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
                  <div className="relative w-full max-w-[320px] aspect-square mx-auto">
                    <HoldRing pct01={holdPct} radius={70} strokeWidth={8} color="rgba(96,165,250,0.9)" />
                    <div className="absolute inset-0 grid place-items-center">
                      <ArrowGlyph direction={taskId} />
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
                  <div className="relative w-full max-w-[320px] aspect-square mx-auto">
                    <HoldRing
                      pct01={holdPct}
                      color={inside ? "rgba(52,211,153,0.9)" : "rgba(148,163,184,0.5)"}
                      radius={74}
                      strokeWidth={8}
                    />
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="relative h-[86%] w-[86%]">
                        <div
                          className={[
                            "absolute left-1/2 top-1/2 h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 rounded-full border",
                            inside ? "border-emerald-500/40" : "border-slate-600/50",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                        <motion.div
                          className={[
                            "absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
                            inside ? "bg-emerald-400" : "bg-blue-400",
                          ].join(" ")}
                          animate={{ x: dot.x, y: dot.y, scale: inside ? 1.1 : 1 }}
                          transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.25 }}
                        />
                      </div>
                    </div>
                  </div>

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
  onCancel,
  songs,
}: VerificationWizardProps) {
  const reduceMotion = useReducedMotion();
  const { smoothedBeta, smoothedGamma, smoothedRef, available, permissionState, requestPermission } =
    useDeviceOrientation();
  
  // ── Accessibility detection ────────────────────────────────────────────────
  const accessibility = useAccessibilityFeatures();
  const [dragSong, setDragSong] = useState<EventSong | null>(null);

  // ── Verification state machine (AI) ────────────────────────────────────────
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);
  const [tiltFailCount, setTiltFailCount] = useState(0);
  const tiltFailCountRef = useRef(0);
  const [highTraffic] = useState(() => Math.random() > 0.7); // Simulate high traffic 30% of time
  const [trace, setTrace] = useState<VerificationTrace>({
    lastRiskRequest: null,
    lastRiskResponse: null,
    lastDecision: null,
    lastNarratePayload: null,
    lastNarrateResult: null,
    updatedAt: null,
  });

  const [currentStep, setCurrentStep] = useState<CurrentStep>("preview");
  const [screen, setScreen] = useState<Screen>("intro");

  const callRiskEval = useCallback(async (failCount: number): Promise<RiskResult> => {
    const payload = { ...DEMO_RISK_PAYLOAD, tilt_fail_count: failCount };
    const ts = new Date().toISOString();
    setTrace((prev) => ({ ...prev, lastRiskRequest: payload as Record<string, unknown>, updatedAt: ts }));
    try {
      const data = await evaluateRisk(payload);
      setRisk(data);
      setTrace((prev) => ({ ...prev, lastRiskResponse: data, updatedAt: new Date().toISOString() }));
      return data;
    } catch {
      setRisk(RISK_DEFAULT);
      setTrace((prev) => ({ ...prev, lastRiskResponse: RISK_DEFAULT, updatedAt: new Date().toISOString() }));
      return RISK_DEFAULT;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRiskLoading(true);
    callRiskEval(0)
      .finally(() => {
        if (!cancelled) setRiskLoading(false);
      });
    return () => { cancelled = true; };
  }, [callRiskEval]);

  const [motionUnlocked, setMotionUnlocked] = useState(false);
  const [tiltAttemptKey, setTiltAttemptKey] = useState(0);
  const [confidenceTarget, setConfidenceTarget] = useState(92);
  const [confidenceDisplay, setConfidenceDisplay] = useState(0);

  // Beat challenge state — only triggered by tilt failure + high risk
  const [beatSong, setBeatSong] = useState<EventSong | null>(null);
  const beatTriggeredRef = useRef(false);

  // Captured from TiltChallenge.onFailure for use in beat scoring
  const capturedMotionRef = useRef<TiltAccumulatedData>({ motionSamples: [], directedTimings: {} });

  const [finalScore, setFinalScore] = useState<ScoreBreakdown>(() =>
    scoreHumanConfidence({ motionSamples: [], directedTimings: undefined, stabilityPct: 0, stabilityHoldPct: 0 })
  );

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
    setCurrentStep("complete");
    setFinalScore(score);
    setConfidenceTarget(87 + Math.floor(Math.random() * 10));
    setScreen("result");
  }, []);

  // Start Verification: always launch tilt first
  const advanceToTasks = useCallback(() => {
    setCurrentStep("tilt");
    setScreen("tasks");
  }, []);

  // Called by TiltChallenge when all 3 tilt tasks succeed
  const handleTiltSuccess = useCallback((score: ScoreBreakdown) => {
    finish(score);
  }, [finish]);

  // Called by TiltChallenge when steady-hold times out (6 s outside circle)
  const handleTiltFailure = useCallback((accumulated: TiltAccumulatedData) => {
    capturedMotionRef.current = accumulated;
    const newCount = tiltFailCountRef.current + 1;
    tiltFailCountRef.current = newCount;
    setTiltFailCount(newCount);

    // Enter ANALYZING state immediately — show analysis screen while risk eval runs
    setCurrentStep("analyzing");
    setScreen("analyzing");

    callRiskEval(newCount).then((updatedRisk) => {
      const ts = new Date().toISOString();
      if (updatedRisk.risk_level === "high") {
        setTrace((prev) => ({ ...prev, lastDecision: "Tilt failed; risk high; showing step-up overview", updatedAt: ts }));
        // Hold ANALYZING for at least 1500 ms so the meter animation completes,
        // then land on the step-up overview — user must press Continue to start beat
        setTimeout(() => {
          const song = songs && songs.length > 0 ? songs[Math.floor(Math.random() * songs.length)] : null;
          beatTriggeredRef.current = true;
          setBeatSong(song);
          setCurrentStep("step_up_overview");
          setScreen("step_up_overview");
        }, 1500);
      } else {
        setTrace((prev) => ({ ...prev, lastDecision: "Tilt failed; risk not high; retrying tilt", updatedAt: ts }));
        // Brief ANALYZING pause before retrying tilt
        setTimeout(() => {
          setCurrentStep("tilt");
          setScreen("tasks");
          setTiltAttemptKey((k) => k + 1);
        }, 1500);
      }
    });
  }, [callRiskEval, songs]);

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

  // User pressed Continue on the step-up overview — now reveal the beat challenge
  const handleStepUpOverviewContinue = useCallback(() => {
    setCurrentStep("beat");
    setScreen("beat");
  }, []);

  // Beat challenge always follows tilt failure — passing it gives a passing score
  const handleBeatPass = useCallback(() => {
    setBeatSong(null);
    const score = scoreHumanConfidence({
      motionSamples: capturedMotionRef.current.motionSamples,
      directedTimings: capturedMotionRef.current.directedTimings,
      stabilityPct: 50,
      stabilityHoldPct: 50,
    });
    finish(score);
  }, [finish]);

  const handleBeatSkip = useCallback(() => {
    setBeatSong(null);
    const score = scoreHumanConfidence({
      motionSamples: capturedMotionRef.current.motionSamples,
      directedTimings: capturedMotionRef.current.directedTimings,
      stabilityPct: 20,
      stabilityHoldPct: 20,
    });
    finish(score);
  }, [finish]);

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-start overflow-hidden text-white" style={{ background: "#0f172a" }}>
      <AnimatePresence mode="popLayout" initial={false}>

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 1 — INTRO
        ═══════════════════════════════════════════════════════════ */}
        {screen === "intro" ? (
          <motion.section
            key="intro"
            style={{
              width: "100%",
              minHeight: "100dvh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 20px",
              gap: 16,
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

            {/* Phone visualization */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className="w-full max-w-[260px] mx-auto">
                <div className="relative w-full aspect-[9/19] mx-auto">
                  <PhoneTiltPreview
                    beta={granted ? smoothedBeta : 0}
                    gamma={granted ? smoothedGamma : 0}
                    reduceMotion={!granted || !!reduceMotion}
                    variant="cinematic"
                    showBadge
                  />
                </div>
              </div>
            </div>

            {/* Device & Accessibility Status */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                width: "min(320px, 90vw)",
              }}
            >
              {/* Device type indicator */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 12,
                  background: "rgba(71, 85, 105, 0.3)",
                  border: "1px solid rgba(71, 85, 105, 0.5)",
                }}
              >
                {accessibility.isDesktop ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="2" y="3" width="20" height="14" rx="2" stroke="#94a3b8" strokeWidth="2" />
                    <path d="M8 21h8M12 17v4" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="5" y="2" width="14" height="20" rx="2" stroke="#94a3b8" strokeWidth="2" />
                    <circle cx="12" cy="18" r="1" fill="#94a3b8" />
                  </svg>
                )}
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                  {accessibility.isDesktop ? "Desktop detected — Drag test" : "Mobile detected — Tilt test"}
                </span>
              </div>

              {/* Accessibility status indicator - always shown */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 12,
                  background: (accessibility.screenReaderActive || accessibility.reduceMotion)
                    ? "rgba(59, 130, 246, 0.15)"
                    : "rgba(71, 85, 105, 0.2)",
                  border: (accessibility.screenReaderActive || accessibility.reduceMotion)
                    ? "1px solid rgba(59, 130, 246, 0.3)"
                    : "1px solid rgba(71, 85, 105, 0.3)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="4" r="2" fill={(accessibility.screenReaderActive || accessibility.reduceMotion) ? "#60a5fa" : "#64748b"} />
                  <path 
                    d="M12 6v4M8 14l4-4 4 4M8 14v4M16 14v4" 
                    stroke={(accessibility.screenReaderActive || accessibility.reduceMotion) ? "#60a5fa" : "#64748b"} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                </svg>
                <span style={{ 
                  fontSize: 12, 
                  color: (accessibility.screenReaderActive || accessibility.reduceMotion) ? "#93c5fd" : "#64748b", 
                  fontWeight: 500 
                }}>
                  {(accessibility.screenReaderActive || accessibility.reduceMotion)
                    ? "Accessibility features: ON"
                    : "Accessibility features: OFF"}
                </span>
                {(accessibility.screenReaderActive || accessibility.reduceMotion) && (
                  <span style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: "#60a5fa",
                    background: "rgba(59, 130, 246, 0.2)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}>
                    ACTIVE
                  </span>
                )}
              </div>
            </div>

            {/* Headline + subtitle */}
            <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: "#f1f5f9",
                  margin: 0,
                }}
              >
                Verify You&apos;re Human
              </h1>
              <p
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "rgba(148,163,184,0.85)",
                  lineHeight: 1.4,
                }}
              >
                {accessibility.isDesktop
                  ? "Complete a quick drag test to continue."
                  : "Tilt your phone left and right to continue."}
              </p>
            </div>

            {/* Trust chip */}
            <div style={{ position: "relative", zIndex: 1, width: "min(320px, 90vw)" }}>
              <TrustChip risk={risk} loading={riskLoading} />
            </div>

            {/* Actions */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "min(320px, 90vw)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* Primary CTA - Drag test for desktop, Tilt test for mobile */}
              {accessibility.isDesktop ? (
                <motion.button
                  type="button"
                  onClick={() => {
                    if (accessibility.screenReaderActive) {
                      speakInstruction("Starting drag verification test.");
                    }
                    setScreen("drag");
                    setCurrentStep("tilt");
                  }}
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 14,
                    background: "#1d4ed8",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    border: "none",
                    cursor: "pointer"
                  }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                >
                  Start Drag Test
                </motion.button>
              ) : granted ? (
                <motion.button
                  type="button"
                  onClick={advanceToTasks}
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 14,
                    background: "#1d4ed8",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    border: "none",
                    cursor: "pointer"
                  }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                >
                  Start Tilt Test
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
                    height: 48,
                    borderRadius: 14,
                    background: "#1d4ed8",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    border: "none",
                    cursor: "pointer"
                  }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                >
                  Enable Motion Sensor
                </motion.button>
              )}


              {/* Skip verification button */}
              <button
                type="button"
                onClick={onCancel}
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 14,
                  background: "transparent",
                  color: "rgba(148,163,184,0.9)",
                  fontSize: 14,
                  fontWeight: 500,
                  border: "1px solid rgba(71,85,105,0.5)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Skip Verification
              </button>

              {/* Privacy note */}
              <p
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  color: "rgba(100,116,139,0.8)",
                  margin: 0,
                  paddingBottom: "env(safe-area-inset-bottom, 0px)",
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
            SCREEN 2 — TILT CHALLENGE (left → right → steady)
        ═══════════════════════════════════════════════════════════ */}
        {screen === "tasks" ? (
          <TiltChallenge
            key={tiltAttemptKey}
            smoothedGamma={smoothedGamma}
            smoothedRef={smoothedRef}
            reduceMotion={reduceMotion}
            available={available}
            permissionState={permissionState}
            songs={songs}
            risk={risk}
            riskLoading={riskLoading}
            onSuccess={handleTiltSuccess}
            onFailure={handleTiltFailure}
            accessibilityActive={accessibility.screenReaderActive || accessibility.reduceMotion}
          />
        ) : null}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 2b — ANALYZING (transitional, 1.5 s after tilt failure)
        ═══════════════════════════════════════════════════════════ */}
        {currentStep === "analyzing" && screen === "analyzing" ? (
          <AnalyzingScreen key="analyzing" />
        ) : null}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 2c — STEP-UP OVERVIEW (user confirms before beat starts)
        ═══════════════════════════════════════════════════════════ */}
        {currentStep === "step_up_overview" && screen === "step_up_overview" ? (
          <StepUpOverviewScreen
            key="step_up_overview"
            onContinue={handleStepUpOverviewContinue}
            reduceMotion={reduceMotion}
            accessibilityActive={accessibility.screenReaderActive || accessibility.reduceMotion}
          />
        ) : null}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 2d — BEAT CHALLENGE (only when tilt failed + risk high)
        ═══════════════════════════════════════════════════════════ */}
        {currentStep === "beat" && screen === "beat" ? (
          beatSong ? (
            <BeatChallenge
              key="beat"
              song={beatSong}
              onPass={handleBeatPass}
              onSkip={handleBeatSkip}
              reduceMotion={reduceMotion}
              accessibilityActive={accessibility.screenReaderActive || accessibility.reduceMotion}
            />
          ) : (
            <BeatPlaceholder key="beat-placeholder" onComplete={handleBeatPass} />
          )
        ) : null}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 2e — DRAG CHALLENGE (alternative for desktop/accessibility)
        ═══════════════════════════════════════════════════════════ */}
        {screen === "drag" ? (
          <DragChallenge
            key="drag"
            onPass={() => {
              const score = scoreHumanConfidence({
                motionSamples: [],
                directedTimings: undefined,
                stabilityPct: 100,
                stabilityHoldPct: 100,
              });
              finish(score);
            }}
            onTimeout={() => {
              // Trigger multi-drag challenge with random music
              // Available music files in public/music/
              const availableSongs: EventSong[] = [
                { title: "Viva La Vida", artist: "Coldplay", bpm: 138, youtubeId: "", audioSrc: "/music/coldplay.mp3" },
                { title: "Freestyle", artist: "Lil Baby", bpm: 140, youtubeId: "", audioSrc: "/music/lil-baby.mp3" },
                { title: "For Certain", artist: "PARTYNEXTDOOR", bpm: 95, youtubeId: "", audioSrc: "/music/partynextdoor.mp3" },
                { title: "Passionfruit", artist: "Drake", bpm: 111, youtubeId: "", audioSrc: "/music/drake.mp3" },
                { title: "Skyfall", artist: "Adele", bpm: 68, youtubeId: "", audioSrc: "/music/adele.mp3" },
                { title: "Crazy In Love", artist: "Beyoncé", bpm: 99, youtubeId: "", audioSrc: "/music/beyonce.mp3" },
              ];
              // Pick a random song, preferring event-specific songs if available
              const eventSong = songs && songs.length > 0
                ? songs[Math.floor(Math.random() * songs.length)]
                : null;
              const randomSong = eventSong || availableSongs[Math.floor(Math.random() * availableSongs.length)];
              setDragSong(randomSong);
              setScreen("multi_drag");
            }}
            reduceMotion={reduceMotion}
            accessibilityMode={accessibility.screenReaderActive}
          />
        ) : null}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 2f — MULTI-DRAG CHALLENGE (with music)
        ═══════════════════════════════════════════════════════════ */}
        {screen === "multi_drag" && dragSong ? (
          <MultiDragChallenge
            key="multi-drag"
            song={dragSong}
            onPass={() => {
              const score = scoreHumanConfidence({
                motionSamples: [],
                directedTimings: undefined,
                stabilityPct: 100,
                stabilityHoldPct: 100,
              });
              finish(score);
            }}
            onSkip={() => {
              const score = scoreHumanConfidence({
                motionSamples: [],
                directedTimings: undefined,
                stabilityPct: 60,
                stabilityHoldPct: 60,
              });
              finish(score);
            }}
            reduceMotion={reduceMotion}
            accessibilityMode={accessibility.screenReaderActive}
          />
        ) : null}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 3 — RESULT
        ═══════════════════════════════════════════════════════════ */}
        {screen === "result" ? (
          <motion.section
            key="result"
            className="min-h-[100dvh] overflow-hidden w-full"
            style={{ background: "#0f172a" }}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
            transition={reduceMotion ? undefined : { type: "spring", stiffness: 200, damping: 26, mass: 0.6 }}
          >
            <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-6 py-10">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.52em] text-slate-500">KINETICAUTH</p>
                <AccessibilityBadge isActive={accessibility.screenReaderActive || accessibility.reduceMotion} compact />
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
