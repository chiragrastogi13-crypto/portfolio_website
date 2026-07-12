"""Garbage-collect orphaned uploads.

Every image/résumé upload writes a NEW file; replacing a photo or deleting a
portfolio leaves the old file behind. Left alone these orphans pile up forever.

This sweep keeps only files still referenced by some portfolio (or sample) and
deletes the rest — but never touches very recent files, so an upload that hasn't
been saved into a portfolio yet (in-flight) survives the grace window.
"""
import re
import threading
import time
from pathlib import Path

from .config import UPLOADS_DIR
from .database import SessionLocal
from . import models

UPLOAD_DIR = Path(UPLOADS_DIR)

# Matches the filename in any ".../uploads/<name>" URL stored in a data blob.
_UPLOAD_RE = re.compile(r"/uploads/([A-Za-z0-9_.\-]+)")

GRACE_SECONDS = 24 * 60 * 60      # keep files younger than this (unsaved uploads)
SWEEP_INTERVAL_SECONDS = 6 * 60 * 60


def referenced_names() -> set[str]:
    """Every upload filename referenced by a portfolio or sample."""
    names: set[str] = set()
    db = SessionLocal()
    try:
        for (blob,) in db.query(models.Portfolio.data_json).all():
            names.update(_UPLOAD_RE.findall(blob or ""))
        for (blob,) in db.query(models.SamplePortfolio.data_json).all():
            names.update(_UPLOAD_RE.findall(blob or ""))
    finally:
        db.close()
    return names


def sweep_orphans(grace_seconds: int = GRACE_SECONDS) -> int:
    """Delete unreferenced upload files older than the grace window. Returns count."""
    if not UPLOAD_DIR.exists():
        return 0
    keep = referenced_names()
    now = time.time()
    removed = 0
    for f in UPLOAD_DIR.iterdir():
        if not f.is_file() or f.name in keep:
            continue
        try:
            if now - f.stat().st_mtime < grace_seconds:
                continue  # in-flight upload not saved yet — keep for now
            f.unlink()
            removed += 1
        except OSError:
            pass
    return removed


def start_background_cleanup() -> None:
    """Run the sweep shortly after boot, then on a fixed interval, in a daemon thread."""
    def _loop():
        time.sleep(45)  # let startup settle
        while True:
            try:
                n = sweep_orphans()
                if n:
                    print(f"[cleanup] removed {n} orphaned upload(s)")
            except Exception as e:  # never let the loop die
                print("[cleanup] error:", e)
            time.sleep(SWEEP_INTERVAL_SECONDS)

    threading.Thread(target=_loop, daemon=True).start()
