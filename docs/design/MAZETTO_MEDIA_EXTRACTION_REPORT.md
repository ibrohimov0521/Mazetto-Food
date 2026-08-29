# MAZETTO Media Extraction Report

Source PDF: `docs/design/source-media/menu mazetto.pdf`.
Source CDR: `docs/design/source-media/menu mazetto.cdr` was present, but direct CDR extraction was not available locally, so the CorelDRAW-exported PDF was used.

## Summary

- Products in database manifest: 35
- Categories in database manifest: 10
- Product assets extracted/recovered: 27
- Category assets extracted: 10
- Exact matches: 18
- High-confidence matches: 2
- Manual-review matches: 6
- Authentic composite recoveries: 1
- Missing / generation-needed: 8
- GOOD product assets: 18
- ACCEPTABLE product assets: 9
- NEEDS GENERATION product assets: 8

## Step 6 Re-Audit Update

Step 6 re-audited the supplied `menu mazetto.pdf` directly, including every page render and 159 embedded image objects. The local environment still has no trustworthy CDR extraction tool available for `menu mazetto.cdr`, so CDR direct recovery remains unavailable.

Recovered/corrected media:

- `Pishloqli fri` is now an authentic composite recovery at `/menu-media/source/products/cheese-fries.webp`, built only from the MAZETTO fries source and the actual yellow `Pishloqli sous` source from PDF page 2. No cheese or new food content was painted onto the fries.
- `Pishloqli sous` was corrected to the actual yellow cheese sauce object from PDF page 2. The prior local file was the nearby purple garlic sauce object and did not match the database product.

Step 6 authenticity classification for the original 9 missing keys:

| Key | Product | Classification | Evidence |
| --- | --- | --- | --- |
| `cheese-fries` | Pishloqli fri | C. AUTHENTIC COMPOSITE RECOVERY | Recovered from real MAZETTO fries plus real yellow pishloqli sous source. |
| `chicken-strips` | Tovuqli strips | F. NEEDS NEW REAL PHOTO | PDF has nuggets and chicken balls, but no strips visual. |
| `coca-cola` | Coca-Cola | F. NEEDS NEW REAL PHOTO | PDF shows Pepsi bottles, not Coca-Cola. |
| `fanta` | Fanta | F. NEEDS NEW REAL PHOTO | No Fanta package appears in the supplied source. |
| `sprite` | Sprite | F. NEEDS NEW REAL PHOTO | No Sprite package appears in the supplied source. |
| `water` | Suv | F. NEEDS NEW REAL PHOTO | No still water bottle appears; the visible carton is juice. |
| `house-sauce` | Maxsus sous | F. NEEDS NEW REAL PHOTO | No MAZETTO maxsus sous visual appears. |
| `spicy-sauce` | Achchiq sous | F. NEEDS NEW REAL PHOTO | No dedicated achchiq sous visual appears. |
| `set-kids` | Bolalar seti | F. NEEDS NEW REAL PHOTO | No kids set composition appears, and no water source exists for a truthful composite. |

Unresolved after re-audit:

- `Tovuqli strips`: the PDF contains nuggets and chicken balls, but no clear strips product.
- `Coca-Cola`, `Fanta`, `Sprite`: the PDF set pages show Pepsi bottles, not these Coca-Cola Company products.
- `Suv`: the PDF contains a juice carton, not still water.
- `Maxsus sous`: the PDF contains ketchup, cheese sauce, and garlic sauce, but no MAZETTO house sauce.
- `Achchiq sous`: no dedicated spicy sauce visual appears in the supplied source.
- `Bolalar seti`: no kids-set composition appears, and the database set includes water while no water source is available for a truthful composite.

## Product Mapping

| Product | Category | Source page | Source label | Confidence | Quality | Output | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Katta lavash | Lavash | 1 | Big Lavash | exact | GOOD | /menu-media/source/products/lavash-big.webp | Large grilled lavash roll with meat filling. |
| Klassik lavash | Lavash | 1 | Lavash | exact | GOOD | /menu-media/source/products/lavash-classic.webp | Classic grilled lavash roll with meat filling. |
| Mini lavash | Lavash | 1 | Lavash | manual-review | ACCEPTABLE | /menu-media/source/products/lavash-mini.webp | Smaller lavash visual reused because the printed menu has no Mini Lavash label. |
| Mol go'shtli lavash | Lavash | 1 | Lavash | manual-review | ACCEPTABLE | /menu-media/source/products/lavash-beef.webp | Classic lavash source reused for current beef lavash naming. |
| Tovuqli lavash | Tovuqli lavash | 1 | Kurinniy Lavash | exact | GOOD | /menu-media/source/products/chicken-lavash.webp | Chicken lavash roll. |
| Tovuqli pishloqli lavash | Tovuqli lavash | 1 | Kurinniy Lavash Pishloqli | exact | GOOD | /menu-media/source/products/chicken-cheese-lavash.webp | Chicken cheese lavash roll. |
| Tovuqli achchiq lavash | Tovuqli lavash | 1 | Achchiq Kurinniy Lavash | exact | GOOD | /menu-media/source/products/chicken-spicy-lavash.webp | Spicy chicken lavash roll. |
| Klassik burger | Burgerlar | 2 | Burger | exact | GOOD | /menu-media/source/products/burger-classic.webp | Classic beef burger. |
| Katta burger | Burgerlar | 2 | Double Burger | manual-review | ACCEPTABLE | /menu-media/source/products/burger-big.webp | Double burger source reused for current Katta burger. |
| Chizburger | Burgerlar | 2 | Chizburger | exact | GOOD | /menu-media/source/products/cheeseburger.webp | Cheeseburger. |
| Double burger | Burgerlar | 2 | Double Burger | exact | GOOD | /menu-media/source/products/burger-double.webp | Double beef burger. |
| Tovuqli burger | Tovuqli burgerlar | 2 | Chicken Burger | exact | GOOD | /menu-media/source/products/chicken-burger.webp | Chicken burger. |
| Qarsildoq tovuqli burger | Tovuqli burgerlar | 2 | Chicken Burger | manual-review | ACCEPTABLE | /menu-media/source/products/crispy-chicken-burger.webp | Chicken burger visual reused; current crispy naming needs a dedicated photo later. |
| Tovuqli chizburger | Tovuqli burgerlar | 2 | Chicken Chizburger | exact | GOOD | /menu-media/source/products/chicken-cheeseburger.webp | Chicken cheeseburger. |
| Klassik hot-dog | Hot Dog | 2 | Salatli hot dog | high | GOOD | /menu-media/source/products/hot-dog-classic.webp | Classic salad hot dog style source. |
| Pishloqli hot-dog | Hot Dog | 2 | Salatli hot dog katta | manual-review | ACCEPTABLE | /menu-media/source/products/hot-dog-cheese.webp | Hot dog source reused; printed menu has no pishloqli hot-dog match. |
| Double hot-dog | Hot Dog | 2 | Shashlikli Hod Dog | manual-review | ACCEPTABLE | /menu-media/source/products/hot-dog-double.webp | Large hot dog source reused; printed menu has no double hot-dog match. |
| Doner lavash | Doner | 1 | Doner | exact | GOOD | /menu-media/source/products/doner-wrap.webp | Doner wrap. |
| Doner tarelka | Doner | 1 | Doner Blyuda | exact | GOOD | /menu-media/source/products/doner-plate.webp | Doner plate with fries and salad. |
| Tovuqli doner | Doner | 1 | Kurinniy Doner | exact | GOOD | /menu-media/source/products/chicken-doner.webp | Chicken doner wrap. |
| Fri kartoshka | Gazaklar | 2 | Kartoshka fri | exact | GOOD | /menu-media/source/products/fries.webp | Fries in MAZETTO branded pack. |
| Pishloqli fri | Gazaklar | 2 | Kartoshka fri + Pishloqli sous | composite | ACCEPTABLE | /menu-media/source/products/cheese-fries.webp | Authentic composite from MAZETTO fries and actual yellow pishloqli sous source; no food content was invented. |
| Tovuqli strips | Gazaklar |  |  | missing | NEEDS GENERATION |  | Printed menu has chicken balls and nuggets, but no clear strips product. |
| Naggets | Gazaklar | 2 | Naggets 5 dona | exact | GOOD | /menu-media/source/products/nuggets.webp | Chicken nuggets. |
| Coca-Cola | Ichimliklar |  |  | missing | NEEDS GENERATION |  | Printed menu set pages show Pepsi bottles, not Coca-Cola. |
| Fanta | Ichimliklar |  |  | missing | NEEDS GENERATION |  | No Fanta product image appears in the supplied menu source. |
| Sprite | Ichimliklar |  |  | missing | NEEDS GENERATION |  | No Sprite product image appears in the supplied menu source. |
| Suv | Ichimliklar |  |  | missing | NEEDS GENERATION |  | No still water product image appears in the supplied menu source. |
| Maxsus sous | Souslar |  |  | missing | NEEDS GENERATION |  | Printed menu includes ketchup, cheese sauce, and garlic sauce, but not MAZETTO house sauce. |
| Pishloqli sous | Souslar | 2 | Pishloqli sous | exact | GOOD | /menu-media/source/products/cheese-sauce.webp | Corrected to the yellow cheese sauce pack and cup from PDF page 2. |
| Achchiq sous | Souslar |  |  | missing | NEEDS GENERATION |  | No dedicated spicy sauce image appears in the supplied source. |
| Oilaviy set | Setlar | 3 | Oilaviy set | exact | GOOD | /menu-media/source/products/set-family.webp | Family set composition from page 3. |
| Lavash set | Setlar | 3 | Lavash seti | exact | ACCEPTABLE | /menu-media/source/products/set-lavash.webp | Lavash set composition from page 3. |
| Burger set | Setlar | 3 | Chizburger seti | high | ACCEPTABLE | /menu-media/source/products/set-burger.webp | Burger set composition source; closest to current Burger set. |
| Bolalar seti | Setlar |  |  | missing | NEEDS GENERATION |  | No current Bolalar seti composition appears in page 3. |

## Category Mapping

| Category | Source page | Source label | Quality | Output |
| --- | --- | --- | --- | --- |
| Lavash | 1 | Big Lavash category hero | GOOD | /menu-media/source/categories/lavash.webp |
| Tovuqli lavash | 1 | Chicken lavash category hero | GOOD | /menu-media/source/categories/chicken-lavash.webp |
| Burgerlar | 2 | Burger category hero | GOOD | /menu-media/source/categories/burger.webp |
| Tovuqli burgerlar | 2 | Chicken burger category hero | GOOD | /menu-media/source/categories/chicken-burger.webp |
| Hot Dog | 2 | Hot dog category hero | GOOD | /menu-media/source/categories/hot-dog.webp |
| Doner | 1 | Doner plate category hero | GOOD | /menu-media/source/categories/doner.webp |
| Gazaklar | 2 | Fast food fries category hero | GOOD | /menu-media/source/categories/fast-food.webp |
| Ichimliklar | 1 | Moxito drink category hero | ACCEPTABLE | /menu-media/source/categories/drinks.webp |
| Souslar | 2 | Cheese sauce category hero | GOOD | /menu-media/source/categories/sauces.webp |
| Setlar | 3 | Family set category hero | GOOD | /menu-media/source/categories/sets.webp |

## Integration

Customer-web still uses the API image path as the primary source. If that URL fails, `MediaImage` falls back to `/menu-media/source/products/*` or `/menu-media/source/categories/*`, then to the branded placeholder.
