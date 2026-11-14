'use client';
import { useMemo, useState } from 'react';
import { ReplanCard } from '@/components/app/ReplanCard';
import { LateSheet, StopSheet } from '@/components/app/Sheets';
import { TopBar } from '@/components/app/Shell';
import { Timeline } from '@/components/app/Timeline';
import { Button, Icon, Segmented } from '@/components/ds';
import { addDays, fmt, lisbonNow, longDate } from '@/lib/domain/time';
import type { Priority, Stop } from '@/lib/domain/types';
import { buildTimeline, endOf, stopsOn } from '@/lib/engine/schedule';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

const VISIBLE = 6; // FR-04: next 5–6 stops, the rest one tap away

export default function Today() {
  const { state, dispatch, hydrated, now, detection, feed, feedError, planner, routing } = useStore();
  const lang = state.settings.lang;
  const [sheet, setSheet] = useState<{ kind: 'stop'; stop: Stop | null } | { kind: 'late' } | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const ctx = useMemo(
    () => ({ rules: state.settings.rules, priority: state.settings.priority, raining: detection.raining, disruptions: detection.relevant }),
    [state.settings.rules, state.settings.priority, detection],
  );
  const today = useMemo(() => buildTimeline(stopsOn(state.stops, now.date), planner, ctx, now.minutes), [state.stops, now, ctx, planner]);
  const tomorrowDate = addDays(now.date, 1);
  const tomorrow = useMemo(
    () => buildTimeline(stopsOn(state.stops, tomorrowDate), planner, { ...ctx, raining: false, disruptions: [] }),
    [state.stops, tomorrowDate, ctx, planner],
  );

  if (!hydrated) return <main className="app" aria-busy="true" />;

  const earlier = today.filter((e) => endOf(e.stop) <= now.minutes);
  const upcoming = today.filter((e) => endOf(e.stop) > now.minutes);
  const visible = showAll ? upcoming : upcoming.slice(0, VISIBLE);
  const hour = Math.floor(now.minutes / 60);
  const greetKey = hour < 12 ? 'greeting.morning' : hour < 19 ? 'greeting.afternoon' : 'greeting.evening';
  const feedsDown = !!feedError || (feed !== null && !feed.health.some((h) => h.ok));
  const proposalOpen = state.proposalState === 'open';
  const empty = state.stops.length === 0;
  const edit = (stop: Stop) => setSheet({ kind: 'stop', stop });

  return (
    <main className="app">
      <TopBar />
      <div>
        <p className="overline">{longDate(now.date, lang)}</p>
        <h1 className="greeting">{t(lang, greetKey, { name: state.settings.name || 'there' })}</h1>
      </div>

      {feedsDown && !empty ? <div className="banner" role="status"><Icon name="alert" size={18} />{t(lang, 'live.unavailable')}</div> : null}
      {state.demo.clock !== null && !empty ? (
        <div className="banner" role="status">
          <Icon name="clock" size={18} />
          <span style={{ flex: 1 }}>{t(lang, 'demo.clockBanner', { time: fmt(now.minutes) })}</span>
          <button type="button" className="mb-btn mb-btn--quiet" style={{ minHeight: 32, padding: '0 8px' }} onClick={() => dispatch({ type: 'demoClock', minutes: null })}>{t(lang, 'demo.clockReal')}</button>
        </div>
      ) : null}
      {routing.error && !empty ? <div className="banner" role="status"><Icon name="route" size={18} />{t(lang, 'route.down')}</div> : null}

      <div id="proposal"><ReplanCard /></div>

      {empty ? (
        <section className="card empty">
          <h2>{t(lang, 'empty.title')}</h2>
          <p className="muted">{t(lang, 'empty.body')}</p>
          <div className="stack">
            <Button variant="primary" size="lg" block onClick={() => dispatch({ type: 'loadRita', date: now.date, minutes: lisbonNow().minutes })}>{t(lang, 'empty.demo')}</Button>
            <Button variant="secondary" size="lg" block icon="stop" onClick={() => setSheet({ kind: 'stop', stop: null })}>{t(lang, 'empty.add')}</Button>
          </div>
        </section>
      ) : (
        <>
          <Segmented<Priority>
            label={t(lang, 'priority.label')}
            value={state.settings.priority}
            onChange={(priority) => dispatch({ type: 'settings', patch: { priority } })}
            options={[
              { value: 'fastest', label: t(lang, 'priority.fastest') },
              { value: 'fewest', label: t(lang, 'priority.fewest') },
              { value: 'calm', label: t(lang, 'priority.calm') },
            ]}
          />

          <section className="section" aria-labelledby="h-today">
            <div className="section__head">
              <h2 className="h2" id="h-today">{t(lang, 'today')}</h2>
              {earlier.length ? (
                <button type="button" className="mb-btn mb-btn--quiet" onClick={() => setShowEarlier((v) => !v)} aria-expanded={showEarlier}>
                  {showEarlier ? t(lang, 'hide') : t(lang, 'earlier', { n: earlier.length })}
                </button>
              ) : null}
            </div>
            {showEarlier && earlier.length ? <div style={{ opacity: 0.7 }}><Timeline entries={earlier} onEdit={edit} label={t(lang, 'earlier', { n: earlier.length })} /></div> : null}
            {visible.length ? <Timeline entries={visible} onEdit={edit} label={t(lang, 'today')} /> : <p className="muted">{t(lang, 'day.empty')}</p>}
            {upcoming.length > VISIBLE ? (
              <button type="button" className="mb-btn mb-btn--quiet" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                {showAll ? t(lang, 'hide') : t(lang, 'restOfDay', { n: upcoming.length - VISIBLE })}
              </button>
            ) : null}
          </section>

          {tomorrow.length ? (
            <section className="section" aria-labelledby="h-tomorrow">
              <h2 className="h2" id="h-tomorrow">{t(lang, 'tomorrow')}</h2>
              <Timeline entries={tomorrow} onEdit={edit} label={t(lang, 'tomorrow')} />
            </section>
          ) : null}
        </>
      )}

      {!empty ? (
        <div className="dock">
          <div className="dock__inner">
            <Button variant={proposalOpen ? 'secondary' : 'primary'} size="lg" icon="clock" onClick={() => setSheet({ kind: 'late' })}>{t(lang, 'late.cta')}</Button>
            <Button variant="secondary" size="lg" icon="stop" onClick={() => setSheet({ kind: 'stop', stop: null })}>{t(lang, 'add')}</Button>
          </div>
        </div>
      ) : null}

      {sheet?.kind === 'late' ? <LateSheet onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === 'stop' ? <StopSheet key={sheet.stop?.id ?? 'new'} stop={sheet.stop} onClose={() => setSheet(null)} /> : null}
    </main>
  );
}
