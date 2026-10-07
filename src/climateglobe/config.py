"""Paths, source URLs and constants for the ClimateGlobe build."""
# Contact address for the User-Agent: read at run time, never hardcoded in the repo.
# Set D4TP_CONTACT_EMAIL in the environment or in ~/.claude/d4tp-process/.env.
import os as _os


def _d4tp_contact():
    v = _os.environ.get("D4TP_CONTACT_EMAIL")
    if v:
        return v
    try:
        with open(_os.path.expanduser("~/.claude/d4tp-process/.env"), encoding="utf-8") as fh:
            for line in fh:
                if line.strip().startswith("D4TP_CONTACT_EMAIL="):
                    return line.split("=", 1)[1].strip().strip("'\"")
    except OSError:
        pass
    return ""


D4TP_CONTACT = _d4tp_contact()


from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
WORK = ROOT / "data" / "work"
DIST = ROOT / "dist"
DIST_DATA = DIST / "data"
STATIC = Path(__file__).resolve().parent / "static"
TEMPLATES = Path(__file__).resolve().parent / "templates"

USER_AGENT = f"Mozilla/5.0 (compatible; Data4ThePeople ClimateGlobe; {D4TP_CONTACT})"

# NASA GISTEMP v4, 2x2 degree, 1200 km smoothing, anomalies vs 1951-1980.
GISTEMP_URL = "https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz"
GISTEMP_GZ = RAW / "gistemp1200_GHCNv4_ERSSTv5.nc.gz"
GISTEMP_NC = RAW / "gistemp1200_GHCNv4_ERSSTv5.nc"

# EU JRC GHS-POP 2025, 30 arc-second, WGS84 global mosaic.
GHSPOP_URL = (
    "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/"
    "GHS_POP_E2025_GLOBE_R2023A_4326_30ss/V1-0/GHS_POP_E2025_GLOBE_R2023A_4326_30ss_V1_0.zip"
)
GHSPOP_ZIP = RAW / "GHS_POP_E2025_GLOBE_R2023A_4326_30ss_V1_0.zip"
GHSPOP_TIF = RAW / "GHS_POP_E2025_GLOBE_R2023A_4326_30ss_V1_0.tif"

# Natural Earth 1:110m.
NE_BASE = "https://naciscdn.org/naturalearth/110m"
NE_LAYERS = {
    "ne_110m_land": "physical",
    "ne_110m_coastline": "physical",
    "ne_110m_admin_0_boundary_lines_land": "cultural",
}

# Analysis constants.
BASELINE_START, BASELINE_END = 1880, 1900   # preindustrial proxy (NASA's record starts 1880)
BASELINE_MIN_YEARS = 10                     # cells with fewer baseline years use the zonal mean
NASA_START = 1951                           # NASA-baseline view starts with its baseline period
THRESHOLD = 1.5                             # degrees C above baseline
TRAILING_YEARS = 10                         # "10-year average" toggle
TRAILING_MIN_YEARS = 7

# Frame quantization: uint8, 0 = missing, value = round(anom * 10) + 128.
Q_SCALE = 10.0
Q_OFFSET = 128
MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]
DEFAULT_MONTH = 8
