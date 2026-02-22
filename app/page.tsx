"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import EventCard from "@/components/EventCard";
import {
  EVENTS,
  CATEGORY_LABELS,
  getEventsByCategory,
  type EventCategory,
} from "@/lib/events";

const ALL_CATEGORIES: (EventCategory | "all")[] = ["all", "music", "sports", "comedy", "family"];
const CATEGORY_MAP: Record<EventCategory | "all", string> = {
  all: "All events",
  ...CATEGORY_LABELS,
};

function EventsListingClient() {
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");

<<<<<<< HEAD
  const filtered = useMemo(() => {
    let list = getEventsByCategory(category);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.subtitle?.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q)
    );
  }, [search, category]);
=======
  const [placed, setPlaced] = useState(false);
  const [queue, setQueue] = useState(12483);
  const [viewing, setViewing] = useState(3218);
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
  }, [reduceMotion]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setQueue((n) => n + 7 + Math.floor(Math.random() * 21));
      setViewing((n) =>
        Math.max(1200, n + (Math.random() > 0.5 ? 1 : -1) * (18 + Math.floor(Math.random() * 40)))
      );
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
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
  const urgent = secondsLeft <= 30;
>>>>>>> 41804d7fd8c3cc3dfd31f08aaaed499e435524e1

  const queueLabel = useMemo(() => `${queue.toLocaleString()} fans`, [queue]);
  const viewingLabel = useMemo(() => `${viewing.toLocaleString()} viewing`, [viewing]);

  return (
<<<<<<< HEAD
    <main className="min-h-dvh bg-surface px-4 py-4 sm:py-6 md:py-8">
      <div className="mx-auto max-w-6xl">
=======
    <main className="app-shell text-white">
      <div className="screen-card">

        {/* ── Event header ────────────────────────────────────── */}
>>>>>>> 41804d7fd8c3cc3dfd31f08aaaed499e435524e1
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 sm:mb-8"
        >
<<<<<<< HEAD
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
            Events
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Find tickets for concerts, sports, comedy, and more.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <label className="flex-1">
              <span className="sr-only">Search events</span>
              <input
                type="search"
                placeholder="Search by artist, venue, or event..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-surface-elevated px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:max-w-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={[
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    category === cat
                      ? "bg-primary text-white"
                      : "bg-surface-elevated text-[var(--color-text-muted)] ring-1 ring-slate-200 hover:bg-slate-100 hover:text-[var(--color-text)]",
                  ].join(" ")}
                >
                  {CATEGORY_MAP[cat]}
                </button>
              ))}
=======
          <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_40%_0%,rgba(56,189,248,0.16)_0%,rgba(99,102,241,0.08)_35%,rgba(0,0,0,0)_72%)]" />
          <div className="relative">
            <p className="text-xs font-semibold tracking-[0.30em] text-white/55">ONSLAUGHT TOUR</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.02] tracking-tight">
              BISON LIVE <span className="text-white/65">/ HOMEcoming night</span>
            </h1>
            <p className="mt-2 text-sm text-white/60">Fri • Oct 17 • Neon City Arena • 8:30 PM</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* Queue */}
              <div className="rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/55">FANS IN QUEUE</p>
                <div className="mt-1 flex items-center gap-2">
                  <motion.div
                    className="h-2 w-2 rounded-full bg-sky-300"
                    animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35], scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ boxShadow: "0 0 14px rgba(56,189,248,0.70)" }}
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

              {/* Activity */}
              <div className="rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/55">ACTIVITY</p>
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
                  <span className="text-xs text-white/50">this section</span>
                </div>
              </div>
            </div>

            {/* Cart countdown */}
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-rose-500/12 px-4 py-3 ring-1 ring-rose-300/18">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.22em] text-rose-200/80">URGENCY</p>
                <p className="mt-1 text-sm font-semibold text-rose-100">
                  Cart expires in{" "}
                  <span className={["tabular-nums", urgent && !reduceMotion ? "text-rose-200" : ""].join(" ")}>
                    {urgent && !reduceMotion ? (
                      <motion.span
                        className="inline-block"
                        animate={{ scale: [1, 1.03, 1], opacity: [0.9, 1, 0.9] }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {mm}:{ss}
                      </motion.span>
                    ) : (
                      `${mm}:${ss}`
                    )}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-white/55">SCARCITY</p>
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
>>>>>>> 41804d7fd8c3cc3dfd31f08aaaed499e435524e1
            </div>
          </div>
        </motion.header>

<<<<<<< HEAD
        {filtered.length === 0 ? (
          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            className="rounded-xl bg-surface-elevated p-8 text-center text-[var(--color-text-muted)] ring-1 ring-slate-200"
          >
            No events match your search. Try a different term or category.
          </motion.p>
        ) : (
          <motion.ul
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
          >
            {filtered.map((event, i) => (
              <motion.li
                key={event.slug}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <EventCard event={event} />
              </motion.li>
            ))}
          </motion.ul>
        )}
=======
        {/* ── Seat + order section ─────────────────────────────── */}
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
                      ? ["0 0 0 rgba(0,0,0,0)", "0 0 100px rgba(52,211,153,0.18)", "0 0 0 rgba(0,0,0,0)"]
                      : undefined
                }
          }
          transition={{ delay: 0.05, duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[28px] bg-white/[0.04] p-5 ring-1 ring-white/10 backdrop-blur"
        >
          <div className="flex flex-col gap-5">
            {/* Seat row */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-white/55">SEAT</p>
                <p className="mt-2 text-xl font-semibold tracking-tight">Section B • Row 3</p>
                <p className="mt-1 text-sm text-white/60">1 ticket per customer • limited release</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-xs font-semibold tracking-[0.22em] text-white/55">PRICE</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">$299</p>
                  <p className="mt-1 text-xs text-white/50">incl. fees</p>
                </div>

                {/* Single mint verified badge */}
                <AnimatePresence initial={false}>
                  {verified ? (
                    <motion.div
                      key="verified-badge"
                      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.95 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.95 }}
                      transition={reduceMotion ? undefined : { type: "spring", stiffness: 240, damping: 22, mass: 0.55 }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ring-emerald-300/30"
                      style={{
                        background: "rgba(52,211,153,0.12)",
                        boxShadow: "0 0 28px rgba(52,211,153,0.18)"
                      }}
                    >
                      <span className="text-xs text-emerald-300">✔</span>
                      <span className="text-[11px] font-semibold tracking-[0.16em] text-emerald-200">
                        HUMAN VERIFIED
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            {/* Risk banner */}
            <div className="rounded-2xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-300/18">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-100">
                  High demand — quick verification required
                </p>
                <span className="shrink-0 rounded-full bg-amber-300/18 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-amber-100">
                  RISK
                </span>
              </div>
            </div>

            {/* Single primary CTA */}
            <motion.button
              type="button"
              onClick={() => {
                if (!verified) {
                  router.push("/verify");
                  return;
                }
                setPlaced(true);
              }}
              className="relative inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl text-sm font-semibold tracking-tight ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={
                verified
                  ? { background: "#34D399", color: "#000" }
                  : { background: "rgba(255,255,255,0.08)", color: "#fff" }
              }
              animate={
                reduceMotion
                  ? undefined
                  : {
                      boxShadow: verified
                        ? [
                            "0 0 40px rgba(52,211,153,0.28), 0 8px 40px rgba(0,0,0,0.35)",
                            "0 0 80px rgba(52,211,153,0.50), 0 8px 40px rgba(0,0,0,0.35)",
                            "0 0 40px rgba(52,211,153,0.28), 0 8px 40px rgba(0,0,0,0.35)"
                          ]
                        : "0 0 0 rgba(0,0,0,0)"
                    }
              }
              transition={
                reduceMotion
                  ? undefined
                  : verified
                  ? { duration: 2.0, repeat: Infinity, ease: "easeInOut" }
                  : { type: "spring", stiffness: 220, damping: 22 }
              }
            >
              {/* Shimmer on unlock */}
              <AnimatePresence>
                {verified && unlockFx && !reduceMotion ? (
                  <motion.div
                    key="shimmer"
                    className="pointer-events-none absolute inset-0 opacity-70"
                    initial={{ x: "-120%" }}
                    animate={{ x: "120%" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.05, ease: "easeOut" }}
                    style={{
                      background:
                        "linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.38) 18%, rgba(255,255,255,0) 36%)"
                    }}
                    aria-hidden="true"
                  />
                ) : null}
              </AnimatePresence>
              {placed && verified ? "Order Placed ✔" : "Place Order"}
            </motion.button>
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
        <div className="rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" style={{ height: 380 }} />
>>>>>>> 41804d7fd8c3cc3dfd31f08aaaed499e435524e1
      </div>
    </main>
  );
}

export default function HomePage() {
  return <EventsListingClient />;
}
