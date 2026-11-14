import type { ISODate, Lang, Settings, Stop } from './domain/types';

/** Rita's Tuesday from the brief: the worked example and the acceptance-test fixture. */
const PT: Record<string, [string, string]> = {
  s_meeting: ['Reunião de equipa', 'Escritório · Saldanha'],
  s_pharmacy: ['Farmácia', 'Farmácia · Av. de Roma'],
  s_groceries: ['Compras', 'Mercado de Alvalade'],
  s_pickup: ['Recolha na escola', 'Escola · Alvalade'],
  s_lunch: ['Almoço em casa', 'Casa · Alvalade'],
  s_gym: ['Ginásio', 'Ginásio · Campo Grande'],
  s_dinner: ['Levantar o jantar', 'Campo de Ourique'],
};

export function ritaDay(date: ISODate, lang: Lang = 'en'): Stop[] {
  const stops: Stop[] = [
    { id: 's_meeting', title: 'Team meeting', placeId: 'saldanha', placeName: 'Office · Saldanha', date, start: 9 * 60 + 30, duration: 40, context: 'work', fixed: false },
    { id: 's_pharmacy', title: 'Pharmacy', placeId: 'av-roma', placeName: 'Pharmacy · Av. de Roma', date, start: 10 * 60 + 30, duration: 20, context: 'errand', fixed: false, note: 'Prescription is ready' },
    { id: 's_groceries', title: 'Groceries', placeId: 'mercado-alvalade', placeName: 'Mercado de Alvalade', date, start: 11 * 60 + 15, duration: 60, context: 'errand', fixed: false, flex: { kind: 'today' } },
    { id: 's_pickup', title: 'School pickup', placeId: 'school-alvalade', placeName: 'School · Alvalade', date, start: 12 * 60 + 30, duration: 20, context: 'home', fixed: true },
    { id: 's_lunch', title: 'Lunch at home', placeId: 'home-alvalade', placeName: 'Home · Alvalade', date, start: 13 * 60 + 15, duration: 45, context: 'home', fixed: false },
    { id: 's_gym', title: 'Gym', placeId: 'gym-campo-grande', placeName: 'Gym · Campo Grande', date, start: 18 * 60 + 30, duration: 60, context: 'self', fixed: false },
    { id: 's_dinner', title: 'Dinner pickup', placeId: 'campo-ourique', placeName: 'Campo de Ourique', date, start: 20 * 60 + 15, duration: 15, context: 'home', fixed: false },
  ];
  if (lang !== 'pt') return stops;
  return stops.map((s) => ({ ...s, title: PT[s.id]?.[0] ?? s.title, placeName: PT[s.id]?.[1] ?? s.placeName, note: s.note ? 'A receita está pronta' : undefined }));
}

export const DEFAULT_SETTINGS: Settings = {
  priority: 'fewest',
  rules: { walkUnder10: false, avoidHills: false, busWhenRain: true, stepFree: false },
  contextNames: { work: 'Work', home: 'Home', errand: 'Errands', self: 'Me time' },
  lang: 'pt',
  theme: 'auto',
  name: 'Rita',
  notifications: true,
};

/** The moment in Rita's story: her 09:30 meeting has just ended. */
export const RITA_NOW = 10 * 60 + 12;

/**
 * Rita's day placed on the real clock: every stop shifts so that "now" is the moment in her story,
 * so routes and departures are the real ones for the next hours. Returns null when the shifted day
 * would run past midnight (late in the evening): the caller falls back to a simulated clock.
 */
export function ritaDayNow(date: ISODate, nowMinutes: number, lang: Lang = 'en'): Stop[] | null {
  const offset = Math.round((nowMinutes - RITA_NOW) / 5) * 5;
  const stops = ritaDay(date, lang).map((s) => ({ ...s, start: s.start + offset }));
  const morning = stops.filter((s) => s.start + s.duration <= 23 * 60 + 45);
  // Keep the day only if the core story (meeting → pickup → lunch) still fits today.
  return morning.some((s) => s.id === 's_lunch') && stops[0].start >= 0 ? morning : null;
}
