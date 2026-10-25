#!/usr/bin/env python3
"""Cache-busting: appends ?v=<content hash> to every /assets/video/*.mp4|webm src / data-webm / data-sa in index.html.
Run after (re)encoding any video:  python3 scripts/version-assets.py   (assets are cached for 7 days)"""
import re, hashlib, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
p = root / "index.html"; h = p.read_text(encoding="utf-8")
def sub(m):
    f = root / m.group(2).lstrip("/")
    return f'{m.group(1)}="{m.group(2)}?v={hashlib.md5(f.read_bytes()).hexdigest()[:8]}"'
h, n = re.subn(r'(src|data-webm|data-sa)="(/assets/video/[^"?]+\.(?:mp4|webm))(?:\?v=\w+)?"', sub, h)
p.write_text(h, encoding="utf-8"); print("versioned", n, "videos")
