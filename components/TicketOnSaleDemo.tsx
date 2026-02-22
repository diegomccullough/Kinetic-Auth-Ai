"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";
import { DEMO_MODE } from "@/lib/demoMode";

type Stage = "countdown" | "onsale" | "queue" | "locked";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatMmSs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

export default function TicketOnSaleDemo() {
  const saleStartRef = useRef<number>(Date.now() + 22_000);
  const [now, setNow] = useState(() => Date.now());

  const [stage, setStage] = useState<Stage>("countdown");
  const [queuePos, setQueuePos] = useState(1247);
  const [queuePulse, setQueuePulse] = useState(0);
  const [lockedProgress, setLockedProgress] = useState(0);
  const [scarcityLeft, setScarcityLeft] = useState(97);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const msToSale = useMemo(() => saleStartRef.current - now, [now]);

  useEffect(() => {
    if (stage !== "countdown") return;
    if (msToSale <= 0) setStage("onsale");
  }, [msToSale, stage]);

  useEffect(() => {
    if (stage !== "queue") return;
    const id = window.setInterval(() => {
      setQueuePulse((p) => p + 1);
      setQueuePos((p) => Math.max(12, p - (10 + Math.floor(Math.random() * 18))));
    }, 450);
    return () => window.clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (!DEMO_MODE) return;
    if (stage !== "onsale" && stage !== "queue") return;
    const id = window.setInterval(() => {
      setScarcityLeft((n) => Math.max(0, n - (Math.random() > 0.6 ? 1 : 0)));
    }, 900);
    return () => window.clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (stage !== "locked") return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = window.requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      setLockedProgress((p) => {
        const next = clamp(p + dt * 24, 0, 100);
        return next;
      });
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [stage]);

  const cta = useMemo(() => {
    if (stage === "countdown") {
      return { title: "Tickets on sale soon", subtitle: "Waiting room opens automatically." };
    }
    if (stage === "onsale") {
      return { title: "On sale now", subtitle: "High demand. Join the queue." };
    }
    if (stage === "queue") {
      return { title: "Queue active", subtitle: "Don’t refresh. Hold tight." };
    }
    return { title: "Secure checkout locked", subtitle: "Complete a quick verification to proceed." };
  }, [stage]);

  return (
    <main className="min-h-dvh px-4 pb-10 pt-8">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_0%,rgba(56,189,248,0.20)_0%,rgba(99,102,241,0.12)_30%,rgba(0,0,0,1)_75%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_35%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0)_62%)]" />

          <div className="relative px-5 pb-6 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.26em] text-white/60">KINETIC TICKETS</p>
                <h1 className="mt-2 text-balance text-[30px] font-semibold leading-[1.05] tracking-tight">
                  Neon City Arena
                </h1>
                <p className="mt-2 text-sm text-white/65">Tonight • 8:30 PM • Limited drop</p>
              </div>
              <div className="shrink-0 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">SECTION</p>
                <p className="mt-0.5 text-sm font-semibold tracking-tight">A • Row 3</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[24px] bg-white/[0.04] p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-[0.22em] text-white/60">STATUS</p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">{cta.title}</p>
                    <p className="mt-1 text-sm text-white/65">{cta.subtitle}</p>
                  </div>
                  <motion.div
                    className="relative grid h-14 w-14 place-items-center rounded-2xl bg-black/30 ring-1 ring-white/10"
                    animate={{ scale: [1, 1.03, 1], opacity: [0.9, 1, 0.9] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_30%,rgba(56,189,248,0.25)_0%,rgba(0,0,0,0)_62%)]" />
                    <div className="relative h-3 w-3 rounded-full bg-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.65)]" />
                  </motion.div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>Demand</span>
                  <span className="tabular-nums">
                    {stage === "queue" ? (
                      DEMO_MODE ? (
                        <AnimatedNumber value={queuePos} duration={0.45} format={(n) => `#${Math.round(n).toLocaleString()}`} />
                      ) : (
                        `#${queuePos.toLocaleString()}`
                      )
                    ) : stage === "locked" ? (
                      "Verification"
                    ) : (
                      "Live"
                    )}
                  </span>
                  </div>
                <div className={["mt-2 w-full overflow-hidden rounded-full bg-white/10", DEMO_MODE ? "h-2" : "h-1.5"].join(" ")}>
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400"
                      initial={false}
                      animate={{
                        width:
                          stage === "countdown"
                            ? `${clamp(100 - (msToSale / 22_000) * 100, 0, 100)}%`
                            : stage === "onsale"
                              ? "100%"
                              : stage === "queue"
                                ? `${clamp(100 - (queuePos / 1247) * 100, 0, 100)}%`
                                : `${lockedProgress}%`
                      }}
                      transition={{ type: "tween", duration: 0.22, ease: "linear" }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] bg-black/30 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-white/60">DROP WINDOW</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                      {stage === "countdown" && DEMO_MODE ? (
                        <motion.span
                          className="bg-gradient-to-r from-sky-200 via-white to-sky-200 bg-clip-text text-transparent"
                          style={{ backgroundSize: "220% 100%" }}
                          animate={{ backgroundPosition: ["0% 0%", "220% 0%"] }}
                          transition={{ duration: 1.25, repeat: Infinity, ease: "linear" }}
                        >
                          {formatMmSs(msToSale)}
                        </motion.span>
                      ) : stage === "countdown" ? (
                        formatMmSs(msToSale)
                      ) : (
                        "LIVE"
                      )}
                    </p>
                    <p className="mt-1 text-sm text-white/65">
                      {stage === "countdown"
                        ? "We’ll auto-unlock the queue."
                        : stage === "queue"
                          ? "Position updates in real time."
                          : stage === "locked"
                            ? "Fraud protection enabled."
                            : "Tap to join."}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-semibold tracking-[0.22em] text-white/60">PRICE</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">$89</p>
                    {DEMO_MODE ? (
                      <p className="mt-1 text-xs text-white/55">
                        <span className="text-white/70">Only </span>
                        <AnimatedNumber value={scarcityLeft} duration={0.5} className="tabular-nums text-white" />
                        <span className="text-white/70"> left</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-white/55">Incl. fees</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <AnimatePresence mode="popLayout" initial={false}>
                {stage === "countdown" ? (
                  <motion.button
                    key="disabled"
                    type="button"
                    disabled
                    className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white/60 ring-1 ring-white/15"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    Waiting room armed…
                  </motion.button>
                ) : null}

                {stage === "onsale" ? (
                  <motion.button
                    key="join"
                    type="button"
                    onClick={() => setStage("queue")}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(56,189,248,0.20)]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    Join queue
                  </motion.button>
                ) : null}

                {stage === "queue" ? (
                  <motion.div
                    key="queue"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="space-y-3"
                  >
                    <motion.button
                      type="button"
                      onClick={() => setStage("locked")}
                      className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
                      animate={{ boxShadow: queuePulse % 2 ? "0 0 0 rgba(0,0,0,0)" : "0 0 48px rgba(56,189,248,0.14)" }}
                      transition={{ duration: 0.35 }}
                    >
                      Continue when ready
                    </motion.button>
                    <p className="text-center text-xs text-white/55">
                      Tip: keep this page open. We’ll pick up where you left off.
                    </p>
                  </motion.div>
                ) : null}

                {stage === "locked" ? (
                  <motion.div
                    key="locked"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="space-y-3"
                  >
                    <Link
                      href="/verify"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(99,102,241,0.18)]"
                    >
                      Verify to unlock checkout
                    </Link>
                    <p className="text-center text-xs text-white/55">Motion-based step-up. No downloads.</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="flex items-center justify-between text-xs text-white/50">
                <span className="rounded-full bg-white/5 px-2 py-1 ring-1 ring-white/10">Demo</span>
                <span className="tabular-nums">Session: {Math.abs(saleStartRef.current) % 10_000}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-[440px] text-center text-xs text-white/45">
          This is a simulated on-sale flow for a mobile-first verification demo.
        </p>
      </div>
    </main>
  );
}

