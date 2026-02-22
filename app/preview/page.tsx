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

  const targetRef = useRef({ beta: 0, gamma: 0 });
  const smoothRef = useRef({ beta: 0, gamma: 0 });
  const rafRef = useRef<number | null>(null);

  const [sensorValues, setSensorValues] = useState({ beta: 0, gamma: 0 });

  // Detect initial permission state on mount
  useEffect(() => {
    setPermissionState(detectInitialPermissionState());
  }, []);

  // Attach deviceorientation listener when granted
  useEffect(() => {
    if (permissionState !== "granted") return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.beta === "number") targetRef.current.beta = e.beta;
      if (typeof e.gamma === "number") targetRef.current.gamma = e.gamma;
    };

    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [permissionState]);

  // Lerp animation loop — feeds smoothed values into PhoneTiltPreview
  useEffect(() => {
    if (permissionState !== "granted") return;

    let last = 0;

    const tick = (t: number) => {
      rafRef.current = window.requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      last = t;

      const target = targetRef.current;
      const s = smoothRef.current;

      s.beta = s.beta + (target.beta - s.beta) * 0.1;
      s.gamma = s.gamma + (target.gamma - s.gamma) * 0.1;

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
        height: "100vh",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: "antialiased",
        color: "#fff",
        overflow: "hidden",
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
          margin: "0 0 32px 0",
          textAlign: "center"
        }}
      >
        Live Motion Detection Preview
      </h1>

      {/* PhoneTiltPreview — full hero element */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: 320,
          height: 640,
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
    </main>
  );
}
