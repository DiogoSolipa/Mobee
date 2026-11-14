# Plano de construção (v2)

Cada fase termina com algo que um tester consegue usar. A ordem segue o risco: primeiro o que muda o modelo de dados, depois o que dá valor, por fim os canais.

## Fase 0: Fundações

Objetivo: contas e dados no servidor, sem mudar a experiência.

- Auth com Google (scope `openid email profile calendar.readonly`, `access_type=offline`). App OAuth em "In production" (V2-21).
- Postgres UE (Neon) + migrações. Tabelas: `users`, `google_tokens` (cifrados), `items`, `place_prefs`, `push_subscriptions`, `events`, `feedback`, `access_tokens`.
- `load`/`save` em `src/lib/store.tsx` passam a chamar a API. O reducer fica igual.
- Modelo: `Stop` ganha `source` (`calendar | voice | text | mcp`), `kind` (`commitment | place_task | category_task`), `category?`, `optional?`, `done?: { at, how }`, `calendarEventId?`.
- Origem = localização atual: um "stop" virtual `aqui-agora` no início de cada cálculo (V2-05).
- Link de acesso pessoal (V2-66), página "o que guardamos" e "Apagar tudo" no servidor.

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
