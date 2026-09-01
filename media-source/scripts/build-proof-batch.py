from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
MEDIA_ROOT = ROOT / "media-source"
BACKGROUND_DIR = MEDIA_ROOT / "backgrounds"
EXTRACTED_DIR = MEDIA_ROOT / "extracted"
CLEANED_DIR = MEDIA_ROOT / "cleaned"
FINAL_DIR = MEDIA_ROOT / "final"
NEEDS_AI_DIR = MEDIA_ROOT / "needs-ai"

REFERENCE_LAVASH = Path("C:/Users/javoh/Downloads/01-lavash.png")
PDF_SOURCE = ROOT / "docs/design/source-media/menu mazetto.pdf"
CDR_SOURCE = ROOT / "docs/design/source-media/menu mazetto.cdr"

CANVAS_SIZE = (1600, 1600)
LOCKED_BACKGROUND = BACKGROUND_DIR / "mazetto-premium-product-background.png"


PROOF_BATCH = [
    {
        "sequence": 9,
        "output": "09-kurinniy-lavash.png",
        "databaseName": "Kurinniy Lavash",
        "sourceName": "Tovuqli lavash",
        "source": ROOT / "apps/customer-web/public/menu-media/source/products/chicken-lavash.webp",
        "scale": 1.0,
        "notes": "Exact chicken lavash visual sourced from the MAZETTO PDF extraction.",
    },
    {
        "sequence": 10,
        "output": "10-kurinniy-big-lavash.png",
        "databaseName": "Kurinniy Big Lavash",
        "sourceName": "Tovuqli lavash",
        "source": ROOT / "apps/customer-web/public/menu-media/source/products/chicken-lavash.webp",
        "scale": 1.08,
        "notes": "The PDF does not provide a separate big chicken lavash image; the same authentic chicken lavash visual is reused at a larger presentation scale.",
    },
    {
        "sequence": 11,
        "output": "11-kurinniy-lavash-pishloqli.png",
        "databaseName": "Kurinniy Lavash Pishloqli",
        "sourceName": "Tovuqli pishloqli lavash",
        "source": ROOT / "apps/customer-web/public/menu-media/source/products/chicken-cheese-lavash.webp",
        "scale": 1.0,
        "notes": "Exact chicken cheese lavash visual sourced from the MAZETTO PDF extraction.",
    },
    {
        "sequence": 12,
        "output": "12-kurinniy-big-lavash-pishloqli.png",
        "databaseName": "Kurinniy Big Lavash Pishloqli",
        "sourceName": "Tovuqli pishloqli lavash",
        "source": ROOT / "apps/customer-web/public/menu-media/source/products/chicken-cheese-lavash.webp",
        "scale": 1.08,
        "notes": "The PDF does not provide a separate big chicken cheese lavash image; the same authentic chicken cheese lavash visual is reused at a larger presentation scale.",
    },
]


def ensure_dirs() -> None:
    for directory in [BACKGROUND_DIR, EXTRACTED_DIR, CLEANED_DIR, FINAL_DIR, NEEDS_AI_DIR]:
        directory.mkdir(parents=True, exist_ok=True)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_locked_background() -> None:
    if not REFERENCE_LAVASH.exists():
        raise FileNotFoundError(f"Reference background source is missing: {REFERENCE_LAVASH}")

    src = Image.open(REFERENCE_LAVASH).convert("RGB")
    src = ImageOps.fit(src, CANVAS_SIZE, method=Image.Resampling.LANCZOS)

    # Build from the food-free upper background of the owner-supplied style sample.
    upper = src.crop((0, 0, src.width, int(src.height * 0.45)))
    upper = upper.resize(CANVAS_SIZE, Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(44))
    floor = ImageOps.flip(upper).filter(ImageFilter.GaussianBlur(18))
    bg = Image.blend(upper, floor, 0.34).convert("RGBA")
    overlay = Image.new("RGBA", CANVAS_SIZE, (3, 8, 8, 92))
    bg = Image.alpha_composite(bg, overlay)

    draw = ImageDraw.Draw(bg, "RGBA")
    draw.ellipse((-420, -220, 2020, 1080), fill=(0, 82, 74, 30))
    draw.ellipse((150, 330, 1460, 1220), fill=(0, 117, 101, 18))
    draw.rectangle((0, 1120, 1600, 1600), fill=(2, 12, 12, 92))

    smoke = Image.effect_noise(CANVAS_SIZE, 78).convert("L").filter(ImageFilter.GaussianBlur(22))
    smoke = ImageOps.autocontrast(smoke)
    teal_smoke = ImageOps.colorize(smoke, black=(0, 16, 15), white=(0, 132, 118)).convert("RGBA")
    teal_smoke.putalpha(smoke.point(lambda px: max(0, min(72, int((px - 72) * 0.42)))))
    bg = Image.alpha_composite(bg, teal_smoke)
    draw = ImageDraw.Draw(bg, "RGBA")

    haze = Image.effect_noise(CANVAS_SIZE, 38).convert("L").filter(ImageFilter.GaussianBlur(55))
    amber_haze = ImageOps.colorize(haze, black=(0, 0, 0), white=(255, 175, 48)).convert("RGBA")
    amber_haze.putalpha(haze.point(lambda px: max(0, min(26, int((px - 110) * 0.2)))))
    bg = Image.alpha_composite(bg, amber_haze)
    draw = ImageDraw.Draw(bg, "RGBA")

    # Soft reflective floor language without any product/text/logo content.
    for i in range(10):
        y = 1120 + i * 20
        alpha = max(0, 34 - i * 3)
        draw.ellipse((250 - i * 8, y, 1390 + i * 8, y + 95), outline=(255, 184, 77, alpha), width=2)

    # Dark vignette matches the supplied premium reference mood.
    vignette = Image.new("L", CANVAS_SIZE, 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.ellipse((-245, -110, 1845, 1710), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 205))
    bg = Image.composite(bg, dark, vignette)

    bg.convert("RGB").save(LOCKED_BACKGROUND, optimize=True)


def trim_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return rgba
    return rgba.crop(bbox)


def compose_product(source: Path, scale: float) -> tuple[Image.Image, Image.Image]:
    extracted = Image.open(source).convert("RGBA")
    cleaned = trim_alpha(extracted)

    background = Image.open(LOCKED_BACKGROUND).convert("RGBA")
    target_width = int(1160 * scale)
    ratio = target_width / cleaned.width
    target_height = int(cleaned.height * ratio)
    product = cleaned.resize((target_width, target_height), Image.Resampling.LANCZOS)

    shadow = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow, "RGBA")
    shadow_box = (300, 1120, 1300, 1325)
    shadow_draw.ellipse(shadow_box, fill=(0, 0, 0, 98))
    shadow = shadow.filter(ImageFilter.GaussianBlur(46))
    composed = Image.alpha_composite(background, shadow)

    x = (CANVAS_SIZE[0] - product.width) // 2
    y = 650 - product.height // 2
    composed.alpha_composite(product, (x, y))
    return cleaned, composed.convert("RGB")


def build() -> None:
    ensure_dirs()
    create_locked_background()

    manifest_entries = []
    for item in PROOF_BATCH:
        source = item["source"]
        if not source.exists():
            raise FileNotFoundError(f"Proof source is missing: {source}")

        extracted_path = EXTRACTED_DIR / item["output"]
        cleaned_path = CLEANED_DIR / item["output"]
        final_path = FINAL_DIR / item["output"]

        extracted = Image.open(source).convert("RGBA")
        extracted.save(extracted_path)
        cleaned, final = compose_product(source, item["scale"])
        cleaned.save(cleaned_path)
        final.save(final_path, optimize=True)

        manifest_entries.append(
            {
                "sequence": item["sequence"],
                "filename": item["output"],
                "databaseName": item["databaseName"],
                "sourceName": item["sourceName"],
                "sourcePath": str(source.relative_to(ROOT)).replace("\\", "/"),
                "extractedPath": str(extracted_path.relative_to(ROOT)).replace("\\", "/"),
                "cleanedPath": str(cleaned_path.relative_to(ROOT)).replace("\\", "/"),
                "finalPath": str(final_path.relative_to(ROOT)).replace("\\", "/"),
                "sourceSha256": sha256_file(source),
                "finalSha256": sha256_file(final_path),
                "canvas": list(CANVAS_SIZE),
                "background": str(LOCKED_BACKGROUND.relative_to(ROOT)).replace("\\", "/"),
                "backgroundSha256": sha256_file(LOCKED_BACKGROUND),
                "status": "READY_FOR_OWNER_REVIEW",
                "authenticity": "No ingredients invented; source food object reused from MAZETTO PDF extraction.",
                "notes": item["notes"],
            }
        )

    manifest = {
        "project": "MAZETTO FOOD",
        "phase": "74-item product media pipeline proof batch",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "localOnly": True,
        "productionChanged": False,
        "sourceFiles": {
            "pdf": str(PDF_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "cdr": str(CDR_SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "referenceBackground": str(REFERENCE_LAVASH),
        },
        "cdrExtraction": {
            "status": "not_available",
            "reason": "No compatible local CorelDRAW/CDR extraction CLI is available; existing PDF-derived assets are used.",
        },
        "canvas": list(CANVAS_SIZE),
        "lockedBackground": {
            "path": str(LOCKED_BACKGROUND.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256_file(LOCKED_BACKGROUND),
        },
        "proofBatch": manifest_entries,
        "fullCatalogPolicy": {
            "canonicalItems": 74,
            "standaloneProducts": 56,
            "sets": 18,
            "batchPolicy": "Only the four requested proof-batch files were generated in this run.",
            "noAiGeneration": True,
            "noDatabaseChanges": True,
            "noSeedImagePathChanges": True,
        },
    }

    manifest_path = MEDIA_ROOT / "mazetto-media-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
