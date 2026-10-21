// Carousels: native horizontal scroll (trackpad / touch), plus click-and-drag for mouse users.
document.querySelectorAll('.carousel').forEach((el) => {
  let down = false, moved = false, startX = 0, startLeft = 0, lastX = 0, lastT = 0, v = 0, raf = 0;

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    cancelAnimationFrame(raf);
    down = true; moved = false;
    startX = lastX = e.clientX; startLeft = el.scrollLeft; lastT = performance.now(); v = 0;
  });

  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) { moved = true; el.classList.add('is-dragging'); }
    if (!moved) return;
    el.scrollLeft = startLeft - dx;
    const now = performance.now();
    v = (e.clientX - lastX) / Math.max(1, now - lastT);
    lastX = e.clientX; lastT = now;
  });

  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    el.classList.remove('is-dragging');
    if (!moved) return;
    // light inertia
    let vel = v * 16;
    const step = () => {
      if (Math.abs(vel) < 0.5) return;
      el.scrollLeft -= vel; vel *= 0.92;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });

  // Keyboard: arrow keys scroll one slide
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const slide = el.querySelector('.slide');
    const step = (slide ? slide.getBoundingClientRect().width : 300) + 10;
    el.scrollBy({ left: e.key === 'ArrowRight' ? step : -step, behavior: 'smooth' });
  });
});

// Videos: autoplay, loop at 1.2x (encoded). Preloaded, started just before they scroll into view, paused when far away.
// The loop is driven here instead of the native `loop` attribute, which jump-cuts from the last frame straight to the
// first (and flashes/stutters in some browsers). Each cycle:  play -> hold the final frame -> fade to the empty slide
// -> rewind while hidden -> short empty beat -> fade in on the first frame -> play.
// Timings (ms) — tweak here:
const LOOP = { hold: 700, fade: 350, gap: 300 };   // CSS: video.box transition .35s must match `fade`

const videos = [...document.querySelectorAll('video[autoplay]')];
if ('IntersectionObserver' in window && videos.length) {
  const pageNear = new WeakMap(), railNear = new WeakMap();
  const near = (v) => pageNear.get(v) && railNear.get(v);
  const sync = (v) => {
    if (near(v)) { if (v.paused && !v.ended && !v._resting) v.play().catch(() => {}); }
    else if (!v.paused) v.pause();
  };

  videos.forEach((v) => {
    v.loop = false;                                   // custom loop (without JS the native `loop` attribute still works)
    v.addEventListener('ended', () => {
      v._resting = true;
      v._t = setTimeout(() => {
        v.classList.add('is-gap');                    // fade out to the empty slide
        v._t = setTimeout(() => {
          v.currentTime = 0;                          // rewind while invisible
          v._t = setTimeout(() => {
            v._resting = false;
            v.classList.remove('is-gap');             // fade in on the first frame
            if (near(v)) v.play().catch(() => {});    // (if scrolled away meanwhile, sync() starts it later)
          }, LOOP.gap);
        }, LOOP.fade);
      }, LOOP.hold);
    });
  });

  // 1) vertical: is the carousel within ~1 screen of the viewport?
  const ioPage = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
    target.querySelectorAll('video[autoplay]').forEach((v) => { pageNear.set(v, isIntersecting); sync(v); });
  }), { rootMargin: '100% 0px' });
  // 2) horizontal: is the slide within ~1 screen of the visible part of its carousel?
  document.querySelectorAll('.carousel').forEach((rail) => {
    ioPage.observe(rail);
    const ioRail = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
      railNear.set(target, isIntersecting); sync(target);
    }), { root: rail, rootMargin: '0px 100% 0px 100%' });
    rail.querySelectorAll('video[autoplay]').forEach((v) => ioRail.observe(v));
  });
}

// Images: every slide image is fetched right after first paint (small WebP, ~1.5 MB in total, low priority so the
// first screen is never delayed) — no lazy-loading, so nothing is "requested late" while you scroll.
// Then the browser is asked to DECODE the slides ahead of the viewport (about 1.5 screens either side), so the
// next picture is already a ready bitmap when it slides in.
if ('IntersectionObserver' in window) {
  document.querySelectorAll('.carousel').forEach((rail) => {
    const ahead = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting || target.dataset.decoded) return;
      target.dataset.decoded = '1';
      if (target.decode) target.decode().catch(() => {});
    }), { root: rail, rootMargin: '0px 150% 0px 150%' });
    rail.querySelectorAll('img').forEach((img) => ahead.observe(img));
  });
}
