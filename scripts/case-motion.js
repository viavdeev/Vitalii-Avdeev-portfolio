// Entrance motion for the case pages: only the first screen, only on load (title line by line, then the meta, then the
// cover). Same motion as the home hero (linear.app): opacity 0 + blur(10px) + translateY(20%) → rest, ~1 s,
// ease-out-quad, 100 ms apart. The cover never fades in empty: it waits until its image (or the video's poster) is
// downloaded and decoded, 1.5 s at most. Inlined at the end of each case page by scripts/inject-case-motion.py
// (an inline script runs immediately; a separate file would be one more request in front of the first screen).
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('anim')) return;
  window.__motion = 1;
  const EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', STEP = 100;
  const reveal = (el, { delay = 0, blur = 10, shift = '20%', dur = 1000 } = {}) => {
    el.classList.add('r-in');
    const from = { opacity: 0, transform: `translateY(${shift})` }, to = { opacity: 1, transform: 'translateY(0)' };
    if (blur) { from.filter = `blur(${blur}px)`; to.filter = 'blur(0px)'; }
    return el.animate([from, to], { duration: dur, delay, easing: EASE, fill: 'backwards' });
  };
  // Split the title into its visual lines for the animation, and put the original markup back afterwards.
  const splitLines = (el) => {
    const node = el.firstChild;
    if (!node || node.nodeType !== 3 || el.childNodes.length !== 1) return null;
    const text = node.nodeValue, range = document.createRange(), lines = [];
    let top = null, start = 0;
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i]) && text[i] !== ' ') continue;
      range.setStart(node, i); range.setEnd(node, i + 1);
      const r = range.getClientRects()[0];
      if (!r) continue;
      if (top === null) top = r.top;
      else if (r.top - top > r.height / 2) { lines.push(text.slice(start, i)); start = i; top = r.top; }
    }
    lines.push(text.slice(start));
    const html = el.innerHTML;
    el.textContent = '';
    const spans = lines.map((t) => { const s = document.createElement('span'); s.className = 'ln'; s.textContent = t; el.appendChild(s); return s; });
    return { spans, restore: () => { el.innerHTML = html; } };
  };
  const settled = (p) => p.then(() => {}, () => {});
  const imgReady = (img) => settled(img.decode ? img.decode() : new Promise((r) => { if (img.complete) r(); else img.onload = img.onerror = r; }));
  const coverReady = (hero) => {
    const waits = [...hero.querySelectorAll('img')].map(imgReady);
    hero.querySelectorAll('video[poster]').forEach((v) => { const i = new Image(); i.src = v.poster; waits.push(imgReady(i)); });
    return Promise.all(waits);
  };

  const start = () => {
    const t0 = performance.now();
    const h1 = document.querySelector('.cintro .h1');
    const anims = [];
    let n = 1, restore = null;
    if (h1) {
      const sp = splitLines(h1);
      if (sp) { h1.classList.add('r-in'); sp.spans.forEach((s, i) => anims.push(reveal(s, { delay: i * STEP }))); n = sp.spans.length; restore = sp.restore; }
      else anims.push(reveal(h1));
    }
    const metaStart = n * STEP;
    const rows = [];
    document.querySelectorAll('.cintro .meta > div').forEach((d) => {
      const top = Math.round(d.getBoundingClientRect().top);
      let k = rows.indexOf(top); if (k < 0) { rows.push(top); k = rows.length - 1; }
      reveal(d, { delay: metaStart + k * STEP, blur: 6, shift: '8px' });
    });
    const hero = document.querySelector('.cintro > .hero');
    if (hero) {
      const due = metaStart + rows.length * STEP + 100;
      Promise.race([coverReady(hero), new Promise((r) => setTimeout(r, 1500))]).then(() => {
        reveal(hero, { delay: Math.max(0, due - (performance.now() - t0)), blur: 0, shift: '24px', dur: 1100 });
      });
    }
    if (restore) {
      let done = false;
      const back = () => { if (done) return; done = true; anims.forEach((a) => { try { a.finish(); } catch (e) {} }); restore(); removeEventListener('resize', back); };
      Promise.all(anims.map((a) => a.finished)).then(back, back);
      addEventListener('resize', back);
    }
  };
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('550 33px "ALS Hauss"'), new Promise((r) => setTimeout(r, 1200))])
    : Promise.resolve();
  const whenVisible = () => new Promise((r) => {
    if (!document.hidden) return r();
    const on = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', on); r(); } };
    document.addEventListener('visibilitychange', on);
  });
  fontReady.then(whenVisible).then(() => requestAnimationFrame(start)).catch(() => root.classList.remove('anim'));
})();
