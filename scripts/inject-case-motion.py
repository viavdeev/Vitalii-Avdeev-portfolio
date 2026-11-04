"""Inline scripts/case-motion.js into every case page (idempotent; run after editing case-motion.js).
Also makes sure each case page has the <head> snippet that hides the first screen before first paint."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
js = (root / "scripts" / "case-motion.js").read_text(encoding="utf-8").rstrip()
HEAD = '''<script>
/* Entrance motion: hide the first screen before first paint (see the inline script at the end of the page). Skipped
   with reduced motion; removed again if that script has not started within 3 s, so the page never stays blank. */
(function(){var d=document.documentElement;if(!d.animate||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
d.classList.add('anim');setTimeout(function(){if(!window.__motion)d.classList.remove('anim')},3000)})();
</script>
'''
for name in ["wb-club", "go-invest", "strelka", "new-radio", "intervals"]:
    p = root / f"{name}.html"
    h = p.read_text(encoding="utf-8")
    if "Entrance motion: hide the first screen" not in h:
        h = re.sub(r'(<link rel="stylesheet" href="/case\.css[^"]*">\n)', lambda m: m.group(1) + HEAD, h, count=1)
    block = "<script id=\"case-motion\">\n" + js + "\n</script>\n"
    if '<script id="case-motion">' in h:
        h = re.sub(r'<script id="case-motion">.*?</script>\n', lambda m: block, h, flags=re.S)
    else:
        h = h.replace("<script src=\"/analytics.js", block + "<script src=\"/analytics.js", 1)
    assert h.count('id="case-motion"') == 1 and "Entrance motion: hide the first screen" in h, name
    p.write_text(h, encoding="utf-8")
    print(name, "ok")
