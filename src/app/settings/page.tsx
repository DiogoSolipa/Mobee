'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AccountSection } from '@/components/app/Account';
import { SubPage } from '@/components/app/Shell';
import { Button, Chip, Dot, Segmented } from '@/components/ds';
import type { ContextKey, Lang, Priority, Settings, TravelRules } from '@/lib/domain/types';
import { contextName, t } from '@/lib/i18n';
import { authClient } from '@/lib/auth-client';
import { clearLocal, useStore } from '@/lib/store';

export default function SettingsPage() {
  const { state, dispatch, hydrated, account } = useStore();
  const s = state.settings;
  const lang = s.lang;
  const [confirm, setConfirm] = useState(false);
  if (!hydrated) return <main className="app" aria-busy="true" />;
  const set = (patch: Partial<Settings>) => dispatch({ type: 'settings', patch });
  const rule = (k: keyof TravelRules) => (v: boolean) => set({ rules: { ...s.rules, [k]: v } });
  const signedIn = account.status === 'signed-in';
  // "Apagar tudo": with an account, the server copy goes too (account, Google tokens, plan, access links).
  const erase = async () => {
    if (!confirm) { setConfirm(true); return; }
    setConfirm(false);
    if (account.via === 'session') {
      const r = await fetch('/api/state', { method: 'DELETE' }).catch(() => null);
      if (!r?.ok) return;
      await authClient.signOut().catch(() => undefined);
      clearLocal();
      window.location.href = '/app';
      return;
    }
    dispatch({ type: 'erase' });
  };

  return (
    <SubPage title={t(lang, 'settings.title')}>
      <AccountSection />

      <section className="card stack">
        <label className="field"><span>{t(lang, 'settings.name')}</span>
          <input value={s.name} onChange={(e) => set({ name: e.target.value.slice(0, 30) })} autoComplete="given-name" />
        </label>
        <Segmented<Lang> label={t(lang, 'settings.language')} value={lang} onChange={(v) => set({ lang: v })}
          options={[{ value: 'pt', label: 'Português' }, { value: 'en', label: 'English' }]} />
        <Segmented<Settings['theme']> label={t(lang, 'settings.theme')} value={s.theme} onChange={(v) => set({ theme: v })}
          options={[{ value: 'auto', label: t(lang, 'theme.auto') }, { value: 'day', label: t(lang, 'theme.day') }, { value: 'night', label: t(lang, 'theme.night') }]} />
      </section>

      <section className="card stack">
        <Segmented<Priority> label={t(lang, 'priority.label')} value={s.priority} onChange={(v) => set({ priority: v })}
          options={[{ value: 'fastest', label: t(lang, 'priority.fastest') }, { value: 'fewest', label: t(lang, 'priority.fewest') }, { value: 'calm', label: t(lang, 'priority.calm') }]} />
        <div>
          <h2 className="h2">{t(lang, 'settings.rules')}</h2>
          <p className="small muted" style={{ margin: '4px 0 12px' }}>{t(lang, 'settings.rulesHint')}</p>
          <div className="chips">
            <Chip icon="walk" selected={s.rules.walkUnder10} onToggle={rule('walkUnder10')}>{t(lang, 'rule.walkUnder10')}</Chip>
            <Chip icon="route" selected={s.rules.avoidHills} onToggle={rule('avoidHills')}>{t(lang, 'rule.avoidHills')}</Chip>
            <Chip icon="bus" selected={s.rules.busWhenRain} onToggle={rule('busWhenRain')}>{t(lang, 'rule.busWhenRain')}</Chip>
            <Chip icon="check" selected={s.rules.stepFree} onToggle={rule('stepFree')}>{t(lang, 'rule.stepFree')}</Chip>
          </div>
        </div>
      </section>

      <section className="card stack">
        <div>
          <h2 className="h2">{t(lang, 'settings.contexts')}</h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>{t(lang, 'settings.contextsHint')}</p>
        </div>
        {(['work', 'home', 'errand', 'self'] as ContextKey[]).map((k) => (
          <label key={k} className="field">
            <span className="row" style={{ gap: 8 }}><Dot context={k} />{contextName(lang, k, s.contextNames)}</span>
            <input value={contextName(lang, k, s.contextNames)} maxLength={20}
              onChange={(e) => set({ contextNames: { ...s.contextNames, [k]: e.target.value } })} />
          </label>
        ))}
      </section>

      <section className="card stack">
        <label className="toggle">
          <span>{t(lang, 'settings.notifications')}<small>{t(lang, 'settings.notificationsHint')}</small></span>
          <input type="checkbox" checked={s.notifications} onChange={async (e) => {
            const on = e.target.checked;
            set({ notifications: on });
            if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* ignored */ } }
          }} />
        </label>
      </section>

      <section className="card stack">
        <h2 className="h2">{t(lang, 'settings.data')}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t(lang, signedIn ? 'settings.dataHintAccount' : 'settings.dataHint')}</p>
        <Link href="/privacidade" className="small">{t(lang, 'settings.privacy')}</Link>
        <Button variant="danger" data-action="erase-all" onClick={erase}>
          {confirm ? t(lang, 'settings.eraseConfirm') : t(lang, account.via === 'session' ? 'settings.eraseAccount' : 'settings.erase')}
        </Button>
        <p className="small muted" style={{ margin: 0 }}>{t(lang, 'settings.about')}</p>
      </section>
    </SubPage>
  );
}
