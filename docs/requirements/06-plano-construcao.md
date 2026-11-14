# Plano de construção (v2)

Cada fase termina com algo que um tester consegue usar. A ordem segue o risco: primeiro o que muda o modelo de dados, depois o que dá valor, por fim os canais.

## Fase 0: Fundações (feita, branch `v2/fase-0`)

Objetivo: contas e dados no servidor, sem mudar a experiência.

- [x] Auth com Google via Better Auth (`calendar.readonly`, `access_type=offline`, `prompt=select_account consent`), tokens cifrados em repouso. Falta pôr a app OAuth em "In production" na Google Cloud (V2-21).
- [x] Postgres UE (Neon, Frankfurt) + Drizzle. Migrações em `/drizzle`, aplicadas por `scripts/migrate.mjs` antes de cada build na Vercel (`npm run db:migrate` localmente, branch `dev`).
- [x] Tabelas: as 4 da Better Auth (`user`, `session`, `account` com os tokens Google, `verification`), `user_state` e `access_token`. **Mudança face ao plano:** o plano é um documento JSON por pessoa (`user_state`, com `version` para concorrência otimista) em vez de uma tabela `items`. O reducer fica igual e a migração para linhas fica para quando for preciso consultar itens no servidor. `place_prefs`, `push_subscriptions`, `events` e `feedback` entram nas fases que os usam.
- [x] `load`/`save` na store: cache local sempre e servidor quando há sessão (`/api/state`, PUT com `baseVersion`, 409 = o servidor ganha). Primeiro login num dispositivo com plano local → o plano sobe para a conta.
- [x] Modelo: `Stop` ganha `source`, `kind`, `category`, `optional`, `done`, `calendarEventId` (todos opcionais, planos v1 continuam a carregar).
- [x] Motor: origem = localização atual (`here` → stop virtual `HERE_ID`), salvo se houver um item a decorrer (V2-05). Itens `done` ficam de fora. Itens `optional` são os primeiros a passar para amanhã (V2-04).
- [x] Link de acesso pessoal (V2-66): `/api/access-link` (só com sessão), `/acesso/<token>` (cookie httpOnly), `Authorization: Bearer` para APIs/MCP. Guarda-se só o SHA-256.
- [x] "Apagar tudo" apaga a conta no servidor (cascata) e só funciona a partir da app, nunca pelo link do agente. Página `/privacidade`.

## Fase 1: O loop com texto

Objetivo: um tester liga o Google, escreve o dia e recebe o próximo passo. Texto primeiro porque é o mesmo pipeline que a voz e que o Instinct usa.

- Sync do Google Calendar (hoje e amanhã) → compromissos (V2-22 a V2-24).
- Endpoint `adicionar(texto)` com interpretador LLM (`INTERPRETER_MODEL`, V2-31 a V2-34, V2-67) e conjunto de frases de teste em pt-PT.
- Cartão de confirmação (V2-43) e correções por texto (V2-08).
- Ecrã "Agora" (V2-40, V2-41) e "Abrir no Google Maps" (V2-42).
- Tarefas com sítio concreto encaixadas pelo motor existente.

## Fase 2: Voz e tarefas de categoria

- Web Speech API em pt-PT atrás de `transcribe()`, com texto editável e fallback para escrita (V2-26 a V2-30).
- Google Places: candidatos abertos, desvio mínimo no percurso, pergunta "tens alguma preferida?" quando a tarefa está solta, preferidas aprendidas (V2-44, V2-44a, V2-68).
- **Risco:** o Transitous aceita cerca de 720 rotas por dia. Os candidatos são pré-filtrados por distância em linha reta e só os 2–3 melhores são roteados; as rotas ficam em cache.

## Fase 3: Push e conclusão automática

- Web Push (VAPID) atrás de `notify()` e QStash para agendar (V2-62).
- Aviso 10 min antes de sair, push de replan e push das 8h que abre o microfone (V2-35, V2-49, V2-50).
- Chegada = feito, e inferência quando a app abre (V2-45 a V2-48).
- Onboarding de 4 passos (V2-72).

## Fase 4: Canais e feedback

- UI legível por agentes: `aria-label`, `data-action`, URLs estáveis e página `/agente` (V2-65).
- Servidor MCP com as 4 ações canónicas (V2-64), autenticado pelo link pessoal.
- Botão "Isto está mal" e eventos mínimos (V2-70, V2-71).

## Fase 5: Abrir aos testers

- Remover `/api/debug/*`, rever quotas (Places, Transitous, LLM) e enviar o link.

## TO BE (depois do piloto)

Dashboard de métricas · app nativa (Expo) com geofences, App Intents e widget · Whisper no servidor · Outlook / iCloud · MOTIS próprio · RGPD formal · OAuth para MCP.
