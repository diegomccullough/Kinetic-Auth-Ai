"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import {
  EVENTS,
  CITIES,
  CATEGORY_LABELS,
  getFeaturedEvents,
  getEventsByCategory,
  getEventsByCity,
  type EventCategory,
  type Event,
} from "@/lib/events";

// ─── Nav ──────────────────────────────────────────────────────────────────────
function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-[#026cdf] text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-white">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
            <rect width="28" height="28" rx="6" fill="white" fillOpacity=".15" />
            <path d="M7 14c0-3.866 3.134-7 7-7s7 3.134 7 7-3.134 7-7 7-7-3.134-7-7z" fill="white" fillOpacity=".4" />
            <path d="M14 9v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-lg font-bold tracking-tight">TicketFlow</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          {(["Music", "Sports", "Arts & Theatre", "Comedy", "Festivals", "Family"] as const).map((label) => (
            <span key={label} className="cursor-pointer text-white/80 hover:text-white transition">{label}</span>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button className="hidden rounded-full border border-white/30 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition sm:block">
            Sign In
          </button>
          <button
            className="sm:hidden text-white p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-white/20 bg-[#0258b8] px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-white/90">
            {["Music", "Sports", "Arts & Theatre", "Comedy", "Festivals", "Family"].map((label) => (
              <span key={label} className="cursor-pointer hover:text-white">{label}</span>
            ))}
            <hr className="border-white/20" />
            <span className="cursor-pointer hover:text-white">Sign In</span>
          </nav>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#026cdf] via-[#0258b8] to-[#1e3a8a] py-14 sm:py-20 text-white">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-blue-300/10 blur-2xl" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-200">
          Concerts · Sports · Theatre · More
        </p>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Find Your Next <span className="text-yellow-300">Live Experience</span>
        </h1>
        <p className="mt-3 text-base text-blue-100 sm:text-lg">
          Millions of events across the country — find tickets in seconds.
        </p>

        {/* Search bar */}
        <form
          className="mt-8 flex overflow-hidden rounded-2xl bg-white shadow-xl ring-2 ring-white/30"
          onSubmit={(e) => { e.preventDefault(); onSearch(q); }}
        >
          <div className="flex flex-1 items-center gap-2 px-4">
            <svg className="shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 12l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search artists, teams, venues, or cities..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none bg-transparent"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 bg-[#026cdf] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#0258b8] transition"
          >
            Search
          </button>
        </form>

        {/* Quick links */}
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-medium">
          {["Taylor Swift", "NBA Playoffs", "Broadway", "EDM Festivals", "Comedy Shows"].map((tag) => (
            <button
              key={tag}
              onClick={() => { setQ(tag); onSearch(tag); }}
              className="rounded-full bg-white/15 px-3 py-1.5 text-white hover:bg-white/25 transition"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Category pills ───────────────────────────────────────────────────────────
const ALL_CATEGORIES: (EventCategory | "all")[] = ["all", "music", "sports", "comedy", "arts", "festival", "family"];
const CAT_ICONS: Record<string, string> = {
  all: "🎟️", music: "🎵", sports: "🏆", comedy: "😂", arts: "🎭", festival: "🎪", family: "👨‍👩‍👧",
};

// ─── Event card ───────────────────────────────────────────────────────────────
function EventCardFull({ event }: { event: Event }) {
  return (
    <Link
      href={`/event/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-blue-200 transition"
    >
      {/* Image placeholder */}
      <div className="relative aspect-[16/9] w-full" style={{ background: event.imagePlaceholder }}>
        {event.tag && (
          <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            {event.tag}
          </span>
        )}
        {event.isHot && (
          <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            🔥 Hot
          </span>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        <p className="absolute bottom-2 left-3 text-xs font-medium text-white/90">{event.venue}</p>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500">
          {CATEGORY_LABELS[event.category]}
        </p>
        <h3 className="mt-1 text-base font-bold text-gray-900 group-hover:text-blue-700 transition leading-snug">
          {event.name}
          {event.subtitle && (
            <span className="font-normal text-gray-500"> — {event.subtitle}</span>
          )}
        </h3>
        <p className="mt-1.5 text-sm text-gray-500">{event.date} · {event.time}</p>
        <p className="text-sm text-gray-500">{event.city}, {event.state}</p>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            From <span className="text-blue-700">${event.defaultPrice}</span>
          </span>
          <span className="text-xs font-semibold text-blue-600 group-hover:underline">
            Find tickets →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── City browse ──────────────────────────────────────────────────────────────
function CityBrowse({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect("all")}
        className={[
          "rounded-full px-4 py-1.5 text-sm font-medium transition",
          selected === "all"
            ? "bg-blue-700 text-white"
            : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-blue-300 hover:text-blue-700",
        ].join(" ")}
      >
        All Cities
      </button>
      {CITIES.map((city) => (
        <button
          key={city}
          onClick={() => onSelect(city)}
          className={[
            "rounded-full px-4 py-1.5 text-sm font-medium transition",
            selected === city
              ? "bg-blue-700 text-white"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-blue-300 hover:text-blue-700",
          ].join(" ")}
        >
          {city}
        </button>
      ))}
    </div>
  );
}

// ─── Promo banner ─────────────────────────────────────────────────────────────
function PromoBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1e3a8a] to-[#026cdf] px-6 py-8 text-white shadow-lg">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-10"
        style={{ background: "radial-gradient(circle at 80% 50%, white 0%, transparent 70%)" }} />
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Limited Time</p>
      <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">Get tickets before they sell out</h2>
      <p className="mt-1 text-sm text-blue-100">Verified buyers only · No bots · Fair access for real fans</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Kinetic verification active
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
          🔒 Secure checkout
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
          📱 Mobile tickets
        </span>
      </div>
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────
function HomeClient() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [city, setCity] = useState("all");

  const filtered = useMemo(() => {
    let list = getEventsByCity(city);
    list = category === "all" ? list : list.filter((e) => e.category === category);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.subtitle?.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q)
    );
  }, [search, category, city]);

  const featured = useMemo(() => getFeaturedEvents(), []);

  return (
    <div className="min-h-dvh bg-[#f0f4fb]">
      <TopNav />
      <Hero onSearch={setSearch} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">

        {/* ── Featured ──────────────────────────────────────────────────────── */}
        {!search && category === "all" && city === "all" && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Featured Events</h2>
              <span className="text-sm font-medium text-blue-600 cursor-pointer hover:underline">See all</span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((event) => (
                <EventCardFull key={event.slug} event={event} />
              ))}
            </div>
          </section>
        )}

        {/* ── Promo ─────────────────────────────────────────────────────────── */}
        {!search && category === "all" && city === "all" && (
          <section className="mb-10">
            <PromoBanner />
          </section>
        )}

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <section className="mb-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl shrink-0">
              {search ? `Results for "${search}"` : "All Events"}
            </h2>
            <div className="flex-1" />
            <label className="relative flex items-center">
              <svg className="absolute left-3 text-gray-400" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-64"
              />
            </label>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={[
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  category === cat
                    ? "bg-blue-700 text-white shadow-sm"
                    : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-blue-300 hover:text-blue-700",
                ].join(" ")}
              >
                <span>{CAT_ICONS[cat]}</span>
                {cat === "all" ? "All" : CATEGORY_LABELS[cat as EventCategory]}
              </button>
            ))}
          </div>

          {/* City filter */}
          <CityBrowse selected={city} onSelect={setCity} />
        </section>

        {/* ── Results grid ──────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white py-16 text-center ring-1 ring-gray-200">
            <p className="text-4xl">🎟️</p>
            <p className="mt-3 text-base font-semibold text-gray-700">No events found</p>
            <p className="mt-1 text-sm text-gray-400">Try a different search, category, or city.</p>
            <button
              onClick={() => { setSearch(""); setCategory("all"); setCity("all"); }}
              className="mt-4 rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500">{filtered.length} event{filtered.length !== 1 ? "s" : ""} found</p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((event) => (
                <EventCardFull key={event.slug} event={event} />
              ))}
            </div>
          </>
        )}

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-gray-200 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-base font-bold text-[#026cdf]">TicketFlow</p>
              <p className="mt-1 text-xs text-gray-400">© 2025 TicketFlow, Inc. All rights reserved.</p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-gray-500">
              {["Help Center", "Sell Tickets", "Privacy Policy", "Terms of Use", "Accessibility"].map((l) => (
                <span key={l} className="cursor-pointer hover:text-blue-600 hover:underline">{l}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-[#f0f4fb]">
        <div className="h-14 bg-[#026cdf]" />
        <div className="h-48 bg-gradient-to-br from-[#026cdf] to-[#1e3a8a]" />
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-blue-50 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    }>
      <HomeClient />
    </Suspense>
  );
}
