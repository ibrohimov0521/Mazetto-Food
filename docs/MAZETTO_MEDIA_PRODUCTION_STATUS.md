# MAZETTO FOOD Media Production Status

Updated: 2026-09-01

## Scope

This status covers the 74-item media pipeline proof batch prepared from local source assets. It records media generation infrastructure and owner-review proof outputs; production media upload, database update, and seed image path changes are separate controlled actions.

## Source Assets

| Source | Status | Notes |
| --- | --- | --- |
| `docs/design/source-media/menu mazetto.pdf` | Available | Used as the trusted exported menu source. Existing extracted product assets came from this PDF. |
| `docs/design/source-media/menu mazetto.cdr` | Available | Direct CDR extraction was not available with the current local tooling. |
| `C:\Users\javoh\Downloads\01-lavash.png` | Available | Used only as a visual style reference for the locked premium background. |

## Pipeline Output

The local pipeline lives in `media-source/`.

| Folder | Purpose |
| --- | --- |
| `media-source/backgrounds/` | Locked reusable MAZETTO premium product background. |
| `media-source/extracted/` | Proof-batch source objects copied from existing authentic PDF-derived assets. |
| `media-source/cleaned/` | Alpha-trimmed product objects. |
| `media-source/final/` | Final owner-review product images on the locked background. |
| `media-source/needs-ai/` | Reserved for later owner-approved real-photo/AI-assisted completion inputs. Empty in this proof batch. |

## Locked Background

| File | Canvas | Status |
| --- | --- | --- |
| `media-source/backgrounds/mazetto-premium-product-background.png` | 1600x1600 | Ready for owner review |

The same background file is used for every proof-batch output. It contains no logo, text, product name, price, or food object.

## Proof Batch

| File | Product label | Source object | Status | Notes |
| --- | --- | --- | --- | --- |
| `media-source/final/09-kurinniy-lavash.png` | Kurinniy Lavash | `chicken-lavash.webp` | Ready for owner review | Exact PDF-derived chicken lavash source. |
| `media-source/final/10-kurinniy-big-lavash.png` | Kurinniy Big Lavash | `chicken-lavash.webp` | Ready for owner review | PDF does not provide a separate big chicken lavash image; same source is reused at a larger presentation scale. |
| `media-source/final/11-kurinniy-lavash-pishloqli.png` | Kurinniy Lavash Pishloqli | `chicken-cheese-lavash.webp` | Ready for owner review | Exact PDF-derived chicken cheese lavash source. |
| `media-source/final/12-kurinniy-big-lavash-pishloqli.png` | Kurinniy Big Lavash Pishloqli | `chicken-cheese-lavash.webp` | Ready for owner review | PDF does not provide a separate big chicken cheese lavash image; same source is reused at a larger presentation scale. |

## Authenticity Notes

- No ingredients were invented.
- No fake product photos were generated.
- The proof batch uses existing MAZETTO PDF-derived transparent product objects.
- The two `big` chicken lavash proof images reuse the matching chicken/chicken-cheese visual because the PDF shows them as menu SKUs without a distinct separate product photo.

## Manifest

Structured output manifest:

`media-source/mazetto-media-manifest.json`

It records source paths, final paths, hashes, canvas size, and local-only safety flags.

## Remaining Work

Before processing all 74 catalog items, owner review is needed for:

1. Whether the locked background style is approved.
2. Whether reused big-variant visuals are acceptable when the source menu has no separate big product image.
3. Whether low-resolution PDF-derived objects should be accepted for production or replaced by new real photos.
4. Whether unresolved products without source visuals should receive real product photography or explicitly approved generated assets later.

Known unresolved media from previous audit remains separate from this proof batch and was not changed here.
