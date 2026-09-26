# BestTeam Platform Monitoring

The owner monitoring screen is a separate frontend intended for `admin.mazetto.uz`, but it calls the normal shared Mazetto API and database. `mazettofood.uz` remains one restaurant's domain; restaurant-branded apps and Telegram bots are separate while their business APIs/data are intended to be shared. The current `PlatformSite` registry stores monitoring configuration and telemetry only. It is not yet the tenant registry and does not provide tenant-level data isolation.

## Add A Restaurant

1. Sign in to the BestTeam owner app and open **Restoranlar**.
2. Add the restaurant name, public website URL, and public backend health URL. Both URLs must use HTTPS and a publicly resolvable domain.
3. Copy the one-time agent settings shown after creation into the restaurant backend's secret environment configuration.
4. Restart that restaurant backend. Its heartbeat should appear within one minute; public site and API probes run once per minute.

The central agent endpoint should end at `/api/v1/platform/heartbeat`. If the API host is separate from the admin website host, use the API host here. The owner web app calls its backend through a same-origin proxy, so browser CORS access to restaurant or owner APIs is not needed.

## Restaurant Backend Settings

Set all three values together. The token is shown only at creation or explicit rotation.

```dotenv
BESTTEAM_MONITOR_URL=https://admin.mazetto.uz/api/v1/platform/heartbeat
BESTTEAM_INSTANCE_KEY=mz_key_shown_by_the_panel
BESTTEAM_INSTANCE_TOKEN=one_time_secret_shown_by_the_panel
```

The token is stored as a SHA-256 digest centrally and sent in an HTTPS header. Rotating it invalidates the previous token immediately. Heartbeats are sent once per minute. The panel considers an agent offline after three minutes without a heartbeat.

## What Is Reported

- Website and API HTTPS reachability, HTTP status, latency, and last check time.
- Backend, database, and Redis readiness.
- Branch names/status, active order and kitchen queue counts, online/offline device counts, print dead-letter count, and last operational activity.
- A bounded stream of order and kitchen status changes, without customer names, phone numbers, order totals, addresses, or payment details.
- Website/API outages and recoveries, agent disconnect/reconnect, and service degradation/recovery are recorded in the operational event log. Repeated minute checks do not create duplicate disconnect events.
- Order and kitchen events carry the restaurant's branch ID, so the central panel can request one kitchen's recent events. Events written by older agents without a branch ID remain visible in the all-kitchens view.

The central probe accepts only HTTPS on public hostnames, resolves DNS before connecting, rejects private/reserved IP ranges, pins the connection to the validated address, and does not follow redirects. Keep health endpoints public but minimal; `/api/v1/health` reports service and database readiness only.

## Scope And Availability

This connector collects telemetry into the same Mazetto database, but the current restaurant schema and APIs are not tenant-isolated. Do not treat monitoring registration as restaurant provisioning or connect another tenant yet. Monitoring of `admin.mazetto.uz` itself requires an independent uptime checker because an application cannot report its own outage while offline.

The owner screen and monitoring routes are implemented in this repository and included in the shared backend module. No production migration, Dokploy object, DNS/TLS route, or monitoring secret has been changed. See `BESTTEAM_OWNER_CONSOLE.md` for the multi-tenant release gate.
