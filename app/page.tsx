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
            </div>
          </div>
        </motion.header>

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
      </div>
    </main>
  );
}

export default function HomePage() {
  return <EventsListingClient />;
}
