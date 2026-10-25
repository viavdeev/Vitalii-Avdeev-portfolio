#!/usr/bin/env python3
"""Cache-busting: appends ?v=<content hash> to every /assets/img|video/* reference in index.html
(src, srcset, poster, data-webm, data-hevc, data-sa). Assets are cached for 7 days, so run this after replacing ANY image or video:
  python3 scripts/version-assets.py"""
import re, hashlib, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
p = root / "index.html"; h = p.read_text(encoding="utf-8")
def sub(m):
    f = root / m.group(1).lstrip("/")
    return f'{m.group(1)}?v={hashlib.md5(f.read_bytes()).hexdigest()[:8]}'
h, n = re.subn(r'(/assets/(?:img|video)/[^"?\s,]+\.(?:webp|png|jpg|svg|mp4|webm|mov))(?:\?v=\w+)?', sub, h)
p.write_text(h, encoding="utf-8"); print("versioned", n, "asset references")
