/* ==========================================================================
   Ronald Jefferson — Photographer
   Plain JavaScript, no dependencies. Everything is driven by assets/manifest.js.

   Modules: utils · Paint · Lightbox · Album (justified grid) · Router
            Reel (the album reel) · Home (about / selected / albums list) · Cursor
   Routes:  #/<album>          open an album
            #/<album>/<n>      open photograph n of that album in the lightbox

   Photographs are the untouched originals (10–60 megapixels). Browsers re-decode
   an image every time it scrolls back into view, and decoding a 50-megapixel
   JPEG takes hundreds of milliseconds — so every cover and grid frame is drawn
   ONCE into a canvas at screen resolution and never decoded again. The lightbox
   shows the original file.
   ========================================================================== */
(() => {
"use strict";

const D = window.PORTFOLIO;
if (!D) return;
const ALBUMS = D.albums, N = ALBUMS.length;

/* ---------- utils --------------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2  = (n) => String(n).padStart(2, "0");
const esc   = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CALM  = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE  = matchMedia("(pointer: fine)").matches;
const mobile = () => matchMedia("(max-width: 700px)").matches;
const html = document.documentElement;
const BASE_TITLE = document.title;
const albumIndex = (id) => ALBUMS.findIndex((a) => a.id === id);

function markLoaded(el) {
  el.classList.add("is-loaded");
  const box = el.closest("[data-box]");
  if (box) box.classList.add("loaded");
}
function setSrc(img, src) {
  if (img.getAttribute("src") !== src) { img.classList.remove("is-loaded"); img.src = src; }
  if (img.complete && img.naturalWidth) markLoaded(img);
}
function watchLoad(img) { img.addEventListener("load", () => markLoaded(img)); }

/* ---------- Paint: originals → one screen-resolution bitmap each ------------ */
const Paint = (() => {
  const DPR = () => Math.min(devicePixelRatio || 1, 2.5);
  const queue = []; let active = 0; const MAX = 2;          // two 50-megapixel decodes at a time, no more

  const loadImage = (src) => new Promise((res, rej) => {
    const im = new Image(); im.decoding = "async";
    im.onload = () => res(im); im.onerror = () => rej(new Error("load " + src));
    im.src = src;
  });

  async function run(canvas, src, boxW, boxH) {
    if (!canvas.isConnected) return;                          // album closed before its turn came
    const img = await loadImage(src);
    try { await img.decode(); } catch {}
    if (!canvas.isConnected || canvas.dataset.src !== src) return;
    const w = Math.max(1, Math.round(boxW * DPR())), h = Math.max(1, Math.round(boxH * DPR()));
    const s = Math.min(1, Math.max(w / img.naturalWidth, h / img.naturalHeight));   // cover the box, never upscale
    const bw = Math.max(1, Math.round(img.naturalWidth * s)), bh = Math.max(1, Math.round(img.naturalHeight * s));
    let bmp = null;
    if (window.createImageBitmap) {
      try { bmp = await createImageBitmap(img, { resizeWidth: bw, resizeHeight: bh, resizeQuality: "high" }); } catch { bmp = null; }
    }
    canvas.width = bw; canvas.height = bh;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    if (bmp) { ctx.drawImage(bmp, 0, 0, bw, bh); if (bmp.close) bmp.close(); }
    else ctx.drawImage(img, 0, 0, bw, bh);
    canvas.dataset.box = `${Math.round(boxW)}x${Math.round(boxH)}`;
    markLoaded(canvas);
  }
  function pump() {
    while (active < MAX && queue.length) {
      const j = queue.shift(); active++;
      run(j.canvas, j.src, j.w, j.h).catch(() => {}).then(() => { active--; j.res(); pump(); });
    }
  }
  /* paint(canvas, src, cssW, cssH) — queued; front=true jumps the queue */
  function paint(canvas, src, w, h, front = false) {
    canvas.dataset.src = src;
    return new Promise((res) => { const j = { canvas, src, w, h, res }; front ? queue.unshift(j) : queue.push(j); pump(); });
  }
  /* true when the box grew enough that the bitmap would look soft */
  function stale(canvas, w, h) {
    const b = canvas.dataset.box; if (!b) return true;
    const [pw, ph] = b.split("x").map(Number);
    return w > pw * 1.25 || h > ph * 1.25;
  }
  return { paint, stale };
})();

/* Lazy: paints a canvas (or sets an <img> src) shortly before it scrolls into view. */
function lazyLoader(root, margin) {
  return new IntersectionObserver((entries, io) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target; io.unobserve(el);
      const src = el.dataset.lazy; if (!src) continue;
      delete el.dataset.lazy;
      if (el.tagName === "CANVAS") Paint.paint(el, src, el.clientWidth, el.clientHeight);
      else setSrc(el, src);
    }
  }, { root, rootMargin: margin });
}
/* Reveal: adds .in once, when an element enters the viewport. */
function revealer(root, threshold) {
  return new IntersectionObserver((entries, io) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { root, threshold });
}

/* ---------- Lightbox (the original file) ---------------------------------- */
const Lightbox = (() => {
  const el = $("#lightbox"), stage = $("#lb-stage"), img = $("#lb-img"), cap = $("#lb-cap"), cnt = $("#lb-count");
  let a = -1, k = -1, hideTimer = 0;
  const preload = new Image();

  function show(ai, ki) {
    const alb = ALBUMS[ai], n = alb.images.length;
    ki = ((ki % n) + n) % n;
    if (a === ai && k === ki && !el.hidden) return;
    a = ai; k = ki;
    const im = alb.images[ki];
    clearTimeout(hideTimer);
    el.classList.add("loading");
    img.classList.remove("is-loaded");
    img.alt = `${im.t} — ${alb.title} photograph by Ronald Jefferson`;
    img.onload = () => { el.classList.remove("loading"); markLoaded(img); };
    img.src = im.src;
    if (img.complete && img.naturalWidth) img.onload();
    cap.textContent = im.t;
    cnt.textContent = `${pad2(ki + 1)} / ${pad2(n)}`;
    if (el.hidden) {
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add("show"));
      $("#lb-close").focus({ preventScroll: true });
    }
    preload.src = alb.images[(ki + 1) % n].src;             // the next frame is what people ask for most
  }
  function hide() {
    if (el.hidden) return;
    a = -1; k = -1;
    el.classList.remove("show");
    hideTimer = setTimeout(() => { el.hidden = true; img.removeAttribute("src"); img.classList.remove("is-loaded"); }, CALM ? 0 : 360);
  }
  function step(d) {
    if (a < 0) return;
    const n = ALBUMS[a].images.length;
    Router.go(`#/${ALBUMS[a].id}/${(((k + d) % n) + n) % n + 1}`);
  }
  function close() { if (a >= 0) Router.go(`#/${ALBUMS[a].id}`); }

  $("#lb-close").addEventListener("click", close);
  $("#lb-prev").addEventListener("click", () => step(-1));
  $("#lb-next").addEventListener("click", () => step(1));

  let sx = 0, sy = 0, down = false;                          // swipe to move, tap the backdrop to close
  stage.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; down = true; });
  stage.addEventListener("pointerup", (e) => {
    if (!down) return; down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && e.target === stage) close();
  });

  return { show, hide, step, close, get open() { return a >= 0; }, get album() { return a; } };
})();

/* ---------- Album view ---------------------------------------------------- */
const Album = (() => {
  const el = $("#album"), grid = $("#album-grid"), cover = $("#album-cover"), hero = $("#album-hero");
  const kicker = $("#album-kicker"), title = $("#album-title"), desc = $("#album-desc"), pos = $("#album-pos");
  const prevLink = $("#album-prev-link"), nextLink = $("#album-next-link"), nextBtn = $("#album-next");
  let open = -1, items = [], hideTimer = 0, relayout = 0, heroPaint = Promise.resolve();
  const lazy = lazyLoader(el, "1200px 0px");
  const reveal = revealer(el, 0.04);

  function buildGrid(a) {
    grid.innerHTML = ""; items = [];
    a.images.forEach((im, k) => {
      const fig = document.createElement("figure");
      fig.className = "shot"; fig.dataset.box = ""; fig.dataset.cursor = "View"; fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", `${im.t} — open photograph ${k + 1} of ${a.images.length}`);
      fig.style.setProperty("--avg", im.avg);
      fig.innerHTML =
        `<canvas role="img" aria-label="${esc(im.t)} — ${esc(a.title)} photograph by Ronald Jefferson"></canvas>` +
        `<figcaption><span>${esc(im.t)}</span></figcaption>`;
      const cv = fig.querySelector("canvas");
      cv.dataset.lazy = im.src;
      fig.addEventListener("click", () => Router.go(`#/${a.id}/${k + 1}`));
      fig.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fig.click(); } });
      items.push({ fig, ar: im.w / im.h, cv, src: im.src });
    });
    layout();
    items.forEach(({ fig, cv }) => { lazy.observe(cv); reveal.observe(fig); });
  }

  /* Justified rows: every photograph keeps its true aspect ratio, rows fill
     the full width, nothing is cropped. The last row is centred if short. */
  function layout() {
    const cs = getComputedStyle(grid);
    const W = grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (!(W > 0) || !items.length) return;
    const gap = parseFloat(cs.getPropertyValue("--ggap")) || 10;
    const mob = mobile();
    const targetH = mob ? Math.min(W * 0.66, 440) : clamp(innerHeight * 0.46, 300, 580);
    const maxPer  = mob ? 2 : 4;
    const rows = []; let row = [], sum = 0;
    items.forEach((it) => {
      row.push(it); sum += it.ar;
      const h = (W - gap * (row.length - 1)) / sum;
      if (h <= targetH || row.length >= maxPer) { rows.push({ row, h }); row = []; sum = 0; }
    });
    if (row.length) {
      const natural = (W - gap * (row.length - 1)) / sum, cap = targetH * 1.12;
      rows.push({ row, h: Math.min(natural, cap), center: natural > cap });
    }
    grid.innerHTML = "";
    rows.forEach(({ row, h, center }) => {
      const r = document.createElement("div");
      r.className = "grow" + (center ? " center" : "");
      row.forEach((it) => {
        const w = Math.floor(it.ar * h * 100) / 100;
        it.fig.style.width = `${w}px`;
        it.fig.style.height = `${h.toFixed(2)}px`;
        r.appendChild(it.fig);
        // already painted but the box grew a lot (e.g. window widened): paint again
        if (!it.cv.dataset.lazy && it.cv.dataset.box && Paint.stale(it.cv, w, h)) Paint.paint(it.cv, it.src, w, h);
      });
      grid.appendChild(r);
    });
  }
  new ResizeObserver(() => { clearTimeout(relayout); relayout = setTimeout(layout, 120); }).observe(grid);

  function paintHero(a) {
    const c = mobile() ? a.coverM : a.cover;
    hero.style.setProperty("--avg", c.avg);
    hero.classList.remove("loaded"); cover.classList.remove("is-loaded");
    cover.style.objectPosition = `${c.x}% ${c.y}%`;
    cover.setAttribute("aria-label", `${a.title} — cover photograph`);
    heroPaint = Paint.paint(cover, c.src, hero.clientWidth || innerWidth, hero.clientHeight || Math.max(320, Math.min(innerHeight * 0.62, 720)), true);
    return heroPaint;
  }

  function show(i) {
    const a = ALBUMS[i], first = open < 0;
    if (open === i) return;
    open = i;
    clearTimeout(hideTimer);
    // kicker.textContent = `Album ${pad2(i + 1)} of ${N} · ${a.count} photographs`;
    kicker.textContent = "";
    title.textContent = a.title;
    desc.textContent = a.desc;
    // pos.textContent = `${pad2(i + 1)} / ${pad2(N)}`;
    const p = ALBUMS[(i - 1 + N) % N], n = ALBUMS[(i + 1) % N];
    prevLink.href = `#/${p.id}`; prevLink.querySelector("span").textContent = p.title;
    nextLink.href = `#/${n.id}`; nextLink.querySelector("span").textContent = n.title;
    nextBtn.href = `#/${n.id}`;
    if (el.hidden) {
      el.hidden = false;
      html.classList.add("locked");
      requestAnimationFrame(() => el.classList.add("show"));
    }
    paintHero(a);
    buildGrid(a);
    el.scrollTop = 0;
    if (first) $("#album-back").focus({ preventScroll: true });
    document.title = `${a.title} — Ronald Jefferson`;
  }
  function hide() {
    if (open < 0) return;
    const was = open; open = -1;
    el.classList.remove("show");
    html.classList.remove("locked");
    document.title = BASE_TITLE;
    hideTimer = setTimeout(() => { el.hidden = true; grid.innerHTML = ""; items = []; }, CALM ? 0 : 480);
    const f = Reel.frame(was); if (f) f.querySelector("button").focus({ preventScroll: true });
  }

  $("#album-back").addEventListener("click", () => Router.go(""));
  el.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#/"]');
    if (link) { e.preventDefault(); Router.go(link.getAttribute("href")); Reel.goto(albumIndex(link.getAttribute("href").slice(2))); }
  });
  let heroResize = 0;
  addEventListener("resize", () => {
    clearTimeout(heroResize);
    heroResize = setTimeout(() => { if (open >= 0 && Paint.stale(cover, hero.clientWidth, hero.clientHeight)) paintHero(ALBUMS[open]); }, 300);
  }, { passive: true });

  return { show, hide, get current() { return open; }, get heroReady() { return heroPaint; } };
})();

/* ---------- Router -------------------------------------------------------- */
const Router = (() => {
  function parse() {
    const m = location.hash.match(/^#\/([a-z]+)(?:\/(\d+))?$/);
    if (!m) return null;
    const i = albumIndex(m[1]);
    return i < 0 ? null : { i, k: m[2] ? parseInt(m[2], 10) - 1 : -1 };
  }
  function apply() {
    const r = parse();
    if (!r) { Lightbox.hide(); Album.hide(); return; }
    Album.show(r.i);
    if (r.k >= 0) Lightbox.show(r.i, r.k); else Lightbox.hide();
  }
  function go(hash) {
    if (location.hash !== hash && !(hash === "" && location.hash === "")) {
      try { history.pushState(null, "", hash || location.pathname + location.search); }
      catch { location.hash = hash || "#"; }                 // file:// in some browsers
    }
    apply();
  }
  addEventListener("popstate", apply);
  addEventListener("hashchange", apply);
  return { go, apply, parse };
})();

/* ---------- The reel ------------------------------------------------------ */
const Reel = (() => {
  const section = $("#work"), reel = $("#reel"), track = $("#reel-track"), ticker = $("#reel-ticker");
  const prog = $("#reel-progress-fill"), idxEl = $("#reel-idx");
  const frames = [];
  const AUTO_MS = 5200, IDLE_MS = 7000;
  const DRAG_GAIN = 1.4;                       // pointer travel is amplified: ~70% of a frame width turns one frame
  let pos = -2.6, target = 0, cur = -1;
  let running = false, started = false, introDone = false, inView = true, hover = false, kbFocus = false;
  let dragging = false, moved = false, lastInteract = -Infinity, autoStart = 0, lastT = 0, rendered = NaN, dirty = true;
  let wheeling = false, wheelTimer = 0, wheelFrom = 0, wheelAcc = 0;
  let firstCover, wasMobile = mobile();

  const fw  = () => frames[0]?.offsetWidth || 400;
  const fh  = () => frames[0]?.offsetHeight || 260;
  const gap = () => fw() * (mobile() ? 0.86 : 1.04);
  const offset = (i, p = pos) => { let d = (((i - p) % N) + N) % N; if (d > N / 2) d -= N; return d; };
  const coverOf = (a) => mobile() ? a.coverM : a.cover;

  function activate(i, front = false) {
    const el = frames[i], a = ALBUMS[i], c = coverOf(a), cv = el.querySelector("canvas");
    el.dataset.loaded = "1";
    el.style.setProperty("--fx", c.x + "%"); el.style.setProperty("--fy", c.y + "%");
    el.querySelector(".frame-in").style.setProperty("--avg", c.avg);
    return Paint.paint(cv, c.src, fw(), fh(), front);
  }

  function build() {
    $("#reel-total").textContent = "";
    $("#reel-n").textContent = "";
    ALBUMS.forEach((a, i) => {
      const el = document.createElement("div");
      el.className = "frame";
      el.setAttribute("role", "group"); el.setAttribute("aria-roledescription", "slide");
      el.setAttribute("aria-label", `${a.title}, album ${i + 1} of ${N}`);
      el.innerHTML =
        `<button class="frame-in" type="button" data-box style="--avg:${a.cover.avg}" aria-label="Open the ${esc(a.title)} album — ${a.count} photographs">` +
          `<canvas aria-hidden="true"></canvas>` +
          `<span class="frame-title">` +
          `<span class="ft">${esc(a.title)}</span>` +
          `<span class="pill">View album</span>` +
          `</span>` +
        `</button>`;
      el.querySelector("button").addEventListener("click", () => {
        if (moved || !introDone) return;
        if (i === cur) openFromFrame(i, el); else goto(i);
      });
      track.appendChild(el); frames.push(el);

      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.textContent = a.title;
      b.addEventListener("click", () => goto(i));
      ticker.appendChild(b);
    });
    render();
    firstCover = activate(0, true);                          // centre first, then its neighbours
    activate(1); activate(N - 1);
  }

  /* remaining covers, nearest first, spaced so the first screen stays fast */
  function warm() {
    let delay = 0; const c = cur < 0 ? 0 : cur;
    [...Array(N).keys()].sort((a, b) => Math.abs(offset(a, c)) - Math.abs(offset(b, c)))
      .forEach((i) => { if (!frames[i].dataset.loaded) { setTimeout(() => activate(i), delay); delay += 350; } });
  }
  /* breakpoint crossed or frames grew a lot: paint the covers again */
  let resizeTimer = 0;
  function onResize() {
    dirty = true; render();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const flipped = mobile() !== wasMobile; wasMobile = mobile();
      frames.forEach((el, i) => {
        if (!el.dataset.loaded) return;
        const cv = el.querySelector("canvas");
        if (flipped || Paint.stale(cv, fw(), fh())) activate(i, i === cur);
      });
    }, 300);
  }

  function render() {
    const g = gap(), mob = mobile();
    frames.forEach((el, i) => {
      const d = offset(i), ad = Math.abs(d);
      if (ad > 2.4) { el.style.visibility = "hidden"; return; }
      el.style.visibility = "";
      const rot = CALM ? 0 : clamp(d * (mob ? 12 : 22), -52, 52);
      const z   = CALM ? 0 : -Math.pow(ad, 1.1) * (mob ? 90 : 150);
      const sc  = 1 - Math.min(ad, 3) * (mob ? 0.05 : 0.06);
      const op  = 1 - clamp((ad - 0.5) / 2.6, 0, 1);
      el.style.transform = `translate3d(${(d * g).toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
      el.style.opacity = op.toFixed(3);
      el.style.zIndex = String(100 - Math.round(ad * 10));
    });
    const idx = introDone ? ((Math.round(pos) % N) + N) % N : -1;
    if (idx !== cur) {
      cur = idx;
      frames.forEach((el, i) => {
        el.classList.toggle("is-active", i === idx);
        el.setAttribute("aria-current", i === idx ? "true" : "false");
        el.querySelector("button").dataset.cursor = i === idx ? "Open" : (offset(i, idx) > 0 ? "→" : "←");
      });
      $$("button", ticker).forEach((b, i) => { b.classList.toggle("on", i === idx); b.setAttribute("aria-selected", String(i === idx)); });
      if (idx >= 0) {
        idxEl.textContent = pad2(idx + 1);
        const on = ticker.children[idx];
        ticker.scrollTo({ left: on.offsetLeft - ticker.clientWidth / 2 + on.offsetWidth / 2, behavior: CALM ? "instant" : "smooth" });
      }
    }
  }

  function loop(now) {
    const dt = Math.min(48, now - lastT || 16.7); lastT = now;
    if (!dragging) {
      const diff = target - pos;
      if (Math.abs(diff) > 0.0004) pos += diff * (1 - Math.pow(1 - (wheeling ? 0.3 : introDone ? 0.17 : 0.06), dt / 16.7));
      else if (pos !== target) { pos = target; dirty = true; }
      if (!introDone && Math.abs(target - pos) < 0.02) { introDone = true; dirty = true; }   // visually settled: light the centre frame
    }
    if (pos !== rendered || dirty) { render(); rendered = pos; dirty = false; }
    const canAuto =
      !CALM &&
      introDone &&
      !dragging &&
      !wheeling &&
      !kbFocus &&
      Album.current < 0 &&
      inView &&
      document.visibilityState === "visible" &&
      now - lastInteract > IDLE_MS;

    if (canAuto) {
      if (!autoStart) autoStart = now;

      const t = (now - autoStart) / AUTO_MS;

      if (t >= 1) {
        // Move to next album
        target = Math.round(target) + 1;

        // Reset loader
        autoStart = now;
        prog.style.transform = "scaleX(0)";

        // Force reel to update
        dirty = true;
      } else {
        prog.style.transform = `scaleX(${t.toFixed(4)})`;
      }
    } else {
      autoStart = 0;
      prog.style.transform = "scaleX(0)";
    }
    if (!inView && Math.abs(target - pos) < 0.0004 && introDone) { running = false; return; }
    requestAnimationFrame(loop);
  }
  function start() { if (started && !running) { running = true; lastT = performance.now(); requestAnimationFrame(loop); } }
  function begin() {
    started = true;
    if (CALM) { pos = target; introDone = true; }
    start();
  }
  function interact() {
    lastInteract = performance.now();
    start();
  }
  function goto(i)  { if (i < 0) return; target = Math.round(target) + offset(i, Math.round(target)); interact(); }
  function step(d)  { target = Math.round(target) + d; interact(); }

  /* the centre cover grows into the album banner */
  function openFromFrame(i, el) {
    const a = ALBUMS[i], cv = el.querySelector("canvas");
    Router.go(`#/${a.id}`);
    if (CALM || !cv.classList.contains("is-loaded")) return;
    const r = cv.getBoundingClientRect();
    const z = $("#zoomer"), zc = z.querySelector("canvas");
    zc.width = cv.width; zc.height = cv.height;
    zc.getContext("2d").drawImage(cv, 0, 0);
    zc.style.objectPosition = getComputedStyle(cv).objectPosition;
    const heroH = Math.max(320, Math.min(innerHeight * 0.62, 720));
    Object.assign(z.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    z.classList.add("on");
    const anim = z.animate(
      [{ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: "3px" },
       { left: "0px", top: "0px", width: innerWidth + "px", height: heroH + "px", borderRadius: "0px" }],
      { duration: 720, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" });
    // stay on top until the banner underneath is painted, so the swap is invisible
    Promise.all([anim.finished.catch(() => {}), Album.heroReady]).then(() => { z.classList.remove("on"); anim.cancel(); });
  }

  /* --- input: drag (mouse + touch), wheel / trackpad, keys, arrows -------- */
  let px0 = 0, t0 = 0, vx = 0, lastX = 0, lastMoveT = 0;
  reel.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !introDone) return;
    if (e.pointerType === "mouse") e.preventDefault();
    dragging = true; moved = false; px0 = lastX = e.clientX; t0 = target; vx = 0; lastMoveT = e.timeStamp;
    reel.classList.add("dragging"); interact();
  });
  addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - px0;
    if (Math.abs(dx) > 5) moved = true;
    const dt = Math.max(1, e.timeStamp - lastMoveT);
    vx = 0.75 * vx + 0.25 * ((e.clientX - lastX) / dt); lastX = e.clientX; lastMoveT = e.timeStamp;
    target = t0 - dx * DRAG_GAIN / gap(); pos = target; render();
  }, { passive: true });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false; reel.classList.remove("dragging");
    const base = Math.round(pos);
    let t = Math.round(pos - vx * DRAG_GAIN * 240 / gap());      // ~240 ms of momentum, vx in px/ms
    if (t === base && Math.abs(vx) > 0.5 && Math.abs(pos - t0) > 0.04) t = base - Math.sign(vx);  // a quick flick always turns one frame
    target = clamp(t, base - 3, base + 3);
    interact();
    setTimeout(() => { moved = false; }, 60);
  };
  addEventListener("pointerup", endDrag); addEventListener("pointercancel", endDrag); addEventListener("blur", endDrag);

  reel.addEventListener("wheel", (e) => {
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!sideways && !e.shiftKey) return;                                // vertical wheel keeps scrolling the page
    e.preventDefault();
    if (!introDone) return;
    let dx = sideways ? e.deltaX : e.deltaY;                             // shift + wheel turns the reel too
    if (e.deltaMode === 1) dx *= 40; else if (e.deltaMode === 2) dx *= innerWidth;
    if (!wheeling) { wheeling = true; wheelFrom = Math.round(target); wheelAcc = 0; }
    wheelAcc += dx;
    target = wheelFrom + wheelAcc / (gap() * 0.7);                       // follows the fingers 1:1, ~70% of a frame per frame
    interact();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {                                      // gesture (and trackpad momentum) over: settle
      wheeling = false;
      const travelled = target - wheelFrom;
      target = Math.abs(travelled) < 0.5
        ? wheelFrom + (Math.abs(travelled) > 0.04 ? Math.sign(travelled) : 0)   // one notch still turns one frame
        : Math.round(target);
    }, 110);
  }, { passive: false });

  reel.addEventListener("keydown", (e) => {
    if (!introDone) return;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "Home") { e.preventDefault(); goto(0); }
    else if (e.key === "End") { e.preventDefault(); goto(N - 1); }
    else if ((e.key === "Enter" || e.key === " ") && e.target === reel) { e.preventDefault(); openFromFrame(cur, frames[cur]); }
  });
  $("#reel-prev").addEventListener("click", () => step(-1));
  $("#reel-next").addEventListener("click", () => step(1));
  // reel.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
  // reel.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hover = false; });
  reel.addEventListener("focusin", (e) => { kbFocus = e.target.matches(":focus-visible"); });
  reel.addEventListener("focusout", () => { kbFocus = false; });
  addEventListener("resize", onResize, { passive: true });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) start(); }, { threshold: 0.15 }).observe(section);

  return { build, begin, goto, warm, frame: (i) => frames[i], get index() { return cur; }, get firstCover() { return firstCover; },
           settle() { pos = target; introDone = true; dirty = true; render(); } };
})();

/* ---------- Home: about, albums list, selected frames --------------------- */
const Home = (() => {
  const lazy = lazyLoader(null, "800px 0px");
  const reveal = revealer(null, 0.12);

  function build() {
    const ab = $("#about-img"); ab.dataset.lazy = D.profile.src; watchLoad(ab); lazy.observe(ab);
    $(".about-photo").style.setProperty("--avg", D.profile.avg);

    // const ol = $("#fields-list");
    // ALBUMS.forEach((a, i) => {
    //   const li = document.createElement("li");
    //   li.innerHTML = `<button type="button"><i>${pad2(i + 1)}</i><span>${esc(a.title)}</span><b>${a.count} photographs</b></button>`;
    //   li.querySelector("button").addEventListener("click", () => { Reel.goto(i); Router.go(`#/${a.id}`); });
    //   ol.appendChild(li);
    // });

    // const grid = $("#selected-grid");
    // D.selected.forEach(({ album, index }) => {
    //   const a = ALBUMS[albumIndex(album)], im = a.images[index];
    //   const el = document.createElement("a");
    //   el.className = "sel" + (im.h > im.w ? " is-portrait" : ""); el.href = `#/${a.id}/${index + 1}`;
    //   el.dataset.cursor = "View"; el.setAttribute("data-reveal", "");
    //   el.innerHTML =
    //     `<figure data-box style="--avg:${im.avg}"><canvas role="img" aria-label="${esc(im.t)} — ${esc(a.title)} photograph by Ronald Jefferson" style="--ar:${im.w}/${im.h}"></canvas></figure>` +
    //     `<figcaption><span>${esc(im.t)}</span><b>${esc(a.title)}</b></figcaption>`;
    //   const cv = el.querySelector("canvas"); cv.dataset.lazy = im.src; lazy.observe(cv);
    //   el.addEventListener("click", (e) => { e.preventDefault(); Reel.goto(albumIndex(a.id)); Router.go(el.getAttribute("href")); });
    //   grid.appendChild(el);
    // });

    $$("[data-reveal]").forEach((el) => reveal.observe(el));

    // in-page nav: smooth scroll + current-section marker
    $$("[data-nav]").forEach((l) => l.addEventListener("click", (e) => {
      const t = $(l.getAttribute("href")); if (!t) return;
      e.preventDefault(); t.scrollIntoView({ behavior: CALM ? "instant" : "smooth", block: "start" });
      try { history.replaceState(null, "", l.getAttribute("href") === "#top" ? location.pathname : l.getAttribute("href")); } catch {}
    }));
    const links = $$("[data-section]");
    ["work", "about", "contact"].forEach((id) => new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) links.forEach((l) => l.classList.toggle("on", l.dataset.section === id)); });
    }, { rootMargin: "-45% 0px -45% 0px" }).observe($("#" + id)));
  }
  return { build };
})();

// /* ---------- Cursor (mouse only) ------------------------------------------- */
// (() => {
//   if (!FINE || CALM) return;
//   const c = $("#cursor"), label = c.querySelector("span");
//   let x = 0, y = 0, cx = 0, cy = 0, vis = false, raf = 0;
//   document.body.classList.add("has-cursor");
//   addEventListener("pointermove", (e) => {
//     if (e.pointerType !== "mouse") return;
//     x = e.clientX; y = e.clientY;
//     if (!vis) { vis = true; cx = x; cy = y; c.classList.add("visible"); }
//     const t = e.target instanceof Element ? e.target.closest("[data-cursor]") : null;
//     const txt = t ? t.dataset.cursor : "";
//     c.classList.toggle("big", !!txt); label.textContent = txt;
//     if (!raf) raf = requestAnimationFrame(tick);
//   }, { passive: true });
//   document.addEventListener("mouseleave", () => { vis = false; c.classList.remove("visible"); });
//   function tick() {
//     cx += (x - cx) * 0.25; cy += (y - cy) * 0.25;
//     c.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
//     raf = (Math.abs(x - cx) > 0.3 || Math.abs(y - cy) > 0.3) ? requestAnimationFrame(tick) : 0;
//   }
// })();

/* ---------- keyboard ------------------------------------------------------ */
document.addEventListener("keydown", (e) => {
  if (Lightbox.open) {
    if (e.key === "Escape") Lightbox.close();
    else if (e.key === "ArrowRight") Lightbox.step(1);
    else if (e.key === "ArrowLeft") Lightbox.step(-1);
    return;
  }
  if (Album.current >= 0 && e.key === "Escape") Router.go("");
});

/* ---------- boot ---------------------------------------------------------- */
Reel.build();
Home.build();

const intro = $("#intro"), fill = $("#intro-fill");
const deep = Router.parse();
if (deep) {
  // arriving on an album link: no intro, no unspool
  Reel.goto(deep.i); Reel.begin(); Reel.settle(); Router.apply();
  intro.classList.add("done");
} else {
  requestAnimationFrame(() => { fill.style.transform = "scaleX(.35)"; });
  const ready = Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), Reel.firstCover]);
  const timeout = new Promise((r) => setTimeout(r, 3500));
  Promise.race([ready, timeout]).then(() => {
    fill.style.transitionDuration = ".35s"; fill.style.transform = "scaleX(1)";
    setTimeout(() => { intro.classList.add("done"); Reel.begin(); }, CALM ? 0 : 320);
  });
}
const warmLater = () => setTimeout(Reel.warm, 700);
if (document.readyState === "complete") warmLater(); else addEventListener("load", warmLater);

})();
