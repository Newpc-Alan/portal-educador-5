#!/usr/bin/env python3
# Lista os livros em português do Project Gutenberg (catálogo aberto gutendex.com) e separa
# os que estão em domínio público no Brasil: autor falecido há mais de 70 anos (Lei 9.610/98, art. 41).
# Uso: python3 gutenberg-pt.py  -> grava /tmp/gutenberg-pt.json e mostra o resumo
import json, time, urllib.request, datetime

LIMITE = datetime.date.today().year - 71  # 2026 -> autor falecido até 1955
url, livros = "https://gutendex.com/books/?languages=pt", []
while url:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "PortalDoEducador/1.0 (suporte@portaldoeducador.com.br)"}), timeout=60) as r:
        d = json.load(r)
    livros += d["results"]; url = d.get("next"); time.sleep(1)

def situacao(b):
    if b.get("copyright") is True: return "protegido", "marcado com direitos autorais"
    autores = b.get("authors") or []
    if not autores: return "revisar", "sem autor identificado"
    mortes = [a.get("death_year") for a in autores]
    if any(m is None for m in mortes): return "revisar", "ano de morte do autor desconhecido"
    if max(mortes) > LIMITE: return "protegido", f"autor falecido em {max(mortes)}"
    if (b.get("translators") or []) and any((t.get("death_year") or 9999) > LIMITE for t in b["translators"]):
        return "revisar", "tradução possivelmente protegida"
    return "livre", f"autor falecido em {max(mortes)}"

saida = []
for b in livros:
    st, motivo = situacao(b)
    saida.append({"id": b["id"], "titulo": b["title"], "autores": [a["name"] for a in b.get("authors") or []],
                  "morte": [a.get("death_year") for a in b.get("authors") or []], "situacao": st, "motivo": motivo,
                  "assuntos": b.get("subjects", [])[:6], "estantes": b.get("bookshelves", [])[:6], "downloads": b.get("download_count", 0),
                  "formatos": {k: v for k, v in (b.get("formats") or {}).items() if "epub" in k or "html" in k or "text/plain" in k}})
json.dump(saida, open("/tmp/gutenberg-pt.json", "w"), ensure_ascii=False, indent=1)
from collections import Counter
print("TOTAL", len(saida), dict(Counter(x["situacao"] for x in saida)))
autores = Counter(a for x in saida if x["situacao"] == "livre" for a in x["autores"])
print("AUTORES LIVRES (top 25):", autores.most_common(25))
print("INFANTIL:", [x["titulo"][:40] for x in saida if x["situacao"] == "livre" and any("child" in s.lower() or "juvenile" in s.lower() for s in x["assuntos"] + x["estantes"])][:20])
