import type { ISODate, Minutes } from './types';

export const TZ = 'Europe/Lisbon';

/** 24-hour clock everywhere. 630 → "10:30". */
export function fmt(m: Minutes): string {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
}

export function parseHHMM(s: string): Minutes | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Current date and minute-of-day in Lisbon. */
export function lisbonNow(at: number = Date.now()): { date: ISODate; minutes: Minutes } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function addDays(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function compareDate(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Epoch ms for a Lisbon local date + minute (handles DST by probing the offset). */
export function toEpoch(date: ISODate, minutes: Minutes): number {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const local = lisbonNow(guess);
  const [ly, lm, ld] = local.date.split('-').map(Number);
  const localAsUtc = Date.UTC(ly, lm - 1, ld, Math.floor(local.minutes / 60), local.minutes % 60);
  return guess - (localAsUtc - guess);
}

export function weekdayShort(date: ISODate, lang: 'en' | 'pt'): string {
  const [y, m, d] = date.split('-').map(Number);
  const s = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  return s.replace('.', '').replace(/^\w/, (c) => c.toUpperCase());
}

export function longDate(date: ISODate, lang: 'en' | 'pt'): string {
  const [y, m, d] = date.split('-').map(Number);
  const s = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  return s.replace(/^\w/, (c) => c.toUpperCase());
}
