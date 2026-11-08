// Formação Continuada · acompanhamento (nov/2026, Fase 3 da integração):
// quem começou, quem parou no meio, quem concluiu e quem ainda não começou, com cursos em andamento, certificados e horas.
// Quem vê: administrador (todas as redes ou um município), Secretaria de Educação (o próprio município) e Direção (as escolas dela).
// Nome do professor aparece porque é a equipe de quem consulta; CPF e e-mail não saem daqui (só o admin vê o e-mail).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

const PARADO_DIAS = 14;
const msISO = s => { const t = Date.parse(s || ''); return isNaN(t) ? 0 : t; };
const msTs = v => v && typeof v.toMillis === 'function' ? v.toMillis() : 0;

// situação de cada cursista (uid -> { situacao, iniciados, concluidos, andamento:[{c,pct,ult}], ultimo })
export async function situacoesFormacao(db, uids) {
  const out = {};
  const marcar = (uid, d) => {
    const x = out[uid] = out[uid] || { iniciados: 0, concluidos: 0, andamento: [], concl: [], ultimo: 0 };
    const p = d.data(), ult = Math.max(msISO(p.ultimoAcessoISO), msTs(p.atualizadoEm));
    x.iniciados++; x.ultimo = Math.max(x.ultimo, ult);
    if (p.concluido === true) { x.concluidos++; x.concl.push(d.id); } else x.andamento.push({ c: d.id, pct: Number(p.percentual || 0), ult });
  };
  if (uids === null) (await db.collectionGroup('progresso').get()).forEach(d => { const u = d.ref.parent.parent; if (u && u.parent.id === 'users') marcar(u.id, d); });
  else for (let i = 0; i < uids.length; i += 20) await Promise.all(uids.slice(i, i + 20).map(async uid => (await db.collection(`users/${uid}/progresso`).get()).forEach(d => marcar(uid, d))));
  const agora = Date.now();
  for (const x of Object.values(out)) x.situacao = x.andamento.length ? (agora - x.ultimo > PARADO_DIAS * 864e5 ? 'parado' : 'em_andamento') : x.concluidos ? 'concluiu' : 'em_andamento';
  return out;
}

// monta o acompanhamento no escopo de quem consulta; comCursos: devolve também cursos e conclusões por pessoa (para o relatório da Secretaria)
export async function montarAcompanhamento(db, uid, dados, comCursos = false) {
  const eu = (await db.doc(`usuarios/${uid}`).get()).data();
  if (!eu || eu.status !== 'ativo' || !['admin', 'secretaria', 'gestor'].includes(eu.perfil)) throw new HttpsError('permission-denied', 'Acesso restrito à gestão.');
  let mun = '', escolas = null;
  if (eu.perfil === 'admin') mun = /^[A-Za-z0-9_-]{1,64}$/.test(String((dados || {}).municipio_id || '')) ? String(dados.municipio_id) : '';
  else { mun = String(eu.municipio_id || ''); if (!mun) throw new HttpsError('failed-precondition', 'Seu cadastro não está ligado a uma rede de ensino.'); }
  if (eu.perfil === 'gestor') escolas = new Set((eu.escolas_ids && eu.escolas_ids.length ? eu.escolas_ids : [eu.escola_id]).filter(Boolean));
  const naEscola = x => !escolas || [x.escola_id, ...(x.escolas_ids || [])].some(id => escolas.has(id));
  // professores do escopo (cadastro do Portal) e perfis da Formação
  const qProf = mun ? db.collection('usuarios').where('municipio_id', '==', mun) : db.collection('usuarios').where('perfil', '==', 'professor');
  const profs = (await qProf.get()).docs.filter(d => { const x = d.data(); return x.perfil === 'professor' && x.status === 'ativo' && naEscola(x); });
  const qUs = mun ? db.collection('users').where('municipio_id', '==', mun) : db.collection('users');
  const users = (await qUs.get()).docs.filter(d => naEscola(d.data()));
  const uids = [...new Set([...profs.map(d => d.id), ...users.map(d => d.id)])];
  const sit = await situacoesFormacao(db, mun ? uids : null);
  // certificados e nomes dos cursos
  const cert = {};
  for (let i = 0; i < uids.length; i += 30) (await db.collection('certificados').where('uid', 'in', uids.slice(i, i + 30)).get()).forEach(d => {
    const c = d.data(); if (c.ativo === false) return; const x = cert[c.uid] = cert[c.uid] || { n: 0, horas: 0 }; x.n++; x.horas += Number(c.cargaHoraria || 0); });
  const cursos = {}, cursosDoc = {}; (await db.collection('cursos').get()).forEach(d => { cursos[d.id] = String(d.data().titulo || 'Curso').slice(0, 80); if (comCursos) cursosDoc[d.id] = d.data(); });
  const escNome = {}, munNome = {};
  const escIds = new Set(), munIds = new Set();
  const porUid = {}; profs.forEach(d => porUid[d.id] = { p: d.data() }); users.forEach(d => { (porUid[d.id] = porUid[d.id] || {}).f = d.data(); });
  Object.values(porUid).forEach(o => { const x = o.p || o.f || {}; if (x.escola_id) escIds.add(x.escola_id); if (x.municipio_id) munIds.add(x.municipio_id); });
  await Promise.all([...escIds].slice(0, 300).map(async id => { const e = (await db.doc(`escolas/${id}`).get()).data(); escNome[id] = e ? e.nome || id : id; }));
  await Promise.all([...munIds].slice(0, 100).map(async id => { const m = (await db.doc(`municipios/${id}`).get()).data(); munNome[id] = m ? [m.nome, m.uf].filter(Boolean).join('/') : id; }));
  const linhas = uids.map(uid => {
    const o = porUid[uid] || {}, x = o.p || o.f || {}, s = sit[uid], c = cert[uid] || { n: 0, horas: 0 };
    const situacao = s ? (s.concluidos && !s.andamento.length ? 'concluiu' : s.situacao) : (c.n ? 'concluiu' : 'nao_comecou');
    return { nome: String(x.nome || (o.f && o.f.nome) || '-').slice(0, 120), email: eu.perfil === 'admin' ? String(x.email || '').slice(0, 120) : '',
      escola: escNome[x.escola_id] || (o.f && o.f.escola) || '-', municipio: munNome[x.municipio_id] || (o.f && o.f.municipio) || '-',
      situacao, iniciados: s ? s.iniciados : 0, concluidos: s ? s.concluidos : 0, certificados: c.n, horas: c.horas, ultimo: s && s.ultimo ? s.ultimo : 0,
      andamento: s ? s.andamento.sort((a, b) => b.ult - a.ult).slice(0, 3).map(a => ({ titulo: cursos[a.c] || 'Curso', pct: a.pct })) : [],
      ...(comCursos ? { _andamentoIds: s ? s.andamento.map(a => a.c) : [], _concluidosIds: s ? s.concl : [] } : {}) };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 3000);
  const cont = k => linhas.filter(l => l.situacao === k).length;
  return { ...(comCursos ? { _cursos: cursosDoc, _munNome: mun ? munNome[mun] || '' : '' } : {}), gerado_em: Date.now(), escopo: eu.perfil === 'gestor' ? 'escola' : mun ? 'municipio' : 'todas', parado_dias: PARADO_DIAS,
    totais: { pessoas: linhas.length, nao_comecou: cont('nao_comecou'), em_andamento: cont('em_andamento'), parado: cont('parado'), concluiu: cont('concluiu'),
      certificados: linhas.reduce((t, l) => t + l.certificados, 0), horas: linhas.reduce((t, l) => t + l.horas, 0) }, linhas };
}

export const formacaoAcompanhamento = onCall({ region: 'southamerica-east1', timeoutSeconds: 120, memory: '512MiB' }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  return montarAcompanhamento(getFirestore(), req.auth.uid, req.data || {});
});
