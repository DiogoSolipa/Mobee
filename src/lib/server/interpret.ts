import 'server-only';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { addDays } from '../domain/time';
import type { ISODate, Minutes } from '../domain/types';
import type { Draft } from '../engine/place';
import { searchPlaces } from '../planner/motis';

/**
 * The interpreter (V2-31 – V2-34): free text in (typed, dictated, or from an agent), items out.
 * The model only says what and when-ish. Places are resolved here with the geocoder; minutes and
 * routes are decided by the deterministic engine on the client (V2-32).
 */

export const INTERPRETER_MODEL = () => process.env.INTERPRETER_MODEL?.trim() || 'anthropic/claude-haiku-5.5';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe('24h time, HH:MM');

const ItemSchema = z.object({
  kind: z.enum(['commitment', 'place_task', 'category_task']).describe(
    'commitment = has a set time (meeting, appointment, pickup at 17:30). place_task = errand at a specific named place. category_task = errand where any place of a type works (a pharmacy, an ATM, a supermarket).',
  ),
  title: z.string().describe('Short title in the user’s language, e.g. "Farmácia", "Buscar a Maria à escola".'),
  place: z.string().nullable().describe('The place exactly as said, if a specific place was named ("CTT do Saldanha", "escola da Maria"). Null for category tasks and for things with no place.'),
  category: z.string().nullable().describe('For category_task only: one English slug, e.g. pharmacy, supermarket, atm, post_office, bakery, hardware_store, bank, cafe, pet_store, gym. Null otherwise.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD. Default: today.'),
  time: hhmm.nullable().describe('Exact start time if one was said ("às 14h", "17h30"). Null otherwise.'),
  after: hhmm.nullable().describe('Earliest start if a window was said ("depois das 17h" → 17:00, "à tarde" → 14:00, "de manhã" → 09:00). Null otherwise.'),
  before: hhmm.nullable().describe('Latest end if said ("antes das 18h" → 18:00, "de manhã" → 12:00). Null otherwise.'),
  durationMin: z.number().int().min(5).max(600).nullable().describe('Only if the user said how long, or it is obvious (a 1h meeting). Null otherwise.'),
  optional: z.boolean().describe('True when the user hedged: "se der", "se houver tempo", "talvez".'),
});

const ResultSchema = z.object({
  items: z.array(ItemSchema),
  /** Bits the model could not turn into an item (V2-34): kept verbatim so nothing said is lost. */
  unclear: z.array(z.string()).describe('Parts of the text you could not turn into an item, verbatim. Empty if none.'),
});

export type InterpretedItem = z.infer<typeof ItemSchema>;

const WEEKDAYS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function system(today: ISODate, nowMin: Minutes): string {
  const wd = WEEKDAYS_PT[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const hh = `${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`;
  return [
    'You turn what a person in Lisbon says about their day into a list of items for a day planner.',
    `Today is ${wd}, ${today}; it is ${hh} in Lisbon. Tomorrow is ${addDays(today, 1)}.`,
    'The person usually speaks European Portuguese (pt-PT); keep titles in their language.',
    'Rules:',
    '- One item per thing to do or place to be. Do not invent items. Do not merge separate errands.',
    '- Relative times resolve against the Lisbon clock above ("logo à tarde", "amanhã de manhã", "daqui a uma hora").',
    '- A time said for picking someone up or an appointment makes it a commitment.',
    '- "farmácia", "multibanco", "supermercado", "padaria" without a specific name are category tasks.',
    '- A named shop or address ("Pingo Doce de Alvalade", "Rua X 12") is a place task.',
    '- Things with no physical place ("ligar ao banco", "enviar email") are place tasks with place = null.',
    '- If the text corrects an earlier list (given below), return the full corrected list, not just the change.',
    '- Never output times in the past for today unless the person explicitly said that time.',
  ].join('\n');
}

const toMin = (s: string | null): Minutes | null => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null);

/** Geocode a place said in Portuguese, biased to Lisbon by the MOTIS geocoder. Failures leave the item without coordinates. */
async function resolvePlace(text: string): Promise<{ lat: number; lon: number; placeName: string } | null> {
  try {
    const [hit] = await searchPlaces(text);
    return hit ? { lat: hit.lat, lon: hit.lon, placeName: hit.area ? `${hit.name} · ${hit.area}` : hit.name } : null;
  } catch {
    return null;
  }
}

export interface InterpretInput {
  text: string;
  today: ISODate;
  nowMin: Minutes;
  /** The list being corrected, when this is a correction (V2-08). */
  previous?: Draft[];
}

export async function interpret({ text, today, nowMin, previous }: InterpretInput): Promise<{ drafts: Draft[]; unclear: string[] }> {
  const prompt = previous?.length
    ? `Earlier list (JSON):\n${JSON.stringify(previous.map(({ lat: _a, lon: _b, placeName: _c, ...d }) => d))}\n\nCorrection from the person:\n${text}`
    : text;
  const { output } = await generateText({
    model: INTERPRETER_MODEL(),
    system: system(today, nowMin),
    prompt,
    output: Output.object({ schema: ResultSchema }),
    temperature: 0,
    maxRetries: 1,
  });

  const drafts = await Promise.all(
    output.items.map(async (it): Promise<Draft> => {
      const place = it.place && it.kind !== 'category_task' ? await resolvePlace(it.place) : null;
      const after = toMin(it.after), before = toMin(it.before);
      return {
        kind: it.kind,
        title: it.title,
        placeText: it.place,
        category: it.kind === 'category_task' ? it.category : null,
        date: it.date,
        time: toMin(it.time),
        window: after !== null || before !== null ? { from: after, to: before } : null,
        duration: it.durationMin,
        optional: it.optional,
        ...(place ?? {}),
      };
    }),
  );
  return { drafts, unclear: output.unclear };
}
