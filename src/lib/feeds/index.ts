import 'server-only';
import { lisbonNow } from '../domain/time';
import type { Disruption, DisruptionSource, FeedHealth, FeedSnapshot } from '../domain/types';
import { parseAlerts } from './gtfsrt';
import { LISBON_FORECAST_ID, parseRainProbability, parseWarnings } from './ipma';
import { parseLineStatus } from './metroLisboa';

/**
 * Server-side feed aggregator (FR-32 – FR-37).
 * Runs in a Vercel function: operators are called from the server, never from the phone,
 * so there are no CORS problems and API keys stay secret.
 * Results are cached in memory for CACHE_MS per warm instance; the client polls /api/feeds.
 */

const CACHE_MS = 30_000;
const TIMEOUT_MS = 8_000;

const env = (k: string, d: string) => (process.env[k] && process.env[k]!.trim()) || d;
export const BASES = {
  tml: () => env('TML_GO_BASE', 'https://go.tmlmobilidade.pt/hub/api/v1'),
  cm: () => env('CARRIS_METROPOLITANA_BASE', 'https://api.carrismetropolitana.pt/v2'),
  ipma: () => env('IPMA_BASE', 'https://api.ipma.pt/open-data'),
};

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store', headers: { accept: 'application/json', 'user-agent': 'Mobee/0.1 (+pilot)', ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface SourceResult { disruptions: Disruption[]; rainProbability?: number }
interface Source { id: DisruptionSource; label: string; run: () => Promise<SourceResult | 'skipped'> }

export const TML_ALERT_PATHS = ['/alerts/gtfs', '/alerts', '/alerts/gtfs.json'];

let metroToken: { value: string; expires: number } | null = null;

/**
 * Metro de Lisboa (WSO2 API store) client credentials. Accepted, in order:
 *  - METRO_LISBOA_BASIC_AUTH: the base64 string from the store's curl example ("Authorization: Basic …")
 *  - METRO_LISBOA_CONSUMER_KEY + METRO_LISBOA_CONSUMER_SECRET
 * Grant: client_credentials, or password when METRO_LISBOA_USERNAME + METRO_LISBOA_PASSWORD are set.
 * Never commit these: set them in Vercel → Project → Settings → Environment Variables, or in .env.local.
 */
function metroBasic(): string | null {
  const basic = process.env.METRO_LISBOA_BASIC_AUTH?.trim().replace(/^Basic\s+/i, '');
  if (basic) return basic;
  const key = process.env.METRO_LISBOA_CONSUMER_KEY?.trim(), secret = process.env.METRO_LISBOA_CONSUMER_SECRET?.trim();
  return key && secret ? Buffer.from(`${key}:${secret}`).toString('base64') : null;
}

/**
 * The store's gateway (port 8243) has served a certificate that curl only accepts with -k.
 * Verification stays ON unless METRO_LISBOA_INSECURE_TLS=true, and that flag only affects this one host.
 */
async function metroRequest(path: string, init: { method?: 'GET' | 'POST'; headers: Record<string, string>; body?: string }): Promise<unknown> {
  const https = await import('node:https');
  const insecure = process.env.METRO_LISBOA_INSECURE_TLS === 'true';
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: 'api.metrolisboa.pt', port: 8243, path, method: init.method ?? 'GET', headers: { accept: 'application/json', ...init.headers }, rejectUnauthorized: !insecure, timeout: TIMEOUT_MS },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if ((res.statusCode ?? 500) >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
          try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', (e: NodeJS.ErrnoException) => reject(new Error(/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(e.code ?? e.message) ? `TLS certificate rejected (${e.code}); see README` : e.message)));
    if (init.body) req.write(init.body);
    req.end();
  });
}

async function metroBearer(): Promise<string | null> {
  const basic = metroBasic();
  if (!basic) return null;
  if (metroToken && metroToken.expires > Date.now() + 30_000) return metroToken.value;
  const user = process.env.METRO_LISBOA_USERNAME, pass = process.env.METRO_LISBOA_PASSWORD;
  const body = user && pass
    ? `grant_type=password&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`
    : 'grant_type=client_credentials';
  const json = (await metroRequest('/token', {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('No access token in response');
  metroToken = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 300) * 1000 };
  return metroToken.value;
}

export const SOURCES: Source[] = [
  {
    id: 'tml', label: 'TML GO hub · alerts (all Lisbon operators)',
    run: async () => {
      // The GO hub has moved paths between versions; try the documented ones in order.
      let lastErr: unknown;
      for (const path of TML_ALERT_PATHS) {
        try {
          return { disruptions: parseAlerts(await getJson(`${BASES.tml()}${path}`), 'tml', 'tml') };
        } catch (e) { lastErr = e; }
      }
      throw lastErr instanceof Error ? new Error(`${lastErr.message} on ${TML_ALERT_PATHS.join(', ')}`) : lastErr;
    },
  },
  {
    id: 'carris-metropolitana', label: 'Carris Metropolitana · alerts',
    run: async () => ({ disruptions: parseAlerts(await getJson(`${BASES.cm()}/alerts`), 'carris-metropolitana', 'cm') }),
  },
  {
    id: 'metro-lisboa', label: 'Metro de Lisboa · line status',
    run: async () => {
      const token = await metroBearer();
      if (!token) return 'skipped';
      const json = await metroRequest('/estadoServicoML/1.0.1/estadoLinha/todos', { headers: { authorization: `Bearer ${token}` } });
      return { disruptions: parseLineStatus(json, Date.now()) };
    },
  },
  {
    id: 'ipma', label: 'IPMA · warnings and Lisbon forecast',
    run: async () => {
      const [warnings, forecast] = await Promise.all([
        getJson(`${BASES.ipma()}/forecast/warnings/warnings_www.json`),
        getJson(`${BASES.ipma()}/forecast/meteorology/cities/daily/${LISBON_FORECAST_ID}.json`).catch(() => null),
      ]);
      return { disruptions: parseWarnings(warnings), rainProbability: forecast ? parseRainProbability(forecast, lisbonNow().date) : undefined };
    },
  },
];

/** Same alert published by two sources (GO and Carris Metropolitana) → keep one. */
function dedupe(list: Disruption[]): Disruption[] {
  const seen = new Set<string>();
  return list.filter((d) => {
    const k = `${d.effect}|${[...d.lines].sort().join(',')}|${d.header.pt ?? d.header.en ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

let cache: { at: number; snap: FeedSnapshot } | null = null;

export async function getSnapshot(force = false): Promise<FeedSnapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.snap;
  const settled = await Promise.allSettled(SOURCES.map((s) => s.run()));
  const health: FeedHealth[] = [];
  const disruptions: Disruption[] = [];
  let rainProbability: number | undefined;
  settled.forEach((r, i) => {
    const s = SOURCES[i];
    const base = { source: s.id, label: s.label, fetchedAt: Date.now() };
    if (r.status === 'rejected') {
      const msg = r.reason instanceof Error ? (r.reason.name === 'AbortError' ? 'Timed out' : r.reason.message) : String(r.reason);
      health.push({ ...base, ok: false, count: 0, error: msg });
    } else if (r.value === 'skipped') {
      health.push({ ...base, ok: false, count: 0, skipped: true, error: 'Not configured (API key missing)' });
    } else {
      disruptions.push(...r.value.disruptions);
      if (r.value.rainProbability !== undefined) rainProbability = r.value.rainProbability;
      health.push({ ...base, ok: true, count: r.value.disruptions.length });
    }
  });
  const snap: FeedSnapshot = { disruptions: dedupe(disruptions), health, rainProbability, generatedAt: Date.now() };
  cache = { at: Date.now(), snap };
  return snap;
}

/** Carris Metropolitana arrival estimates for one stop (FR-33). */
export async function getArrivals(stopId: string): Promise<unknown> {
  if (!/^[0-9A-Za-z_-]{1,20}$/.test(stopId)) throw new Error('Invalid stop id');
  return getJson(`${BASES.cm()}/arrivals/by_stop/${encodeURIComponent(stopId)}`);
}

/** Probe helper for /api/debug/feeds: status and the first bytes of each candidate endpoint. */
export async function probe(): Promise<{ url: string; status: number | string; sample: string }[]> {
  const urls = [
    ...TML_ALERT_PATHS.map((p) => `${BASES.tml()}${p}`),
    `${BASES.tml()}/realtime/vehicles/positions`,
    `${BASES.cm()}/alerts`,
  ];
  return Promise.all(urls.map(async (url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', headers: { accept: 'application/json' } });
      return { url, status: res.status, sample: (await res.text()).slice(0, 1500) };
    } catch (e) {
      return { url, status: e instanceof Error ? e.message : 'error', sample: '' };
    } finally { clearTimeout(timer); }
  }));
}
