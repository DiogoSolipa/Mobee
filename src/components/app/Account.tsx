'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ds';
import { authClient, connectCalendar, signInWithGoogle } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

/** Settings → Account: Google sign-in (V2-20) and the personal access link for assistants (V2-66). */
export function AccountSection() {
  const { state, account } = useStore();
  const lang = state.settings.lang;

  if (account.status === 'loading') return <section className="card stack" aria-busy="true"><h2 className="h2">{t(lang, 'account.title')}</h2></section>;
  if (account.status === 'unavailable') {
    return (
      <section className="card stack">
        <h2 className="h2">{t(lang, 'account.title')}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t(lang, 'account.unavailable')}</p>
      </section>
    );
  }
  if (account.status === 'signed-out') {
    return (
      <section className="card stack">
        <h2 className="h2">{t(lang, 'account.title')}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t(lang, 'account.signInHint')}</p>
        <Button variant="primary" block data-action="sign-in" aria-label={t(lang, 'account.signIn')} onClick={() => signInWithGoogle('/settings')}>
          {t(lang, 'account.signIn')}
        </Button>
      </section>
    );
  }

  const signOut = async () => {
    await authClient.signOut().catch(() => undefined);
    // The access-link cookie is httpOnly: only the server can clear it, and DELETE /api/state is not sign-out.
    window.location.href = '/app';
  };

  return (
    <>
      <section className="card stack">
        <h2 className="h2">{t(lang, 'account.title')}</h2>
        <p className="small" style={{ margin: 0 }}>
          {account.via === 'token' ? t(lang, 'account.viaLink') : t(lang, 'account.signedInAs', { email: account.user?.email ?? '' })}
        </p>
        {account.via === 'session' ? (
          account.calendar ? (
            <p className="small muted" style={{ margin: 0 }}>{t(lang, 'account.calendarOn')}</p>
          ) : (
            <>
              <p className="small" style={{ margin: 0 }}>{t(lang, 'account.calendarOff')}</p>
              <Button variant="primary" data-action="connect-calendar" aria-label={t(lang, 'account.calendarConnect')} onClick={() => connectCalendar('/settings')}>
                {t(lang, 'account.calendarConnect')}
              </Button>
            </>
          )
        ) : null}
        {account.sync === 'error' ? <p className="small muted" role="status" style={{ margin: 0 }}>{t(lang, 'account.syncError')}</p> : null}
        {account.via === 'session' ? <Button data-action="sign-out" onClick={signOut}>{t(lang, 'account.signOut')}</Button> : null}
      </section>
      {account.via === 'session' ? <AgentLink /> : null}
    </>
  );
}

function AgentLink() {
  const { state } = useStore();
  const lang = state.settings.lang;
  const [status, setStatus] = useState<{ active: boolean; lastUsedAt: string | null } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const r = await fetch('/api/access-link', { cache: 'no-store' });
    if (r.ok) setStatus(await r.json());
  };
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/access-link', { method: 'POST' });
      if (r.ok) { setFresh(((await r.json()) as { url: string }).url); setCopied(false); await refresh(); }
    } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true);
    try { await fetch('/api/access-link', { method: 'DELETE' }); setFresh(null); await refresh(); } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!fresh) return;
    try { await navigator.clipboard.writeText(fresh); setCopied(true); } catch { /* the text is selectable anyway */ }
  };

  const when = status?.lastUsedAt
    ? new Date(status.lastUsedAt).toLocaleString(lang === 'pt' ? 'pt-PT' : 'en-GB', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' })
    : t(lang, 'agent.never');

  return (
    <section className="card stack">
      <h2 className="h2">{t(lang, 'agent.title')}</h2>
      <p className="small muted" style={{ margin: 0 }}>{t(lang, 'agent.hint')}</p>
      {fresh ? (
        <>
          <input className="field" readOnly value={fresh} aria-label={t(lang, 'agent.title')} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: 'monospace', fontSize: 13 }} />
          <p className="small muted" style={{ margin: 0 }}>{t(lang, 'agent.shownOnce')}</p>
          <Button variant="primary" data-action="copy-agent-link" onClick={copy}>{copied ? t(lang, 'agent.copied') : t(lang, 'agent.copy')}</Button>
        </>
      ) : status?.active ? (
        <p className="small" style={{ margin: 0 }}>{t(lang, 'agent.active', { when })}</p>
      ) : null}
      <Button data-action="create-agent-link" disabled={busy} onClick={create}>{status?.active ? t(lang, 'agent.regenerate') : t(lang, 'agent.create')}</Button>
      {status?.active ? <Button variant="quiet" data-action="revoke-agent-link" disabled={busy} onClick={revoke}>{t(lang, 'agent.revoke')}</Button> : null}
    </section>
  );
}
