'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Lang } from '@/lib/domain/types';
import { Button, Chip } from '@/components/ds';
import { PLACES, PLACE_BY_ID } from '@/lib/domain/places';
import { addDays, fmt, parseHHMM } from '@/lib/domain/time';
import type { ContextKey, FlexWindow, Minutes, Stop } from '@/lib/domain/types';
import { DAY_START } from '@/lib/engine/replan';
import { endOf, stopsOn } from '@/lib/engine/schedule';
import { contextName, t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button, select')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2 className="sheet__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** FR-09: "I'm leaving later" in one tap. */
export function LateSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const lang = state.settings.lang;
  const [custom, setCustom] = useState('');
  const go = (n: number) => { if (n > 0) { dispatch({ type: 'late', minutes: n }); onClose(); } };
  return (
    <Sheet title={t(lang, 'late.title')} onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>{t(lang, 'late.body')}</p>
      <div className="chips">
        {[10, 20, 30, 45].map((n) => <button key={n} type="button" className="mb-chip" onClick={() => go(n)}>+{n} min</button>)}
      </div>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); go(Number(custom)); }}>
        <label className="field"><span>{t(lang, 'late.custom')}</span>
          <input inputMode="numeric" pattern="[0-9]*" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </label>
        <Button variant="primary" size="lg" block type="submit" disabled={!Number(custom)}>{t(lang, 'late.go')}</Button>
      </form>
    </Sheet>
  );
}

type When = 'set' | FlexWindow['kind'];

/** Place a flexible stop in the first free gap inside its window (FR-03). */
function placeFlexible(stops: Stop[], date: string, from: Minutes, to: Minutes, duration: number): Minutes {
  const day = stopsOn(stops, date);
  let t0 = from;
  for (const s of day) {
    if (endOf(s) + 15 <= t0) continue;
    if (t0 + duration + 15 <= s.start) break;
    t0 = Math.max(t0, endOf(s) + 15);
  }
  return Math.min(t0, Math.max(from, to - duration));
}

export function StopSheet({ stop, onClose }: { stop: Stop | null; onClose: () => void }) {
  const { state, dispatch, now } = useStore();
  const lang = state.settings.lang;
  const today = now.date;
  const editing = !!stop;
  const [title, setTitle] = useState(stop?.title ?? '');
  const initialPlace = stop ? (() => {
    const p = stop.placeId ? PLACE_BY_ID[stop.placeId] : undefined;
    const lat = stop.lat ?? p?.lat, lon = stop.lon ?? p?.lon;
    return lat !== undefined && lon !== undefined ? { name: stop.placeName, lat, lon, placeId: stop.placeId } : null;
  })() : null;
  const [place, setPlace] = useState<ChosenPlace | null>(initialPlace);
  const [date, setDate] = useState(stop?.date ?? today);
  const [time, setTime] = useState(fmt(stop?.start ?? Math.min(23 * 60, Math.ceil((now.minutes + 30) / 15) * 15)));
  const [duration, setDuration] = useState(stop?.duration ?? 30);
  const [context, setContext] = useState<ContextKey>(stop?.context ?? 'errand');
  const [fixed, setFixed] = useState(stop?.fixed ?? false);
  const [when, setWhen] = useState<When>(stop?.flex?.kind ?? 'set');
  const [from, setFrom] = useState(fmt(stop?.flex?.from ?? 14 * 60));
  const [to, setTo] = useState(fmt(stop?.flex?.to ?? 17 * 60));
  const [deadline, setDeadline] = useState(stop?.flex?.deadline ?? addDays(today, 3));
  const [note, setNote] = useState(stop?.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = title.trim().length > 0 && !!place && (when !== 'set' || parseHHMM(time) !== null);

  function save() {
    if (!valid || !place) return;
    const others = state.stops.filter((s) => s.id !== stop?.id);
    let start = parseHHMM(time) ?? DAY_START;
    let flex: FlexWindow | undefined;
    if (when === 'today') {
      flex = { kind: 'today' };
      start = placeFlexible(others, date, date === today ? Math.max(now.minutes + 15, DAY_START) : DAY_START, 21 * 60, duration);
    } else if (when === 'window') {
      const f = parseHHMM(from) ?? 14 * 60, tt = parseHHMM(to) ?? 17 * 60;
      flex = { kind: 'window', from: f, to: tt };
      start = placeFlexible(others, date, date === today ? Math.max(f, now.minutes + 15) : f, tt, duration);
    } else if (when === 'before') {
      flex = { kind: 'before', deadline };
      start = placeFlexible(others, date, date === today ? Math.max(now.minutes + 15, DAY_START) : DAY_START, 21 * 60, duration);
    }
    const next: Stop = {
      id: stop?.id ?? `s_${Date.now().toString(36)}`,
      title: title.trim(),
      placeId: place.placeId,
      placeName: place.name,
      lat: place.lat,
      lon: place.lon,
      date, start, duration, context,
      fixed: when === 'set' ? fixed : false,
      flex,
      note: note.trim() || undefined,
      previous: undefined,
    };
    dispatch({ type: 'upsertStop', stop: next });
    onClose();
  }

  return (
    <Sheet title={editing ? t(lang, 'edit') : t(lang, 'add')} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="field"><span>{t(lang, 'field.title')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} autoComplete="off" />
        </label>
        <PlacePicker lang={lang} value={place} onChange={setPlace} />
        <div className="field__row">
          <label className="field"><span>{t(lang, 'field.date')}</span>
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {[0, 1, 2, 3, 4, 5, 6].map((n) => { const d = addDays(today, n); return <option key={d} value={d}>{n === 0 ? t(lang, 'today') : n === 1 ? t(lang, 'tomorrow') : d}</option>; })}
            </select>
          </label>
          <label className="field"><span>{t(lang, 'field.duration')}</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[10, 15, 20, 30, 45, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{t(lang, 'min', { n })}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span>{t(lang, 'field.when')}</span>
          <select value={when} onChange={(e) => setWhen(e.target.value as When)}>
            <option value="set">{t(lang, 'field.when.set')}</option>
            <option value="today">{t(lang, 'field.when.today')}</option>
            <option value="window">{t(lang, 'field.when.window')}</option>
            <option value="before">{t(lang, 'field.when.before')}</option>
          </select>
        </label>
        {when === 'set' ? (
          <>
            <label className="field"><span>{t(lang, 'field.time')}</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={300} />
            </label>
            <label className="toggle">
              <span>{t(lang, 'field.fixed')}<small>{t(lang, 'field.fixedHint')}</small></span>
              <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
            </label>
          </>
        ) : <p className="small muted" style={{ margin: 0 }}>{t(lang, 'field.flexHint')}</p>}
        {when === 'window' ? (
          <div className="field__row">
            <label className="field"><span>{t(lang, 'field.from')}</span><input type="time" value={from} onChange={(e) => setFrom(e.target.value)} step={900} /></label>
            <label className="field"><span>{t(lang, 'field.to')}</span><input type="time" value={to} onChange={(e) => setTo(e.target.value)} step={900} /></label>
          </div>
        ) : null}
        {when === 'before' ? (
          <label className="field"><span>{t(lang, 'field.deadline')}</span><input type="date" value={deadline} min={today} onChange={(e) => setDeadline(e.target.value)} /></label>
        ) : null}
        <div className="field"><span>{t(lang, 'field.context')}</span>
          <div className="chips">
            {(['work', 'home', 'errand', 'self'] as ContextKey[]).map((c) => (
              <Chip key={c} context={c} selected={context === c} onToggle={() => setContext(c)}>{contextName(lang, c, state.settings.contextNames)}</Chip>
            ))}
          </div>
        </div>
        <label className="field"><span>{t(lang, 'field.note')}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>
        <Button variant="primary" size="lg" block type="submit" disabled={!valid}>{t(lang, 'save')}</Button>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Button variant="quiet" onClick={onClose}>{t(lang, 'cancel')}</Button>
          {editing ? (
            <Button variant="danger" onClick={() => { if (confirmDelete) { dispatch({ type: 'deleteStop', id: stop!.id }); onClose(); } else setConfirmDelete(true); }}>
              {confirmDelete ? t(lang, 'delete.confirm') : t(lang, 'delete')}
            </Button>
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}

interface ChosenPlace { name: string; lat: number; lon: number; placeId?: string }
interface PlaceHit { id: string; name: string; area?: string; lat: number; lon: number }

/** Place search: saved places first, then the trip planner's geocoder (OpenStreetMap + transit stops) around Lisbon. */
function PlacePicker({ lang, value, onChange }: { lang: Lang; value: ChosenPlace | null; onChange: (p: ChosenPlace | null) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) { setHits([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { results?: PlaceHit[] };
        setHits(json.results ?? []);
      } catch { /* aborted or offline */ } finally { setBusy(false); }
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);
  const label = (p: { name: string; area?: string }) => `${p.name}${p.area && p.area !== p.name ? ` · ${p.area}` : ''}`;
  const saved = PLACES.filter((p) => !q.trim() || label(p).toLowerCase().includes(q.trim().toLowerCase())).slice(0, q.trim() ? 4 : 6);
  return (
    <div className="field">
      <span>{t(lang, 'field.place')}</span>
      {value ? (
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <span><strong>{value.name}</strong></span>
          <button type="button" className="mb-btn mb-btn--quiet" onClick={() => onChange(null)}>{t(lang, 'edit')}</button>
        </div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, 'field.placeSearch')} autoComplete="off" aria-label={t(lang, 'field.placeSearch')} />
          <ul className="places">
            {saved.map((p) => (
              <li key={p.id}><button type="button" onClick={() => onChange({ name: label(p), lat: p.lat!, lon: p.lon!, placeId: p.id })}>{p.name}<small>{p.area} · {t(lang, 'field.placeSaved')}</small></button></li>
            ))}
            {hits.map((h) => (
              <li key={h.id}><button type="button" onClick={() => onChange({ name: label(h), lat: h.lat, lon: h.lon })}>{h.name}{h.area ? <small>{h.area}</small> : null}</button></li>
            ))}
          </ul>
          {q.trim().length >= 3 && !busy && !hits.length ? <p className="small muted" style={{ margin: 0 }}>{t(lang, 'field.placeNone')}</p> : null}
        </>
      )}
    </div>
  );
}
