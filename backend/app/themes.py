"""Color themes used by the public portfolio renderer.

Each theme is a flat dict of CSS variable values consumed by portfolio.html.
"""

THEMES = {
    "indigo": {
        "accent": "#4f46e5", "soft": "#e0e7ff", "bg": "#f8fafc",
        "surface": "#ffffff", "text": "#0f172a", "muted": "#475569",
    },
    "emerald": {
        "accent": "#059669", "soft": "#d1fae5", "bg": "#f7fdfb",
        "surface": "#ffffff", "text": "#062925", "muted": "#3f6660",
    },
    "rose": {
        "accent": "#e11d48", "soft": "#ffe4e6", "bg": "#fff7f8",
        "surface": "#ffffff", "text": "#3f0d18", "muted": "#7a4651",
    },
    "slate": {
        "accent": "#0ea5e9", "soft": "#e2e8f0", "bg": "#0f172a",
        "surface": "#1e293b", "text": "#f1f5f9", "muted": "#94a3b8",
    },
}

DEFAULT_THEME = "indigo"


def get_theme(name: str) -> dict:
    return THEMES.get(name, THEMES[DEFAULT_THEME])
