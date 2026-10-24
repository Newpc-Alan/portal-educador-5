#!/usr/bin/env python3
# Gera capa (PNG quadrado, visual do Portal) para os audiolivros do LibriVox que não têm capa e grava em capa_url.
# Cloud Shell (pasta scripts): python3 capas-audiolivros.py
import uuid, urllib.parse, fitz, firebase_admin
from firebase_admin import credentials, firestore, storage
firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": "portal-educador-5", "storageBucket": "portal-educador-5.firebasestorage.app"})
db, bucket = firestore.client(), storage.bucket()

def capa(titulo, autor, arq):
    doc = fitz.open(); L = 480; pg = doc.new_page(width=L, height=L)
    pg.draw_rect(pg.rect, color=None, fill=(0.047, 0.137, 0.22))
    pg.draw_circle(fitz.Point(L - 70, 80), 150, color=None, fill=(0.149, 0.443, 0.671))
    pg.draw_rect(fitz.Rect(0, L - 12, L, L), color=None, fill=(0.553, 0.776, 0.247))
    pg.draw_rect(fitz.Rect(36, 120, 96, 125), color=None, fill=(0.553, 0.776, 0.247))
    pg.insert_textbox(fitz.Rect(36, 50, L - 36, 100), "AUDIOLIVRO · PORTAL DO EDUCADOR", fontsize=11, fontname="helv", color=(0.553, 0.776, 0.247))
    pg.insert_textbox(fitz.Rect(36, 140, L - 36, 360), titulo, fontsize=34 if len(titulo) < 28 else 26 if len(titulo) < 60 else 20, fontname="tibo", color=(1, 1, 1), lineheight=1.12)
    pg.insert_textbox(fitz.Rect(36, 370, L - 36, 440), autor, fontsize=16, fontname="helv", color=(0.82, 0.88, 0.93))
    pg.get_pixmap(matrix=fitz.Matrix(1.25, 1.25)).save(arq)

n = 0
for d in db.collection("biblioteca").where("origem", "==", "librivox").stream():
    x = d.to_dict()
    if x.get("capa_url"): continue
    arq = f"/tmp/capa-{d.id}.png"; capa(x["titulo"], x.get("autor", ""), arq)
    caminho = f"biblioteca/audiolivros/{d.id}-capa.png"; tok = str(uuid.uuid4()); b = bucket.blob(caminho)
    b.metadata = {"firebaseStorageDownloadTokens": tok}; b.cache_control = "public, max-age=31536000"
    b.upload_from_filename(arq, content_type="image/png")
    d.reference.update({"capa_url": f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{urllib.parse.quote(caminho, safe='')}?alt=media&token={tok}"})
    n += 1
print("CAPAS GERADAS:", n)
