#!/usr/bin/env python3
# Publica na Gibiteca o gibi próprio "Turma do Pantanal: Pra onde vai a água?".
# As páginas ficam no próprio site (GitHub Pages), sem custo de Storage. Pode rodar de novo: só atualiza o documento.
# Cloud Shell (pasta scripts/gibis): python3 publicar.py
import firebase_admin
from firebase_admin import credentials, firestore
firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": "portal-educador-5"})
db = firestore.client()
BASE = "https://app.portaldoeducador.com.br/assets/gibis/turma-do-pantanal/ciclo-da-agua/v2/"
paginas = [f"{BASE}p{i:02d}.webp" for i in range(9)]
ref = db.document("biblioteca/newpc-gibi-agua")
novo = not ref.get().exists
dados = {
    "titulo": "Turma do Pantanal: Pra onde vai a água?", "autor": "NEWPC · Portal do Educador", "etapa": "5º ano",
    "secao": "gibiteca", "tipo": "imagens", "url": "", "paginas": paginas, "capa_url": paginas[0], "tamanho": 0,
    "resumo": "Bento, a capivara, leva a turma da Professora Clara para descobrir o ciclo da água no Pantanal: evaporação, transpiração, condensação, precipitação e infiltração. Ciências, 5º ano, BNCC EF05CI02.",
    "publicado": True, "origem": "newpc", "serie": "Turma do Pantanal",
    "licenca": {"tipo": "propria", "obs": "Personagens e roteiro originais da NEWPC Tecnologia (Turma do Pantanal). Ilustrações geradas por IA (ChatGPT) sob direção da NEWPC; textos e montagem próprios.",
                "aprovado_por": "producao-newpc", "aprovado_nome": "Produção própria autorizada por Alan (23/10/2026)", "aprovado_em": firestore.SERVER_TIMESTAMP},
    "atualizado_em": firestore.SERVER_TIMESTAMP,
}
if novo: dados["criado_em"] = firestore.SERVER_TIMESTAMP
ref.set(dados, merge=True)
print("GIBI", "PUBLICADO" if novo else "ATUALIZADO", ref.id, len(paginas), "páginas")
