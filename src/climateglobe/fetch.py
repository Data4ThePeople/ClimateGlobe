"""Download the raw inputs into data/raw. Skips files that already exist."""
import gzip
import shutil
import sys
import urllib.request
import zipfile

from . import config as C


def _download(url, dest):
    if dest.exists() and dest.stat().st_size > 0:
        print(f"have  {dest.name}")
        return
    print(f"fetch {url}")
    req = urllib.request.Request(url, headers={"User-Agent": C.USER_AGENT})
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f, length=1 << 20)
    tmp.rename(dest)
    print(f"saved {dest.name} ({dest.stat().st_size/1e6:.1f} MB)")


def main():
    C.RAW.mkdir(parents=True, exist_ok=True)
    _download(C.GISTEMP_URL, C.GISTEMP_GZ)
    if not C.GISTEMP_NC.exists():
        with gzip.open(C.GISTEMP_GZ, "rb") as src, open(C.GISTEMP_NC, "wb") as dst:
            shutil.copyfileobj(src, dst)
    _download(C.GHSPOP_URL, C.GHSPOP_ZIP)
    if not C.GHSPOP_TIF.exists():
        with zipfile.ZipFile(C.GHSPOP_ZIP) as z:
            z.extractall(C.RAW)
    for name, kind in C.NE_LAYERS.items():
        z = C.RAW / f"{name}.zip"
        _download(f"{C.NE_BASE}/{kind}/{name}.zip", z)
        d = C.RAW / name
        if not d.exists():
            with zipfile.ZipFile(z) as zf:
                zf.extractall(d)
    print("done")


if __name__ == "__main__":
    sys.exit(main())
