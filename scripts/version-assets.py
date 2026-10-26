#!/usr/bin/env python3
"""Cache-busting: appends ?v=<content hash> to every /assets/img|video/* reference in index.html
(src, srcset, poster, data-src, data-webm, data-hevc, data-sa) and to the code files (main.js, styles.css, case.css, case.js) in every page. Assets are cached for 7 days, so run this after replacing ANY image or video:
  python3 scripts/version-assets.py"""
import re, hashlib, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
def sub(m):
    f = root / m.group(1).lstrip("/")
    return f'{m.group(1)}?v={hashlib.md5(f.read_bytes()).hexdigest()[:8]}'
def sub2(m):
    f = root / m.group(2).lstrip("/")
    return f'{m.group(1)}="{m.group(2)}?v={hashlib.md5(f.read_bytes()).hexdigest()[:8]}"'
for p in sorted(root.glob("*.html")):
    if p.name == "diag.html":
        continue
    h = p.read_text(encoding="utf-8")
    h, n = re.subn(r'(/assets/(?:img|video)/[^"?\s,]+\.(?:webp|png|jpg|svg|mp4|webm|mov))(?:\?v=\w+)?', sub, h)
    h, n2 = re.subn(r'(href|src)="(/(?:main\.js|styles\.css|case\.css|case\.js))(?:\?v=\w+)?"', sub2, h)   # code too: it is cached for hours
    p.write_text(h, encoding="utf-8"); print(p.name, "versioned", n, "asset references +", n2, "code files")
