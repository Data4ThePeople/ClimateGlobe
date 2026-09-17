"""Turn the raw inputs into the grids, frames and stats the page needs.

Outputs in data/work/:
  meta.json          lat/lon axes, years per month, constants
  frames_mMM.npy     uint8 [n_years, 90, 180] quantized anomaly vs 1880-1900, 0 = missing
  frames_nasa_mMM.npy  NASA's own 1951-1980 anomaly, from NASA_START (1951) on
  stats.json         per month, per year: global mean, % land > 1.5, % pop > 1.5, coverage,
                     for the single-month and the 10-year trailing variants; keys ending
                     in _nasa use the 1951-1980 baseline and start at NASA_START
  landfrac.npy       float32 [90, 180] land fraction of each cell
  pop.npy            float64 [90, 180] 2025 population of each cell
  fallback.npy       bool [12, 90, 180] cells whose baseline came from the zonal mean
Run:  PYTHONPATH=src .venv/bin/python -m climateglobe.transform
"""
import json
import sys

import netCDF4 as nc
import numpy as np
import rasterio
import shapefile
from rasterio import features

from . import config as C


# ---------------------------------------------------------------- GISTEMP
def load_gistemp():
    d = nc.Dataset(C.GISTEMP_NC)
    lat = np.asarray(d.variables["lat"][:]).astype(float)
    lon = np.asarray(d.variables["lon"][:]).astype(float)
    t = d.variables["time"]
    dates = nc.num2date(t[:], t.units)
    years = np.array([x.year for x in dates])
    months = np.array([x.month for x in dates])
    v = d.variables["tempanomaly"]
    a = v[:]                                    # masked array, scale applied
    anom = np.ma.filled(a.astype(np.float32), np.nan)
    d.close()
    return lat, lon, years, months, anom


def baselines(lat, years, months, anom):
    """Per calendar month, per cell mean over 1880-1900. Returns (base[12,90,180], fallback[12,90,180])."""
    base = np.full((12,) + anom.shape[1:], np.nan, np.float32)
    fallback = np.zeros((12,) + anom.shape[1:], bool)
    for m in range(1, 13):
        sel = (months == m) & (years >= C.BASELINE_START) & (years <= C.BASELINE_END)
        vals = anom[sel]
        n = np.sum(~np.isnan(vals), axis=0)
        with np.errstate(invalid="ignore"):
            cell = np.nanmean(vals, axis=0)
        ok = n >= C.BASELINE_MIN_YEARS
        # zonal fallback: mean of good cells in the same latitude row; if a row has none,
        # borrow the nearest row that does.
        zonal = np.full(len(lat), np.nan, np.float32)
        for i in range(len(lat)):
            if ok[i].any():
                zonal[i] = cell[i][ok[i]].mean()
        good_rows = np.where(~np.isnan(zonal))[0]
        for i in range(len(lat)):
            if np.isnan(zonal[i]):
                j = good_rows[np.argmin(np.abs(good_rows - i))]
                zonal[i] = zonal[j]
        b = np.where(ok, cell, zonal[:, None])
        base[m - 1] = b
        fallback[m - 1] = ~ok
    return base, fallback


# ---------------------------------------------------------------- land
def land_fraction(lat, lon):
    """Fraction of each 2-degree cell that is land, from Natural Earth 110m land polygons
    rasterized at 0.1 degree. Row order matches `lat` (ascending, -89..89)."""
    r = shapefile.Reader(str(C.RAW / "ne_110m_land" / "ne_110m_land.shp"))
    shapes = [s.__geo_interface__ for s in r.shapes()]
    fine = 20                                   # 0.1 degree cells per 2 degrees
    H, W = len(lat) * fine, len(lon) * fine
    transform = rasterio.transform.from_origin(-180, 90, 360 / W, 180 / H)
    mask = features.rasterize(((g, 1) for g in shapes), out_shape=(H, W),
                              transform=transform, fill=0, dtype="uint8", all_touched=False)
    frac = mask.reshape(len(lat), fine, len(lon), fine).mean(axis=(1, 3)).astype(np.float32)
    return frac[::-1]                           # rasterized top-down; flip to ascending lat


# ---------------------------------------------------------------- population
def population(lat, lon):
    """Sum GHS-POP 2025 (30 arc-second, WGS84) into the 2-degree cells. Row order ascending lat."""
    out = np.zeros((len(lat), len(lon)))
    with rasterio.open(C.GHSPOP_TIF) as ds:
        T = ds.transform
        cols = np.arange(ds.width)
        lon_c = T.c + (cols + 0.5) * T.a
        col_bin = np.clip(np.floor((lon_c + 180) / 2).astype(int), 0, len(lon) - 1)
        # reduceat needs the start index of each run of equal bins
        starts = np.r_[0, np.where(np.diff(col_bin) != 0)[0] + 1]
        start_bins = col_bin[starts]
        step = 512
        for r0 in range(0, ds.height, step):
            r1 = min(ds.height, r0 + step)
            block = ds.read(1, window=((r0, r1), (0, ds.width)))
            block = np.where(np.isfinite(block) & (block > 0), block, 0.0)
            rows = np.arange(r0, r1)
            lat_c = T.f + (rows + 0.5) * T.e
            row_bin = np.clip(np.floor((lat_c + 90) / 2).astype(int), 0, len(lat) - 1)
            colsum = np.add.reduceat(block, starts, axis=1)          # [rows, runs]
            for rb in np.unique(row_bin):
                sub = colsum[row_bin == rb].sum(axis=0)
                np.add.at(out[rb], start_bins, sub)
    return out


# ---------------------------------------------------------------- stats
def area_weights(lat, lon):
    w = np.cos(np.deg2rad(lat))[:, None] * np.ones((1, len(lon)))
    return w / w.sum()


def frame_stats(x, area, landfrac, pop):
    valid = ~np.isnan(x)
    hot = valid & (x > C.THRESHOLD)
    land_w = area * landfrac
    land_valid = land_w[valid].sum()
    pop_valid = pop[valid].sum()
    return {
        "mean": float(np.nansum(x * area) / area[valid].sum()) if valid.any() else None,
        "land": float(land_w[hot].sum() / land_valid) if land_valid > 0 else None,
        "pop": float(pop[hot].sum() / pop_valid) if pop_valid > 0 else None,
        "cov_area": float(area[valid].sum()),
        "cov_land": float(land_valid / land_w.sum()),
        "cov_pop": float(pop_valid / pop.sum()),
    }


def series_stats(grid, area, landfrac, pop):
    """Per-year stats for one month's stack, single year and trailing average."""
    single, trailing = [], []
    for i in range(len(grid)):
        single.append(frame_stats(grid[i], area, landfrac, pop))
        lo = max(0, i - C.TRAILING_YEARS + 1)
        win = grid[lo:i + 1]
        if len(win) >= C.TRAILING_MIN_YEARS:
            n = np.sum(~np.isnan(win), axis=0)
            with np.errstate(invalid="ignore"):
                avg = np.nanmean(win, axis=0)
            avg[n < C.TRAILING_MIN_YEARS] = np.nan
            trailing.append(frame_stats(avg, area, landfrac, pop))
        else:
            trailing.append(None)
    return single, trailing


def quantize(x):
    q = np.round(x * C.Q_SCALE) + C.Q_OFFSET
    q = np.clip(q, 1, 255)
    q[np.isnan(x)] = 0
    return q.astype(np.uint8)


def main():
    C.WORK.mkdir(parents=True, exist_ok=True)
    lat, lon, years, months, anom = load_gistemp()
    print(f"GISTEMP {years[0]}-{months[0]:02d} .. {years[-1]}-{months[-1]:02d}, {len(years)} months, grid {anom.shape[1:]}")
    base, fallback = baselines(lat, years, months, anom)
    area = area_weights(lat, lon)
    landfrac = land_fraction(lat, lon)
    print(f"land fraction of globe: {(area*landfrac).sum():.4f}  (expect ~0.29)")
    pop = population(lat, lon)
    print(f"population total: {pop.sum()/1e9:.3f} billion  (expect ~8.2)")
    assert 7.5e9 < pop.sum() < 9.0e9, "population total off"

    meta = {"lat": lat.tolist(), "lon": lon.tolist(), "threshold": C.THRESHOLD,
            "baseline": [C.BASELINE_START, C.BASELINE_END], "trailing": C.TRAILING_YEARS,
            "q_scale": C.Q_SCALE, "q_offset": C.Q_OFFSET, "years": {}, "fallback_cells": {},
            "nasa_start": C.NASA_START}
    meta["offset"] = {}
    stats = {}
    for m in range(1, 13):
        sel = np.where(months == m)[0]
        yrs = years[sel]
        raw = anom[sel]                               # NASA's own anomaly vs 1951-1980
        pre = raw - base[m - 1][None]                 # anomaly vs 1880-1900, [n_years, 90, 180]
        b = base[m - 1]
        meta["years"][str(m)] = yrs.tolist()
        meta["fallback_cells"][str(m)] = int(fallback[m - 1].sum())
        # how much warmer 1951-1980 was than 1880-1900, area-weighted (the base is negative)
        meta["offset"][str(m)] = round(-float(np.nansum(b * area) / area[~np.isnan(b)].sum()), 3)
        np.save(C.WORK / f"frames_m{m:02d}.npy", quantize(pre))
        late = yrs >= C.NASA_START                    # the NASA view uses no years before its baseline
        np.save(C.WORK / f"frames_nasa_m{m:02d}.npy", quantize(raw[late]))
        stats[str(m)] = {}
        for suffix, grid in (("", pre), ("_nasa", raw[late])):
            single, trailing = series_stats(grid, area, landfrac, pop)
            stats[str(m)]["single" + suffix] = single
            stats[str(m)]["trailing" + suffix] = trailing
    np.save(C.WORK / "landfrac.npy", landfrac)
    np.save(C.WORK / "pop.npy", pop)
    np.save(C.WORK / "fallback.npy", fallback)
    (C.WORK / "meta.json").write_text(json.dumps(meta))
    (C.WORK / "stats.json").write_text(json.dumps(stats))

    # ------------------------------------------------------------ tie-out
    print("\nTIE-OUT")
    m = C.DEFAULT_MONTH
    sel = np.where(months == m)[0]
    yrs = years[sel]
    off = float(np.nansum(base[m - 1] * area) / area[~np.isnan(base[m - 1])].sum())
    print(f"August baseline (1880-1900 minus 1951-1980), area-weighted: {off:+.3f} C")
    print(f"August cells using zonal fallback baseline: {int(fallback[m-1].sum())} of {fallback[m-1].size}")
    print(f"{'August':>8} {'vs1951-80':>10} {'vs1880-1900':>12} {'%land>1.5':>10} {'%pop>1.5':>9} {'cov_land':>9} {'cov_pop':>8} {'NASA %land':>10} {'NASA %pop':>9}")
    for y in (2026, 2024, 2016, 1998, 1950, 1900):
        i = int(np.where(yrs == y)[0][0])
        raw = anom[sel[i]]
        s = stats[str(m)]["single"][i]
        raw_mean = float(np.nansum(raw * area) / area[~np.isnan(raw)].sum())
        nasa_cols = f"{'n/a':>10} {'n/a':>9}"
        if y >= C.NASA_START:
            sn = stats[str(m)]["single_nasa"][y - C.NASA_START]
            assert abs(sn["mean"] - raw_mean) < 1e-9, "NASA-baseline mean must equal the raw grid mean"
            nasa_cols = f"{100*sn['land']:>9.1f}% {100*sn['pop']:>8.1f}%"
        print(f"{y:>8} {raw_mean:>+10.3f} {s['mean']:>+12.3f} {100*s['land']:>9.1f}% {100*s['pop']:>8.1f}% {100*s['cov_land']:>8.1f}% {100*s['cov_pop']:>7.1f}% {nasa_cols}")
    print("NASA GLB.Ts+dSST table, Aug 2026 vs 1951-1980: +1.40")
    # independent brute-force recomputation for Aug 2026
    i = int(np.where(yrs == 2026)[0][0])
    x = anom[sel[i]] - base[m - 1]
    num_l = den_l = num_p = den_p = 0.0
    for r in range(len(lat)):
        wl = np.cos(np.deg2rad(lat[r]))
        for c in range(len(lon)):
            if np.isnan(x[r, c]):
                continue
            den_l += wl * landfrac[r, c]; den_p += pop[r, c]
            if x[r, c] > C.THRESHOLD:
                num_l += wl * landfrac[r, c]; num_p += pop[r, c]
    print(f"brute-force Aug 2026: %land>1.5 = {100*num_l/den_l:.2f}%   %pop>1.5 = {100*num_p/den_p:.2f}%")
    t = stats[str(m)]["trailing"][i]
    print(f"10-yr trailing Aug 2017-2026: mean {t['mean']:+.3f}  %land>1.5 {100*t['land']:.1f}%  %pop>1.5 {100*t['pop']:.1f}%")
    t = stats[str(m)]["trailing_nasa"][2026 - C.NASA_START]
    first = next(k for k, v in enumerate(stats[str(m)]["trailing_nasa"]) if v)
    print(f"first NASA-view 10-year average: {C.NASA_START + first}")
    print(f"  same, NASA 1951-1980 baseline: mean {t['mean']:+.3f}  %land>1.5 {100*t['land']:.1f}%  %pop>1.5 {100*t['pop']:.1f}%")
    print("1951-1980 minus 1880-1900 by month:", meta["offset"])


if __name__ == "__main__":
    sys.exit(main())
