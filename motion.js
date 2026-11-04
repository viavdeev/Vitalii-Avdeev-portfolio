// Entrance motion for the home page, modelled on the linear.app hero (measured frame by frame, Nov 2026):
// every visual line of the hero fades in from opacity 0 + blur(10px) + translateY(20% of its height) over ~1 s with an
// ease-out-quad curve, the lines 100 ms apart. Here the same motion runs on the hero copy (line by line), the right-hand
// menu (link by link), then the first project; projects further down and the footer play it once as they scroll in.
// Carousels fade up without blur (blurring big images and videos is expensive and looks muddy).
//
// The hidden state is CSS (`.anim … :not(.r-in) { opacity: 0 }`); <html>.anim is set by an inline script in <head>, so
// nothing flashes before this file runs. Adding `.r-in` and starting a WAAPI animation with fill:'backwards' in the same
// frame hands the element over from CSS to the animation without a gap. Animations leave nothing behind when they end
// (no lingering transform / filter / will-change), so text stays crisp and hover styles keep working.
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('anim')) return;
  window.__motion = 1;

  const EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'; // ease-out-quad, as on linear.app
  const DUR_TEXT = 1000;
  const DUR_MEDIA = 1100;
  const STEP = 100;            // stagger between lines
  const STEP_SLIDE = 80;       // stagger between carousel slides
  const MAX_SPREAD = 600;      // long hero (mobile, ~9 lines) is compressed so the last line starts by 600 ms

  const reveal = (el, { delay = 0, blur = 10, shift = '20%', dur = DUR_TEXT } = {}) => {
    el.classList.add('r-in');
    const from = { opacity: 0, transform: `translateY(${shift})` };
    const to = { opacity: 1, transform: 'translateY(0)' };
    if (blur) { from.filter = `blur(${blur}px)`; to.filter = 'blur(0px)'; }
    return el.animate([from, to], { duration: dur, delay, easing: EASE, fill: 'backwards' });
  };
  const show = (el) => el.classList.add('r-in');
  const stepFor = (n) => (n > 1 ? Math.min(STEP, MAX_SPREAD / (n - 1)) : 0);

  // ── Hero: split each paragraph into its visual lines (only for the duration of the animation) ─────────────────────
  // Lines are found by measuring every character's position, so breaks match the real layout exactly (non-breaking
  // spaces, hyphens, text-indent included). Each line becomes a block-level, no-wrap span; when the animation is over
  // the paragraph's original markup is put back, so resizing and text selection behave as normal afterwards.
  const splitLines = (p) => {
    const node = p.firstChild;
    if (!node || node.nodeType !== 3 || p.childNodes.length !== 1) return null; // plain-text paragraphs only
    const text = node.nodeValue, range = document.createRange();
    const lines = [];
    let top = null, start = 0;
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i]) && text[i] !== ' ') continue;           // collapsible spaces have no reliable box
      range.setStart(node, i); range.setEnd(node, i + 1);
      const r = range.getClientRects()[0];
      if (!r) continue;
      if (top === null) top = r.top;
      else if (r.top - top > r.height / 2) { lines.push(text.slice(start, i)); start = i; top = r.top; }
    }
    lines.push(text.slice(start));
    const html = p.innerHTML;
    p.textContent = '';
    const spans = lines.map((t) => {
      const s = document.createElement('span');
      s.className = 'ln';
      s.textContent = t;
      p.appendChild(s);
      return s;
    });
    return { spans, restore: () => { p.innerHTML = html; } };
  };

  const playHero = () => {
    const paras = [...document.querySelectorAll('.intro__text p')];
    const items = [];      // { el, split? } in reading order
    const restores = [];
    paras.forEach((p) => {
      const sp = splitLines(p);
      if (sp) { restores.push(sp.restore); sp.spans.forEach((s) => items.push(s)); show(p); }
      else items.push(p);
    });
    const step = stepFor(items.length);
    const anims = items.map((el, i) => reveal(el, { delay: i * step }));

    // Menu, link by link on the same rhythm: beside the copy (desktop) it starts a beat after the first line; stacked
    // under it (tablet, mobile) it follows the last line.
    const nav = document.querySelector('.intro__links'), txt = document.querySelector('.intro__text');
    const below = nav && txt && nav.getBoundingClientRect().top >= txt.getBoundingClientRect().bottom - 1;
    const navStart = below ? (items.length - 1) * step + STEP : STEP;
    document.querySelectorAll('.intro__links a').forEach((a, i) => anims.push(reveal(a, { delay: navStart + i * STEP })));

    // Put the paragraphs back together once every hero line has landed (or straight away if the layout changes).
    let restored = false;
    const restore = () => {
      if (restored) return; restored = true;
      anims.forEach((a) => { try { a.finish(); } catch (e) {} });
      restores.forEach((r) => r());
      removeEventListener('resize', restore);
    };
    Promise.all(anims.map((a) => a.finished)).then(restore, restore);
    addEventListener('resize', restore);
    return below ? navStart + 2 * STEP : (items.length - 1) * step;   // when the last hero element starts
  };

  // ── Projects: header (blur, like the hero) then slides fading up one after another ─────────────────────────────────
  // Slides never fade in empty: they wait until the pictures they show are downloaded AND decoded, so they arrive
  // complete. If that takes longer than `cap` ms (slow connection) they come in anyway and fill in as usual.
  const settled = (p) => p.then(() => {}, () => {});
  const imgReady = (img) => settled(img.decode ? img.decode() : (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; })));
  const mediaReady = (slides) => {
    const waits = [];
    slides.forEach((sl) => {
      sl.querySelectorAll('img').forEach((img) => waits.push(imgReady(img)));
      sl.querySelectorAll('video').forEach((v) => {
        const src = v.getAttribute('poster') || v.dataset.poster;
        if (src) { const i = new Image(); i.src = src; waits.push(imgReady(i)); }
      });
    });
    return Promise.all(waits);
  };

  const playProject = (sec, delay, cap) => {
    const t0 = performance.now();
    const head = sec.querySelector('.phead');
    if (head) reveal(head, { delay, blur: 8, shift: '10px' });   // text needs nothing but the font: on schedule
    const rail = sec.querySelector('.carousel');
    const edge = rail ? rail.getBoundingClientRect().right : innerWidth;
    const onScreen = [];
    [...sec.querySelectorAll('.slide')].forEach((s) => {
      // only slides that are actually on screen animate; the rest are simply shown
      if (s.getBoundingClientRect().left < edge && onScreen.length < 6) onScreen.push(s); else show(s);
    });
    Promise.race([mediaReady(onScreen), new Promise((r) => setTimeout(r, cap))]).then(() => {
      const late = performance.now() - t0;                        // time already spent waiting
      const base = Math.max(0, delay + 120 - late);
      onScreen.forEach((s, k) => reveal(s, { delay: base + k * STEP_SLIDE, blur: 0, shift: '24px', dur: DUR_MEDIA }));
    });
  };

  const playFooter = (footer) => {
    footer.querySelectorAll('.footer__links a').forEach((a, i) => reveal(a, { delay: i * STEP }));
    const copy = footer.querySelector('.footer__copy');
    if (copy) reveal(copy, { delay: 200, blur: 6, shift: '6px' });
  };

  // ── Sequence ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const start = () => {
    const lastHeroLine = playHero();

    // Anything below the hero: in the first screen it follows the hero; further down it plays when scrolled into view.
    const vh = innerHeight;
    const later = [];
    let firstScreen = 0;
    document.querySelectorAll('.project').forEach((sec) => {
      const top = sec.getBoundingClientRect().top;
      if (top < vh * 0.92 && sec.getBoundingClientRect().bottom > 0) playProject(sec, lastHeroLine + 200 + firstScreen++ * 150, 3000);
      else later.push(sec);
    });
    const footer = document.querySelector('.footer');
    if (footer) later.push(footer);

    if (!('IntersectionObserver' in window)) { later.forEach((el) => el.querySelectorAll('.phead, .slide, .footer__links a, .footer__copy').forEach(show)); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target;
      // Scrolled past already (e.g. a jump to the bottom): show it without animation.
      if (e.boundingClientRect.bottom < 0) { el.querySelectorAll('.phead, .slide, .footer__links a, .footer__copy').forEach(show); return; }
      if (el.classList.contains('footer')) playFooter(el); else playProject(el, 0, 1200);
    }), { rootMargin: '0px 0px -12% 0px' });
    later.forEach((el) => io.observe(el));
  };

  // Lines must be measured in the final font, so wait for it (it is preloaded; give up after 1.2 s and use whatever is
  // there). In a background tab, wait until the page is actually seen.
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('400 33px "ALS Hauss"'), new Promise((r) => setTimeout(r, 1200))])
    : Promise.resolve();
  const whenVisible = () => new Promise((r) => {
    if (!document.hidden) return r();
    const on = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', on); r(); } };
    document.addEventListener('visibilitychange', on);
  });
  fontReady.then(whenVisible).then(() => requestAnimationFrame(start)).catch(() => root.classList.remove('anim'));
})();
