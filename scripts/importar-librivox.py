#!/usr/bin/env python3
# Biblioteca do Portal 5.0: audiolivros em português do LibriVox.
# As gravações do LibriVox são feitas por voluntários e dedicadas ao domínio público; o texto também precisa
# estar em domínio público NO BRASIL (Lei 9.610/98, art. 41: autores falecidos até 1955, em 2026).
# Tradução tem direito próprio: só entra se o tradutor também tiver falecido até 1955, ou se o autor estiver
# na lista de autores de língua portuguesa já confirmados na importação do Gutenberg (texto original em português).
#
# O áudio NÃO é copiado: o Portal toca direto do Internet Archive (onde o LibriVox hospeda). Custo zero de Storage.
#
# Cloud Shell (pasta scripts):
#   python3 importar-librivox.py --listar     -> resumo do que entra e do que fica de fora
#   python3 importar-librivox.py --gravar     -> publica (pode rodar de novo: pula o que já existe)
import json, re, sys, time, datetime, unicodedata, urllib.request, urllib.parse

ANO_LIMITE = datetime.date.today().year - 71
UA = {"User-Agent": "PortalDoEducador-Biblioteca/1.0 (suporte@portaldoeducador.com.br)"}
API = "https://librivox.org/api/feed/audiobooks/"
ARGS = sys.argv[1:]

def norm(s):
    return re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()).split()

def get(url, tentativas=4):
    for t in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r: return json.load(r)
        except Exception as e:
            if t == tentativas - 1: raise
            time.sleep(5 * (t + 1))

def ano(v):
    m = re.search(r"-?\d{1,4}", str(v or ""))
    return int(m.group()) if m else None

# 1) todos os audiolivros (só id e idioma), depois os detalhes dos que estão em português
ids, off = [], 0
while True:
    d = get(API + "?" + urllib.parse.urlencode({"format": "json", "limit": 1000, "offset": off, "fields": "{id,language}"}))
    livros = d.get("books") or []
    if not livros: break
    ids += [b["id"] for b in livros if str(b.get("language", "")).strip().lower() in ("portuguese", "português", "portugues")]
    off += 1000; time.sleep(1)
print("LIBRIVOX EM PORTUGUÊS:", len(ids), flush=True)

# autores de língua portuguesa já confirmados (importação do Gutenberg em domínio público)
import firebase_admin
from firebase_admin import credentials, firestore
firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": "portal-educador-5"})
db = firestore.client()
lusofonos = [set(norm(d.to_dict().get("autor", ""))) for d in db.collection("biblioteca").where("origem", "==", "gutenberg").stream()]
def lusofono(a):
    sob = norm(a.get("last_name")); pre = norm(a.get("first_name"))
    return any(sob and set(sob) <= s and (not pre or pre[0] in s) for s in lusofonos)

def avaliar(b):
    autores = b.get("authors") or []
    if not autores: return "revisar", "sem autor"
    mortes = [ano(a.get("dod")) for a in autores]
    if any(m is None for m in mortes): return "revisar", "ano de morte do autor desconhecido"
    if max(mortes) > ANO_LIMITE: return "protegido", f"autor falecido em {max(mortes)}"
    trad = b.get("translators") or []
    if trad:
        mt = [ano(t.get("dod")) for t in trad]
        if any(m is None or m > ANO_LIMITE for m in mt): return "revisar", "tradução com tradutor sem data ou protegido"
        return "livre", f"autor e tradutor falecidos até {max(mortes + mt)}"
    if not all(lusofono(a) for a in autores): return "revisar", "possível tradução sem tradutor identificado"
    return "livre", f"autor(es) falecido(s) até {max(mortes)}"

itens = []
for i, id_ in enumerate(ids):
    try: b = (get(API + "?" + urllib.parse.urlencode({"format": "json", "id": id_, "extended": 1})).get("books") or [None])[0]
    except Exception as e: print("ERRO detalhes", id_, e); continue
    if not b: continue
    st, motivo = avaliar(b)
    itens.append((b, st, motivo)); time.sleep(0.5)
from collections import Counter
print("RESUMO:", dict(Counter(st for _, st, _ in itens)))
for b, st, motivo in sorted(itens, key=lambda x: (x[1], x[0]["title"])):
    print(f"{st:9} | {b['title'][:50]} | {', '.join((a.get('first_name','') + ' ' + a.get('last_name','')).strip() for a in b.get('authors') or [])[:40]} | {motivo}")
if "--gravar" not in ARGS: sys.exit(0)

def seg(v):
    try: return int(float(v))
    except Exception:
        p = [int(x) for x in str(v or "0").split(":") if x.isdigit()]
        return sum(x * 60 ** i for i, x in enumerate(reversed(p)))

ok = pulados = 0
for b, st, motivo in itens:
    if st != "livre": continue
    ref = db.document(f"biblioteca/lv-{b['id']}")
    if ref.get().exists: pulados += 1; continue
    secoes = sorted(b.get("sections") or [], key=lambda s: int(s.get("section_number") or 0))
    faixas = [{"t": (s.get("title") or f"Parte {k + 1}").strip()[:120], "url": re.sub(r"^http://", "https://", s.get("listen_url") or ""), "s": seg(s.get("playtime"))}
              for k, s in enumerate(secoes) if s.get("listen_url")]
    if not faixas: print("SEM ÁUDIO", b["title"]); continue
    leitores = []
    for s in secoes:
        for r in s.get("readers") or []:
            n = (r.get("display_name") or "").strip()
            if n and n not in leitores: leitores.append(n)
    autor = ", ".join((a.get("first_name", "") + " " + a.get("last_name", "")).strip() for a in b.get("authors") or [])
    capa = re.sub(r"^http://", "https://", b.get("coverart_jpg") or b.get("coverart_thumbnail") or "")
    ref.set({
        "titulo": re.sub(r"\s+", " ", b["title"]).strip()[:160], "autor": autor[:120], "etapa": "", "secao": "audiolivros", "tipo": "audio",
        "url": faixas[0]["url"], "faixas": faixas, "duracao": sum(f["s"] for f in faixas), "capa_url": capa, "paginas": [], "tamanho": 0,
        "narrador": (", ".join(leitores[:3]) + (" e outros" if len(leitores) > 3 else ""))[:160],
        "publicado": True, "origem": "librivox", "origem_id": str(b["id"]), "origem_url": b.get("url_librivox", ""),
        "licenca": {"tipo": "dominio-publico", "obs": f"Texto em domínio público no Brasil ({motivo}; Lei 9.610/98, art. 41). Gravação de voluntários do LibriVox, dedicada ao domínio público.",
                    "aprovado_por": "importacao-librivox", "aprovado_nome": "Importação em lote autorizada por Alan (23/10/2026)", "aprovado_em": firestore.SERVER_TIMESTAMP},
        "criado_em": firestore.SERVER_TIMESTAMP
    })
    ok += 1; print("OK", b["id"], b["title"][:50], len(faixas), "faixas", flush=True)
print(f"PRONTO: {ok} audiolivros publicados, {pulados} já existiam.")
