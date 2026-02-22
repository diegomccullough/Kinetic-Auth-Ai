"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PhoneTiltPreview from "@/components/PhoneTiltPreview";

// ─── Types ────────────────────────────────────────────────────────────────────

type PermissionState = "unknown" | "needs_gesture" | "granted" | "denied" | "unsupported";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectInitialPermissionState(): PermissionState {
  if (typeof window === "undefined") return "unknown";
  if (!("DeviceOrientationEvent" in window)) return "unsupported";
  const req = (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission;
  return typeof req === "function" ? "needs_gesture" : "granted";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MotionPreviewPage() {
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown");

  const latestOrientation = useRef({ beta: 0, gamma: 0 });
  const smoothRef = useRef({ beta: 0, gamma: 0 });
  const baselineRef = useRef<{ beta: number; gamma: number } | null>(null);
  const animateToZeroUntilRef = useRef<number>(0);
  const stableLowTiltSinceRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const [sensorValues, setSensorValues] = useState({ beta: 0, gamma: 0 });
  const [toast, setToast] = useState<string | null>(null);

  const SENSITIVITY = 1.8;
  const SMOOTHING = 0.25;
  const CLAMP_DEG = 45;
  const DEAD_ZONE_DEG = 2;
  const RECAL_ANIM_MS = 300;
  const SOFT_STAB_THRESHOLD_DEG = 2;
  const SOFT_STAB_DURATION_MS = 1500;
  const SOFT_STAB_NUDGE = 0.02;

  // Detect initial permission state on mount
  useEffect(() => {
    setPermissionState(detectInitialPermissionState());
  }, []);

  // Reset smooth state and baseline when permission is revoked
  useEffect(() => {
    if (permissionState !== "granted") {
      smoothRef.current = { beta: 0, gamma: 0 };
      baselineRef.current = null;
      animateToZeroUntilRef.current = 0;
      stableLowTiltSinceRef.current = null;
      setSensorValues({ beta: 0, gamma: 0 });
    }
  }, [permissionState]);

  // Attach deviceorientation listener
  useEffect(() => {
    if (permissionState !== "granted") return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      latestOrientation.current.beta = event.beta ?? 0;
      latestOrientation.current.gamma = event.gamma ?? 0;
    };

    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [permissionState]);

  // Double-tap recalibration (no navigation)
  const handlePreviewPointerDown = useCallback(() => {
    if (permissionState !== "granted") return;
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      lastTapRef.current = 0;
      const raw = latestOrientation.current;
      baselineRef.current = { beta: raw.beta, gamma: raw.gamma };
      animateToZeroUntilRef.current = now + RECAL_ANIM_MS;
      stableLowTiltSinceRef.current = null;
      setToast("Orientation recalibrated");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    lastTapRef.current = now;
  }, [permissionState]);

  // Visual stabilization + recalibration animation + soft stabilization
  useEffect(() => {
    if (permissionState !== "granted") return;

    smoothRef.current = { beta: 0, gamma: 0 };

    let last = 0;
    const deadZone = (v: number) => (Math.abs(v) < DEAD_ZONE_DEG ? 0 : v);

    const tick = (t: number) => {
      rafRef.current = window.requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      last = t;
      const now = Date.now();
      const raw = latestOrientation.current;
      const base = baselineRef.current;

      // Recalibration: animate display to 0 over ~300ms
      if (animateToZeroUntilRef.current > 0) {
        const s = smoothRef.current;
        s.beta += (0 - s.beta) * 0.25;
        s.gamma += (0 - s.gamma) * 0.25;
        setSensorValues({ beta: parseFloat(s.beta.toFixed(2)), gamma: parseFloat(s.gamma.toFixed(2)) });
        if (now >= animateToZeroUntilRef.current) {
          animateToZeroUntilRef.current = 0;
          smoothRef.current = { beta: 0, gamma: 0 };
          setSensorValues({ beta: 0, gamma: 0 });
        }
        return;
      }

      // Relative to baseline when set
      const relBeta = base ? raw.beta - base.beta : raw.beta;
      const relGamma = base ? raw.gamma - base.gamma : raw.gamma;
      let targetBeta = Math.min(CLAMP_DEG, Math.max(-CLAMP_DEG, deadZone(relBeta) * SENSITIVITY));
      let targetGamma = Math.min(CLAMP_DEG, Math.max(-CLAMP_DEG, deadZone(relGamma) * SENSITIVITY));

      // Soft stabilization: if tilt magnitude < 2° for 1500ms, nudge baseline toward current
      const mag = Math.hypot(targetBeta, targetGamma);
      if (mag < SOFT_STAB_THRESHOLD_DEG && base) {
        if (stableLowTiltSinceRef.current === null) stableLowTiltSinceRef.current = now;
        else if (now - stableLowTiltSinceRef.current >= SOFT_STAB_DURATION_MS) {
          base.beta += (raw.beta - base.beta) * SOFT_STAB_NUDGE;
          base.gamma += (raw.gamma - base.gamma) * SOFT_STAB_NUDGE;
        }
      } else {
        stableLowTiltSinceRef.current = null;
      }

      const s = smoothRef.current;
      s.beta += (targetBeta - s.beta) * SMOOTHING;
      s.gamma += (targetGamma - s.gamma) * SMOOTHING;

      setSensorValues({
        beta: parseFloat(s.beta.toFixed(2)),
        gamma: parseFloat(s.gamma.toFixed(2))
      });
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [permissionState]);

  // iOS permission request
  const requestPermission = useCallback(async () => {
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof DOE.requestPermission !== "function") {
      setPermissionState("granted");
      return;
    }

    try {
      const result = await DOE.requestPermission();
      setPermissionState(result === "granted" ? "granted" : "denied");
    } catch {
      setPermissionState("denied");
    }
  }, []);

  const handleGrantClick = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  const granted = permissionState === "granted";

  return (
    <main
      style={{
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        gap: 28,
        background: "#0f172a",
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: "antialiased",
        color: "#fff",
        position: "relative"
      }}
    >
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,211,238,0.07) 0%, transparent 70%)",
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
          margin: 0,
          textAlign: "center"
        }}
      >
        Live Motion Detection Preview
      </h1>

      {/* Motion status — only when permission granted */}
      {granted && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            fontSize: 12,
            color: "rgba(34,211,238,0.9)",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <span aria-hidden>🟢</span>
          <span>Motion Active</span>
        </div>
      )}

      {/* PhoneTiltPreview — flexGrow centers it vertically; double-tap area for recalibration */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0
        }}
      >
        <div
          role="region"
          aria-label="Motion preview"
          style={{
            position: "relative",
            width: "min(80vw, 360px)",
            aspectRatio: "1 / 1.9",
            flexShrink: 0,
            touchAction: "manipulation"
          }}
          onPointerDown={handlePreviewPointerDown}
        >
        {permissionState === "needs_gesture" ? (
          // iOS gate: show tap-to-enable prompt over the phone shell
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 28,
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(255,255,255,0.10)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              boxShadow: "0 22px 70px rgba(0,0,0,0.55)"
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: "rgba(148,163,184,0.9)",
                textAlign: "center",
                maxWidth: 220,
                margin: 0,
                lineHeight: 1.5
              }}
            >
              Tap to enable motion sensors for real-time tracking.
            </p>
            <button
              type="button"
              onClick={handleGrantClick}
              style={{
                padding: "12px 28px",
                borderRadius: 12,
                background: "#1d4ed8",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                letterSpacing: "-0.01em"
              }}
            >
              Enable Motion Sensor
            </button>
          </div>
        ) : (
          <PhoneTiltPreview
            beta={granted ? sensorValues.beta : 0}
            gamma={granted ? sensorValues.gamma : 0}
            reduceMotion={!granted}
            variant="cinematic"
            showBadge
          />
        )}
        </div>
        {/* Live tilt debug — X-axis rotation (rotateX) */}
        {granted && (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 11,
              color: "rgba(148,163,184,0.5)",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            Tilt: {Math.round(-sensorValues.beta)}°
          </p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            padding: "8px 14px",
            borderRadius: 8,
            background: "rgba(15,23,42,0.92)",
            border: "1px solid rgba(34,211,238,0.25)",
            color: "rgba(226,232,240,0.95)",
            fontSize: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
          }}
        >
          {toast}
        </div>
      )}

      {/* Subtitle */}
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

      {/* Spacer for iOS safe area */}
      <div style={{ height: "calc(20px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }} aria-hidden="true" />
    </main>
  );
}
