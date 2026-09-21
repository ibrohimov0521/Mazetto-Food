# Operations ownership and alert thresholds

## Telegram ownership

- Telegram delivers every update to the backend endpoint
  `/api/v1/telegram/webhook/:secret`. The backend alone parses customer and
  staff callbacks, changes orders, sends messages and owns idempotency.
- `telegram-bot` is a control-plane agent only. It reads `getWebhookInfo`,
  exposes health, and changes the webhook only during an explicit
  `--set-webhook` or `--delete-webhook` operator command.
- Never run polling and webhook consumers for the same bot token. Never point
  Telegram at the monitoring agent.

## Production alert ownership

| Signal | Warning | Critical | First owner |
| --- | --- | --- | --- |
| API/DB health | 2 failed probes | 5 failed probes or 5 minutes | Platform operator |
| Redis | degraded for 5 minutes | degraded for 30 minutes | Platform operator |
| Telegram pending updates | more than 5 for 5 minutes | more than 25 or Telegram last error | Operations manager |
| Print dead letters | any job | more than 5 jobs or oldest over 10 minutes | Branch manager |
| Enrolled Desktop offline | over 10 minutes | all branch devices offline | Branch manager |
| Offline mutation queue | oldest over 5 minutes | conflict/dead-letter or oldest over 30 minutes | Branch manager |
| Backup evidence | older than 24 hours | unavailable before deploy | Platform operator |

The Super Admin system-health page is the in-product triage view. External
monitoring must poll service health and Telegram agent health; notification
destinations and on-call contacts belong in deployment secrets, not this repo.

## Recovery order

1. Stop a release when database or backup evidence is not healthy.
2. Restore API/database connectivity before retrying queued mutations.
3. Resolve printer connectivity, then retry dead-letter jobs from Receipts.
4. Verify Telegram webhook URL/secret without deleting pending updates.
5. Export a redacted Desktop diagnostic bundle before reinstalling anything.
