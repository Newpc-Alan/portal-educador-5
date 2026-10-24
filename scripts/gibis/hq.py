# Turma do Pantanal · montagem das páginas a partir das ilustrações (sem texto) geradas por IA.
# Balões, títulos e legendas são desenhados aqui, em SVG, para o português sair correto e editável.
import base64, io, os
from PIL import Image
from arte import balao, recordatorio, etiqueta, esc, COR, TRACO
W, H, M, G = 1240, 1754, 44, 22
LW = W - 2 * M; UTIL = H - 2 * M - 20; SQ = (LW - G) // 2
IMG = os.environ.get("GIBI_IMG", os.path.join(os.path.dirname(os.path.abspath(__file__)), "quadros-agua"))
T = 27
_c = {}
def _img(nome):
    if nome not in _c:
        arq = next(os.path.join(IMG, nome + e) for e in (".png", ".webp", ".jpg") if os.path.exists(os.path.join(IMG, nome + e)))
        im = Image.open(arq).convert("RGB"); b = io.BytesIO(); im.save(b, "JPEG", quality=92)
        _c[nome] = (im.size, "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode())
    return _c[nome]

class Q:
    """Quadro com imagem em 'slice'; p(fx, fy) converte posição relativa na ilustração para coordenada do quadro."""
    def __init__(self, x, y, w, h, nome, ay=0.5):
        (iw, ih), self.src = _img(nome); self.x, self.y, self.w, self.h, self.ay = x, y, w, h, ay
        self.s = max(w / iw, h / ih); self.dx = (w - iw * self.s) / 2; self.dy = (h - ih * self.s) * ay
        self.iw, self.ih = iw, ih; self.c = ""
    def p(self, fx, fy): return self.dx + fx * self.iw * self.s, self.dy + fy * self.ih * self.s
    def fala(self, x, y, txt, larg, alvo, tam=T, tipo="fala", folga=46):
        """alvo = boca de quem fala (fração da ilustração); o rabicho para 'folga' px antes, para não cobrir o rosto."""
        tx, ty = self.p(*alvo); bx, by = x + larg / 2, y + 60
        d = ((tx - bx) ** 2 + (ty - by) ** 2) ** 0.5 or 1
        tx, ty = tx - (tx - bx) / d * folga, ty - (ty - by) / d * folga
        self.c += balao(x, y, txt, larg, tx, ty, tam, tipo); return self
    def add(self, svg): self.c += svg; return self
    def svg(self):
        foco = {0: "xMidYMin", 0.5: "xMidYMid", 1: "xMidYMax"}[self.ay]
        return (f'<svg x="{self.x}" y="{self.y}" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" overflow="hidden">'
                f'<image href="{self.src}" width="{self.w}" height="{self.h}" preserveAspectRatio="{foco} slice"/>{self.c}</svg>'
                f'<rect x="{self.x}" y="{self.y}" width="{self.w}" height="{self.h}" fill="none" stroke="{TRACO}" stroke-width="6"/>')

def pagina(n, *quadros, extra=""):
    rod = f'<text x="{W/2}" y="{H-14}" text-anchor="middle" font-family="ComicNeue" font-weight="700" font-size="20" fill="#7d8a96">{n}</text>' if n else ""
    corpo = "".join(q.svg() for q in quadros)
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#fffdf6"/>{corpo}{extra}{rod}</svg>'

def grade(alturas):
    """Linhas da página: cada item é 'L' (quadro largo) ou 'S' (dois quadrados); devolve (y, h) de cada linha."""
    ys, y = [], M
    for h in alturas: ys.append((y, h)); y += h + G
    return ys

def titulo(txt, x, y, tam, cor):
    return (f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Bangers" font-size="{tam}" letter-spacing="3" fill="none" stroke="{COR["escuro"]}" stroke-width="{tam*0.16:.0f}" stroke-linejoin="round">{esc(txt)}</text>'
            f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Bangers" font-size="{tam}" letter-spacing="3" fill="{cor}">{esc(txt)}</text>')

def capa():
    (iw, ih), src = _img("capa")
    s = f'<image href="{src}" width="{W}" height="{H}" preserveAspectRatio="xMidYMax slice"/>'
    s += titulo("TURMA DO PANTANAL", W / 2, 230, 140, COR["lima"]) + titulo("PRA ONDE VAI A ÁGUA?", W / 2, 350, 92, COR["amarelo"])
    s += f'<rect x="{W/2-250}" y="400" width="500" height="54" rx="27" fill="{COR["escuro"]}" opacity=".85"/>'
    s += f'<text x="{W/2}" y="437" text-anchor="middle" font-family="ComicNeue" font-weight="700" font-size="28" fill="#fff">Ciências · 5º ano · EF05CI02</text>'
    s += f'<rect x="0" y="{H-80}" width="{W}" height="80" fill="{COR["escuro"]}"/>'
    s += f'<text x="{M}" y="{H-30}" font-family="ComicNeue" font-weight="700" font-size="30" fill="#fff">Gibiteca · Portal do Educador</text>'
    s += f'<text x="{W-M}" y="{H-30}" text-anchor="end" font-family="ComicNeue" font-weight="700" font-size="28" fill="{COR["lima"]}">NEWPC</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">{s}</svg>'

def tres(h1, h3):
    """largo + dois quadrados + largo"""
    h2 = SQ; resto = UTIL - h1 - h2 - 2 * G
    return h1, h2, resto if h3 is None else h3

def p1():
    h1, h2, h3 = tres(500, None); y1 = M; y2 = y1 + h1 + G; y3 = y2 + h2 + G
    a = Q(M, y1, LW, h1, "q01", 0).add(recordatorio(20, 20, "Escola Municipal do Pantanal, Mato Grosso do Sul.", 640)) \
        .fala(300, 110, "Turma, amanhã vamos visitar o rio aqui perto da escola!", 400, (0.665, 0.13))
    b = Q(M, y2, SQ, h2, "q02").fala(300, 24, "Oba! Vou levar meu caderno de ciências!", 250, (0.5, 0.55))
    c = Q(M + SQ + G, y2, SQ, h2, "q03").fala(14, 410, "E eu, o protetor solar. Tá calor demais!", 280, (0.48, 0.56))
    d = Q(M, y3, LW, h3, "q04", 0).add(recordatorio(20, 20, "No dia seguinte, na beira do rio...", 520)) \
        .fala(560, 40, "Ué! Cadê a água do rio? No começo do ano estava tudo alagado!", 440, (0.405, 0.41))
    return pagina(1, a, b, c, d)

def p2():
    h1, h2, h3 = tres(540, None); y1 = M; y2 = y1 + h1 + G; y3 = y2 + h2 + G
    a = Q(M, y1, LW, h1, "q05", 0).fala(60, 30, "Uma capivara que fala?!", 280, (0.165, 0.36)) \
        .fala(470, 60, "A água não sumiu, não. Ela só foi viajar!", 330, (0.69, 0.56), folga=60)
    b = Q(M, y2, SQ, h2, "q06").fala(14, 14, "Prazer, Bento! Moro aqui no Pantanal e conheço a água muito bem.", 220, (0.45, 0.45), 23)
    c = Q(M + SQ + G, y2, SQ, h2, "q07").fala(300, 30, "Viajar pra onde, Bento?", 240, (0.38, 0.49))
    d = Q(M, y3, LW, h3, "q08", 0).fala(430, 40, "Pra cima! Olha o sol esquentando o rio...", 380, (0.25, 0.52), folga=70)
    return pagina(2, a, b, c, d)

def p3():
    h1, h2, h3 = tres(500, None); y1 = M; y2 = y1 + h1 + G; y3 = y2 + h2 + G
    a = Q(M, y1, LW, h1, "q09").add(etiqueta(LW / 2, 70, "EVAPORAÇÃO", COR["amarelo"], 58)) \
        .add(recordatorio(LW - 470, h1 - 130, "Com o calor do sol, a água líquida vira vapor, um gás invisível, e sobe para o céu.", 450, 25, "#ffffff"))
    b = Q(M, y2, SQ, h2, "q10").fala(250, 24, "Isso mesmo! Do estado líquido para o gasoso.", 290, (0.27, 0.34))
    c = Q(M + SQ + G, y2, SQ, h2, "q11").fala(270, 24, "E as plantas também soltam água?", 270, (0.3, 0.37))
    d = Q(M, y3, LW, h3, "q12").fala(40, 30, "Soltam sim! Pelas folhas. Isso se chama transpiração.", 380, (0.11, 0.58)) \
        .add(etiqueta(LW / 2 + 40, h3 - 50, "TRANSPIRAÇÃO", COR["lima"], 50))
    return pagina(3, a, b, c, d)

def p4():
    h1 = 520; h2 = UTIL - h1 - SQ - 2 * G; y1 = M; y2 = y1 + h1 + G; y3 = y2 + h2 + G
    a = Q(M, y1, LW, h1, "q13").add(recordatorio(20, 20, "Lá no alto, o ar é bem mais frio.", 480)) \
        .add(etiqueta(LW / 2, 120, "CONDENSAÇÃO", COR["ciano"], 58)) \
        .add(recordatorio(LW - 460, h1 - 120, "O vapor esfria e vira gotinhas de água: elas formam as nuvens.", 440, 25, "#ffffff"))
    b = Q(M, y2, LW, h2, "q14", 0).fala(640, 30, "Então as nuvens são feitas de gotinhas de água?", 440, (0.535, 0.61)) \
        .fala(320, 200, "De gotinhas e de cristais de gelo. Bilhões deles!", 330, (0.2, 0.38))
    c = Q(M, y3, SQ, SQ, "q15").fala(14, 14, "Igual ao copo gelado que fica molhado por fora!", 270, (0.66, 0.32))
    d = Q(M + SQ + G, y3, SQ, SQ, "q16").fala(14, 14, "Exatamente! É o vapor do ar virando gotinha no copo frio.", 210, (0.45, 0.4), 22)
    return pagina(4, a, b, c, d)

def p5():
    h1 = 520; h2 = 520; h3 = UTIL - h1 - h2 - 2 * G; y1 = M; y2 = y1 + h1 + G; y3 = y2 + h2 + G
    a = Q(M, y1, LW, h1, "q17").add(etiqueta(LW / 2, 90, "PRECIPITAÇÃO", COR["amarelo"], 58)) \
        .add(recordatorio(20, h1 - 110, "Quando as gotinhas se juntam e ficam pesadas, elas caem: é a chuva!", 700, 25, "#ffffff"))
    b = Q(M, y2, LW, h2, "q18").add(etiqueta(200, 70, "INFILTRAÇÃO", COR["lima"], 46)) \
        .add(recordatorio(420, 20, "Parte da água entra no solo e abastece os aquíferos, como o Aquífero Guarani, que passa por baixo de Mato Grosso do Sul.", 700, 25, "#ffffff"))
    c = Q(M, y3, LW, h3, "q19").add(recordatorio(LW - 540, 20, "Meses depois, na época das chuvas...", 520)) \
        .fala(330, 40, "O rio encheu de novo!", 280, (0.165, 0.38)) \
        .fala(560, 200, "E o ciclo recomeça. A água vive dando a volta!", 340, (0.42, 0.66))
    return pagina(5, a, b, c)

def p6():
    hs = (UTIL - G - 2 * G) // 2 - 0; h1 = UTIL - 2 * SQ - 2 * G; y1 = M; y2 = y1 + h1 + G; y3 = y2 + SQ + G
    a = Q(M, y1, LW, h1, "q20", 0).fala(40, 24, "Professora, por que o ciclo da água é tão importante?", 420, (0.42, 0.43))
    leg = lambda q, t: q.add(recordatorio(14, SQ - 104, t, SQ - 28, 25, "#ffffff"))
    b = leg(Q(M, y2, SQ, SQ, "q21"), "Rega as plantações e a mata.")
    c = leg(Q(M + SQ + G, y2, SQ, SQ, "q22"), "Enche as represas e chega na torneira de casa.")
    d = leg(Q(M, y3, SQ, SQ, "q23"), "Move as turbinas das hidrelétricas e gera energia.")
    e = leg(Q(M + SQ + G, y3, SQ, SQ, "q24"), "Faz a cheia e a seca do Pantanal, que os animais precisam.")
    return pagina(6, a, b, c, d, e)

def p7():
    h1, h2, h3 = tres(500, None); y1 = M; y2 = y1 + h1 + G; y3 = y2 + h2 + G
    a = Q(M, y1, LW, h1, "q25", 0).fala(700, 30, "Vamos montar um ciclo da água no saquinho, colado na janela!", 420, (0.42, 0.25))
    b = Q(M, y2, SQ, SQ, "q26").add(recordatorio(14, 14, "Dois dias depois...", 300))
    c = Q(M + SQ + G, y2, SQ, SQ, "q27").fala(10, 10, "Tem gotinhas lá em cima, igual nuvem!", 270, (0.47, 0.58), 25) \
        .fala(320, 14, "E escorrendo, igual chuva!", 230, (0.82, 0.62), 25)
    d = Q(M, y3, LW, h3, "q28").fala(560, 30, "Viu só? O ciclo da água cabe até num saquinho!", 420, (0.6, 0.6), folga=120) \
        .add(titulo("FIM!", 150, h3 - 40, 120, COR["lima"]))
    return pagina(7, a, b, c, d)

def p8():
    import agua
    _, src = _img("q26")
    agua.saquinho = lambda x, y, s=1.0, gotas=False: (f'<clipPath id="cq"><rect x="{x-115}" y="{y-120}" width="230" height="230" rx="18"/></clipPath>'
        f'<image href="{src}" x="{x-115}" y="{y-120}" width="230" height="230" clip-path="url(#cq)" preserveAspectRatio="xMidYMid slice"/>'
        f'<rect x="{x-115}" y="{y-120}" width="230" height="230" rx="18" fill="none" stroke="{TRACO}" stroke-width="4"/>')
    return agua.p8()

PAGINAS = [capa, p1, p2, p3, p4, p5, p6, p7, p8]
