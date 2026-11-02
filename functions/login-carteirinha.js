// Auditoria da entrada pela carteirinha (nov/2026)
// Quando a escola liga "foto ao entrar com a carteirinha", o aluno que entra no Portal pela carteirinha (QR "PDEA:", sem senha)
// tem uma foto pequena tirada pela câmera da frente. Finalidade única: conferir se quem entrou é o dono da carteirinha.
//   - Foto no cofre da portaria (bucket só de fotos, São Paulo, sem link público), pasta portaria/{escola}/{dia}/login-..., apagada em 15 dias
//     pela mesma rotina da portaria (limparFotosPortaria) e pelo TTL do registro (login_carteirinha.expira_em).
//   - Quem vê: o professor da aula da turma e a direção da escola (e o administrador). Toda abertura da foto vai para a auditoria.
//   - "Não é este aluno": derruba a sessão daquele aluno (revoga o login e avisa a tela dele pela aula da turma) e registra.
//   - Sem foto (câmera falhou ou foi recusada): entra mesmo assim e a lista mostra "sem foto".
// Nada disso é lido ou gravado pelo navegador: só por esta função (regras: login_carteirinha e escola_config fechados).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { expiraAuditoria } from './auditoria.js';
import { BUCKET_PORTARIA, RETENCAO_FOTOS_DIAS } from './portaria.js';

const REGIAO = 'southamerica-east1';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const horaMS = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()).replace(/:/g, '');

// JPEG pequeno em base64 (a tela manda 320 x 240): até ~80 KB
export function fotoOk(b64) {
  if (typeof b64 !== 'string' || b64.length < 200 || b64.length > 110000 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return false;
  const b = Buffer.from(b64.slice(0, 8), 'base64'); return b[0] === 0xFF && b[1] === 0xD8;
}

export async function fotoLoginLigada(db, escolaId) {
  if (!ID.test(String(escolaId || ''))) return false;
  return ((await db.doc(`escola_config/${escolaId}`).get()).data() || {}).foto_login_carteirinha === true;
}

// chamado pela entrada por QR (acesso-aluno.js) quando o aluno entra pela carteirinha
export async function registrarLoginCarteirinha({ db, alunoId, acesso, foto, falhou, ua }) {
  const al = (await db.doc(`alunos/${alunoId}`).get()).data() || {};
  const escola = String(al.escola_id || acesso.escola_id || ''), dia = hojeMS(), hora = horaMS();
  let caminho = '';
  if (fotoOk(foto) && ID.test(escola)) {
    caminho = `portaria/${escola}/${dia}/login-${alunoId}-${hora}.jpg`;
    await getStorage().bucket(BUCKET_PORTARIA).file(caminho).save(Buffer.from(foto, 'base64'), { contentType: 'image/jpeg', resumable: false,
      metadata: { cacheControl: 'private, max-age=600', metadata: { dia, aluno: alunoId, origem: 'login-carteirinha' } } }).catch(e => { console.error('foto login:', e.message); caminho = ''; });
  }
  await db.collection('login_carteirinha').add({ aluno_id: alunoId, nome: String(al.nome_social || al.nome || acesso.nome || 'Aluno').slice(0, 80),
    turma_id: String(acesso.turma_id || al.turma_id || ''), escola_id: escola, municipio_id: String(al.municipio_id || ''), dia, em: FieldValue.serverTimestamp(),
    foto: caminho, sem_foto: caminho ? '' : (falhou ? 'camera' : 'nao_enviada'), aparelho: String(ua || '').slice(0, 120), contestado: false,
    expira_em: Timestamp.fromMillis(Date.now() + RETENCAO_FOTOS_DIAS * 864e5) });
}

// quem pode ver/contestar: administrador, direção da escola, ou o professor que abriu a aula da turma (ou que tem a turma)
async function podeVer(db, uid, reg) {
  const eu = (await db.doc(`usuarios/${uid}`).get()).data() || {};
  if (eu.status !== 'ativo') return null;
  if (eu.perfil === 'admin') return eu;
  const escolas = new Set([eu.escola_id, ...(eu.escolas_ids || [])].filter(Boolean));
  if (eu.perfil === 'gestor' && reg.escola_id && escolas.has(reg.escola_id)) return eu;
  if (eu.perfil === 'professor' && reg.turma_id) {
    if ((eu.turmas_ids || []).includes(reg.turma_id)) return eu;
    const aula = (await db.doc(`qr_aulas/${reg.turma_id}`).get()).data() || {};
    if (aula.por === uid) return eu;
  }
  return null;
}
const audita = (db, uid, eu, acao, detalhe, alvo) => db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao, origem: 'funcao', colecao: 'login_carteirinha', doc: alvo || '',
  autor_uid: uid, autor_tipo: 'usuario', perfil: eu.perfil || '', detalhe: String(detalhe).slice(0, 300), campos: [], valores: {} });

export const loginCarteirinha = onCall({ region: REGIAO, maxInstances: 10, timeoutSeconds: 30 }, async req => {
  const uid = req.auth && req.auth.uid; if (!uid) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const d = req.data || {}, db = getFirestore(), acao = String(d.acao || '');

  // direção da escola liga ou desliga a foto (e consulta como está)
  if (acao === 'config' || acao === 'config_ver') {
    const esc = String(d.escola_id || ''); if (!ID.test(esc)) throw new HttpsError('invalid-argument', 'Escola inválida.');
    const eu = await podeVer(db, uid, { escola_id: esc });
    if (!eu || !['admin', 'gestor'].includes(eu.perfil)) throw new HttpsError('permission-denied', 'Só a direção da escola liga ou desliga.');
    if (acao === 'config') {
      const ligar = d.ligar === true;
      await db.doc(`escola_config/${esc}`).set({ foto_login_carteirinha: ligar, foto_login_por: uid, foto_login_em: FieldValue.serverTimestamp() }, { merge: true });
      await audita(db, uid, eu, 'alterou', (ligar ? 'Ligou' : 'Desligou') + ' a foto ao entrar no Portal com a carteirinha', esc);
    }
    return { ligado: await fotoLoginLigada(db, esc), retencao_dias: RETENCAO_FOTOS_DIAS };
  }

  // lista das entradas pela carteirinha: de uma turma (desde um horário) ou de uma escola num dia
  if (acao === 'lista') {
    const tid = String(d.turma_id || ''), esc = String(d.escola_id || ''), dia = /^20\d\d-[01]\d-[0-3]\d$/.test(String(d.dia || '')) ? d.dia : hojeMS();
    if (!ID.test(tid) && !ID.test(esc)) throw new HttpsError('invalid-argument', 'Informe a turma ou a escola.');
    const eu = await podeVer(db, uid, ID.test(tid) ? { turma_id: tid, escola_id: esc } : { escola_id: esc });
    if (!eu) throw new HttpsError('permission-denied', 'Sem acesso a estas entradas.');
    const q = ID.test(tid) ? db.collection('login_carteirinha').where('turma_id', '==', tid).where('dia', '==', dia) : db.collection('login_carteirinha').where('escola_id', '==', esc).where('dia', '==', dia);
    const desde = Number(d.desde) || 0;
    const l = (await q.get()).docs.map(x => ({ id: x.id, ...x.data() })).filter(x => !desde || (x.em && x.em.toMillis() >= desde))
      .sort((a, b) => (b.em ? b.em.toMillis() : 0) - (a.em ? a.em.toMillis() : 0)).slice(0, 200)
      .map(x => ({ id: x.id, aluno_id: x.aluno_id, nome: x.nome, turma_id: x.turma_id, em: x.em ? x.em.toMillis() : 0, tem_foto: !!x.foto, sem_foto: x.sem_foto || '', contestado: x.contestado === true }));
    return { dia, lista: l, ligado: ID.test(esc) ? await fotoLoginLigada(db, esc) : undefined };
  }

  const id = String(d.id || ''); if (!ID.test(id)) throw new HttpsError('invalid-argument', 'Registro inválido.');
  const ref = db.doc(`login_carteirinha/${id}`), reg = (await ref.get()).data();
  if (!reg) throw new HttpsError('not-found', 'Registro não encontrado (as fotos ficam guardadas só 15 dias).');
  const eu = await podeVer(db, uid, reg);
  if (!eu) throw new HttpsError('permission-denied', 'Sem acesso a esta entrada.');

  // abrir a foto: registra antes; se não registrar, não mostra
  if (acao === 'foto') {
    if (!reg.foto) return { foto: '', sem_foto: reg.sem_foto || '' };
    await audita(db, uid, eu, 'viu_foto', 'Abriu a foto da entrada pela carteirinha de ' + reg.nome, id);
    const [buf] = await getStorage().bucket(BUCKET_PORTARIA).file(reg.foto).download().catch(() => [null]);
    return { foto: buf ? 'data:image/jpeg;base64,' + buf.toString('base64') : '', sem_foto: buf ? '' : 'apagada' };
  }

  // "Não é este aluno": derruba a sessão e avisa a tela do aluno pela aula da turma
  if (acao === 'contestar') {
    await ref.set({ contestado: true, contestado_por: uid, contestado_em: FieldValue.serverTimestamp() }, { merge: true });
    if (reg.turma_id) await db.doc(`qr_aulas/${reg.turma_id}`).set({ expulsos: { [reg.aluno_id]: FieldValue.serverTimestamp() } }, { merge: true });
    await getAuth().revokeRefreshTokens('al-' + reg.aluno_id).catch(e => console.warn('revogar:', e.message));
    await audita(db, uid, eu, 'alterou', 'Marcou "Não é este aluno" na entrada pela carteirinha de ' + reg.nome + ' (sessão encerrada)', id);
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});
