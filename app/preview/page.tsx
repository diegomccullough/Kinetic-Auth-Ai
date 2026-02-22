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
  const calibrationTimeoutRef = useRef<
    number | ReturnType<typeof setTimeout> | null
  >(null);
  const rafRef = useRef<number | null>(null);

  const [sensorValues, setSensorValues] = useState({ beta: 0, gamma: 0 });
  const [calibrationComplete, setCalibrationComplete] = useState(false);

  const CALIBRATION_DELAY_MS = 500;
  const SMOOTHING = 0.3;

  // Detect initial permission state on mount
  useEffect(() => {
    setPermissionState(detectInitialPermissionState());
  }, []);

  // Reset calibration when permission is not granted (so re-grant triggers fresh calibration)
  useEffect(() => {
    if (permissionState !== "granted") {
      baselineRef.current = null;
      setCalibrationComplete(false);
    }
  }, [permissionState]);

  // Attach deviceorientation listener immediately after permission; only store raw beta/gamma (do NOT capture baseline here)
  useEffect(() => {
    if (permissionState !== "granted") return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      latestOrientation.current.beta = event.beta ?? 0;
      latestOrientation.current.gamma = event.gamma ?? 0;
    };

    window.addEventListener("deviceorientation", handleOrientation, { passive: true });

    // After 500ms, capture baseline from latestOrientation at that moment; only then enable motion
    calibrationTimeoutRef.current = window.setTimeout(() => {
      baselineRef.current = {
        beta: latestOrientation.current.beta,
        gamma: latestOrientation.current.gamma
      };
      setCalibrationComplete(true);
    }, CALIBRATION_DELAY_MS);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      if (calibrationTimeoutRef.current) {
        window.clearTimeout(calibrationTimeoutRef.current);
        calibrationTimeoutRef.current = null;
      }
    };
  }, [permissionState]);

  // Apply motion only after baseline is set: relative to baseline, smoothing 0.3 (dead zone, sensitivity, clamp in PhoneTiltPreview)
  useEffect(() => {
    if (permissionState !== "granted") return;

    let last = 0;

    const tick = (t: number) => {
      rafRef.current = window.requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      last = t;

      const latest = latestOrientation.current;
      const base = baselineRef.current;

      if (!calibrationComplete || base === null) {
        setSensorValues({ beta: 0, gamma: 0 });
        smoothRef.current = { beta: 0, gamma: 0 };
        return;
      }

      const relBeta = latest.beta - base.beta;
      const relGamma = latest.gamma - base.gamma;
      const s = smoothRef.current;
      s.beta = s.beta + (relBeta - s.beta) * SMOOTHING;
      s.gamma = s.gamma + (relGamma - s.gamma) * SMOOTHING;

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
  }, [permissionState, calibrationComplete]);

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

      {/* PhoneTiltPreview — flexGrow centers it vertically */}
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
        <div
          style={{
            position: "relative",
            width: "min(80vw, 360px)",
            aspectRatio: "1 / 1.9",
            flexShrink: 0
          }}
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
      </div>

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
