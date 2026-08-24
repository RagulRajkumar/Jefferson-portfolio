(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  /* ------------------------------------------------------------------ */
  /* Gallery data — mirrors /images/<category>/01.jpg ... NN.jpg          */
  /* ------------------------------------------------------------------ */
  const CATEGORIES = [
    { id: "landscape",   title: "Landscape",    num: "01", count: 16, blurb: "Places shaped by light, distance and silence.", interlude: "05", ilTitle: "Where the\nhorizon breathes" },
    { id: "architecture",title: "Architecture", num: "02", count: 21, blurb: "Lines, mass and the geometry of light.", interlude: "07", ilTitle: "Structures\nheld by light" },
    { id: "portrait",    title: "Portrait",     num: "03", count: 16, blurb: "A face, a moment, held still.", interlude: "04", ilTitle: "The quiet\nbefore a look" },
    { id: "wildlife",    title: "Wildlife",     num: "04", count: 29, blurb: "Instinct, patience, and the wild unposed.", interlude: "09", ilTitle: "Untamed,\nunhurried" },
    { id: "fashion",     title: "Fashion",      num: "05", count: 10, blurb: "Form, fabric and a certain attitude.", interlude: "02", ilTitle: "Cut, contrast,\nconfidence" },
    { id: "event",       title: "Event",        num: "06", count: 5,  blurb: "Fleeting rooms, remembered in frames.", interlude: "03", ilTitle: "One night,\nheld in frame" },
    { id: "food",        title: "Food",         num: "07", count: 8,  blurb: "Texture and appetite, composed.", interlude: "03", ilTitle: "Made to be\nlooked at first" },
    { id: "product",     title: "Product",      num: "08", count: 12, blurb: "Objects, considered until they feel inevitable.", interlude: "06", ilTitle: "Precision,\nlit well" },
  ];

  const pad = (n) => String(n).padStart(2, "0");
  const src = (cat, n) => `images/${cat}/${pad(n)}.jpg`;

  /* ------------------------------------------------------------------ */
  /* Build the flat list of all images (for lightbox) + render galleries */
  /* Gallery layout: horizontal drag-to-scroll filmstrip, natural aspect */
  /* ratios, no filenames or captions in the UI.                        */
  /* ------------------------------------------------------------------ */
  const allImages = []; // { src, cat, index }

  function buildGalleries() {
    const root = document.getElementById("galleries");
    CATEGORIES.forEach((cat) => {
      // chapter header — content still reveals as the user scrolls to it,
      // each line wrapped in a .pw parallax layer moving at its own speed
      const chapter = document.createElement("section");
      chapter.className = "chapter";
      chapter.id = cat.id;
      chapter.innerHTML = `
        <div class="chapter-head">
          <span class="pw" data-speed="0.12" style="display:inline-block"><span class="chapter-num reveal">${cat.num}</span></span>
          <h2 class="chapter-title reveal-mask pw" data-speed="0.05"><span>${cat.title}</span></h2>
        </div>
        <div class="chapter-rule"></div>
        <div class="pw" data-speed="0.08">
          <p class="chapter-copy reveal">${cat.blurb}</p>
          <svg class="sketch reveal" viewBox="0 0 220 20" width="180" height="20" aria-hidden="true"><path d="M3 11 Q 38 3 76 10 T 155 8 T 217 12"/></svg>
        </div>
      `;
      root.appendChild(chapter);

      // filmstrip — every photograph at its natural aspect ratio, dragged
      // or scrolled horizontally, with the category name floating huge and
      // faint behind the frames (echoing the chapter title above it)
      const gallery = document.createElement("div");
      gallery.className = "gallery";
      const wrap = document.createElement("div");
      wrap.className = "filmstrip-wrap";
      const mark = document.createElement("div");
      mark.className = "filmstrip-mark";
      mark.textContent = cat.title;
      mark.setAttribute("aria-hidden", "true");
      const viewport = document.createElement("div");
      viewport.className = "filmstrip-viewport";
      viewport.tabIndex = 0;
      viewport.setAttribute("role", "region");
      viewport.setAttribute("aria-label", `${cat.title} photographs`);
      const track = document.createElement("div");
      track.className = "filmstrip-track";

      for (let n = 1; n <= cat.count; n++) {
        const frame = document.createElement("div");
        frame.className = "frame reveal-scale";
        frame.style.transitionDelay = `${(n % 6) * 60}ms`;
        const idx = allImages.length;
        allImages.push({ src: src(cat.id, n), cat: cat.title, index: allImages.length + 1 });
        frame.innerHTML = `<img src="${src(cat.id, n)}" alt="${cat.title} photograph" loading="lazy">`;
        frame.dataset.lbIndex = idx;
        track.appendChild(frame);
      }
      viewport.appendChild(track);
      wrap.append(mark, viewport);
      gallery.appendChild(wrap);

      const controls = document.createElement("div");
      controls.className = "fs-controls";
      controls.innerHTML = `
        <button class="fs-arrow fs-prev" aria-label="Scroll ${cat.title} left">&larr;</button>
        <button class="fs-arrow fs-next" aria-label="Scroll ${cat.title} right">&rarr;</button>
      `;
      gallery.appendChild(controls);
      root.appendChild(gallery);

      controls.querySelector(".fs-prev").addEventListener("click", () => {
        viewport.scrollBy({ left: -viewport.clientWidth * 0.7, behavior: "smooth" });
      });
      controls.querySelector(".fs-next").addEventListener("click", () => {
        viewport.scrollBy({ left: viewport.clientWidth * 0.7, behavior: "smooth" });
      });
      enableDragScroll(viewport);

      // interlude — image and caption move at different speeds
      const il = document.createElement("section");
      il.className = "interlude";
      const lines = cat.ilTitle.split("\n").map(l => `<div>${l}</div>`).join("");
      il.innerHTML = `
        <div class="il-media"><img src="${src(cat.id, cat.interlude)}" alt="${cat.title} feature photograph" loading="lazy"></div>
        <div class="pw" data-speed="-0.1"><div class="il-text reveal">
          <span class="eyebrow">${cat.title}</span>
          <h3>${lines}</h3>
        </div></div>
      `;
      root.appendChild(il);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Shared drag-to-scroll for horizontal viewports (mouse only — touch   */
  /* and trackpad already scroll these natively via overflow-x:auto).     */
  /* ------------------------------------------------------------------ */
  function enableDragScroll(el, onSettle) {
    let isDown = false, startX = 0, startScroll = 0, moved = false;

    function onMove(e) {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      el.scrollLeft = startScroll - dx;
    }
    function onUp() {
      if (!isDown) return;
      isDown = false;
      el.classList.remove("dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (onSettle) onSettle(moved);
    }

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return; // native touch scroll handles this
      isDown = true; moved = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.classList.add("dragging");
      // listen on window (no pointer capture) so the eventual click still
      // targets the exact element under the cursor, not this viewport
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
    // suppress the click that follows an actual drag, without touching
    // pointer capture (which would break e.target for the lightbox)
    el.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  }

  /* ------------------------------------------------------------------ */
  /* Index ribbon — curved, draggable strip of category covers. The      */
  /* slide nearest the viewport centre reads "active"; its title floats  */
  /* huge and faint behind the row. Clicking a cover or crumb jumps to    */
  /* that chapter.                                                       */
  /* ------------------------------------------------------------------ */
  function buildIndexRibbon() {
    const viewport = document.getElementById("ribbon-viewport");
    const track = document.getElementById("ribbon-track");
    const label = document.getElementById("ribbon-label");
    const crumbs = document.getElementById("ribbon-crumbs");
    if (!viewport || !track) return;

    CATEGORIES.forEach((cat, i) => {
      const slide = document.createElement("div");
      slide.className = "ribbon-slide";
      slide.dataset.index = i;
      slide.innerHTML = `
        <img src="${src(cat.id, 1)}" alt="${cat.title} category cover" loading="lazy">
        <span class="ribbon-slide-title">${cat.title}</span>
      `;
      slide.addEventListener("click", () => {
        const el = document.getElementById(cat.id);
        if (el) el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
      track.appendChild(slide);

      const crumb = document.createElement("button");
      crumb.type = "button";
      crumb.textContent = cat.title;
      crumb.dataset.index = i;
      crumb.addEventListener("click", () => {
        const target = track.children[i];
        const targetLeft = target.offsetLeft - (viewport.clientWidth - target.offsetWidth) / 2;
        viewport.scrollTo({ left: targetLeft, behavior: reduceMotion ? "auto" : "smooth" });
      });
      crumbs.appendChild(crumb);
    });

    const slides = Array.from(track.children);
    const crumbButtons = Array.from(crumbs.children);
    let activeIndex = -1;
    let ticking = false;

    function update() {
      const vpRect = viewport.getBoundingClientRect();
      const centerX = vpRect.left + vpRect.width / 2;
      let nearest = 0, nearestDist = Infinity;

      slides.forEach((slide, i) => {
        const r = slide.getBoundingClientRect();
        const slideCenter = r.left + r.width / 2;
        const dist = slideCenter - centerX;
        const norm = Math.max(-1, Math.min(1, dist / (vpRect.width * 0.6)));

        if (!reduceMotion) {
          const lift = Math.pow(Math.abs(norm), 2) * 46;
          const tilt = norm * 7;
          const scale = 1 - Math.abs(norm) * 0.14;
          slide.style.transform = `translateY(${lift.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
        }
        if (Math.abs(dist) < nearestDist) { nearestDist = Math.abs(dist); nearest = i; }
      });

      if (nearest !== activeIndex) {
        activeIndex = nearest;
        slides.forEach((s, i) => s.classList.toggle("is-active", i === activeIndex));
        crumbButtons.forEach((c, i) => c.classList.toggle("active", i === activeIndex));
        label.innerHTML = `<span>${CATEGORIES[activeIndex].title}</span>`;
      }
      ticking = false;
    }

    viewport.addEventListener("scroll", () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener("resize", () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });

    enableDragScroll(viewport);
    update();
    // start centred on the first category
    requestAnimationFrame(() => {
      const first = slides[0];
      viewport.scrollLeft = first.offsetLeft - (viewport.clientWidth - first.offsetWidth) / 2;
      update();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Curtain wipe — one solid panel slides away to open onto the work    */
  /* ------------------------------------------------------------------ */
  function initCurtain() {
    const curtain = document.querySelector(".curtain");
    if (!curtain) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          curtain.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    io.observe(curtain);
  }

  /* ------------------------------------------------------------------ */
  /* Preloader                                                          */
  /* ------------------------------------------------------------------ */
  function initPreloader() {
    const pre = document.getElementById("preloader");
    const hero = document.querySelector(".hero");
    const heroImg = document.querySelector(".hero-media img");

    const finish = () => {
      pre.classList.add("hide");
      hero.classList.add("ready");
      heroImg.classList.add("loaded");
      setTimeout(() => pre.remove(), 800);
    };

    const done = () => setTimeout(finish, reduceMotion ? 0 : 350);

    if (heroImg.complete) {
      done();
    } else {
      heroImg.addEventListener("load", done);
      setTimeout(done, 2200); // safety fallback
    }
  }

  /* ------------------------------------------------------------------ */
  /* Nav scroll state + mobile menu                                     */
  /* ------------------------------------------------------------------ */
  function initNav() {
    const nav = document.querySelector(".site-nav");
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const burger = document.querySelector(".nav-burger");
    const menu = document.querySelector(".mobile-menu");
    burger.addEventListener("click", () => {
      const open = burger.classList.toggle("open");
      menu.classList.toggle("open", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      burger.classList.remove("open");
      menu.classList.remove("open");
      document.body.style.overflow = "";
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveals                                                     */
  /* ------------------------------------------------------------------ */
  function initReveals() {
    const els = document.querySelectorAll(".reveal, .reveal-mask, .reveal-scale, .chapter-rule, .sketch");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------ */
  /* Hero background + interlude parallax (rAF driven, GPU transforms)   */
  /* ------------------------------------------------------------------ */
  function initParallax() {
    if (reduceMotion) return;
    const heroImg = document.querySelector(".hero-media img");
    let ticking = false;

    function update() {
      const y = window.scrollY;
      if (heroImg) {
        const heroH = window.innerHeight;
        if (y < heroH) {
          const p = y / heroH;
          heroImg.style.transform = `scale(${1.14 - p * 0.06}) translateY(${p * 40}px)`;
        }
      }
      document.querySelectorAll(".interlude").forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
          const img = section.querySelector(".il-media img");
          if (img) img.style.transform = `translateY(${(progress - 0.5) * 60}px) scale(1.08)`;
        }
      });
      ticking = false;
    }

    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------ */
  /* Generic layered parallax — every element with class "pw" and a      */
  /* data-speed value drifts vertically against scroll, at its own rate. */
  /* Only elements currently near the viewport are tracked (via          */
  /* IntersectionObserver), so the rAF loop stays cheap regardless of    */
  /* how many hundred photographs are on the page.                      */
  /* ------------------------------------------------------------------ */
  function initLayeredParallax() {
    if (reduceMotion) return;
    const active = new Set();
    const nodes = document.querySelectorAll(".pw[data-speed]");

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) active.add(entry.target);
        else active.delete(entry.target);
      });
    }, { rootMargin: "40% 0px 40% 0px" });
    nodes.forEach((el) => io.observe(el));

    let ticking = false;
    const center = () => window.innerHeight / 2;

    function update() {
      const mid = center();
      active.forEach((el) => {
        const speed = parseFloat(el.dataset.speed) || 0;
        const rect = el.getBoundingClientRect();
        const elMid = rect.top + rect.height / 2;
        const offset = (mid - elMid) * speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      });
      ticking = false;
    }

    window.addEventListener("scroll", () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener("resize", () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------ */
  /* Custom cursor                                                      */
  /* ------------------------------------------------------------------ */
  function initCursor() {
    if (isTouch) return;
    document.body.classList.add("has-cursor");
    const dot = document.createElement("div");
    dot.className = "cursor";
    const label = document.createElement("div");
    label.className = "cursor-label";
    label.textContent = "View";
    document.body.append(dot, label);

    let mx = -100, my = -100, lx = -100, ly = -100;
    window.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; });

    function loop() {
      lx += (mx - lx) * 0.35;
      ly += (my - ly) * 0.35;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      label.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
      requestAnimationFrame(loop);
    }
    loop();

    document.addEventListener("mouseover", (e) => {
      const overFrame = e.target.closest(".frame");
      const overNav = e.target.closest("a, button");
      if (overFrame) {
        label.classList.add("active");
        dot.style.opacity = "0";
      } else if (overNav) {
        dot.style.width = "16px"; dot.style.height = "16px"; dot.style.margin = "-8px";
        dot.style.background = "var(--olive)";
        label.classList.remove("active");
        dot.style.opacity = "1";
      } else {
        label.classList.remove("active");
        dot.style.width = "10px"; dot.style.height = "10px"; dot.style.margin = "-5px";
        dot.style.background = "var(--ivory)";
        dot.style.opacity = "1";
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Lightbox — Pinterest-style morph transition. The clicked photo      */
  /* expands from its exact grid position/size into the full view; on   */
  /* close it collapses back to that same spot.                        */
  /* ------------------------------------------------------------------ */
  function initLightbox() {
    const lb = document.getElementById("lightbox");
    const img = lb.querySelector("img");
    const counter = lb.querySelector(".lb-count");
    const title = lb.querySelector(".lb-title");
    let current = 0;
    let open = false;
    let originFrame = null;
    let originIndex = null;

    function targetRect(naturalW, naturalH) {
      const maxW = window.innerWidth * 0.88;
      const maxH = window.innerHeight * 0.78;
      let w = maxW, h = w * (naturalH / naturalW);
      if (h > maxH) { h = maxH; w = h * (naturalW / naturalH); }
      return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
    }

    function renderContent(i) {
      current = (i + allImages.length) % allImages.length;
      const data = allImages[current];
      img.classList.remove("show");
      const next = new Image();
      next.onload = () => {
        img.src = data.src;
        requestAnimationFrame(() => img.classList.add("show"));
      };
      next.src = data.src;
      counter.textContent = `${pad(data.index)} / ${pad(allImages.length)}`;
      title.textContent = data.cat;
    }

    function morphOpen(frameEl, index) {
      const thumb = frameEl.querySelector("img");
      const startRect = thumb.getBoundingClientRect();
      const naturalW = thumb.naturalWidth || startRect.width;
      const naturalH = thumb.naturalHeight || startRect.height;
      const end = targetRect(naturalW, naturalH);

      open = true;
      originFrame = frameEl;
      originIndex = index;

      renderContent(index);
      lb.classList.add("open", "morphing");
      document.body.style.overflow = "hidden";

      const ghost = document.createElement("img");
      ghost.className = "lb-ghost";
      ghost.src = thumb.src;
      const radius = getComputedStyle(frameEl).borderRadius;
      Object.assign(ghost.style, {
        left: `${startRect.left}px`, top: `${startRect.top}px`,
        width: `${startRect.width}px`, height: `${startRect.height}px`,
        borderRadius: radius,
      });
      document.body.appendChild(ghost);

      requestAnimationFrame(() => {
        ghost.style.transition = "left .55s var(--ease), top .55s var(--ease), width .55s var(--ease), height .55s var(--ease), border-radius .55s var(--ease)";
        ghost.style.left = `${end.left}px`;
        ghost.style.top = `${end.top}px`;
        ghost.style.width = `${end.width}px`;
        ghost.style.height = `${end.height}px`;
        ghost.style.borderRadius = "3px";
      });

      setTimeout(() => {
        ghost.remove();
        lb.classList.remove("morphing");
      }, 560);
    }

    function fadeOpen(index) {
      open = true;
      originFrame = null;
      originIndex = null;
      renderContent(index);
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function morphClose() {
      const stillThere = originFrame && document.body.contains(originFrame) && current === originIndex;
      if (!stillThere || reduceMotion) {
        fadeClose();
        return;
      }
      const thumb = originFrame.querySelector("img");
      const endRect = thumb.getBoundingClientRect();
      const startRect = img.getBoundingClientRect();
      const radius = getComputedStyle(originFrame).borderRadius;

      const ghost = document.createElement("img");
      ghost.className = "lb-ghost";
      ghost.src = img.src;
      Object.assign(ghost.style, {
        left: `${startRect.left}px`, top: `${startRect.top}px`,
        width: `${startRect.width}px`, height: `${startRect.height}px`,
        borderRadius: "3px",
      });
      document.body.appendChild(ghost);

      lb.classList.add("morphing");
      open = false;
      document.body.style.overflow = "";

      requestAnimationFrame(() => {
        ghost.style.transition = "left .5s var(--ease), top .5s var(--ease), width .5s var(--ease), height .5s var(--ease), border-radius .5s var(--ease)";
        ghost.style.left = `${endRect.left}px`;
        ghost.style.top = `${endRect.top}px`;
        ghost.style.width = `${endRect.width}px`;
        ghost.style.height = `${endRect.height}px`;
        ghost.style.borderRadius = radius;
      });

      setTimeout(() => {
        ghost.remove();
        lb.classList.remove("open", "morphing");
        img.classList.remove("show");
      }, 520);
    }

    function fadeClose() {
      open = false;
      lb.classList.remove("open", "morphing");
      img.classList.remove("show");
      document.body.style.overflow = "";
    }

    function closeLb() {
      morphClose();
    }

    document.getElementById("galleries").addEventListener("click", (e) => {
      const frame = e.target.closest(".frame");
      if (!frame) return;
      const index = parseInt(frame.dataset.lbIndex, 10);
      if (reduceMotion) fadeOpen(index);
      else morphOpen(frame, index);
    });

    lb.querySelector(".lb-close").addEventListener("click", closeLb);
    lb.querySelector(".lb-prev").addEventListener("click", () => renderContent(current - 1));
    lb.querySelector(".lb-next").addEventListener("click", () => renderContent(current + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });

    document.addEventListener("keydown", (e) => {
      if (!open) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowRight") renderContent(current + 1);
      if (e.key === "ArrowLeft") renderContent(current - 1);
    });

    // touch swipe
    let touchX = null;
    lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) renderContent(current + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Contact form (client-side only — no backend in this package)       */
  /* ------------------------------------------------------------------ */
  function initForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const btn = form.querySelector(".btn-send span:first-child");
      const original = btn.textContent;
      btn.textContent = "Sent";
      form.reset();
      setTimeout(() => { btn.textContent = original; }, 2600);
    });
  }

  /* ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    buildGalleries();
    buildIndexRibbon();
    initPreloader();
    initNav();
    initReveals();
    initCurtain();
    initParallax();
    initLayeredParallax();
    initCursor();
    initLightbox();
    initForm();
  });
})();
