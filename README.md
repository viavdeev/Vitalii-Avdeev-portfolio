# viavdeev.com

Static portfolio site — plain HTML/CSS/JS, no build step. Deployed on Vercel (Hobby, free) from GitHub `main`.

- `index.html` — page markup (two projects: Go Invest, Strelka)
- `styles.css` — layout; breakpoints mirror the Figma frames (mobile <744, tablet 744–1279, desktop ≥1280)
- `main.js` — carousel drag-scroll + video autoplay when visible
- `assets/` — fonts (ALS Hauss variable, Tinos fallback), images (2× WebP), videos
- `scripts/process-videos.sh` — speeds videos 1.5×, strips audio, encodes for web

Local preview: `python3 -m http.server 8080` → http://localhost:8080
