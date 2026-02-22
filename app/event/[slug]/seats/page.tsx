"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getEventBySlug, type SeatSection } from "@/lib/events";

// ─── Zone label + color ───────────────────────────────────────────────────────
const ZONE_LABELS: Record<string, string> = {
  vip: "VIP",
  floor: "Floor / GA",
  lower: "Lower Level",
  upper: "Upper Level",
  lawn: "Lawn",
};

// ─── Venue Schematic ──────────────────────────────────────────────────────────
function VenueSchematic({
  sections,
  selected,
  onSelect,
  priceMax,
}: {
  sections: SeatSection[];
  selected: string | null;
  onSelect: (id: string) => void;
  priceMax: number;
}) {
  const visible = sections.filter((s) => s.price <= priceMax && s.available > 0);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gray-900 shadow-inner" style={{ paddingBottom: "70%" }}>
      {/* Stage */}
      <div className="absolute left-1/2 bottom-[6%] -translate-x-1/2 z-10">
        <div className="flex items-center justify-center rounded-lg bg-white/10 px-8 py-2 text-xs font-bold uppercase tracking-widest text-white/70 ring-1 ring-white/20">
          STAGE
        </div>
      </div>

      {/* Sections */}
      {sections.map((sec) => {
        const isVisible = sec.price <= priceMax && sec.available > 0;
        const isSelected = selected === sec.id;
        return (
          <button
            key={sec.id}
            disabled={!isVisible}
            onClick={() => isVisible && onSelect(sec.id)}
            title={`${sec.label} — $${sec.price}`}
            style={{
              position: "absolute",
              left: `${sec.x}%`,
              top: `${sec.y}%`,
              width: `${sec.width}%`,
              height: `${sec.height}%`,
              backgroundColor: isVisible ? sec.color : "#374151",
              opacity: isVisible ? (isSelected ? 1 : 0.75) : 0.3,
              border: isSelected ? "2px solid white" : "1px solid rgba(255,255,255,0.15)",
              borderRadius: "6px",
              transition: "opacity 0.15s, transform 0.15s",
              transform: isSelected ? "scale(1.04)" : "scale(1)",
              cursor: isVisible ? "pointer" : "not-allowed",
              zIndex: isSelected ? 20 : 10,
            }}
            className="flex items-center justify-center"
            aria-label={sec.label}
            aria-pressed={isSelected}
          >
            <span
              className="truncate px-1 text-center font-semibold leading-tight"
              style={{
                fontSize: "clamp(7px, 1.2vw, 11px)",
                color: isVisible ? (sec.zone === "upper" ? "#1e3a8a" : "white") : "#6b7280",
              }}
            >
              {sec.label.split(" – ")[0].split(" • ")[0]}
            </span>
          </button>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1 rounded-lg bg-black/60 p-2 backdrop-blur-sm">
        {Object.entries(ZONE_LABELS).map(([zone, label]) => {
          const sec = sections.find((s) => s.zone === zone);
          if (!sec) return null;
          return (
            <div key={zone} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: sec.color }} />
              <span className="text-[10px] text-white/70">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section list item ────────────────────────────────────────────────────────
function SectionRow({
  sec,
  selected,
  qty,
  onSelect,
}: {
  sec: SeatSection;
  selected: boolean;
  qty: number;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={[
        "w-full rounded-xl border p-3.5 text-left transition",
        selected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm"
            style={{ backgroundColor: sec.color }}
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">{sec.label}</p>
            <p className="mt-0.5 text-xs text-gray-500 capitalize">{ZONE_LABELS[sec.zone]}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">${sec.price}</p>
          <p className="text-xs text-gray-400">ea.</p>
        </div>
      </div>
      {selected && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-100 px-3 py-2">
          <span className="text-xs font-medium text-blue-800">
            {qty} × ${sec.price} = <strong>${sec.price * qty}</strong>
          </span>
          <span className="text-xs text-blue-600">{sec.available} left</span>
        </div>
      )}
    </button>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────
function SeatsClient() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const event = getEventBySlug(slug);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [priceMax, setPriceMax] = useState(500);
  const [sortBy, setSortBy] = useState<"price" | "availability">("price");
  const [zoneFilter, setZoneFilter] = useState<string>("all");

  const sections = event?.sections ?? [];

  const maxPrice = useMemo(() => Math.max(...sections.map((s) => s.price)), [sections]);
  const minPrice = useMemo(() => Math.min(...sections.map((s) => s.price)), [sections]);

  const filteredSections = useMemo(() => {
    let list = sections.filter((s) => s.price <= priceMax && s.available > 0);
    if (zoneFilter !== "all") list = list.filter((s) => s.zone === zoneFilter);
    if (sortBy === "price") list = [...list].sort((a, b) => a.price - b.price);
    else list = [...list].sort((a, b) => b.available - a.available);
    return list;
  }, [sections, priceMax, zoneFilter, sortBy]);

  const selectedSection = sections.find((s) => s.id === selectedId);

  const zones = useMemo(() => {
    const seen = new Set<string>();
    sections.forEach((s) => seen.add(s.zone));
    return Array.from(seen);
  }, [sections]);

  if (!event) {
    return (
      <main className="min-h-dvh bg-[#f0f4fb] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Event not found</p>
          <Link href="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">← Back to events</Link>
        </div>
      </main>
    );
  }

  const verifyUrl = `/verify?return=${encodeURIComponent(`/event/${slug}?section=${selectedId ?? ""}&qty=${qty}`)}`;

  return (
    <div className="min-h-dvh bg-[#f0f4fb]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href={`/event/${slug}`} className="text-blue-600 hover:text-blue-800 transition" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{event.name}</p>
            <p className="truncate text-xs text-gray-500">{event.date} · {event.venue}</p>
          </div>
          <div className="ml-auto shrink-0">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
              Select Seats
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">

          {/* ── Left: Schematic + Filters ────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Schematic */}
            <div className="mb-4">
              <h2 className="mb-2 text-base font-bold text-gray-900">Venue Map</h2>
              <VenueSchematic
                sections={sections}
                selected={selectedId}
                onSelect={setSelectedId}
                priceMax={priceMax}
              />
              <p className="mt-2 text-center text-xs text-gray-400">
                Tap a section to select · Grayed sections exceed your price filter
              </p>
            </div>

            {/* Filters row */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Filters</h3>

              {/* Price range */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">Max price per ticket</label>
                  <span className="text-xs font-bold text-blue-700">${priceMax}</span>
                </div>
                <input
                  type="range"
                  min={minPrice}
                  max={maxPrice}
                  step={5}
                  value={priceMax}
                  onChange={(e) => setPriceMax(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>${minPrice}</span>
                  <span>${maxPrice}</span>
                </div>
              </div>

              {/* Zone filter */}
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-medium text-gray-600">Zone</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setZoneFilter("all")}
                    className={["rounded-full px-3 py-1 text-xs font-medium transition",
                      zoneFilter === "all" ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                    ].join(" ")}
                  >All</button>
                  {zones.map((z) => (
                    <button
                      key={z}
                      onClick={() => setZoneFilter(z)}
                      className={["rounded-full px-3 py-1 text-xs font-medium capitalize transition",
                        zoneFilter === z ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                      ].join(" ")}
                    >
                      {ZONE_LABELS[z] ?? z}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-600">Sort by</p>
                <div className="flex gap-2">
                  {(["price", "availability"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={["rounded-full px-3 py-1 text-xs font-medium capitalize transition",
                        sortBy === opt ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                      ].join(" ")}
                    >
                      {opt === "price" ? "Price: Low to High" : "Most Available"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Section list + checkout ───────────────────────────────── */}
          <div className="w-full lg:w-[360px] lg:shrink-0">

            {/* Quantity */}
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <span className="text-sm font-semibold text-gray-800">Tickets</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 transition font-bold text-lg"
                >−</button>
                <span className="w-6 text-center text-sm font-bold text-gray-900">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(8, q + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 transition font-bold text-lg"
                >+</button>
              </div>
            </div>

            {/* Section list */}
            <div className="mb-4 space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredSections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-10 text-center">
                  <p className="text-sm text-gray-500">No sections match your filters.</p>
                  <button
                    onClick={() => { setPriceMax(maxPrice); setZoneFilter("all"); }}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >Reset filters</button>
                </div>
              ) : (
                filteredSections.map((sec) => (
                  <SectionRow
                    key={sec.id}
                    sec={sec}
                    selected={selectedId === sec.id}
                    qty={qty}
                    onSelect={() => setSelectedId(selectedId === sec.id ? null : sec.id)}
                  />
                ))
              )}
            </div>

            {/* Checkout card */}
            <div className="sticky bottom-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-lg">
              {selectedSection ? (
                <>
                  <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Selected</p>
                    <p className="mt-0.5 text-sm font-bold text-gray-900">{selectedSection.label}</p>
                    <p className="text-xs text-gray-500 capitalize">{ZONE_LABELS[selectedSection.zone]}</p>
                  </div>
                  <div className="mb-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>{qty} × ticket</span>
                      <span>${selectedSection.price * qty}.00</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Service fee</span>
                      <span>${(qty * 12).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-1.5 font-bold text-gray-900">
                      <span>Total</span>
                      <span className="text-blue-700">${(selectedSection.price * qty + qty * 12).toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(verifyUrl)}
                    className="w-full rounded-xl bg-[#026cdf] py-3.5 text-sm font-bold text-white hover:bg-[#0258b8] active:bg-[#014fa6] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    Continue to Verify →
                  </button>
                  <p className="mt-2 text-center text-xs text-gray-400">
                    Motion verification required · Takes ~30 seconds
                  </p>
                </>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-2xl">🗺️</p>
                  <p className="mt-2 text-sm font-semibold text-gray-700">Select a section</p>
                  <p className="mt-1 text-xs text-gray-400">Tap the map or choose from the list</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default function SeatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-[#f0f4fb]">
        <div className="h-14 bg-white border-b border-blue-100" />
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="h-80 rounded-2xl bg-gray-800 animate-pulse" />
        </div>
      </div>
    }>
      <SeatsClient />
    </Suspense>
  );
}
