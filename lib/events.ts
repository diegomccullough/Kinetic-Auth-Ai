export type EventCategory = "music" | "sports" | "comedy" | "family";

export type Event = {
  slug: string;
  name: string;
  subtitle?: string;
  date: string;
  time: string;
  venue: string;
  category: EventCategory;
  /** CSS gradient or color for placeholder image */
  imagePlaceholder: string;
  /** Default ticket section/price for ticket page */
  defaultSection: string;
  defaultPrice: number;
};

export const EVENTS: Event[] = [
  {
    slug: "bison-live",
    name: "BISON LIVE",
    subtitle: "HOMEcoming night",
    date: "Fri, Oct 17",
    time: "8:30 PM",
    venue: "Neon City Arena",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)",
    defaultSection: "Section B • Row 3",
    defaultPrice: 299,
  },
  {
    slug: "midnight-run",
    name: "Midnight Run",
    subtitle: "On tour",
    date: "Sat, Mar 22",
    time: "8:00 PM",
    venue: "Harbor Pavilion",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #312e81 0%, #4c1d95 50%, #5b21b6 100%)",
    defaultSection: "Floor • General admission",
    defaultPrice: 89,
  },
  {
    slug: "thunder-dome",
    name: "Thunder Dome",
    subtitle: "Championship finals",
    date: "Sun, Nov 9",
    time: "3:00 PM",
    venue: "Metro Stadium",
    category: "sports",
    imagePlaceholder: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
    defaultSection: "Section 204 • Row 12",
    defaultPrice: 145,
  },
  {
    slug: "laugh-factory",
    name: "Laugh Factory Live",
    subtitle: "Stand-up series",
    date: "Fri, Sep 12",
    time: "7:30 PM",
    venue: "Downtown Comedy Club",
    category: "comedy",
    imagePlaceholder: "linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)",
    defaultSection: "Table 4 • 2 seats",
    defaultPrice: 65,
  },
  {
    slug: "family-fun-day",
    name: "Family Fun Day",
    subtitle: "Outdoor festival",
    date: "Sat, Jun 14",
    time: "10:00 AM",
    venue: "Riverside Park",
    category: "family",
    imagePlaceholder: "linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)",
    defaultSection: "General admission",
    defaultPrice: 25,
  },
  {
    slug: "electric-dreams",
    name: "Electric Dreams",
    subtitle: "Festival night",
    date: "Fri, Jul 4",
    time: "6:00 PM",
    venue: "Lakeside Amphitheatre",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)",
    defaultSection: "Lawn • 1 ticket",
    defaultPrice: 49,
  },
];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  music: "Music",
  sports: "Sports",
  comedy: "Comedy",
  family: "Family",
};

export function getEventBySlug(slug: string): Event | undefined {
  return EVENTS.find((e) => e.slug === slug);
}

export function getEventsByCategory(category: EventCategory | "all"): Event[] {
  if (category === "all") return EVENTS;
  return EVENTS.filter((e) => e.category === category);
}
