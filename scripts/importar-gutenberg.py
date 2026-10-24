#!/usr/bin/env python3
# Biblioteca do Portal 5.0: importa livros em português de DOMÍNIO PÚBLICO NO BRASIL a partir do catálogo
# oficial do Project Gutenberg (pg_catalog.csv).
#
# Regra de domínio público (Lei 9.610/98, art. 41): todos os autores (e tradutores, se houver) falecidos
# há mais de 70 anos, contados a partir de 1º de janeiro do ano seguinte à morte. Em 2026: falecidos até 1955.
# Ano de morte desconhecido -> não importa (fica para revisão humana).
#
# Marca: a licença do Project Gutenberg permite redistribuir o texto de domínio público desde que se retire
# toda a marca "Project Gutenberg". O script remove o cabeçalho e o rodapé e RECUSA o livro se a marca continuar no texto.
#
# Cada livro vira um PDF A5 com capa (PyMuPDF), vai para o Storage (biblioteca/livros/gut-ID.pdf) e para
# Firestore biblioteca/gut-ID com o registro da licença.
#
# Cloud Shell (pasta scripts):
#   pip install --user -q pymupdf beautifulsoup4 firebase-admin
#   curl -s -o /tmp/pg_catalog.csv https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv
#   python3 importar-gutenberg.py --listar            -> resumo, grava /tmp/gutenberg-lista.csv
#   python3 importar-gutenberg.py --teste 3           -> gera 3 PDFs em /tmp/gut/ (não publica)
#   python3 importar-gutenberg.py --gravar [--max N] [--parte 1/3]  -> publica (pode rodar de novo: pula o que já existe)
import csv, re, sys, os, time, json, uuid, datetime, unicodedata, urllib.request, urllib.parse
from collections import Counter

ANO_LIMITE = datetime.date.today().year - 71
CATALOGO = "/tmp/pg_catalog.csv"
UA = {"User-Agent": "PortalDoEducador-Biblioteca/1.0 (suporte@portaldoeducador.com.br)"}
BASE = "https://www.gutenberg.org/cache/epub/{id}/"
ARGS = sys.argv[1:]

def arg(nome, padrao=None):
    return ARGS[ARGS.index(nome) + 1] if nome in ARGS and ARGS.index(nome) + 1 < len(ARGS) else padrao

def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()).strip()

def pessoas(campo):
    """'Assis, Machado de, 1839-1908; Silva, Fulano, 1900-1980 [Translator]' -> [{nome, morte, papel}]"""
    out = []
    for parte in [p.strip() for p in (campo or "").split(";") if p.strip()]:
        papel = (re.search(r"\[([^\]]+)\]\s*$", parte) or [None, "Author"])[1]
        parte = re.sub(r"\s*\[[^\]]+\]\s*$", "", parte)
        anos = re.search(r",\s*(?:(\d{1,4})\??\s*(?:BCE)?)?\s*-\s*(\d{1,4})?\??\s*(BCE)?\s*$", parte)
        morte = None
        if anos and anos.group(2):
            morte = -int(anos.group(2)) if anos.group(3) else int(anos.group(2))
        nome = re.sub(r",\s*[\d?]*\s*(BCE)?\s*-\s*[\d?]*\s*(BCE)?\s*$", "", parte).strip()
        nome = re.sub(r",\s*(active|fl\.)?.*\d.*$", "", nome).strip()
        # "Assis, Machado de" -> "Machado de Assis"
        if "," in nome:
            sob, pre = nome.split(",", 1)
            if "(" not in pre: nome = (pre.strip() + " " + sob.strip()).strip()
        out.append({"nome": nome, "morte": morte, "papel": papel})
    return out

def classificar(l):
    ps = pessoas(l["Authors"])
    if not ps: return "revisar", "sem autor identificado"
    sem = [p["nome"] for p in ps if p["morte"] is None]
    if sem: return "revisar", "ano de morte desconhecido: " + ", ".join(sem[:2])
    ultima = max(p["morte"] for p in ps)
    if ultima > ANO_LIMITE: return "protegido", f"falecido em {ultima}"
    return "livre", f"autor(es) falecido(s) até {ultima}"

def ler_catalogo():
    livros = []
    with open(CATALOGO, newline="", encoding="utf-8") as f:
        for l in csv.DictReader(f):
            if l["Type"] != "Text" or "pt" not in [x.strip() for x in l["Language"].split(";")]: continue
            st, motivo = classificar(l)
            ps = pessoas(l["Authors"])
            livros.append({"id": l["Text#"], "titulo": re.sub(r"\s+", " ", l["Title"]).strip(), "situacao": st, "motivo": motivo,
                           "autores": [p["nome"] for p in ps if p["papel"] == "Author"] or [p["nome"] for p in ps][:1],
                           "pessoas": ps, "assuntos": l["Subjects"], "estantes": l["Bookshelves"]})
    return livros

def baixar(url, tentativas=3):
    for t in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r: return r.read()
        except Exception as e:
            if t == tentativas - 1: raise
            time.sleep(5 * (t + 1))

# ---------------- montagem do PDF ----------------
CSS = """
body { font-family: serif; font-size: 11pt; line-height: 1.45; color: #1d2733; }
h1, h2, h3, h4 { font-family: sans-serif; color: #0c2338; line-height: 1.2; }
h1 { font-size: 17pt; margin: 18pt 0 10pt; } h2 { font-size: 14pt; margin: 16pt 0 8pt; } h3 { font-size: 12pt; margin: 12pt 0 6pt; }
p { margin: 0 0 6pt; text-align: justify; } blockquote { margin: 6pt 18pt; font-style: italic; }
img { max-width: 100%; } .poem, .stanza { margin: 6pt 0 6pt 12pt; } pre { font-family: serif; white-space: pre-wrap; }
table { font-size: 9.5pt; } a { color: #1d2733; text-decoration: none; }
"""

def limpar_html(bruto, id_):
    from bs4 import BeautifulSoup
    s = BeautifulSoup(bruto, "html.parser")
    for el in s.select("#pg-header, #pg-footer, #pg-machine-header, #pg-start-separator, #pg-end-separator, .pg-boilerplate, script, style, link, meta"):
        el.decompose()
    corpo = s.body or s
    # livros antigos: linhas soltas como "This Project Gutenberg Etext prepared by..." ou "End of Project Gutenberg's..."
    for el in list(corpo.find_all(["p", "div", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "span", "td"])):
        if el.decomposed: continue
        t = el.get_text(" ", strip=True)
        if re.search(r"gutenberg", t, re.I) and len(t) < 400: el.decompose()
    for a in corpo.find_all("a"):
        a.unwrap()
    texto = corpo.get_text(" ", strip=True)
    if re.search(r"project\s+gutenberg|gutenberg\s+ebook|gutenberg-tm", texto, re.I):
        raise ValueError("marca Project Gutenberg continua no texto")
    if len(texto) < 1500:
        raise ValueError("texto muito curto")
    imgs = [i.get("src") for i in corpo.find_all("img") if i.get("src") and not i.get("src").startswith("data:")]
    return str(corpo), imgs

def capa_pdf(fitz, titulo, autor, ano):
    doc = fitz.open(); W, H = fitz.paper_size("a5"); pg = doc.new_page(width=W, height=H)
    pg.draw_rect(pg.rect, color=None, fill=(0.027, 0.086, 0.129))
    pg.draw_rect(fitz.Rect(0, H - 10, W, H), color=None, fill=(0.553, 0.776, 0.247))
    pg.draw_rect(fitz.Rect(36, 150, 96, 154), color=None, fill=(0.553, 0.776, 0.247))
    pg.insert_textbox(fitz.Rect(36, 70, W - 36, 140), "BIBLIOTECA · PORTAL DO EDUCADOR", fontsize=8.5, fontname="helv", color=(0.18, 0.61, 0.84))
    pg.insert_textbox(fitz.Rect(36, 170, W - 36, 420), titulo, fontsize=24 if len(titulo) < 60 else 18, fontname="tibo", color=(1, 1, 1), lineheight=1.15)
    pg.insert_textbox(fitz.Rect(36, 430, W - 36, 500), autor, fontsize=13, fontname="helv", color=(0.82, 0.88, 0.93))
    pg.insert_textbox(fitz.Rect(36, H - 70, W - 36, H - 24), "Obra em domínio público" + (f" · autor falecido em {ano}" if ano and ano > 0 else ""), fontsize=8, fontname="helv", color=(0.6, 0.68, 0.76))
    return doc

def simplificar(html):
    """2ª tentativa: tira imagens, desfaz tabelas e blocos pré-formatados, que às vezes travam a diagramação."""
    from bs4 import BeautifulSoup
    s = BeautifulSoup(html, "html.parser")
    for el in s.find_all(["img", "svg", "figure"]): el.decompose()
    for t in s.find_all("table"):
        p = s.new_tag("div")
        for tr in t.find_all("tr"):
            linha = s.new_tag("p"); linha.string = " ".join(td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])); p.append(linha)
        t.replace_with(p)
    for pre in s.find_all("pre"):
        d = s.new_tag("div")
        for linha in pre.get_text().split("\n"):
            q = s.new_tag("p"); q.string = linha; d.append(q)
        pre.replace_with(d)
    for el in s.find_all(style=True): del el["style"]
    return str(s)

def montar_pdf(livro, destino, pasta, simples=False):
    import fitz
    base = BASE.format(id=livro["id"])
    bruto = baixar(base + f"pg{livro['id']}-images.html").decode("utf-8", "replace")
    html, imgs = limpar_html(bruto, livro["id"])
    if simples: html, imgs = simplificar(html), []
    # tradução sem tradutor identificado: a tradução tem direito próprio, então fica para revisão humana
    inicio = re.sub(r"<[^>]+>", " ", html)[:4000]
    if re.search(r"tradu[cçz]|traduzid|traduct|vertid[oa]s? (em|para|do)|vers[aã]o (portugu|livre|do)", inicio, re.I) and not any(p["papel"] == "Translator" for p in livro["pessoas"]):
        raise ValueError("tradução sem tradutor identificado (revisar)")
    os.makedirs(pasta, exist_ok=True)
    for src in imgs[:80]:  # ilustrações do livro (até 80)
        caminho = os.path.normpath(os.path.join(pasta, urllib.parse.unquote(src)))
        if not caminho.startswith(pasta): continue
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        try: open(caminho, "wb").write(baixar(urllib.parse.urljoin(base, src)))
        except Exception: pass
    autor = ", ".join(livro["autores"]) or "Autor desconhecido"
    ano = max([p["morte"] for p in livro["pessoas"] if p["morte"] is not None] or [0]) or None
    doc = capa_pdf(fitz, livro["titulo"], autor, ano)
    # miolo com o motor de layout do PyMuPDF (Story), página A5 com margens
    corpo_tmp = os.path.join(pasta, "miolo.pdf")
    story = fitz.Story(html=html, user_css=CSS, archive=fitz.Archive(pasta))
    W, H = fitz.paper_size("a5"); area = fitz.Rect(42, 46, W - 42, H - 50)
    wr = fitz.DocumentWriter(corpo_tmp); mais = 1; n = 0
    while mais and n < 1200:
        dev = wr.begin_page(fitz.Rect(0, 0, W, H)); mais, _ = story.place(area); story.draw(dev); wr.end_page(); n += 1
    wr.close()
    if mais: raise ValueError("diagramação não terminou em 1200 páginas (revisar)")
    miolo = fitz.open(corpo_tmp); doc.insert_pdf(miolo)
    total = len(doc)
    for i in range(1, total):  # rodapé com título e número da página
        pg = doc[i]
        pg.insert_textbox(fitz.Rect(42, H - 34, W - 42, H - 20), f"{livro['titulo'][:60]}  ·  {i}", fontsize=7, fontname="helv", color=(0.55, 0.6, 0.66), align=1)
    doc.set_metadata({"title": livro["titulo"], "author": autor, "subject": "Domínio público · Biblioteca do Portal do Educador"})
    doc.save(destino, garbage=3, deflate=True)
    capa_png = destino.replace(".pdf", "-capa.png")
    doc[0].get_pixmap(matrix=fitz.Matrix(1.4, 1.4)).save(capa_png)
    return total, capa_png

# ---------------- execução ----------------
livros = ler_catalogo()
cont = Counter(l["situacao"] for l in livros)
print("PORTUGUÊS:", len(livros), dict(cont), "| limite: autores falecidos até", ANO_LIMITE)
if "--listar" in ARGS:
    with open("/tmp/gutenberg-lista.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";"); w.writerow(["ID", "Título", "Autores", "Situação", "Motivo"])
        for l in sorted(livros, key=lambda x: (x["situacao"], x["titulo"])): w.writerow([l["id"], l["titulo"], ", ".join(l["autores"]), l["situacao"], l["motivo"]])
    print("AUTORES (livres):", Counter(a for l in livros if l["situacao"] == "livre" for a in l["autores"]).most_common(30))
    print("PROTEGIDOS (ex.):", [l["titulo"][:30] + " / " + l["motivo"] for l in livros if l["situacao"] == "protegido"][:8])
    sys.exit(0)

livres = [l for l in livros if l["situacao"] == "livre"]
if "--teste" in ARGS:
    for l in livres[: int(arg("--teste", "3"))]:
        t0 = time.time()
        try:
            n, capa = montar_pdf(l, f"/tmp/gut/gut-{l['id']}.pdf", f"/tmp/gut/{l['id']}")
            print("OK", l["id"], l["titulo"][:40], n, "páginas", round(os.path.getsize(f"/tmp/gut/gut-{l['id']}.pdf") / 1e6, 2), "MB", round(time.time() - t0), "s")
        except Exception as e:
            print("ERRO", l["id"], l["titulo"][:40], str(e)[:120])
    sys.exit(0)

if "--gravar" in ARGS:
    import signal
    def _tempo(*_): raise TimeoutError("passou de 4 minutos (revisar)")
    signal.signal(signal.SIGALRM, _tempo)
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
    app = firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": "portal-educador-5", "storageBucket": "portal-educador-5.firebasestorage.app"})
    db, bucket = firestore.client(), storage.bucket()
    # livro publicado com diagramação quebrada (versão antiga do script, 1.200+ páginas) é refeito
    quebrado = lambda d: (d.get("num_paginas") or 0) >= 1200
    existentes = {norm(d.to_dict().get("titulo", "")) for d in db.collection("biblioteca").stream() if not quebrado(d.to_dict())}
    so = arg("--ids")  # opcional: só estes IDs (separados por vírgula)
    alvo = [l for l in livres if not so or l["id"] in so.split(",")][: int(arg("--max", "100000"))]
    if arg("--parte"):  # --parte 2/3 -> só um terço da lista (para rodar 3 em paralelo)
        k, n = [int(x) for x in arg("--parte").split("/")]; alvo = alvo[k - 1::n]
    ok = pulados = erros = 0
    for i, l in enumerate(alvo):
        ref = db.document(f"biblioteca/gut-{l['id']}")
        atual = ref.get()
        if (atual.exists and not quebrado(atual.to_dict())) or norm(l["titulo"]) in existentes: pulados += 1; continue
        try:
            pdf = f"/tmp/gut/gut-{l['id']}.pdf"
            signal.alarm(240)  # livro que demora mais de 4 minutos fica para revisão
            try:
                try: n, capa = montar_pdf(l, pdf, f"/tmp/gut/{l['id']}")
                except ValueError as e1:
                    if "diagramação" not in str(e1): raise
                    signal.alarm(240); n, capa = montar_pdf(l, pdf, f"/tmp/gut/{l['id']}", simples=True)
            finally: signal.alarm(0)
            urls = {}
            for local, remoto, tipo in [(pdf, f"biblioteca/livros/gut-{l['id']}.pdf", "application/pdf"), (capa, f"biblioteca/livros/gut-{l['id']}-capa.png", "image/png")]:
                tok = str(uuid.uuid4()); b = bucket.blob(remoto)
                b.metadata = {"firebaseStorageDownloadTokens": tok}; b.cache_control = "public, max-age=31536000"
                b.upload_from_filename(local, content_type=tipo)
                urls[tipo] = f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{urllib.parse.quote(remoto, safe='')}?alt=media&token={tok}"
            mortes = [p["morte"] for p in l["pessoas"] if p["morte"] is not None]
            ref.set({
                "titulo": l["titulo"][:160], "autor": ", ".join(l["autores"])[:120], "etapa": "", "secao": "livros", "tipo": "pdf",
                "url": urls["application/pdf"], "capa_url": urls["image/png"], "paginas": [], "tamanho": os.path.getsize(pdf), "num_paginas": n,
                "publicado": True, "origem": "gutenberg", "origem_id": l["id"],
                "licenca": {"tipo": "dominio-publico", "obs": f"Domínio público no Brasil: autor(es) falecido(s) até {max(mortes) if max(mortes) > 0 else 'a Antiguidade'} (Lei 9.610/98, art. 41). Texto digitalizado por voluntários (catálogo Gutenberg nº {l['id']}), sem a marca.",
                            "aprovado_por": "importacao-gutenberg", "aprovado_nome": "Importação em lote autorizada por Alan (23/10/2026)", "aprovado_em": firestore.SERVER_TIMESTAMP},
                "criado_em": firestore.SERVER_TIMESTAMP
            })
            existentes.add(norm(l["titulo"])); ok += 1
            print(f"[{i + 1}/{len(alvo)}] OK {l['id']} {l['titulo'][:50]} ({n} p.)", flush=True)
        except Exception as e:
            erros += 1; print(f"[{i + 1}/{len(alvo)}] ERRO {l['id']} {l['titulo'][:40]}: {str(e)[:140]}", flush=True)
        time.sleep(2)  # ritmo educado com o servidor do Gutenberg
    print(f"PRONTO: {ok} publicados, {pulados} já existiam, {erros} com erro.")
