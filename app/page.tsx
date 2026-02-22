"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

<<<<<<< HEAD
const ALL_CATEGORIES: (EventCategory | "all")[] = ["all", "music", "sports", "comedy", "family"];
const CATEGORY_MAP: Record<EventCategory | "all", string> = {
  all: "All events",
  ...CATEGORY_LABELS,
};

function EventsListingClient() {
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");

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

  return (
    <main className="min-h-dvh bg-surface px-4 py-4 sm:py-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 sm:mb-8"
        >
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
// ─── Live queue numbers ───────────────────────────────────────────────────────
function useQueue() {
  const [queue, setQueue] = useState(12483);
  const [viewing, setViewing] = useState(3218);
  const [ticketsLeft, setTicketsLeft] = useState(43);
  const [secondsLeft, setSecondsLeft] = useState(134);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const qv = window.setInterval(() => {
      setQueue((n) => n + 7 + Math.floor(Math.random() * 21));
      setViewing((n) =>
        Math.max(2800, n + (Math.random() > 0.5 ? 1 : -1) * (12 + Math.floor(Math.random() * 30)))
      );
    }, 1100);

    const tick = () => {
      setTicketsLeft((n) => Math.max(0, n - (Math.random() > 0.6 ? 1 : 0)));
      const next = 1800 + Math.floor(Math.random() * 2000);
      const id = window.setTimeout(tick, next);
      timers.current.push(id);
    };
    const first = window.setTimeout(tick, 2000);
    timers.current.push(first);

    const cd = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);

    return () => {
      window.clearInterval(qv);
      window.clearInterval(cd);
      for (const id of timers.current) window.clearTimeout(id);
    };
  }, []);

  return { queue, viewing, ticketsLeft, secondsLeft };
}

// ─── Main page ────────────────────────────────────────────────────────────────
function HomePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";
  const [placed, setPlaced] = useState(false);

  const { queue, viewing, ticketsLeft, secondsLeft } = useQueue();

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f5f7]">

      {/* ── Sticky top header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-lg px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Onslaught Tour
              </p>
              <h1 className="mt-0.5 text-lg font-bold leading-snug text-gray-900">
                BISON LIVE — Homecoming Night
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Fri Oct 17 · Neon City Arena · 8:30 PM
              </p>
>>>>>>> c262930661f37671db8467cb71be9d0c467d4414
            </div>
            <span className="mt-1 shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              High Demand
            </span>
          </div>
        </div>
      </header>

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
      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-36 pt-6">

        {/* Queue Status */}
        <section aria-label="Queue status">
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">

            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {queue.toLocaleString()} fans ahead of you
                </p>
                <p className="mt-0.5 text-xs text-gray-500">Estimated entry: 3–5 minutes</p>
              </div>
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" aria-hidden="true" />
            </div>

            <div className="px-4 py-3.5">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{viewing.toLocaleString()}</span>{" "}
                currently viewing Section B
              </p>
            </div>

            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-sm text-gray-600">
                Cart reserved for{" "}
                <span className={["font-semibold tabular-nums", secondsLeft <= 30 ? "text-red-600" : "text-gray-900"].join(" ")}>
                  {mm}:{ss}
                </span>
              </p>
              <span className="text-xs text-gray-400">Do not refresh</span>
            </div>

          </div>
        </section>

        {/* Divider */}
        <div className="my-6 border-t border-gray-200" />

        {/* Ticket Selection */}
        <section aria-label="Ticket details">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Section B – Row 3</h2>
              <p className="mt-1 text-sm font-medium text-gray-500">General Admission · 1 ticket</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-gray-900">$299</p>
              <p className="mt-0.5 text-xs text-gray-400">incl. all fees</p>
            </div>
          </div>

          <ul className="mt-5 space-y-2.5 text-sm text-gray-600">
            <li className="flex items-center gap-2.5">
              <span className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden="true" />
              1 ticket per customer · non-transferable for 24 hours
            </li>
            <li className="flex items-center gap-2.5">
              <span className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden="true" />
              Identity-verified purchase required
            </li>
            <li className="flex items-center gap-2.5">
              <span className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden="true" />
              Tickets delivered via mobile app on entry day
            </li>
          </ul>

          <div className="mt-5 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-red-600">
              Low inventory — {ticketsLeft} remaining
            </p>
          </div>
        </section>

        {/* Divider */}
        <div className="my-6 border-t border-gray-200" />

        {/* Verification status */}
        <section aria-label="Verification status">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Security Check
              </p>
              <span className={[
                "rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                verified
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-500"
              ].join(" ")}>
                {verified ? "Passed" : "Pending"}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-gray-600">Behavior analysis</p>
                <p className={["text-sm font-medium", verified ? "text-green-700" : "text-gray-400"].join(" ")}>
                  {verified ? "Verified" : "Not run"}
                </p>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-gray-600">Risk level</p>
                <p className={["text-sm font-medium", verified ? "text-green-700" : "text-gray-400"].join(" ")}>
                  {verified ? "Normal" : "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Order summary */}
        {verified && (
          <section aria-label="Order summary" className="mt-6">
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Order Summary</p>
              </div>
              <div className="space-y-0 divide-y divide-gray-100">
                <div className="flex justify-between px-4 py-3">
                  <p className="text-sm text-gray-600">1× Section B · Row 3</p>
                  <p className="text-sm font-medium text-gray-900">$279.00</p>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <p className="text-sm text-gray-600">Service fee</p>
                  <p className="text-sm font-medium text-gray-900">$20.00</p>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">Total</p>
                  <p className="text-sm font-semibold text-gray-900">$299.00</p>
                </div>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* ── Sticky bottom CTA bar ──────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white px-5 pb-[env(safe-area-inset-bottom,0px)] pt-4"
        style={{ boxShadow: "0 -1px 0 0 #e5e7eb, 0 -4px 12px 0 rgba(0,0,0,0.04)" }}
      >
        <div className="mx-auto max-w-lg">

          {verified && !placed && (
            <p className="mb-3 flex items-center gap-2 text-xs text-green-700">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="6.5" fill="#16a34a" opacity=".15" />
                <path d="M4 6.5l1.8 1.8L9 4.5" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Behavior verified · Risk level: Normal
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              if (!verified) {
                router.push("/verify");
              } else {
                setPlaced(true);
              }
            }}
            disabled={placed}
            className={[
              "w-full rounded-md py-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              placed
                ? "bg-green-600 text-white cursor-default"
                : verified
                ? "bg-blue-700 text-white hover:bg-blue-800 active:bg-blue-900"
                : "bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-700"
            ].join(" ")}
          >
            {placed
              ? "Order Placed"
              : verified
              ? "Place Order — $299"
              : "Secure & Continue"}
          </button>

          {!verified && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Motion verification required to complete purchase
            </p>
          )}
        </div>
>>>>>>> c262930661f37671db8467cb71be9d0c467d4414
      </div>

    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh flex-col bg-[#f4f5f7]">
        <div className="h-[72px] border-b border-gray-200 bg-white" />
        <div className="mx-auto w-full max-w-lg flex-1 space-y-4 px-5 pt-6">
          <div className="h-28 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-40 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-24 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
    }>
      <HomePageClient />
    </Suspense>
  );
}
