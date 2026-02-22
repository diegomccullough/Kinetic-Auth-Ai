"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AnimatedNumber from "@/components/AnimatedNumber";
import { DEMO_MODE } from "@/lib/demoMode";

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
  const [unlockFx, setUnlockFx] = useState(false);
  const unlockSeenRef = useRef(false);

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

  useEffect(() => {
    if (!verified) {
      unlockSeenRef.current = false;
      setUnlockFx(false);
      return;
    }
    if (unlockSeenRef.current) return;
    unlockSeenRef.current = true;
    setUnlockFx(true);
    const id = window.setTimeout(() => setUnlockFx(false), 1600);
    return () => window.clearTimeout(id);
  }, [verified]);

  const queueLabel = useMemo(() => `${queue.toLocaleString()} fans`, [queue]);
  const viewingLabel = useMemo(() => `${viewing.toLocaleString()} viewing`, [viewing]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const urgent = secondsLeft <= 30;

  return (
    <main className="app-shell text-white">
      <div className="screen-card">
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
                    className={[
                      "rounded-full bg-sky-200",
                      DEMO_MODE ? "h-3 w-3" : "h-2 w-2"
                    ].join(" ")}
                    animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35], scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ boxShadow: DEMO_MODE ? "0 0 34px rgba(56,189,248,0.90)" : "0 0 18px rgba(56,189,248,0.70)" }}
                    aria-hidden="true"
                  />
                  {DEMO_MODE ? (
                    <AnimatedNumber
                      value={queue}
                      className="text-lg font-semibold tabular-nums"
                      duration={0.8}
                      format={(n) => `${Math.round(n).toLocaleString()} fans`}
                    />
                  ) : (
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
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">ACTIVITY</p>
                <div className="mt-1 flex items-baseline justify-between">
                  {DEMO_MODE ? (
                    <AnimatedNumber
                      value={viewing}
                      className="text-lg font-semibold tabular-nums"
                      duration={0.7}
                      format={(n) => `${Math.round(n).toLocaleString()} viewing`}
                    />
                  ) : (
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
                  )}
                  <span className="text-xs text-white/55">this section</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-rose-500/15 px-4 py-3 ring-1 ring-rose-300/20">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.22em] text-rose-200/90">URGENCY</p>
                <p className="mt-1 text-sm font-semibold text-rose-100">
                  Cart expires in{" "}
                  {DEMO_MODE && !reduceMotion ? (
                    <motion.span className="inline-flex items-baseline gap-0.5 tabular-nums">
                      <motion.span
                        className="bg-gradient-to-r from-rose-200 via-white to-rose-200 bg-clip-text text-transparent"
                        style={{ backgroundSize: "220% 100%" }}
                        animate={{ backgroundPosition: ["0% 0%", "220% 0%"] }}
                        transition={{ duration: 1.35, repeat: Infinity, ease: "linear" }}
                      >
                        {urgent && !reduceMotion ? (
                          <motion.span
                            className="inline-block"
                            animate={{ scale: [1, 1.035, 1], opacity: [0.92, 1, 0.92] }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                          >
                            {mm}:{ss}
                          </motion.span>
                        ) : (
                          `${mm}:${ss}`
                        )}
                      </motion.span>
                      {urgent && !reduceMotion ? (
                        <motion.span
                          className="ml-1 text-rose-100/80"
                          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.04, 1] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                          aria-hidden="true"
                        >
                          •
                        </motion.span>
                      ) : null}
                    </motion.span>
                  ) : (
                    <span className="tabular-nums">
                      {mm}:{ss}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">SCARCITY</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Only{" "}
                  {DEMO_MODE ? (
                    <AnimatedNumber value={ticketsLeft} className="tabular-nums" duration={0.5} />
                  ) : (
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
                    </AnimatePresence>
                  )}{" "}
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
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: 1,
                  y: 0,
                  boxShadow:
                    verified && unlockFx
                      ? ["0 0 0 rgba(0,0,0,0)", "0 0 110px rgba(16,185,129,0.14)", "0 0 0 rgba(0,0,0,0)"]
                      : undefined
                }
          }
          transition={{ delay: 0.05, duration: 0.45, ease: "easeOut" }}
          className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur"
        >
          <div className="flex h-full flex-col gap-4 overflow-hidden">
            <div className="seat-row">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">SEAT</p>
                <p className="mt-2 text-xl font-semibold tracking-tight">Section B • Row 3</p>
                <p className="mt-1 text-sm text-white/65">
                  1 ticket per customer • limited release
                  {verified ? <span className="ml-2 text-emerald-200/90">• Checkout unlocked</span> : null}
                </p>
              </div>
              <div className="price-block">
                <div className="text-right">
                  <p className="text-xs font-semibold tracking-[0.22em] text-white/60">PRICE</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">$299</p>
                  <p className="mt-1 text-xs text-white/55">incl. fees</p>
                </div>
                {verified ? (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="rounded-2xl bg-emerald-400/10 px-3 py-2 text-right ring-1 ring-emerald-300/25"
                  >
                    <p className="text-[10px] font-semibold tracking-[0.26em] text-emerald-200/90">VERIFIED HUMAN</p>
                    <p className="mt-0.5 text-[11px] font-medium text-emerald-100/90">Checkout unlocked</p>
                  </motion.div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-300/20">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-100">
                  {DEMO_MODE && !reduceMotion ? (
                    <motion.span
                      className="bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent"
                      style={{ backgroundSize: "220% 100%" }}
                      animate={{ backgroundPosition: ["0% 0%", "220% 0%"] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    >
                      High demand — quick verification required
                    </motion.span>
                  ) : (
                    "High demand — quick verification required"
                  )}
                </p>
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
                  "relative inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl px-4 text-sm font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  verified ? "bg-white text-black ring-white/10" : "bg-white/10 text-white ring-white/15 hover:bg-white/15"
                ].join(" ")}
                animate={
                  reduceMotion
                    ? undefined
                    : { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 90px rgba(56,189,248,0.18)", "0 0 0 rgba(0,0,0,0)"] }
                }
                transition={reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <AnimatePresence>
                  {verified && unlockFx && !reduceMotion ? (
                    <motion.div
                      key="buy-shimmer"
                      className="pointer-events-none absolute inset-0 opacity-70"
                      initial={{ x: "-120%" }}
                      animate={{ x: "120%" }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.05, ease: "easeOut" }}
                      style={{
                        background:
                          "linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 18%, rgba(255,255,255,0) 36%)"
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                </AnimatePresence>
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
    <main className="app-shell text-white">
      <div className="screen-card">
        <div className="h-[260px] rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" />
        <div className="rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" style={{ height: 420 }} />
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

