"""Render a social video of the globe: August, 10-year average, 1889 -> 2026, globe spinning.

Usage:  .venv/bin/python scripts/render_video.py [--test] [--out path.mp4]
Drives dist/index.html#hero=1&video=1 frame by frame through window.CG (see globe.js),
screenshots each frame with Playwright + the installed Chrome, and encodes with ffmpeg.
"""
import argparse, http.server, os, socketserver, subprocess, sys, tempfile, threading, time
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
FPS = 30
FRAMES_PER_YEAR = 6        # 5 years a second from SLOW_FROM on
FAST_FRAMES = 3            # 10 years a second before SLOW_FROM
SLOW_FROM = 1970
HOLD_START, HOLD_END = 45, 90
SPIN = 0.4          # degrees of longitude per frame
LAT0 = 18
FIRST, LAST = 1889, 2026   # 1889 is the first year with a full 10-year average

def serve(directory, port):
    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=str(directory), **k)
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="render 30 frames only")
    ap.add_argument("--out", default=None)
    ap.add_argument("--width", type=int, default=1920); ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--square", action="store_true", help="1080x1080 layout")
    ap.add_argument("--single", action="store_true", help="single-month view instead of the 10-year average")
    a = ap.parse_args()
    if a.square: a.width = a.height = 1080
    first = 1880 if a.single else FIRST
    name = f"climate-globe-august-{'single' if a.single else '10yr'}{'-square' if a.square else ''}.mp4"
    out = Path(a.out) if a.out else ROOT / "posts/climate-globe/video" / name
    out.parent.mkdir(parents=True, exist_ok=True)
    port = 8791
    httpd = serve(DIST, port)
    frames_dir = Path(tempfile.mkdtemp(prefix="cg-frames-"))
    plan = []                                   # (year, lon0)
    lon = -60.0
    for _ in range(HOLD_START): plan.append((first, lon)); lon += SPIN
    for y in range(first, LAST + 1):
        for _ in range(FAST_FRAMES if y < SLOW_FROM else FRAMES_PER_YEAR): plan.append((y, lon)); lon += SPIN
    for _ in range(HOLD_END): plan.append((LAST, lon)); lon += SPIN
    if a.test: plan = plan[:30]
    print(f"{len(plan)} frames = {len(plan)/FPS:.1f} s at {FPS} fps")
    t0 = time.time()
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True,
                              args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu"])
        pg = b.new_page(viewport={"width": a.width, "height": a.height}, device_scale_factor=1)
        pg.goto(f"http://127.0.0.1:{port}/index.html#hero=1&video=1&month=8&year={first}" + ("" if a.single else "&avg=1") + ("&square=1" if a.square else ""))
        pg.wait_for_function("window.CG && window.CG.ready", timeout=60000)
        for i, (y, l) in enumerate(plan):
            pg.evaluate(f"CG.set({y}, {l:.3f}, {LAT0}, {'false' if a.single else 'true'})")
            pg.screenshot(path=str(frames_dir / f"f{i:05d}.jpg"), type="jpeg", quality=92)
            if i % 100 == 0: print(f"  frame {i}/{len(plan)}  {time.time()-t0:.0f}s", flush=True)
        b.close()
    httpd.shutdown()
    print(f"frames done in {time.time()-t0:.0f}s; encoding")
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, "-y", "-framerate", str(FPS), "-i", str(frames_dir / "f%05d.jpg"),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-2000:]); sys.exit(1)
    print(f"wrote {out} ({out.stat().st_size/1e6:.1f} MB)")
    for f in frames_dir.iterdir(): f.unlink()
    frames_dir.rmdir()

if __name__ == "__main__":
    main()
