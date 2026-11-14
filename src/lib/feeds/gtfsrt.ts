import type { Disruption, DisruptionEffect, DisruptionSource } from '../domain/types';
import { delayFromText, lineFromRoute, linesFromText } from './lines';

/**
 * Parser for GTFS-Realtime Service Alerts published as JSON
 * (TML GO hub `/alerts/gtfs`, Carris Metropolitana `/v2/alerts`).
 * Tolerant on purpose: accepts snake_case or camelCase, a bare FeedMessage,
 * a `{ data: FeedMessage }` wrapper (GO hub ApiResponse), or a bare entity array.
 */

type Translated = { translation?: { text?: string; language?: string }[] } | string | undefined;
interface Entity { id?: string; alert?: AlertJson; [k: string]: unknown }
interface AlertJson {
  active_period?: { start?: number | string; end?: number | string }[];
  activePeriod?: { start?: number | string; end?: number | string }[];
  informed_entity?: EntitySelector[];
  informedEntity?: EntitySelector[];
  effect?: string;
  cause?: string;
  header_text?: Translated;
  headerText?: Translated;
  description_text?: Translated;
  descriptionText?: Translated;
}
interface EntitySelector { agency_id?: string; agencyId?: string; route_id?: string; routeId?: string; stop_id?: string; stopId?: string }

function text(t: Translated): { en?: string; pt?: string } {
  if (!t) return {};
  if (typeof t === 'string') return { pt: t };
  const out: { en?: string; pt?: string } = {};
  for (const tr of t.translation ?? []) {
    if (!tr.text) continue;
    const lang = (tr.language ?? '').toLowerCase();
    if (lang.startsWith('en')) out.en ??= tr.text;
    else out.pt ??= tr.text;
  }
  return out;
}

function epoch(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 1e12 ? n * 1000 : n; // GTFS-RT uses POSIX seconds
}

export function mapEffect(effect?: string): DisruptionEffect | null {
  switch ((effect ?? '').toUpperCase()) {
    case 'NO_SERVICE': return 'no-service';
    case 'REDUCED_SERVICE': return 'reduced';
    case 'SIGNIFICANT_DELAYS': return 'delay';
    case 'DETOUR':
    case 'STOP_MOVED': return 'detour';
    case 'NO_EFFECT':
    case 'ADDITIONAL_SERVICE':
      return null; // nothing to replan for
    default: return 'other';
  }
}

function entities(json: unknown): Entity[] {
  if (Array.isArray(json)) return json as Entity[];
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.entity)) return o.entity as Entity[];
    if (o.data !== undefined) return entities(o.data);
  }
  return [];
}

export function parseAlerts(json: unknown, source: DisruptionSource, linePrefix: string): Disruption[] {
  const out: Disruption[] = [];
  for (const e of entities(json)) {
    const a: AlertJson | undefined = e.alert ?? (('effect' in e || 'header_text' in e || 'headerText' in e) ? (e as AlertJson) : undefined);
    if (!a) continue;
    const effect = mapEffect(a.effect);
    if (!effect) continue;
    const header = text(a.header_text ?? a.headerText);
    const description = text(a.description_text ?? a.descriptionText);
    const selectors = a.informed_entity ?? a.informedEntity ?? [];
    const lines = new Set<string>();
    const stops = new Set<string>();
    for (const s of selectors) {
      const route = s.route_id ?? s.routeId;
      const agency = s.agency_id ?? s.agencyId;
      const stop = s.stop_id ?? s.stopId;
      if (route) lineFromRoute(route, agency, linePrefix).forEach((k) => lines.add(k));
      if (stop) stops.add(`${linePrefix}:${stop}`);
    }
    const allText = [header.pt, header.en, description.pt, description.en].filter(Boolean).join(' ');
    linesFromText(allText).forEach((k) => lines.add(k));
    const period = (a.active_period ?? a.activePeriod ?? [])[0];
    const delay = delayFromText(allText);
    out.push({
      id: `${source}:${e.id ?? out.length}`,
      source,
      lines: [...lines],
      stops: [...stops],
      effect: effect === 'other' && delay ? 'delay' : effect,
      delayMin: delay,
      start: epoch(period?.start),
      end: epoch(period?.end),
      header,
      description,
    });
  }
  return out;
}
