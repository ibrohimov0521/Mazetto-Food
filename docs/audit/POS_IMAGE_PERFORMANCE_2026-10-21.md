# POS catalog image performance

Date: 2026-10-21. Scope: cashier POS and waiter product images; Desktop 0.1.119.

## Observed cause

The public catalog contained 144 products with 143 distinct image URLs:
18 PNG and 125 WebP files. POS and the waiter picker used ordinary image
elements pointing at the full media file. Three sampled PNG responses were
1.83-1.98 MB each, despite being displayed in small product cards.
The existing media responses already had a one-year immutable cache header;
missing HTTP cache headers were not the cause of these oversized first loads.

## Change

- Product cards request responsive images through the existing Next image
  optimizer, at quality 75, with card-sized candidates and WebP negotiation.
- The first four product images load eagerly; the remaining images stay lazy.
- Only the configured media origin and base path use the optimizer. Legacy
  external images keep their original path. An optimizer error falls back to
  the original image, then the existing placeholder if that also fails.
- The packaged Desktop UI uses the POS web optimizer. Chromium stores these
  public image responses in its persistent profile cache, so the UI does not
  write an image cache into the application installation directory.
- Product sources, layout, checkout behavior and financial records are
  unchanged. No dependency or database migration was added.

## Measured payload

Same public source, same quality setting, 256 px optimized response:

| Source | Original bytes | Optimized WebP bytes | Reduction |
| --- | ---: | ---: | ---: |
| Lavash PNG | 1,981,386 | 8,922 | 99.5% |
| Drink PNG | 1,834,641 | 6,184 | 99.7% |
| Imported catalog WebP | 145,024 | 12,302 | 91.5% |

The initial optimizer misses took approximately 598-1,509 ms on the server,
including fetching and transforming the original. This is not a measurement
of the restaurant's network latency. Optimized responses are subsequently
cached; the first visit still needs a network connection.

## Validation evidence

- POS unit suite: 92/92 passed with Node 24, including media-origin and
  Desktop optimizer configuration tests. POS typecheck and scoped lint passed.
- Production POS build and bundled Desktop UI build passed.
- Headless Chromium checked 1440x920 and 390x844 with a mocked 12-product
  catalog and three real public image sources. There were no page exceptions
  or horizontal overflow, all sampled optimized image responses returned 200,
  and screenshots showed nonblank product images.
- Adding a product updated the cart in 10-21 ms in that local test and did not
  restart image requests. This is a small fixture measurement, not a full
  production performance guarantee.
- A forced optimizer failure followed by an original-image failure produced
  the existing placeholder.
- A separate persistent Chromium profile loaded an optimized image, closed
  the browser, reopened it, then loaded the image with networking disabled.
  The cached image rendered successfully. This test used no request routing.
- API calls in the UI test were mocked. No production order, payment, shift
  or catalog data was written.

Initial UI evidence is in the server temporary test directory
`/tmp/mazetto-pos-images-Z8ETGx` (screenshots and evidence.json).
The first UI run selected 384 px responses of 12,492-24,008 bytes. Responsive
device sizes were then refined to include small viewports; the final source
also supports the 256 px responses measured above.

## Acceptance boundary

The actual Windows workstation and its network were not measured in this
test. An image must have been downloaded before its offline cache is available;
a first-ever offline image is not certified by the cached-image test.
Installation of Desktop 0.1.119 and a short check with the restaurant's full
catalog remain workstation acceptance steps. This work does not certify all
application performance or replace the other audit acceptance records.
