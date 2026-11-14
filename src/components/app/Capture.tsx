'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ds';
import { signInWithGoogle } from '@/lib/auth-client';
import { fmt } from '@/lib/domain/time';
import type { Stop } from '@/lib/domain/types';
import { draftsToStops, type Draft } from '@/lib/engine/place';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

type Phase =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'review'; drafts: Draft[]; unclear: string[] }
  | { kind: 'error'; message: string };

const newId = () => `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * "Escreve o teu dia" (V2-07, V2-08, V2-43): one box, one card. The same box will take voice in Fase 2
 * and is the entry point agents use (V2-65): type, press Send, check the card, press "Está bom".
 */
export function Capture({ autoFocus = false }: { autoFocus?: boolean }) {
  const { state, dispatch, now, account } = useStore();
  const lang = state.settings.lang;
  const [text, setText] = useState('');
  const [fix, setFix] = useState('');
  const [fixing, setFixing] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const preview: Stop[] = useMemo(() => {
    if (phase.kind !== 'review') return [];
    return draftsToStops(phase.drafts, state.stops, now, phase.drafts.map((_, i) => `preview_${i}`), 'text');
  }, [phase, state.stops, now]);

  if (account.status === 'signed-out' || account.status === 'unavailable') {
    return (
      <section className="card stack" data-section="capture">
        <h2 className="h2">{t(lang, 'capture.title')}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t(lang, 'capture.signIn')}</p>
        {account.status === 'signed-out' ? <Button variant="primary" data-action="sign-in" onClick={() => signInWithGoogle('/app')}>{t(lang, 'account.signIn')}</Button> : null}
      </section>
    );
  }

  const send = async (input: string, previous?: Draft[]) => {
    if (!input.trim()) return;
    setPhase({ kind: 'sending' });
    try {
      const r = await fetch('/api/interpret', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: input, previous }) });
      const j = (await r.json()) as { drafts?: Draft[]; unclear?: string[]; error?: string };
      if (!r.ok) throw new Error(j.error === 'interpreter not configured' ? t(lang, 'capture.notConfigured') : t(lang, 'capture.error'));
      setPhase({ kind: 'review', drafts: j.drafts ?? [], unclear: j.unclear ?? [] });
      setFix('');
      setFixing(false);
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : t(lang, 'capture.error') });
    }
  };

  const confirm = () => {
    if (phase.kind !== 'review') return;
    const ids = phase.drafts.map(() => newId());
    dispatch({ type: 'addStops', stops: draftsToStops(phase.drafts, state.stops, now, ids, 'text') });
    setPhase({ kind: 'idle' });
    setText('');
  };

  const placeLabel = (s: Stop) =>
    s.kind === 'category_task' ? t(lang, 'now.toChoose')
    : s.noTravel ? t(lang, 'now.noTrip')
    : s.lat === undefined ? `${s.placeName} · ${t(lang, 'now.noPlace')}`
    : s.placeName;

  return (
    <section className="card stack" data-section="capture" aria-labelledby="h-capture">
      <h2 className="h2" id="h-capture">{t(lang, 'capture.title')}</h2>

      {phase.kind !== 'review' ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <label className="field">
            <span className="mb-sr">{t(lang, 'capture.title')}</span>
            <textarea
              name="day" value={text} autoFocus={autoFocus} rows={3}
              placeholder={t(lang, 'capture.placeholder')} aria-label={t(lang, 'capture.title')}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(text); } }}
              disabled={phase.kind === 'sending'}
            />
          </label>
          <button type="submit" className="mb-btn mb-btn--primary mb-btn--md" data-action="add-text" disabled={phase.kind === 'sending' || !text.trim()}>
            <span>{phase.kind === 'sending' ? t(lang, 'capture.sending') : t(lang, 'capture.send')}</span>
          </button>
          {phase.kind === 'error' ? <p className="small" role="alert" style={{ margin: 0 }}>{phase.message}</p> : null}
        </form>
      ) : (
        <div className="stack" data-section="confirm">
          <p className="overline" style={{ margin: 0 }}>{t(lang, 'capture.review')}</p>
          {preview.length ? (
            <ul className="confirm-list" aria-label={t(lang, 'capture.review')}>
              {preview.map((s) => (
                <li key={s.id} className="confirm-list__item">
                  <span className="mono confirm-list__time">{fmt(s.start)}</span>
                  <span>
                    <strong>{s.title}</strong>
                    {s.date !== now.date ? <span className="muted"> · {t(lang, 'capture.tomorrow')}</span> : null}
                    {s.optional ? <span className="muted"> · {t(lang, 'capture.optional')}</span> : null}
                    <br /><span className="small muted">{placeLabel(s)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="small" style={{ margin: 0 }}>{t(lang, 'capture.nothing')}</p>}
          {phase.unclear.map((u) => <p key={u} className="small muted" style={{ margin: 0 }}>{t(lang, 'capture.unclear', { text: u })}</p>)}

          {fixing ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); send(fix, phase.drafts); }}>
              <label className="field">
                <span className="mb-sr">{t(lang, 'capture.fix')}</span>
                <textarea name="fix" rows={2} value={fix} autoFocus placeholder={t(lang, 'capture.fixPlaceholder')} aria-label={t(lang, 'capture.fix')} onChange={(e) => setFix(e.target.value)} />
              </label>
              <button type="submit" className="mb-btn mb-btn--primary mb-btn--md" data-action="send-fix" disabled={!fix.trim()}><span>{t(lang, 'capture.send')}</span></button>
            </form>
          ) : (
            <div className="confirm-actions">
              {preview.length ? <Button variant="primary" data-action="confirm-items" onClick={confirm}>{t(lang, 'capture.ok')}</Button> : null}
              <Button data-action="fix-items" onClick={() => setFixing(true)}>{t(lang, 'capture.fix')}</Button>
              <Button variant="quiet" data-action="cancel-items" onClick={() => { setPhase({ kind: 'idle' }); setFixing(false); }}>{t(lang, 'capture.cancel')}</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
