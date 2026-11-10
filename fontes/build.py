# Monta o Manual do Portal do Educador 5.0: Markdown -> HTML -> PDF (Chromium), com capa, sumário paginado e rodapé
import re, sys, json, markdown, pymupdf
from pathlib import Path
from playwright.sync_api import sync_playwright

D = Path('/tmp/claude-0/manual2')
REPO = Path('/home/claude/portal-educador-5')
SHOTS = Path('/tmp/claude-0/t5')
import os
PARTES = os.environ.get('PARTES', 'parte0.md parte1.md parte2.md parte3.md').split()

def img_src(nome):
    # capturas viram JPEG leve (o PDF fica bem menor)
    if (SHOTS / nome).exists():
        from PIL import Image
        (D / 'img').mkdir(exist_ok=True)
        dst = D / 'img' / (Path(nome).stem + '.jpg')
        if not dst.exists():
            im = Image.open(SHOTS / nome).convert('RGB')
            if im.width > 1000: im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
            im.save(dst, quality=84, optimize=True)
        return dst.as_uri()
    for base in (SHOTS, REPO / 'assets' / 'cards', REPO / 'assets', D / 'img'):
        p = base / nome
        if p.exists(): return p.as_uri()
    raise SystemExit('imagem não encontrada: ' + nome)

def card(nome):
    from PIL import Image
    (D / 'img').mkdir(exist_ok=True)
    dst = D / 'img' / ('card-' + nome + '.jpg')
    if not dst.exists():
        im = Image.open(REPO / 'assets/cards' / (nome + '.webp')).convert('RGB'); im.thumbnail((420, 320), Image.LANCZOS)
        im.save(dst, quality=82, optimize=True)
    return dst.as_uri()

def md_html(txt):
    # figuras: ![legenda](arquivo.png){largura}
    def fig(m):
        leg, arq, larg = m.group(1), m.group(2), m.group(3) or '100'
        return f'<figure style="width:{larg}%"><img src="{img_src(arq)}" alt=""><figcaption>{leg}</figcaption></figure>'
    txt = re.sub(r'\{\{C:(\w+)\}\}', lambda m: card(m.group(1)), txt)
    txt = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)(?:\{(\d+)\})?', fig, txt)
    # cabeçalho de POP: @@ Código | Área | Responsável | Quando aplicar
    def cab(m):
        c = [x.strip() for x in m.group(1).split(' | ')]
        rot = ['Código', 'Área', 'Responsável', 'Quando aplicar']
        cel = ''.join(f'<td><b>{r}</b>{v}</td>' for r, v in zip(rot, c))
        return f'<table class="pophead"><tr>{cel}<td><b>Versão</b>2.0 · nov/2026</td></tr></table>'
    txt = re.sub(r'^@@ (.+)$', cab, txt, flags=re.M)
    # caixas: :::dica / :::atencao / :::regra ... :::
    def caixa(m):
        tipo, corpo = m.group(1), m.group(2)
        rot = {'dica': 'Dica', 'atencao': 'Atenção', 'regra': 'Regra', 'nota': 'Nota'}[tipo]
        return f'<div class="box {tipo}"><b class="rot">{rot}</b>' + markdown.markdown(corpo, extensions=['tables', 'fenced_code']) + '</div>'
    txt = re.sub(r':::(dica|atencao|regra|nota)\n(.*?)\n:::', caixa, txt, flags=re.S)
    return markdown.markdown(txt, extensions=['tables', 'attr_list', 'sane_lists', 'fenced_code']).replace('<li>☐', '<li class="ck">☐')

def montar(paginas=None):
    corpo, toc = [], []
    n_h = 0
    for arq in PARTES:
        txt = (D / arq).read_text()
        html = md_html(txt)
        def h(m):
            nonlocal n_h
            nivel, attrs, conteudo = m.group(1), m.group(2) or '', m.group(3)
            n_h += 1
            hid = f'h{n_h}'
            limpo = re.sub('<[^>]+>', '', conteudo)
            if nivel in ('1', '2'): toc.append((nivel, limpo, hid))
            return f'<h{nivel} id="{hid}"{attrs}>{conteudo}</h{nivel}>'
        html = re.sub(r'<h([1-3])((?: class="[^"]*")?)>(.*?)</h\1>', h, html)
        corpo.append(f'<section class="parte">{html}</section>')
    linhas = []
    for nivel, t, hid in toc:
        pg = (paginas or {}).get(hid, '')
        linhas.append(f'<div class="toc t{nivel}"><a href="#{hid}"><span>{t}</span><i></i><em>{pg}</em></a></div>')
    tpl = (D / os.environ.get('TEMPLATE', 'template.html')).read_text()
    return tpl.replace('{{TOC}}', '\n'.join(linhas)).replace('{{CORPO}}', '\n'.join(corpo)).replace('{{LOGO}}', (REPO / 'assets/pde-logo-256.png').as_uri()), toc

# MARCAS=1: logotipo NEWPC no cabeçalho e Portal do Educador no rodapé (imagens embutidas: o cabeçalho do Chromium não carrega arquivos)
import base64
def _img(nome): return 'data:image/png;base64,' + base64.b64encode((D / 'marcas' / nome).read_bytes()).decode()
def cabecalho():
    if os.environ.get('MARCAS') != '1': return '<div></div>'
    return ('<div style="width:100%;padding:0 16mm;margin-top:5mm;display:flex;justify-content:space-between;align-items:center;font-family:Inter;font-size:7px;color:#62758a">'
            '<img src="' + _img('newpc-cabecalho.png') + '" style="height:5.2mm"><span>' + os.environ.get('CAB_TXT', '') + '</span></div>')
def rodape():
    txt = os.environ.get('RODAPE', 'Manual do Portal do Educador 5.0 · NEWPC Tecnologia')
    if os.environ.get('MARCAS') != '1':
        return '<div style="width:100%;font-family:Inter;font-size:7.5px;color:#62758a;padding:0 16mm;display:flex;justify-content:space-between"><span>' + txt + '</span><span class="pageNumber"></span></div>'
    return ('<div style="width:100%;font-family:Inter;font-size:7.5px;color:#62758a;padding:0 16mm;display:flex;justify-content:space-between;align-items:center">'
            '<span style="display:flex;align-items:center;gap:2mm"><img src="' + _img('pde-rodape.png') + '" style="height:5mm;width:5mm;border-radius:50%">'
            '<b style="color:#0f2c4a;font-size:8px">Portal do Educador</b><span>&nbsp;·&nbsp;' + txt + '</span></span><span class="pageNumber"></span></div>')

def pdf(html, saida):
    (D / 'manual.html').write_text(html)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto((D / 'manual.html').as_uri()); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(500)
        pg.pdf(path=str(saida), format='A4', print_background=True, display_header_footer=True,
               header_template=cabecalho(), footer_template=rodape(), prefer_css_page_size=True)
        b.close()

def achar_paginas(arq, toc):
    # os itens do sumário são links internos: o Chromium grava a página de destino de cada um, na ordem
    doc = pymupdf.open(arq)
    alvos = []
    for i in range(min(8, len(doc))):
        for l in doc[i].get_links():
            if l.get('kind') == pymupdf.LINK_GOTO or 'page' in l and l.get('page', -1) >= 0:
                alvos.append((i, l['from'].y0, l['page'] + 1))
    alvos.sort()
    res = {hid: pg for (nivel, t, hid), (_, _, pg) in zip(toc, alvos)}
    return res, len(doc)

html, toc = montar()
pdf(html, D / 'rascunho.pdf')
pags, total = achar_paginas(D / 'rascunho.pdf', toc)
html, toc = montar(pags)
pdf(html, D / 'Manual-Portal-do-Educador-5.0.pdf')
pags2, total2 = achar_paginas(D / 'Manual-Portal-do-Educador-5.0.pdf', toc)
print('paginas', total2, 'sem pagina:', [t for n, t, h in toc if h not in pags2], 'mudou:', pags != pags2)

# capa sem rodapé: gera só a capa e troca a página 1
def capa_limpa():
    html = (D / 'manual.html').read_text()
    so = html.split('<div class="miolo">')[0] + '</body></html>'
    (D / 'capa.html').write_text(so)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto((D / 'capa.html').as_uri()); pg.wait_for_timeout(400)
        pg.pdf(path=str(D / 'capa.pdf'), format='A4', print_background=True, prefer_css_page_size=True, page_ranges='1')
        b.close()
    final = D / 'Manual-Portal-do-Educador-5.0.pdf'
    doc = pymupdf.open(final); capa = pymupdf.open(D / 'capa.pdf')
    doc.delete_page(0); doc.insert_pdf(capa, from_page=0, to_page=0, start_at=0)
    doc.set_metadata({'title': os.environ.get('TITULO', 'Manual do Portal do Educador 5.0'), 'author': 'NEWPC Tecnologia', 'subject': 'Manual completo: usuários, equipe NEWPC e técnico'})
    doc.save(D / 'final.pdf', garbage=3, deflate=True)
capa_limpa()
