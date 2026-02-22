"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getEventBySlug } from "@/lib/events";

function EventTicketClient() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const verified = searchParams.get("verified") === "true";

  const event = getEventBySlug(slug);

  const [placed, setPlaced] = useState(false);
  const [ticketsLeft, setTicketsLeft] = useState(43);
  const [secondsLeft, setSecondsLeft] = useState(134);
  const [unlockFx, setUnlockFx] = useState(false);
  const unlockSeenRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (!event) {
    return (
      <main className="min-h-dvh bg-surface px-4 py-8">
        <div className="mx-auto max-w-ticket text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Event not found</h1>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Browse events
          </button>
        </div>
      </main>
    );
  }

  const verifyUrl = `/verify?return=${encodeURIComponent(`/event/${slug}`)}`;

  return (
    <main className="min-h-dvh bg-surface px-4 py-4 sm:py-6 md:py-8">
      <div className="mx-auto flex max-w-ticket flex-col gap-4 sm:gap-6">
        <motion.article
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="overflow-hidden rounded-2xl bg-surface-elevated shadow-lg sm:rounded-3xl"
        >
          <div
            className="relative px-5 py-6 text-white sm:px-6 sm:py-8"
            style={{ background: event.imagePlaceholder }}
          >
            <div className="relative">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                {event.name}
                {event.subtitle ? (
                  <span className="text-white/80"> / {event.subtitle}</span>
                ) : null}
              </h1>
              <p className="mt-1 text-sm text-white/90 sm:mt-2">
                {event.date} · {event.venue} · {event.time}
              </p>
              <p className="mt-3 text-xs text-white/70">
                {ticketsLeft} tickets left
                <span className="mx-2">·</span>
                <span className="tabular-nums">{mm}:{ss}</span> left in cart
              </p>
            </div>
            <AnimatePresence initial={false}>
              {verified ? (
                <motion.div
                  key="verified-badge"
                  initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                  animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                  className="absolute right-0 top-0 flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-400/30"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
                  Verified
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="relative px-5 py-5 sm:px-6 sm:py-6">
            <AnimatePresence>
              {verified && unlockFx && !reduceMotion ? (
                <motion.div
                  key="unlock-glow"
                  className="pointer-events-none absolute inset-0 opacity-60"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  aria-hidden="true"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent" />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
                  {event.defaultSection}
                </p>
                <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">1 ticket · incl. fees</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-[var(--color-text)] sm:text-3xl">
                  ${event.defaultPrice}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse sm:gap-4">
              <motion.button
                type="button"
                onClick={() => {
                  if (!verified) {
                    router.push(verifyUrl);
                    return;
                  }
                  setPlaced(true);
                }}
                className={[
                  "inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition sm:h-14 sm:max-w-[280px] sm:rounded-2xl",
                  verified
                    ? "bg-[var(--color-primary)] text-white hover:bg-primary-hover"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300",
                ].join(" ")}
              >
                {verified ? "Find Tickets" : "Verify to continue"}
              </motion.button>
              {verified ? (
                <button
                  type="button"
                  onClick={() => setPlaced(true)}
                  className="hidden h-12 items-center justify-center rounded-xl border border-slate-300 bg-surface-elevated text-sm font-medium text-[var(--color-text)] hover:bg-slate-50 sm:inline-flex sm:max-w-[200px]"
                >
                  Place order
                </button>
              ) : null}
            </div>

            <AnimatePresence initial={false}>
              {placed && verified ? (
                <motion.div
                  key="placed"
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200"
                >
                  Ticket secured. Enjoy the show.
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.article>

        <p className="text-center">
          <a href="/" className="text-sm font-medium text-primary hover:underline">
            ← Back to all events
          </a>
        </p>
      </div>
    </main>
  );
}

function EventPageFallback() {
  return (
    <main className="min-h-dvh bg-surface px-4 py-6">
      <div className="mx-auto max-w-ticket">
        <div className="h-[320px] rounded-2xl bg-surface-elevated shadow-lg sm:rounded-3xl" />
      </div>
    </main>
  );
}

export default function EventPage() {
  return (
    <Suspense fallback={<EventPageFallback />}>
      <EventTicketClient />
    </Suspense>
  );
}
