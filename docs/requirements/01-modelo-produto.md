# Parte 1: Modelo de produto (v2, piloto friends & family)

Estado: **fechado** (2026-11-14). As IDs `V2-xx` não colidem com os `FR-xx` do MVP original.

## A frase

> Diz-me o que tens de fazer. Eu digo-te o que fazer a seguir, a partir de onde estás.

## Princípios

1. **Zero forms.** Nenhum ecrã tem mais de um campo obrigatório. Quando há dúvida, a app faz uma pergunta de cada vez, com resposta de um toque.
2. **A base é o GPS.** A origem é sempre a localização atual. Casa e trabalho são lugares aprendidos, não configuração.
3. **Os dados vêm de onde já estão.** Compromissos vêm do calendário; o resto vem de voz ou texto livre.
4. **Próximo passo, não o dia inteiro.** O ecrã principal mostra a próxima ação; o dia completo fica a um gesto.
5. **Propõe, nunca impõe.** Fixos são sagrados; tudo tem undo (já existe no motor).
6. **Corrigir custa um gesto.** Correções por voz/texto ("não, a farmácia é amanhã") ou um toque.

## Âmbito do piloto

| Decisão | Valor |
|---|---|
| Utilizadores | Friends & family, ≤ 10 |
| Geografia | Lisboa / AML apenas |
| Plataforma | PWA (a app atual) |
| Horizonte | Hoje e amanhã |
| Trip planner | Transitous (chega para ≤ 10 utilizadores) |
| POIs / "um sítio qualquer" | Google Places API |
| Assistentes | Núcleo "texto entra → plano sai", exposto por API + MCP (Instinct e afins usam-no diretamente) |

## Requisitos

### Tipos de item (o utilizador nunca os escolhe; a app infere)

- **V2-01 Compromisso.** Tem hora e sítio, vem do calendário ou de voz com hora explícita. Mapeia para `Stop.fixed = true`.
- **V2-02 Tarefa com sítio.** Sítio concreto, sem hora ("levantar encomenda nos CTT do Saldanha"). Mapeia para flex `today` / `before`.
- **V2-03 Tarefa de categoria.** Sem sítio concreto ("farmácia", "comprar pilhas"). A app resolve para o local **aberto** mais conveniente dado o percurso do dia, via Google Places (categoria + horário). O local escolhido pode mudar num replan.
- **V2-04 Opcional.** "Se der, …" fica marcado como dispensável: é a primeira coisa a cair num replan.

### Origem e localização

- **V2-05** A origem de qualquer cálculo é a localização atual (com a app em primeiro plano). Sem permissão de GPS, a app pergunta "onde estás?" com uma única pesquisa de lugar.
- **V2-06** Casa e trabalho são sugeridos a partir de padrões (onde a pessoa está de manhã e à noite) e confirmados com um toque. Nunca são obrigatórios.

### Interação

- **V2-07** Captura de dia por voz ou texto livre, numa só frase ou várias. O resultado é **um** cartão de confirmação com os itens interpretados já encaixados no dia.
- **V2-08** Correções em linguagem natural sobre o cartão ou o plano.
- **V2-09** O ecrã principal mostra o próximo passo: hora de saída, como ir, para onde. O dia completo fica num swipe/tab.
- **V2-10** Lista de tarefas persistente ("inbox"): o que não cabe hoje passa para amanhã ou fica pendente, sem o utilizador mexer.

### Canais

- **V2-11** O núcleo é uma API única: entra texto (e contexto: localização, hora), sai um plano/proposta. A PWA, o canal de mensagens e o MCP são camadas finas sobre ela.
- **V2-12** Instinct AI (e outros agentes): não precisam de API pública do lado deles. Com os acessos do utilizador, o agente entra numa web app e usa o que ela expõe. Por isso, **no piloto**, o Mobee expõe um **servidor MCP** sobre a API de V2-11 (ler o plano, adicionar tarefas por texto, aceitar/rejeitar propostas), autenticado por utilizador. A própria PWA deve ser legível por agentes: HTML semântico e botões com labels estáveis.

### Fora do piloto

Planear além de amanhã · partilha e família · carro/TVDE como modo principal · sugestões proativas por hábitos · app nativa (Siri/App Intents, localização em background) · fora da AML.
