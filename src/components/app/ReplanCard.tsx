'use client';
import { Button, Icon } from '@/components/ds';
import { fmt, weekdayShort } from '@/lib/domain/time';
import type { Change, Lang } from '@/lib/domain/types';
import { modeLabel, t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

/** The signature moment: proposal with the diff, Adjust stops / Keep my plan, and the way back. */
export function ReplanCard() {
  const { state, dispatch, feed, now } = useStore();
  const { proposal: p, proposalState, settings } = state;
  const lang = settings.lang;
  if (!p || !proposalState) return null;

  const stopCount = p.changes.filter((c) => c.kind !== 'leg').length;

  if (proposalState === 'accepted') {
    const text = stopCount === 0 ? t(lang, 'replan.doneRoute') : stopCount === 1 ? t(lang, 'replan.done1') : t(lang, 'replan.done', { n: stopCount });
    const canUndo = !!state.undo && state.undo.date === now.date && now.minutes < state.undo.deadline;
    return (
      <section className="mb-replan mb-replan--done" role="status">
        <div className="mb-replan__done">
          <span className="mb-replan__badge mb-replan__badge--ok"><Icon name="check" size={20} /></span>
          <span>{text}</span>
        </div>
        {canUndo ? <Button variant="quiet" icon="undo" onClick={() => dispatch({ type: 'undo' })}>{t(lang, 'replan.undo')}</Button> : null}
      </section>
    );
  }

  if (proposalState === 'kept') {
    return (
      <section className="mb-replan mb-replan--done mb-replan--kept" role="status">
        <div className="mb-replan__done mb-replan__done--kept"><span>{t(lang, 'replan.kept')}</span></div>
        <Button variant="quiet" onClick={() => dispatch({ type: 'reopen' })}>{t(lang, 'replan.see')}</Button>
      </section>
    );
  }

  // Open proposal
  const allDisruptions = [...(feed?.disruptions ?? []), ...state.demo.disruptions];
  const late = p.triggers.reduce((a, x) => (x.kind === 'late' ? a + x.minutes : a), 0);
  const titleKey = late ? 'replan.title.late' : p.triggers.some((x) => x.kind === 'disruption') ? 'replan.title.disruption' : 'replan.title.rain';
  const reasons: string[] = [];
  if (late) {
    const inProgress = state.stops.find((s) => s.date === p.date && s.start <= now.minutes && s.start + s.duration > now.minutes);
    reasons.push(inProgress ? t(lang, 'replan.reason.lateStop', { stop: inProgress.title, n: late }) : t(lang, 'replan.reason.late', { n: late }));
  }
  for (const tr of p.triggers) {
    if (tr.kind === 'disruption') {
      const d = allDisruptions.find((x) => x.id === tr.disruptionId);
      const h = d && (lang === 'pt' ? d.header.pt ?? d.header.en : d.header.en ?? d.header.pt);
      if (h) reasons.push(h.endsWith('.') ? h : `${h}.`);
    }
    if (tr.kind === 'rain') reasons.push(t(lang, 'replan.reason.rain'));
  }
  const protectedStops = state.stops.filter((s) => p.protectedStopIds.includes(s.id) && !p.atRisk.some((r) => r.stopId === s.id));
  const atRisk = p.atRisk.map((r) => ({ ...r, stop: state.stops.find((s) => s.id === r.stopId)! })).filter((r) => r.stop);
  const titleId = `replan-${p.id}`;

  return (
    <section className="mb-replan" aria-labelledby={titleId} aria-live="polite">
      <div className="mb-replan__head">
        <span className={`mb-replan__badge${atRisk.length ? ' mb-replan__badge--risk' : ''}`}><Icon name={atRisk.length ? 'alert' : 'replan'} size={20} /></span>
        <div>
          <h2 className="mb-replan__title" id={titleId}>{t(lang, titleKey)}</h2>
          <p className="mb-replan__body">{reasons.join(' ')}</p>
        </div>
      </div>
      {state.proposalUpdated ? <p className="mb-replan__why" style={{ marginTop: 12 }}>{t(lang, 'replan.updated')}</p> : null}
      {p.changes.length ? (
        <ul className="mb-diff">
          {p.changes.map((c, i) => <DiffRow key={i} c={c} lang={lang} />)}
        </ul>
      ) : <div style={{ height: 12 }} />}
      {atRisk.map((r) => (
        <p key={r.stopId} className="mb-replan__risk"><Icon name="alert" size={18} />{t(lang, 'replan.atRisk', { stop: r.stop.title, time: fmt(r.stop.start), n: r.lateBy })}</p>
      ))}
      {protectedStops.slice(0, 2).map((s) => (
        <p key={s.id} className="mb-replan__protected"><Icon name="check" size={18} />{t(lang, 'replan.protected', { stop: s.title, time: fmt(s.start) })}</p>
      ))}
      <p className="mb-replan__why">{t(lang, `replan.why.${p.priority}` as const)}</p>
      <div className="mb-replan__actions">
        <Button variant="primary" onClick={() => dispatch({ type: 'accept' })}>{t(lang, 'replan.adjust')}</Button>
        <Button variant="quiet" onClick={() => dispatch({ type: 'keep' })}>{t(lang, 'replan.keep')}</Button>
      </div>
    </section>
  );
}

function DiffRow({ c, lang }: { c: Change; lang: Lang }) {
  const sr = (k: 'replan.from' | 'replan.to') => <span className="mb-sr">{t(lang, k)} </span>;
  if (c.kind === 'leg') {
    return (
      <li>
        <span className="mb-diff__label">{t(lang, 'replan.legTo', { stop: c.title })}</span>
        <span className="mb-diff__from">{sr('replan.from')}{modeLabel(lang, c.from.mode)}</span>
        <Icon name="arrow" size={16} className="mb-diff__arrow" />
        <span className="mb-diff__to">{sr('replan.to')}{modeLabel(lang, c.to.mode)} {c.to.minutes}′</span>
      </li>
    );
  }
  const to = c.kind === 'day' ? `${weekdayShort(c.toDate, lang)} ${fmt(c.to)}` : fmt(c.to);
  return (
    <li>
      <span className="mb-diff__label">{c.title}</span>
      <span className="mb-diff__from">{sr('replan.from')}{fmt(c.from)}</span>
      <Icon name="arrow" size={16} className="mb-diff__arrow" />
      <span className="mb-diff__to">{sr('replan.to')}{to}</span>
    </li>
  );
}
