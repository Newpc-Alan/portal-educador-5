// Grade das turmas: a Secretaria da escola ou a Direção diz qual professor dá qual disciplina em cada turma
// (turmas/{id}.grade = [{ disciplina, disc_id, professor_uid, professor_nome, dias }]). A grade é gravada direto no Firestore
// pela equipe da escola (regra em firestore.rules); esta função só entrega a lista de professores da escola para o seletor,
// porque a equipe não lê o cadastro dos professores (só nome e e-mail saem daqui).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const escolasDe = u => [...new Set([...(Array.isArray(u.escolas_ids) ? u.escolas_ids : []), u.escola_id].filter(Boolean))];

export function podeVerProfessores(eu, escola) {
  if (!eu || eu.status !== 'ativo' || !escola) return false;
  if (eu.perfil === 'admin') return true;
  if (['gestor', 'secretaria_escolar'].includes(eu.perfil)) return escolasDe(eu).includes(escola.id);
  if (eu.perfil === 'secretaria') return !!eu.municipio_id && eu.municipio_id === escola.municipio_id;
  return false;
}

export const professoresDaEscola = onCall({ region: 'southamerica-east1', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const escolaId = String((req.data || {}).escola_id || '');
  if (!ID.test(escolaId)) throw new HttpsError('invalid-argument', 'Escola inválida.');
  const db = getFirestore();
  const [es, ee] = await Promise.all([db.doc(`usuarios/${req.auth.uid}`).get(), db.doc(`escolas/${escolaId}`).get()]);
  if (!ee.exists) throw new HttpsError('not-found', 'Escola não encontrada.');
  if (!podeVerProfessores(es.data(), { id: escolaId, ...ee.data() })) throw new HttpsError('permission-denied', 'Você não pode ver os professores desta escola.');
  const [a, b] = await Promise.all([
    db.collection('usuarios').where('escolas_ids', 'array-contains', escolaId).get(),
    db.collection('usuarios').where('escola_id', '==', escolaId).get()
  ]);
  const vistos = new Map();
  [...a.docs, ...b.docs].forEach(d => { const u = d.data(); if (u.perfil === 'professor' && u.status === 'ativo' && !vistos.has(d.id))
    vistos.set(d.id, { uid: d.id, nome: String(u.nome || '').slice(0, 80), email: String(u.email || '').slice(0, 120) }); });
  return { professores: [...vistos.values()].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')) };
});
