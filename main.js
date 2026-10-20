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

// Videos: autoplay + loop (already encoded at 1.5× speed). Play only while visible.
const videos = document.querySelectorAll('video[autoplay]');
if ('IntersectionObserver' in window && videos.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) target.play().catch(() => {});
      else target.pause();
    });
  }, { rootMargin: '200px' });
  videos.forEach((v) => io.observe(v));
}
