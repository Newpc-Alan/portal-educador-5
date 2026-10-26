// Inventário só de leitura: o que é da Rede Modelo (demonstração) e o que é real, por coleção.
// Uso no Cloud Shell:  cd functions && node ../scripts/inventario-dados.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldPath } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const cont = async q => (await q.count().get()).data().count;
const COLS = ['municipios', 'escolas', 'turmas', 'alunos', 'alunos_ficha', 'alunos_familia', 'alunos_saude', 'alunos_autorizados', 'servidores', 'usuarios', 'pre_cadastros',
  'freq_chamadas', 'freq_entradas', 'freq_resumo', 'busca_ativa', 'avaliacoes', 'respostas', 'provas_online', 'notas_planilhas', 'cal_rede', 'cal_escola', 'acessos_dia', 'tv_telas'];
console.log('COLEÇÃO | TOTAL | DEMO (id demo- ou Rede Modelo) | REAL');
for (const c of COLS) {
  try {
    const tot = await cont(db.collection(c));
    const porId = await cont(db.collection(c).where(FieldPath.documentId(), '>=', 'demo-').where(FieldPath.documentId(), '<', 'demo.'));
    let porMuni = 0; try { porMuni = await cont(db.collection(c).where('municipio_id', '==', 'demo-rede')); } catch (e) {}
    const demo = Math.max(porId, porMuni);
    console.log(c.padEnd(18), String(tot).padStart(6), String(demo).padStart(6), String(tot - demo).padStart(6));
  } catch (e) { console.log(c, 'erro', e.code || e.message); }
}
console.log('\n--- Municípios ---'); (await db.collection('municipios').get()).forEach(d => console.log(d.id, '|', d.data().nome, d.data().demo ? '(demo)' : ''));
console.log('\n--- Escolas fora da Rede Modelo ---'); (await db.collection('escolas').get()).forEach(d => { const e = d.data(); if (e.municipio_id !== 'demo-rede') console.log(d.id, '|', e.nome, '|', e.municipio_id); });
console.log('\n--- Turmas fora da Rede Modelo ---'); (await db.collection('turmas').get()).forEach(d => { const t = d.data(); if (t.municipio_id !== 'demo-rede' && !d.id.startsWith('demo-')) console.log(d.id, '|', t.nome, '|', t.escola_nome || t.escola_id); });
console.log('\n--- Usuários reais (perfil, nome, e-mail) ---'); (await db.collection('usuarios').get()).forEach(d => { const u = d.data(); if (!u.demo && !d.id.startsWith('demo-')) console.log(u.perfil, '|', u.nome, '|', u.email, '|', u.municipio_id || '-'); });
process.exit(0);
