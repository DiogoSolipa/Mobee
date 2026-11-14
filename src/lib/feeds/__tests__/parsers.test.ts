import { describe, expect, it } from 'vitest';
import { parseAlerts } from '../gtfsrt';
import { parseRainProbability, parseWarnings } from '../ipma';
import { delayFromText, lineFromRoute, linesFromText } from '../lines';
import { parseLineStatus } from '../metroLisboa';

/*
 * Fixtures follow the documented shapes (GTFS-RT Service Alerts as JSON, IPMA warnings_www.json,
 * Metro de Lisboa estadoLinha). Replace them with recorded real responses after the live probe
 * (README → "First week: probe the feeds").
 */

const tmlAlerts = {
  data: {
    header: { gtfs_realtime_version: '2.0', timestamp: 1794650000 },
    entity: [
      {
        id: 'a1',
        alert: {
          active_period: [{ start: 1794650000, end: 1794660000 }],
          informed_entity: [{ agency_id: 'ML', route_id: 'ML_VERDE' }],
          cause: 'TECHNICAL_PROBLEM',
          effect: 'SIGNIFICANT_DELAYS',
          header_text: { translation: [{ text: 'Linha Verde com 12 min de atraso', language: 'pt' }, { text: 'Green line delayed 12 min', language: 'en' }] },
        },
      },
      {
        id: 'a2',
        alert: {
          informedEntity: [{ routeId: '1716', stopId: '060001' }],
          effect: 'DETOUR',
          headerText: { translation: [{ text: 'Desvio na linha 1716', language: 'pt' }] },
        },
      },
      { id: 'a3', alert: { effect: 'ADDITIONAL_SERVICE', header_text: { translation: [{ text: 'Reforço' }] } } },
    ],
  },
};

describe('GTFS-RT alerts (TML GO hub, Carris Metropolitana)', () => {
  const out = parseAlerts(tmlAlerts, 'tml', 'tml');

  it('reads the { data: FeedMessage } wrapper and skips no-impact alerts', () => {
    expect(out.map((d) => d.id)).toEqual(['tml:a1', 'tml:a2']);
  });

  it('maps a Metro route to a Mobee line key and reads the delay', () => {
    expect(out[0]).toMatchObject({ lines: ['ml:green'], effect: 'delay', delayMin: 12, start: 1794650000000, end: 1794660000000 });
    expect(out[0].header).toEqual({ pt: 'Linha Verde com 12 min de atraso', en: 'Green line delayed 12 min' });
  });

  it('accepts camelCase and keeps bus routes and stops', () => {
    expect(out[1]).toMatchObject({ lines: ['tml:1716'], stops: ['tml:060001'], effect: 'detour' });
  });

  it('accepts a bare entity array', () => {
    expect(parseAlerts(tmlAlerts.data.entity, 'carris-metropolitana', 'cm')).toHaveLength(2);
  });

  it('never throws on junk', () => {
    expect(parseAlerts(null, 'tml', 'tml')).toEqual([]);
    expect(parseAlerts({ data: 'oops' }, 'tml', 'tml')).toEqual([]);
  });
});

describe('line normalisation', () => {
  it('only reads colours as Metro lines in a Metro context', () => {
    expect(linesFromText('Metro: Linha Azul interrompida')).toEqual(['ml:blue']);
    expect(linesFromText('Red carpet event')).toEqual([]);
  });
  it('reads CP lines', () => expect(linesFromText('Perturbações na Linha de Sintra')).toEqual(['cp:sintra']));
  it('route ids', () => expect(lineFromRoute('ML_AMARELA', 'ML')).toEqual(['ml:yellow']));
  it('Carris Metropolitana route ids as seen live: "[LA77N]1628_0"', () => {
    expect(lineFromRoute('[LA77N]1628_0', 'LA77N', 'cm')).toEqual(['cm:1628']);
  });
  it('delays', () => expect(delayFromText('Atraso de 15 minutos')).toBe(15));
});

describe('IPMA', () => {
  const warnings = [
    { text: 'Chuva por vezes forte', awarenessTypeName: 'Precipitação', idAreaAviso: 'LSB', startTime: '2026-11-17T09:00:00', endTime: '2026-11-17T18:00:00', awarenessLevelID: 'yellow' },
    { text: '', awarenessTypeName: 'Vento', idAreaAviso: 'LSB', startTime: '2026-11-17T09:00:00', endTime: '2026-11-17T18:00:00', awarenessLevelID: 'green' },
    { text: '', awarenessTypeName: 'Precipitação', idAreaAviso: 'PTO', startTime: '2026-11-17T09:00:00', endTime: '2026-11-17T18:00:00', awarenessLevelID: 'orange' },
  ];
  it('keeps Lisbon warnings above green', () => {
    const out = parseWarnings(warnings);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ effect: 'weather', weather: { kind: 'rain', level: 'yellow' } });
  });
  it("reads today's precipitation probability", () => {
    expect(parseRainProbability({ data: [{ forecastDate: '2026-11-17', precipitaProb: '82.0' }] }, '2026-11-17')).toBe(82);
  });
});

describe('Metro de Lisboa line status', () => {
  it('turns non-Ok lines into disruptions', () => {
    const out = parseLineStatus({ resposta: { amarela: 'Ok', azul: 'Ok', verde: 'Perturbações na circulação', vermelha: 'Circulação interrompida' }, codigo: '200' }, 0);
    expect(out.map((d) => [d.lines[0], d.effect])).toEqual([['ml:green', 'delay'], ['ml:red', 'no-service']]);
  });
});
