"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_MODE } from "@/lib/demoMode";

type SpotlightVerificationProps = {
  onVerified: () => void;
  onUseVoiceVerificationInstead?: () => void;
};

const SMOOTHING_WINDOW = 5;
const MAX_FPS = 60;
const RADIUS_THRESHOLD_PX = 40;
const MAX_OFFSET_PX = 86;
const CLAMP_TILT_DEG = 30;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function pushSample(buf: number[], v: number) {
  buf.push(v);
  if (buf.length > SMOOTHING_WINDOW) buf.shift();
}

function avg(buf: number[]) {
  if (!buf.length) return 0;
  let sum = 0;
  for (const v of buf) sum += v;
  return sum / buf.length;
}

function mapTiltToPx(deg: number) {
  const unit = clamp(deg / CLAMP_TILT_DEG, -1, 1);
  return unit * MAX_OFFSET_PX;
}

type MotionPermissionState = "unknown" | "needs_gesture" | "granted" | "denied" | "unsupported";
type VerificationState = "verifying" | "success";

type AmbientAudioHandle = {
  stop: () => void;
};

function tryStartAmbientAudio(): AmbientAudioHandle | null {
  const AudioContextCtor =
    typeof window !== "undefined"
      ? ((window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
          | typeof AudioContext
          | undefined)
      : undefined;

  if (!AudioContextCtor) return null;

  try {
    const ctx = new AudioContextCtor();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(110, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    filter.Q.setValueAtTime(0.4, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.025, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start();

    // Fade in.
    master.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.2);

    const stop = () => {
      try {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + 0.35);
        osc.stop(t + 0.4);
        setTimeout(() => {
          ctx.close().catch(() => {});
        }, 650);
      } catch {
        // ignore
      }
    };

    // If autoplay is blocked, this will stay suspended; still safe to keep handle.
    ctx.resume().catch(() => {});

    return { stop };
  } catch {
    return null;
  }
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

export default function SpotlightVerification({
  onVerified,
  onUseVoiceVerificationInstead
}: SpotlightVerificationProps) {
  const demo = DEMO_MODE;
  const [permission, setPermission] = useState<MotionPermissionState>("unknown");
  const [verificationState, setVerificationState] = useState<VerificationState>("verifying");

  const [progress, setProgress] = useState(0);
  const [dot, setDot] = useState({ x: 0, y: 0 });
  const [distance, setDistance] = useState(999);
  const [inside, setInside] = useState(false);

  const audioRef = useRef<AmbientAudioHandle | null>(null);
  const verifiedRef = useRef(false);
  const progressRef = useRef(0);

  const glow = useMemo(() => {
    const normalized = clamp(1 - distance / 140, 0, 1);
    return normalized;
  }, [distance]);

  const glowShadow = useMemo(() => {
    const a = (demo ? 0.18 : 0.14) + glow * (demo ? 0.42 : 0.32);
    const a2 = (demo ? 0.11 : 0.08) + glow * (demo ? 0.32 : 0.22);
    const b1 = (demo ? 30 : 22) + glow * (demo ? 66 : 46);
    const b2 = (demo ? 70 : 48) + glow * (demo ? 120 : 84);
    return `0 0 ${b1}px rgba(56,189,248,${a}), 0 0 ${b2}px rgba(99,102,241,${a2})`;
  }, [demo, glow]);

  const requestPermission = useCallback(async () => {
    if (!("DeviceOrientationEvent" in window)) {
      setPermission("unsupported");
      return;
    }
    const maybe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
    if (typeof maybe.requestPermission !== "function") {
      setPermission("granted");
      return;
    }
    try {
      const res = await maybe.requestPermission();
      setPermission(res === "granted" ? "granted" : "denied");
    } catch {
      setPermission("denied");
    }
  }, []);

  // Kick audio attempt on mount (and keep it subtle).
  useEffect(() => {
    if (audioRef.current) return;
    audioRef.current = tryStartAmbientAudio();

    // Mobile browsers often require a gesture; retry on first interaction.
    const retry = () => {
      if (audioRef.current) return;
      audioRef.current = tryStartAmbientAudio();
    };

    window.addEventListener("pointerdown", retry, { once: true });
    return () => {
      window.removeEventListener("pointerdown", retry);
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, []);

  // Decide permission UX on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) {
      setPermission("unsupported");
      return;
    }
    const maybe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<unknown> };
    if (typeof maybe.requestPermission === "function") {
      setPermission("needs_gesture");
    } else {
      setPermission("granted");
    }
  }, []);

  // Motion logic.
  useEffect(() => {
    if (permission !== "granted") return;
    if (verificationState !== "verifying") return;

    const betaBuf: number[] = [];
    const gammaBuf: number[] = [];
    let latestBeta = 0;
    let latestGamma = 0;
    let hasReading = false;
    let raf = 0;
    let lastFrame = 0;

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.beta !== "number" || typeof e.gamma !== "number") return;
      latestBeta = e.beta;
      latestGamma = e.gamma;
      hasReading = true;
    };

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      if (now - lastFrame < 1000 / MAX_FPS) return;

      const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / MAX_FPS;
      lastFrame = now;
      if (!hasReading) return;

      pushSample(betaBuf, latestBeta);
      pushSample(gammaBuf, latestGamma);
      const beta = avg(betaBuf);
      const gamma = avg(gammaBuf);

      const x = mapTiltToPx(gamma);
      const y = mapTiltToPx(beta);
      const dist = Math.hypot(x, y);
      const inZone = dist <= RADIUS_THRESHOLD_PX;

      const insideRate = 70; // pct/sec
      const outsideRate = 15; // pct/sec
      const nextProgress = clamp(
        progressRef.current + (inZone ? insideRate : -outsideRate) * dt,
        0,
        100
      );
      progressRef.current = nextProgress;

      setDot((prev) => {
        const dx = Math.abs(prev.x - x);
        const dy = Math.abs(prev.y - y);
        if (dx < 0.15 && dy < 0.15) return prev;
        return { x, y };
      });
      setDistance(dist);
      setInside(inZone);
      setProgress(nextProgress);

      if (nextProgress >= 100 && !verifiedRef.current) {
        verifiedRef.current = true;
        if (demo) vibrate([12, 18, 12]);
        setVerificationState("success");
        audioRef.current?.stop();
        audioRef.current = null;
        window.setTimeout(() => onVerified(), 650);
      }
    };

    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.cancelAnimationFrame(raf);
    };
  }, [onVerified, permission, verificationState]);

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="relative overflow-hidden rounded-[28px] ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_20%,rgba(30,58,138,0.65)_0%,rgba(2,6,23,0.92)_55%,rgba(0,0,0,1)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_25%,rgba(56,189,248,0.12)_0%,rgba(0,0,0,0)_60%)]" />
          {demo ? (
            <motion.div className="absolute -inset-16 opacity-70" style={{ x: dot.x * 0.08, y: dot.y * 0.08 }} aria-hidden="true">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.20)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,0)_74%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.12)_0%,rgba(0,0,0,0)_58%)]" />
            </motion.div>
          ) : null}
          {demo ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 35%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.50) 74%, rgba(0,0,0,0.86) 100%)"
              }}
              aria-hidden="true"
            />
          ) : null}

          <div className="relative px-5 pb-6 pt-6">
            <header className="text-center">
              <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-white sm:text-2xl">
                {verificationState === "success" ? "You’re in." : "Hold steady."}
              </h1>
              <p className="mt-1 text-sm text-white/70">
                {verificationState === "success" ? "Verification complete." : "Keep the dot centered."}
              </p>
            </header>

            <div className="mt-7 flex items-center justify-center">
              <div className={["relative", demo ? "h-[332px] w-[332px]" : "h-[276px] w-[276px]"].join(" ")}>
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{
                    scale: verificationState === "success" ? 1.05 : 1,
                    opacity: verificationState === "success" ? 1 : 0.95,
                    boxShadow: glowShadow
                  }}
                  transition={{ type: "spring", stiffness: 180, damping: 18 }}
                />

                <div className="absolute inset-[18px] rounded-full bg-white/[0.03] ring-1 ring-white/10" />

                <AnimatePresence>
                  {inside && verificationState === "verifying" ? (
                    <motion.div
                      className="absolute inset-[10px] rounded-full ring-1 ring-sky-300/25"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.02, 1] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : null}
                </AnimatePresence>

                <div className="absolute inset-0 grid place-items-center">
                  <div className="relative h-[238px] w-[238px] rounded-full">
                    <svg
                      className="absolute inset-0 h-full w-full -rotate-90"
                      viewBox="0 0 260 260"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <circle
                        cx="130"
                        cy="130"
                        r="112"
                        stroke="rgba(255,255,255,0.10)"
                        strokeWidth={demo ? 14 : 10}
                        fill="none"
                      />
                      <motion.circle
                        cx="130"
                        cy="130"
                        r="112"
                        stroke="rgba(56,189,248,0.95)"
                        strokeWidth={demo ? 14 : 10}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 112}
                        animate={{ strokeDashoffset: (2 * Math.PI * 112) * (1 - progress / 100) }}
                        transition={{ type: "tween", duration: 0.18, ease: "linear" }}
                      />
                    </svg>

                    <motion.div
                      className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.65)]"
                      animate={{
                        x: dot.x,
                        y: dot.y,
                        scale: verificationState === "success" ? 1.25 : 1
                      }}
                      transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.3 }}
                    />

                    <div className="absolute left-1/2 top-1/2 h-[82px] w-[82px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/10" />
                  </div>
                </div>

                <AnimatePresence>
                  {verificationState === "success" ? (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1.08 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.35)_0%,rgba(99,102,241,0.14)_35%,rgba(0,0,0,0)_66%)]" />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-white/55">
                <span>Stability</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className={["mt-2 w-full overflow-hidden rounded-full bg-white/10", demo ? "h-2" : "h-1.5"].join(" ")}>
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "tween", duration: 0.18, ease: "linear" }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {permission === "needs_gesture" ? (
                <button
                  type="button"
                  onClick={requestPermission}
                  className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
                >
                  Enable motion
                </button>
              ) : null}

              {permission === "denied" || permission === "unsupported" ? (
                <p className="text-center text-sm text-white/65">
                  Motion sensors aren’t available here.
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => onUseVoiceVerificationInstead?.()}
                className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
              >
                Use voice verification instead
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

