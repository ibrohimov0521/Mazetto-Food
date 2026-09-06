# MAZETTO FOOD Media Production Status

Updated: 2026-09-06

## Scope

This status covers the 74-item media pipeline prepared from owner-provided local source assets. It records media generation infrastructure, source custody, and the production media release status.

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

## Canonical Source Batch

| Files | Catalog coverage | Status | Notes |
| --- | --- | --- | --- |
| `media-source/final/1.png` through `media-source/final/74.png` | 56 standalone products and 18 sets | Released and retained as source assets | Numbered in the owner-approved canonical menu order. Optimized WebP derivatives live under `apps/customer-web/public/menu-media/source/products/`. |

## Authenticity Notes

- No ingredients were invented.
- No fake product photos were generated.
- The canonical batch uses the owner-provided product/set images.
- The numbered source files are retained for traceability; generated QA screenshots and temporary release artifacts are not application source.

## Manifest

Structured output manifest:

`media-source/mazetto-media-manifest.json`

It records source paths, final paths, hashes, canvas size, and local-only safety flags.

## Remaining Work

The canonical 74 product/set media release is complete for customer-visible catalog items. Future media work should preserve the numbered source batch and regenerate optimized derivatives from it when product imagery changes.
