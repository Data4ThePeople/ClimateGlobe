(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const P = PAYLOAD;
  const META = P.meta, STATS = P.stats;
  const H = 90, W = 180, HW = H * W;
  const THRESH = META.threshold, Q0 = META.q_offset, QS = META.q_scale;
  const RANGE = 6;  // color scale clips at +/- 6 C

  // ---------------------------------------------------------------- embed
  const EMBEDDED = (() => {
    const flag = new URLSearchParams(location.hash.slice(1)).get("embed");
    if (flag === "0") return false;
    if (flag === "1") return true;
    try { return window.self !== window.top; } catch { return true; }
  })();
  if (EMBEDDED) {
    document.documentElement.classList.add("embed");
    const brand = $("#brand"), footer = $("#footer-brand");
    if (brand && footer) footer.insertBefore(brand, footer.firstChild);
  }
  (() => {
    const pin = new URLSearchParams(location.hash.slice(1)).get("theme");
    if (pin === "light" || pin === "dark") document.documentElement.dataset.theme = pin;
    else if (EMBEDDED) document.documentElement.dataset.theme = "light";
  })();
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ---------------------------------------------------------------- color
  // Diverging ramp centered on zero. 0 to +1.5 runs pale to mid red, +1.5 to +6 mid to
  // deep red; blues mirror it. Stops reuse the validated NFP_Treemap ramps.
  const STOPS = [
    [0.0, "#f7f6f3"], [0.5, "#fed4cf"], [1.0, "#f7aba2"], [1.5, "#ed8074"],
    [2.5, "#e14d45"], [4.0, "#ba332f"], [6.0, "#7d1716"],
  ];
  const BLUE = [
    [0.0, "#f7f6f3"], [0.5, "#cde2fb"], [1.0, "#9ec5f4"], [1.5, "#6da7ec"],
    [2.5, "#3987e5"], [4.0, "#256abf"], [6.0, "#104281"],
  ];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lerp = (a, b, t) => a + (b - a) * t;
  function ramp(v) {
    const stops = v < 0 ? BLUE : STOPS;
    const a = Math.min(RANGE, Math.abs(v));
    for (let i = 1; i < stops.length; i++) {
      if (a <= stops[i][0]) {
        const t = (a - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        const c0 = hex(stops[i - 1][1]), c1 = hex(stops[i][1]);
        return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
      }
    }
    return hex(stops[stops.length - 1][1]);
  }
  const NEUTRAL = hex("#e6e5e0");   // "not above 1.5" in highlight mode
  function lut(highlight) {
    const n = 512, out = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      const v = -RANGE + (2 * RANGE) * (i + 0.5) / n;
      const c = highlight && v <= THRESH ? NEUTRAL : ramp(v);
      out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
    }
    return out;
  }

  // ---------------------------------------------------------------- data
  const frames = {};             // month -> {n, first, data}
  function parseMonth(buf) {
    const dv = new DataView(buf);
    if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== "CGM1") throw new Error("bad month file");
    const n = dv.getUint16(4, true), first = dv.getUint16(6, true);
    const h = dv.getUint16(8, true), w = dv.getUint16(10, true);
    if (h !== H || w !== W) throw new Error("grid mismatch");
    return { n, first, data: new Uint8Array(buf, 12, n * HW) };
  }
  async function inflate(bytes) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot decompress the data (needs DecompressionStream).");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
  }
  function b64bytes(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const pending = {};
  function loadMonth(m) {
    if (frames[m]) return Promise.resolve(frames[m]);
    if (pending[m]) return pending[m];
    let p;
    if (P.inline && P.inline.month === m) {
      p = inflate(b64bytes(P.inline.b64));
    } else {
      p = fetch(`data/m${String(m).padStart(2, "0")}.gz`, { cache: "force-cache" })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
        .then((b) => inflate(new Uint8Array(b)));
    }
    pending[m] = p.then((buf) => { frames[m] = parseMonth(buf); delete pending[m]; return frames[m]; });
    return pending[m];
  }

  // ---------------------------------------------------------------- state
  const state = { month: P.defaultMonth, year: P.latestYear, hot: false, avg: false,
                  lon0: -30, lat0: 20, playing: false, spun: false };
  // Deep links: #month=3&year=1998&hot=1&avg=1 (alongside embed= and theme=).
  (() => {
    const h = new URLSearchParams(location.hash.slice(1));
    const m = +h.get("month"), y = +h.get("year");
    if (m >= 1 && m <= 12) state.month = m;
    const yrs = META.years[String(state.month)];
    if (y >= yrs[0] && y <= yrs[yrs.length - 1]) state.year = y;
    state.hot = h.get("hot") === "1";
    state.avg = h.get("avg") === "1";
    // #hero=1: fixed 1680x1080 dark card for the post's hero image. No idle spin, fixed angle.
    if (h.get("hero") === "1") {
      document.documentElement.classList.add("hero");
      document.documentElement.dataset.theme = "dark";
      state.spun = true; state.lon0 = -25; state.lat0 = 18;
      const t = document.createElement("div"); t.className = "hero-title";
      t.textContent = "How much warmer than 1880\u20111900?";
      const panel = $(".panel"); panel.insertBefore(t, panel.firstChild);
      const brand = $("#brand"), footer = $("#footer-brand");
      if (brand && footer) footer.insertBefore(brand, footer.firstChild);
      if (h.get("video") === "1") document.documentElement.classList.add("video");
    }
  })();
  const yearsOf = (m) => META.years[String(m)];
  const idxOf = (m, y) => y - yearsOf(m)[0];

  const view = new Uint8Array(HW);  // what is on the globe right now (quantized)
  function computeView() {
    const f = frames[state.month];
    const i = state.year - f.first;
    if (i < 0 || i >= f.n) { view.fill(0); return; }
    if (!state.avg) { view.set(f.data.subarray(i * HW, (i + 1) * HW)); return; }
    const lo = Math.max(0, i - META.trailing + 1);
    if (i - lo + 1 < 7) { view.fill(0); return; }
    for (let c = 0; c < HW; c++) {
      let s = 0, n = 0;
      for (let k = lo; k <= i; k++) { const v = f.data[k * HW + c]; if (v) { s += v; n++; } }
      view[c] = n >= 7 ? Math.round(s / n) : 0;
    }
  }
  const cellValue = (lat, lon) => {
    const r = Math.min(H - 1, Math.max(0, Math.floor((lat + 90) / 2)));
    const c = ((Math.floor((lon + 180) / 2) % W) + W) % W;
    const v = view[r * W + c];
    return v ? (v - Q0) / QS : null;
  };

  // ---------------------------------------------------------------- webgl
  const canvas = $("#globe");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) { $("#loading").hidden = false; $("#loading").textContent = "This browser cannot draw the globe (no WebGL)."; return; }

  const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const FS = `
precision highp float;
uniform vec2 u_res; uniform float u_lon0, u_lat0, u_aa;
uniform sampler2D u_anom, u_lines, u_lut;
uniform vec3 u_nodata;
const float PI = 3.141592653589793;
float fetch(float i, float j) {           // quantized value at column i, row j (0 = missing)
  i = mod(i, ${W}.0); j = clamp(j, 0.0, ${H - 1}.0);
  return texture2D(u_anom, vec2((i + 0.5) / ${W}.0, (j + 0.5) / ${H}.0)).r * 255.0;
}
void main() {
  vec2 ndc = (gl_FragCoord.xy / u_res) * 2.0 - 1.0;
  vec2 p = ndc / 0.98;
  float d2 = dot(p, p);
  float edge = 1.0 - smoothstep(1.0 - u_aa, 1.0 + u_aa * 0.5, d2);
  if (edge <= 0.0) discard;
  float z = sqrt(max(0.0, 1.0 - d2));
  vec3 v = vec3(p, z);
  // rotate view point to world: w = Ry(lon0) * Rx(-lat0) * v
  float cl = cos(u_lat0), sl = sin(u_lat0);
  vec3 a = vec3(v.x, v.y * cl + v.z * sl, -v.y * sl + v.z * cl);
  float co = cos(u_lon0), so = sin(u_lon0);
  vec3 w = vec3(a.x * co + a.z * so, a.y, -a.x * so + a.z * co);
  float lat = asin(clamp(w.y, -1.0, 1.0));
  float lon = atan(w.x, w.z);
  float s = (lon / PI + 1.0) * 0.5, t = (lat / PI * 2.0 + 1.0) * 0.5;
  // manual bilinear over the 2-degree cells, skipping missing cells
  float fx = s * ${W}.0 - 0.5, fy = t * ${H}.0 - 0.5;
  float i0 = floor(fx), j0 = floor(fy), ux = fx - i0, uy = fy - j0;
  float v00 = fetch(i0, j0), v10 = fetch(i0 + 1.0, j0), v01 = fetch(i0, j0 + 1.0), v11 = fetch(i0 + 1.0, j0 + 1.0);
  float w00 = (1.0 - ux) * (1.0 - uy) * step(0.5, v00), w10 = ux * (1.0 - uy) * step(0.5, v10);
  float w01 = (1.0 - ux) * uy * step(0.5, v01), w11 = ux * uy * step(0.5, v11);
  float wsum = w00 + w10 + w01 + w11;
  vec3 col;
  if (wsum < 0.001) {
    col = u_nodata;
  } else {
    float q = (v00 * w00 + v10 * w10 + v01 * w01 + v11 * w11) / wsum;
    float anom = (q - ${Q0}.0) / ${QS}.0;
    float u = clamp((anom + ${RANGE}.0) / ${2 * RANGE}.0, 0.001, 0.999);
    col = texture2D(u_lut, vec2(u, 0.5)).rgb;
  }
  vec4 L = texture2D(u_lines, vec2(s, 1.0 - t));
  // ocean a touch lighter than land so coasts read even where colors match
  col = mix(col, mix(col, vec3(1.0), 0.10), 1.0 - L.r);
  col = mix(col, vec3(0.16, 0.16, 0.16), L.g * 0.85);      // coastlines
  col = mix(col, vec3(0.30, 0.30, 0.30), L.b * 0.45);      // borders
  float shade = 0.80 + 0.20 * z;                            // limb darkening
  col *= shade;
  gl_FragColor = vec4(col * edge, edge);
}`;
  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aloc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aloc);
  gl.vertexAttribPointer(aloc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ["u_res", "u_lon0", "u_lat0", "u_aa", "u_anom", "u_lines", "u_lut", "u_nodata"]) U[n] = gl.getUniformLocation(prog, n);

  function makeTex(unit, filter) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    return t;
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const texAnom = makeTex(0, gl.NEAREST);
  const texLines = makeTex(1, gl.LINEAR);
  const texLut = makeTex(2, gl.LINEAR);
  gl.uniform1i(U.u_anom, 0); gl.uniform1i(U.u_lines, 1); gl.uniform1i(U.u_lut, 2);

  function uploadView() {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texAnom);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, W, H, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, view);
  }
  function uploadLut() {
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texLut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut(state.hot));
  }
  // Land fill, coastlines and borders rasterized once into an equirectangular texture:
  // R = land, G = coastline, B = border.
  function linesTexture() {
    const TW = 4096, TH = 2048;
    const c = document.createElement("canvas"); c.width = TW; c.height = TH;
    const ctx = c.getContext("2d");
    const X = (lon) => (lon + 180) / 360 * TW, Y = (lat) => (90 - lat) / 180 * TH;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, TW, TH);
    ctx.fillStyle = "#f00";
    ctx.beginPath();
    for (const ring of P.geo.land) {
      ring.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)));
      ctx.closePath();
    }
    ctx.fill("evenodd");
    const stroke = (lines, style, width) => {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      for (const line of lines) {
        let px = null;
        line.forEach(([x, y], i) => {
          // break the path at the dateline so a wrap does not draw a line across the map
          if (i && px !== null && Math.abs(x - px) > 180) ctx.moveTo(X(x), Y(y));
          else if (i) ctx.lineTo(X(x), Y(y)); else ctx.moveTo(X(x), Y(y));
          px = x;
        });
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    };
    stroke(P.geo.borders, "#00f", 2.5);
    stroke(P.geo.coast, "#0f0", 3.5);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texLines);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c);
  }

  let size = 0;
  function resize() {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.max(1, Math.round(box.width * dpr));
    if (px !== size) { size = px; canvas.width = px; canvas.height = px; }
  }
  function draw() {
    resize();
    gl.viewport(0, 0, size, size);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.u_res, size, size);
    gl.uniform1f(U.u_lon0, state.lon0 * Math.PI / 180);
    gl.uniform1f(U.u_lat0, state.lat0 * Math.PI / 180);
    gl.uniform1f(U.u_aa, 2.5 / (size * 0.49));
    const nd = hex(cssVar("--nodata") || "#d9d8d2");
    gl.uniform3f(U.u_nodata, nd[0] / 255, nd[1] / 255, nd[2] / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ---------------------------------------------------------------- readouts
  const fmtPct = (v) => v == null || Number.isNaN(v) ? "n/a" : `${(100 * v).toFixed(v < 0.1 ? 1 : 0)}%`;
  const fmtDeg = (v) => v == null ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}°C`;
  function statsFor() {
    const s = STATS[String(state.month)][state.avg ? "trailing" : "single"];
    return s[idxOf(state.month, state.year)] || null;
  }
  function updateReadouts() {
    const mname = P.months[state.month - 1];
    $("#when").textContent = state.avg
      ? `${mname} ${Math.max(yearsOf(state.month)[0], state.year - META.trailing + 1)}–${state.year}, averaged`
      : `${mname} ${state.year}`;
    $("#yearlabel").textContent = state.year;
    const s = statsFor();
    $("#gmean").textContent = s ? fmtDeg(s.mean) : "n/a";
    $("#landpct").textContent = s ? fmtPct(s.land) : "n/a";
    $("#poppct").textContent = s ? fmtPct(s.pop) : "n/a";
    let note = "";
    if (!s) note = state.avg ? "Not enough years yet for a 10-year average." : "No data for this month.";
    else if (s.cov_land < 0.995 || s.cov_pop < 0.995) note = `Data cover ${fmtPct(s.cov_land)} of land and ${fmtPct(s.cov_pop)} of today's population this month.`;
    $("#covnote").textContent = note;
    $("#charttitle").textContent = `Share above 1.5°C, every ${mname} since ${yearsOf(state.month)[0]}${state.avg ? " (10-year average)" : ""}`;
  }
  function drawLegend() {
    const c = $("#legend"), dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, Math.round(c.getBoundingClientRect().width * dpr)), h = 14 * dpr;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(w, 1);
    const L = lut(state.hot);
    for (let x = 0; x < w; x++) {
      const i = Math.min(511, Math.floor(x / w * 512)) * 4;
      img.data.set([L[i], L[i + 1], L[i + 2], 255], x * 4);
    }
    for (let y = 0; y < h; y++) ctx.putImageData(img, 0, y);
    ctx.fillStyle = cssVar("--text-primary");
    for (const v of [-THRESH, 0, THRESH]) {
      const x = Math.round((v + RANGE) / (2 * RANGE) * w);
      ctx.fillRect(x - Math.ceil(dpr / 2), 0, Math.ceil(dpr), h);
    }
  }

  // ---------------------------------------------------------------- chart
  function drawChart() {
    const c = $("#chart"), dpr = window.devicePixelRatio || 1;
    const box = c.getBoundingClientRect();
    const w = Math.round(box.width * dpr), h = Math.round(box.height * dpr);
    if (!w || !h) return;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    const cw = box.width, ch = box.height;
    const padL = 30, padR = 6, padT = 6, padB = 18;
    const yrs = yearsOf(state.month);
    const rows = STATS[String(state.month)][state.avg ? "trailing" : "single"];
    const x = (y) => padL + (y - yrs[0]) / (yrs[yrs.length - 1] - yrs[0]) * (cw - padL - padR);
    const yy = (v) => padT + (1 - v) * (ch - padT - padB);
    ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.strokeStyle = cssVar("--gridline"); ctx.lineWidth = 1;
    ctx.fillStyle = cssVar("--muted"); ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.beginPath(); ctx.moveTo(padL, yy(v)); ctx.lineTo(cw - padR, yy(v)); ctx.stroke();
      ctx.fillText(`${v * 100}%`, padL - 4, yy(v));
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let y = Math.ceil(yrs[0] / 20) * 20; y <= yrs[yrs.length - 1]; y += 20) ctx.fillText(String(y), x(y), ch - padB + 4);
    const line = (key, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
      let on = false;
      rows.forEach((s, i) => {
        if (!s || s[key] == null) { on = false; return; }
        const px = x(yrs[i]), py = yy(s[key]);
        if (on) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        on = true;
      });
      ctx.stroke();
    };
    line("pop", cssVar("--pop"));
    line("land", cssVar("--hot"));
    const s = statsFor();
    ctx.strokeStyle = cssVar("--text-secondary"); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x(state.year), padT); ctx.lineTo(x(state.year), ch - padB); ctx.stroke();
    ctx.setLineDash([]);
    if (s) for (const [k, col] of [["land", cssVar("--hot")], ["pop", cssVar("--pop")]]) {
      if (s[k] == null) continue;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x(state.year), yy(s[k]), 3.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- render
  let raf = 0;
  function render() { raf = 0; draw(); }
  const request = () => { if (!raf) raf = requestAnimationFrame(render); };
  function refresh() {
    computeView(); uploadView(); updateReadouts(); drawChart(); request();
  }

  // ---------------------------------------------------------------- controls
  const monthSel = $("#month"), yearIn = $("#year"), playBtn = $("#play");
  P.months.forEach((n, i) => {
    const o = document.createElement("option"); o.value = i + 1; o.textContent = n; monthSel.appendChild(o);
  });
  monthSel.value = state.month;
  yearIn.value = state.year;
  $("#hot").checked = state.hot;
  $("#avg").checked = state.avg;
  function setYearBounds() {
    const yrs = yearsOf(state.month);
    yearIn.min = yrs[0]; yearIn.max = yrs[yrs.length - 1];
    if (state.year > yrs[yrs.length - 1]) state.year = yrs[yrs.length - 1];
    yearIn.value = state.year;
  }
  async function setMonth(m) {
    state.month = m;
    setYearBounds();
    if (!frames[m]) {
      $("#loading").textContent = `Loading ${P.months[m - 1]}…`; $("#loading").hidden = false;
      try { await loadMonth(m); }
      catch (e) { $("#loading").textContent = `Could not load ${P.months[m - 1]} (${e.message}).`; return; }
      $("#loading").hidden = true;
      if (state.month !== m) return;
    }
    refresh();
  }
  monthSel.addEventListener("change", () => setMonth(+monthSel.value));
  yearIn.addEventListener("input", () => { state.year = +yearIn.value; refresh(); });
  $("#hot").addEventListener("change", (e) => { state.hot = e.target.checked; uploadLut(); drawLegend(); request(); });
  $("#avg").addEventListener("change", (e) => { state.avg = e.target.checked; refresh(); });

  let timer = 0;
  function stop() { state.playing = false; playBtn.textContent = "▶"; playBtn.setAttribute("aria-pressed", "false"); clearInterval(timer); timer = 0; }
  function play() {
    const yrs = yearsOf(state.month);
    if (state.year >= yrs[yrs.length - 1]) { state.year = yrs[0]; yearIn.value = state.year; }
    state.playing = true; playBtn.textContent = "❚❚"; playBtn.setAttribute("aria-pressed", "true");
    const step = () => {
      const last = yearsOf(state.month)[yearsOf(state.month).length - 1];
      if (state.year >= last) { stop(); return; }
      state.year += 1; yearIn.value = state.year; refresh();
    };
    timer = setInterval(step, +$("#speed").value);
    step();
  }
  playBtn.addEventListener("click", () => state.playing ? stop() : play());
  $("#speed").addEventListener("change", () => { if (state.playing) { clearInterval(timer); stop(); play(); } });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === " ") { e.preventDefault(); state.playing ? stop() : play(); }
  });

  // ---------------------------------------------------------------- drag / hover
  let drag = null, vel = 0, spinRaf = 0;
  const R = () => canvas.getBoundingClientRect();
  function pointToLatLon(cx, cy) {
    const b = R();
    const x = ((cx - b.left) / b.width * 2 - 1) / 0.98, y = -((cy - b.top) / b.height * 2 - 1) / 0.98;
    const d2 = x * x + y * y;
    if (d2 > 1) return null;
    const z = Math.sqrt(1 - d2);
    const la = state.lat0 * Math.PI / 180, lo = state.lon0 * Math.PI / 180;
    const cl = Math.cos(la), sl = Math.sin(la);
    const ay = y * cl + z * sl, az = -y * sl + z * cl, ax = x;
    const co = Math.cos(lo), so = Math.sin(lo);
    const wx = ax * co + az * so, wy = ay, wz = -ax * so + az * co;
    return [Math.asin(Math.max(-1, Math.min(1, wy))) * 180 / Math.PI, Math.atan2(wx, wz) * 180 / Math.PI];
  }
  const degPerPx = () => 180 / (R().width * 0.98);
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, t: performance.now() }; vel = 0; state.spun = true;
    canvas.classList.add("dragging"); hideTip();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag) {
      const k = degPerPx();
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      state.lon0 -= dx * k;
      state.lat0 = Math.max(-85, Math.min(85, state.lat0 + dy * k));
      const now = performance.now();
      vel = -dx * k / Math.max(1, now - drag.t) * 16;
      drag = { x: e.clientX, y: e.clientY, t: now };
      request();
    } else if (e.pointerType === "mouse") {
      showTip(e);
    }
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null; canvas.classList.remove("dragging");
    if (Math.abs(vel) > 0.05) inertia();
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { hideTip(); });
  function inertia() {
    cancelAnimationFrame(spinRaf);
    const tick = () => {
      state.lon0 += vel; vel *= 0.94; request();
      if (Math.abs(vel) > 0.02 && !drag) spinRaf = requestAnimationFrame(tick);
    };
    spinRaf = requestAnimationFrame(tick);
  }
  // slow idle spin until the first touch
  function idleSpin() {
    if (state.spun) return;
    state.lon0 += 0.06; request();
    requestAnimationFrame(idleSpin);
  }
  const tip = $("#tip");
  function hideTip() { tip.style.display = "none"; }
  function showTip(e) {
    const ll = pointToLatLon(e.clientX, e.clientY);
    if (!ll) { hideTip(); return; }
    const v = cellValue(ll[0], ll[1]);
    const ns = ll[0] >= 0 ? "N" : "S", ew = ll[1] >= 0 ? "E" : "W";
    tip.innerHTML = `<div class="big">${v == null ? "No data" : fmtDeg(v)}</div><div>${Math.abs(ll[0]).toFixed(0)}°${ns}, ${Math.abs(ll[1]).toFixed(0)}°${ew} · vs. 1880-1900</div>`;
    tip.style.display = "block";
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 10;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - 10;
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  }

  // Frame control for the video render: set the view, draw synchronously, report readiness.
  window.CG = {
    ready: false,
    set(year, lon0, lat0, avg) {
      if (year != null) { state.year = year; yearIn.value = year; }
      if (lon0 != null) state.lon0 = lon0;
      if (lat0 != null) state.lat0 = lat0;
      if (avg != null) { state.avg = !!avg; $("#avg").checked = state.avg; }
      computeView(); uploadView(); updateReadouts(); drawChart(); draw();
    },
  };

  // ---------------------------------------------------------------- boot
  window.addEventListener("resize", () => { drawLegend(); drawChart(); request(); });
  linesTexture();
  uploadLut();
  drawLegend();
  setYearBounds();
  $("#loading").textContent = "Loading…"; $("#loading").hidden = false;
  loadMonth(state.month).then(() => {
    $("#loading").hidden = true;
    refresh();
    idleSpin();
    window.CG.ready = true;
  }).catch((e) => { $("#loading").textContent = `Could not load data (${e.message}).`; });
})();
