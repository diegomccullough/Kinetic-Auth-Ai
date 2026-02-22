"use client";

import Link from "next/link";
import type { Event } from "@/lib/events";

type EventCardProps = {
  event: Event;
};

export default function EventCard({ event }: EventCardProps) {
  return (
    <Link
      href={`/event/${event.slug}`}
      className="group block overflow-hidden rounded-xl bg-surface-elevated shadow-md ring-1 ring-slate-200 transition hover:shadow-lg hover:ring-slate-300 sm:rounded-2xl"
    >
      <div
        className="aspect-[16/10] w-full shrink-0"
        style={{ background: event.imagePlaceholder }}
        aria-hidden
      />
      <div className="p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)] group-hover:text-primary sm:text-xl">
          {event.name}
          {event.subtitle ? (
            <span className="font-normal text-[var(--color-text-muted)]"> / {event.subtitle}</span>
          ) : null}
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
          {event.date} · {event.venue}
        </p>
        <p className="mt-3 inline-flex items-center text-sm font-semibold text-primary">
          Find tickets
          <span className="ml-1 transition group-hover:translate-x-0.5" aria-hidden>
            →
          </span>
        </p>
      </div>
    </Link>
  );
}
