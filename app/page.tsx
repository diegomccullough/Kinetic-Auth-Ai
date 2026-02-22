"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function HomePageClient() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";

  const [placed, setPlaced] = useState(false);
  const [queue, setQueue] = useState(12483);
  const [viewing, setViewing] = useState(3218);
  const [ticketsLeft, setTicketsLeft] = useState(43);
  const [pulse, setPulse] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(134); // 02:14

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => setPulse((p) => p + 1), 650);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    // live activity drift
    const id = window.setInterval(() => {
      setQueue((n) => n + 7 + Math.floor(Math.random() * 21));
      setViewing((n) => Math.max(1200, n + (Math.random() > 0.5 ? 1 : -1) * (18 + Math.floor(Math.random() * 40))));
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    // scarcity drop — cleanup clears recursive timeouts to avoid memory leaks
    const tick = () => {
      setTicketsLeft((n) => Math.max(0, n - (Math.random() > 0.55 ? 1 : 0)));
      const next = 1600 + Math.floor(Math.random() * 1600);
      const id = window.setTimeout(tick, next);
      timersRef.current.push(id);
    };
    const first = window.setTimeout(tick, 1400);
    timersRef.current.push(first);
    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, [reduceMotion]);

  useEffect(() => {
    // cart countdown
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const queueLabel = useMemo(() => `${queue.toLocaleString()} fans`, [queue]);
  const viewingLabel = useMemo(() => `${viewing.toLocaleString()} viewing`, [viewing]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <main className="h-dvh overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,rgba(56,189,248,0.18)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,1)_76%)] px-4 py-5 text-white">
      <div className="mx-auto flex h-full w-full max-w-[720px] flex-col gap-4 overflow-hidden">
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[28px] bg-white/[0.05] p-5 ring-1 ring-white/10 backdrop-blur"
        >
          <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_40%_0%,rgba(56,189,248,0.18)_0%,rgba(99,102,241,0.10)_35%,rgba(0,0,0,0)_72%)]" />
          <div className="relative">
            <p className="text-xs font-semibold tracking-[0.30em] text-white/60">ONSLAUGHT TOUR</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.02] tracking-tight">
              BISON LIVE <span className="text-white/70">/ HOMEcoming night</span>
            </h1>
            <p className="mt-2 text-sm text-white/65">Fri • Oct 17 • Neon City Arena • 8:30 PM</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">FANS IN QUEUE</p>
                <div className="mt-1 flex items-center gap-2">
                  <motion.div
                    className="h-2 w-2 rounded-full bg-sky-200"
                    animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35], scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ boxShadow: "0 0 18px rgba(56,189,248,0.70)" }}
                    aria-hidden="true"
                  />
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={queue}
                      className="text-lg font-semibold tabular-nums"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {queueLabel}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>

              <div className="rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">ACTIVITY</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={viewing}
                      className="text-lg font-semibold tabular-nums"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {viewingLabel}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-xs text-white/55">this section</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-rose-500/10 px-4 py-3 ring-1 ring-rose-400/15">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.22em] text-rose-200/90">URGENCY</p>
                <p className="mt-1 text-sm font-semibold text-rose-100">Cart expires in {mm}:{ss}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">SCARCITY</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Only{" "}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={ticketsLeft}
                      className="tabular-nums"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {ticketsLeft}
                    </motion.span>
                  </AnimatePresence>{" "}
                  left
                </p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {verified ? (
                <motion.div
                  key="verified-banner"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="mt-3 rounded-2xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-300/20"
                >
                  <span className="font-semibold">Verification complete</span> — checkout unlocked.
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.header>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.45, ease: "easeOut" }}
          className="min-h-0 flex-1 overflow-hidden rounded-[28px] bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur"
        >
          <div className="flex h-full flex-col gap-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">SEAT</p>
                <p className="mt-2 text-xl font-semibold tracking-tight">Section B • Row 3</p>
                <p className="mt-1 text-sm text-white/65">1 ticket per customer • limited release</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">PRICE</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">$299</p>
                <p className="mt-1 text-xs text-white/55">incl. fees</p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-300/20">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-100">High demand — quick verification required</p>
                <span className="rounded-full bg-amber-300/20 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-amber-100">
                  RISK
                </span>
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <motion.button
                type="button"
                onClick={() => {
                  if (!verified) {
                    router.push("/verify");
                    return;
                  }
                  setPlaced(true);
                }}
                className={[
                  "inline-flex h-14 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  verified ? "bg-white text-black ring-white/10" : "bg-white/10 text-white ring-white/15 hover:bg-white/15"
                ].join(" ")}
                animate={
                  reduceMotion
                    ? undefined
                    : { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 90px rgba(56,189,248,0.18)", "0 0 0 rgba(0,0,0,0)"] }
                }
                transition={reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                {verified ? "BUY TICKET" : "BUY TICKET (VERIFY FIRST)"}
              </motion.button>

              <button
                type="button"
                disabled={!verified}
                onClick={() => setPlaced(true)}
                className={[
                  "inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition",
                  verified
                    ? "bg-emerald-400/90 text-black ring-emerald-300/20 hover:bg-emerald-300 active:scale-[0.99]"
                    : "bg-white/5 text-white/40 ring-white/10"
                ].join(" ")}
              >
                Place Order
              </button>

              <AnimatePresence initial={false}>
                {placed && verified ? (
                  <motion.div
                    key="placed"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="rounded-2xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-300/20"
                  >
                    Ticket secured (simulated). Enjoy the show.
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function HomePageFallback() {
  return (
    <main className="h-dvh overflow-hidden bg-black px-4 py-5 text-white">
      <div className="mx-auto flex h-full w-full max-w-[720px] flex-col gap-4 overflow-hidden">
        <div className="h-[260px] rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" />
        <div className="min-h-0 flex-1 rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" />
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

