// Behavioural analytics events (Umami, cookieless).
// The Umami tracker itself is loaded in <head>; clicks on links are declared in the HTML with data-umami-event
// attributes. This file adds the events that need JavaScript: which projects were actually looked at, which slides
// were reached, and how far down the page people scrolled. If Umami is blocked or absent every call is a silent no-op.
(() => {
  const track = (name, data) => {
    try { if (window.umami) window.umami.track(name, data); } catch (e) { /* analytics must never break the page */ }
  };
  // Same-tab links (e-mail, "View project case", back to home) are tracked here, NOT through Umami's own data-umami-event
  // attribute: Umami holds such a link back until its request has finished, which would delay the navigation (or hang it
  // if the analytics server is slow). Here the event is fired and the browser follows the link immediately; Umami sends
  // with `keepalive`, so the request survives the page change. Links that open in a new tab use Umami's attributes.
  const linkEvent = (e) => {
    if (e.type === 'auxclick' && e.button !== 1) return;          // middle-click = "open in new tab"
    const a = e.target && e.target.closest ? e.target.closest('[data-ev]') : null;
    if (!a) return;
    const data = {};
    for (const attr of a.attributes) if (attr.name.startsWith('data-ev-')) data[attr.name.slice(8)] = attr.value;
    track(a.getAttribute('data-ev'), data);
  };
  document.addEventListener('click', linkEvent, true);
  document.addEventListener('auxclick', linkEvent, true);

  if (!('IntersectionObserver' in window)) return;

  const DWELL_PROJECT = 1000;   // ms a carousel must be at least half on screen to count as "viewed"
  const DWELL_SLIDE = 600;      // ms a slide must be mostly visible inside its carousel to count as "viewed"

  // ── Project viewed + Slide viewed ────────────────────────────────────────────────────────────────────────────────
  document.querySelectorAll('.project[data-project]').forEach((section) => {
    const name = section.dataset.project;
    const rail = section.querySelector('.carousel');
    if (!rail) return;
    const slides = [...rail.querySelectorAll('.slide')];

    let onScreen = false, projectSeen = false, projectTimer = 0;
    const visible = new Set(), seen = new Set(), slideTimers = new Map();

    // A slide counts once the project has been viewed, and only if it stays mostly visible for a moment (so a fast flick
    // across the carousel doesn't register every slide it passed). Slides already on screen when the project becomes
    // "viewed" are counted too, so "slide 1" = everyone who saw the project.
    const considerSlide = (i) => {
      clearTimeout(slideTimers.get(i));
      if (seen.has(i) || !visible.has(i) || !projectSeen || document.hidden) return;
      slideTimers.set(i, setTimeout(() => {
        seen.add(i);
        track('Slide viewed', { project: name, slide: i + 1, of: slides.length });
      }, DWELL_SLIDE));
    };
    const considerAll = () => slides.forEach((_, i) => considerSlide(i));

    const checkProject = () => {
      clearTimeout(projectTimer);
      if (projectSeen || !onScreen || document.hidden) return;
      projectTimer = setTimeout(() => {
        projectSeen = true;
        track('Project viewed', { project: name });
        ioProject.disconnect();
        considerAll();
      }, DWELL_PROJECT);
    };

    const ioProject = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; checkProject(); }, { threshold: 0.5 });
    ioProject.observe(rail);

    // "Mostly visible" is measured against the visible width of the carousel, so it also works when a slide is wider
    // than the carousel itself (tablet widths).
    const ioSlides = new IntersectionObserver((entries) => entries.forEach((e) => {
      const i = slides.indexOf(e.target);
      const root = e.rootBounds ? e.rootBounds.width : e.boundingClientRect.width;
      const share = e.intersectionRect.width / Math.min(e.boundingClientRect.width, root || 1);
      if (e.isIntersecting && share >= 0.6) visible.add(i); else visible.delete(i);
      considerSlide(i);
    }), { root: rail, threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
    slides.forEach((s) => ioSlides.observe(s));

    document.addEventListener('visibilitychange', () => { checkProject(); considerAll(); });
  });

  // ── Scroll depth (bottom edge of the screen, as % of the page) ───────────────────────────────────────────────────
  const marks = [25, 50, 75, 100], reached = new Set();
  let ticking = false;
  const measure = () => {
    ticking = false;
    const doc = document.documentElement;
    const pct = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
    marks.forEach((m) => {
      if (reached.has(m) || pct < (m === 100 ? 98.5 : m)) return;
      reached.add(m);
      track('Scroll depth', { percent: m });
    });
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }, { passive: true });
})();
