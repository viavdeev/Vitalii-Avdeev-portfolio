// Case pages: figure videos load when they come near the viewport and play only while visible.
(() => {
  const vids = [...document.querySelectorAll('video.lazyv')];
  const hero = document.querySelector('.hero video');
  const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  // iOS Low Power Mode / data saver refuse autoplay: start on the first touch instead
  const unlock = () => { document.querySelectorAll('video').forEach((v) => { if (v.dataset.visible !== '0' && v.paused && v.src) play(v); }); };
  ['pointerdown', 'touchend', 'keydown'].forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }));
  // WB cover loop (data-srcs = width:url,...): fetched right after the cover image is in, the size matching the device pixels,
  // shown once its first frame is on screen (the cover image underneath is that frame). Skipped for Save-Data / reduced motion.
  if (hero && hero.dataset.srcs) {
    const c = navigator.connection;
    const skip = (c && c.saveData) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const img = hero.parentNode.querySelector('img');
    const go = () => {
      if (skip || hero.src) return;
      const need = hero.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 3);
      const opts = hero.dataset.srcs.split(',').map((o) => { const i = o.indexOf(':'); return [+o.slice(0, i), o.slice(i + 1)]; });
      const on = () => hero.classList.add('is-on');
      if ('requestVideoFrameCallback' in hero) hero.requestVideoFrameCallback(on);
      hero.addEventListener('playing', on, { once: true });
      hero.addEventListener('timeupdate', () => { if (hero.currentTime > 0) on(); }, { once: true });
      hero.src = (opts.find(([w]) => w >= need) || opts[opts.length - 1])[1];
      if (hero.dataset.visible !== '0') play(hero);
    };
    if (!img || img.complete) go();
    else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); setTimeout(go, 2500); }
  } else if (hero) play(hero);
  if (!('IntersectionObserver' in window)) { vids.forEach((v) => { v.src = v.dataset.src; play(v); }); return; }
  const load = new IntersectionObserver((es) => es.forEach(({ target: v, isIntersecting }) => {
    if (!isIntersecting) return;
    v.src = v.dataset.src; v.preload = 'auto'; load.unobserve(v);
  }), { rootMargin: '150% 0px' });
  const vis = new IntersectionObserver((es) => es.forEach(({ target: v, isIntersecting }) => {
    v.dataset.visible = isIntersecting ? '1' : '0';
    if (isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; play(v); } else v.pause();
  }), { threshold: 0.05 });
  vids.forEach((v) => { load.observe(v); vis.observe(v); });
  if (hero) vis.observe(hero);
})();
