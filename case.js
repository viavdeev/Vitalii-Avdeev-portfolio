// Case pages: figure videos load when they come near the viewport and play only while visible.
(() => {
  const vids = [...document.querySelectorAll('video.lazyv')];
  const hero = document.querySelector('.hero video');
  const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  // iOS Low Power Mode / data saver refuse autoplay: start on the first touch instead
  const unlock = () => { document.querySelectorAll('video').forEach((v) => { if (v.dataset.visible !== '0' && v.paused && v.src) play(v); }); };
  ['pointerdown', 'touchend', 'keydown'].forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }));
  if (hero) play(hero);
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
