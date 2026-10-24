# Turma do Pantanal: personagens, cenários e balões em SVG (arte original NEWPC).
import math, html

TRACO = "#1b1b1b"
COR = dict(lima="#8DC63F", verde="#5A9420", azul="#2671AB", ciano="#2E9BD6", escuro="#0c2338", amarelo="#FFD23F",
           ceu="#9fd3f5", ceu2="#e6f5ff", agua="#3d9be0", agua2="#7cc4f2", lama="#a9824f", capim="#d8b65a", capim2="#7fb548",
           pele_lia="#8a5a3b", pele_davi="#e4b183", pele_clara="#c58c5c", capi="#9a6a3c", capi2="#7c5230")
SW = 4  # espessura do traço

def esc(t): return html.escape(t, quote=True)

# ---------------- personagens (origem nos pés, altura ~300 na escala 1) ----------------
def _olhos(ex, y=-208, dx=21, ry=11):
    if ex == "feliz":
        return "".join(f'<path d="M{x-9},{y+2} Q{x},{y-10} {x+9},{y+2}" fill="none" stroke="{TRACO}" stroke-width="5" stroke-linecap="round"/>' for x in (-dx, dx))
    if ex == "fechado":
        return "".join(f'<path d="M{x-9},{y} L{x+9},{y}" stroke="{TRACO}" stroke-width="5" stroke-linecap="round"/>' for x in (-dx, dx))
    r = ry + (3 if ex == "surpresa" else 0)
    return "".join(f'<ellipse cx="{x}" cy="{y}" rx="{8 if ex!="surpresa" else 10}" ry="{r}" fill="{TRACO}"/><circle cx="{x+3}" cy="{y-4}" r="3.5" fill="#fff"/>' for x in (-dx, dx))

def _boca(ex, y=-178):
    if ex == "surpresa": return f'<ellipse cx="0" cy="{y+2}" rx="9" ry="12" fill="#7a2b2b" stroke="{TRACO}" stroke-width="3"/>'
    if ex == "duvida": return f'<path d="M-12,{y} Q0,{y-6} 12,{y+4}" fill="none" stroke="{TRACO}" stroke-width="4" stroke-linecap="round"/>'
    if ex == "fala": return f'<path d="M-14,{y-4} Q0,{y+16} 14,{y-4} Z" fill="#7a2b2b" stroke="{TRACO}" stroke-width="3" stroke-linejoin="round"/>'
    return f'<path d="M-16,{y-4} Q0,{y+14} 16,{y-4}" fill="none" stroke="{TRACO}" stroke-width="4.5" stroke-linecap="round"/>'

def _bracos(pose, pele, manga):
    # ombros em (+-44,-140); devolve braços desenhados por trás/à frente
    def braco(x0, x1, y1, xm=None, ym=None):
        xm = (x0 + x1) / 2 if xm is None else xm; ym = (-140 + y1) / 2 if ym is None else ym
        return (f'<path d="M{x0},-138 Q{xm},{ym} {x1},{y1}" fill="none" stroke="{TRACO}" stroke-width="{24+SW*2}" stroke-linecap="round"/>'
                f'<path d="M{x0},-138 Q{xm},{ym} {x1},{y1}" fill="none" stroke="{manga}" stroke-width="24" stroke-linecap="round"/>'
                f'<circle cx="{x1}" cy="{y1}" r="14" fill="{pele}" stroke="{TRACO}" stroke-width="{SW}"/>')
    esq = braco(-44, -58, -72, -66, -110)
    if pose == "aponta":   dir_ = braco(44, 112, -222, 92, -168)
    elif pose == "feliz":  esq = braco(-44, -96, -232, -88, -180); dir_ = braco(44, 96, -232, 88, -180)
    elif pose == "pensa":  dir_ = braco(44, 22, -168, 70, -120)
    elif pose == "segura": dir_ = braco(44, 62, -112, 70, -128)
    else:                  dir_ = braco(44, 58, -72, 66, -110)
    return esq, dir_

def pessoa(x, y, s=1.0, quem="lia", pose="normal", ex="sorri", vira=False, item=""):
    pele = {"lia": COR["pele_lia"], "davi": COR["pele_davi"], "clara": COR["pele_clara"]}[quem]
    camisa = {"lia": "#ffffff", "davi": "#ffffff", "clara": COR["azul"]}[quem]
    baixo = {"lia": COR["escuro"], "davi": COR["escuro"], "clara": "#3b3b52"}[quem]
    altura_perna = 70 if quem != "clara" else 92
    g = []
    # pernas e sapatos
    for px in (-17, 17):
        g.append(f'<rect x="{px-11}" y="{-altura_perna}" width="22" height="{altura_perna}" rx="9" fill="{pele}" stroke="{TRACO}" stroke-width="{SW}"/>')
        g.append(f'<ellipse cx="{px+(4 if px>0 else -4)}" cy="-6" rx="19" ry="11" fill="{COR["escuro"] if quem!="clara" else "#5b2b2b"}" stroke="{TRACO}" stroke-width="{SW}"/>')
    esq, dir_ = _bracos(pose, pele, camisa)
    g.append(esq)
    # corpo
    topo = -150 if quem != "clara" else -168
    if quem == "clara":
        g.append(f'<path d="M-46,{topo+40} L-56,{-altura_perna+6} L56,{-altura_perna+6} L46,{topo+40} Z" fill="{baixo}" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/>')
        g.append(f'<rect x="-46" y="{topo}" width="92" height="{80}" rx="26" fill="{camisa}" stroke="{TRACO}" stroke-width="{SW}"/>')
    else:
        g.append(f'<rect x="-44" y="-86" width="88" height="{28}" rx="10" fill="{baixo}" stroke="{TRACO}" stroke-width="{SW}"/>')
        g.append(f'<rect x="-46" y="{topo}" width="92" height="{80}" rx="26" fill="{camisa}" stroke="{TRACO}" stroke-width="{SW}"/>')
        g.append(f'<path d="M-46,{topo+56} L46,{topo+56}" stroke="{COR["lima"]}" stroke-width="8"/>')  # faixa do uniforme
        g.append(f'<circle cx="24" cy="{topo+26}" r="9" fill="{COR["lima"]}" stroke="{TRACO}" stroke-width="2.5"/>')  # brasão da escola
    # cabeça
    hy = -212 if quem != "clara" else -232
    off = hy + 212
    def T(svg):  # desloca rosto para a cabeça da professora
        return f'<g transform="translate(0,{off})">{svg}</g>'
    cabelo_tras, cabelo_frente = "", ""
    if quem == "lia":
        cabelo_tras = "".join(f'<circle cx="{cx}" cy="-262" r="30" fill="#1f1410" stroke="{TRACO}" stroke-width="{SW}"/>' for cx in (-58, 58))
        cabelo_frente = f'<path d="M-62,-222 Q-56,-282 0,-280 Q56,-282 62,-222 Q40,-252 0,-250 Q-40,-252 -62,-222 Z" fill="#1f1410" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/>'
        cabelo_frente += "".join(f'<circle cx="{cx}" cy="-252" r="7" fill="{COR["amarelo"]}" stroke="{TRACO}" stroke-width="2.5"/>' for cx in (-48, 48))
    elif quem == "davi":
        cabelo_frente = f'<path d="M-62,-214 Q-66,-282 0,-282 Q62,-284 64,-214 Q52,-246 20,-244 Q22,-262 0,-258 Q-10,-246 -30,-250 Q-52,-246 -62,-214 Z" fill="#5a3a22" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/>'
    else:
        cabelo_tras = f'<circle cx="0" cy="{hy-66}" r="30" fill="#3a2418" stroke="{TRACO}" stroke-width="{SW}"/>'
        cabelo_frente = T(f'<path d="M-64,-206 Q-64,-284 0,-282 Q64,-284 64,-206 Q56,-246 0,-250 Q-56,-246 -64,-206 Z" fill="#3a2418" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/>')
    g.append(cabelo_tras)
    g.append(f'<circle cx="0" cy="{hy}" r="64" fill="{pele}" stroke="{TRACO}" stroke-width="{SW}"/>')
    g.append(f'<circle cx="-62" cy="{hy+4}" r="11" fill="{pele}" stroke="{TRACO}" stroke-width="{SW}"/><circle cx="62" cy="{hy+4}" r="11" fill="{pele}" stroke="{TRACO}" stroke-width="{SW}"/>')
    g.append(cabelo_frente)
    rosto = _olhos(ex) + _boca(ex) + "".join(f'<ellipse cx="{x}" cy="-188" rx="10" ry="6" fill="#ff8f8f" opacity=".55"/>' for x in (-38, 38))
    if quem == "davi":
        rosto += "".join(f'<circle cx="{x}" cy="-208" r="17" fill="none" stroke="{TRACO}" stroke-width="4"/>' for x in (-21, 21)) + f'<path d="M-4,-210 L4,-210" stroke="{TRACO}" stroke-width="4"/>'
    g.append(T(rosto))
    if item == "caderno":
        g.append(f'<rect x="40" y="-140" width="44" height="56" rx="4" fill="{COR["amarelo"]}" stroke="{TRACO}" stroke-width="{SW}" transform="rotate(-12 62 -112)"/>')
    if item == "tablet":
        g.append(f'<rect x="44" y="-150" width="58" height="76" rx="8" fill="#20262e" stroke="{TRACO}" stroke-width="{SW}"/><rect x="51" y="-142" width="44" height="58" rx="3" fill="{COR["ciano"]}"/>')
    if item == "saquinho":
        g.append(saquinho(118, -246, 0.7))
    g.append(dir_)
    tr = f'translate({x},{y}) scale({-s if vira else s},{s})'
    return f'<g transform="{tr}">{"".join(g)}</g>'

def capivara(x, y, s=1.0, ex="sorri", vira=False, pose="normal"):
    c, c2 = COR["capi"], COR["capi2"]
    g = []
    for lx in (-58, -22, 38, 72):
        g.append(f'<rect x="{lx-11}" y="-46" width="22" height="46" rx="9" fill="{c2}" stroke="{TRACO}" stroke-width="{SW}"/>')
    g.append(f'<ellipse cx="0" cy="-78" rx="100" ry="62" fill="{c}" stroke="{TRACO}" stroke-width="{SW}"/>')
    g.append(f'<path d="M-60,-118 Q-30,-128 0,-122" fill="none" stroke="{c2}" stroke-width="5" stroke-linecap="round"/>')
    # cabeça quadradona de capivara
    g.append(f'<path d="M50,-110 Q52,-170 102,-172 Q156,-172 166,-128 Q172,-96 150,-82 Q110,-70 72,-80 Q50,-88 50,-110 Z" fill="{c}" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/>')
    g.append(f'<ellipse cx="148" cy="-112" rx="22" ry="20" fill="{c2}" stroke="{TRACO}" stroke-width="3"/>')
    g.append(f'<ellipse cx="156" cy="-120" rx="6" ry="4.5" fill="{TRACO}"/>')
    g.append(f'<ellipse cx="82" cy="-172" rx="13" ry="10" fill="{c2}" stroke="{TRACO}" stroke-width="{SW}"/>')
    if ex == "feliz": g.append(f'<path d="M98,-138 Q108,-150 118,-138" fill="none" stroke="{TRACO}" stroke-width="5" stroke-linecap="round"/>')
    elif ex == "fechado": g.append(f'<path d="M98,-140 L118,-140" stroke="{TRACO}" stroke-width="5" stroke-linecap="round"/>')
    else: g.append(f'<ellipse cx="108" cy="-140" rx="7.5" ry="{10 if ex!="surpresa" else 12}" fill="{TRACO}"/><circle cx="111" cy="-144" r="3" fill="#fff"/>')
    if ex == "fala": g.append(f'<path d="M126,-96 Q142,-84 158,-96 Q142,-90 126,-96 Z" fill="#7a2b2b" stroke="{TRACO}" stroke-width="3"/>')
    else: g.append(f'<path d="M128,-96 Q143,-86 158,-96" fill="none" stroke="{TRACO}" stroke-width="4" stroke-linecap="round"/>')
    # lenço verde (marca da turma)
    g.append(f'<path d="M54,-112 Q78,-92 112,-86 L96,-62 Q70,-74 48,-96 Z" fill="{COR["lima"]}" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/>')
    g.append(f'<path d="M96,-74 L104,-46 L84,-60 Z" fill="{COR["lima"]}" stroke="{TRACO}" stroke-width="3.5" stroke-linejoin="round"/>')
    if pose == "aponta":  # pata dianteira levantada
        g.append(f'<path d="M60,-60 Q96,-58 120,-76" fill="none" stroke="{TRACO}" stroke-width="{22+SW*2}" stroke-linecap="round"/><path d="M60,-60 Q96,-58 120,-76" fill="none" stroke="{c2}" stroke-width="22" stroke-linecap="round"/>')
    tr = f'translate({x},{y}) scale({-s if vira else s},{s})'
    return f'<g transform="{tr}">{"".join(g)}</g>'

def tuiuiu(x, y, s=1.0, vira=False):
    g = (f'<path d="M-6,0 L-10,-60 M10,0 L8,-60" stroke="{TRACO}" stroke-width="6"/>'
         f'<ellipse cx="0" cy="-92" rx="44" ry="36" fill="#fff" stroke="{TRACO}" stroke-width="{SW}"/>'
         f'<path d="M-44,-96 Q-60,-70 -34,-72" fill="#222" stroke="{TRACO}" stroke-width="3"/>'
         f'<path d="M18,-118 Q30,-150 22,-176" fill="none" stroke="{TRACO}" stroke-width="18" stroke-linecap="round"/>'
         f'<path d="M18,-122 Q26,-132 26,-138" stroke="#d62f2f" stroke-width="16" stroke-linecap="round"/>'
         f'<circle cx="24" cy="-182" r="13" fill="#222" stroke="{TRACO}" stroke-width="3"/>'
         f'<path d="M32,-186 L92,-170 L34,-174 Z" fill="#2b2b2b" stroke="{TRACO}" stroke-width="2.5" stroke-linejoin="round"/>')
    return f'<g transform="translate({x},{y}) scale({-s if vira else s},{s})">{g}</g>'

def peixe(x, y, s=1.0, cor="#f2a541"):
    return (f'<g transform="translate({x},{y}) scale({s})"><path d="M-30,0 Q0,-22 30,0 Q0,22 -30,0 Z" fill="{cor}" stroke="{TRACO}" stroke-width="3"/>'
            f'<path d="M-30,0 L-46,-14 L-46,14 Z" fill="{cor}" stroke="{TRACO}" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="-4" r="3.5" fill="{TRACO}"/></g>')

def saquinho(x, y, s=1.0, gotas=False):
    g = (f'<rect x="-60" y="-80" width="120" height="160" rx="10" fill="#e9f6ff" fill-opacity=".85" stroke="{TRACO}" stroke-width="{SW}"/>'
         f'<rect x="-60" y="-80" width="120" height="16" fill="#cfe3f1" stroke="{TRACO}" stroke-width="3"/>'
         f'<path d="M-56,30 Q0,22 56,30 L56,74 Q56,76 54,76 L-54,76 Q-56,76 -56,74 Z" fill="{COR["agua"]}"/>'
         f'<path d="M-56,30 Q0,22 56,30" fill="none" stroke="{TRACO}" stroke-width="3"/>'
         f'<rect x="-34" y="-96" width="68" height="20" fill="#f6e7a1" stroke="{TRACO}" stroke-width="3" transform="rotate(-4)"/>')
    if gotas:
        g += "".join(f'<ellipse cx="{gx}" cy="{gy}" rx="4" ry="6" fill="{COR["agua2"]}" stroke="{TRACO}" stroke-width="1.5"/>' for gx, gy in [(-40,-50),(-20,-56),(4,-48),(28,-54),(44,-40),(-46,-20),(40,-6),(-30,-34),(16,-30)])
        g += f'<path d="M-24,-40 Q-26,-6 -22,24" fill="none" stroke="{COR["agua"]}" stroke-width="3" stroke-dasharray="4 7"/>'
        g += f'<ellipse cx="0" cy="-56" rx="30" ry="12" fill="#fff" stroke="{TRACO}" stroke-width="2.5"/>'
    return f'<g transform="translate({x},{y}) scale({s})">{g}</g>'

# ---------------- cenários (desenham no retângulo w x h do quadrinho) ----------------
def sol(x, y, r=46):
    raios = "".join(f'<path d="M{x+math.cos(a)*(r+10):.1f},{y+math.sin(a)*(r+10):.1f} L{x+math.cos(a)*(r+30):.1f},{y+math.sin(a)*(r+30):.1f}" stroke="#f5a623" stroke-width="7" stroke-linecap="round"/>' for a in [i*math.pi/6 for i in range(12)])
    return raios + f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffd23f" stroke="{TRACO}" stroke-width="{SW}"/>'

def nuvem(x, y, s=1.0, cor="#ffffff"):
    return (f'<g transform="translate({x},{y}) scale({s})"><path d="M-80,20 Q-104,20 -100,-4 Q-96,-30 -66,-24 Q-60,-62 -20,-56 Q4,-82 40,-60 Q78,-66 80,-30 Q108,-24 100,6 Q96,22 74,20 Z" '
            f'fill="{cor}" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/></g>')

def ceu(w, h, cor1=None, cor2=None):
    return (f'<defs><linearGradient id="gceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{cor1 or COR["ceu"]}"/><stop offset="1" stop-color="{cor2 or COR["ceu2"]}"/></linearGradient></defs>'
            f'<rect width="{w}" height="{h}" fill="url(#gceu)"/>')

def capim(w, y, cor=None, n=40, alt=24):
    cor = cor or COR["capim"]
    tufos = "".join(f'<path d="M{i*w/n:.0f},{y} L{i*w/n+6:.0f},{y-alt-(i%3)*8} L{i*w/n+12:.0f},{y}" fill="{cor}" stroke="{TRACO}" stroke-width="2"/>' for i in range(n + 1))
    return tufos

def arvore(x, y, s=1.0, copa="#4f8f3a", flor=None):
    flores = "".join(f'<circle cx="{fx}" cy="{fy}" r="9" fill="{flor}"/>' for fx, fy in [(-40,-190),(10,-215),(44,-180),(-10,-170),(30,-150),(-50,-150)]) if flor else ""
    return (f'<g transform="translate({x},{y}) scale({s})"><path d="M-12,0 L-8,-120 L8,-120 L12,0 Z" fill="#7a5131" stroke="{TRACO}" stroke-width="{SW}"/>'
            f'<path d="M-80,-140 Q-90,-200 -40,-214 Q-10,-250 34,-226 Q86,-222 82,-170 Q100,-132 54,-122 Q0,-110 -46,-118 Q-86,-112 -80,-140 Z" fill="{copa}" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/>{flores}</g>')

def cena(nome, w, h):
    if nome == "sala":
        return (f'<rect width="{w}" height="{h}" fill="#fbefd5"/><rect y="{h*0.8:.0f}" width="{w}" height="{h*0.2+2:.0f}" fill="#c99d6a" stroke="{TRACO}" stroke-width="{SW}"/>'
                f'<rect x="{w*0.08:.0f}" y="{h*0.12:.0f}" width="{w*0.5:.0f}" height="{h*0.42:.0f}" rx="8" fill="#2f5d45" stroke="#7a5131" stroke-width="12"/>' +
                (f'<text x="{w*0.12:.0f}" y="{h*0.24:.0f}" font-family="ComicNeue" font-weight="700" font-size="{max(18,h*0.06):.0f}" fill="#e8f3e8">Ciências · 5º ano</text>' if False else "") +
                f'<rect x="{w*0.7:.0f}" y="{h*0.1:.0f}" width="{w*0.22:.0f}" height="{h*0.34:.0f}" fill="{COR["ceu"]}" stroke="{TRACO}" stroke-width="{SW}"/>'
                f'<path d="M{w*0.81:.0f},{h*0.1:.0f} V{h*0.44:.0f} M{w*0.7:.0f},{h*0.27:.0f} H{w*0.92:.0f}" stroke="{TRACO}" stroke-width="{SW}"/>')
    if nome in ("seco", "cheio"):
        cheio = nome == "cheio"
        nivel = h * (0.62 if cheio else 0.80)
        s = ceu(w, h) + sol(w * 0.86, h * 0.18, min(46, h * 0.1))
        s += arvore(w * 0.12, h * 0.70, h / 900, flor="#f2c94c" if not cheio else None) + arvore(w * 0.94, h * 0.72, h / 1000)
        s += f'<path d="M0,{h*0.62:.0f} Q{w*0.3:.0f},{h*0.58:.0f} {w*0.5:.0f},{h*0.62:.0f} T{w},{h*0.6:.0f} V{h} H0 Z" fill="{COR["capim2"] if cheio else COR["capim"]}" stroke="{TRACO}" stroke-width="{SW}"/>'
        if cheio:
            s += f'<rect y="{nivel:.0f}" width="{w}" height="{h-nivel+2:.0f}" fill="{COR["agua"]}" stroke="{TRACO}" stroke-width="{SW}"/>'
            s += "".join(f'<path d="M{x0},{nivel+30+k*40:.0f} q20,-10 40,0" fill="none" stroke="#bfe3ff" stroke-width="4" stroke-linecap="round"/>' for k in range(3) for x0 in range(30 + k * 60, w, 220))
        else:
            s += f'<path d="M0,{h*0.86:.0f} Q{w*0.5:.0f},{h*0.76:.0f} {w},{h*0.86:.0f} V{h} H0 Z" fill="{COR["lama"]}" stroke="{TRACO}" stroke-width="{SW}"/>'
            s += f'<path d="M{w*0.18:.0f},{h*0.93:.0f} Q{w*0.5:.0f},{h*0.86:.0f} {w*0.82:.0f},{h*0.93:.0f} Q{w*0.5:.0f},{h*0.98:.0f} {w*0.18:.0f},{h*0.93:.0f} Z" fill="{COR["agua2"]}" stroke="{TRACO}" stroke-width="3"/>'
            s += "".join(f'<path d="M{x},{h*0.9:.0f} l14,8 l-6,10" fill="none" stroke="#7d5c35" stroke-width="3"/>' for x in range(40, w, 140))
        s += capim(w, h * 0.62 + 4, COR["capim2"] if cheio else COR["capim"], n=int(w / 30), alt=18)
        return s
    if nome == "alto":
        return (ceu(w, h, "#5aa9e6", "#cfeeff") + nuvem(w * 0.25, h * 0.25, h / 500) + nuvem(w * 0.72, h * 0.18, h / 600))
    if nome == "chuva":
        s = ceu(w, h, "#6d7f92", "#b8c7d6") + nuvem(w * 0.3, h * 0.2, h / 380, "#8e9aa8") + nuvem(w * 0.72, h * 0.16, h / 420, "#9aa6b3")
        s += "".join(f'<path d="M{x},{y} l-8,26" stroke="{COR["agua"]}" stroke-width="5" stroke-linecap="round"/>' for x in range(40, w, 36) for y in range(int(h * 0.36), int(h * 0.92), 70))
        return s
    if nome == "branco":
        return f'<rect width="{w}" height="{h}" fill="#fffdf6"/>'
    return f'<rect width="{w}" height="{h}" fill="#fff"/>'

def seta_onda(x1, y1, x2, y2, cor="#ffffff", larg=6):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    return (f'<path d="M{x1},{y1} Q{mx-30},{my} {mx},{my} T{x2},{y2}" fill="none" stroke="{TRACO}" stroke-width="{larg+5}" stroke-linecap="round"/>'
            f'<path d="M{x1},{y1} Q{mx-30},{my} {mx},{my} T{x2},{y2}" fill="none" stroke="{cor}" stroke-width="{larg}" stroke-linecap="round"/>'
            f'<circle cx="{x2}" cy="{y2}" r="{larg+3}" fill="{cor}" stroke="{TRACO}" stroke-width="3"/>')

def vapor(x, y0, y1, n=3, sep=46, cor="#ffffff"):
    """Vapor subindo: linhas onduladas com seta no alto (sem 'bolinha' na ponta)."""
    s = ""
    for k in range(n):
        cx = x + (k - (n - 1) / 2) * sep; d = f"M{cx:.0f},{y0:.0f}"; y = y0; lado = 1
        while y - 46 > y1:
            d += f" q{14*lado},-23 0,-46"; y -= 46; lado *= -1
        s += f'<path d="{d}" fill="none" stroke="{TRACO}" stroke-width="12" stroke-linecap="round" opacity=".55"/><path d="{d}" fill="none" stroke="{cor}" stroke-width="7" stroke-linecap="round"/>'
        s += f'<path d="M{cx-16:.0f},{y+14:.0f} L{cx:.0f},{y-6:.0f} L{cx+16:.0f},{y+14:.0f}" fill="none" stroke="{TRACO}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>'
        s += f'<path d="M{cx-16:.0f},{y+14:.0f} L{cx:.0f},{y-6:.0f} L{cx+16:.0f},{y+14:.0f}" fill="none" stroke="{cor}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
    return s

def etiqueta(x, y, texto, cor=None, tam=34, ang=0):
    cor = cor or COR["amarelo"]; lw = len(texto) * tam * 0.56 + 36
    return (f'<g transform="translate({x},{y}) rotate({ang})"><rect x="{-lw/2:.0f}" y="{-tam*0.85:.0f}" width="{lw:.0f}" height="{tam*1.5:.0f}" rx="12" fill="{cor}" stroke="{TRACO}" stroke-width="{SW}"/>'
            f'<text x="0" y="{tam*0.32:.0f}" text-anchor="middle" font-family="Bangers" font-size="{tam}" letter-spacing="1.5" fill="{TRACO}">{esc(texto)}</text></g>')

# ---------------- balões e recordatórios ----------------
def quebrar(texto, max_c):
    linhas, atual = [], ""
    for p in texto.split():
        if len(atual) + len(p) + 1 > max_c and atual: linhas.append(atual); atual = p
        else: atual = (atual + " " + p).strip()
    if atual: linhas.append(atual)
    return linhas

def balao(x, y, texto, larg=300, tx=None, ty=None, tam=25, tipo="fala"):
    """(x,y) = canto superior esquerdo; (tx,ty) = ponta do rabicho (boca de quem fala)."""
    linhas = quebrar(texto.upper(), max(8, int(larg / (tam * 0.6))))
    lh = tam * 1.18; h = len(linhas) * lh + tam * 1.1
    w = min(larg, max(len(l) for l in linhas) * tam * 0.62 + tam * 1.4)
    cx, cy = x + w / 2, y + h / 2
    s = ""
    if tx is not None:
        bx = min(max(tx, x + 30), x + w - 30)
        base_y = y + h - 8 if ty > cy else y + 8
        s += f'<path d="M{bx-16:.0f},{base_y:.0f} L{tx:.0f},{ty:.0f} L{bx+16:.0f},{base_y:.0f} Z" fill="#fff" stroke="{TRACO}" stroke-width="{SW}" stroke-linejoin="round"/>'
    if tipo == "pensa":
        s += f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{w/2+14:.0f}" ry="{h/2+12:.0f}" fill="#fff" stroke="{TRACO}" stroke-width="{SW}" stroke-dasharray="2 9" stroke-linecap="round"/>'
    else:
        s += f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" rx="{min(36, h/2):.0f}" fill="#fff" stroke="{TRACO}" stroke-width="{SW}"/>'
        if tx is not None:  # cobre a junção do rabicho
            bx = min(max(tx, x + 30), x + w - 30); base_y = y + h - 8 if ty > cy else y + 8
            s += f'<path d="M{bx-13:.0f},{base_y:.0f} L{bx+13:.0f},{base_y:.0f}" stroke="#fff" stroke-width="10"/>'
    for i, l in enumerate(linhas):
        s += f'<text x="{cx:.0f}" y="{y + tam*1.05 + i*lh:.0f}" text-anchor="middle" font-family="ComicNeue" font-weight="700" font-size="{tam}" fill="{TRACO}">{esc(l)}</text>'
    return s

def recordatorio(x, y, texto, larg=420, tam=24, cor=None):
    linhas = quebrar(texto, max(10, int(larg / (tam * 0.55))))
    lh = tam * 1.2; h = len(linhas) * lh + tam * 0.9
    w = min(larg, max(len(l) for l in linhas) * tam * 0.56 + tam * 1.3)
    s = f'<rect x="{x}" y="{y}" width="{w:.0f}" height="{h:.0f}" fill="{cor or COR["amarelo"]}" stroke="{TRACO}" stroke-width="{SW}"/>'
    for i, l in enumerate(linhas):
        s += f'<text x="{x + tam*0.6:.0f}" y="{y + tam*1.0 + i*lh:.0f}" font-family="ComicNeue" font-weight="700" font-style="italic" font-size="{tam}" fill="{TRACO}">{esc(l)}</text>'
    return s
