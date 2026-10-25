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

// Transparent videos (WB Club phones). They are fetched only when they get near the viewport (see sync() below).
//  - Chrome / Firefox / Edge: VP9-with-alpha WebM (data-webm), played natively.
//  - Safari / every iOS browser (WebKit): HEVC-with-alpha .mov made with Apple's encoder (data-hevc), played natively.
//  - WebKit without HEVC decoding (very old devices): "stacked alpha" H.264 (data-sa, colour | alpha halves)
//    recombined on a <canvas> by a tiny WebGL pass. Append ?stack to the URL to force this path for testing.
const WEBKIT = (() => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||
    (/Safari/.test(ua) && !/Chrome|Chromium|Android|Edg|OPR|Firefox/.test(ua));
})();
const HEVC = WEBKIT && !!document.createElement('video').canPlayType('video/mp4; codecs="hvc1"');
const STACKED = /[?&]stack\b/.test(location.search) || (WEBKIT && !HEVC);

const attach = (v) => {
  if (!v.dataset.webm || v.dataset.attached) return;
  v.dataset.attached = '1';
  v.src = STACKED ? v.dataset.sa : (WEBKIT && v.dataset.hevc ? v.dataset.hevc : v.dataset.webm);
  if (!STACKED && WEBKIT && v.dataset.hevc) {
    // If this Safari can't decode the HEVC-alpha file, fall back to the stacked-alpha canvas instead of a broken frame.
    v.addEventListener('error', () => {
      if (v.dataset.fallback) return;
      v.dataset.fallback = '1';
      stackedCanvas(v);
      v.src = v.dataset.sa;
      v.play().catch(() => {});
    });
  }
};

function stackedCanvas(v) {
  const c = document.createElement('canvas');
  c.className = v.className; c.style.cssText = v.style.cssText;
  c.style.pointerEvents = 'none'; c.setAttribute('aria-hidden', 'true');
  c.style.backgroundImage = 'url("' + v.getAttribute('poster') + '")'; c.style.backgroundSize = '100% 100%';
  v.after(c); v.style.opacity = '0.001';   // not 0: Safari stops decoding/presenting fully transparent videos
  const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return;                                   // no WebGL: the (transparent) poster simply stays
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 u;void main(){u=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D t;varying vec2 u;' +
    'void main(){vec3 c=texture2D(t,vec2(u.x*.5,u.y)).rgb;float a=texture2D(t,vec2(.5+u.x*.5,u.y)).r;gl_FragColor=vec4(c,a);}'));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let first = true;
  const draw = () => {
    if (v.readyState < 2 || !v.videoWidth) return;
    const w = v.videoWidth >> 1, h = v.videoHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (first) { first = false; c.style.backgroundImage = 'none'; }
  };
  // Redraw on every animation frame while playing (rAF, not requestVideoFrameCallback: Safari does not report frames of a
  // video it doesn't composite, which left the canvas frozen on the first frame).
  let raf = 0, last = -1;
  const tick = () => {
    if (v.currentTime !== last) { last = v.currentTime; draw(); }
    raf = v.paused ? 0 : requestAnimationFrame(tick);
  };
  v.addEventListener('play', () => { if (!raf) raf = requestAnimationFrame(tick); });
  v.addEventListener('playing', () => { if (!raf) raf = requestAnimationFrame(tick); });
  ['loadeddata', 'seeked', 'playing'].forEach((e) => v.addEventListener(e, draw));
}
if (STACKED) document.querySelectorAll('video[data-webm]').forEach(stackedCanvas);

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
      attach(v);
      if (v.paused) {
        if (v.dataset.follow) lock(v, true);
        v.play().catch(() => {});
      }
    } else if (!v.paused) v.pause();
  };
  // When the browser refuses autoplay (e.g. Safari in Low Power Mode shows a play button), start the visible videos on the
  // first real interaction anywhere on the page (click, tap, key, carousel drag).
  const unlock = () => videos.forEach((v) => { if (near(v) && v.paused) { attach(v); v.play().catch(() => {}); } });
  ['pointerdown', 'touchend', 'keydown'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));

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
