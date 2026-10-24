# Turma do Pantanal em "Pra onde vai a água?" · Ciências 5º ano · BNCC EF05CI02
from arte import *
W, H, M, G = 1240, 1754, 44, 22

def painel(x, y, w, h, fundo, conteudo=""):
    return (f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="0 0 {w} {h}" overflow="hidden">{cena(fundo, w, h)}{conteudo}</svg>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="{TRACO}" stroke-width="6"/>')

def pagina(n, corpo):
    rod = f'<text x="{W/2}" y="{H-14}" text-anchor="middle" font-family="ComicNeue" font-weight="700" font-size="20" fill="#7d8a96">{n}</text>' if n else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#fffdf6"/>{corpo}{rod}</svg>'

LW = W - 2 * M  # largura útil
T = 28          # tamanho do texto dos balões

def capa():
    s = ceu(W, H, "#62b6ee", "#e7f6ff") + sol(1040, 450, 70) + nuvem(330, 470, 1.5, "#dfe9f2") + nuvem(760, 400, 1.0, "#f2f9ff")
    s += f'<path d="M0,1080 Q400,1020 700,1080 T{W},1060 V{H} H0 Z" fill="{COR["capim2"]}" stroke="{TRACO}" stroke-width="5"/>'
    s += f'<path d="M0,1330 Q620,1250 {W},1330 V{H} H0 Z" fill="{COR["agua"]}" stroke="{TRACO}" stroke-width="5"/>'
    s += "".join(f'<path d="M{x},{1400+k*70} q30,-14 60,0" fill="none" stroke="#bfe3ff" stroke-width="6" stroke-linecap="round"/>' for k in range(4) for x in range(60 + k * 90, W, 300))
    s += arvore(150, 1110, 1.5, flor="#f2c94c") + arvore(1110, 1100, 1.2)
    s += vapor(900, 900, 560, 3, 50)
    s += "".join(f'<path d="M{x},{y} l-10,30" stroke="{COR["agua"]}" stroke-width="7" stroke-linecap="round"/>' for x in range(230, 450, 40) for y in (560, 630, 700))
    s += tuiuiu(110, 1320, 0.85)
    s += pessoa(330, 1330, 1.5, "lia", "feliz", "feliz") + pessoa(590, 1330, 1.5, "davi", "aponta", "sorri") + pessoa(1080, 1310, 1.25, "clara", "segura", "sorri", item="tablet")
    s += capivara(810, 1410, 1.3, "feliz")
    # título
    s += f'<rect x="60" y="56" width="{W-120}" height="250" rx="34" fill="{COR["escuro"]}" stroke="{TRACO}" stroke-width="7"/>'
    s += f'<text x="{W/2}" y="160" text-anchor="middle" font-family="Bangers" font-size="112" letter-spacing="4" fill="{COR["lima"]}" stroke="{TRACO}" stroke-width="3">TURMA DO PANTANAL</text>'
    s += f'<text x="{W/2}" y="260" text-anchor="middle" font-family="Bangers" font-size="76" letter-spacing="2" fill="{COR["amarelo"]}">PRA ONDE VAI A ÁGUA?</text>'
    s += f'<rect x="0" y="{H-110}" width="{W}" height="110" fill="{COR["escuro"]}"/>'
    s += f'<text x="{M}" y="{H-48}" font-family="ComicNeue" font-weight="700" font-size="34" fill="#fff">Gibiteca · Portal do Educador</text>'
    s += f'<text x="{W-M}" y="{H-48}" text-anchor="end" font-family="ComicNeue" font-weight="700" font-size="30" fill="{COR["lima"]}">Ciências · 5º ano · EF05CI02</text>'
    return pagina(0, s)

def p1():
    x, y = M, M
    a = painel(x, y, LW, 560, "sala",
        recordatorio(26, 24, "Escola Municipal do Pantanal, Mato Grosso do Sul.", 520) +
        pessoa(250, 540, 1.25, "clara", "aponta", "fala", item="tablet") + pessoa(800, 545, 1.05, "lia", "normal", "sorri", vira=True) + pessoa(1000, 545, 1.05, "davi", "normal", "sorri", vira=True) +
        balao(330, 110, "Turma, amanhã vamos visitar o rio aqui perto da escola!", 420, 290, 230, T))
    y2 = y + 560 + G; w2 = (LW - G) // 2
    b = painel(x, y2, w2, 520, "sala",
        pessoa(180, 505, 1.15, "lia", "feliz", "feliz", item="caderno") + balao(30, 24, "Oba! Vou levar meu caderno de ciências!", 300, 180, 160, T))
    c = painel(x + w2 + G, y2, w2, 520, "sala",
        pessoa(370, 505, 1.15, "davi", "pensa", "duvida", vira=True) + balao(24, 24, "E eu, o protetor solar. Tá calor demais!", 300, 340, 160, T))
    y3 = y2 + 520 + G
    d = painel(x, y3, LW, H - y3 - M - 20, "seco",
        recordatorio(26, 24, "No dia seguinte, na beira do rio...", 480) +
        pessoa(330, 520, 1.1, "davi", "aponta", "surpresa") + pessoa(150, 520, 1.0, "lia", "normal", "surpresa") + pessoa(1000, 515, 1.0, "clara", "normal", "sorri", vira=True) +
        balao(420, 90, "Ué! Cadê a água do rio? No começo do ano estava tudo alagado!", 460, 360, 240, T))
    return pagina(1, a + b + c + d)

def p2():
    x, y = M, M
    a = painel(x, y, LW, 600, "seco",
        capivara(820, 560, 1.4, "fala", vira=True) + pessoa(240, 560, 1.15, "lia", "normal", "surpresa") + pessoa(450, 560, 1.15, "davi", "normal", "surpresa") +
        balao(700, 40, "A água não sumiu, não. Ela só foi viajar!", 400, 700, 330, T) +
        balao(40, 30, "Uma capivara que fala?!", 260, 250, 200, T))
    y2 = y + 600 + G; w2 = (LW - G) // 2
    b = painel(x, y2, w2, 520, "seco",
        capivara(290, 500, 1.15, "feliz", vira=True) + balao(24, 24, "Prazer, Bento! Moro aqui no Pantanal e conheço a água muito bem.", 330, 200, 310, T))
    c = painel(x + w2 + G, y2, w2, 520, "seco",
        pessoa(200, 505, 1.15, "davi", "pensa", "duvida") + balao(250, 30, "Viajar pra onde, Bento?", 290, 240, 230, T))
    y3 = y2 + 520 + G
    hh = H - y3 - M - 20
    d = painel(x, y3, LW, hh, "seco",
        capivara(320, hh - 40, 1.2, "fala") +
        balao(500, 140, "Pra cima! Olha o sol esquentando o rio...", 360, 500, hh - 160, T) + vapor(1000, hh - 60, 200, 2, 50))
    return pagina(2, a + b + c + d)

def p3():
    x, y = M, M
    hh = 660
    a = painel(x, y, LW, hh, "seco",
        vapor(560, hh - 50, 230, 4, 70) + etiqueta(LW / 2, 140, "EVAPORAÇÃO", tam=58) +
        recordatorio(26, 240, "Com o calor do sol, a água líquida vira vapor, um gás invisível, e sobe para o céu.", 420) +
        capivara(1000, hh - 30, 1.0, "fala", vira=True))
    y2 = y + hh + G; w2 = (LW - G) // 2
    b = painel(x, y2, w2, 520, "seco",
        pessoa(160, 505, 1.15, "clara", "aponta", "fala") + balao(230, 24, "Isso mesmo! Do estado líquido para o gasoso.", 320, 220, 230, T))
    c = painel(x + w2 + G, y2, w2, 520, "seco",
        pessoa(380, 505, 1.15, "lia", "segura", "duvida", vira=True, item="caderno") + balao(24, 24, "E as plantas também soltam água?", 300, 340, 230, T))
    y3 = y2 + 520 + G; hh3 = H - y3 - M - 20
    plantas = arvore(170, hh3 - 30, 1.0) + arvore(420, hh3 - 20, 1.15) + vapor(170, hh3 - 290, 20, 2, 44, "#e8fff0") + vapor(420, hh3 - 320, 20, 2, 44, "#e8fff0")
    d = painel(x, y3, LW, hh3, "seco",
        plantas + capivara(1040, hh3 - 30, 1.1, "fala", vira=True) + etiqueta(300, hh3 - 50, "TRANSPIRAÇÃO", COR["lima"], 44) +
        balao(560, 30, "Soltam sim! Pelas folhas. Isso se chama transpiração.", 360, 900, hh3 - 180, T))
    return pagina(3, a + b + c + d)

def p4():
    x, y = M, M
    hh = 700
    gotas = "".join(f'<ellipse cx="{gx}" cy="{gy}" rx="9" ry="13" fill="{COR["agua2"]}" stroke="{TRACO}" stroke-width="2.5"/>' for gx, gy in [(420,330),(470,300),(520,345),(570,310),(640,330),(700,300),(760,340)])
    a = painel(x, y, LW, hh, "alto",
        recordatorio(26, 24, "Lá no alto, o ar é bem mais frio.", 460) + vapor(590, hh - 20, 440, 4, 60) +
        nuvem(590, 360, 1.6, "#f4fbff") + gotas + etiqueta(LW / 2, 200, "CONDENSAÇÃO", COR["ciano"], 58) +
        recordatorio(720, hh - 170, "O vapor esfria e vira gotinhas de água: elas formam as nuvens.", 400, cor="#ffffff"))
    y2 = y + hh + G
    b = painel(x, y2, LW, 520, "alto",
        pessoa(200, 505, 1.15, "davi", "aponta", "surpresa") + pessoa(1000, 505, 1.15, "clara", "normal", "fala", vira=True) +
        balao(280, 30, "Então as nuvens são feitas de gotinhas de água?", 360, 250, 230, T) +
        balao(650, 160, "De gotinhas e de cristais de gelo. Bilhões deles!", 330, 960, 250, T))
    y3 = y2 + 520 + G; hh3 = H - y3 - M - 20; w2 = (LW - G) // 2
    copo = (f'<g transform="translate(420,{hh3-120})"><path d="M-60,-140 L60,-140 L48,60 L-48,60 Z" fill="#e6f6ff" fill-opacity=".9" stroke="{TRACO}" stroke-width="5"/>'
            f'<rect x="-44" y="-90" width="36" height="34" rx="6" fill="#ffffff" stroke="{TRACO}" stroke-width="3" transform="rotate(-10)"/>'
            + "".join(f'<ellipse cx="{gx}" cy="{gy}" rx="5" ry="7" fill="{COR["agua2"]}" stroke="{TRACO}" stroke-width="1.5"/>' for gx, gy in [(-58,-100),(-54,-40),(-50,10),(56,-110),(54,-50),(50,0),(-56,-70),(55,30)]) + '</g>')
    c = painel(x, y3, w2, hh3, "sala",
        pessoa(150, hh3 - 20, 0.9, "lia", "pensa", "duvida") + copo + balao(24, 20, "Igual ao copo gelado que fica molhado por fora!", 340, 160, hh3 - 290, 25))
    d = painel(x + w2 + G, y3, w2, hh3, "sala",
        capivara(330, hh3 - 30, 1.0, "fala", vira=True) + balao(24, 24, "Exatamente! É o vapor do ar virando gotinha no copo frio.", 340, 260, hh3 - 200, T))
    return pagina(4, a + b + c + d)

def p5():
    x, y = M, M
    hh = 520
    a = painel(x, y, LW, hh, "chuva",
        etiqueta(LW / 2, hh - 200, "PRECIPITAÇÃO", COR["amarelo"], 58) +
        recordatorio(26, hh - 110, "Quando as gotinhas se juntam e ficam pesadas, elas caem: é a chuva!", 760, cor="#ffffff"))
    y2 = y + hh + G
    solo = (f'<rect y="200" width="{LW}" height="320" fill="#a5784a"/><rect y="200" width="{LW}" height="40" fill="{COR["capim2"]}" stroke="{TRACO}" stroke-width="4"/>'
            f'<rect y="400" width="{LW}" height="120" fill="{COR["agua2"]}" stroke="{TRACO}" stroke-width="4"/>'
            + "".join(f'<path d="M{px},250 l0,120" stroke="{COR["agua"]}" stroke-width="7" stroke-dasharray="14 12" stroke-linecap="round"/>' for px in range(120, LW, 160))
            + f'<text x="40" y="470" font-family="Bangers" font-size="40" fill="{COR["escuro"]}">AQUÍFERO (ÁGUA DEBAIXO DA TERRA)</text>')
    b = painel(x, y2, LW, 520, "chuva",
        solo + etiqueta(250, 110, "INFILTRAÇÃO", COR["lima"], 44) +
        recordatorio(520, 20, "Parte da água entra no solo e abastece os aquíferos, como o Aquífero Guarani, que passa por baixo de Mato Grosso do Sul.", 600, 25, "#ffffff"))
    y3 = y2 + 520 + G; hh3 = H - y3 - M - 20; nv = hh3 * 0.62
    d = painel(x, y3, LW, hh3, "cheio",
        recordatorio(26, 20, "Meses depois, na época das chuvas...", 480) + peixe(300, hh3 - 60) + peixe(560, hh3 - 30, 0.8, "#e66a4b") + tuiuiu(1100, nv + 10, 0.85, vira=True) +
        pessoa(170, nv + 14, 0.85, "davi", "feliz", "feliz") + capivara(800, nv + 24, 0.95, "fala", vira=True) +
        balao(250, 100, "O rio encheu de novo!", 250, 300, nv - 150, T) + balao(540, 76, "E o ciclo recomeça. A água vive dando a volta!", 330, 700, nv - 100, T))
    return pagina(5, a + b + d)

def p6():
    x, y = M, M
    a = painel(x, y, LW, 440, "sala",
        pessoa(200, 425, 1.0, "lia", "aponta", "fala") + pessoa(1000, 425, 1.0, "clara", "normal", "sorri", vira=True) +
        balao(300, 40, "Professora, por que o ciclo da água é tão importante?", 460, 250, 200, T))
    y2 = y + 440 + G; w4 = (LW - G) // 2; h4 = (H - y2 - M - 20 - G) // 2
    def quadro(px, py, desenho, texto, fundo="branco"):
        return painel(px, py, w4, h4, fundo, desenho + recordatorio(20, h4 - 120, texto, w4 - 40, 26, "#ffffff"))
    plant = "".join(f'<g transform="translate({60+i*85},300)"><path d="M0,0 L0,-90" stroke="#3e7d2a" stroke-width="7"/><ellipse cx="-18" cy="-60" rx="20" ry="9" fill="{COR["capim2"]}" stroke="{TRACO}" stroke-width="3"/><ellipse cx="18" cy="-80" rx="20" ry="9" fill="{COR["capim2"]}" stroke="{TRACO}" stroke-width="3"/><ellipse cx="0" cy="-100" rx="9" ry="16" fill="#f2c94c" stroke="{TRACO}" stroke-width="3"/></g>' for i in range(6)) + nuvem(300, 90, 0.8) + "".join(f'<path d="M{x0},{150} l-6,22" stroke="{COR["agua"]}" stroke-width="5" stroke-linecap="round"/>' for x0 in range(230, 400, 30))
    torneira = (f'<g transform="translate({w4/2},120)"><rect x="-90" y="-20" width="140" height="40" rx="10" fill="#b7c2cc" stroke="{TRACO}" stroke-width="5"/><rect x="30" y="-20" width="40" height="80" rx="10" fill="#b7c2cc" stroke="{TRACO}" stroke-width="5"/>'
                f'<path d="M50,64 Q46,120 50,170" stroke="{COR["agua"]}" stroke-width="16" stroke-linecap="round"/><path d="M0,200 Q50,250 100,200 L100,240 L0,240 Z" fill="#fff" stroke="{TRACO}" stroke-width="5"/></g>')
    usina = (f'<path d="M0,300 L{w4},300 V{h4} H0 Z" fill="{COR["agua"]}"/><path d="M{w4*0.3:.0f},120 L{w4*0.7:.0f},120 L{w4*0.75:.0f},300 L{w4*0.25:.0f},300 Z" fill="#d6d6d6" stroke="{TRACO}" stroke-width="5"/>'
             f'<path d="M{w4*0.75:.0f},160 L{w4*0.95:.0f},60 M{w4*0.85:.0f},110 L{w4*0.95:.0f},160" stroke="{TRACO}" stroke-width="5"/><path d="M{w4*0.5:.0f},170 l-24,46 h30 l-18,46" fill="none" stroke="#ffd23f" stroke-width="9" stroke-linejoin="round"/>')
    bichos = f'<path d="M0,250 Q{w4/2},210 {w4},250 V{h4} H0 Z" fill="{COR["agua"]}"/>' + peixe(150, 300) + peixe(320, 330, 0.8, "#e66a4b") + tuiuiu(420, 250, 0.7, vira=True)
    q = (quadro(x, y2, plant, "Rega as plantações e a mata.") + quadro(x + w4 + G, y2, torneira, "Enche as represas e chega na torneira de casa.") +
         quadro(x, y2 + h4 + G, usina, "Move as turbinas das hidrelétricas e gera energia.") + quadro(x + w4 + G, y2 + h4 + G, bichos, "Faz a cheia e a seca do Pantanal, que os animais precisam."))
    return pagina(6, a + q)

def p7():
    x, y = M, M
    a = painel(x, y, LW, 560, "sala",
        pessoa(270, 545, 1.2, "clara", "aponta", "fala", item="saquinho") + pessoa(820, 545, 1.0, "lia", "normal", "sorri", vira=True) + pessoa(1010, 545, 1.0, "davi", "normal", "surpresa", vira=True) +
        balao(380, 40, "Vamos montar um ciclo da água no saquinho, colado na janela!", 420, 330, 210, T))
    y2 = y + 560 + G; w2 = (LW - G) // 2
    janela = f'<rect x="60" y="40" width="{w2-120}" height="440" fill="{COR["ceu"]}" stroke="#7a5131" stroke-width="14"/>' + sol(w2 - 140, 120, 40)
    b = painel(x, y2, w2, 520, "sala", janela + saquinho(w2 / 2 - 40, 300, 1.5, gotas=True) + recordatorio(20, 20, "Dois dias depois...", 300))
    c = painel(x + w2 + G, y2, w2, 520, "sala",
        pessoa(160, 505, 1.1, "davi", "aponta", "surpresa") + pessoa(410, 505, 1.1, "lia", "feliz", "feliz", vira=True) +
        balao(20, 20, "Tem gotinhas lá em cima, igual nuvem!", 260, 160, 230, 25) + balao(290, 120, "E escorrendo, igual chuva!", 250, 420, 240, 25))
    y3 = y2 + 520 + G; hh3 = H - y3 - M - 20
    d = painel(x, y3, LW, hh3, "sala",
        f'<rect x="560" y="40" width="600" height="{hh3-80}" fill="{COR["ceu"]}" stroke="#7a5131" stroke-width="14"/>' + capivara(1010, hh3 - 60, 1.0, "feliz", vira=True) +
        saquinho(690, hh3 - 220, 1.0, gotas=True) +
        balao(80, 60, "Viu só? O ciclo da água cabe até num saquinho!", 400, 868, hh3 - 150, T) +
        f'<text x="200" y="{hh3-50}" font-family="Bangers" font-size="110" fill="{COR["verde"]}" stroke="{TRACO}" stroke-width="3">FIM</text>')
    return pagina(7, a + b + c + d)

def p8():
    s = f'<rect x="{M}" y="{M}" width="{LW}" height="150" rx="26" fill="{COR["escuro"]}"/>'
    s += f'<text x="{W/2}" y="{M+100}" text-anchor="middle" font-family="Bangers" font-size="84" letter-spacing="3" fill="{COR["lima"]}">HORA DE PENSAR!</text>'
    perguntas = ["Por que o rio do Pantanal fica mais baixo na seca? Para onde foi a água?",
                 "Complete o ciclo: evaporação → ______________ → precipitação → infiltração.",
                 "Dê dois exemplos de como você usa a água do ciclo no seu dia a dia.",
                 "Por que é importante não jogar lixo nos rios?"]
    yy = M + 196
    for i, q in enumerate(perguntas):
        linhas = quebrar(q, 58)
        s += f'<circle cx="{M+40}" cy="{yy+20}" r="32" fill="{COR["lima"]}" stroke="{TRACO}" stroke-width="4"/><text x="{M+40}" y="{yy+34}" text-anchor="middle" font-family="Bangers" font-size="40">{i+1}</text>'
        for k, l in enumerate(linhas):
            s += f'<text x="{M+100}" y="{yy+32+k*44}" font-family="ComicNeue" font-weight="700" font-size="36" fill="{TRACO}">{esc(l)}</text>'
        yy += 44 * len(linhas) + 24
        s += "".join(f'<line x1="{M+100}" y1="{yy+k*50}" x2="{W-M}" y2="{yy+k*50}" stroke="#c9d3dc" stroke-width="3"/>' for k in range(2))
        yy += 50 + 40
    s += f'<rect x="{M}" y="{yy}" width="{LW}" height="270" rx="22" fill="#eef8e2" stroke="{TRACO}" stroke-width="4"/>'
    s += saquinho(W - M - 140, yy + 140, 0.9, gotas=True)
    s += f'<text x="{M+30}" y="{yy+60}" font-family="Bangers" font-size="48" fill="{COR["verde"]}">EXPERIMENTE EM CASA</text>'
    for k, l in enumerate(quebrar("Coloque um pouco de água com corante azul num saquinho com fecho, cole na janela com sol e observe por dois dias. Desenhe o que acontecer!", 50)):
        s += f'<text x="{M+30}" y="{yy+115+k*42}" font-family="ComicNeue" font-weight="700" font-size="32" fill="{TRACO}">{esc(l)}</text>'
    yy += 296
    info = ["BNCC EF05CI02 · Ciências · 5º ano · ciclo hidrológico e suas implicações",
            "na agricultura, no clima, na energia, na água potável e nos ecossistemas.",
            "Turma do Pantanal: personagens e história originais © NEWPC Tecnologia.",
            "Portal do Educador · uso exclusivo das redes parceiras."]
    s += f'<rect x="{M}" y="{yy}" width="{LW}" height="{len(info)*38+36}" rx="22" fill="#f3f6f9" stroke="#c9d3dc" stroke-width="3"/>'
    for k, l in enumerate(info):
        s += f'<text x="{M+30}" y="{yy+46+k*38}" font-family="ComicNeue" font-weight="{700 if k in (0,2) else 400}" font-size="26" fill="#3b4a58">{esc(l)}</text>'
    return pagina(8, s)

PAGINAS = [capa, p1, p2, p3, p4, p5, p6, p7, p8]
