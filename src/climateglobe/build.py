"""Render dist/index.html (August inlined), dist/data/mMM.gz for the other months, and
dist/data/nasa/mMM.gz (NASA's 1951-1980 baseline, fetched only when that view is chosen).

Run:  PYTHONPATH=src .venv/bin/python -m climateglobe.build
"""
import base64
import gzip
import json
import struct
import sys

import numpy as np
import shapefile
from jinja2 import Environment, FileSystemLoader

from . import config as C

MAGIC = b"CGM1"


def pack_month(m, meta, prefix="frames"):
    """Binary layout: magic, u16 n_years, u16 first_year, u16 H, u16 W, then u8 frames."""
    frames = np.load(C.WORK / f"{prefix}_m{m:02d}.npy")
    years = meta["years"][str(m)]
    if prefix == "frames_nasa":
        years = [y for y in years if y >= meta["nasa_start"]]
    n, H, W = frames.shape
    assert years == list(range(years[0], years[0] + n)), "years must be contiguous"
    head = MAGIC + struct.pack("<HHHH", n, years[0], H, W)
    return head + frames.tobytes()


def geo_lines():
    """Natural Earth 110m as compact coordinate lists, rounded to 0.01 degree."""
    def rings(name):
        r = shapefile.Reader(str(C.RAW / name / f"{name}.shp"))
        out = []
        for s in r.shapes():
            parts = list(s.parts) + [len(s.points)]
            for a, b in zip(parts[:-1], parts[1:]):
                pts = s.points[a:b]
                out.append([[round(x, 2), round(y, 2)] for x, y in pts])
        return out
    return {"land": rings("ne_110m_land"), "coast": rings("ne_110m_coastline"),
            "borders": rings("ne_110m_admin_0_boundary_lines_land")}


def write_gz(path, raw):
    """Write gzip only when the content changed, so rebuilds do not churn tracked files."""
    if path.exists() and gzip.decompress(path.read_bytes()) == raw:
        return path.read_bytes()
    gz = gzip.compress(raw, 9, mtime=0)
    path.write_bytes(gz)
    return gz


def data_uri(path):
    return "data:image/svg+xml;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def build():
    (C.DIST_DATA / "nasa").mkdir(parents=True, exist_ok=True)
    meta = json.loads((C.WORK / "meta.json").read_text())
    stats = json.loads((C.WORK / "stats.json").read_text())
    landfrac = np.load(C.WORK / "landfrac.npy")

    inline_b64 = None
    for m in range(1, 13):
        raw = pack_month(m, meta)
        gz = write_gz(C.DIST_DATA / f"m{m:02d}.gz", raw)
        if m == C.DEFAULT_MONTH:
            inline_b64 = base64.b64encode(gz).decode("ascii")
        print(f"m{m:02d}.gz  {len(raw)/1e6:.2f} MB -> {len(gz)/1e6:.2f} MB")
        nasa = write_gz(C.DIST_DATA / "nasa" / f"m{m:02d}.gz", pack_month(m, meta, "frames_nasa"))
        print(f"nasa/m{m:02d}.gz  {len(nasa)/1e6:.2f} MB")

    last = meta["years"][str(C.DEFAULT_MONTH)][-1]
    payload = {
        "meta": {k: meta[k] for k in ("threshold", "baseline", "trailing", "q_scale", "q_offset", "years", "fallback_cells", "offset", "nasa_start")},
        "stats": stats,
        "geo": geo_lines(),
        "months": C.MONTH_NAMES,
        "defaultMonth": C.DEFAULT_MONTH,
        "latestYear": last,
        "inline": {"month": C.DEFAULT_MONTH, "b64": inline_b64},
    }
    env = Environment(loader=FileSystemLoader(str(C.TEMPLATES)), autoescape=False)
    html = env.get_template("index.html.j2").render(
        title="How much warmer than 1880-1900?",
        css=(C.STATIC / "globe.css").read_text(),
        js=(C.STATIC / "globe.js").read_text(),
        payload=json.dumps(payload, separators=(",", ":")).replace("</", "<\\/"),
        logo_dark=data_uri(C.ROOT / "logo" / "d4tp-text-dark.svg"),
        logo_light=data_uri(C.ROOT / "logo" / "d4tp-text-light_3.svg"),
        latest=f"{C.MONTH_NAMES[C.DEFAULT_MONTH-1]} {last}",
        fallback_pct=round(100 * meta["fallback_cells"][str(C.DEFAULT_MONTH)] / landfrac.size),
    )
    out = C.DIST / "index.html"
    out.write_text(html, encoding="utf-8")

    # ------------------------------------------------------------ checks
    text = out.read_text(encoding="utf-8")
    for needed in ("PAYLOAD", "DecompressionStream", "Built by", "createShader"):
        assert needed in text, f"bundle missing {needed!r}"
    assert "http://" not in text.replace("http://www.w3.org", ""), "unexpected http:// reference"
    ext = [u for u in ("https://",) if u in text.replace("https://www.data4thepeople.com", "").replace("https://data.giss.nasa.gov", "").replace("https://human-settlement.emergency.copernicus.eu", "").replace("https://www.naturalearthdata.com", "")]
    assert not ext, "unexpected external reference"
    rt = gzip.decompress(base64.b64decode(inline_b64))
    assert rt == pack_month(C.DEFAULT_MONTH, meta), "inline payload does not round-trip"
    print(f"dist/index.html {len(text)/1e6:.2f} MB, inline month {C.DEFAULT_MONTH} verified")


if __name__ == "__main__":
    sys.exit(build())
