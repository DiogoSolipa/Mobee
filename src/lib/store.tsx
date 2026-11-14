'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { lisbonNow } from './domain/time';
import type { Disruption, FeedSnapshot, Minutes, Proposal, Settings, Stop, Trigger } from './domain/types';
import { mergeCalendar, sameCalendar } from './calendar/merge';
import { replan, triggerSignature, undoDeadline } from './engine/replan';
import type { Coord } from './engine/travel';
import { MatrixPlanner, mergeRoutes, type LegMiss, type RouteEntry } from './engine/travel';
import { detectTriggers, dismissKeys, filterDismissed, type Detection } from './engine/triggers';
import { t } from './i18n';
import { DEFAULT_SETTINGS, RITA_NOW, ritaDay, ritaDayNow } from './seed';
import { autoTheme } from './theme';

/**
 * Client state. The plan is always cached on the device (localStorage), so the app opens instantly
 * and the demo works without an account. When the person is signed in (Google, or the personal
 * access link), the server copy in /api/state is the source of truth: it is loaded after the local
 * cache and every change is pushed back (debounced), with optimistic concurrency on `version`.
 * The reducer does not know any of this.
 */

const STORAGE_KEY = 'mobee:v1';
const POLL_MS = 60_000;

export type ProposalState = 'open' | 'accepted' | 'kept';

interface Demo { disruptions: Disruption[]; clock: Minutes | null; clockSetAt: number; rain: boolean }

export interface State {
  stops: Stop[];
  settings: Settings;
  proposal: Proposal | null;
  proposalState: ProposalState | null;
  /** Proposal was refreshed in place while open (FR-23). */
  proposalUpdated: boolean;
  undo: { before: Stop[]; deadline: Minutes; date: string } | null;
  lateTriggers: Trigger[];
  dismissed: Record<string, number>;
  demo: Demo;
  onboarded: boolean;
}

const initial: State = {
  stops: [],
  settings: DEFAULT_SETTINGS,
  proposal: null,
  proposalState: null,
  proposalUpdated: false,
  undo: null,
  lateTriggers: [],
  dismissed: {},
  demo: { disruptions: [], clock: null, clockSetAt: 0, rain: false },
  onboarded: false,
};

type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'upsertStop'; stop: Stop }
  | { type: 'deleteStop'; id: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'late'; minutes: number }
  | { type: 'proposal'; proposal: Proposal | null; updated?: boolean }
  | { type: 'accept' }
  | { type: 'keep' }
  | { type: 'undo' }
  | { type: 'reopen' }
  | { type: 'clearDone' }
  | { type: 'demoEvent'; disruption: Disruption }
  | { type: 'demoRain'; on: boolean }
  | { type: 'demoClear' }
  | { type: 'demoClock'; minutes: Minutes | null }
  | { type: 'loadRita'; date: string; minutes: Minutes }
  | { type: 'addStops'; stops: Stop[] }
  | { type: 'calendar'; from: string; to: string; stops: Stop[] }
  | { type: 'erase' };

function without(d: Record<string, number>, keys: Record<string, number>) {
  const out = { ...d };
  for (const k of Object.keys(keys)) delete out[k];
  return out;
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'hydrate': return a.state;
    case 'upsertStop': {
      const exists = s.stops.some((x) => x.id === a.stop.id);
      return { ...s, onboarded: true, stops: exists ? s.stops.map((x) => (x.id === a.stop.id ? a.stop : x)) : [...s.stops, a.stop] };
    }
    case 'deleteStop': return { ...s, stops: s.stops.filter((x) => x.id !== a.id) };
    case 'settings': return { ...s, settings: { ...s.settings, ...a.patch, rules: { ...s.settings.rules, ...(a.patch.rules ?? {}) } } };
    case 'late': return { ...s, lateTriggers: [...s.lateTriggers, { kind: 'late', minutes: a.minutes, at: Date.now() }] };
    case 'proposal':
      return a.proposal
        ? { ...s, proposal: a.proposal, proposalState: 'open', proposalUpdated: !!a.updated }
        : { ...s, proposal: null, proposalState: null, proposalUpdated: false };
    case 'accept': {
      if (!s.proposal) return s;
      return {
        ...s, stops: s.proposal.result, proposalState: 'accepted', proposalUpdated: false,
        undo: { before: s.stops, deadline: undoDeadline(s.proposal), date: s.proposal.date },
        dismissed: { ...s.dismissed, ...dismissKeys(s.proposal.triggers) }, lateTriggers: [],
      };
    }
    case 'keep': {
      if (!s.proposal) return s;
      return { ...s, proposalState: 'kept', proposalUpdated: false, dismissed: { ...s.dismissed, ...dismissKeys(s.proposal.triggers) }, lateTriggers: [] };
    }
    case 'undo': {
      if (!s.undo || !s.proposal) return s;
      return {
        ...s, stops: s.undo.before, undo: null, proposalState: 'open',
        dismissed: without(s.dismissed, dismissKeys(s.proposal.triggers)),
        lateTriggers: s.proposal.triggers.filter((x) => x.kind === 'late'),
      };
    }
    case 'reopen': {
      if (!s.proposal) return s;
      return { ...s, proposalState: 'open', dismissed: without(s.dismissed, dismissKeys(s.proposal.triggers)), lateTriggers: s.proposal.triggers.filter((x) => x.kind === 'late') };
    }
    case 'clearDone': return { ...s, proposal: null, proposalState: null, undo: null };
    case 'demoEvent': return { ...s, demo: { ...s.demo, disruptions: [...s.demo.disruptions.filter((d) => d.id !== a.disruption.id), a.disruption] } };
    case 'demoRain': return { ...s, demo: { ...s.demo, rain: a.on } };
    case 'demoClear': return { ...s, demo: { ...s.demo, disruptions: [], rain: false } };
    case 'demoClock': return { ...s, demo: { ...s.demo, clock: a.minutes, clockSetAt: Date.now() } };
    case 'loadRita': {
      // Prefer the real clock: Rita's day is shifted so routes and departures are today's real ones.
      const live = ritaDayNow(a.date, a.minutes, s.settings.lang);
      return {
        ...initial, settings: s.settings, onboarded: true,
        stops: live ?? ritaDay(a.date, s.settings.lang),
        demo: live ? { ...initial.demo } : { ...initial.demo, clock: RITA_NOW, clockSetAt: Date.now() },
      };
    }
    case 'addStops': return { ...s, onboarded: true, stops: [...s.stops.filter((x) => !a.stops.some((n) => n.id === x.id)), ...a.stops] };
    case 'calendar': return { ...s, stops: mergeCalendar(s.stops, a.from, a.to, a.stops) };
    case 'erase': return { ...initial, settings: { ...DEFAULT_SETTINGS, lang: s.settings.lang } };
  }
}

function normalise(parsed: Partial<State>, demo?: Demo): State {
  return { ...initial, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings, rules: { ...DEFAULT_SETTINGS.rules, ...parsed.settings?.rules } }, demo: { ...initial.demo, ...(demo ?? parsed.demo) } };
}
function load(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalise(JSON.parse(raw) as Partial<State>) : null;
  } catch {
    return null;
  }
}
/** What goes to the server: everything except the demo simulator. */
function toRemote(s: State): Omit<State, 'demo'> {
  const { demo: _demo, ...rest } = s;
  return rest;
}
export function clearLocal() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignored */ }
}
function save(s: State) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode or quota: keep working in memory */ }
}

export interface Toast { title: string; body: string; at: number }

export interface Account {
  /** 'unavailable' = the server has no database (local-only demo mode) or is unreachable. */
  status: 'loading' | 'signed-out' | 'signed-in' | 'unavailable';
  user?: { name: string; email: string; image?: string | null };
  via?: 'session' | 'token';
  /** Read-only Google Calendar access was granted (V2-20). */
  calendar?: boolean;
  sync: 'idle' | 'saving' | 'error';
}

interface Ctx {
  state: State;
  dispatch: (a: Action) => void;
  hydrated: boolean;
  now: { date: string; minutes: Minutes; epoch: number };
  feed: FeedSnapshot | null;
  feedError: string | null;
  refreshFeed: () => Promise<void>;
  detection: Detection;
  theme: 'day' | 'night';
  toast: Toast | null;
  dismissToast: () => void;
  /** Trip planner backed by real routes; legs it has not fetched yet come back 'pending'. */
  planner: MatrixPlanner;
  /** Current position while the app is open (V2-05); null until the browser gives one. */
  here: (Coord & { accuracy: number; at: number }) | null;
  /** 'off' = not signed in or Calendar not granted. */
  calendar: { status: 'off' | 'syncing' | 'ok' | 'error'; at: number | null };
  routing: { inFlight: number; error: string | null; provider: string | null };
  account: Account;
}

const StoreContext = createContext<Ctx | null>(null);

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStore outside provider');
  return c;
}

function proposalTitle(p: Proposal, s: State, disruptions: Disruption[]): { title: string; body: string } {
  const lang = s.settings.lang;
  const first = p.triggers.find((x) => x.kind === 'disruption');
  const d = first && first.kind === 'disruption' ? disruptions.find((x) => x.id === first.disruptionId) : undefined;
  const raw = d ? (lang === 'pt' ? d.header.pt ?? d.header.en : d.header.en ?? d.header.pt) ?? '' : p.triggers.some((x) => x.kind === 'rain') ? t(lang, 'replan.title.rain') : t(lang, 'replan.title.late');
  const title = raw.length > 40 ? `${raw.slice(0, 39).replace(/\s+\S*$/, '')}…` : raw;
  const n = p.changes.filter((c) => c.kind !== 'leg').length || p.changes.length;
  const body = t(lang, 'notif.body', { n: lang === 'pt' ? `${n} ${n === 1 ? 'paragem' : 'paragens'}` : `${n} ${n === 1 ? 'stop' : 'stops'}` });
  return { title, body };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [hydrated, setHydrated] = useState(false);
  const [feed, setFeed] = useState<FeedSnapshot | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [toast, setToast] = useState<Toast | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---- Real routes (trip planner) ----
  const [routes, setRoutes] = useState<Map<string, RouteEntry>>(() => new Map());
  const planner = useMemo(() => new MatrixPlanner(routes), [routes]);
  const [routing, setRouting] = useState<{ inFlight: number; error: string | null; provider: string | null }>({ inFlight: 0, error: null, provider: null });
  const inFlight = useRef(new Set<string>());
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After every render: fetch whatever the planner was asked about and could not answer.
  useEffect(() => {
    const wanted = [...planner.misses.entries()].filter(([id]) => !inFlight.current.has(id));
    if (!wanted.length || fetchTimer.current) return;
    fetchTimer.current = setTimeout(async () => {
      fetchTimer.current = null;
      const batch = [...planner.misses.entries()].filter(([id]) => !inFlight.current.has(id)).slice(0, 40);
      if (!batch.length) return;
      batch.forEach(([id]) => inFlight.current.add(id));
      setRouting((r) => ({ ...r, inFlight: r.inFlight + batch.length }));
      try {
        const res = await fetch('/api/legs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ requests: batch.map(([id, m]: [string, LegMiss]) => ({ key: id, from: m.from, to: m.to, departAt: m.departAt, wheelchair: m.wheelchair })) }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { provider?: string; results: Record<string, { options: import('./domain/types').TripOption[]; error?: string }> };
        setRoutes((prev) => {
          let next = prev;
          for (const [id, m] of batch) {
            const r = json.results[id];
            next = mergeRoutes(next, m.key, m.departAt, r?.options ?? [], r?.error ?? 'No route');
          }
          return next;
        });
        const errors = Object.values(json.results).filter((r) => r.error && !r.options.length).length;
        setRouting((r) => ({ ...r, provider: json.provider ?? r.provider, error: errors === batch.length ? Object.values(json.results)[0]?.error ?? 'Trip planner unavailable' : null }));
      } catch (e) {
        setRoutes((prev) => batch.reduce((next, [, m]) => mergeRoutes(next, m.key, m.departAt, [], 'Trip planner unavailable'), prev));
        setRouting((r) => ({ ...r, error: e instanceof Error ? e.message : 'Trip planner unavailable' }));
      } finally {
        batch.forEach(([id]) => inFlight.current.delete(id));
        setRouting((r) => ({ ...r, inFlight: Math.max(0, r.inFlight - batch.length) }));
      }
    }, 120);
  });

  // ---- Account + server sync ----
  const [account, setAccount] = useState<Account>({ status: 'loading', sync: 'idle' });
  const [remoteOn, setRemoteOn] = useState(false);
  const version = useRef(0);
  const lastPushed = useRef<string | null>(null);

  const adoptRemote = useCallback((remote: Partial<State>, v: number) => {
    const next = normalise(remote, stateRef.current.demo);
    version.current = v;
    lastPushed.current = JSON.stringify(toRemote(next));
    dispatch({ type: 'hydrate', state: next });
  }, []);

  const pullRemote = useCallback(async () => {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as { state: Partial<State> | null; version: number };
  }, []);

  // Hydrate from the device first (instant), then from the server when signed in.
  // Portuguese by default (pilot in Lisbon); English is one tap away.
  useEffect(() => {
    const stored = load();
    if (stored) dispatch({ type: 'hydrate', state: stored });
    setHydrated(true);
    (async () => {
      try {
        const me = await fetch('/api/me', { cache: 'no-store' });
        if (!me.ok) { setAccount({ status: 'unavailable', sync: 'idle' }); return; }
        const m = (await me.json()) as { user: Account['user'] | null; via?: Account['via']; calendar?: boolean };
        if (!m.user) { setAccount({ status: 'signed-out', sync: 'idle' }); return; }
        setAccount({ status: 'signed-in', user: m.user, via: m.via, calendar: m.calendar, sync: 'idle' });
        const remote = await pullRemote();
        // First sign-in on this device: an empty account adopts the local plan (pushed by the effect below).
        if (remote.state) adoptRemote(remote.state, remote.version);
        else version.current = 0;
        setRemoteOn(true);
      } catch {
        setAccount((a) => ({ ...a, status: a.status === 'loading' ? 'unavailable' : a.status, sync: 'error' }));
      }
    })();
  }, [adoptRemote, pullRemote]);

  useEffect(() => {
    if (!hydrated) return;
    save(state);
    if (!remoteOn) return;
    const body = JSON.stringify(toRemote(state));
    if (body === lastPushed.current) return;
    const timer = setTimeout(async () => {
      setAccount((a) => ({ ...a, sync: 'saving' }));
      try {
        const res = await fetch('/api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state: JSON.parse(body), baseVersion: version.current }) });
        if (res.status === 409) {
          // Someone else wrote first (another device, the assistant): the server copy wins.
          const j = (await res.json()) as { state: Partial<State> | null; version: number };
          if (j.state) adoptRemote(j.state, j.version); else version.current = j.version;
        } else if (res.ok) {
          version.current = ((await res.json()) as { version: number }).version;
          lastPushed.current = body;
        } else throw new Error(`HTTP ${res.status}`);
        setAccount((a) => ({ ...a, sync: 'idle' }));
      } catch {
        setAccount((a) => ({ ...a, sync: 'error' }));
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [state, hydrated, remoteOn, adoptRemote]);

  // Coming back to the app: pick up changes made elsewhere (assistant, another device).
  useEffect(() => {
    if (!remoteOn) return;
    const onVis = async () => {
      if (document.visibilityState !== 'visible') return;
      if (JSON.stringify(toRemote(stateRef.current)) !== lastPushed.current) return; // local edits pending: they push first
      try {
        const remote = await pullRemote();
        if (remote.state && remote.version > version.current) adoptRemote(remote.state, remote.version);
      } catch { /* offline: keep the local copy */ }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [remoteOn, adoptRemote, pullRemote]);

  // Minute tick: statuses, undo deadline and the 3-hour window move with the clock.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const refreshFeed = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/feeds${force ? '?force=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeed((await res.json()) as FeedSnapshot);
      setFeedError(null);
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : 'Unavailable');
    }
  }, []);
  useEffect(() => {
    refreshFeed();
    const id = setInterval(() => refreshFeed(), POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') refreshFeed(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [refreshFeed]);

  const now = useMemo(() => {
    const real = lisbonNow(tick);
    const { clock, clockSetAt } = state.demo;
    const minutes = clock === null ? real.minutes : Math.min(1439, clock + Math.floor((tick - clockSetAt) / 60000));
    return { date: real.date, minutes, epoch: tick };
  }, [tick, state.demo]);

  const allDisruptions = useMemo(() => [...(feed?.disruptions ?? []), ...state.demo.disruptions], [feed, state.demo.disruptions]);
  const rainProbability = state.demo.rain ? 100 : feed?.rainProbability;

  const detection = useMemo(
    () => detectTriggers({ stops: state.stops, date: now.date, now: now.minutes, nowEpoch: now.epoch, disruptions: allDisruptions, rainProbability, settings: state.settings, planner }),
    [state.stops, now, allDisruptions, rainProbability, state.settings, planner],
  );

  // The replan loop: triggers in → one proposal out (principles 1 and 4).
  useEffect(() => {
    if (!hydrated) return;
    const s = stateRef.current;
    const pendingBefore = planner.pendingHits;
    const triggers = [...s.lateTriggers, ...filterDismissed(detection.triggers, s.dismissed)];
    if (!triggers.length) {
      if (s.proposalState === 'open') dispatch({ type: 'proposal', proposal: null });
      if (s.proposalState === 'accepted' && s.undo && (s.undo.date !== now.date || now.minutes >= s.undo.deadline)) dispatch({ type: 'clearDone' });
      return;
    }
    const sig = triggerSignature(triggers);
    if (s.proposalState !== 'open' && s.proposal?.signature === sig) return;
    const p = replan({ stops: s.stops, date: now.date, now: now.minutes, triggers, disruptions: detection.relevant, raining: detection.raining, settings: s.settings, planner, here: hereRef.current ?? undefined });
    // The engine asked about routes we don't have yet: wait for them instead of proposing on incomplete data.
    if (planner.pendingHits > pendingBefore) return;
    if (!p) {
      if (s.proposalState === 'open') dispatch({ type: 'proposal', proposal: null });
      return;
    }
    const wasOpen = s.proposalState === 'open' && s.proposal;
    if (wasOpen && JSON.stringify(wasOpen.changes) === JSON.stringify(p.changes) && JSON.stringify(wasOpen.atRisk) === JSON.stringify(p.atRisk)) return;
    dispatch({ type: 'proposal', proposal: p, updated: !!wasOpen && wasOpen.signature !== sig });
    // Notify for automatic triggers (FR-24/25: one notification per proposal, replaced on update).
    const automatic = triggers.some((x) => x.kind !== 'late');
    if (automatic && s.settings.notifications && (!wasOpen || wasOpen.signature !== sig)) {
      const msg = proposalTitle(p, s, allDisruptions);
      setToast({ ...msg, at: Date.now() });
      if (typeof document !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(msg.title, { body: msg.body, tag: 'mobee-proposal' }); } catch { /* not allowed here */ }
      }
    }
  }, [hydrated, detection, planner, state.stops, state.settings.priority, state.settings.rules, state.lateTriggers, state.dismissed, state.proposalState, now, allDisruptions]);

  // ---- Where am I (V2-05): only while the app is visible; never stored. ----
  const [here, setHere] = useState<Ctx['here']>(null);
  const hereRef = useRef<Coord | null>(null);
  hereRef.current = here;
  useEffect(() => {
    if (!hydrated || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    let id: number | null = null;
    const start = () => {
      if (id !== null) return;
      id = navigator.geolocation.watchPosition(
        (p) => setHere((prev) => {
          const next = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp };
          // Ignore jitter under ~30 m: every new position re-runs the engine.
          if (prev && Math.abs(prev.lat - next.lat) < 0.0003 && Math.abs(prev.lon - next.lon) < 0.0003) return prev;
          return next;
        }),
        () => { /* denied or unavailable: plans still work from the previous stop */ },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
      );
    };
    const stop = () => { if (id !== null) navigator.geolocation.clearWatch(id); id = null; };
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [hydrated]);

  // ---- Google Calendar → commitments (V2-22): on open and when coming back, at most every 5 min. ----
  const [calendar, setCalendar] = useState<Ctx['calendar']>({ status: 'off', at: null });
  const calendarAt = useRef(0);
  const syncCalendar = useCallback(async (force = false) => {
    if (!force && Date.now() - calendarAt.current < 5 * 60_000) return;
    calendarAt.current = Date.now();
    setCalendar((c) => ({ ...c, status: 'syncing' }));
    try {
      const r = await fetch('/api/calendar', { cache: 'no-store' });
      const j = (await r.json()) as { connected?: boolean; from?: string; to?: string; stops?: Stop[] };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (!j.connected) { setCalendar({ status: 'off', at: null }); return; }
      const merged = mergeCalendar(stateRef.current.stops, j.from!, j.to!, j.stops ?? []);
      if (!sameCalendar(merged, stateRef.current.stops)) dispatch({ type: 'calendar', from: j.from!, to: j.to!, stops: j.stops ?? [] });
      setCalendar({ status: 'ok', at: Date.now() });
    } catch {
      setCalendar((c) => ({ ...c, status: 'error' }));
    }
  }, []);
  useEffect(() => {
    // Wait for the server copy of the plan first, so the merge happens on top of it.
    if (!remoteOn || account.status !== 'signed-in' || !account.calendar) return;
    syncCalendar(true);
    const onVis = () => { if (document.visibilityState === 'visible') syncCalendar(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [remoteOn, account.status, account.calendar, syncCalendar]);

  // Day/Night (auto at Lisbon sunset unless locked).
  const theme = state.settings.theme === 'auto' ? autoTheme(tick) : state.settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = state.settings.lang === 'pt' ? 'pt-PT' : 'en';
  }, [theme, state.settings.lang]);

  const value: Ctx = {
    state, dispatch, hydrated, now, feed, feedError, refreshFeed: () => refreshFeed(true), detection, theme,
    toast, dismissToast: () => setToast(null), planner, routing, account, here, calendar,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
