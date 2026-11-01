// Gera o PDF das fichas recriadas do acervo (Portal IA, modelo "acervo") no padrão impresso das Atividades:
// cabeçalho genérico para preencher à mão, página do professor separada e logotipo pequeno no rodapé.
// Sempre grava os PDFs em saida/ (o workflow publica no ramo fichas-candidatas para revisão).
// Com PUBLICAR=1, troca o PDF da atividade no acervo (o antigo fica guardado em url_original).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const req = createRequire(import.meta.url);
const { initializeApp, applicationDefault } = req('firebase-admin/app');
const { getFirestore, FieldValue } = req('firebase-admin/firestore');
const { getStorage } = req('firebase-admin/storage');
const sharp = req('sharp'), { jsPDF } = req('jspdf');
const { fichaPdf } = await import('./ficha-pdf.mjs');
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket(), PUBLICAR = process.env.PUBLICAR === '1';
const so = (process.env.SO || '').split(',').filter(Boolean);
const logoBuf = readFileSync(new URL('../assets/pde-logo-128.png', import.meta.url));
const logo = { url: 'data:image/png;base64,' + logoBuf.toString('base64'), w: 128, h: 128 };
mkdirSync('saida', { recursive: true });
const docs = (await db.collection('portal_ia_docs').where('modelo', '==', 'acervo').get()).docs.filter(d => !so.length || so.includes((d.data().origem_acervo || {}).id));
let ok = 0;
for (const d of docs) {
  const x = d.data(), atId = (x.origem_acervo || {}).id; if (!atId) continue;
  let imagem = null;
  const cam = (x.imagens && x.imagens.topo && x.imagens.topo.caminho) || x.imagem;
  if (cam) { try { const [b] = await bucket.file(cam).download(); const j = await sharp(b).flatten({ background: '#ffffff' }).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer(); const m = await sharp(j).metadata();
    imagem = { url: 'data:image/jpeg;base64,' + j.toString('base64'), w: m.width, h: m.height }; } catch (e) { console.log('::warning::imagem de ' + atId + ': ' + e.message); } }
  const bytes = Buffer.from(fichaPdf(jsPDF, { doc: x.doc, contexto: x.contexto || {}, imagem, logo }));
  writeFileSync(`saida/${atId}.pdf`, bytes); ok++;
  if (PUBLICAR) {
    const at = (await db.doc('atividades/' + atId).get()).data(); if (!at) continue;
    const base = `atividades/${at.etapa}/${atId}-v2`, tok = randomUUID(), tok2 = randomUUID();
    await bucket.file(base + '.pdf').save(bytes, { contentType: 'application/pdf', resumable: false, metadata: { cacheControl: 'public, max-age=3600', metadata: { firebaseStorageDownloadTokens: tok } } });
    execFileSync('pdftoppm', ['-r', '60', '-f', '1', '-l', '1', '-jpeg', `saida/${atId}.pdf`, `/tmp/mini-${atId}`]);
    const mini = await sharp(`/tmp/mini-${atId}-1.jpg`).resize({ width: 480 }).jpeg({ quality: 80 }).toBuffer();
    await bucket.file(base + '-mini.jpg').save(mini, { contentType: 'image/jpeg', resumable: false, metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: tok2 } } });
    const url = p => `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(p)}?alt=media&token=`;
    await db.doc('atividades/' + atId).update({ url: url(base + '.pdf') + tok, mini_url: url(base + '-mini.jpg') + tok2, formato: 'pdf', titulo: String(x.doc.titulo || at.titulo).slice(0, 160),
      url_original: at.url_original || at.url, mini_original: at.mini_original || at.mini_url || '', versao: 2, modelo_pia: d.id, bncc: (x.doc.bncc || []).map(b => b.codigo).filter(Boolean).slice(0, 12), atualizado_em: FieldValue.serverTimestamp() });
    console.log('::notice::publicada no acervo: ' + x.doc.titulo);
  }
}
console.log('::notice::' + ok + ' ficha(s) em PDF' + (PUBLICAR ? ' e trocadas no acervo' : ' para revisão (ramo fichas-candidatas)'));
