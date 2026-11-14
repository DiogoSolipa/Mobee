# Parte 2: Entradas

Estado: **fechado** (2026-11-14).

## Decisões

| Decisão | Valor |
|---|---|
| Calendário | Só Google Calendar no piloto |
| Voz | Reconhecimento de voz do browser (Web Speech API), `lang = 'pt-PT'` |
| Criação de tarefas | Só por voz (e texto, como fallback). Sem importar Google Tasks / To Do |
| Momento de captura | Microfone sempre à mão **e** push de manhã ("Como vai ser o teu dia?") |

## Requisitos

### Calendário

- **V2-20** Ligar Google Calendar por OAuth com o scope `calendar.readonly`, num só ecrã ("Ligar Google"), sem mais perguntas.
- **V2-21** Publicar a app OAuth como **In production** sem verificação (limite de 100 utilizadores; os testers veem o aviso "app não verificada" uma vez). Em modo *Testing*, os refresh tokens expiram em 7 dias.
- **V2-22** Ler os eventos de hoje e amanhã de todos os calendários visíveis do utilizador. Atualizar ao abrir a app e periodicamente no servidor.
- **V2-23** Evento com morada física → compromisso (`fixed`) com deslocação. Evento sem morada, ou com link de videochamada → bloqueia tempo, sem percurso. Evento de dia inteiro → ignorado no encaixe (aparece como contexto).
- **V2-24** A morada de um evento é geocodificada uma vez e o resultado fica guardado. Se for ambígua, a app pergunta com um toque ("Saldanha → Av. Duque d'Ávila?"), uma vez.
- **V2-25** O Mobee nunca escreve no calendário no piloto.

### Voz

- **V2-26** Captura por voz com a Web Speech API (`webkitSpeechRecognition` no Safari) em `pt-PT`. Modo "toca para começar, toca para parar", com o texto parcial visível enquanto a pessoa fala.
- **V2-27** Sem suporte de voz (Firefox, permissão negada): o mesmo ecrã aceita texto escrito. O resto do fluxo é idêntico.
- **V2-28** O texto transcrito é editável antes de enviar (corrigir uma palavra mal ouvida sem repetir tudo).
- **V2-29** O motor de voz fica atrás de uma interface (`transcribe()`), para poder trocar por Whisper no servidor sem mexer na UI.
- **V2-30** Nota de privacidade: no Chrome, o áudio é processado pelos servidores da Google. Dizer isso aos testers.

### Interpretação

- **V2-31** O texto (de voz, escrito, ou vindo do MCP) vai para um endpoint único que chama um LLM com saída estruturada e devolve itens: `tipo` (compromisso / tarefa com sítio / tarefa de categoria), `título`, `sítio` ou `categoria`, `dia`, `hora` ou janela, `opcional`.
- **V2-32** O LLM só interpreta. Horas, percursos e encaixe são decididos pelo motor determinístico existente.
- **V2-33** Expressões relativas resolvem-se pelo relógio de Lisboa ("logo à tarde", "amanhã de manhã", "antes das 6").
- **V2-34** O que o LLM não percebe vira tarefa com o texto original e uma pergunta de um toque, nunca um erro.

### Push de manhã

- **V2-35** Push diário configurável (por omissão às 8h, desligável), que abre diretamente o microfone. Se o calendário já tiver o dia, o push resume-o: "3 compromissos hoje. Queres juntar algo?"
- **V2-36** Requer Web Push (Parte 4). No iPhone só funciona com a PWA instalada no ecrã principal (iOS 16.4+): o onboarding tem de pedir isso.
