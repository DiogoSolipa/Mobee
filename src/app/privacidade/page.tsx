'use client';
import { SubPage } from '@/components/app/Shell';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

/** "O que guardamos": the short pilot privacy page (Parte 5; formal GDPR work comes after the pilot). */
const COPY = {
  pt: [
    ['Conta', 'O seu nome, email e foto da conta Google, para saber que é você.'],
    ['Google Calendar', 'Acesso só de leitura aos seus calendários. O Mobee lê os eventos de hoje e amanhã e nunca escreve nada. As chaves de acesso ficam cifradas.'],
    ['O seu plano', 'Os itens do dia, as preferências e as propostas de alteração, para o plano estar igual em qualquer dispositivo e no seu assistente.'],
    ['Localização', 'Usada no momento para calcular percursos a partir de onde está. Não guardamos o histórico de onde esteve.'],
    ['Voz', 'O reconhecimento de voz é feito pelo seu browser (no Chrome, pelos servidores da Google). O Mobee só recebe o texto.'],
    ['Link para o assistente', 'Se criar um, guardamos apenas uma impressão digital dele, nunca o link em si. Pode desativá-lo a qualquer momento.'],
    ['Onde', 'Base de dados na União Europeia (Frankfurt). Rotas calculadas pelo Transitous (MOTIS) e locais pela Google.'],
    ['Apagar', 'Em Definições → "Apagar a conta e todos os dados" apaga tudo de imediato, incluindo o acesso ao Google Calendar.'],
  ],
  en: [
    ['Account', 'Your Google account name, email and picture, to know it is you.'],
    ['Google Calendar', 'Read-only access to your calendars. Mobee reads today’s and tomorrow’s events and never writes anything. Access keys are stored encrypted.'],
    ['Your plan', 'Your day’s items, preferences and change proposals, so the plan is the same on every device and in your assistant.'],
    ['Location', 'Used at the moment to plan routes from where you are. We do not keep a history of where you have been.'],
    ['Voice', 'Speech recognition runs in your browser (in Chrome, on Google’s servers). Mobee only receives the text.'],
    ['Assistant link', 'If you create one, we keep only a fingerprint of it, never the link itself. You can turn it off at any time.'],
    ['Where', 'Database in the European Union (Frankfurt). Routes from Transitous (MOTIS), places from Google.'],
    ['Delete', 'Settings → "Delete my account and all data" erases everything immediately, including Google Calendar access.'],
  ],
} as const;

export default function PrivacyPage() {
  const { state } = useStore();
  const lang = state.settings.lang;
  return (
    <SubPage title={t(lang, 'privacy.title')}>
      <section className="card stack">
        {COPY[lang].map(([h, body]) => (
          <div key={h}>
            <h2 className="h2" style={{ marginBottom: 4 }}>{h}</h2>
            <p className="small muted" style={{ margin: 0 }}>{body}</p>
          </div>
        ))}
      </section>
    </SubPage>
  );
}
