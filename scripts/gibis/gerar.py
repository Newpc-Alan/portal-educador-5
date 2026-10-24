#!/usr/bin/env python3
# Gera as páginas do gibi "Turma do Pantanal: Pra onde vai a água?".
# Ilustrações (sem texto) em quadros-agua/, geradas por IA a partir da ficha de personagens da NEWPC;
# balões, títulos e legendas são montados em hq.py. agua.py/arte.py guardam a versão 1 (arte em código) e a página "Hora de Pensar".
# Uso (pasta scripts/gibis): npm install && python3 gerar.py
# Saída: ../../assets/gibis/turma-do-pantanal/ciclo-da-agua/p00..p08.webp
import os, tempfile, hq, render
from PIL import Image
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../assets/gibis/turma-do-pantanal/ciclo-da-agua/v2")
os.makedirs(SAIDA, exist_ok=True)
tmp = tempfile.mkdtemp()
render.render([(f(), os.path.join(tmp, f"p{i:02d}.png")) for i, f in enumerate(hq.PAGINAS)])
for i in range(len(hq.PAGINAS)):
    Image.open(os.path.join(tmp, f"p{i:02d}.png")).convert("RGB").save(os.path.join(SAIDA, f"p{i:02d}.webp"), "WEBP", quality=86, method=6)
print("PRONTO:", len(hq.PAGINAS), "páginas em", os.path.normpath(SAIDA))
