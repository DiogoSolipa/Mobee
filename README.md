# Mobee: MVP foundations

**Plans change. Mobee adapts.**

This is the foundation for the Mobee pilot. It's a Next.js app that runs on Vercel and works on a phone as an installable web app. It proves the core loop: **something changes → Mobee proposes a new plan → you adjust or keep it → you can undo**. It's built on the Mobee design system (tokens, Day/Night themes, the 15 icons, the logo and the components) and on the MVP functional requirements doc.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 52 tests: replan engine, trip planner, feed parsers
npm run build      # production build
```

Open it and tap **Try Rita's Tuesday**. That loads the worked example with the clock set to 10:12. Then:

- Tap **Leaving later** → **+30 min**. The pharmacy moves later, the groceries move to tomorrow at 09:30, and the 12:30 school pickup stays fixed. Tap **Adjust stops**, then **Undo**.
- Go to **Live** (the status chip, top right) → **Green line suspended**, or **Rain warning**. These simulated events go through the same pipeline as live ones.
- Change **When plans change, prefer** while a proposal is open, and the proposal is re-scored.
- In **Settings**, switch to Português or Night.

## Deploy on Vercel

1. Push this folder to a GitHub repo.
2. On vercel.com, choose **Add New → Project**, import the repo and keep the defaults (Next.js is detected automatically).
3. Optional environment variables (see `.env.example`):
   - `METRO_LISBOA_BASIC_AUTH`: the base64 string after `Authorization: Basic` in the Metro de Lisboa API store's curl example. (Or `METRO_LISBOA_CONSUMER_KEY` + `METRO_LISBOA_CONSUMER_SECRET`, and `METRO_LISBOA_USERNAME` + `METRO_LISBOA_PASSWORD` if the store requires the password grant.) Without these, that source shows as "Not set up" and the GO hub still carries Metro alerts.
   - `METRO_LISBOA_INSECURE_TLS=true`: only if `/live` reports "TLS certificate rejected" for the Metro source. The store's own example uses `curl -k`. This setting affects that one host only.
   - **Keys go in Vercel's Environment Variables, or in `.env.local` on your machine (git-ignored). Never put them in a committed file.**
   - `TML_GO_BASE`, `CARRIS_METROPOLITANA_BASE`, `IPMA_BASE`: override these only if a provider moves an endpoint.
4. Deploy. Or run `npx vercel` from this folder.

On a phone, use **Add to Home Screen**: the manifest and icon make it open full screen.

## Live data

The phone never calls an operator. `/api/feeds` runs as a Vercel function: it calls every source on the server, normalises them into one `Disruption` shape, caches the result for 30 s and reports each feed's health. The app polls it every 60 s and whenever it comes back into view.

| Source | What Mobee uses | File |
| --- | --- | --- |
| TML GO hub `go.tmlmobilidade.pt/hub/api/v1/alerts/gtfs` | GTFS-RT service alerts for the Lisbon-area operators | `src/lib/feeds/gtfsrt.ts` |
| Carris Metropolitana `api.carrismetropolitana.pt/v2/alerts` | GTFS-RT alerts; `/api/arrivals/:stopId` proxies arrival estimates | same parser |
| Metro de Lisboa `EstadoServicoML 1.0.1` | Line status, used as a backup (needs a key) | `src/lib/feeds/metroLisboa.ts` |
| IPMA `warnings_www.json` + daily forecast 1110600 | Rain warnings for Lisbon (LSB) and today's chance of rain | `src/lib/feeds/ipma.ts` |

If a source fails, the Live screen says so, and Today shows "Live data unavailable. Times use timetables." The app keeps working; stale data is never shown as live.

**First week: probe the feeds.** The parsers were written against each provider's documentation. The build machine couldn't reach the APIs, so they haven't seen a real response yet. After the first deploy:

1. Open `/api/feeds` and `/live` on the deployed URL and check that every source shows **Live**.
2. Save one real response from each source into `src/lib/feeds/__fixtures__/` and point the tests at them.
3. Check how the GO hub names Metro and CP routes in `informed_entity` (for example `route_id`, `agency_id`), and adjust `lineFromRoute()` in `src/lib/feeds/lines.ts` if needed. That mapping is what links an alert to a person's leg.
4. One open-source client reported a 404 on the GO hub's vehicle-positions endpoint in early November 2026. Mobee only uses `/alerts/gtfs` for now. If paths change, set `TML_GO_BASE`.

## Trip planner

Legs come from a real trip planner: **MOTIS 2** (open source), via `/api/legs`. It combines the operators' GTFS timetables, live data where available, and OpenStreetMap for walking, with elevation. No distances are guessed: if a route isn't loaded yet, the leg says "Finding route…" and Mobee doesn't propose anything until it has one.

- **How a leg is chosen** (`src/lib/engine/travel.ts`, `MatrixPlanner`): from the planner's options, Mobee keeps only departures you can still catch, and the wait counts. It then:
  - drops lines that are suspended and adds live delays;
  - applies your rules: "Walk under 10 min"; "Avoid hills", using the metres climbed on the walking route; "Bus when it rains"; "Step-free", which asks the planner for wheelchair routes;
  - scores what's left by your priority.
- **Place search** (`/api/places`): the stop sheet searches places and addresses around Lisbon with the same planner's geocoder. The saved places are shortcuts.
- **Which planner**: `TRIP_PLANNER_URL` defaults to `https://api.transitous.org`, a community MOTIS instance. Its usage policy is for open-source, non-commercial projects with light use. More than about 720 route requests a day has to be agreed with them, and commercial use is not allowed. Mobee caches every route for 10 minutes, asks only for the legs on screen or in a proposal, and sends an identifying `User-Agent` (`TRIP_PLANNER_USER_AGENT`). That is fine for the pilot.
- **Production**: run your own MOTIS 2 server (it runs on modest hardware, for example a small VM on Railway, Render or Fly) and point `TRIP_PLANNER_URL` at it. The code doesn't change. Feeds for the Lisbon area:
  - OpenStreetMap: Portugal extract from Geofabrik (`portugal-latest.osm.pbf`)
  - Carris Metropolitana: `https://api.carrismetropolitana.pt/gtfs`
  - Carris: `https://gateway.carris.pt/gateway/gtfs/api/v2.8/GTFS`
  - Transtejo/Soflusa: `https://api.transtejo.pt/files/GTFS.zip`
  - TML unified plans (GO hub, organisation `0XJC9`): `/v1/0XJC9/plans/gtfs` (check the path in the GO hub docs)
  - Metro de Lisboa, CP and Fertagus: from their open-data pages or the Mobility Database

  Follow the MOTIS README (`motis config <osm.pbf> <gtfs...>`, then `motis import` and `motis server`). Add GTFS-RT feeds for live delays.
- **Debug**: `/api/debug/motis` shows the planner's normalised options for three of Rita's legs, and `/api/debug/feeds` shows the raw alert feeds. Remove both before a public launch.

## How it's built

```
src/
  app/
    page.tsx              Today: greeting, replan prompt, priority, journey timeline, tomorrow
    live/page.tsx         Feed health, current disruptions, simulator
    settings/page.tsx     Name, language, theme, priority, travel rules, contexts, notifications, erase data
    api/feeds/            Server-side feed aggregator (FR-32 – FR-37)
    api/replan/           The replan engine as an API (MCP-ready: proposes, never applies)
    api/arrivals/[stopId] Carris Metropolitana arrivals proxy
    tokens.css            Design tokens, Day + Night (from the design system's tokens.json)
    globals.css           Ported design-system component styles + app shell
  components/ds/          Logo, Icon, Button, Chip, StatusPill, Segmented, Notification (typed ports)
  components/app/         ReplanCard, Timeline, Stop / Leaving-later sheets, shell
  lib/
    domain/               Types (Stop, Leg, Disruption, Proposal…), Lisbon time, place catalogue
    engine/travel.ts      TripPlanner interface + MatrixPlanner (real routes, rules, disruptions)
    planner/              MOTIS client (server) + response normalisation
    engine/schedule.ts    Timeline + stop status (on time / adjusted / at risk)
    engine/triggers.ts    Disruptions → triggers for the next 3 h; merge; de-duplicate after Keep
    engine/replan.ts      The replan engine (pure, deterministic, tested)
    feeds/                Adapters + normalisation
    store.tsx             State, persistence, polling, the replan loop, notifications
    i18n.ts               pt-PT and English
    theme.ts              Day/Night switch at Lisbon sunset/sunrise
```

**The replan engine** (`engine/replan.ts`) works in four steps:

1. Work out when the person can leave. A "late" trigger pushes the departure.
2. Re-time every upcoming stop using the current legs. Disruptions and rain change the legs.
3. If a fixed stop, a time window or opening hours would break, try deferring movable stops (flexible ones first) to the next day. Keep the option the person's priority prefers: Fastest, Fewest changes or Calmest (Calmest adds 5-min buffers and avoids transfers).
4. Diff against the current plan. If there's no difference and nothing is at risk, there's no prompt.

Fixed stops never move. If a fixed stop can't be reached, the prompt says so and by how much.

## Requirements covered

| Area | Status |
| --- | --- |
| Day plan, stops, fixed, flexible (today / window / before a day) (FR-01–04) | Done. Opening hours are supported in the engine, but there's no input field yet |
| Timeline, legs, statuses, previous time (FR-06–08) | Done, with **real routes** from the trip planner (see below) |
| Triggers: leaving later, transit, rain, merge, de-duplicate (FR-09–13) | Done |
| Replan engine, priorities, at-risk, defer to next day, why-line (FR-14–18) | Done, with tests (Rita case) |
| Proposal, Adjust, Keep, Undo, live update (FR-19–23) | Done |
| Notifications (FR-24–25) | In-app banner, plus a system notification while the app is open in the background. True push when the app is closed needs Web Push (below) |
| Settings, contexts, rules, pt-PT/EN, Day/Night (FR-27–30) | Done |
| Accounts (FR-31) | Not yet. The plan is stored on the device |
| Feeds, normalisation, health, IPMA, Metro backup (FR-32–37) | Done. Needs the live probe above |
| Calendar import (FR-38) | Not yet |

## Next steps, in order

1. **Probe the feeds** (above) and fix the line mapping with real data.
2. **Own trip planner for production.** Run MOTIS yourself (see "Trip planner" below) and set `TRIP_PLANNER_URL`.
3. **Accounts and storage.** Sign in with Apple, Google or an email link, and keep plans in an EU-hosted Postgres (for example Vercel Postgres or Supabase in an EU region). The reducer stays the same; `load`/`save` in `store.tsx` become API calls.
4. **Real push.** Web Push (VAPID) with a service worker, and a Vercel Cron job that runs `detectTriggers` for each user's next 3 hours.
5. **Native shell.** If the pilot needs the lock-screen glance, wrap this app (Capacitor), or port the screens to React Native. The engine, feeds and i18n are plain TypeScript and move as they are.
6. Calendar import (one provider) and a place search.

Data credits: TML, Carris Metropolitana, Metro de Lisboa (CC BY 4.0), IPMA. The TML GO platform code is AGPL-3.0; Mobee only calls its public API.
