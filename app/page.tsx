"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function HomePageClient() {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";
  const [demand, setDemand] = useState(98341);
  const [pulse, setPulse] = useState(0);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setPulse((p) => p + 1);
      setDemand((n) => n + 7 + Math.floor(Math.random() * 19));
    }, 650);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const demandLabel = useMemo(() => `${demand.toLocaleString()} people`, [demand]);

  return (
    <main className="min-h-dvh px-4 pb-10 pt-8">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_0%,rgba(56,189,248,0.18)_0%,rgba(99,102,241,0.13)_30%,rgba(0,0,0,1)_78%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_38%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0)_62%)]" />

          <motion.div
            className="relative px-5 pb-6 pt-6"
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <header className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.26em] text-white/60">ONSLAUGHT TOUR</p>
                  <h1 className="mt-3 text-balance text-[32px] font-semibold leading-[1.05] tracking-tight">
                    BISON LIVE: <span className="text-white/85">Homecoming Night</span>
                  </h1>
                  <p className="mt-2 text-sm text-white/65">Neon City Arena • Doors 7:00 PM • Show 8:30 PM</p>
                </div>

                <div className="shrink-0 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">SECURITY</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        verified ? "bg-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.35)]" : "bg-amber-300/90"
                      ].join(" ")}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold tracking-tight">{verified ? "Verified" : "Step-up"}</span>
                  </div>
                </div>
              </div>
            </header>

            <AnimatePresence initial={false}>
              {verified ? (
                <motion.div
                  key="verified-banner"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="mt-5 rounded-[24px] bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-400/15"
                >
                  <span className="font-semibold">Verification passed</span> — checkout unlocked
                </motion.div>
              ) : null}
            </AnimatePresence>

            <Card className="mt-6">
              <div className="absolute inset-0 bg-[radial-gradient(100%_120%_at_50%_0%,rgba(56,189,248,0.14)_0%,rgba(0,0,0,0)_65%)]" />
              <div className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-white/60">HIGH DEMAND</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight">High demand detected</p>
                    <p className="mt-1 text-sm text-white/65">
                      {verified ? "Checkout is unlocked for this session." : "Traffic is surging. Verification required at checkout."}
                    </p>
                  </div>

                  <motion.div
                    className="relative grid h-12 w-12 place-items-center rounded-2xl bg-black/30 ring-1 ring-white/10"
                    animate={
                      reduceMotion
                        ? undefined
                        : { boxShadow: pulse % 2 ? "0 0 0 rgba(0,0,0,0)" : "0 0 56px rgba(56,189,248,0.16)" }
                    }
                    transition={{ duration: 0.35 }}
                    aria-hidden="true"
                  >
                    <motion.div
                      className="h-2.5 w-2.5 rounded-full bg-sky-200"
                      animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5], scale: [1, 1.12, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      style={{ boxShadow: "0 0 22px rgba(56,189,248,0.70)" }}
                    />
                  </motion.div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
                  <p className="text-xs font-semibold tracking-[0.22em] text-white/60">LIVE DEMAND</p>
                  <div className="flex items-baseline gap-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={demand}
                        className="text-base font-semibold tabular-nums tracking-tight text-white"
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        {demandLabel}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-xs text-white/55">in queue</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="mt-3">
              <div className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-white/60">SEAT</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight">Section A • Row 3</p>
                    <p className="mt-1 text-sm text-white/65">Limited release. One per customer.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold tracking-[0.22em] text-white/60">PRICE</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">$349</p>
                    <p className="mt-1 text-xs text-white/55">Incl. fees</p>
                  </div>
                </div>
              </div>
            </Card>

            <motion.div
              className="mt-5"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.45, ease: "easeOut" }}
            >
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={!verified}
                  onClick={() => {
                    setPlaced(true);
                    try {
                      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(12);
                    } catch {
                      // ignore
                    }
                  }}
                  className={[
                    "inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                    verified
                      ? "bg-white text-black ring-white/10 shadow-[0_18px_60px_rgba(16,185,129,0.10)] hover:bg-white/95 active:scale-[0.99]"
                      : "bg-white/5 text-white/45 ring-white/10"
                  ].join(" ")}
                >
                  Place Order
                </button>

                {!verified ? (
                  <Button href="/verify" variant="soft" className="h-12">
                    Verify to unlock checkout
                  </Button>
                ) : null}

                <AnimatePresence initial={false}>
                  {placed && verified ? (
                    <motion.div
                      key="placed"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="rounded-[24px] bg-white/[0.04] px-4 py-3 text-sm text-white/80 ring-1 ring-white/10"
                    >
                      Order placed (simulated). Thanks for testing the demo.
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <p className="mt-3 text-center text-xs text-white/45">
                Demo: checkout is simulated. Verification toggles via <span className="font-semibold">?verified=true</span>.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

function HomePageFallback() {
  return (
    <main className="min-h-dvh px-4 pb-10 pt-8">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_0%,rgba(56,189,248,0.18)_0%,rgba(99,102,241,0.13)_30%,rgba(0,0,0,1)_78%)]" />
          <div className="relative px-5 pb-6 pt-6">
            <div className="h-6 w-40 rounded-xl bg-white/10" />
            <div className="mt-4 h-10 w-full rounded-2xl bg-white/10" />
            <div className="mt-6 h-28 w-full rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" />
            <div className="mt-3 h-24 w-full rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" />
            <div className="mt-5 h-12 w-full rounded-2xl bg-white/10 ring-1 ring-white/15" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageClient />
    </Suspense>
  );
}

