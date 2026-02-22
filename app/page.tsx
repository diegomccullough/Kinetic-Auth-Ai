"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import VerificationOverlay from "@/components/VerificationOverlay";

type TicketTier = {
  id: "vip" | "section_a" | "section_b";
  label: string;
  price: number;
};

export default function HomePage() {
  const reduceMotion = useReducedMotion();

  const [verified, setVerified] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [placed, setPlaced] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState<TicketTier | null>(null);

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

  const tiers: TicketTier[] = [
    { id: "vip", label: "VIP", price: 899 },
    { id: "section_a", label: "Section A", price: 499 },
    { id: "section_b", label: "Section B", price: 299 }
  ];

  const ctaLabel = selectedTicket ? `SECURE ${selectedTicket.label.toUpperCase()} – $${selectedTicket.price}` : "SELECT A TICKET";

  return (
    <main className="h-dvh overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,rgba(56,189,248,0.18)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,1)_76%)] px-4 pt-6 text-white">
      <div className={["mx-auto flex h-full w-full max-w-[680px] flex-col gap-4", overlayOpen ? "pointer-events-none select-none blur-[2px]" : ""].join(" ")}>
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="rounded-[28px] bg-white/[0.05] p-5 ring-1 ring-white/10 backdrop-blur"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.28em] text-white/60">TICKET PLATFORM</p>
              <h1 className="mt-3 text-balance text-3xl font-semibold leading-[1.06] tracking-tight">
                BISON LIVE: <span className="text-white/80">Homecoming Night</span>
              </h1>
              <p className="mt-2 text-sm text-white/65">Neon City Arena • Doors 7:00 PM • Show 8:30 PM</p>
            </div>

            <div className="shrink-0 rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-white/60">QUEUE</p>
              <div className="mt-1 flex items-baseline gap-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={queue}
                    className="text-base font-semibold tabular-nums"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {queueLabel}
                  </motion.span>
                </AnimatePresence>
                <span className="text-xs text-white/55">in queue</span>
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {verified ? (
              <motion.div
                key="verified"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="mt-4 rounded-2xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-300/20"
              >
                <span className="font-semibold">Verification Complete</span> — checkout unlocked.
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.header>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.45, ease: "easeOut" }}
          className="min-h-0 flex-1 overflow-hidden rounded-[28px] bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur"
        >
          <div className="flex h-full flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-white/60">TICKET TIERS</p>
                <p className="mt-2 text-lg font-semibold tracking-tight">Choose your ticket</p>
              </div>
              <motion.div
                className="grid h-11 w-11 place-items-center rounded-2xl bg-black/25 ring-1 ring-white/10"
                animate={reduceMotion ? undefined : { boxShadow: pulse % 2 ? "0 0 0 rgba(0,0,0,0)" : "0 0 56px rgba(56,189,248,0.16)" }}
                transition={{ duration: 0.35 }}
                aria-hidden="true"
              >
                <div className="h-2.5 w-2.5 rounded-full bg-sky-200 shadow-[0_0_22px_rgba(56,189,248,0.70)]" />
              </motion.div>
            </div>

            <div className="grid gap-3">
              {tiers.map((t) => {
                const selected = selectedTicket?.id === t.id;
                return (
                  <motion.button
                    key={t.id}
                    type="button"
                    whileTap={{ scale: 1.03 }}
                    onClick={() => setSelectedTicket(t)}
                    className={[
                      "relative w-full overflow-hidden rounded-[26px] bg-black/35 px-5 py-4 text-left ring-1 transition",
                      selected ? "ring-sky-300/70 shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_0_90px_rgba(56,189,248,0.18)]" : "ring-white/10",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_50%_0%,rgba(56,189,248,0.16)_0%,rgba(99,102,241,0.10)_35%,rgba(0,0,0,0)_72%)]" />
                    <div className="relative flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold tracking-tight text-white">{t.label}</p>
                        <p className="mt-1 text-xs font-semibold tracking-[0.22em] text-white/55">STAGE DEMO TIER</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-semibold tabular-nums tracking-tight">${t.price}</p>
                        <p className="mt-1 text-xs text-white/55">incl. fees</p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-auto space-y-3">
              <motion.button
                type="button"
                disabled={!selectedTicket}
                onClick={() => {
                  if (!selectedTicket) return;
                  setOverlayOpen(true);
                }}
                className={[
                  "inline-flex h-14 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  selectedTicket ? "bg-white text-black ring-white/10" : "bg-white/5 text-white/40 ring-white/10"
                ].join(" ")}
                animate={
                  reduceMotion || !selectedTicket
                    ? undefined
                    : { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 80px rgba(56,189,248,0.24)", "0 0 0 rgba(0,0,0,0)"] }
                }
                transition={reduceMotion || !selectedTicket ? undefined : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                {ctaLabel}
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
                Checkout
              </button>

              <AnimatePresence initial={false}>
                {placed && verified ? (
                  <motion.div
                    key="placed"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/80 ring-1 ring-white/10"
                  >
                    Checkout unlocked and ticket purchase completed (simulated).
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>
      </div>

      <VerificationOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        selectedTicket={selectedTicket}
        onVerified={() => {
          setVerified(true);
          setOverlayOpen(false);
        }}
      />
    </main>
  );
}

