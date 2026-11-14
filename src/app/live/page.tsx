'use client';
import { useState } from 'react';
import { SubPage } from '@/components/app/Shell';
import { Button, Icon, StatusPill } from '@/components/ds';
import { fmt, lisbonNow } from '@/lib/domain/time';
import type { Disruption } from '@/lib/domain/types';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

const DEMO = {
  greenDelay: (): Disruption => ({ id: 'demo:green-delay', source: 'demo', operator: 'Metro de Lisboa', lines: ['ml:green'], stops: [], effect: 'delay', delayMin: 12, start: Date.now(), end: Date.now() + 2 * 3600e3, header: { en: 'Green line delayed 12 min', pt: 'Linha Verde com 12 min de atraso' } }),
  greenDown: (): Disruption => ({ id: 'demo:green-down', source: 'demo', operator: 'Metro de Lisboa', lines: ['ml:green'], stops: [], effect: 'no-service', start: Date.now(), end: Date.now() + 2 * 3600e3, header: { en: 'Green line suspended', pt: 'Linha Verde interrompida' } }),
};

export default function Live() {
  const { state, dispatch, feed, feedError, refreshFeed, now, hydrated, routing } = useStore();
  const lang = state.settings.lang;
  const [busy, setBusy] = useState(false);
  if (!hydrated) return <main className="app" aria-busy="true" />;
  const all = [...(feed?.disruptions ?? []), ...state.demo.disruptions];
  const text = (d: Disruption) => (lang === 'pt' ? d.header.pt ?? d.header.en : d.header.en ?? d.header.pt) ?? d.id;

  return (
    <SubPage title={t(lang, 'live.title')}>
      <p className="muted" style={{ margin: 0 }}>{t(lang, 'live.body')}</p>

      <section className="card stack">
        <table className="feeds">
          <thead><tr><th>{t(lang, 'live.source')}</th><th>{t(lang, 'live.status')}</th><th>{t(lang, 'live.items')}</th></tr></thead>
          <tbody>
            {feedError ? (
              <tr><td colSpan={3}><StatusPill status="at-risk">{t(lang, 'live.down')}</StatusPill> <span className="small muted">/api/feeds: {feedError}</span></td></tr>
            ) : null}
            {(feed?.health ?? []).map((h) => (
              <tr key={h.source}>
                <td>{h.label}{h.error ? <div className="small muted">{h.error}</div> : null}</td>
                <td>{h.ok ? <StatusPill status="on-time">{t(lang, 'live.ok')}</StatusPill> : <StatusPill status={h.skipped ? 'moved' : 'at-risk'}>{h.skipped ? t(lang, 'live.skipped') : t(lang, 'live.down')}</StatusPill>}</td>
                <td className="mono">{h.ok ? h.count : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small muted">{feed ? t(lang, 'live.updated', { time: fmt(lisbonNow(feed.generatedAt).minutes) }) : '…'}</span>
          <Button variant="quiet" icon="replan" disabled={busy} onClick={async () => { setBusy(true); await refreshFeed(); setBusy(false); }}>{t(lang, 'live.refresh')}</Button>
        </div>
        {feed?.rainProbability !== undefined ? <p className="small" style={{ margin: 0 }}>{t(lang, 'live.rain', { n: Math.round(feed.rainProbability) })}</p> : null}
      </section>

      <section className="card stack">
        <h2 className="h2">{t(lang, 'live.planner')}</h2>
        <div className="row">
          {routing.error ? <StatusPill status="at-risk">{t(lang, 'live.down')}</StatusPill> : <StatusPill status="on-time">{t(lang, 'live.ok')}</StatusPill>}
          <span className="small mono">{routing.provider ?? '…'}</span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>{t(lang, 'live.plannerBody', { provider: routing.provider ?? 'MOTIS' })}</p>
        {routing.error ? <p className="small" style={{ margin: 0 }}>{routing.error}</p> : null}
      </section>

      <section className="section">
        <h2 className="h2">{t(lang, 'live.disruptions')}</h2>
        {all.length === 0 && !state.demo.rain ? <p className="muted" style={{ margin: 0 }}>{t(lang, 'live.none')}</p> : null}
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {state.demo.rain ? <li className="banner"><Icon name="alert" size={18} />{t(lang, 'demo.rain')} · {t(lang, 'demo.active')}</li> : null}
          {all.slice(0, 30).map((d) => (
            <li key={d.id} className={`banner${d.effect === 'no-service' ? ' banner--alert' : ''}`}>
              <Icon name={d.effect === 'weather' ? 'alert' : 'metro'} size={18} />
              <span>
                <strong>{text(d)}</strong>
                <span className="small muted" style={{ display: 'block' }}>
                  {d.source === 'demo' ? t(lang, 'demo.active') : d.source}{d.lines.length ? ` · ${d.lines.join(', ')}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack" aria-labelledby="h-demo">
        <h2 className="h2" id="h-demo">{t(lang, 'demo.title')}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t(lang, 'demo.body')}</p>
        <div className="row">
          <span className="small" style={{ fontWeight: 600 }}>{t(lang, 'demo.clock')}: <span className="mono">{fmt(now.minutes)}</span></span>
        </div>
        <div className="chips">
          <button type="button" className="mb-chip" aria-pressed={state.demo.clock === null} onClick={() => dispatch({ type: 'demoClock', minutes: null })}>{t(lang, 'demo.clockReal')}</button>
          <button type="button" className="mb-chip" onClick={() => dispatch({ type: 'demoClock', minutes: 10 * 60 + 12 })}>{t(lang, 'demo.clockSet')}</button>
          <button type="button" className="mb-chip" onClick={() => dispatch({ type: 'demoClock', minutes: Math.min(1439, now.minutes + 15) })}>{t(lang, 'demo.plus15')}</button>
        </div>
        <div className="chips">
          <button type="button" className="mb-chip" onClick={() => dispatch({ type: 'demoEvent', disruption: DEMO.greenDelay() })}>{t(lang, 'demo.greenDelay')}</button>
          <button type="button" className="mb-chip" onClick={() => dispatch({ type: 'demoEvent', disruption: DEMO.greenDown() })}>{t(lang, 'demo.greenDown')}</button>
          <button type="button" className="mb-chip" aria-pressed={state.demo.rain} onClick={() => dispatch({ type: 'demoRain', on: !state.demo.rain })}>{t(lang, 'demo.rain')}</button>
        </div>
        <div className="row">
          <Button variant="quiet" onClick={() => dispatch({ type: 'demoClear' })}>{t(lang, 'demo.clear')}</Button>
          <Button variant="quiet" onClick={() => dispatch({ type: 'loadRita', date: now.date })}>{t(lang, 'demo.reset')}</Button>
        </div>
      </section>
    </SubPage>
  );
}
