"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getEventBySlug, CATEGORY_LABELS, type SeatSection } from "@/lib/events";

const ZONE_LABELS: Record<string, string> = {
  vip: "VIP",
  floor: "Floor / GA",
  lower: "Lower Level",
  upper: "Upper Level",
  lawn: "Lawn",
};

function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return { seconds, mm, ss };
}

function EventDetailClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const verified = searchParams.get("verified") === "true";
  const sectionId = searchParams.get("section") ?? null;
  const qty = Number(searchParams.get("qty") ?? 1);

  const event = getEventBySlug(slug);
  const [ticketsLeft, setTicketsLeft] = useState(43);
  const timersRef = useRef<number[]>([]);
  const { seconds, mm, ss } = useCountdown(134);

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

  if (!event) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f0f4fb]">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Event not found</p>
          <Link href="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">← Back to events</Link>
        </div>
      </main>
    );
  }

  const selectedSection: SeatSection | undefined = sectionId
    ? event.sections.find((s) => s.id === sectionId)
    : undefined;

  const displaySection = selectedSection ?? {
    label: event.defaultSection,
    price: event.defaultPrice,
    zone: "lower" as const,
  };

  const total = selectedSection
    ? selectedSection.price * qty + qty * 12
    : event.defaultPrice * qty + qty * 12;

  const seatsUrl = `/event/${slug}/seats`;
  const verifyUrl = `/verify?return=${encodeURIComponent(`/event/${slug}?section=${sectionId ?? ""}&qty=${qty}`)}`;

  return (
    <div className="min-h-dvh bg-[#f0f4fb]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800 transition" aria-label="Back to events">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{event.name}</p>
            <p className="truncate text-xs text-gray-500">{event.date} · {event.venue}</p>
          </div>
          {event.tag && (
            <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              {event.tag}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-36 sm:px-6">

        {/* ── Hero banner ───────────────────────────────────────────────────── */}
        <div
          className="relative mb-6 overflow-hidden rounded-2xl text-white"
          style={{ background: event.imagePlaceholder }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="relative px-5 py-8 sm:px-8 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {CATEGORY_LABELS[event.category]}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">
              {event.name}
              {event.subtitle && <span className="font-normal text-white/80"> — {event.subtitle}</span>}
            </h1>
            <p className="mt-2 text-sm text-white/80">{event.date} · {event.time}</p>
            <p className="text-sm text-white/80">{event.venue} · {event.city}, {event.state}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {ticketsLeft} tickets left
              </span>
              <span className={["flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm",
                seconds <= 30 ? "bg-red-500/40" : "bg-black/30"
              ].join(" ")}>
                ⏱ Cart: {mm}:{ss}
              </span>
              {verified && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/30 px-3 py-1 text-xs font-medium ring-1 ring-emerald-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Selected section summary ──────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500">
                {selectedSection ? "Selected Section" : "Default Section"}
              </p>
              <p className="mt-1 text-base font-bold text-gray-900">{displaySection.label}</p>
              <p className="mt-0.5 text-sm text-gray-500 capitalize">
                {ZONE_LABELS[(displaySection as SeatSection).zone ?? "lower"] ?? "General"}
                {qty > 1 && ` · ${qty} tickets`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-extrabold text-gray-900">${total}</p>
              <p className="text-xs text-gray-400">incl. fees</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href={seatsUrl}
              className="flex-1 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100 transition"
            >
              {selectedSection ? "Change seats" : "Choose seats & view map →"}
            </Link>
            {!selectedSection && (
              <button
                onClick={() => router.push(verifyUrl)}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 transition"
              >
                Use default section
              </button>
            )}
          </div>
        </div>

        {/* ── Ticket details ────────────────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-blue-500">Ticket Details</p>
          <ul className="space-y-2.5 text-sm text-gray-600">
            <li className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              1 ticket per verified customer
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              Non-transferable for 24 hours after purchase
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              Identity-verified purchase required
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              Mobile ticket delivered on entry day
            </li>
          </ul>
        </div>

        {/* ── Verification status ───────────────────────────────────────────── */}
        <div className={["rounded-2xl border bg-white p-4 shadow-sm", verified ? "border-blue-200" : "border-gray-200"].join(" ")}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500">Security Check</p>
            <span className={[
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              verified ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "bg-gray-100 text-gray-500"
            ].join(" ")}>
              {verified ? "Passed" : "Required"}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {verified
              ? "Kinetic motion verification passed. You're cleared to purchase."
              : "Complete a quick motion verification to confirm you're human. Takes ~30 seconds."}
          </p>
        </div>

        {/* ── Order summary (post-verify) ───────────────────────────────────── */}
        {verified && (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-blue-500">Order Summary</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>{qty}× {displaySection.label}</span>
                <span>${(displaySection as SeatSection).price ? (displaySection as SeatSection).price * qty : event.defaultPrice}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Service fee</span>
                <span>${(qty * 12).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1.5 font-bold text-gray-900">
                <span>Total</span>
                <span className="text-blue-700">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── Sticky CTA ────────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white px-4 pb-[env(safe-area-inset-bottom,0px)] pt-3 shadow-[0_-4px_16px_rgba(2,108,223,0.08)]"
      >
        <div className="mx-auto max-w-3xl">
          {verified && (
            <p className="mb-2 flex items-center gap-2 text-xs text-blue-700">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="6.5" fill="#026cdf" fillOpacity=".15" />
                <path d="M4 6.5l1.8 1.8L9 4.5" stroke="#026cdf" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verified · Risk level: Normal
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              if (!selectedSection && !verified) {
                router.push(seatsUrl);
              } else if (!verified) {
                router.push(verifyUrl);
              } else {
                router.push(`/checkout?event=${slug}&section=${sectionId ?? ""}&qty=${qty}`);
              }
            }}
            className={[
              "w-full rounded-xl py-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              verified
                ? "bg-[#026cdf] text-white hover:bg-[#0258b8] active:bg-[#014fa6]"
                : selectedSection
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-[#026cdf] text-white hover:bg-[#0258b8]",
            ].join(" ")}
          >
            {verified
              ? `Place Order — $${total.toFixed(2)}`
              : selectedSection
              ? "Verify to Purchase"
              : "Choose Seats →"}
          </button>
          {!verified && (
            <p className="mt-1.5 text-center text-xs text-gray-400">
              {selectedSection ? "Motion verification required to complete purchase" : "Select your seats, then verify to buy"}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}

export default function EventPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-[#f0f4fb]">
        <div className="h-14 bg-white border-b border-blue-100" />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="h-52 rounded-2xl bg-gray-300 animate-pulse" />
        </div>
      </div>
    }>
      <EventDetailClient />
    </Suspense>
  );
}
