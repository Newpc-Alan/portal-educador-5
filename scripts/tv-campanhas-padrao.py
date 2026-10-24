#!/usr/bin/env python3
# Portal do Educador TV: cria as campanhas educativas padrão (só se ainda não existirem).
# Passam em todas as TVs, uma a cada 4 itens da escola, nos meses marcados (lista vazia = o ano todo).
# Depois de criadas, o administrador edita, troca imagens e pausa pelo painel (aba Campanhas).
# Cloud Shell (pasta scripts): python3 tv-campanhas-padrao.py
import firebase_admin
from firebase_admin import credentials, firestore
firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": "portal-educador-5"})
db = firestore.client()
VERDE, AMARELO, ROSA = "#43A047", "#F9A825", "#E91E63"
CAMPANHAS = [
  dict(id="dengue-1", categoria="Combate à dengue", cor=VERDE, meses=[], titulo="10 minutos por semana contra a dengue",
       texto="Uma vez por semana, elimine a água parada: vire garrafas e baldes, tampe a caixa-d'água, limpe as calhas e coloque areia nos pratinhos das plantas. O mesmo mosquito transmite zika e chikungunya."),
  dict(id="transito-1", categoria="Educação no trânsito", cor=AMARELO, meses=[], titulo="Atravesse com segurança",
       texto="Use sempre a faixa de pedestres, olhe para os dois lados e espere os carros pararem. Na entrada e na saída da escola, segure a mão das crianças."),
  dict(id="outubro-rosa-1", categoria="Outubro Rosa", cor=ROSA, meses=[10], titulo="Cuidar de si é um ato de amor",
       texto="O diagnóstico precoce aumenta muito as chances de cura do câncer de mama. Converse com a equipe da unidade de saúde sobre a mamografia e os exames indicados para a sua idade."),
  dict(id="dengue-2", categoria="Combate à dengue", cor=VERDE, meses=[], titulo="Febre alta e dor no corpo?",
       texto="Febre, dor atrás dos olhos, dor no corpo e manchas na pele podem ser dengue. Procure a unidade de saúde, beba bastante água e não tome remédio por conta própria."),
  dict(id="transito-2", categoria="Educação no trânsito", cor=AMARELO, meses=[], titulo="Criança no carro vai no banco de trás",
       texto="Crianças com menos de 10 anos que ainda não chegaram a 1,45 m viajam no banco traseiro, com cadeirinha ou assento de elevação. Cinto de segurança em todos, sempre."),
  dict(id="outubro-rosa-2", categoria="Outubro Rosa", cor=ROSA, meses=[10], titulo="Conheça o seu corpo",
       texto="Observe as mamas no dia a dia. Caroço, mudança na pele ou no mamilo e saída de líquido são sinais para procurar a unidade de saúde. Homens também podem ter câncer de mama."),
]
ref = db.document("tv_campanhas/padrao")
snap = ref.get()
atuais = (snap.to_dict() or {}).get("itens", []) if snap.exists else []
ids = {c.get("id") for c in atuais}
novas = [{**c, "duracao": 15, "layout": "split", "ativo": True, "imagem_url": "", "path": ""} for c in CAMPANHAS if c["id"] not in ids]
if not novas:
    print("CAMPANHAS: nada a criar, já existem", len(atuais)); raise SystemExit
ref.set({"itens": atuais + novas, "atualizado_em": firestore.SERVER_TIMESTAMP, "atualizado_por": "script-campanhas-padrao"}, merge=True)
print("CAMPANHAS CRIADAS:", len(novas), "· total:", len(atuais) + len(novas))
