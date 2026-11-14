/** Normalise operator line names/ids into Mobee line keys ('ml:green', 'cp:sintra', 'cm:1716'). */

const METRO: [RegExp, string][] = [
  [/\b(linha\s+)?verde\b|\bgreen(\s+line)?\b/i, 'ml:green'],
  [/\b(linha\s+)?amarela\b|\byellow(\s+line)?\b/i, 'ml:yellow'],
  [/\b(linha\s+)?azul\b|\bblue(\s+line)?\b/i, 'ml:blue'],
  [/\b(linha\s+)?vermelha\b|\bred(\s+line)?\b/i, 'ml:red'],
];

const CP: [RegExp, string][] = [
  [/linha\s+de\s+sintra|sintra\s+line/i, 'cp:sintra'],
  [/linha\s+de\s+cascais|cascais\s+line/i, 'cp:cascais'],
  [/linha\s+da\s+azambuja|azambuja\s+line/i, 'cp:azambuja'],
  [/linha\s+do\s+sado|sado\s+line/i, 'cp:sado'],
  [/linha\s+de\s+cintura|cintura\s+line/i, 'cp:cintura'],
  [/fertagus/i, 'fertagus:main'],
];

export function isMetroContext(s: string): boolean {
  return /\bmetro\b|metropolitano|\bML\b|\bmetrolisboa/i.test(s);
}

/** Line keys mentioned in free text (alert headers, descriptions). Metro colours only count in a Metro context. */
export function linesFromText(text: string, metroContext = false): string[] {
  const out = new Set<string>();
  if (metroContext || isMetroContext(text)) for (const [re, key] of METRO) if (re.test(text)) out.add(key);
  for (const [re, key] of CP) if (re.test(text)) out.add(key);
  return [...out];
}

/** Line key for a GTFS route_id (with the agency, when known). */
export function lineFromRoute(routeId: string, agencyId?: string, prefix = 'tml'): string[] {
  // Carris Metropolitana / TML ids look like "[LA77N]1628_0": operator code in brackets, line, pattern suffix.
  const bracket = /^\[([^\]]+)\](.+)$/.exec(String(routeId));
  if (bracket) {
    const line = bracket[2].replace(/_\d+$/, '');
    return [`${prefix}:${line}`];
  }
  const r = String(routeId);
  const agency = (agencyId ?? '').toLowerCase();
  if (agency.includes('metro') || agency === 'ml' || /^ml[_-]?/i.test(r)) {
    const m = linesFromText(r.replace(/[_-]/g, ' '), true);
    if (m.length) return m;
  }
  const cp = linesFromText(r.replace(/[_-]/g, ' '));
  if (cp.length) return cp;
  return [`${agency || prefix}:${r}`];
}

/** "Atraso de 12 min" / "12 min delay" → 12 */
export function delayFromText(text: string): number | undefined {
  const m = /(\d{1,3})\s*(min|minutos|minutes)\b/i.exec(text);
  return m ? Number(m[1]) : undefined;
}
