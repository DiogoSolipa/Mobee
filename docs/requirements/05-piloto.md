# Parte 5: Piloto

Estado: **fechado** (2026-11-14).

| Tema | Decisão |
|---|---|
| Duração e acompanhamento | Fora do âmbito técnico |
| Métricas | **TO BE.** Vai ser preciso um dashboard. No piloto basta que os eventos fiquem guardados (V2-70) |
| Feedback | Só o botão "Isto está mal" (V2-71). Sem mais canais |
| Onboarding | Link → instalar no ecrã principal → Entrar com Google → localização → notificações |

## Requisitos

- **V2-70** Guardar eventos mínimos na base de dados, sem ferramenta de analytics: `item_added` (origem: voz / texto / mcp), `card_confirmed` (com ou sem correção), `proposal_answered` (aceite / desfeita / ignorada), `item_done` (chegada / inferido / calendário). Servem o futuro dashboard.
- **V2-71** Botão "Isto está mal" em cada cartão de confirmação e em cada proposta. Guarda o contexto (texto original, itens interpretados, plano, proposta) e um comentário opcional de uma linha.
- **V2-72** Onboarding em 4 passos, cada um com um só toque. O passo "instalar no ecrã principal" aparece no iPhone e explica porquê (sem isso não há notificações).
