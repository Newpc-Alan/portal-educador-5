import asyncio, sys, os
from playwright.async_api import async_playwright
import base64
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), "node_modules/@fontsource/")
def b64(p): return "data:font/woff2;base64," + base64.b64encode(open(F + p, "rb").read()).decode()
FONTES = ("@font-face{font-family:ComicNeue;font-weight:400;src:url(%s)}" % b64("comic-neue/files/comic-neue-latin-400-normal.woff2") +
  "@font-face{font-family:ComicNeue;font-weight:700;src:url(%s)}" % b64("comic-neue/files/comic-neue-latin-700-normal.woff2") +
  "@font-face{font-family:ComicNeue;font-weight:700;font-style:italic;src:url(%s)}" % b64("comic-neue/files/comic-neue-latin-700-normal.woff2") +
  "@font-face{font-family:Bangers;src:url(%s)}" % b64("bangers/files/bangers-latin-400-normal.woff2") +
  "@font-face{font-family:Baloo;font-weight:800;src:url(%s)}" % b64("baloo-2/files/baloo-2-latin-800-normal.woff2"))
async def _render(pares, w, h):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": w, "height": h})
        for svg, saida in pares:
            await pg.set_content(f"<html><head><style>{FONTES} body{{margin:0}}</style></head><body>{svg}</body></html>")
            await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=saida, clip={"x":0,"y":0,"width":w,"height":h})
        await b.close()
def render(pares, w=1240, h=1754): asyncio.run(_render(pares, w, h))
