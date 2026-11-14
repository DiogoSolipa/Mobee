# Parte 4: Infra e canais

Estado: **fechado** (2026-11-14). Inclui o que estava previsto como "Parte 5: Canais".

## Contexto

A Vercel serve para experimentar a ideia; o produto final é uma **app nativa**. Tudo o que se constrói agora tem de passar para nativo sem reescrever a lógica.

## Decisões

| Decisão | Valor |
|---|---|
| Login | Só "Entrar com Google" (identidade + Calendar num toque) e link de acesso pessoal (V2-66) |
| Base de dados | Postgres na UE (Neon via Vercel ou Supabase Frankfurt) |
| Agendamento de push | Upstash QStash (uma mensagem agendada por aviso) |
| LLM de interpretação | Configurável por variável de ambiente; modelo leve (Haiku 5.5, Gemini Flash ou equivalente) via AI Gateway |
| RGPD | Formal só depois do piloto. No piloto: página curta "o que guardamos" e "Apagar tudo" |

## Requisitos

### Portabilidade para nativo

- **V2-60** Toda a lógica (motor, interpretação, feeds, Places, calendário) vive no servidor ou em `src/lib` como TypeScript puro, sem dependências de Next/Vercel. A PWA é só um cliente da API.
- **V2-61** A API é o contrato: a futura app nativa (recomendação: Expo/React Native, que reaproveita `src/lib`) fala com os mesmos endpoints.
- **V2-62** Notificações atrás de uma interface `notify(user, message)`. Agora usa Web Push (VAPID); em nativo usa APNs/FCM. O QStash chama `notify` à hora certa e não sabe qual é o canal.
- **V2-63** O que só o nativo resolve fica anotado e não se tenta forçar na PWA: deteção de chegada com a app fechada (geofences), Siri / App Intents, Android App Functions, Live Activities / widget do ecrã bloqueado.

### Ações canónicas (o mesmo conjunto em todos os canais)

- **V2-64** Há quatro ações, implementadas uma vez na API e expostas em todas as superfícies:
  1. `adicionar(texto)`: texto livre, igual ao que sai da voz.
  2. `proximo_passo()`: o que mostra o ecrã "Agora".
  3. `ver_dia(data)`: o plano completo.
  4. `responder_proposta(id, aceitar | rejeitar | desfazer)`.

  | Superfície | Como expõe as ações |
  |---|---|
  | PWA | Botões e caixa de texto |
  | Agentes que leem o frontend (Instinct) | A mesma UI, legível por máquina (V2-65) |
  | Agentes com MCP (Claude, ChatGPT…) | Tools MCP |
  | Nativo (futuro) | App Intents (iOS) / App Functions (Android) |

### Frontend legível por agentes (Instinct e afins)

O Instinct não usa uma API: lê o frontend e executa as ações na UI. A UI é, portanto, a API dele.

- **V2-65** Regras para a PWA:
  - A caixa do microfone aceita texto escrito. É o ponto de entrada mais robusto para um agente: escreve "junta farmácia antes das 18h" e carrega Enviar.
  - Tudo o que se faz com gestos (swipe) tem um botão equivalente.
  - HTML semântico, botões com `aria-label` em texto claro e atributos `data-action` estáveis entre versões.
  - URLs diretos e estáveis: `/agora`, `/dia/AAAA-MM-DD`, `/tarefas`, `/proposta/:id`.
  - Página `/agente` em texto simples que descreve as quatro ações e onde estão.
  - Nada de canvas, ações só com hover, nem estado que só existe depois de animações.

### Autenticação de agentes

- **V2-66** Login com Google por um agente costuma ser bloqueado (deteção de bots, 2FA). Por isso, cada utilizador pode gerar nas definições um **link de acesso pessoal** (token longo, revogável) que:
  - aberto num browser, cria sessão sem passar pela Google (é o que se entrega ao Instinct);
  - serve de credencial para o MCP (`/api/mcp?token=…` ou cabeçalho `Authorization`).

  É um token por utilizador, com revogação e regeneração num toque. OAuth completo para MCP fica para depois do piloto.

### LLM

- **V2-67** Variáveis `INTERPRETER_MODEL` (ex.: `anthropic/claude-haiku-5-5`, `google/gemini-flash-…`) e `AI_GATEWAY_API_KEY`. O prompt e o schema de saída são independentes do fornecedor. Os testes do interpretador correm sobre um conjunto fixo de frases em pt-PT para comparar modelos.

### Google Places

- **V2-68** Chave só no servidor, restrita à Places API, com quota diária baixa. Cache dos resultados por categoria e zona (dentro do permitido pelos termos da Google). Atribuição "Google" visível onde se mostram locais.
