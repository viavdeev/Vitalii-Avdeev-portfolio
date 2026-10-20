# viavdeev.com

Static portfolio site — plain HTML/CSS/JS, no build step. Deployed on Vercel (Hobby, free) from GitHub `main`.

- `index.html` — page markup (two projects: Go Invest, Strelka)
- `styles.css` — layout; breakpoints mirror the Figma frames (mobile <744, tablet 744–1279, desktop ≥1280)
- `main.js` — carousel drag-scroll + video autoplay when visible
- `assets/` — fonts (ALS Hauss variable, Tinos fallback), images (2× WebP), videos
- `scripts/process-videos.sh` — speeds videos 1.5×, strips audio, encodes for web

Local preview: `python3 -m http.server 8080` → http://localhost:8080

## Copy edits

Visible text uses non-breaking spaces (short words, names, last two words of a line). After changing any copy in
`index.html`, run `python3 scripts/nbsp.py` to re-apply them (safe to run repeatedly).
