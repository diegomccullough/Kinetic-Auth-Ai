"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import VerificationOverlay from "@/components/VerificationOverlay";

export default function HomePage() {
  const reduceMotion = useReducedMotion();

  const [verified, setVerified] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [placed, setPlaced] = useState(false);

  const [queue, setQueue] = useState(98341);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setPulse((p) => p + 1);
      setQueue((n) => n + 7 + Math.floor(Math.random() * 19));
    }, 650);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const queueLabel = useMemo(() => `${queue.toLocaleString()} people`, [queue]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white via-slate-50 to-slate-100 px-4 pb-12 pt-8 text-slate-900">
      <div className={["mx-auto w-full max-w-[980px]", overlayOpen ? "pointer-events-none select-none blur-[2px]" : ""].join(" ")}>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6"
        >
          <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.26em] text-slate-500">TICKET PLATFORM</p>
                <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight">
                  BISON LIVE: <span className="text-slate-700">Homecoming Night</span>
                </h1>
                <p className="mt-2 text-sm text-slate-600">Neon City Arena • Doors 7:00 PM • Show 8:30 PM</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-slate-500">SECURITY</p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={[
                      "h-2 w-2 rounded-full",
                      verified ? "bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.35)]" : "bg-amber-400"
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold tracking-tight text-slate-800">
                    {verified ? "Verification Complete" : "Verification Required"}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 p-5">
              <div className="absolute inset-0 bg-[radial-gradient(80%_100%_at_20%_10%,rgba(56,189,248,0.25)_0%,rgba(99,102,241,0.16)_40%,rgba(16,185,129,0.10)_70%,rgba(255,255,255,0)_100%)]" />
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.22em] text-slate-600">EVENT HERO</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">Limited release seats available</p>
                  <p className="mt-1 text-sm text-slate-600">A realistic checkout flow with step-up verification under high demand.</p>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-slate-500">LIVE QUEUE</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={queue}
                        className="text-lg font-semibold tabular-nums tracking-tight text-slate-900"
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        {queueLabel}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-xs text-slate-600">in queue</span>
                  </div>
                </div>
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
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                  <span className="font-semibold">Verification Complete</span> — checkout unlocked.
                </motion.div>
              ) : null}
            </AnimatePresence>
          </header>

          <section className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Seats</h2>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <motion.div
                    className="grid h-7 w-7 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm"
                    animate={reduceMotion ? undefined : { boxShadow: pulse % 2 ? "0 0 0 rgba(0,0,0,0)" : "0 0 24px rgba(56,189,248,0.18)" }}
                    transition={{ duration: 0.35 }}
                    aria-hidden="true"
                  >
                    <div className="h-2 w-2 rounded-full bg-sky-500" />
                  </motion.div>
                  <span>Limited release</span>
                </div>
              </div>

              {[
                { title: "Section A • Row 3", price: 349, note: "Closest view. One per customer." },
                { title: "Section B • Row 8", price: 249, note: "Great acoustics. Limited inventory." },
                { title: "Section C • Row 14", price: 169, note: "Budget pick. Selling fast." }
              ].map((s) => (
                <div key={s.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.22em] text-slate-500">SEAT</p>
                      <p className="mt-2 text-lg font-semibold tracking-tight">{s.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{s.note}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tracking-[0.22em] text-slate-500">PRICE</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">${s.price}</p>
                      <p className="mt-1 text-xs text-slate-500">Incl. fees</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold tracking-[0.22em] text-slate-500">CHECKOUT</p>
                <p className="mt-2 text-lg font-semibold tracking-tight">Secure checkout</p>
                <p className="mt-1 text-sm text-slate-600">
                  {verified
                    ? "You’re verified for this session. You can proceed to checkout."
                    : "High-demand protection is enabled. Complete verification to unlock checkout."}
                </p>

                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!verified) setOverlayOpen(true);
                    }}
                    disabled={verified}
                    className={[
                      "inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                      verified
                        ? "bg-slate-100 text-slate-400 ring-slate-200"
                        : "bg-slate-900 text-white ring-slate-900/10 shadow-sm hover:bg-slate-800 active:scale-[0.99]"
                    ].join(" ")}
                  >
                    {verified ? "Verified" : "Buy Ticket"}
                  </button>

                  <button
                    type="button"
                    disabled={!verified}
                    onClick={() => setPlaced(true)}
                    className={[
                      "inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition",
                      verified
                        ? "bg-emerald-600 text-white ring-emerald-600/20 hover:bg-emerald-500 active:scale-[0.99]"
                        : "bg-slate-100 text-slate-400 ring-slate-200"
                    ].join(" ")}
                  >
                    Proceed to checkout
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {placed && verified ? (
                    <motion.div
                      key="placed"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      Checkout unlocked and ticket purchase completed (simulated).
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                <p className="font-semibold text-slate-800">Queue counter</p>
                <p className="mt-1">This demo increments demand to simulate a real ticketing rush.</p>
              </div>
            </aside>
          </section>

          <p className="text-center text-xs text-slate-500">KineticAuth runs in an isolated overlay with its own theme and motion logic.</p>
        </motion.div>
      </div>

      <VerificationOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        onVerified={() => {
          setVerified(true);
          setOverlayOpen(false);
        }}
      />
    </main>
  );
}

