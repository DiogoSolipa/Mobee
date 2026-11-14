import type { Disruption } from '../domain/types';

/** IPMA open data (api.ipma.pt/open-data). Free, no key. Commercial use: ask IPMA first. */

export const LISBON_WARNING_AREA = 'LSB';
export const LISBON_FORECAST_ID = 1110600;

interface WarningJson { text?: string; awarenessTypeName?: string; idAreaAviso?: string; startTime?: string; endTime?: string; awarenessLevelID?: string }

const KIND: Record<string, NonNullable<Disruption['weather']>['kind']> = {
  'precipitação': 'rain', precipitacao: 'rain', trovoada: 'rain', vento: 'wind', 'tempo quente': 'heat', 'tempo frio': 'cold', nevoeiro: 'fog',
};
const KIND_EN: Record<string, string> = { rain: 'Rain', wind: 'Wind', heat: 'Heat', cold: 'Cold', fog: 'Fog', other: 'Weather' };
const LEVEL_PT: Record<string, string> = { yellow: 'amarelo', orange: 'laranja', red: 'vermelho' };

export function parseWarnings(json: unknown, area = LISBON_WARNING_AREA): Disruption[] {
  if (!Array.isArray(json)) return [];
  return (json as WarningJson[])
    .filter((w) => w.idAreaAviso === area && w.awarenessLevelID && w.awarenessLevelID !== 'green')
    .map((w, i) => {
      const kind = KIND[(w.awarenessTypeName ?? '').toLowerCase()] ?? 'other';
      const level = (w.awarenessLevelID as 'yellow' | 'orange' | 'red') ?? 'yellow';
      const start = w.startTime ? Date.parse(w.startTime) : undefined;
      const end = w.endTime ? Date.parse(w.endTime) : undefined;
      return {
        id: `ipma:${area}:${kind}:${w.startTime ?? i}`,
        source: 'ipma' as const,
        lines: [],
        stops: [],
        effect: 'weather' as const,
        start: Number.isFinite(start) ? start : undefined,
        end: Number.isFinite(end) ? end : undefined,
        weather: { kind, level },
        header: { en: `${KIND_EN[kind]} warning (${level}) for Lisbon`, pt: `Aviso ${LEVEL_PT[level] ?? level}: ${w.awarenessTypeName ?? 'tempo'} em Lisboa` },
        description: w.text ? { pt: w.text } : undefined,
      };
    });
}

/** Daily forecast for Lisbon → today's precipitation probability (0–100). */
export function parseRainProbability(json: unknown, today: string): number | undefined {
  const data = (json as { data?: { forecastDate?: string; precipitaProb?: string | number }[] })?.data;
  if (!Array.isArray(data)) return undefined;
  const day = data.find((d) => d.forecastDate === today) ?? data[0];
  const p = Number(day?.precipitaProb);
  return Number.isFinite(p) ? p : undefined;
}
