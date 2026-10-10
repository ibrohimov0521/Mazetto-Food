# MAZETTO Print Agent (legacy fallback)

Production printing is owned by **MAZETTO Desktop**. This separate agent is a
controlled fallback and is disabled by default. Do not run it for a branch at
the same time as Desktop.

## Configuration

- `MAZETTO_API_URL` - backend API, for example `https://api.mazettofood.uz/api/v1`.
- `MAZETTO_LEGACY_PRINT_AGENT_ENABLED=true` - explicitly enables the fallback.
- `MAZETTO_PRINT_AGENT_TOKEN` - staff token with `RECEIPT_VIEW` and `RECEIPT_PRINT` permissions.
- `MAZETTO_BRANCH_ID` - branch to poll. Set this unless the authenticated account resolves to exactly one branch.
- `MAZETTO_PRINT_DRY_RUN` - defaults to dry-run. Set `false` only for a controlled real print test.
- `MAZETTO_PRINTER_MODE` - `file`, `stdout`, or `tcp`.
- `MAZETTO_PRINT_OUTPUT_DIR` - output directory for `file` mode.
- `MAZETTO_PRINTER_HOST` and `MAZETTO_PRINTER_PORT` - ESC/POS TCP printer address; port defaults to `9100`.
- `MAZETTO_PRINT_HEALTH_PORT` - local status port, default `7357`. The server binds to `127.0.0.1` by default.
- `MAZETTO_PRINT_PROTOCOL=jobs` - durable queue protocol; required for real TCP printing.
- `MAZETTO_PRINT_PRINTER_IDS` - comma-separated printer IDs assigned to this agent.
- `MAZETTO_PRINT_ACCEPT_UNASSIGNED=true` and `MAZETTO_PRINT_UNASSIGNED_ROUTES` - explicitly allow unassigned routes. Allowed routes: `RECEIPT`, `KITCHEN`, `CANCELLATION`, `REFUND`.

## Test modes

Dry-run:

```bash
MAZETTO_LEGACY_PRINT_AGENT_ENABLED=true pnpm --filter print-agent start -- --once
```

File output:

```bash
MAZETTO_LEGACY_PRINT_AGENT_ENABLED=true MAZETTO_PRINT_DRY_RUN=false MAZETTO_PRINTER_MODE=file pnpm --filter print-agent start
```

Real TCP output must use the durable jobs protocol and a real printer ID from
the backend configuration:

```bash
MAZETTO_LEGACY_PRINT_AGENT_ENABLED=true MAZETTO_PRINT_DRY_RUN=false MAZETTO_PRINT_PROTOCOL=jobs MAZETTO_PRINT_PRINTER_IDS=YOUR_PRINTER_ID MAZETTO_PRINTER_MODE=tcp MAZETTO_PRINTER_HOST=192.168.1.50 pnpm --filter print-agent start
```

The agent refuses to claim jobs unless at least one printer ID or an explicit
unassigned route is configured. Real TCP printing with the legacy `receipts`
protocol is blocked because that API has no durable job identity for recording
uncertain physical output.

## Queue and recovery

`jobs` claims one lease at a time. A successful adapter submission is recorded
as `SUBMITTED`; this confirms that the adapter accepted the data, not that paper
physically emerged. Safe failures return to the queue. A connection failure
after TCP connect, or a lost backend acknowledgement after sending data, is
`AMBIGUOUS` and is not automatically reprinted.

If the agent cannot save an ambiguous result because the backend is unreachable,
it stops polling and remains degraded. After connectivity returns, an operator
must inspect `/status`, the job queue, and the paper before restarting it or
manually retrying a job. A disconnected generic printer cannot prove whether it
printed; physical output must be checked on the device.

Do not run the legacy `receipts` poller and durable `jobs` poller together.
Production transition:

1. Deploy the backend with `MAZETTO_DURABLE_PRINT_JOBS` still disabled.
2. Stop the old receipt poller.
3. Start the new agent in dry-run mode with `MAZETTO_PRINT_PROTOCOL=jobs` and confirm `/health` is ready.
4. Enable `MAZETTO_DURABLE_PRINT_JOBS=true` and restart the backend.
5. Perform a controlled paper test and verify the job state before handing the printer to staff.

Dry-run does not claim work or mark any receipt as submitted.

## Local status

Open `http://127.0.0.1:7357/` on the agent machine. JSON status is available at
`/status`, and health at `/health`.
