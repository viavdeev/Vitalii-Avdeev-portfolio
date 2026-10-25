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

// Transparent videos (WB Club phones): VP9-with-alpha WebM everywhere except WebKit (Safari, every iOS browser), which ignores the
// alpha channel and would draw a solid frame around the phone. WebKit gets the opaque H.264 twin instead.
{
  const ua = navigator.userAgent;
  const webkit = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||
    (/Safari/.test(ua) && !/Chrome|Chromium|Android|Edg|OPR|Firefox/.test(ua));
  document.querySelectorAll('video[data-webm]').forEach((v) => {
    v.src = webkit ? v.dataset.mp4 : v.dataset.webm;
    v.load();
  });
}

// Videos: autoplay + loop, encoded at 1.2x. Preloaded, started just before they scroll into view, paused when far away.
// Gapless loop: the native `loop` attribute only restarts AFTER the last frame has been shown and the decoder has run
// dry (visible hiccup, black flash in some browsers). Instead, the moment the LAST frame is presented we seek back to 0
// while still playing, so the next frame shown is already the first one. Native `loop` stays on as a fallback.
const videos = [...document.querySelectorAll('video[autoplay]')];
if ('IntersectionObserver' in window && videos.length) {
  const pageNear = new WeakMap(), railNear = new WeakMap();
  const near = (v) => pageNear.get(v) && railNear.get(v);
  // Paired loops (data-follow="<leader id>" data-lag="<sec>"): the follower plays the same loop `lag` seconds behind its leader.
  // Re-checked on every leader timeupdate, so it also self-heals after pauses, seeks and metadata arriving late.
  const lock = (f, force) => {
    const L = document.getElementById(f.dataset.follow), lag = +f.dataset.lag || 0;
    if (!L || !L.duration || !f.duration) return;
    const d = f.duration, want = (((L.currentTime - lag) % d) + d) % d;
    const off = Math.abs(f.currentTime - want), drift = Math.min(off, d - off);
    if (force || drift > 0.06) { f.currentTime = want; f._hold = performance.now() + 400; }   // _hold: don't let the follower's own loop-restart undo the seek
  };
  const sync = (v) => {
    if (near(v)) {
      if (v.paused) {
        if (v.dataset.follow) lock(v, true);
        v.play().catch(() => {});
      }
    } else if (!v.paused) v.pause();
  };
  videos.filter((v) => v.dataset.follow).forEach((f) => {
    const L = document.getElementById(f.dataset.follow);
    if (!L) return;
    L.addEventListener('timeupdate', () => { if (!L.paused && !f.paused) lock(f, false); });
    f.addEventListener('loadedmetadata', () => { if (near(f)) lock(f, true); });
    L.addEventListener('loadedmetadata', () => { if (near(f)) lock(f, true); });
  });

  videos.forEach((v) => {
    if (!('requestVideoFrameCallback' in v)) return;       // older browsers: native loop
    const onFrame = (_, meta) => {
      if (!v.paused && v.duration && v.duration - meta.mediaTime < 0.05 && !(v._hold > performance.now())) v.currentTime = 0;  // last frame is on screen -> restart now
      v.requestVideoFrameCallback(onFrame);
    };
    v.requestVideoFrameCallback(onFrame);
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
