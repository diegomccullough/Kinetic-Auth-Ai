"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_MODE } from "@/lib/demoMode";

type Step = "intro" | "kinetic" | "success";
type MotionPermissionState = "unknown" | "needs_gesture" | "granted" | "denied" | "unsupported";

const MAX_FPS = 60;
const CLAMP_TILT_DEG = 30;
const MAX_OFFSET_PX = 92;
const STABLE_RADIUS_PX = 40;
const STABLE_TARGET_MS = 1800;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function mapTiltToPx(deg: number) {
  const unit = clamp(deg / CLAMP_TILT_DEG, -1, 1);
  return unit * MAX_OFFSET_PX;
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

async function requestOrientationPermission(): Promise<MotionPermissionState> {
  if (typeof window === "undefined") return "unsupported";
  if (!("DeviceOrientationEvent" in window)) return "unsupported";

  const maybe = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };

  if (typeof maybe.requestPermission !== "function") {
    return "granted";
  }

  try {
    const res = await maybe.requestPermission();

    // Optional: also prompt for devicemotion if it exists (does not gate this demo).
    const maybeMotion = (window as unknown as { DeviceMotionEvent?: unknown }).DeviceMotionEvent as
      | { requestPermission?: () => Promise<"granted" | "denied"> }
      | undefined;
    if (maybeMotion && typeof maybeMotion.requestPermission === "function") {
      maybeMotion.requestPermission().catch(() => {});
    }

    return res === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

function StepPill({ n, label, active }: { n: string; label: string; active: boolean }) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 transition-colors",
        active ? "bg-white/10 text-white ring-white/15" : "bg-white/5 text-white/45 ring-white/10"
      ].join(" ")}
    >
      <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] ring-1 ring-white/10">
        {n}
      </span>
      <span className="font-medium tracking-tight">{label}</span>
    </div>
  );
}

export default function KineticWizard() {
  const demo = DEMO_MODE;
  const [step, setStep] = useState<Step>("intro");
  const [permission, setPermission] = useState<MotionPermissionState>("unknown");

  const [dot, setDot] = useState({ x: 0, y: 0 });
  const [progress, setProgress] = useState(0);
  const [inside, setInside] = useState(false);
  const [tilt, setTilt] = useState({ beta: 0, gamma: 0 });

  const stableMsRef = useRef(0);
  const latestRef = useRef({ beta: 0, gamma: 0, has: false });
  const doneRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) {
      setPermission("unsupported");
      return;
    }
    const maybe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<unknown> };
    setPermission(typeof maybe.requestPermission === "function" ? "needs_gesture" : "granted");
  }, []);

  const onEnableMotion = useCallback(async () => {
    const res = await requestOrientationPermission();
    setPermission(res);
  }, []);

  const kineticReady = permission === "granted";

  useEffect(() => {
    if (!kineticReady) return;
    if (step !== "kinetic") return;

    stableMsRef.current = 0;
    doneRef.current = false;
    setProgress(0);
    setDot({ x: 0, y: 0 });
    setInside(false);

    let raf = 0;
    let last = 0;

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.beta !== "number" || typeof e.gamma !== "number") return;
      latestRef.current = { beta: e.beta, gamma: e.gamma, has: true };
    };

    const tick = (t: number) => {
      raf = window.requestAnimationFrame(tick);
      if (t - last < 1000 / MAX_FPS) return;
      const dt = last ? Math.min(60, t - last) : 16;
      last = t;

      const latest = latestRef.current;
      if (!latest.has) return;

      const x = mapTiltToPx(latest.gamma);
      const y = mapTiltToPx(latest.beta);
      const dist = Math.hypot(x, y);
      const inZone = dist <= STABLE_RADIUS_PX;

      const add = inZone ? dt : -dt * 0.75;
      stableMsRef.current = clamp(stableMsRef.current + add, 0, STABLE_TARGET_MS);
      const pct = (stableMsRef.current / STABLE_TARGET_MS) * 100;

      setTilt({ beta: latest.beta, gamma: latest.gamma });
      setInside(inZone);
      setProgress(pct);
      setDot((prev) => {
        const dx = Math.abs(prev.x - x);
        const dy = Math.abs(prev.y - y);
        if (dx < 0.15 && dy < 0.15) return prev;
        return { x, y };
      });

      if (pct >= 100 && !doneRef.current) {
        doneRef.current = true;
        if (demo) vibrate([12, 18, 12]);
        window.setTimeout(() => setStep("success"), 650);
      }
    };

    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.cancelAnimationFrame(raf);
    };
  }, [kineticReady, step]);

  const chrome = useMemo(() => {
    const a = inside ? (demo ? 0.34 : 0.22) : demo ? 0.18 : 0.12;
    return `0 0 52px rgba(56,189,248,${a}), 0 0 96px rgba(99,102,241,${a * 0.7})`;
  }, [demo, inside]);

  const bgShift = useMemo(() => {
    if (!demo) return { x: 0, y: 0 };
    const x = clamp(tilt.gamma, -18, 18) * 0.7;
    const y = clamp(tilt.beta, -18, 18) * 0.55;
    return { x, y };
  }, [demo, tilt.beta, tilt.gamma]);

  return (
    <main className="min-h-dvh px-4 pb-10 pt-8">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(56,189,248,0.22)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,1)_76%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_25%,rgba(255,255,255,0.10)_0%,rgba(0,0,0,0)_62%)]" />
          {demo ? (
            <motion.div className="absolute -inset-16 opacity-70" style={{ x: bgShift.x, y: bgShift.y }} aria-hidden="true">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.24)_0%,rgba(99,102,241,0.16)_30%,rgba(0,0,0,0)_72%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.12)_0%,rgba(0,0,0,0)_58%)]" />
            </motion.div>
          ) : null}
          {demo ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 35%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.48) 72%, rgba(0,0,0,0.82) 100%)"
              }}
              aria-hidden="true"
            />
          ) : null}

          <div className="relative px-5 pb-6 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.26em] text-white/60">SECURE CHECKOUT</p>
                <h1
                  className={[
                    "mt-2 text-balance font-semibold leading-[1.05] tracking-tight",
                    demo ? "text-[36px]" : "text-[28px]"
                  ].join(" ")}
                >
                  Step-up verification
                </h1>
                <p className="mt-2 text-sm text-white/65">A quick kinetic signature to unlock purchase.</p>
              </div>
              <Link
                href="/"
                className="shrink-0 rounded-2xl bg-white/5 px-3 py-2 text-xs font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/10"
              >
                Exit
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <StepPill n="01" label="Permission" active={step === "intro"} />
              <StepPill n="02" label="Kinetic" active={step === "kinetic"} />
              <StepPill n="03" label="Complete" active={step === "success"} />
            </div>

            <div className="mt-5 rounded-[24px] bg-white/[0.04] p-4 ring-1 ring-white/10">
              <AnimatePresence mode="popLayout" initial={false}>
                {step === "intro" ? (
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    <div>
                      <p className="text-xs font-semibold tracking-[0.22em] text-white/60">BEFORE YOU START</p>
                      <p className="mt-2 text-lg font-semibold tracking-tight">Allow motion access</p>
                      <p className="mt-1 text-sm text-white/65">
                        iOS Safari requires a tap to enable device orientation. We only use it during this step.
                      </p>
                    </div>

                    {permission === "needs_gesture" ? (
                      <button
                        type="button"
                        onClick={onEnableMotion}
                        className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(56,189,248,0.18)]"
                      >
                        Enable motion
                      </button>
                    ) : null}

                    {permission === "granted" ? (
                      <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-400/15">
                        Motion enabled. You’re ready.
                      </div>
                    ) : null}

                    {permission === "denied" ? (
                      <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-400/15">
                        Motion permission was denied. You can use voice verification instead.
                      </div>
                    ) : null}

                    {permission === "unsupported" ? (
                      <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
                        This browser doesn’t expose motion sensors. Use voice verification instead.
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setStep(kineticReady ? "kinetic" : "intro")}
                        disabled={!kineticReady}
                        className={[
                          "w-full rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition-colors",
                          kineticReady
                            ? "bg-white/10 text-white ring-white/15 hover:bg-white/15"
                            : "bg-white/5 text-white/40 ring-white/10"
                        ].join(" ")}
                      >
                        Continue
                      </button>

                      <Link
                        href="/voice"
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                      >
                        Use voice verification instead
                      </Link>
                    </div>
                  </motion.div>
                ) : null}

                {step === "kinetic" ? (
                  <motion.div
                    key="kinetic"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="space-y-5"
                  >
                    <div className="text-center">
                      <p className="text-xs font-semibold tracking-[0.22em] text-white/60">KINETIC SIGNATURE</p>
                      <p className={["mt-2 font-semibold tracking-tight", demo ? "text-2xl" : "text-lg"].join(" ")}>
                        {progress >= 100 ? "Locked in." : inside ? "Hold steady…" : "Center the dot"}
                      </p>
                      <p className="mt-1 text-sm text-white/65">Keep your phone still for a moment.</p>
                    </div>

                    <div className="flex items-center justify-center">
                      <div className={["relative", demo ? "h-[350px] w-[350px]" : "h-[290px] w-[290px]"].join(" ")}>
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          animate={{ boxShadow: chrome, scale: inside ? 1.01 : 1, opacity: 0.98 }}
                          transition={{ type: "spring", stiffness: 170, damping: 18 }}
                        />
                        <div className="absolute inset-[18px] rounded-full bg-white/[0.03] ring-1 ring-white/10" />

                        <svg
                          className="absolute inset-0 h-full w-full -rotate-90"
                          viewBox="0 0 300 300"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <circle
                            cx="150"
                            cy="150"
                            r="122"
                            stroke="rgba(255,255,255,0.10)"
                            strokeWidth={demo ? 14 : 10}
                            fill="none"
                          />
                          <motion.circle
                            cx="150"
                            cy="150"
                            r="122"
                            stroke="rgba(56,189,248,0.95)"
                            strokeWidth={demo ? 14 : 10}
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray={2 * Math.PI * 122}
                            animate={{ strokeDashoffset: (2 * Math.PI * 122) * (1 - progress / 100) }}
                            transition={{ type: "tween", duration: 0.16, ease: "linear" }}
                          />
                        </svg>

                        <div className="absolute inset-0 grid place-items-center">
                          <div className={["relative rounded-full", demo ? "h-[292px] w-[292px]" : "h-[242px] w-[242px]"].join(" ")}>
                            <div
                              className={[
                                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/10",
                                demo ? "h-[106px] w-[106px]" : "h-[88px] w-[88px]"
                              ].join(" ")}
                            />
                            <motion.div
                              className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200 shadow-[0_0_22px_rgba(56,189,248,0.65)]"
                              animate={{ x: dot.x, y: dot.y, scale: progress >= 100 ? 1.25 : 1 }}
                              transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.28 }}
                            />
                          </div>
                        </div>

                        <AnimatePresence>
                          {inside && progress < 100 ? (
                            <motion.div
                              className="absolute inset-[10px] rounded-full ring-1 ring-sky-300/25"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0.28, 0.65, 0.28], scale: [1, 1.02, 1] }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
                            />
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                        <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">BETA</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">{tilt.beta.toFixed(1)}°</p>
                      </div>
                      <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                        <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">GAMMA</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">{tilt.gamma.toFixed(1)}°</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setStep("intro")}
                        className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                      >
                        Back
                      </button>
                      <Link
                        href="/voice"
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
                      >
                        Can’t pass? Use voice verification
                      </Link>
                    </div>
                  </motion.div>
                ) : null}

                {step === "success" ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="space-y-5"
                  >
                    <div className="text-center">
                      <p className={["font-semibold tracking-[0.22em] text-white/60", demo ? "text-sm" : "text-xs"].join(" ")}>
                        VERIFIED
                      </p>
                      <p className={["mt-2 font-semibold tracking-tight", demo ? "text-5xl" : "text-2xl"].join(" ")}>
                        Checkout unlocked
                      </p>
                      <p className="mt-1 text-sm text-white/65">For the demo, choose the next step.</p>
                    </div>

                    <motion.div
                      className="relative mx-auto grid h-[190px] w-full place-items-center overflow-hidden rounded-[26px] bg-black/30 ring-1 ring-white/10"
                      initial={{ scale: 0.98, opacity: 0.9 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 160, damping: 18 }}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.22)_0%,rgba(99,102,241,0.14)_28%,rgba(0,0,0,0)_70%)]" />
                      <motion.div
                        className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"
                        animate={{ boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 70px rgba(56,189,248,0.18)", "0 0 0 rgba(0,0,0,0)"] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <div className="h-3 w-7 rounded-full bg-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.35)]" />
                      </motion.div>
                    </motion.div>

                    <div className="space-y-3">
                      <Link
                        href="/voice"
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(16,185,129,0.10)]"
                      >
                        Continue (voice step-up placeholder)
                      </Link>
                      <Link
                        href="/"
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
                      >
                        Back to tickets
                      </Link>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <p className="mt-4 text-center text-xs text-white/45">
              Tip: try this on a phone and gently tilt until the dot centers.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

