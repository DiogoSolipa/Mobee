/* Mobee domain model. Mirrors "Core concepts" in the MVP context brief. */

/** Minutes since local (Europe/Lisbon) midnight. 10:30 = 630. */
export type Minutes = number;
/** Local calendar date, 'YYYY-MM-DD' in Europe/Lisbon. */
export type ISODate = string;

export type Mode = 'walk' | 'bus' | 'metro' | 'train' | 'ferry' | 'bike' | 'car';
export type ContextKey = 'work' | 'home' | 'errand' | 'self';
export type Priority = 'fastest' | 'fewest' | 'calm';
export type MetroLine = 'yellow' | 'green' | 'blue' | 'red';
export type Lang = 'en' | 'pt';

export interface Place {
  id: string;
  name: string;
  area?: string;
  lat?: number;
  lon?: number;
  /** Metro de Lisboa lines at the nearest station. */
  metro?: MetroLine[];
  /** Steep streets around it (Lisbon matters here). */
  hilly?: boolean;
}

export interface FlexWindow {
  /** today = "sometime today"; window = between from/to; before = any day up to deadline. */
  kind: 'today' | 'window' | 'before';
  from?: Minutes;
  to?: Minutes;
  deadline?: ISODate;
}

export interface Stop {
  id: string;
  title: string;
  placeId?: string;
  /** Free-text place, shown when placeId is not in the catalogue. */
  placeName: string;
  date: ISODate;
  start: Minutes;
  duration: Minutes;
  context: ContextKey;
  note?: string;
  /** Principle 5: fixed things are sacred. */
  fixed: boolean;
  /** Present for flexible errands (FR-03). */
  flex?: FlexWindow;
  openingHours?: { from: Minutes; to: Minutes };
  /** Set when an accepted proposal moved this stop (FR-08). */
  previous?: { date: ISODate; start: Minutes };
}

export interface LineRef {
  /** Normalised key, e.g. 'ml:green', 'cp:sintra', 'cm:1716'. */
  key: string;
  label: { en: string; pt: string };
}

export interface Leg {
  fromStopId: string;
  toStopId: string;
  mode: Mode;
  minutes: number;
  /** One line, e.g. "Green line", "Green → Yellow line", "Bus". */
  detail: { en: string; pt: string };
  lines: LineRef[];
  transfers: number;
  walkMinutes: number;
  /** Set when a live disruption changed this leg. */
  disruption?: { id: string; delayMin?: number; replaced?: boolean };
  /** true when timings come from the estimator, not a trip planner. */
  estimated: boolean;
}

export type DisruptionSource = 'tml' | 'carris-metropolitana' | 'metro-lisboa' | 'ipma' | 'demo';
export type DisruptionEffect = 'delay' | 'no-service' | 'reduced' | 'detour' | 'weather' | 'other';

/** FR-34: every feed is normalised to this one shape before the trigger engine sees it. */
export interface Disruption {
  id: string;
  source: DisruptionSource;
  operator?: string;
  /** Normalised line keys it affects ('ml:green'). Empty for weather. */
  lines: string[];
  stops: string[];
  effect: DisruptionEffect;
  delayMin?: number;
  /** Epoch ms. */
  start?: number;
  end?: number;
  header: { en?: string; pt?: string };
  description?: { en?: string; pt?: string };
  weather?: { kind: 'rain' | 'wind' | 'heat' | 'cold' | 'fog' | 'other'; level: 'yellow' | 'orange' | 'red' | 'forecast' };
}

export interface FeedHealth {
  source: DisruptionSource;
  label: string;
  ok: boolean;
  fetchedAt: number;
  count: number;
  error?: string;
  /** true when the source is not configured (e.g. missing API key). */
  skipped?: boolean;
}

export interface FeedSnapshot {
  disruptions: Disruption[];
  health: FeedHealth[];
  /** Today's precipitation probability for Lisbon (0–100), from IPMA. */
  rainProbability?: number;
  generatedAt: number;
}

export type Trigger =
  | { kind: 'late'; minutes: number; at: number }
  | { kind: 'disruption'; disruptionId: string; delayMin?: number }
  | { kind: 'rain'; disruptionId: string };

export type Change =
  | { kind: 'time'; stopId: string; title: string; from: Minutes; to: Minutes }
  | { kind: 'day'; stopId: string; title: string; from: Minutes; toDate: ISODate; to: Minutes }
  | { kind: 'leg'; toStopId: string; title: string; from: { mode: Mode; minutes: number }; to: { mode: Mode; minutes: number } };

export interface Proposal {
  id: string;
  date: ISODate;
  createdAt: number;
  triggers: Trigger[];
  changes: Change[];
  /** Fixed stops the plan was built around. */
  protectedStopIds: string[];
  /** Fixed stops that cannot be reached on time even after replanning (FR-16). */
  atRisk: { stopId: string; lateBy: number }[];
  /** The resulting full list of stops (all dates) if accepted. */
  result: Stop[];
  priority: Priority;
  /** Identifies the causes, for de-duplication (FR-13). */
  signature: string;
}

export interface TravelRules {
  walkUnder10: boolean;
  avoidHills: boolean;
  busWhenRain: boolean;
  stepFree: boolean;
}

export interface Settings {
  priority: Priority;
  rules: TravelRules;
  contextNames: Record<ContextKey, string>;
  lang: Lang;
  theme: 'auto' | 'day' | 'night';
  name: string;
  notifications: boolean;
}
