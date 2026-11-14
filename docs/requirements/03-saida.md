# Parte 3: Saída

Estado: **fechado** (2026-11-14).

## Decisões

| Decisão | Valor |
|---|---|
| Mapa | Sem mapa na app. Botão "Abrir no Google Maps" com o percurso |
| Tarefa feita | Chegou ao local = feita. Ninguém marca nada à mão |
| Aviso de saída | Push 10 min antes da hora de sair (configurável) |

## Requisitos

### Ecrã "Agora"

- **V2-40** O ecrã principal mostra uma só ação: hora de saída, como ir (modo, linha, destino da linha) e para onde, com o horário do sítio quando é relevante. Exemplo: "Sai às 10:40 → Linha Verde até Alameda (12 min) → Farmácia Alameda, aberta até 20h".
- **V2-41** Por baixo: uma linha com o item seguinte e o microfone. O dia completo (timeline atual) fica a um swipe.
- **V2-42** Botão "Abrir no Google Maps" com origem = localização atual, destino = sítio do item e modo transportes ou a pé (deep link `https://www.google.com/maps/dir/?api=1&...`).

### Cartão de confirmação

- **V2-43** Depois de falar, um único cartão mostra os itens interpretados já encaixados no dia ("Farmácia → 10:55, a caminho do Saldanha"). Ações: "Está bom", corrigir por voz, ou tocar num item.
- **V2-44** Escolha do sítio numa tarefa de categoria (ex.: "farmácia"):
  - **Com percurso.** Se o dia já tem itens com sítio, a app escolhe sozinha o local que acrescenta menos tempo ao percurso e mostra "Farmácia Saldanha, depois da reunião · trocar". Num replan pode trocar de local sozinha.
  - **Solta.** Se não há percurso a que encostar (é o único item, ou não tem dia), a app pergunta uma vez, com um toque: "Tens alguma preferida?", mostrando 2–3 opções perto da localização atual e "Qualquer uma".
  - **Preferidas.** A resposta fica guardada como preferida dessa pessoa para essa categoria. Trocar duas vezes para o mesmo local também o torna preferido. Com preferida, a app usa-a, a menos que o desvio seja muito maior (> 15 min); nesse caso sugere a alternativa no percurso com "· trocar".
  - Referências explícitas ("a minha farmácia", "o Pingo Doce de sempre") usam a preferida; se não houver, conta como solta.
- **V2-44a** Horário: só são candidatos locais **abertos** desde a hora estimada de chegada até ao fim da duração do item, segundo os horários da Google Places. Locais sem horário na Google entram como último recurso, marcados "horário não confirmado". Se nenhum estiver aberto hoje, a tarefa passa para amanhã por proposta (com undo).

### Conclusão automática

- **V2-45** Um item fica **feito** quando a pessoa chega ao local: localização a menos de ~75 m durante ≥ 2 min (ou ≥ duração do item, se for curta).
- **V2-46** Limitação da PWA: só há localização com a app aberta. Quando a app abre, o Mobee infere o que ficou para trás: se a pessoa já está no item seguinte, ou noutro sítio depois da hora de um item que estava no percurso, esse item conta como feito.
- **V2-47** Nunca se pergunta "já está?". Se a inferência estiver errada, a pessoa diz "não fui à farmácia" e a tarefa volta à lista, reencaixada.
- **V2-48** Compromissos do calendário passados contam como feitos, sem inferência.

### Avisos

- **V2-49** Push 10 min antes da hora de sair calculada (configurável), com a mesma frase do ecrã "Agora".
- **V2-50** Push quando um replan muda a hora de saída ou o percurso (greve, atraso, chuva), usando o pipeline de propostas existente. Requer Web Push (Parte 4).
