# Cart And Network Reliability

## Deployment

Both frontend services must share `dokploy-network` with `mazetto-food-backend-pdslpm`.
Their `/api/v1/*` rewrites now target `http://mazetto-food-backend-pdslpm:4000`,
not the public Cloudflare hostname. `API_INTERNAL_URL` can override this origin
at build time. Development defaults to `http://127.0.0.1:4000`.
The customer Docker image also supplies the internal `CUSTOMER_SEO_API_URL`
at runtime, so redeploys retain the server-rendered catalog connection.
Never put credentials in either URL.

## Findings

- Historical POS and customer logs contained outbound public API timeouts and IPv6 unreachable errors.
- The current backend was healthy, with no matching application exceptions in the reviewed six-hour window.
- Tunnel logs contained client-cancelled WebSocket requests and one DNS resolver timeout. A client cancellation alone does not prove a server outage.
- The laptop returned HTTP 200 for eight menu and eight catalog requests, but Chrome 152 in a fresh profile then reproduced `ERR_QUIC_PROTOCOL_ERROR` and `ERR_CONNECTION_RESET` before loading the page. Disabling QUIC, HTTP/2 or bypassing the system proxy did not resolve that failure window. A TLS-1.2-only diagnostic session succeeded.
- Later, the same laptop successfully loaded the site with unmodified Chrome over QUIC and with TLS 1.3. The user independently reported spontaneous recovery. This demonstrates an intermittent browser-to-edge connection problem, not a proven permanent TLS incompatibility. No permanent browser, DNS, firewall or Cloudflare TLS settings were weakened. The proxy change addresses server-to-API failures, not a proven cure for all connection resets.
- The menu now retains its loaded catalog during a failed refresh and exposes a retry action. Checkout still obtains authoritative backend validation.

## Checks

Run `node scripts/qa-customer-upsell-scroll.mjs` against isolated frontend containers
on localhost ports 3103 and 3104 (override with `QA_BASE` and `QA_POS`).
The test covers 320/390/768/1440px layouts, page-only scrolling, persistent checkout action,
proxy authentication, and catalog refresh recovery. It blocks write requests in cart tests.

If a whole-browser reset recurs, capture the exact timestamp, URL, browser error,
network used, and Cloudflare Ray ID if available. Compare frontend, backend and tunnel
logs for that same interval before changing DNS, firewall, or Cloudflare security settings.

Cloudflare recommends isolating protocol/network interference and warns against permanently
disabling TLS 1.3 as a workaround: https://developers.cloudflare.com/ssl/troubleshooting/err-ssl-protocol-error/.
