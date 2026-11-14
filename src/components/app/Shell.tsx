'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, Logo, Notification } from '@/components/ds';
import { fmt, lisbonNow } from '@/lib/domain/time';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export function TopBar() {
  const { state, feed, feedError } = useStore();
  const lang = state.settings.lang;
  const ok = !feedError && feed && feed.health.some((h) => h.ok);
  const simulated = state.demo.disruptions.length > 0 || state.demo.rain || state.demo.clock !== null;
  return (
    <header className="topbar">
      <Link href="/" aria-label="Mobee" style={{ color: 'var(--ink)' }}><Logo size={22} /></Link>
      <div className="row" style={{ gap: 8 }}>
        <Link href="/live" className={`mb-status ${ok ? 'mb-status--on-time' : 'mb-status--at-risk'}`} style={{ textDecoration: 'none', minHeight: 32 }}>
          <Icon name={ok ? 'route' : 'alert'} size={16} />
          {ok ? t(lang, 'live.chip') : t(lang, 'live.chipDown')}
          {simulated ? ` · ${t(lang, 'demo.active')}` : ''}
        </Link>
        <Link href="/settings" className="avatar" aria-label={t(lang, 'settings.title')} style={{ textDecoration: 'none' }}>
          {(state.settings.name || 'M').slice(0, 1).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}

export function ToastHost() {
  const { toast, dismissToast, state } = useStore();
  if (!toast) return null;
  return (
    <div className="toast">
      <a href="#proposal" onClick={dismissToast} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <Notification title={toast.title} body={toast.body} time={fmt(lisbonNow(toast.at).minutes)} onClose={dismissToast} closeLabel={t(state.settings.lang, 'notif.close')} />
      </a>
    </div>
  );
}

export function SubPage({ title, children }: { title: string; children: ReactNode }) {
  const { state } = useStore();
  return (
    <main className="app">
      <header className="topbar">
        <Link href="/" className="mb-btn mb-btn--quiet" style={{ paddingLeft: 8 }}><Icon name="undo" size={20} />{t(state.settings.lang, 'back')}</Link>
        <Logo variant="mark" size={32} />
      </header>
      <h1 className="greeting">{title}</h1>
      {children}
    </main>
  );
}
