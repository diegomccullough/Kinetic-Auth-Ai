"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

export type DeviceOrientationPermissionState =
  | "unknown"
  | "needs_gesture"
  | "granted"
  | "denied"
  | "unsupported";

type Orientation = { beta: number; gamma: number; alpha: number };

function getInitialPermissionState(): { available: boolean; permissionState: DeviceOrientationPermissionState } {
  if (typeof window === "undefined") return { available: false, permissionState: "unknown" };
  if (!("DeviceOrientationEvent" in window)) return { available: false, permissionState: "unsupported" };

  const req = (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission;
  if (typeof req === "function") return { available: true, permissionState: "needs_gesture" };
  return { available: true, permissionState: "granted" };
}

export function useDeviceOrientation(): Orientation & {
  available: boolean;
  permissionState: DeviceOrientationPermissionState;
  requestPermission: () => Promise<DeviceOrientationPermissionState>;
  smoothedBeta: number;
  smoothedGamma: number;
  smoothedAlpha: number;
  smoothedRef: MutableRefObject<Orientation>;
} {
  const initial = useRef(getInitialPermissionState());

  const [available, setAvailable] = useState(initial.current.available);
  const [permissionState, setPermissionState] = useState<DeviceOrientationPermissionState>(initial.current.permissionState);
  const [beta, setBeta] = useState(0);
  const [gamma, setGamma] = useState(0);
  const [alpha, setAlpha] = useState(0);
  const rawRef = useRef({ beta: 0, gamma: 0, alpha: 0 });

  const [smoothedBeta, setSmoothedBeta] = useState(0);
  const [smoothedGamma, setSmoothedGamma] = useState(0);
  const [smoothedAlpha, setSmoothedAlpha] = useState(0);
  const smoothedRef = useRef({ beta: 0, gamma: 0, alpha: 0 });

  // Re-check on mount (covers hydration / env changes).
  useEffect(() => {
    const next = getInitialPermissionState();
    setAvailable(next.available);
    setPermissionState(next.permissionState);
  }, []);

  const requestPermission = useCallback(async (): Promise<DeviceOrientationPermissionState> => {
    // iOS Safari path: must be called from a user gesture.
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function"
    ) {
      try {
        const res = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<"granted" | "denied"> }
        ).requestPermission();
        const next = res === "granted" ? "granted" : "denied";
        setAvailable(true);
        setPermissionState(next);
        return next;
      } catch {
        setAvailable(true);
        setPermissionState("denied");
        return "denied";
      }
    }

    // Non-iOS / no explicit permission API.
    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      setAvailable(true);
      setPermissionState("granted");
      return "granted";
    }

    setAvailable(false);
    setPermissionState("unsupported");
    return "unsupported";
  }, []);

  // Attach listener only once granted.
  useEffect(() => {
    if (!available) return;
    if (permissionState !== "granted") return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      const b = typeof e.beta === "number" ? e.beta : 0;
      const g = typeof e.gamma === "number" ? e.gamma : 0;
      const a = typeof e.alpha === "number" ? e.alpha : 0;

      rawRef.current = { beta: b, gamma: g, alpha: a };
      setBeta(b);
      setGamma(g);
      setAlpha(a);
    };

    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [available, permissionState]);

  // Smooth values via rAF to reduce jitter (consumer can use smoothed* for logic/UI).
  useEffect(() => {
    if (!available) return;
    if (permissionState !== "granted") return;

    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = window.requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      last = t;

      const target = rawRef.current;
      const s = smoothedRef.current;
      s.beta = s.beta + (target.beta - s.beta) * 0.08;
      s.gamma = s.gamma + (target.gamma - s.gamma) * 0.08;
      s.alpha = s.alpha + (target.alpha - s.alpha) * 0.08;

      // Avoid re-rendering on tiny changes.
      setSmoothedBeta((prev) => (Math.abs(prev - s.beta) > 0.05 ? s.beta : prev));
      setSmoothedGamma((prev) => (Math.abs(prev - s.gamma) > 0.05 ? s.gamma : prev));
      setSmoothedAlpha((prev) => (Math.abs(prev - s.alpha) > 0.05 ? s.alpha : prev));
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [available, permissionState]);

  return {
    beta,
    gamma,
    alpha,
    available,
    permissionState,
    requestPermission,
    smoothedBeta,
    smoothedGamma,
    smoothedAlpha,
    smoothedRef
  };
}

