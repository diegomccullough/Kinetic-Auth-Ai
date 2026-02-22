export type EventCategory = "music" | "sports" | "comedy" | "family" | "arts" | "festival";

export type SeatSection = {
  id: string;
  label: string;
  zone: "floor" | "lower" | "upper" | "vip" | "lawn";
  price: number;
  available: number;
  color: string; // hex for schematic
  x: number; // percent position on schematic (0-100)
  y: number;
  width: number;
  height: number;
};

export type EventSong = {
  title: string;
  artist: string;
  /** BPM for beat-challenge timing */
  bpm: number;
  /** YouTube embed ID (used for audio only) */
  youtubeId: string;
  /** Path to audio file in public/music/ — e.g. /music/coldplay.mp3 */
  audioSrc?: string;
};

export type Event = {
  slug: string;
  name: string;
  subtitle?: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  state: string;
  category: EventCategory;
  imagePlaceholder: string;
  defaultSection: string;
  defaultPrice: number;
  isFeatured?: boolean;
  isHot?: boolean;
  tag?: string; // "On Sale Now", "Selling Fast", etc.
  sections: SeatSection[];
  /** Popular songs for beat-challenge (music/festival events only) */
  songs?: EventSong[];
};

// ─── Seat sections for arena-style venues ─────────────────────────────────────
const arenaFloorSections: SeatSection[] = [
  { id: "floor-ga", label: "Floor – General Admission", zone: "floor", price: 199, available: 120, color: "#026cdf", x: 32, y: 38, width: 36, height: 24 },
  { id: "vip-pit",  label: "VIP Pit",                  zone: "vip",   price: 399, available: 30,  color: "#7c3aed", x: 38, y: 42, width: 24, height: 16 },
  { id: "sec-101",  label: "Section 101",               zone: "lower", price: 145, available: 60,  color: "#0ea5e9", x: 10, y: 55, width: 14, height: 12 },
  { id: "sec-102",  label: "Section 102",               zone: "lower", price: 145, available: 44,  color: "#0ea5e9", x: 10, y: 35, width: 14, height: 12 },
  { id: "sec-103",  label: "Section 103",               zone: "lower", price: 125, available: 72,  color: "#38bdf8", x: 18, y: 18, width: 16, height: 12 },
  { id: "sec-104",  label: "Section 104",               zone: "lower", price: 125, available: 55,  color: "#38bdf8", x: 38, y: 10, width: 24, height: 12 },
  { id: "sec-105",  label: "Section 105",               zone: "lower", price: 125, available: 61,  color: "#38bdf8", x: 66, y: 18, width: 16, height: 12 },
  { id: "sec-106",  label: "Section 106",               zone: "lower", price: 145, available: 38,  color: "#0ea5e9", x: 76, y: 35, width: 14, height: 12 },
  { id: "sec-107",  label: "Section 107",               zone: "lower", price: 145, available: 50,  color: "#0ea5e9", x: 76, y: 55, width: 14, height: 12 },
  { id: "sec-201",  label: "Section 201",               zone: "upper", price: 75,  available: 200, color: "#bae6fd", x: 5,  y: 58, width: 12, height: 10 },
  { id: "sec-202",  label: "Section 202",               zone: "upper", price: 75,  available: 180, color: "#bae6fd", x: 5,  y: 32, width: 12, height: 10 },
  { id: "sec-203",  label: "Section 203",               zone: "upper", price: 65,  available: 220, color: "#e0f2fe", x: 14, y: 12, width: 14, height: 10 },
  { id: "sec-204",  label: "Section 204",               zone: "upper", price: 65,  available: 195, color: "#e0f2fe", x: 36, y: 2,  width: 28, height: 10 },
  { id: "sec-205",  label: "Section 205",               zone: "upper", price: 65,  available: 210, color: "#e0f2fe", x: 72, y: 12, width: 14, height: 10 },
  { id: "sec-206",  label: "Section 206",               zone: "upper", price: 75,  available: 175, color: "#bae6fd", x: 83, y: 32, width: 12, height: 10 },
  { id: "sec-207",  label: "Section 207",               zone: "upper", price: 75,  available: 190, color: "#bae6fd", x: 83, y: 58, width: 12, height: 10 },
];

const stadiumSections: SeatSection[] = [
  { id: "field-ga",  label: "Field – General Admission", zone: "floor", price: 249, available: 80,  color: "#16a34a", x: 25, y: 35, width: 50, height: 30 },
  { id: "club-left", label: "Club Level Left",           zone: "vip",   price: 350, available: 25,  color: "#7c3aed", x: 10, y: 40, width: 12, height: 20 },
  { id: "club-right","label": "Club Level Right",        zone: "vip",   price: 350, available: 22,  color: "#7c3aed", x: 78, y: 40, width: 12, height: 20 },
  { id: "lower-100", label: "Lower 100s",                zone: "lower", price: 145, available: 150, color: "#4ade80", x: 10, y: 20, width: 80, height: 14 },
  { id: "lower-200", label: "Lower 200s",                zone: "lower", price: 110, available: 200, color: "#86efac", x: 5,  y: 68, width: 90, height: 14 },
  { id: "upper-300", label: "Upper 300s",                zone: "upper", price: 65,  available: 400, color: "#dcfce7", x: 2,  y: 10, width: 96, height: 10 },
  { id: "upper-400", label: "Upper 400s",                zone: "upper", price: 55,  available: 500, color: "#f0fdf4", x: 2,  y: 82, width: 96, height: 10 },
];

const clubSections: SeatSection[] = [
  { id: "table-front", label: "Front Tables",    zone: "vip",   price: 120, available: 20,  color: "#7c3aed", x: 25, y: 55, width: 50, height: 20 },
  { id: "table-mid",   label: "Mid Tables",      zone: "lower", price: 85,  available: 40,  color: "#a78bfa", x: 15, y: 35, width: 70, height: 18 },
  { id: "table-back",  label: "Back Tables",     zone: "lower", price: 65,  available: 60,  color: "#c4b5fd", x: 10, y: 15, width: 80, height: 18 },
  { id: "bar-standing","label": "Bar Standing",  zone: "floor", price: 45,  available: 100, color: "#ede9fe", x: 5,  y: 80, width: 90, height: 12 },
];

const amphiSections: SeatSection[] = [
  { id: "lawn",        label: "Lawn",            zone: "lawn",  price: 49,  available: 500, color: "#86efac", x: 5,  y: 5,  width: 90, height: 30 },
  { id: "pavilion-ga", label: "Pavilion GA",     zone: "floor", price: 89,  available: 200, color: "#4ade80", x: 20, y: 40, width: 60, height: 20 },
  { id: "reserved-l",  label: "Reserved Left",   zone: "lower", price: 125, available: 80,  color: "#0ea5e9", x: 5,  y: 40, width: 14, height: 35 },
  { id: "reserved-r",  label: "Reserved Right",  zone: "lower", price: 125, available: 75,  color: "#0ea5e9", x: 81, y: 40, width: 14, height: 35 },
  { id: "vip-center",  label: "VIP Center",      zone: "vip",   price: 249, available: 30,  color: "#7c3aed", x: 30, y: 65, width: 40, height: 20 },
];

export const EVENTS: Event[] = [
  // ── Real artists ──────────────────────────────────────────────────────────
  {
    slug: "coldplay",
    name: "Coldplay",
    subtitle: "Music of the Spheres World Tour",
    date: "Sat, Jul 12, 2025",
    time: "7:30 PM",
    venue: "SoFi Stadium",
    city: "Los Angeles",
    state: "CA",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #0c4a6e 0%, #075985 40%, #7c3aed 100%)",
    defaultSection: "Floor GA",
    defaultPrice: 189,
    isFeatured: true,
    isHot: true,
    tag: "Selling Fast",
    sections: arenaFloorSections,
    songs: [
      { title: "Viva La Vida", artist: "Coldplay", bpm: 138, youtubeId: "dvgZkm1xWPE", audioSrc: "/music/coldplay.mp3" },
    ],
  },
  {
    slug: "lil-baby",
    name: "Lil Baby",
    subtitle: "Back Outside Tour",
    date: "Fri, Aug 8, 2025",
    time: "9:00 PM",
    venue: "State Farm Arena",
    city: "Houston",
    state: "TX",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #1c1917 0%, #292524 40%, #78350f 100%)",
    defaultSection: "Floor GA",
    defaultPrice: 149,
    isFeatured: true,
    isHot: true,
    tag: "High Demand",
    sections: arenaFloorSections,
    songs: [
      { title: "Freestyle", artist: "Lil Baby", bpm: 150, youtubeId: "Yvng_FQOT4o", audioSrc: "/music/lil-baby.mp3" },
    ],
  },
  {
    slug: "partynextdoor",
    name: "PARTYNEXTDOOR",
    subtitle: "The After Hours Tour",
    date: "Sat, Sep 6, 2025",
    time: "9:30 PM",
    venue: "Scotiabank Arena",
    city: "New York",
    state: "NY",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 100%)",
    defaultSection: "Floor GA",
    defaultPrice: 129,
    isFeatured: true,
    tag: "On Sale Now",
    sections: arenaFloorSections,
    songs: [
      { title: "For Certain", artist: "PARTYNEXTDOOR", bpm: 95, youtubeId: "4NRXx6U8ABQ" },
    ],
  },
  {
    slug: "drake",
    name: "Drake",
    subtitle: "It's All A Blur Tour",
    date: "Fri, Oct 3, 2025",
    time: "8:30 PM",
    venue: "United Center",
    city: "Chicago",
    state: "IL",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    defaultSection: "Floor GA",
    defaultPrice: 249,
    isFeatured: true,
    isHot: true,
    tag: "Selling Fast",
    sections: arenaFloorSections,
    songs: [
      { title: "Passionfruit", artist: "Drake", bpm: 100, youtubeId: "RubBzkZzpUA", audioSrc: "/music/drake.mp3" },
    ],
  },
  {
    slug: "adele",
    name: "Adele",
    subtitle: "An Evening with Adele",
    date: "Sat, Nov 15, 2025",
    time: "8:00 PM",
    venue: "Crypto.com Arena",
    city: "Los Angeles",
    state: "CA",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #1c1917 0%, #44403c 40%, #78716c 100%)",
    defaultSection: "Orchestra Center",
    defaultPrice: 299,
    isFeatured: true,
    isHot: true,
    tag: "Limited Seats",
    sections: arenaFloorSections,
    songs: [
      { title: "Skyfall", artist: "Adele", bpm: 68, youtubeId: "DeumyOzKqgI" },
    ],
  },
  {
    slug: "beyonce",
    name: "Beyoncé",
    subtitle: "Cowboy Carter World Tour",
    date: "Fri, Dec 5, 2025",
    time: "8:00 PM",
    venue: "AT&T Stadium",
    city: "Dallas",
    state: "TX",
    category: "music",
    imagePlaceholder: "linear-gradient(135deg, #78350f 0%, #b45309 40%, #d97706 100%)",
    defaultSection: "Floor GA",
    defaultPrice: 349,
    isFeatured: true,
    isHot: true,
    tag: "Selling Fast",
    sections: arenaFloorSections,
    songs: [
      { title: "Crazy In Love", artist: "Beyoncé", bpm: 99, youtubeId: "ViwtNLUqkMY", audioSrc: "/music/beyonce.mp3" },
    ],
  },
  // ── Other events ──────────────────────────────────────────────────────────
  {
    slug: "thunder-dome",
    name: "Thunder Dome",
    subtitle: "Championship Finals",
    date: "Sun, Nov 9, 2025",
    time: "3:00 PM",
    venue: "Metro Stadium",
    city: "Chicago",
    state: "IL",
    category: "sports",
    imagePlaceholder: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
    defaultSection: "Section 204 • Row 12",
    defaultPrice: 145,
    isFeatured: true,
    isHot: true,
    tag: "High Demand",
    sections: stadiumSections,
  },
  {
    slug: "laugh-factory",
    name: "Laugh Factory Live",
    subtitle: "Stand-Up Series",
    date: "Fri, Sep 12, 2025",
    time: "7:30 PM",
    venue: "Downtown Comedy Club",
    city: "New York",
    state: "NY",
    category: "comedy",
    imagePlaceholder: "linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)",
    defaultSection: "Table 4 • 2 seats",
    defaultPrice: 65,
    sections: clubSections,
  },
  {
    slug: "family-fun-day",
    name: "Family Fun Day",
    subtitle: "Outdoor Festival",
    date: "Sat, Jun 14, 2025",
    time: "10:00 AM",
    venue: "Riverside Park",
    city: "Austin",
    state: "TX",
    category: "family",
    imagePlaceholder: "linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)",
    defaultSection: "General Admission",
    defaultPrice: 25,
    sections: amphiSections,
  },
  {
    slug: "electric-dreams",
    name: "Electric Dreams",
    subtitle: "EDM Festival",
    date: "Fri, Jul 4, 2025",
    time: "6:00 PM",
    venue: "Lakeside Amphitheatre",
    city: "Miami",
    state: "FL",
    category: "festival",
    imagePlaceholder: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)",
    defaultSection: "Lawn • 1 ticket",
    defaultPrice: 49,
    tag: "On Sale Now",
    sections: amphiSections,
  },
  {
    slug: "slam-dunk-classic",
    name: "Slam Dunk Classic",
    subtitle: "All-Star Weekend",
    date: "Sun, Feb 16, 2025",
    time: "7:00 PM",
    venue: "United Center",
    city: "Chicago",
    state: "IL",
    category: "sports",
    imagePlaceholder: "linear-gradient(135deg, #172554 0%, #1e3a8a 50%, #1d4ed8 100%)",
    defaultSection: "Lower 100s",
    defaultPrice: 110,
    sections: stadiumSections,
  },
  {
    slug: "broadway-nights",
    name: "Broadway Nights",
    subtitle: "Best of Broadway Tour",
    date: "Thu, Apr 10, 2025",
    time: "8:00 PM",
    venue: "Grand Theatre",
    city: "New York",
    state: "NY",
    category: "arts",
    imagePlaceholder: "linear-gradient(135deg, #1c1917 0%, #292524 50%, #44403c 100%)",
    defaultSection: "Orchestra Center",
    defaultPrice: 195,
    tag: "Limited Seats",
    sections: clubSections,
  },
  {
    slug: "comedy-kings",
    name: "Comedy Kings",
    subtitle: "Nationwide Tour",
    date: "Fri, Mar 7, 2025",
    time: "8:00 PM",
    venue: "Laugh Lounge",
    city: "Houston",
    state: "TX",
    category: "comedy",
    imagePlaceholder: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #a16207 100%)",
    defaultSection: "Front Tables",
    defaultPrice: 75,
    sections: clubSections,
  },
  {
    slug: "world-cup-watch",
    name: "World Cup Watch Party",
    subtitle: "Live Screening",
    date: "Wed, Jun 18, 2025",
    time: "2:00 PM",
    venue: "Fan Zone Stadium",
    city: "Dallas",
    state: "TX",
    category: "sports",
    imagePlaceholder: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #166534 100%)",
    defaultSection: "Field GA",
    defaultPrice: 35,
    isHot: true,
    tag: "High Demand",
    sections: stadiumSections,
  },
];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  music: "Music",
  sports: "Sports",
  comedy: "Comedy",
  family: "Family",
  arts: "Arts & Theatre",
  festival: "Festivals",
};

export const CITIES = [
  "Los Angeles", "New York", "Chicago", "Houston", "Phoenix",
  "Las Vegas", "Miami", "Austin", "Dallas", "San Francisco",
];

export function getEventBySlug(slug: string): Event | undefined {
  return EVENTS.find((e) => e.slug === slug);
}

export function getEventsByCategory(category: EventCategory | "all"): Event[] {
  if (category === "all") return EVENTS;
  return EVENTS.filter((e) => e.category === category);
}

export function getFeaturedEvents(): Event[] {
  return EVENTS.filter((e) => e.isFeatured);
}

export function getEventsByCity(city: string): Event[] {
  if (!city || city === "all") return EVENTS;
  return EVENTS.filter((e) => e.city === city);
}
