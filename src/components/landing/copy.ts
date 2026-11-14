import type { Lang } from '@/lib/domain/types';

/**
 * Landing copy, pt-PT first. Voice (design system): say what changed, then what we can do; name the way back;
 * no exclamation marks, no emoji, no blame. Growth guardrails (Bowtie): Rita is an illustrative persona, never a
 * testimonial; numbers shown are live, sourced data only; no promise to catch every disruption.
 */
export const COPY = {
  pt: {
    nav: { how: 'Como funciona', rita: 'A Rita', live: 'Em direto', demo: 'Experimentar' },
    hero: {
      kicker: 'Piloto em Lisboa',
      title1: 'Os transportes não se adaptam a ti.',
      title2: 'Até agora.',
      lead: 'A reunião prolonga-se. O metro atrasa. Começa a chover. A escola fecha às 12:30. E és tu que reconstróis o dia à mão, entre o calendário, o mapa e o site do operador. O Mobee repara quando o dia muda e propõe um novo plano. Quem decide és tu.',
      cta: 'Experimentar o dia da Rita',
      ctaSub: 'Sem conta. Rotas e avisos reais.',
      how: 'Ver como funciona',
    },
    live: {
      prefix: 'Agora mesmo, na área de Lisboa:',
      alerts: (n: number) => `${n} avisos de perturbação ativos`,
      rain: (n: number) => `${n}% de probabilidade de chuva hoje`,
      sources: 'Fontes: TML, Carris Metropolitana, Metro de Lisboa, IPMA',
      updated: (t: string) => `atualizado às ${t}`,
    },
    chaos: {
      title: 'Cada mudança obriga-te a recomeçar do zero.',
      lead: 'Calendário, mapa, site do operador, meteorologia. Nenhum fala com os outros. Quem faz a ligação és tu, com o telemóvel numa mão e o resto do dia na cabeça.',
      label: 'Um dia normal, hoje',
      note: 'Cenário ilustrativo.',
      steps: [
        ['10:00', 'A reunião não acaba.'],
        ['10:14', 'Abres o mapa. A farmácia já não cabe antes das compras.'],
        ['10:16', 'Vais ao site do Metro. Linha Verde com perturbações.'],
        ['10:19', 'Começa a chover. Os 15 minutos a pé deixaram de fazer sentido.'],
        ['10:22', 'Fazes contas à recolha das 12:30. Desistes das compras.'],
        ['10:23', 'Ainda não voltaste a trabalhar.'],
      ],
      withTitle: 'Com o Mobee',
      withBody: 'Uma proposta. As mudanças lado a lado. O que é fixo fica protegido. Um toque para aceitar, outro para voltar atrás.',
    },
    rita: {
      kicker: 'Conhece a Rita',
      title: 'Vida cheia. Dia feito simples.',
      body: 'Gestora de projeto no Saldanha, mora em Alvalade. Dois filhos na escola do bairro, um treino de corrida ao fim da tarde, recados que nunca acabam. Anda de metro, de autocarro e a pé. O plano dela muda várias vezes por dia. Os transportes não sabem disso.',
      persona: 'A Rita é uma persona ilustrativa, criada para mostrar o produto.',
      dayTitle: 'A terça-feira da Rita',
      contexts: { work: 'Trabalho', home: 'Casa', errand: 'Recados', self: 'Tempo para mim' },
      fixed: 'Fixa',
      flexible: 'Flexível',
    },
    demo: {
      kicker: 'Vê o Mobee a trabalhar',
      title: 'Escolhe o que corre mal.',
      scenarios: { late: 'A reunião prolongou-se', metro: 'Linha Verde com atraso', rain: 'Começou a chover' },
      note: 'Exemplo ilustrativo. Na demo completa, as rotas e os avisos são reais.',
      full: 'Abrir a demo completa',
    },
    how: {
      kicker: 'Como funciona',
      title: 'Três passos. Tu decides em todos.',
      steps: [
        ['Diz o que tem de acontecer', 'Paragens com hora marcada, recados que podem esperar e o que não pode mudar, como a recolha na escola.'],
        ['O Mobee repara quando o dia muda', 'Atrasos e linhas interrompidas, chuva, ou simplesmente “saio mais tarde”. Só para as próximas horas, sem alarmes a mais.'],
        ['Tu escolhes', 'Ajustar paragens, manter o plano ou anular depois. Nunca mexemos em nada sem perguntar.'],
      ],
    },
    trust: {
      title: 'Feito para confiares nele.',
      items: [
        ['Sugere, nunca impõe', 'Cada mudança chega como proposta, com o antes e o depois.'],
        ['O que é fixo é sagrado', 'Marca uma paragem como fixa e o Mobee planeia à volta dela.'],
        ['Há sempre volta atrás', 'Anular está no mesmo sítio até a paragem acontecer.'],
        ['Uma decisão de cada vez', 'Atraso, reunião e chuva juntam-se numa só proposta.'],
      ],
    },
    data: {
      kicker: 'Ligado ao que se passa agora',
      title: 'Dados reais, não suposições.',
      items: [
        ['Metro de Lisboa', 'Estado das quatro linhas.'],
        ['TML · GO', 'Avisos de oito operadores da área metropolitana.'],
        ['Carris Metropolitana', 'Desvios, condicionamentos e horários.'],
        ['IPMA', 'Avisos de chuva e previsão para Lisboa.'],
        ['MOTIS', 'Rotas reais: horários dos operadores e percursos a pé no OpenStreetMap.'],
      ],
      limitsTitle: 'O que ainda não fazemos',
      limits: [
        'Não apanhamos todas as perturbações: dependemos do que os operadores publicam.',
        'Os tempos são tão bons quanto os horários e o tempo real disponíveis.',
        'Para já, só na área de Lisboa.',
      ],
    },
    final: {
      title: 'Os planos mudam. O Mobee adapta-se.',
      body: 'Experimenta com o dia da Rita, com rotas e avisos de agora. Sem conta, sem calendário ligado.',
      cta: 'Experimentar o dia da Rita',
    },
    footer: 'Piloto em Lisboa. Dados: TML, Carris Metropolitana, Metro de Lisboa (CC BY 4.0), IPMA, OpenStreetMap, MOTIS.',
  },
  en: {
    nav: { how: 'How it works', rita: 'Rita', live: 'Live', demo: 'Try it' },
    hero: {
      kicker: 'Pilot in Lisbon',
      title1: "Public transport doesn't adapt to you.",
      title2: 'Until now.',
      lead: 'The meeting runs over. The metro is late. It starts to rain. School closes at 12:30. And you rebuild the day by hand, between your calendar, a map and the operator’s website. Mobee notices when your day changes and proposes a new plan. You decide.',
      cta: "Try Rita's day",
      ctaSub: 'No account. Real routes and alerts.',
      how: 'See how it works',
    },
    live: {
      prefix: 'Right now, around Lisbon:',
      alerts: (n: number) => `${n} active disruption alerts`,
      rain: (n: number) => `${n}% chance of rain today`,
      sources: 'Sources: TML, Carris Metropolitana, Metro de Lisboa, IPMA',
      updated: (t: string) => `updated ${t}`,
    },
    chaos: {
      title: 'Every change sends you back to square one.',
      lead: 'Calendar, map, the operator’s website, the weather. None of them talk to each other. You are the link, phone in one hand and the rest of the day in your head.',
      label: 'An ordinary day, today',
      note: 'Illustrative scenario.',
      steps: [
        ['10:00', 'The meeting won’t end.'],
        ['10:14', 'You open the map. The pharmacy no longer fits before the groceries.'],
        ['10:16', 'You check the Metro website. Green line disrupted.'],
        ['10:19', 'It starts raining. The 15-minute walk stops making sense.'],
        ['10:22', 'You do the maths for the 12:30 school pickup. The groceries are off.'],
        ['10:23', 'You still haven’t gone back to work.'],
      ],
      withTitle: 'With Mobee',
      withBody: 'One proposal. The changes side by side. What is fixed stays protected. One tap to accept, one to undo.',
    },
    rita: {
      kicker: 'Meet Rita',
      title: 'A full life. A simple day.',
      body: 'Project manager in Saldanha, lives in Alvalade. Two kids at the local school, a run in the late afternoon, errands that never end. She gets around by metro, bus and on foot. Her plan changes several times a day. Public transport doesn’t know that.',
      persona: 'Rita is an illustrative persona, created to show the product.',
      dayTitle: "Rita's Tuesday",
      contexts: { work: 'Work', home: 'Home', errand: 'Errands', self: 'Me time' },
      fixed: 'Fixed',
      flexible: 'Flexible',
    },
    demo: {
      kicker: 'Watch Mobee work',
      title: 'Pick what goes wrong.',
      scenarios: { late: 'The meeting ran over', metro: 'Green line delayed', rain: 'It started raining' },
      note: 'Illustrative example. In the full demo, routes and alerts are real.',
      full: 'Open the full demo',
    },
    how: {
      kicker: 'How it works',
      title: 'Three steps. You decide in all of them.',
      steps: [
        ['Say what needs to happen', 'Stops at set times, errands that can wait, and what can’t move, like the school pickup.'],
        ['Mobee notices when the day changes', 'Delays and suspended lines, rain, or simply “I’m leaving later”. Only for the next few hours, no extra noise.'],
        ['You choose', 'Adjust stops, keep your plan, or undo later. Nothing changes without asking.'],
      ],
    },
    trust: {
      title: 'Built to be trusted.',
      items: [
        ['Suggest, never overwrite', 'Every change arrives as a proposal, with before and after.'],
        ['Fixed things are sacred', 'Mark a stop as fixed and Mobee plans around it.'],
        ['Always a way back', 'Undo stays in the same place until the stop happens.'],
        ['One decision at a time', 'A delay, a meeting and rain merge into one proposal.'],
      ],
    },
    data: {
      kicker: 'Connected to what is happening now',
      title: 'Real data, not guesses.',
      items: [
        ['Metro de Lisboa', 'Status of all four lines.'],
        ['TML · GO', 'Alerts from eight operators across the metro area.'],
        ['Carris Metropolitana', 'Detours, restrictions and timetables.'],
        ['IPMA', 'Rain warnings and the Lisbon forecast.'],
        ['MOTIS', 'Real routes: operator timetables and walking on OpenStreetMap.'],
      ],
      limitsTitle: 'What we don’t do yet',
      limits: [
        'We don’t catch every disruption: we rely on what operators publish.',
        'Times are as good as the timetables and live data available.',
        'For now, Lisbon area only.',
      ],
    },
    final: {
      title: 'Plans change. Mobee adapts.',
      body: 'Try it with Rita’s day, with today’s routes and alerts. No account, no calendar connected.',
      cta: "Try Rita's day",
    },
    footer: 'Pilot in Lisbon. Data: TML, Carris Metropolitana, Metro de Lisboa (CC BY 4.0), IPMA, OpenStreetMap, MOTIS.',
  },
} as const;

export type Copy = (typeof COPY)[Lang];
