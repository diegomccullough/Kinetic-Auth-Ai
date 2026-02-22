"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PermissionState = "unknown" | "needs_gesture" | "granted" | "denied" | "unsupported";

type SensorValues = {
  beta: number;
  gamma: number;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function detectInitialPermissionState(): PermissionState {
  if (typeof window === "undefined") return "unknown";
  if (!("DeviceOrientationEvent" in window)) return "unsupported";
  const req = (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission;
  return typeof req === "function" ? "needs_gesture" : "granted";
}

// ─── Phone Model (CSS 3D) ─────────────────────────────────────────────────────

type PhoneModelProps = {
  rotateX: number;
  rotateY: number;
  glowActive: boolean;
  modelFailed?: boolean;
};

function PhoneModel({ rotateX, rotateY, glowActive, modelFailed }: PhoneModelProps) {
  if (modelFailed) {
    return (
      <div
        style={{
          width: 120,
          height: 210,
          borderRadius: 18,
          background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
        }}
        aria-label="Phone model fallback"
      />
    );
  }

  const shadowX = clamp(rotateY * 0.55, -14, 14);
  const shadowY = 18 + clamp(rotateX * 0.35, -10, 10);
  const glowAlpha = glowActive ? 0.45 : 0.14;
  const glowSize = glowActive ? 90 : 60;

  return (
    <div
      style={{
        width: "min(54vw, 220px)",
        aspectRatio: "9 / 19.5",
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: "preserve-3d",
        transformOrigin: "center center",
        willChange: "transform",
        transition: "box-shadow 0.3s ease",
        boxShadow: [
          `${shadowX}px ${shadowY}px 80px rgba(0,0,0,0.65)`,
          `0 0 ${glowSize}px rgba(34,211,238,${glowAlpha})`,
          glowActive ? `0 0 120px rgba(34,211,238,0.18)` : ""
        ]
          .filter(Boolean)
          .join(", "),
        borderRadius: 34,
        position: "relative"
      }}
      aria-label="3D phone model responding to device orientation"
    >
      {/* Outer shell */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 34,
          background: "linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 100%)",
          border: "1px solid rgba(255,255,255,0.18)"
        }}
      />

      {/* Reactive rim */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 34,
          pointerEvents: "none",
          boxShadow: glowActive
            ? "0 0 0 1px rgba(34,211,238,0.55) inset, 0 0 48px rgba(34,211,238,0.22)"
            : "0 0 0 1px rgba(34,211,238,0.22) inset, 0 0 28px rgba(34,211,238,0.08)",
          transition: "box-shadow 0.25s ease"
        }}
        aria-hidden="true"
      />

      {/* Screen */}
      <div
        style={{
          position: "absolute",
          inset: 10,
          borderRadius: 26,
          background: "#020a14",
          border: "1px solid rgba(255,255,255,0.10)",
          overflow: "hidden"
        }}
      >
        {/* Screen ambient */}
        <div
          style={{
            position: "absolute",
            inset: -24,
            background:
              "radial-gradient(circle at 30% 20%, rgba(34,211,238,0.38) 0%, rgba(99,102,241,0.16) 36%, rgba(0,0,0,1) 72%)"
          }}
          aria-hidden="true"
        />
        <div
          style={{
            position: "absolute",
            inset: -24,
            background:
              "radial-gradient(circle at 70% 70%, rgba(16,185,129,0.16) 0%, rgba(0,0,0,0) 55%)",
            opacity: 0.7
          }}
          aria-hidden="true"
        />

        {/* Screen content — subtle motion badge */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: "6px 10px",
            border: "1px solid rgba(255,255,255,0.10)"
          }}
        >
          <p
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: "rgba(255,255,255,0.65)",
              margin: 0
            }}
          >
            MOTION
          </p>
        </div>

        {/* Highlight overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(255,255,255,0))",
            opacity: 0.45
          }}
          aria-hidden="true"
        />
      </div>

      {/* Notch / Dynamic Island */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          width: 64,
          height: 10,
          borderRadius: 99,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.10)"
        }}
        aria-hidden="true"
      />

      {/* Specular highlight */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 34,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 44%, rgba(255,255,255,0) 72%)",
          pointerEvents: "none"
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Sensor Indicator ─────────────────────────────────────────────────────────

function SensorIndicator({ granted }: { granted: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginTop: 10
      }}
    >
      <span
        style={{
          display: "block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: granted ? "#22c55e" : "#ef4444",
          boxShadow: granted
            ? "0 0 6px rgba(34,197,94,0.7)"
            : "0 0 6px rgba(239,68,68,0.6)",
          flexShrink: 0
        }}
        aria-hidden="true"
      />
      <span
        style={{
          fontSize: 12,
          color: granted ? "rgba(134,239,172,0.9)" : "rgba(252,165,165,0.9)",
          fontWeight: 500,
          letterSpacing: "0.01em"
        }}
      >
        {granted ? "Gyroscope: Active" : "Gyroscope: Permission required"}
      </span>
    </div>
  );
}

// ─── Debug Panel ─────────────────────────────────────────────────────────────

function DebugPanel({ beta, gamma }: { beta: number; gamma: number }) {
  const magnitude = Math.hypot(beta, gamma);
  const signal = magnitude < 3 ? "Low" : magnitude < 12 ? "Medium" : "High";
  const signalColor = magnitude < 3 ? "#64748b" : magnitude < 12 ? "#f59e0b" : "#22c55e";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "0 1px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        overflow: "hidden",
        width: "100%",
        maxWidth: 340
      }}
      role="status"
      aria-label="Real-time sensor debug values"
    >
      {[
        { label: "Beta", value: `${beta > 0 ? "+" : ""}${beta.toFixed(1)}°` },
        { label: "Gamma", value: `${gamma > 0 ? "+" : ""}${gamma.toFixed(1)}°` },
        { label: "Signal", value: signal, color: signalColor }
      ].map((item) => (
        <div
          key={item.label}
          style={{
            padding: "8px 12px",
            background: "rgba(15,23,42,0.6)"
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: "rgba(100,116,139,1)",
              letterSpacing: "0.08em",
              fontWeight: 600,
              margin: "0 0 2px 0",
              textTransform: "uppercase"
            }}
          >
            {item.label}
          </p>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: item.color ?? "rgba(226,232,240,0.9)",
              margin: 0,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MotionPreviewPage() {
  const router = useRouter();

  // Permission state
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown");

  // Raw sensor targets
  const targetRef = useRef({ beta: 0, gamma: 0 });
  // Smoothed display values (for UI)
  const smoothRef = useRef({ beta: 0, gamma: 0 });

  // Applied rotation (for 3D model) — updated each RAF tick
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  // Readable debug values for React render
  const [debugValues, setDebugValues] = useState<SensorValues>({ beta: 0, gamma: 0 });

  // Glow active when |gamma| > 5
  const [glowActive, setGlowActive] = useState(false);

  // RAF loop ref
  const rafRef = useRef<number | null>(null);

  // Model failure fallback
  const [modelFailed] = useState(false);

  // ── Determine initial permission state on mount ────────────────────────────
  useEffect(() => {
    setPermissionState(detectInitialPermissionState());
  }, []);

  // ── Attach deviceorientation listener when granted ─────────────────────────
  useEffect(() => {
    if (permissionState !== "granted") return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.beta === "number") targetRef.current.beta = e.beta;
      if (typeof e.gamma === "number") targetRef.current.gamma = e.gamma;
    };

    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [permissionState]);

  // ── Lerp animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (permissionState !== "granted") return;

    let last = 0;

    const tick = (t: number) => {
      rafRef.current = window.requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      last = t;

      const target = targetRef.current;
      const s = smoothRef.current;

      // Lerp: current += (target - current) * 0.1
      s.beta = s.beta + (target.beta - s.beta) * 0.1;
      s.gamma = s.gamma + (target.gamma - s.gamma) * 0.1;

      // Map to rotation: beta → rotateX, gamma → rotateY
      const rx = clamp(-s.beta * 0.55, -25, 25);
      const ry = clamp(s.gamma * 0.55, -25, 25);

      const glow = Math.abs(s.gamma) > 5;

      setRotation({ x: rx, y: ry });
      setGlowActive(glow);

      // Update debug values at reduced frequency to avoid layout thrash
      setDebugValues({
        beta: parseFloat(s.beta.toFixed(1)),
        gamma: parseFloat(s.gamma.toFixed(1))
      });
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [permissionState]);

  // ── iOS permission request ─────────────────────────────────────────────────
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

  // ── CTA handler ────────────────────────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    if (permissionState === "needs_gesture") {
      await requestPermission();
      return;
    }
    router.push("/verify");
  }, [permissionState, requestPermission, router]);

  const granted = permissionState === "granted";
  const unsupported = permissionState === "unsupported" || permissionState === "denied";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#080f1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
        paddingTop: 0,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: "antialiased",
        color: "#fff",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* ── Background ambience ─────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 80% 55% at 50% -5%, rgba(30,64,175,0.20) 0%, transparent 100%)",
          zIndex: 0
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "38%",
          background:
            "linear-gradient(to top, rgba(2,6,23,0.85) 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 0
        }}
      />

      {/* ── Wordmark ────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          paddingTop: 28,
          width: "100%",
          maxWidth: 480,
          display: "flex",
          justifyContent: "center"
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.52em",
            color: "rgba(100,116,139,0.8)",
            margin: 0
          }}
        >
          KINETICAUTH
        </p>
      </div>

      {/* ── Hero section: 3D phone ──────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: 480,
          gap: 0,
          /* Phone occupies ~65vh */
          minHeight: "65dvh"
        }}
      >
        {/* Subtle radial glow behind phone */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: glowActive
              ? "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(34,211,238,0.12) 0%, transparent 70%)"
              : "radial-gradient(ellipse 50% 45% at 50% 50%, rgba(34,211,238,0.05) 0%, transparent 70%)",
            transition: "background 0.4s ease",
            pointerEvents: "none"
          }}
        />

        <PhoneModel
          rotateX={rotation.x}
          rotateY={rotation.y}
          glowActive={glowActive}
          modelFailed={modelFailed}
        />
      </div>

      {/* ── Bottom content block ────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0
        }}
      >
        {/* Title + subtitle */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <h1
            style={{
              fontSize: "clamp(18px, 5vw, 22px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f1f5f9",
              margin: "0 0 6px 0",
              lineHeight: 1.2
            }}
          >
            Live Motion Detection Preview
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "rgba(148,163,184,0.9)",
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 300
            }}
          >
            Move your phone to see real-time orientation tracking.
          </p>
          <SensorIndicator granted={granted && !unsupported} />
        </div>

        {/* Debug panel */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            marginTop: 14,
            marginBottom: 18
          }}
        >
          <DebugPanel
            beta={granted ? debugValues.beta : 0}
            gamma={granted ? debugValues.gamma : 0}
          />
        </div>

        {/* CTA button */}
        <button
          type="button"
          onClick={handleContinue}
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
            cursor: "pointer",
            transition: "background 0.15s ease",
            outline: "none",
            WebkitTapHighlightColor: "transparent"
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1e40af";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1d4ed8";
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1e3a8a";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1e40af";
          }}
        >
          {permissionState === "needs_gesture"
            ? "Enable Motion Sensor"
            : "Continue to Verification"}
        </button>

        {unsupported && (
          <p
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "rgba(100,116,139,0.9)",
              textAlign: "center"
            }}
          >
            Motion sensors unavailable on this device.
          </p>
        )}
      </div>
    </main>
  );
}
