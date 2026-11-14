import type { Disruption } from '../domain/types';

/**
 * Metro de Lisboa API store, EstadoServicoML 1.0.1 (backup source, FR-37).
 * Needs a free account: create an application, then client-credentials token at
 * https://api.metrolisboa.pt:8243/token and call /estadoServicoML/1.0.1/estadoLinha/todos.
 * Response shape (from community integrations): { resposta: { amarela: 'Ok', azul: '...', verde, vermelha, tipo_msg_am, ... }, codigo: '200' }
 */

const LINES: [string, string, string][] = [
  ['amarela', 'ml:yellow', 'Yellow line'],
  ['azul', 'ml:blue', 'Blue line'],
  ['verde', 'ml:green', 'Green line'],
  ['vermelha', 'ml:red', 'Red line'],
];

export function parseLineStatus(json: unknown, fetchedAt: number): Disruption[] {
  const r = (json as { resposta?: Record<string, string> })?.resposta;
  if (!r) return [];
  const out: Disruption[] = [];
  for (const [field, key, en] of LINES) {
    const status = String(r[field] ?? '').trim();
    if (!status || /^ok$/i.test(status)) continue;
    const s = status.toLowerCase();
    const effect: Disruption['effect'] = /interromp|encerrad|sem circula/.test(s) ? 'no-service' : /condicionad|reduzid/.test(s) ? 'reduced' : 'delay';
    out.push({
      id: `metro-lisboa:${field}:${s.slice(0, 24)}`,
      source: 'metro-lisboa',
      operator: 'Metro de Lisboa',
      lines: [key],
      stops: [],
      effect,
      start: fetchedAt,
      header: { pt: `Linha ${field[0].toUpperCase()}${field.slice(1)}: ${status}`, en: `${en}: ${effect === 'no-service' ? 'service suspended' : effect === 'reduced' ? 'reduced service' : 'delays'}` },
    });
  }
  return out;
}
