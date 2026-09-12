# ClimateGlobe

A spinning globe that shows how much warmer each part of the world was than
the same month in 1880-1900, for any month since 1880, with the share of land
area and of today's population living where that month was more than 1.5°C
above the baseline. Built by Data 4 The People.

Live: https://data4thepeople.github.io/ClimateGlobe/dist/index.html

## Data

- **Temperature:** NASA GISS Surface Temperature Analysis (GISTEMP v4), the
  2°×2° gridded product with 1,200 km smoothing, anomalies vs 1951-1980.
  Each cell is rebased to its own 1880-1900 mean for that calendar month.
  NASA's record starts in 1880, so 1880-1900 stands in for the IPCC's
  1850-1900. Cells with fewer than ten baseline years take the mean of their
  latitude band (about 27% of cells, mostly ocean and polar).
- **Population:** GHS-POP 2025, 30 arc-second WGS84 mosaic, EU Joint Research
  Centre. Summed into the 2° cells and held fixed for every year.
- **Land fraction:** Natural Earth 110m land polygons rasterized at 0.1°.
  Antarctica counts as land.
- **Coastlines and borders:** Natural Earth 110m.

## Build

```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
PYTHONPATH=src .venv/bin/python -m climateglobe.fetch       # ~510 MB into data/raw
PYTHONPATH=src .venv/bin/python -m climateglobe.transform   # grids, stats, tie-out table
PYTHONPATH=src .venv/bin/python -m climateglobe.build       # dist/index.html + dist/data/mMM.gz
```

To refresh for a new month, delete `data/raw/gistemp1200_GHCNv4_ERSSTv5.nc*`
and run the three steps again. Local testing needs a server because the
sidecar month files are fetched:

```
cd dist && python3 -m http.server 8765     # http://localhost:8765/index.html
```

## What ships

`dist/index.html` is one file with the CSS, JS, coastlines and the August
frames inlined, so it opens from disk. The other eleven months live in
`dist/data/m01.gz` .. `m12.gz` (about 0.9 MB each) and are fetched relative to
the page the first time that month is selected. All of `dist/` is tracked and
served by GitHub Pages from `main` at the repo root; `.nojekyll` keeps Pages
from ignoring the data folder.

Deep links: `#month=3&year=1998&hot=1&avg=1` (month 1-12, `hot` highlights
only areas above 1.5°C, `avg` shows the 10-year average). `#theme=light|dark`
pins the theme; `#embed=1` forces the compact framed layout.

## Embedding it in Prismic

Prismic renders this as an `html_embed` slice, fullWidth, fixed height 780px.
Nothing about the sidecar files changes the embed: the iframe points at the
page, and the page fetches its month files from the same folder on GitHub
Pages.

```html
<iframe src="https://data4thepeople.github.io/ClimateGlobe/dist/index.html#embed=1"
        width="100%" height="780" loading="lazy" style="border:0"
        title="How much warmer than 1880-1900?"></iframe>
```

`#embed=1` forces the framed layout (masthead hidden, logo in the footer,
light theme); without it the page auto-detects an iframe with
`window.self !== window.top`.

## Deploy

```
git push
gh api -X POST repos/Data4ThePeople/ClimateGlobe/pages/builds
gh api repos/Data4ThePeople/ClimateGlobe/pages/builds/latest --jq .status
curl -fsS https://data4thepeople.github.io/ClimateGlobe/dist/index.html | cmp - dist/index.html
```
