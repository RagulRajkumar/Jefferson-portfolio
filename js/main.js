/* ==========================================================================
   RONALD JEFFERSON — PHOTOGRAPHY
   ---------------------------------------------------------------------------
   One rAF loop drives every scroll-linked effect. Page scroll is the only
   source of truth for the roll's position, so wheel, drag, swipe, keyboard
   and the ticker can never disagree with each other.
   ========================================================================== */
(() => {
"use strict";

/* -------------------------------------------------------------------------
   Environment
   ------------------------------------------------------------------------- */
const mqMotion = matchMedia("(prefers-reduced-motion: reduce)");
let CALM = mqMotion.matches;
mqMotion.addEventListener("change", (e) => { CALM = e.matches; });

const FINE  = matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const pad2  = (n) => String(n).padStart(2, "0");
const $     = (s, r = document) => r.querySelector(s);
const $$    = (s, r = document) => Array.from(r.querySelectorAll(s));

const DATA = (window.PORTFOLIO || { categories: [] }).categories;
const thumb = (cat, file) => `images/thumb/${cat}/${file}`;
const full  = (cat, file) => `images/${cat}/${file}`;

/* -------------------------------------------------------------------------
   Ticker — a single requestAnimationFrame loop. Subscribers get scroll
   position, a smoothed position, and scroll velocity.
   ------------------------------------------------------------------------- */
const Ticker = (() => {
  const subs = new Set();
  let y = window.scrollY, sy = y, vel = 0, running = false;

  function frame() {
    const prev = sy;
    y = window.scrollY;
    sy = CALM ? y : lerp(sy, y, 0.2);
    if (Math.abs(sy - y) < 0.05) sy = y;
    vel = sy - prev;
    subs.forEach((fn) => fn(y, sy, vel));
    running = subs.size > 0;
    if (running) requestAnimationFrame(frame);
  }

  return {
    add(fn) {
      subs.add(fn);
      if (!running) { running = true; requestAnimationFrame(frame); }
      return () => subs.delete(fn);
    },
    kick() { if (!running) { running = true; requestAnimationFrame(frame); } },
  };
})();

/* Recomputed on resize; every module reads these instead of measuring. */
const View = { w: innerWidth, h: innerHeight };
function measure() { View.w = innerWidth; View.h = innerHeight; }
addEventListener("resize", () => { measure(); Ticker.kick(); }, { passive: true });

/* -------------------------------------------------------------------------
   Lazy images — decode near the viewport, fade on arrival
   ------------------------------------------------------------------------- */
const Lazy = (() => {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const img = e.target;
      io.unobserve(img);
      if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
    });
  }, { rootMargin: "700px 0px" });

  return {
    watch(img) { if (img.dataset.src) io.observe(img); },
    scan(root = document) { $$("img[data-src]", root).forEach((i) => io.observe(i)); },
  };
})();

/* -------------------------------------------------------------------------
   Reveals — one observer for everything that simply needs to appear
   ------------------------------------------------------------------------- */
const Reveal = (() => {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

  return {
    watch(el) { io.observe(el); },
    scan(root = document) { $$("[data-reveal], [data-split], .pf-note", root).forEach((el) => io.observe(el)); },
  };
})();

/* Wrap each word in a mask so headlines can rise line by line. */
function splitWords(el, step = 42) {
  if (el.dataset.done) return;
  el.dataset.done = "1";
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = "";
  words.forEach((w, i) => {
    const s = document.createElement("span");
    s.className = "word";
    const inner = document.createElement("i");
    inner.textContent = w;
    inner.style.setProperty("--d", `${i * step}ms`);
    s.appendChild(inner);
    el.appendChild(s);
  });
}

/* -------------------------------------------------------------------------
   Layered parallax — publishes --py; elements compose it themselves
   ------------------------------------------------------------------------- */
function initDepth() {
  const nodes = $$("[data-depth]");
  if (!nodes.length) return;
  const live = new Set();

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting ? live.add(e.target) : live.delete(e.target));
    Ticker.kick();
  }, { rootMargin: "35% 0px" });
  nodes.forEach((n) => io.observe(n));

  Ticker.add(() => {
    if (CALM || !live.size) return;
    const mid = View.h / 2;
    live.forEach((el) => {
      const d = parseFloat(el.dataset.depth) || 0;
      const r = el.getBoundingClientRect();
      const off = (mid - (r.top + r.height / 2)) * d;
      el.style.setProperty("--py", `${off.toFixed(1)}px`);
    });
  });
}

/* -------------------------------------------------------------------------
   Loader — tracks the assets the first screen actually needs
   ------------------------------------------------------------------------- */
function initLoader(critical) {
  const el = $("#loader"), fill = $("#loader-fill"), count = $("#loader-count");
  let loaded = 0, shown = 0, finished = false;
  const total = Math.max(1, critical.length);

  const paint = () => {
    const target = Math.round((loaded / total) * 100);
    shown += Math.ceil((target - shown) / 3) || (target > shown ? 1 : 0);
    count.textContent = shown;
    fill.style.width = shown + "%";
    if (shown < target) requestAnimationFrame(paint);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    loaded = total;
    count.textContent = "100";
    fill.style.width = "100%";
    setTimeout(() => {
      el.classList.add("done");
      document.body.classList.add("ready");
      setTimeout(() => el.remove(), 900);
    }, CALM ? 0 : 320);
  };

  critical.forEach((src) => {
    const img = new Image();
    const done = () => { loaded++; paint(); if (loaded >= total) finish(); };
    img.onload = done; img.onerror = done;
    img.src = src;
  });
  setTimeout(finish, 4500); // never hold the page hostage
  paint();
}

/* -------------------------------------------------------------------------
   Navigation
   ------------------------------------------------------------------------- */
function initNav() {
  const burger = $("#nav-burger"), menu = $("#menu");
  let open = false;

  const setMenu = (state) => {
    open = state;
    burger.setAttribute("aria-expanded", String(state));
    burger.setAttribute("aria-label", state ? "Close menu" : "Open menu");
    if (state) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add("in"));
      document.body.classList.add("lock");
    } else {
      menu.classList.remove("in");
      document.body.classList.remove("lock");
      setTimeout(() => { if (!open) menu.hidden = true; }, 500);
    }
  };

  burger.addEventListener("click", () => setMenu(!open));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && open) setMenu(false); });

  // category shortcuts inside the menu
  const list = $("#menu-cats");
  DATA.forEach((c, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="#work">${c.title}</a>`;
    li.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      setMenu(false);
      Roll.goto(i, { open: true });
    });
    list.appendChild(li);
  });

  // scroll-spy
  const links = $$(".nav-links a[data-section]");
  const targets = links.map((a) => $("#" + a.dataset.section)).filter(Boolean);
  Ticker.add(() => {
    const probe = View.h * 0.4;
    let active = 0;
    targets.forEach((t, i) => { if (t.getBoundingClientRect().top <= probe) active = i; });
    links.forEach((a, i) => a.classList.toggle("active", i === active));
  });
}

/* -------------------------------------------------------------------------
   ACT 1 — the hero
   ------------------------------------------------------------------------- */
function initHero() {
  const wrap = $("#hero-cards");
  const cue = $("#cue");

  // Five contact-sheet cards, drawn from five different disciplines so the
  // opening frame already shows the range of the work.
  const LAYOUT = [
    // x/y/w place the card on a wide screen; sx/sy/sw take over on a phone,
    // where they are kept clear of the wordmark, the meta line and the cue.
    { cat: "portrait",     n: 0, x: "4%",  y: "16%", w: "clamp(92px, 13vw, 178px)",
      sx: "1%",  sy: "13%", sw: "30vw", r: "-7deg",   d: 0.10, depth: 0.12, front: false, sm: true },
    { cat: "wildlife",     n: 8, x: "75%", y: "9%",  w: "clamp(88px, 12vw, 164px)",
      sx: "66%", sy: "16%", sw: "28vw", r: "6deg",    d: 0.18, depth: 0.16, front: false, sm: true },
    { cat: "fashion",      n: 0, x: "9%",  y: "54%", w: "clamp(96px, 14vw, 196px)",
      sx: "3%",  sy: "67%", sw: "29vw", r: "-3.5deg", d: 0.26, depth: 0.24, front: true,  sm: true },
    { cat: "architecture", n: 5, x: "73%", y: "51%", w: "clamp(92px, 13vw, 182px)",
      sx: "63%", sy: "69%", sw: "28vw", r: "5deg",    d: 0.34, depth: 0.21, front: true,  sm: true },
    { cat: "landscape",    n: 3, x: "27%", y: "4%",  w: "clamp(70px, 8vw, 118px)",
      sx: "0",   sy: "0",   sw: "0",    r: "5deg",    d: 0.42, depth: 0.30, front: false, sm: false },
  ];

  LAYOUT.forEach((c, i) => {
    const cat = DATA.find((d) => d.id === c.cat);
    if (!cat) return;
    const img = cat.images[Math.min(c.n, cat.images.length - 1)];
    const el = document.createElement("div");
    el.className = "hero-card" + (c.front ? " front" : "");
    el.style.cssText =
      `--x:${c.x};--y:${c.y};--w:${c.w};--sx:${c.sx};--sy:${c.sy};--sw:${c.sw};--r:${c.r};--d:${c.d}s`;
    el.dataset.sm = c.sm ? "1" : "0";
    el.dataset.depth = c.depth;
    el.innerHTML =
      `<div class="hero-card-in">` +
        `<img data-src="${thumb(c.cat, img.f)}" alt="" loading="lazy" decoding="async">` +
        `<b>${cat.title.slice(0, 4).toUpperCase()} · ${pad2(i + 1)}</b>` +
      `</div>`;
    wrap.appendChild(el);
  });
  Lazy.scan(wrap);

  // Cards drift toward the pointer — a shallow tilt, not a gimmick.
  if (FINE && !CALM) {
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const hero = $("#hero");
    hero.addEventListener("pointermove", (e) => {
      tx = (e.clientX / View.w - 0.5) * 2;
      ty = (e.clientY / View.h - 0.5) * 2;
      Ticker.kick();
    });
    hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; });
    const cards = $$(".hero-card", wrap);
    Ticker.add(() => {
      if (CALM) return;
      cx = lerp(cx, tx, 0.06); cy = lerp(cy, ty, 0.06);
      if (Math.abs(cx - tx) < 0.001 && Math.abs(cy - ty) < 0.001) return;
      cards.forEach((el, i) => {
        const k = (i % 2 ? -1 : 1) * (6 + i * 2.4);
        el.style.setProperty("--mx", `${(cx * k).toFixed(2)}px`);
        el.style.setProperty("--my", `${(cy * k * 0.6).toFixed(2)}px`);
      });
    });
  }

  // The cue retires the moment its job is done.
  Ticker.add((y) => {
    cue.classList.toggle("gone", y > View.h * 0.12);
    document.documentElement.style.setProperty("--enter", clamp(y / (View.h * 0.6), 0, 1).toFixed(3));
  });
}

/* -------------------------------------------------------------------------
   ACT 2 — the statement opens through an aperture
   ------------------------------------------------------------------------- */
function initStatement() {
  const act = $(".act-statement");
  const ap = $(".aperture", act);
  if (!act || !ap) return;
  splitWords($(".statement", act), 34);

  Ticker.add(() => {
    const r = act.getBoundingClientRect();
    const span = r.height - View.h;
    if (span <= 0 || r.bottom < -200 || r.top > View.h + 200) return;
    const p = clamp(-r.top / span, 0, 1);
    // opens over the first 55% of the pin, holds, then never closes
    ap.style.setProperty("--open", clamp(p / 0.55, 0, 1).toFixed(3));
  });
}

/* -------------------------------------------------------------------------
   ACT 3 — the annotation stroke draws itself
   ------------------------------------------------------------------------- */
function initStroke() {
  $$(".pf-stroke path").forEach((p) => {
    const len = Math.ceil(p.getTotalLength());
    p.style.setProperty("--len", len);
  });
}

/* -------------------------------------------------------------------------
   ACT 4 — the roll advances; speed follows scroll velocity
   ------------------------------------------------------------------------- */
function initMarquee() {
  const wrap = $("#marquee");
  if (!wrap) return;
  const WORD = "A quiet way of looking — ";
  const rows = $$(".marquee-row", wrap);

  rows.forEach((row) => {
    const span = row.firstElementChild;
    span.textContent = WORD.repeat(6);
    const clone = span.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    row.appendChild(clone);
  });

  if (CALM) return;
  const state = rows.map(() => 0);

  Ticker.add((y, sy, vel) => {
    const r = wrap.getBoundingClientRect();
    if (r.bottom < -100 || r.top > View.h + 100) return;
    rows.forEach((row, i) => {
      const dir = parseFloat(row.dataset.dir) || 1;
      const width = row.firstElementChild.offsetWidth || 1;
      state[i] = (state[i] + dir * (0.35 + vel * 0.14)) % width;
      if (state[i] > 0) state[i] -= width;
      row.style.transform = `translate3d(${state[i].toFixed(2)}px,0,0)`;
    });
  });
}

/* -------------------------------------------------------------------------
   ACT 5 — the index of disciplines
   ------------------------------------------------------------------------- */
function initIndex() {
  const list = $("#index-list");
  if (!list) return;
  DATA.forEach((c, i) => {
    const li = document.createElement("li");
    li.innerHTML =
      `<a href="#work"><i>${pad2(i + 1)}</i><h3>${c.title}</h3><b>${pad2(c.images.length)} frames</b></a>`;
    li.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      Roll.goto(i, { open: true });
    });
    list.appendChild(li);
    Reveal.watch(li);
  });
}

/* -------------------------------------------------------------------------
   PAGE 2 — THE ROLL
   Absolutely positioned frames whose transform is a pure function of one
   continuous number: how far the page has scrolled through this section.
   ------------------------------------------------------------------------- */
const Roll = (() => {
  const section = $("#work");
  const rollEl  = $("#roll");
  const track   = $("#roll-track");
  const titleEl = $("#roll-title");
  const ticker  = $("#roll-ticker");
  const hint    = $("#roll-hint");
  const counter = $("#roll-counter");
  if (!section || !track) return { goto() {}, build() {} };

  const N = DATA.length;
  section.style.setProperty("--n", N);

  let frames = [], titleSpan = null, current = -1, pos = 0;

  const span = () => Math.max(1, section.offsetHeight - View.h);
  const pxPerStep = () => span() / Math.max(1, N - 1);
  const frameW = () => frames[0]?.offsetWidth || 300;
  const gap = () => frameW() * 1.16;

  /* --- build ------------------------------------------------------------ */
  function build() {
    DATA.forEach((cat, i) => {
      const el = document.createElement("div");
      el.className = "roll-frame";
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", "false");
      el.innerHTML =
        `<button class="roll-frame-in" aria-label="Open the ${cat.title} reel — ${cat.images.length} photographs">` +
          `<span class="roll-frame-num">${pad2(i + 1)} · ${cat.images.length} FRAMES</span>` +
          `<img data-src="${thumb(cat.id, cat.cover)}" alt="${cat.title} photography by Ronald Jefferson" decoding="async">` +
          `<span class="roll-frame-open">Open reel</span>` +
        `</button>`;
      el.querySelector("button").addEventListener("click", () => {
        if (dragMoved) return;
        Math.round(pos) === i ? Viewer.open(i) : goto(i);
      });
      track.appendChild(el);
      frames.push(el);
    });
    // deliberately not lazy: warmed as soon as the visitor commits to scrolling
    const warm = () => $$("img[data-src]", track).forEach((im) => {
      im.src = im.dataset.src; delete im.dataset.src;
    });
    const off = Ticker.add((y) => { if (y > View.h * 0.7) { warm(); off(); } });

    DATA.forEach((cat, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = cat.title;
      b.addEventListener("click", () => goto(i));
      ticker.appendChild(b);
    });

    counter.querySelector("em").textContent = `/ ${pad2(N)}`;
    render();
  }

  /* --- transform per frame ---------------------------------------------- */
  function render() {
    const g = gap();
    frames.forEach((el, i) => {
      const d = i - pos;
      const ad = Math.abs(d);
      if (ad > 3.4) { el.style.visibility = "hidden"; return; }
      el.style.visibility = "";

      // outer edges lean toward the viewer, so the strip wraps around them
      const rot   = CALM ? 0 : clamp(d * 26, -62, 62);
      const z     = CALM ? 0 : -Math.pow(ad, 1.15) * 118;
      const x     = d * g;
      const scale = 1 - Math.min(ad, 3) * 0.045;
      const op    = 1 - Math.min(1, Math.max(0, (ad - 0.35) / 2.9));

      el.style.transform =
        `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      el.style.opacity = op.toFixed(3);
      el.style.zIndex = String(100 - Math.round(ad * 10));
    });

    const idx = clamp(Math.round(pos), 0, N - 1);
    if (idx !== current) {
      current = idx;
      frames.forEach((el, i) => {
        el.classList.toggle("is-active", i === idx);
        el.setAttribute("aria-selected", String(i === idx));
      });
      $$("button", ticker).forEach((b, i) => b.classList.toggle("on", i === idx));
      setTitle(DATA[idx].title);
      counter.querySelector("i").textContent = pad2(idx + 1);
      rollEl.setAttribute("aria-activedescendant", "");
    }
  }

  function setTitle(text) {
    if (titleSpan) {
      const old = titleSpan;
      old.classList.add("out");
      setTimeout(() => old.remove(), CALM ? 0 : 420);
    }
    titleSpan = document.createElement("span");
    titleSpan.textContent = text;
    if (!CALM) {
      titleSpan.classList.add("out");
      titleEl.appendChild(titleSpan);
      requestAnimationFrame(() => requestAnimationFrame(() => titleSpan.classList.remove("out")));
    } else {
      titleEl.appendChild(titleSpan);
    }
  }

  /* --- scroll is the source of truth ------------------------------------ */
  /* Deliberately the raw scroll value, not the smoothed one: dragging has to
     track the pointer 1:1. The cinematic easing comes from the transitions on
     the title and the frame filters, not from lagging the position itself. */
  Ticker.add((y) => {
    const top = section.offsetTop;
    const p = clamp((y - top) / span(), 0, 1);
    const next = p * (N - 1);
    if (Math.abs(next - pos) > 0.0004) { pos = next; render(); }
    hint.classList.toggle("gone", p > 0.08);
  });

  function scrollToIndex(i, smooth = true) {
    const target = section.offsetTop + clamp(i, 0, N - 1) * pxPerStep();
    window.scrollTo({ top: Math.round(target), behavior: smooth && !CALM ? "smooth" : "instant" });
  }

  function goto(i, { open = false } = {}) {
    const already = Math.abs(pos - i) < 0.02;
    scrollToIndex(i, !already);
    if (open) setTimeout(() => Viewer.open(i), already || CALM ? 60 : 620);
  }

  /* --- drag: converted straight into page scroll ------------------------
     Mouse events rather than pointer events on purpose. Scrolling the page
     mid-drag makes Chromium treat the gesture as a scroll and fire
     pointercancel, which killed the drag after a single move. Mouse events
     are not cancelled that way. Touch is left to native vertical scrolling. */
  let dragging = false, dragStart = 0, dragFrom = 0, dragMoved = false;

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    rollEl.classList.remove("dragging");
    scrollToIndex(Math.round(pos));            // settle onto a whole frame
    setTimeout(() => { dragMoved = false; }, 60);
  }

  rollEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();                        // no native image dragging
    dragging = true; dragMoved = false;
    dragStart = e.clientX; dragFrom = window.scrollY;
    rollEl.classList.add("dragging");
  });
  addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart;
    if (Math.abs(dx) > 4) dragMoved = true;
    window.scrollTo({ top: dragFrom - (dx / gap()) * pxPerStep(), behavior: "instant" });
  });
  addEventListener("mouseup", endDrag);
  addEventListener("blur", endDrag);

  // horizontal wheel / trackpad swipe reads as advancing the roll
  rollEl.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    window.scrollBy({ top: (e.deltaX / gap()) * pxPerStep(), behavior: "instant" });
  }, { passive: false });

  rollEl.addEventListener("keydown", (e) => {
    const at = Math.round(pos);
    if (e.key === "ArrowRight") { e.preventDefault(); scrollToIndex(at + 1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); scrollToIndex(at - 1); }
    if (e.key === "Home")       { e.preventDefault(); scrollToIndex(0); }
    if (e.key === "End")        { e.preventDefault(); scrollToIndex(N - 1); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); Viewer.open(at); }
  });

  addEventListener("resize", () => { render(); }, { passive: true });

  return { build, goto, get index() { return Math.round(pos); } };
})();

/* -------------------------------------------------------------------------
   CATEGORY VIEWER — the reel
   The rhythm below is fixed rather than random so the page looks the same
   every visit; spans respond to each photograph's real aspect ratio.
   ------------------------------------------------------------------------- */
const Viewer = (() => {
  const el      = $("#viewer");
  const scroller= $("#viewer-scroll");
  const reel    = $("#reel");
  const titleEl = $("#viewer-title");
  const countEl = $("#viewer-count");
  const markEl  = $("#viewer-watermark");
  const nextEl  = $("#viewer-next");
  const progEl  = $("#viewer-progress").firstElementChild;
  if (!el) return { open() {}, close() {} };

  let openIndex = -1, list = [], lastFocus = null, offTick = null;

  /* Start column, span (of 12) and a downward offset. Offsets only ever push
     a photograph *down*, so the rhythm stays asymmetric without any two
     frames ever colliding. */
  const RHYTHM = [
    { s: 1,  w: 6,  o: 0  },
    { s: 8,  w: 5,  o: 20 },
    { s: 3,  w: 8,  o: 4  },
    { s: 1,  w: 4,  o: 12 },
    { s: 6,  w: 6,  o: 0  },
    { s: 2,  w: 10, o: 8  },
    { s: 8,  w: 5,  o: 0  },
    { s: 1,  w: 5,  o: 16 },
    { s: 5,  w: 7,  o: 6  },
    { s: 2,  w: 5,  o: 0  },
  ];
  const MOBILE = [
    { s: 1, w: 6, o: 0 }, { s: 3, w: 4, o: 6 },
    { s: 1, w: 5, o: 0 }, { s: 2, w: 5, o: 8 },
    { s: 1, w: 6, o: 0 }, { s: 2, w: 4, o: 4 },
  ];

  function place(img, i, cols) {
    const ar = img.w / img.h;
    const set = cols === 6 ? MOBILE : RHYTHM;
    const r = set[i % set.length];
    let w = r.w;
    if (cols === 12) {
      if (ar >= 2.1) w = 12;                        // panoramas take the measure
      else if (ar >= 1.6) w = Math.min(11, w + 1);
      else if (ar < 0.8) w = Math.max(3, w - 1);    // tall frames stay narrow
    } else if (ar >= 2.1) {
      w = 6;
    }
    const s = w === cols ? 1 : Math.min(r.s, cols + 1 - w);
    return { col: `${s} / span ${w}`, mt: r.o };
  }

  function build(cat) {
    const cols = View.w <= 860 ? 6 : 12;
    reel.innerHTML = "";
    list = cat.images.map((im, i) => ({ ...im, cat: cat.id, catTitle: cat.title, i }));

    const frag = document.createDocumentFragment();
    list.forEach((im, i) => {
      const p = place(im, i, cols);
      const fig = document.createElement("figure");
      fig.className = "shot";
      fig.style.setProperty("--col", p.col);
      fig.style.setProperty("--mt", `${p.mt}vh`);
      fig.innerHTML =
        `<button class="shot-media" aria-label="Enlarge ${cat.title} photograph ${pad2(i + 1)}">` +
          `<img data-src="${thumb(cat.id, im.f)}" alt="${cat.title} photograph ${pad2(i + 1)} by Ronald Jefferson"` +
          ` width="${im.w}" height="${im.h}" decoding="async">` +
        `</button>` +
        `<figcaption class="shot-cap"><span>${cat.title} ${pad2(i + 1)}</span></figcaption>`;
      fig.querySelector("button").addEventListener("click", () => Lightbox.open(list, i, fig.querySelector("img")));
      frag.appendChild(fig);
    });
    reel.appendChild(frag);
    $$(".shot img", reel).slice(0, 4).forEach((im) => {
      if (im.dataset.src) { im.src = im.dataset.src; delete im.dataset.src; }
    });
    Lazy.scan(reel);
    $$(".shot", reel).forEach((s) => Reveal.watch(s));
  }

  function open(index) {
    const cat = DATA[index];
    if (!cat) return;
    openIndex = index;
    lastFocus = document.activeElement;

    titleEl.textContent = cat.title;
    markEl.textContent = cat.title;
    countEl.textContent = `${pad2(cat.images.length)} frames`;
    const nxt = DATA[(index + 1) % DATA.length];
    nextEl.textContent = `Next — ${nxt.title}`;
    build(cat);

    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("in"));
    document.body.classList.add("lock");
    scroller.scrollTop = 0;
    setTimeout(() => $("#viewer-back").focus({ preventScroll: true }), 60);

    offTick = Ticker.add(() => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      progEl.style.width = `${max > 0 ? (scroller.scrollTop / max) * 100 : 0}%`;
    });
    scroller.addEventListener("scroll", Ticker.kick, { passive: true });
  }

  function close() {
    el.classList.remove("in");
    document.body.classList.remove("lock");
    if (offTick) { offTick(); offTick = null; }
    setTimeout(() => {
      el.hidden = true;
      reel.innerHTML = "";
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }, CALM ? 0 : 460);
  }

  $("#viewer-back").addEventListener("click", close);
  nextEl.addEventListener("click", () => {
    const nx = (openIndex + 1) % DATA.length;
    Roll.goto(nx);
    open(nx);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.hidden && $("#lb").hidden) close();
  });
  addEventListener("resize", () => { if (!el.hidden) build(DATA[openIndex]); }, { passive: true });

  return { open, close, get isOpen() { return !el.hidden; } };
})();

/* -------------------------------------------------------------------------
   LIGHTBOX — the thumbnail grows into place, then shrinks back to it
   ------------------------------------------------------------------------- */
const Lightbox = (() => {
  const el   = $("#lb");
  const img  = $("#lb-img");
  const catE = $("#lb-cat");
  const idxE = $("#lb-idx");
  if (!el) return { open() {} };

  let list = [], at = 0, origin = null, originIndex = -1, lastFocus = null;

  const fit = (w, h) => {
    const maxW = View.w * 0.88, maxH = View.h * 0.8;
    let W = maxW, H = (W * h) / w;
    if (H > maxH) { H = maxH; W = (H * w) / h; }
    return { left: (View.w - W) / 2, top: (View.h - H) / 2, width: W, height: H };
  };

  function show(i) {
    at = (i + list.length) % list.length;
    const d = list[at];
    img.classList.remove("show");
    const pre = new Image();
    pre.onload = () => {
      img.src = pre.src;
      img.alt = `${d.catTitle} photograph ${pad2(at + 1)} by Ronald Jefferson`;
      requestAnimationFrame(() => img.classList.add("show"));
    };
    pre.src = full(d.cat, d.f);
    catE.textContent = d.catTitle;
    idxE.textContent = `${pad2(at + 1)} / ${pad2(list.length)}`;
  }

  function ghostFrom(rect, radiusFrom, to, radiusTo, src, ms) {
    const g = document.createElement("img");
    g.className = "ghost";
    g.src = src;
    Object.assign(g.style, {
      left: rect.left + "px", top: rect.top + "px",
      width: rect.width + "px", height: rect.height + "px",
      borderRadius: radiusFrom,
    });
    document.body.appendChild(g);
    requestAnimationFrame(() => {
      g.style.transition = `left ${ms}ms var(--ease), top ${ms}ms var(--ease), width ${ms}ms var(--ease), height ${ms}ms var(--ease), border-radius ${ms}ms var(--ease)`;
      g.style.left = to.left + "px"; g.style.top = to.top + "px";
      g.style.width = to.width + "px"; g.style.height = to.height + "px";
      g.style.borderRadius = radiusTo;
    });
    return g;
  }

  function open(items, i, originEl) {
    list = items; origin = originEl || null; originIndex = i;
    lastFocus = document.activeElement;
    show(i);
    el.hidden = false;
    el.style.pointerEvents = "";
    document.body.classList.add("lock", "cur-hide");
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => $("#lb-close").focus({ preventScroll: true }), 60);

    if (CALM || !originEl) return;
    const r = originEl.getBoundingClientRect();
    const d = list[i];
    const g = ghostFrom(r, "1px", fit(d.w, d.h), "1px", originEl.currentSrc || originEl.src, 560);
    setTimeout(() => g.remove(), 580);
  }

  function close() {
    const backTo = origin && document.contains(origin) && at === originIndex
      ? origin.getBoundingClientRect() : null;
    el.style.pointerEvents = "none";
    document.body.classList.remove("lock", "cur-hide");
    if (Viewer.isOpen) document.body.classList.add("lock");

    if (!CALM && backTo && img.src) {
      const g = ghostFrom(img.getBoundingClientRect(), "1px", backTo, "1px", img.src, 500);
      setTimeout(() => g.remove(), 520);
    }
    el.classList.remove("in");
    img.classList.remove("show");
    setTimeout(() => {
      el.hidden = true;
      el.style.pointerEvents = "";
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }, CALM ? 0 : 460);
  }

  $("#lb-close").addEventListener("click", close);
  $("#lb-prev").addEventListener("click", () => show(at - 1));
  $("#lb-next").addEventListener("click", () => show(at + 1));
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest(".lb-fig")) close(); });

  addEventListener("keydown", (e) => {
    if (el.hidden) return;
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "ArrowRight") show(at + 1);
    if (e.key === "ArrowLeft") show(at - 1);
  });

  let tx = null;
  el.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 48) show(at + (dx < 0 ? 1 : -1));
    tx = null;
  }, { passive: true });

  return { open, close };
})();

/* -------------------------------------------------------------------------
   CURSOR — a dot, a ring, and a word when the ring means something
   ------------------------------------------------------------------------- */
function initCursor() {
  if (!FINE || CALM) return;
  document.body.classList.add("cursor-on");

  const dot = document.createElement("div"); dot.className = "cur";
  const ring = document.createElement("div"); ring.className = "cur-ring";
  const word = document.createElement("em"); ring.appendChild(word);
  document.body.append(dot, ring);

  let mx = -200, my = -200, rx = -200, ry = -200;
  addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  addEventListener("pointerdown", () => ring.style.transform += " scale(.86)");

  (function loop() {
    rx = lerp(rx, mx, 0.17); ry = lerp(ry, my, 0.17);
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    requestAnimationFrame(loop);
  })();

  document.addEventListener("pointerover", (e) => {
    const t = e.target;
    const viewish = t.closest(".shot-media, .roll-frame.is-active .roll-frame-in, .lb-fig");
    const linkish = t.closest("a, button, [role='button']");
    document.body.classList.toggle("cur-view", !!viewish);
    document.body.classList.toggle("cur-link", !viewish && !!linkish);
    if (viewish) word.textContent = t.closest(".roll-frame") ? "Open" : (t.closest(".lb-fig") ? "Close" : "View");
  });
  document.addEventListener("pointerleave", () => document.body.classList.add("cur-hide"));
  document.addEventListener("pointerenter", () => document.body.classList.remove("cur-hide"));
}

/* Magnetic pull on the few elements worth reaching for. */
function initMagnetic() {
  if (!FINE || CALM) return;
  $$("[data-magnetic]").forEach((el) => {
    let raf = null, tx = 0, ty = 0, cx = 0, cy = 0;
    const run = () => {
      cx = lerp(cx, tx, 0.18); cy = lerp(cy, ty, 0.18);
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf = Math.abs(cx - tx) > 0.1 || Math.abs(cy - ty) > 0.1 ? requestAnimationFrame(run) : null;
    };
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * 0.16;
      ty = (e.clientY - (r.top + r.height / 2)) * 0.28;
      if (!raf) raf = requestAnimationFrame(run);
    });
    el.addEventListener("pointerleave", () => {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(run);
    });
  });
}

/* -------------------------------------------------------------------------
   Smooth in-page links (without stealing the browser's native behaviour)
   ------------------------------------------------------------------------- */
function initAnchors() {
  $$("a[data-scroll]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const t = document.querySelector(a.getAttribute("href"));
      if (!t) return;
      e.preventDefault();
      window.scrollTo({ top: t.offsetTop, behavior: CALM ? "instant" : "smooth" });
    });
  });
}

/* -------------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------------- */
function boot() {
  measure();

  // Anything the very first screen paints, and nothing else.
  const critical = ["images/hero.jpg"];
  const p = DATA.find((c) => c.id === "portrait");
  if (p) critical.push(thumb("portrait", p.images[0].f));

  initLoader(critical);
  initDepth();
  initNav();
  initHero();
  initStatement();
  initStroke();
  initMarquee();
  initIndex();
  Roll.build();
  initCursor();
  initMagnetic();
  initAnchors();

  $$("[data-split]").forEach((el) => splitWords(el));
  Reveal.scan();
  Lazy.scan();
  Ticker.kick();
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", boot)
  : boot();
})();
