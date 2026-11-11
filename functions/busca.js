// Busca geral do Início (nov/2026).
// 1) Índice: os catálogos publicados (vídeos, jogos, atividades, biblioteca, colorir e acervo NEWPC) viram poucos
//    documentos compactos em busca_indice/{parte}. O professor lê o índice uma vez (na primeira busca) e procura no
//    próprio aparelho, sem baixar milhares de documentos. Refeito a cada 2 horas, das 6h às 22h.
//    Leitura: quem pode ler os catálogos (licenciado), pela regra do banco. Ninguém grava pelo navegador.
// 2) Estatística: o que a rede procura, AGREGADO e SEM identificar a pessoa (LGPD: minimização). Grava só o termo
//    normalizado e contadores em buscas_mes/{AAAA-MM} (geral e por município). Expira em 13 meses (TTL em expira_em).
//    Por decisão de privacidade, a busca de cada pessoa NÃO vai para a auditoria (é leitura, não muda dado;
//    a entrada na tela já é registrada pelo registrarEntrada).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { expiraAuditoria } from './auditoria.js';

const REGIAO = 'southamerica-east1';
const LIMITE_PARTE = 700 * 1024;   // folga abaixo de 1 MB por documento
const corta = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const lista = v => (Array.isArray(v) ? v : []).map(x => corta(x, 30)).filter(Boolean);

// uma linha compacta por conteúdo: c=coleção, i=id, t=título, s=linha de apoio, k=palavras extras, b=BNCC, m=módulo do plano, g=imagem, sc=estante da biblioteca
function linha(c, id, x) {
  const base = { c, i: id, t: corta(x.titulo || x.nome, 140) };
  if (!base.t) return null;
  if (c === 'videos' || c === 'jogos') {
    if (x.para_professores === false) return null;
    Object.assign(base, { s: corta([x.componente, (x.series || []).slice(0, 3).join(', ')].filter(Boolean).join(' · '), 80),
      k: corta([x.tema, x.canal, x.componente, (x.series || []).join(' '), String(x.descricao || '').slice(0, 90)].join(' '), 200), b: lista(x.bncc), m: c,
      g: c === 'videos' ? (x.youtube_id ? 'yt:' + corta(x.youtube_id, 20) : '') : corta(x.capa, 300), u: c === 'jogos' ? corta(x.url, 200) : '' });
  } else if (c === 'atividades') {
    Object.assign(base, { s: corta([x.tipo === 'plano' ? 'Plano de aula' : 'Atividade', x.componente, (x.anos || []).join(', ')].filter(Boolean).join(' · '), 80),
      k: corta([x.componente, x.categoria, x.etapa, (x.anos || []).join(' '), x.tipo === 'plano' ? 'plano de aula' : ''].join(' '), 160), b: lista(x.bncc), m: 'atividades', g: corta(x.mini_url, 300) });
  } else if (c === 'biblioteca') {
    const hist = x.secao === 'historias';
    Object.assign(base, { s: corta(hist ? 'História educativa' : (x.autor || 'Livro'), 80), k: corta([x.autor, x.etapa, x.secao, hist ? 'historia' : 'livro'].join(' '), 160),
      m: hist ? 'historias' : 'biblioteca', g: corta(x.capa_url, 300), sc: corta(x.secao, 20) });   // sc: estante (o aluno só abre Aprender brincando, Gibiteca e Histórias)
  } else if (c === 'colorir') {
    Object.assign(base, { s: corta(x.colecao || 'Desenho para colorir', 80), k: corta([x.colecao, 'colorir desenho pintar'].join(' '), 120), m: 'colorir', g: corta(x.thumb_url, 300) });
  } else if (c === 'cursos') {
    Object.assign(base, { s: corta(['Curso da Formação Continuada', x.horas ? x.horas + ' h' : '', x.nivel].filter(Boolean).join(' · '), 80),
      k: corta([x.resumo, String(x.descricao || '').slice(0, 160), 'formacao curso certificado'].join(' '), 220), m: 'formacao', g: corta(x.capaURL, 300) });
  } else if (c === 'acervo') {
    Object.assign(base, { s: corta([x.disciplina, (x.etapas || []).join(', ')].filter(Boolean).join(' · ') || 'Arquivo', 80),
      k: corta([x.disciplina, (x.etapas || []).join(' '), String(x.descricao || '').slice(0, 160)].join(' '), 220), b: lista(x.bncc), m: corta(x.modulo, 30) });
  }
  // imagem do Storage: guarda só o caminho e o token (o navegador remonta a URL); economiza ~40% do índice
  if (base.g) base.g = base.g.replace(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[a-z0-9-]+\.firebasestorage\.app\/o\//, 'fs:').replace('?alt=media&token=', '|');
  for (const k of Object.keys(base)) if (base[k] === '' || (Array.isArray(base[k]) && !base[k].length)) delete base[k];
  return base;
}

export async function montarIndiceBusca(db) {
  const COLECOES = ['videos', 'jogos', 'atividades', 'biblioteca', 'colorir', 'acervo'];
  const todas = [], por = {};
  for (const c of COLECOES.concat(['cursos'])) {
    // cursos da Formação usam status 'publicado' (os demais catálogos, publicado: true)
    const sn = c === 'cursos' ? await db.collection(c).where('status', '==', 'publicado').get() : await db.collection(c).where('publicado', '==', true).get();
    // curso exclusivo de uma rede não entra na busca de todos
    let n = 0; sn.forEach(d => { if (c === 'cursos' && d.data().exclusivo === true) return; const l = linha(c, d.id, d.data()); if (l) { todas.push(l); n++; } });
    por[c] = n;
  }
  // divide em partes de até ~700 KB
  const partes = []; let atual = [], tam = 0;
  for (const l of todas) { const t = Buffer.byteLength(JSON.stringify(l)); if (tam + t > LIMITE_PARTE && atual.length) { partes.push(atual); atual = []; tam = 0; } atual.push(l); tam += t; }
  if (atual.length) partes.push(atual);
  return { partes, por, total: todas.length, bytes: Buffer.byteLength(JSON.stringify(todas)) };
}

export async function gravarIndiceBusca(db, r) {
  const ids = r.partes.map((_, i) => 'p' + String(i + 1).padStart(2, '0'));
  const lote = db.batch();
  r.partes.forEach((itens, i) => lote.set(db.doc('busca_indice/' + ids[i]), { itens, n: itens.length }));
  lote.set(db.doc('busca_indice/_meta'), { partes: ids, por: r.por, total: r.total, bytes: r.bytes, atualizado_em: FieldValue.serverTimestamp() });
  await lote.commit();
  // partes que sobraram de um índice maior
  const velhas = await db.collection('busca_indice').get();
  const sobra = velhas.docs.filter(d => d.id !== '_meta' && !ids.includes(d.id));
  if (sobra.length) { const b = db.batch(); sobra.forEach(d => b.delete(d.ref)); await b.commit(); }
  return ids;
}

export const indiceBusca = onSchedule({ region: REGIAO, schedule: '15 6-22/2 * * *', timeZone: 'America/Campo_Grande', timeoutSeconds: 300, memory: '512MiB' }, async () => {
  const db = getFirestore();
  const r = await montarIndiceBusca(db);
  await gravarIndiceBusca(db, r);
  console.log('índice da busca: ' + r.total + ' conteúdos, ' + Math.round(r.bytes / 1024) + ' KB, ' + r.partes.length + ' parte(s)');
});

// termo normalizado: minúsculas, sem acento, só letras, números e espaço; números longos (CPF, telefone, matrícula) não entram
export function normalizarTermo(s) {
  let t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (/\d{5,}/.test(t.replace(/ /g, ''))) return '';
  return t.length >= 3 ? t : '';
}
const chaveCampo = t => t.replace(/ /g, '_');   // o caminho do campo não aceita espaço sem escapar

export const registrarBusca = onCall({ region: REGIAO, maxInstances: 10, timeoutSeconds: 10 }, async req => {
  const uid = req.auth && req.auth.uid; if (!uid) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const termo = normalizarTermo(req.data && req.data.termo); if (!termo) return { ok: false };
  const achou = Math.max(0, Math.min(999, parseInt(req.data && req.data.resultados, 10) || 0));
  const clicou = !!(req.data && req.data.clicou);
  const db = getFirestore();
  const u = (await db.doc('usuarios/' + uid).get()).data() || {};
  if (u.status !== 'ativo' || u.perfil === 'aluno') return { ok: false };
  const mun = String(u.municipio_id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'sem_municipio';
  const perfil = ['professor', 'gestor', 'secretaria', 'admin'].includes(u.perfil) ? u.perfil : 'outro';
  const agora = new Date(Date.now() - 4 * 3600e3), mes = agora.toISOString().slice(0, 7);
  const k = chaveCampo(termo), inc = FieldValue.increment(1);
  const soma = { n: inc }; if (!achou) soma.zero = inc; if (clicou) soma.clique = inc;
  await db.doc('buscas_mes/' + mes).set({
    mes, total: inc, [perfil]: inc, expira_em: Timestamp.fromMillis(Date.now() + 400 * 86400000), atualizado_em: FieldValue.serverTimestamp(),
    termos: { [k]: soma }, por_mun: { [mun]: { total: inc, termos: { [k]: soma } } }
  }, { merge: true });
  return { ok: true };
});

// o administrador refaz o índice na hora (ex.: logo depois de publicar muitos conteúdos)
export const atualizarIndiceBusca = onCall({ region: REGIAO, maxInstances: 2, timeoutSeconds: 300, memory: '512MiB' }, async req => {
  const uid = req.auth && req.auth.uid; if (!uid) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const db = getFirestore();
  const u = (await db.doc('usuarios/' + uid).get()).data() || {};
  if (u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Só o administrador.');
  const r = await montarIndiceBusca(db);
  await gravarIndiceBusca(db, r);
  await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'alterou', origem: 'funcao', colecao: 'busca_indice', doc: '_meta',
    autor_uid: uid, autor_tipo: 'usuario', autor_email: String(req.auth.token.email || '').slice(0, 120), perfil: 'admin', detalhe: 'Atualizou o índice da busca geral (' + r.total + ' conteúdos)', campos: [], valores: {} });
  return { total: r.total, por: r.por, kb: Math.round(r.bytes / 1024) };
});
