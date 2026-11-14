'use client';
import { useMemo } from 'react';
import { Icon } from '@/components/ds';
import { addDays, fmt } from '@/lib/domain/time';
import type { Leg, Stop } from '@/lib/domain/types';
import { active, hereStop } from '@/lib/engine/replan';
import { endOf, stopsOn } from '@/lib/engine/schedule';
import { coordOf } from '@/lib/engine/travel';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

const MODE_ICON: Record<string, 'walk' | 'bus' | 'metro' | 'bike' | 'car' | 'route'> = { walk: 'walk', bus: 'bus', tram: 'bus', metro: 'metro', train: 'metro', ferry: 'route', bike: 'bike', car: 'car' };

/** Google Maps directions to a stop; Maps itself uses the phone's location as the origin (V2-42). */
export function mapsUrl(s: Stop, leg?: Leg): string {
  const c = coordOf(s);
  const destination = c ? `${c.lat},${c.lon}` : s.placeName;
  const mode = leg?.mode === 'walk' ? 'walking' : 'transit';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
}

/**
 * "Agora" (V2-40, V2-41): one action. When to leave, how, and to where — from where you are.
 * The full day stays one swipe below.
 */
export function NowCard() {
  const { state, now, planner, here, detection } = useStore();
  const lang = state.settings.lang;

  const view = useMemo(() => {
    const day = stopsOn(active(state.stops), now.date);
    const current = day.find((s) => s.start <= now.minutes && endOf(s) > now.minutes);
    const next = day.find((s) => s.start > now.minutes || (s !== current && endOf(s) > now.minutes && s.start >= (current ? endOf(current) : 0)));
    const following = next ? day.find((s) => s.start > next.start) : undefined;
    if (!next) return { current, next: undefined, following: undefined, leg: undefined, leaveAt: undefined, fromHere: false };
    if (next.noTravel) return { current, next, following, leg: undefined, leaveAt: next.start, fromHere: false };

    // Origin: where the person is (GPS), else the last physical place they were at today.
    const ctx = { rules: state.settings.rules, priority: state.settings.priority, raining: detection.raining, disruptions: detection.relevant };
    const before = day.filter((s) => s.start < next.start && !s.noTravel && coordOf(s));
    const fromHere = !!here && !current;
    const origin = fromHere ? hereStop(here!, now.date, now.minutes) : current && !current.noTravel ? current : before[before.length - 1];
    if (!origin) return { current, next, following, leg: undefined, leaveAt: undefined, fromHere: false };
    const departGuess = Math.max(current ? endOf(current) : now.minutes, next.start - 25);
    const leg = planner.leg(origin, next, ctx, departGuess);
    const leaveAt = leg.status === 'routed' ? next.start - leg.minutes : undefined;
    return { current, next, following, leg, leaveAt, fromHere };
  }, [state.stops, state.settings.rules, state.settings.priority, now, planner, here, detection]);

  const tomorrowFirst = useMemo(() => stopsOn(active(state.stops), addDays(now.date, 1))[0], [state.stops, now.date]);
  const { current, next, following, leg, leaveAt, fromHere } = view;

  if (!next) {
    return (
      <section className="card now" aria-labelledby="h-now" data-section="now">
        <p className="overline" id="h-now">{t(lang, 'now.title')}</p>
        {current ? <p className="small" style={{ margin: 0 }}>{t(lang, 'now.inProgress', { title: current.title, time: fmt(endOf(current)) })}</p> : null}
        <h2 className="now__headline">{t(lang, 'now.nothing')}</h2>
        {tomorrowFirst ? <p className="small muted" style={{ margin: 0 }}>{t(lang, 'now.tomorrowFirst', { title: tomorrowFirst.title, time: fmt(tomorrowFirst.start) })}</p> : null}
      </section>
    );
  }

  const earliestLeave = current ? endOf(current) : now.minutes;
  const late = leaveAt !== undefined && leaveAt < earliestLeave ? earliestLeave - leaveAt : 0;
  const headline = next.noTravel
    ? `${fmt(next.start)} · ${next.title}`
    : leaveAt === undefined ? `${next.title} ${t(lang, 'now.at', { time: fmt(next.start) })}`
    : leaveAt <= now.minutes + 1 ? t(lang, 'now.leaveNow')
    : t(lang, 'now.leaveAt', { time: fmt(Math.max(leaveAt, earliestLeave)) });
  const place = next.kind === 'category_task' && !coordOf(next) ? t(lang, 'now.toChoose')
    : next.noTravel ? next.placeName || t(lang, 'now.noTrip')
    : !coordOf(next) ? `${next.placeName ? `${next.placeName} · ` : ''}${t(lang, 'now.noPlace')}`
    : next.placeName;

  return (
    <section className="card now" aria-labelledby="h-now" data-section="now" aria-live="polite">
      <p className="overline" id="h-now">{t(lang, 'now.title')}</p>
      {current ? <p className="small muted" style={{ margin: 0 }}>{t(lang, 'now.inProgress', { title: current.title, time: fmt(endOf(current)) })}</p> : null}
      <h2 className="now__headline">{headline}</h2>
      {leg && !next.noTravel ? (
        <p className="now__leg">
          <Icon name={leg.status === 'routed' ? MODE_ICON[leg.mode] ?? 'route' : leg.status === 'pending' ? 'route' : 'alert'} size={20} />
          <span>
            {leg.status === 'routed' ? <><strong>{t(lang, 'min', { n: leg.minutes })}</strong> · {leg.detail[lang]}</> : leg.detail[lang]}
            {fromHere ? <span className="muted"> · {t(lang, 'now.fromHere')}</span> : null}
          </span>
        </p>
      ) : null}
      <p className="now__dest">
        <strong>{next.noTravel ? '' : `${next.title} `}</strong>{next.noTravel ? '' : t(lang, 'now.at', { time: fmt(next.start) })}
        {place ? <span className="muted"> · {place}</span> : null}
      </p>
      {late ? <p className="small" role="status" style={{ margin: 0, color: 'var(--risk, #b3261e)' }}>{t(lang, 'now.lateBy', { n: late })}</p> : null}
      {!next.noTravel && (coordOf(next) || next.placeName) ? (
        <a className="mb-btn mb-btn--secondary mb-btn--md" href={mapsUrl(next, leg)} target="_blank" rel="noopener" data-action="open-maps" aria-label={t(lang, 'now.maps')}>
          <Icon name="route" size={20} /><span>{t(lang, 'now.maps')}</span>
        </a>
      ) : null}
      {following ? <p className="small muted" style={{ margin: 0 }}>→ {fmt(following.start)} · {following.title}</p> : null}
    </section>
  );
}
