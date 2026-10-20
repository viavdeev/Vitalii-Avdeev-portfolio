#!/usr/bin/env python3
"""Typographic non-breaking spaces for index.html (idempotent).
Run after editing any visible copy:  python3 scripts/nbsp.py
Rules (body text only):
  1. articles (a, an, the) always stick to the next word; other short words (of, to, in, on, at, by, as, or, and, for, is, AI) stick to the next word (pairs, never chains)
  2. names / fixed phrases never split: Vitalii Avdeev, Mexico City (GMT-6), Download CV, Core team, Web app ...
  3. "&" sticks to both neighbours
  4. the last two words of every text run stick together (no one-word last line)
"""
import re, sys, pathlib
NB = "&nbsp;"
path = pathlib.Path(__file__).resolve().parent.parent / "index.html"
html = path.read_text(encoding="utf-8")
head, sep, body = html.partition("<body>")

ARTICLE = r"(?:a|an|the)"            # articles ALWAYS stick to the following word (even inside a chain)
SHORT = r"(?:of|to|in|on|at|by|as|or|and|for|is|AI|it|its)"
PHRASES = [
    "Vitalii Avdeev", "Mexico City (GMT-6)", "Download CV", "Core team", "Web app",
    "500K monthly", "2M daily", "Media Art", "Cross-platform,", "2026 Vitalii Avdeev",
]

def fix(text):
    t = text.replace(NB, " ")            # idempotent: start from plain spaces
    for p in PHRASES:
        t = t.replace(p, p.replace(" ", NB))
    tok = t.split(" ")
    n = len(tok)
    join = [False] * n                    # join[i]: bind token i to token i+1
    tail = [False] * n                    # tail[i]: token i already bound to its predecessor
    def bind(i):
        join[i] = True; tail[i + 1] = True
    for i in range(n - 1):
        w = re.sub(r"\W", "", tok[i])
        if "&amp;" in (tok[i], tok[i + 1]):
            bind(i)                       # "&" sticks to both neighbours
        elif re.fullmatch(ARTICLE, w, flags=re.I):
            bind(i)                       # a / an / the + next word, always
        elif re.fullmatch(SHORT, w, flags=re.I) and not tail[i]:
            bind(i)                       # short word sticks to the next one (pairs only, no chains)
    if n > 2:
        join[n - 2] = True                # never leave a single word alone on the last line
    out = tok[0]
    for i in range(1, n):
        out += (NB if join[i - 1] else " ") + tok[i]
    return out

def seg(m):
    s = m.group(2)
    if not s.strip():
        return m.group(0)
    lead = re.match(r"\s*", s).group(0); trail = re.search(r"\s*$", s).group(0)
    core = s.strip()
    return m.group(1) + lead + fix(core) + trail + m.group(3)

body = re.sub(r"(>)([^<>]+)(<)", seg, body)
path.write_text(head + sep + body, encoding="utf-8")
print("ok:", body.count(NB), "non-breaking spaces")
