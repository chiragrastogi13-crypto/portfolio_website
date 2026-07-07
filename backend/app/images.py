"""Image upload + auto-enhancement.

When a user uploads an image we don't just store it as-is — we run a light
enhancement pass (auto-contrast, color, contrast, sharpness, brightness) and
optimize it for the web. This makes user photos and backgrounds look crisper
and more professional without any manual editing.
"""
import io
import uuid
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

from .config import UPLOADS_DIR

UPLOAD_DIR = Path(UPLOADS_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_BYTES = 12 * 1024 * 1024  # 12 MB
MAX_DIM = 1600                 # longest side after resize


def enhance_and_save(raw: bytes) -> str:
    """Enhance image bytes and save as an optimized JPEG. Returns the filename."""
    img = Image.open(io.BytesIO(raw))

    # Respect camera orientation, flatten transparency onto white.
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img).convert("RGB")
    else:
        img = img.convert("RGB")

    # Downscale very large images (keeps pages fast) — never upscale.
    img.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)

    # Enhancement pass — tuned to brighten/sharpen without looking artificial.
    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Color(img).enhance(1.12)       # richer colors / background
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Brightness(img).enhance(1.03)
    img = ImageEnhance.Sharpness(img).enhance(1.45)   # crisper detail

    name = f"{uuid.uuid4().hex}.jpg"
    img.save(UPLOAD_DIR / name, "JPEG", quality=88, optimize=True, progressive=True)
    return name
