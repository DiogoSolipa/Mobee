'use client';
import { Dot, Icon, StatusPill } from '@/components/ds';
import { fmt, weekdayShort } from '@/lib/domain/time';
import type { Disruption, Lang, Stop } from '@/lib/domain/types';
import type { TimelineEntry } from '@/lib/engine/schedule';
import { contextName, t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

/** The day as a journey: stops (nodes) joined by legs (rails). Walking legs are dashed. */
export function Timeline({ entries, onEdit, label }: { entries: TimelineEntry[]; onEdit: (s: Stop) => void; label: string }) {
  const { state, feed } = useStore();
  const lang = state.settings.lang;
  const disruptions = [...(feed?.disruptions ?? []), ...state.demo.disruptions];
  return (
    <ol className="mb-tl" aria-label={label}>
      {entries.flatMap((e, i) => {
        const items = [];
        if (e.leg) items.push(<LegRow key={`leg-${e.stop.id}`} e={e} lang={lang} disruptions={disruptions} />);
        items.push(<StopRow key={e.stop.id} e={e} first={i === 0 && !e.leg} last={i === entries.length - 1} lang={lang} onEdit={onEdit} />);
        return items;
      })}
    </ol>
  );
}

function LegRow({ e, lang, disruptions }: { e: TimelineEntry; lang: Lang; disruptions: Disruption[] }) {
  const leg = e.leg!;
  const d = leg.disruption ? disruptions.find((x) => x.id === leg.disruption!.id) : undefined;
  const dText = d ? (lang === 'pt' ? d.header.pt ?? d.header.en : d.header.en ?? d.header.pt) : undefined;
  const risk = !!d || e.status === 'at-risk';
  return (
    <li className="mb-tl__item mb-tl__item--leg">
      <span className="mb-tl__time" />
      <span className="mb-tl__rail" aria-hidden="true"><span className={['mb-tl__line', leg.mode === 'walk' && 'mb-tl__line--walk', risk && 'mb-tl__line--risk'].filter(Boolean).join(' ')} /></span>
      <div className={`mb-tl__leg${d ? ' mb-tl__leg--risk' : ''}`}>
        <Icon name={leg.mode} size={18} />
        <span>
          <strong>{t(lang, 'min', { n: leg.minutes })}</strong> · {leg.detail[lang]}
          {dText ? <><br /><span className="mb-sr">Alert: </span>{dText}</> : null}
        </span>
      </div>
    </li>
  );
}

function StopRow({ e, first, last, lang, onEdit }: { e: TimelineEntry; first: boolean; last: boolean; lang: Lang; onEdit: (s: Stop) => void }) {
  const { state } = useStore();
  const s = e.stop;
  const moved = s.previous && (s.previous.start !== s.start || s.previous.date !== s.date);
  const node = e.status === 'at-risk' ? 'at-risk' : moved && e.status === 'moved' ? 'moved' : s.fixed ? 'fixed' : '';
  return (
    <li className={['mb-tl__item', 'mb-tl__item--stop', first && 'is-first', last && 'is-last', first && last && 'is-only'].filter(Boolean).join(' ')}>
      <span className="mb-tl__time">
        {moved && e.status === 'moved' && s.previous ? (
          <span className="mb-tl__was"><span className="mb-sr">was </span>{s.previous.date !== s.date ? weekdayShort(s.previous.date, lang) + ' ' : ''}{fmt(s.previous.start)}</span>
        ) : null}
        {fmt(s.start)}
      </span>
      <span className="mb-tl__rail" aria-hidden="true">
        <span className="mb-tl__line" />
        <span className={`mb-tl__node${node ? ` mb-tl__node--${node}` : ''}`} />
      </span>
      <div className="mb-tl__stop">
        <button type="button" className="mb-tl__stopbtn" onClick={() => onEdit(s)} aria-label={`${t(lang, 'edit')}: ${s.title}, ${fmt(s.start)}`}>
          <span className="mb-tl__title">
            <span>{s.title}</span>
            {e.status === 'at-risk' ? <StatusPill status="at-risk">{t(lang, 'status.late', { n: e.lateBy })}</StatusPill> : null}
            {e.status === 'moved' ? <StatusPill status="moved">{t(lang, 'status.moved')}</StatusPill> : null}
          </span>
          <span className="mb-tl__place">
            <Dot context={s.context} />
            <span>{s.placeName}</span>
            <span aria-hidden="true">·</span>
            <span>{contextName(lang, s.context, state.settings.contextNames)}</span>
          </span>
          {s.fixed ? <span className="mb-tl__fixed"><Icon name="clock" size={14} />{t(lang, 'fixed')}</span> : null}
          {s.flex ? <span className="mb-tl__fixed"><Icon name="swap" size={14} />{t(lang, 'flexible')}</span> : null}
        </button>
      </div>
    </li>
  );
}
