#!/usr/bin/env python3
"""Typographic non-breaking spaces for index.html (idempotent).
Run after editing any visible copy:  python3 scripts/nbsp.py [page.html]  (default index.html)
Rules (body text only):
  1. articles (a, an, the) and one-character words (letters and digits) always stick to the next word
  2. function words (every word up to 3 characters: of, to, in, on, at, by, as, or, and, for, is, it, AI ... plus with, from, into,
     onto, upon, over, than, that, this, then, when) stick to the next word - through an article if there is one ("with the core") -
     while the unbreakable chunk stays within MAX_CHAIN characters
  3. names / fixed phrases never split: Vitalii Avdeev, Mexico City (GMT-6), Download CV, Core team, Web app ...
  4. "&" sticks to both neighbours
  5. the last two words of every text run stick together (no one-word last line), but never as a 3-word chain
"""
import re, sys, pathlib
NB = "&nbsp;"
root = pathlib.Path(__file__).resolve().parent.parent
path = root / (sys.argv[1] if len(sys.argv) > 1 else "index.html")
html = path.read_text(encoding="utf-8")
_m = re.search(r"<body[^>]*>", html)
head, sep, body = html[:_m.start()], _m.group(0), html[_m.end():]

ARTICLE = r"(?:a|an|the)"            # articles ALWAYS stick to the following word (even inside a chain)
# "Function words" that must never end a line: every word of up to 3 characters (of, to, in, on, at, by, as, or, and, for, is,
# it, its, we, my, but, not, are, can, AI, UI, numbers like 18 ...) plus the common longer prepositions / conjunctions.
LONG_FUNC = {"with", "from", "into", "onto", "upon", "over", "than", "that", "this", "then", "when", "whom"}
MAX_CHAIN = 26                        # body text: a function word may pull in the words after it only while the unbreakable chunk
                                      # stays this short (characters): long chunks tear wide gaps into the line above.
MAX_CHAIN_LARGE = 16                  # headings, hero text and menus (big type): shorter chunks, or they overflow narrow screens
LARGE_TAGS = {"h1", "h2", "h3", "h4"}
LARGE_CLASSES = ("phead__title", "lead", "h1", "h2", "intro__text", "intro__links", "footer__links")
VOID = {"br", "img", "link", "meta", "source", "input", "hr", "wbr", "track"}
PHRASES = [
    "Vitalii Avdeev", "Mexico City (GMT-6)", "Download CV", "Core team", "Web app",
    "500K monthly", "2M daily", "Media Art", "Cross-platform,", "2026 Vitalii Avdeev",
]

def is_func(w):
    return (1 <= len(w) <= 3 and w.isalnum()) or w.lower() in LONG_FUNC

def fix(text, limit=MAX_CHAIN):
    t = text.replace(NB, " ")            # idempotent: start from plain spaces
    for p in PHRASES:
        t = t.replace(p, p.replace(" ", NB))
    tok = t.split(" ")
    n = len(tok)
    word = [re.sub(r"\W", "", x) for x in tok]
    join = [False] * n                    # join[i]: bind token i to token i+1
    # 1) forced bindings: "&" with both neighbours, one-character words (letters and digits: "3 analysts"), articles (a / an / the)
    for i in range(n - 1):
        if "&amp;" in (tok[i], tok[i + 1]) or (len(word[i]) == 1 and word[i].isalnum()) or re.fullmatch(ARTICLE, word[i], flags=re.I):
            join[i] = True
    # 2) function words stick to what follows (through an article if there is one), as long as the chunk stays short
    def chunk_start(i):
        while i > 0 and join[i - 1]:
            i -= 1
        return i
    def chunk_end(i):
        while i < n - 1 and join[i]:
            i += 1
        return i
    for i in range(n - 1):
        if join[i] or not is_func(word[i]):
            continue
        a, b = chunk_start(i), chunk_end(i + 1)
        if len(" ".join(tok[a:b + 1]).replace(NB, " ")) <= limit:
            join[i] = True
    # 3) never leave a single word alone on the last line - unless that would weld three words into one unbreakable chunk
    #    (text-wrap: pretty covers that case)
    if n > 2 and not join[n - 3]:
        join[n - 2] = True
    out = tok[0]
    for i in range(1, n):
        out += (NB if join[i - 1] else " ") + tok[i]
    return out

def is_large(stack):
    for tag, cls in stack:
        if tag in LARGE_TAGS or any(c in cls.split() for c in LARGE_CLASSES):
            return True
    return False

def process(body):
    out, stack, skip, last = [], [], 0, 0
    for m in re.finditer(r"<!--.*?-->|<![^>]*>|<(/?)([A-Za-z][A-Za-z0-9]*)([^<>]*)>|([^<>]+)", body, flags=re.S):
        out.append(body[last:m.start()]); last = m.end()      # anything not matched (stray < or >) is kept as it is
        if m.group(2) is None and m.group(4) is None:         # comment / doctype: untouched
            out.append(m.group(0)); continue
        if m.group(4) is not None:                           # text between tags
            txt = m.group(4)
            if skip or not txt.strip():
                out.append(txt); continue
            lead = re.match(r"\s*", txt).group(0); trail = re.search(r"\s*$", txt).group(0)
            out.append(lead + fix(txt.strip(), MAX_CHAIN_LARGE if is_large(stack) else MAX_CHAIN) + trail)
            continue
        closing, tag, attrs = m.group(1), m.group(2).lower(), m.group(3)
        out.append(m.group(0))
        if tag in ("script", "style"):
            skip += -1 if closing else 1
        elif tag in VOID or attrs.rstrip().endswith("/"):
            pass
        elif closing:
            for k in range(len(stack) - 1, -1, -1):
                if stack[k][0] == tag:
                    del stack[k:]; break
        else:
            cm = re.search(r'class="([^"]*)"', attrs)
            stack.append((tag, cm.group(1) if cm else ""))
    out.append(body[last:])
    return "".join(out)

body = process(body)
path.write_text(head + sep + body, encoding="utf-8")
print("ok:", body.count(NB), "non-breaking spaces")
