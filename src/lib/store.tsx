'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { lisbonNow } from './domain/time';
import type { Disruption, FeedSnapshot, Minutes, Proposal, Settings, Stop, Trigger } from './domain/types';
import { replan, triggerSignature, undoDeadline } from './engine/replan';
import { EstimatePlanner } from './engine/travel';
import { detectTriggers, dismissKeys, filterDismissed, type Detection } from './engine/triggers';
import { t } from './i18n';
import { DEFAULT_SETTINGS, ritaDay } from './seed';
import { autoTheme } from './theme';

/**
 * Client state. MVP keeps the plan on the device (localStorage) — no account needed to try it.
 * When accounts land (FR-31), swap `load`/`save` for the API; the reducer stays the same.
 */

export const planner = new EstimatePlanner();
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
  | { type: 'loadRita'; date: string }
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
    case 'loadRita':
      return {
        ...initial, settings: s.settings, onboarded: true,
        stops: ritaDay(a.date, s.settings.lang),
        demo: { ...initial.demo, clock: 10 * 60 + 12, clockSetAt: Date.now() },
      };
    case 'erase': return { ...initial, settings: { ...DEFAULT_SETTINGS, lang: s.settings.lang } };
  }
}

function load(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...initial, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings, rules: { ...DEFAULT_SETTINGS.rules, ...parsed.settings?.rules } }, demo: { ...initial.demo, ...parsed.demo } };
  } catch {
    return null;
  }
}
function save(s: State) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode or quota: keep working in memory */ }
}

export interface Toast { title: string; body: string; at: number }

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

  // Hydrate from the device, pick the phone's language on first run.
  useEffect(() => {
    const stored = load();
    if (stored) dispatch({ type: 'hydrate', state: stored });
    else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('pt')) dispatch({ type: 'settings', patch: { lang: 'pt' } });
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) save(state); }, [state, hydrated]);

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
    [state.stops, now, allDisruptions, rainProbability, state.settings],
  );

  // The replan loop: triggers in → one proposal out (principles 1 and 4).
  useEffect(() => {
    if (!hydrated) return;
    const s = stateRef.current;
    const triggers = [...s.lateTriggers, ...filterDismissed(detection.triggers, s.dismissed)];
    if (!triggers.length) {
      if (s.proposalState === 'open') dispatch({ type: 'proposal', proposal: null });
      if (s.proposalState === 'accepted' && s.undo && (s.undo.date !== now.date || now.minutes >= s.undo.deadline)) dispatch({ type: 'clearDone' });
      return;
    }
    const sig = triggerSignature(triggers);
    if (s.proposalState !== 'open' && s.proposal?.signature === sig) return;
    const p = replan({ stops: s.stops, date: now.date, now: now.minutes, triggers, disruptions: detection.relevant, raining: detection.raining, settings: s.settings, planner });
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
  }, [hydrated, detection, state.stops, state.settings.priority, state.settings.rules, state.lateTriggers, state.dismissed, state.proposalState, now, allDisruptions]);

  // Day/Night (auto at Lisbon sunset unless locked).
  const theme = state.settings.theme === 'auto' ? autoTheme(tick) : state.settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = state.settings.lang === 'pt' ? 'pt-PT' : 'en';
  }, [theme, state.settings.lang]);

  const value: Ctx = {
    state, dispatch, hydrated, now, feed, feedError, refreshFeed: () => refreshFeed(true), detection, theme,
    toast, dismissToast: () => setToast(null),
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
