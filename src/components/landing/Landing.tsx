'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, Dot, Icon, Logo, StatusPill, type ContextKey, type IconName } from '@/components/ds';
import { fmt, lisbonNow } from '@/lib/domain/time';
import type { Lang } from '@/lib/domain/types';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { COPY } from './copy';

const DEMO_HREF = '/app?demo=rita';

export function Landing() {
  const { state, dispatch, feed } = useStore();
  const lang = state.settings.lang;
  const c = COPY[lang];
  const setLang = (l: Lang) => dispatch({ type: 'settings', patch: { lang: l } });

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav__inner">
          <Link href="/" aria-label="Mobee" className="lp-nav__logo"><Logo size={24} /></Link>
          <nav className="lp-nav__links" aria-label="Secções">
            <a href="#chaos">{c.nav.how}</a>
            <a href="#rita">{c.nav.rita}</a>
            <a href="#data">{c.nav.live}</a>
          </nav>
          <div className="lp-nav__right">
            <div className="lp-lang" role="group" aria-label="Língua / Language">
              <button type="button" aria-pressed={lang === 'pt'} onClick={() => setLang('pt')}>PT</button>
              <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            </div>
            <Link href={DEMO_HREF} className="mb-btn mb-btn--secondary lp-nav__cta">{c.nav.demo}</Link>
          </div>
        </div>
      </header>

      <main>
        {/* 1. Hero: the shock */}
        <section className="lp-hero" data-theme="night">
          <div className="lp-wrap lp-hero__grid">
            <div className="lp-hero__copy">
              <p className="lp-kicker lp-kicker--honey">{c.hero.kicker}</p>
              <h1 className="lp-h1">{c.hero.title1}<br /><span className="lp-h1__honey">{c.hero.title2}</span></h1>
              <p className="lp-lead">{c.hero.lead}</p>
              <div className="lp-cta-row">
                <Link href={DEMO_HREF} className="mb-btn mb-btn--primary mb-btn--lg">{c.hero.cta}</Link>
                <a href="#chaos" className="mb-btn mb-btn--quiet lp-on-deep">{c.hero.how}</a>
              </div>
              <p className="lp-small lp-muted-deep">{c.hero.ctaSub}</p>
            </div>
            <HeroVisual lang={lang} />
          </div>
          <LiveStrip lang={lang} feed={feed} />
        </section>

        {/* 2. The chaos today vs. with Mobee */}
        <section className="lp-section" id="chaos">
          <div className="lp-wrap lp-two">
            <div>
              <h2 className="lp-h2">{c.chaos.title}</h2>
              <p className="lp-body">{c.chaos.lead}</p>
              <div className="lp-chaos" aria-label={c.chaos.label}>
                <p className="lp-kicker">{c.chaos.label}</p>
                <ol>
                  {c.chaos.steps.map(([time, text], i) => (
                    <li key={time} className={i === c.chaos.steps.length - 1 ? 'is-last' : ''}>
                      <span className="mono">{time}</span><span>{text}</span>
                    </li>
                  ))}
                </ol>
                <p className="lp-small lp-muted">{c.chaos.note}</p>
              </div>
            </div>
            <div className="lp-with">
              <p className="lp-kicker lp-kicker--route">{c.chaos.withTitle}</p>
              <p className="lp-body">{c.chaos.withBody}</p>
              <StaticPrompt lang={lang} />
            </div>
          </div>
        </section>

        {/* 3. Meet Rita */}
        <section className="lp-section lp-section--sunken" id="rita">
          <div className="lp-wrap lp-two">
            <div>
              <p className="lp-kicker">{c.rita.kicker}</p>
              <h2 className="lp-h2">{c.rita.title}</h2>
              <p className="lp-body">{c.rita.body}</p>
              <div className="lp-contexts">
                {(['work', 'home', 'errand', 'self'] as ContextKey[]).map((k) => (
                  <span key={k} className="lp-context"><Dot context={k} />{c.rita.contexts[k]}</span>
                ))}
              </div>
              <p className="lp-small lp-muted">{c.rita.persona}</p>
            </div>
            <RitaDay lang={lang} />
          </div>
        </section>

        {/* 4. Interactive demo */}
        <section className="lp-section" id="demo">
          <div className="lp-wrap">
            <p className="lp-kicker">{c.demo.kicker}</p>
            <h2 className="lp-h2">{c.demo.title}</h2>
            <MiniDemo lang={lang} />
          </div>
        </section>

        {/* 5. How it works */}
        <section className="lp-section lp-section--sunken" id="how">
          <div className="lp-wrap">
            <p className="lp-kicker">{c.how.kicker}</p>
            <h2 className="lp-h2">{c.how.title}</h2>
            <ol className="lp-steps">
              {c.how.steps.map(([title, body], i) => (
                <li key={title} className="lp-card">
                  <span className="lp-step-n">{i + 1}</span>
                  <h3 className="lp-h3">{title}</h3>
                  <p className="lp-body">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 6. Trust */}
        <section className="lp-section">
          <div className="lp-wrap">
            <h2 className="lp-h2">{c.trust.title}</h2>
            <div className="lp-grid4">
              {c.trust.items.map(([title, body], i) => (
                <div key={title} className="lp-card">
                  <Icon name={(['replan', 'clock', 'undo', 'check'] as IconName[])[i]} size={24} className="lp-ico" />
                  <h3 className="lp-h3">{title}</h3>
                  <p className="lp-body">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Live data + honest limits */}
        <section className="lp-section lp-section--sunken" id="data">
          <div className="lp-wrap lp-two">
            <div>
              <p className="lp-kicker">{c.data.kicker}</p>
              <h2 className="lp-h2">{c.data.title}</h2>
              <ul className="lp-sources">
                {c.data.items.map(([name, body]) => (
                  <li key={name}><strong>{name}</strong><span>{body}</span></li>
                ))}
              </ul>
            </div>
            <div className="lp-card lp-limits">
              <h3 className="lp-h3">{c.data.limitsTitle}</h3>
              <ul>{c.data.limits.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          </div>
        </section>

        {/* 8. Final CTA */}
        <section className="lp-final" data-theme="night">
          <div className="lp-wrap lp-final__inner">
            <Logo variant="mark" size={56} />
            <h2 className="lp-h2 lp-on-deep">{c.final.title}</h2>
            <p className="lp-body lp-muted-deep">{c.final.body}</p>
            <Link href={DEMO_HREF} className="mb-btn mb-btn--primary mb-btn--lg">{c.final.cta}</Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__inner">
          <Logo size={18} />
          <p className="lp-small lp-muted">{c.footer}</p>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Live strip: real numbers, never invented ---------- */
function LiveStrip({ lang, feed }: { lang: Lang; feed: ReturnType<typeof useStore>['feed'] }) {
  const c = COPY[lang].live;
  const active = useMemo(() => {
    if (!feed) return null;
    const now = Date.now();
    return feed.disruptions.filter((d) => d.effect !== 'weather' && (d.start === undefined || d.start <= now) && (d.end === undefined || d.end >= now)).length;
  }, [feed]);
  if (!feed || active === null || !feed.health.some((h) => h.ok)) return null;
  return (
    <div className="lp-live" role="status">
      <div className="lp-wrap lp-live__inner">
        <span className="lp-live__dot" aria-hidden="true" />
        <span>{c.prefix} <strong>{c.alerts(active)}</strong>{feed.rainProbability !== undefined ? <> · <strong>{c.rain(Math.round(feed.rainProbability))}</strong></> : null}</span>
        <span className="lp-small lp-muted-deep">{c.sources} · {c.updated(fmt(lisbonNow(feed.generatedAt).minutes))}</span>
      </div>
    </div>
  );
}

/* ---------- Hero visual: four apps' worth of noise, one Mobee proposal ---------- */
function HeroVisual({ lang }: { lang: Lang }) {
  const noise = lang === 'pt'
    ? [['metro', 'Linha Verde: perturbações na circulação'], ['alert', 'Aviso amarelo: chuva em Lisboa'], ['calendar', 'Reunião das 10:00: +30 min'], ['clock', 'Recolha na escola: 12:30']]
    : [['metro', 'Green line: service disrupted'], ['alert', 'Yellow warning: rain in Lisbon'], ['calendar', '10:00 meeting: +30 min'], ['clock', 'School pickup: 12:30']];
  return (
    <div className="lp-hero__visual" aria-hidden="true">
      <div className="lp-noise">
        {noise.map(([icon, text], i) => (
          <div key={text} className="lp-noise__card" style={{ ['--i' as string]: i }}>
            <Icon name={icon as IconName} size={18} /><span>{text}</span>
          </div>
        ))}
      </div>
      <div className="lp-hero__prompt" data-theme="day">
        <StaticPrompt lang={lang} compact />
      </div>
    </div>
  );
}

/* ---------- A static proposal (design-system replan prompt) ---------- */
function StaticPrompt({ lang, compact }: { lang: Lang; compact?: boolean }) {
  const pt = lang === 'pt';
  return (
    <section className={`mb-replan lp-prompt${compact ? ' lp-prompt--compact' : ''}`}>
      <div className="mb-replan__head">
        <span className="mb-replan__badge"><Icon name="replan" size={20} /></span>
        <div>
          <h3 className="mb-replan__title">{t(lang, 'replan.title.late')}</h3>
          <p className="mb-replan__body">{pt ? 'A tua reunião prolongou-se 30 min.' : 'Your meeting ran over by 30 min.'}</p>
        </div>
      </div>
      <ul className="mb-diff">
        <li><span className="mb-diff__label">{pt ? 'Farmácia' : 'Pharmacy'}</span><span className="mb-diff__from">10:30</span><Icon name="arrow" size={16} className="mb-diff__arrow" /><span className="mb-diff__to">10:56</span></li>
        <li><span className="mb-diff__label">{pt ? 'Compras' : 'Groceries'}</span><span className="mb-diff__from">11:15</span><Icon name="arrow" size={16} className="mb-diff__arrow" /><span className="mb-diff__to">{pt ? 'Qua 09:30' : 'Wed 09:30'}</span></li>
      </ul>
      <p className="mb-replan__protected"><Icon name="check" size={18} />{t(lang, 'replan.protected', { stop: pt ? 'Recolha na escola' : 'School pickup', time: '12:30' })}</p>
      {!compact ? (
        <div className="mb-replan__actions">
          <span className="mb-btn mb-btn--primary" aria-hidden="true">{t(lang, 'replan.adjust')}</span>
          <span className="mb-btn mb-btn--quiet" aria-hidden="true">{t(lang, 'replan.keep')}</span>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- Rita's Tuesday ---------- */
interface DayStop { id: string; time: string; title: { pt: string; en: string }; place: string; ctx: ContextKey; fixed?: boolean; flexible?: boolean }
interface DayLeg { to: string; mode: IconName; text: { pt: string; en: string }; walk?: boolean }

const DAY: DayStop[] = [
  { id: 'meeting', time: '09:30', title: { pt: 'Reunião de equipa', en: 'Team meeting' }, place: 'Saldanha', ctx: 'work' },
  { id: 'pharmacy', time: '10:30', title: { pt: 'Farmácia', en: 'Pharmacy' }, place: 'Av. de Roma', ctx: 'errand' },
  { id: 'groceries', time: '11:15', title: { pt: 'Compras', en: 'Groceries' }, place: 'Mercado de Alvalade', ctx: 'errand', flexible: true },
  { id: 'pickup', time: '12:30', title: { pt: 'Recolha na escola', en: 'School pickup' }, place: 'Alvalade', ctx: 'home', fixed: true },
  { id: 'run', time: '18:30', title: { pt: 'Treino de corrida', en: 'Running club' }, place: 'Campo Grande', ctx: 'self' },
  { id: 'dinner', time: '20:15', title: { pt: 'Jantar com a mãe', en: 'Dinner with mum' }, place: 'Campo de Ourique', ctx: 'home' },
];
const LEGS: DayLeg[] = [
  { to: 'pharmacy', mode: 'bus', text: { pt: '16 min · Autocarro 767', en: '16 min · Bus 767' } },
  { to: 'groceries', mode: 'bus', text: { pt: '12 min · Autocarro 735', en: '12 min · Bus 735' } },
  { to: 'pickup', mode: 'walk', text: { pt: '7 min · A pé', en: '7 min · Walk' }, walk: true },
  { to: 'run', mode: 'metro', text: { pt: '13 min · Linha Verde', en: '13 min · Green line' } },
  { to: 'dinner', mode: 'metro', text: { pt: '34 min · Linha Amarela → Autocarro 758', en: '34 min · Yellow line → Bus 758' } },
];

function RitaDay({ lang }: { lang: Lang }) {
  const c = COPY[lang].rita;
  return (
    <div className="lp-card lp-day">
      <h3 className="lp-h3">{c.dayTitle}</h3>
      <DayTimeline lang={lang} stops={DAY} legs={LEGS} />
    </div>
  );
}

function DayTimeline({ lang, stops, legs, moved = {}, legOverride = {} }: { lang: Lang; stops: DayStop[]; legs: DayLeg[]; moved?: Record<string, { from: string; to: string }>; legOverride?: Record<string, DayLeg> }) {
  const c = COPY[lang].rita;
  return (
    <ol className="mb-tl">
      {stops.flatMap((s, i) => {
        const leg = legOverride[s.id] ?? legs.find((l) => l.to === s.id);
        const items = [];
        if (i > 0 && leg) {
          items.push(
            <li key={`leg-${s.id}`} className="mb-tl__item mb-tl__item--leg">
              <span className="mb-tl__time" />
              <span className="mb-tl__rail" aria-hidden="true"><span className={`mb-tl__line${leg.walk ? ' mb-tl__line--walk' : ''}`} /></span>
              <div className="mb-tl__leg"><Icon name={leg.mode} size={18} /><span>{leg.text[lang]}</span></div>
            </li>,
          );
        }
        const m = moved[s.id];
        items.push(
          <li key={s.id} className={['mb-tl__item', 'mb-tl__item--stop', i === 0 && 'is-first', i === stops.length - 1 && 'is-last'].filter(Boolean).join(' ')}>
            <span className="mb-tl__time">{m ? <span className="mb-tl__was">{m.from}</span> : null}{m ? m.to : s.time}</span>
            <span className="mb-tl__rail" aria-hidden="true"><span className="mb-tl__line" /><span className={`mb-tl__node${m ? ' mb-tl__node--moved' : s.fixed ? ' mb-tl__node--fixed' : ''}`} /></span>
            <div className="mb-tl__stop">
              <div className="mb-tl__title"><span>{s.title[lang]}</span>{m ? <StatusPill status="moved">{t(lang, 'status.moved')}</StatusPill> : null}</div>
              <div className="mb-tl__place"><Dot context={s.ctx} /><span>{s.place}</span><span aria-hidden="true">·</span><span>{c.contexts[s.ctx]}</span></div>
              {s.fixed ? <span className="mb-tl__fixed"><Icon name="clock" size={14} />{c.fixed}</span> : null}
              {s.flexible ? <span className="mb-tl__fixed"><Icon name="swap" size={14} />{c.flexible}</span> : null}
            </div>
          </li>,
        );
        return items;
      })}
    </ol>
  );
}

/* ---------- Interactive demo (illustrative, scripted; the real one lives in /app) ---------- */
type Scenario = 'late' | 'metro' | 'rain';
type DemoState = 'open' | 'accepted' | 'kept';

interface ScriptedProposal {
  titleKey: 'replan.title.late' | 'replan.title.disruption' | 'replan.title.rain';
  body: { pt: string; en: string };
  rows: { label: { pt: string; en: string }; from: { pt: string; en: string }; to: { pt: string; en: string } }[];
  moved: Record<string, { from: string; to: string }>;
  legOverride: Record<string, DayLeg>;
  removed?: string;
  stopsChanged: number;
}

const SCRIPT: Record<Scenario, ScriptedProposal> = {
  late: {
    titleKey: 'replan.title.late',
    body: { pt: 'A tua reunião prolongou-se 30 min.', en: 'Your meeting ran over by 30 min.' },
    rows: [
      { label: { pt: 'Farmácia', en: 'Pharmacy' }, from: { pt: '10:30', en: '10:30' }, to: { pt: '10:56', en: '10:56' } },
      { label: { pt: 'Compras', en: 'Groceries' }, from: { pt: '11:15', en: '11:15' }, to: { pt: 'Qua 09:30', en: 'Wed 09:30' } },
    ],
    moved: { pharmacy: { from: '10:30', to: '10:56' } },
    legOverride: { pickup: { to: 'pickup', mode: 'bus', text: { pt: '9 min · Autocarro 735', en: '9 min · Bus 735' } } },
    removed: 'groceries',
    stopsChanged: 2,
  },
  metro: {
    titleKey: 'replan.title.disruption',
    body: { pt: 'Linha Verde com 12 min de atraso.', en: 'Green line delayed 12 min.' },
    rows: [
      { label: { pt: 'Para Treino de corrida', en: 'To Running club' }, from: { pt: 'Metro', en: 'Metro' }, to: { pt: 'Autocarro 767 · 15′', en: 'Bus 767 · 15′' } },
    ],
    moved: {},
    legOverride: { run: { to: 'run', mode: 'bus', text: { pt: '15 min · Autocarro 767', en: '15 min · Bus 767' } } },
    stopsChanged: 0,
  },
  rain: {
    titleKey: 'replan.title.rain',
    body: { pt: 'Chuva a partir das 11h. O percurso a pé passa a autocarro.', en: 'Rain from 11:00. Your walk becomes a bus ride.' },
    rows: [
      { label: { pt: 'Para Recolha na escola', en: 'To School pickup' }, from: { pt: 'A pé', en: 'Walk' }, to: { pt: 'Autocarro · 8′', en: 'Bus · 8′' } },
    ],
    moved: {},
    legOverride: { pickup: { to: 'pickup', mode: 'bus', text: { pt: '8 min · Autocarro 735', en: '8 min · Bus 735' } } },
    stopsChanged: 0,
  },
};

function MiniDemo({ lang }: { lang: Lang }) {
  const c = COPY[lang].demo;
  const [scenario, setScenario] = useState<Scenario>('late');
  const [st, setSt] = useState<DemoState>('open');
  const p = SCRIPT[scenario];
  const applied = st === 'accepted';
  const stops = DAY.slice(0, 5).filter((s) => !(applied && p.removed === s.id));
  const pick = (s: Scenario) => { setScenario(s); setSt('open'); };
  const doneText = p.stopsChanged === 0 ? t(lang, 'replan.doneRoute') : p.stopsChanged === 1 ? t(lang, 'replan.done1') : t(lang, 'replan.done', { n: p.stopsChanged });

  return (
    <div className="lp-demo">
      <div className="lp-demo__controls" role="radiogroup" aria-label={c.title}>
        {(Object.keys(SCRIPT) as Scenario[]).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={scenario === s} className="mb-chip" onClick={() => pick(s)}>
            <Icon name={s === 'late' ? 'clock' : s === 'metro' ? 'metro' : 'alert'} size={18} />{c.scenarios[s]}
          </button>
        ))}
      </div>
      <div className="lp-demo__grid">
        <div className="lp-demo__phone" data-theme="day">
          {st === 'open' ? (
            <section className="mb-replan" aria-live="polite">
              <div className="mb-replan__head">
                <span className="mb-replan__badge"><Icon name="replan" size={20} /></span>
                <div>
                  <h3 className="mb-replan__title">{t(lang, p.titleKey)}</h3>
                  <p className="mb-replan__body">{p.body[lang]}</p>
                </div>
              </div>
              <ul className="mb-diff">
                {p.rows.map((r) => (
                  <li key={r.label.en}><span className="mb-diff__label">{r.label[lang]}</span><span className="mb-diff__from">{r.from[lang]}</span><Icon name="arrow" size={16} className="mb-diff__arrow" /><span className="mb-diff__to">{r.to[lang]}</span></li>
                ))}
              </ul>
              <p className="mb-replan__protected"><Icon name="check" size={18} />{t(lang, 'replan.protected', { stop: lang === 'pt' ? 'Recolha na escola' : 'School pickup', time: '12:30' })}</p>
              <div className="mb-replan__actions">
                <Button variant="primary" onClick={() => setSt('accepted')}>{t(lang, 'replan.adjust')}</Button>
                <Button variant="quiet" onClick={() => setSt('kept')}>{t(lang, 'replan.keep')}</Button>
              </div>
            </section>
          ) : st === 'accepted' ? (
            <section className="mb-replan mb-replan--done" role="status">
              <div className="mb-replan__done"><span className="mb-replan__badge mb-replan__badge--ok"><Icon name="check" size={20} /></span><span>{doneText}</span></div>
              <Button variant="quiet" icon="undo" onClick={() => setSt('open')}>{t(lang, 'replan.undo')}</Button>
            </section>
          ) : (
            <section className="mb-replan mb-replan--done mb-replan--kept" role="status">
              <div className="mb-replan__done mb-replan__done--kept"><span>{t(lang, 'replan.kept')}</span></div>
              <Button variant="quiet" onClick={() => setSt('open')}>{t(lang, 'replan.see')}</Button>
            </section>
          )}
          <div className="lp-demo__day">
            <DayTimeline lang={lang} stops={stops} legs={LEGS} moved={applied ? p.moved : {}} legOverride={applied ? p.legOverride : {}} />
          </div>
        </div>
        <div className="lp-demo__aside">
          <p className="lp-body">{c.note}</p>
          <Link href={DEMO_HREF} className="mb-btn mb-btn--secondary mb-btn--lg">{c.full}</Link>
        </div>
      </div>
    </div>
  );
}
