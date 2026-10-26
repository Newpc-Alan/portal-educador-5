// Conferência do CPF do servidor na Receita Federal, pela API Consulta CPF do Serpro (contrato da NEWPC, cobrança por consulta).
// - A chamada sai só do servidor (Cloud Function): a chave do Serpro nunca vai para o navegador.
// - CPF e data de nascimento são lidos da ficha gravada, não do que o navegador manda.
// - Cada consulta custa: o resultado fica guardado e só é refeito se CPF, nascimento ou nome mudarem, ou depois de 180 dias.
// - Limite diário por município, para nenhuma rede gastar consultas por engano.
// - O resultado vai para cpf_receita/{email} (só a função escreve; lê quem pode ler a ficha do servidor).
// ATIVAR (depois do contrato): gravar SERPRO_CHAVE e SERPRO_SEGREDO no Secret Manager, conferir o formato da v3 na
// documentação do contrato (função consultarSerpro), exportar conferirCpfServidor no index.js, publicar regras + função
// e trocar RECEITA_ATIVA para true em apps/servidores/index.html.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

const SERPRO_CHAVE = defineSecret('SERPRO_CHAVE');
const SERPRO_SEGREDO = defineSecret('SERPRO_SEGREDO');
// endereços da API: ficam como parâmetro para trocar sem mexer no código (confirmar com a documentação do contrato)
const SERPRO_TOKEN_URL = defineString('SERPRO_TOKEN_URL', { default: 'https://gateway.apiserpro.serpro.gov.br/token' });
const SERPRO_CPF_URL = defineString('SERPRO_CPF_URL', { default: 'https://apicpf.estaleiro.serpro.gov.br/api/v3/cpf/' });
const COTA_DIA_MUNICIPIO = 200;
const VALIDADE_DIAS = 180;

export const cpfValido = d => { d = String(d || ''); if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false; const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; return dv(9) === +d[9] && dv(10) === +d[10]; };
export const nomeChave = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
export const impressao = (cpf, nasc, nome) => createHash('sha256').update(`${cpf}|${nasc}|${nomeChave(nome)}`).digest('hex').slice(0, 24);
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// quem pode pedir a conferência: o mesmo grupo que edita a ficha (o próprio servidor, a gestão das escolas dele, a secretaria do município, o admin)
export function podeConferir(u, srv, emailLogin, emailVerificado) {
  if (!u || u.status !== 'ativo') return false;
  if (u.perfil === 'admin') return true;
  if (emailVerificado && emailLogin === srv.email && u.perfil !== 'aluno') return true;
  if (u.perfil === 'secretaria' && u.municipio_id === srv.municipio_id) return true;
  const minhas = [...new Set([...(u.escolas_ids || []), u.escola_id].filter(Boolean))];
  return u.perfil === 'gestor' && u.municipio_id === srv.municipio_id && (srv.escolas_ids || []).some(e => minhas.includes(e));
}

// traduz o retorno do Serpro no resultado que o Portal mostra
export function avaliarRetorno(nomeCadastro, r) {
  const cod = String(r.situacao_codigo ?? '');
  if (r.nao_encontrado) return { status: 'nao_confere', texto: 'CPF e data de nascimento não conferem na Receita.' };
  const regular = cod === '0' || /regular/i.test(r.situacao || '');
  const nomeOk = nomeChave(r.nome) === nomeChave(nomeCadastro) || (r.nome_social && nomeChave(r.nome_social) === nomeChave(nomeCadastro));
  if (!regular) return { status: 'irregular', texto: `Situação na Receita: ${r.situacao || 'não regular'}.`, nome_confere: nomeOk };
  if (!nomeOk) return { status: 'nome_diverge', texto: 'CPF regular, mas o nome da ficha é diferente do nome na Receita.', nome_confere: false };
  return { status: 'confere', texto: 'CPF regular e nome conferem com a Receita.', nome_confere: true };
}

// --- adaptador do Serpro: o único trecho que depende do formato exato da API contratada ---
let tokenCache = { v: '', ate: 0 };
async function tokenSerpro(fetcher) {
  if (tokenCache.v && tokenCache.ate > Date.now() + 60000) return tokenCache.v;
  const basic = Buffer.from(`${SERPRO_CHAVE.value()}:${SERPRO_SEGREDO.value()}`).toString('base64');
  const r = await fetcher(SERPRO_TOKEN_URL.value(), { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!r.ok) throw new HttpsError('unavailable', 'Não foi possível autenticar no Serpro agora.');
  const j = await r.json(); tokenCache = { v: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3000) * 1000 };
  return tokenCache.v;
}
export async function consultarSerpro(cpf, nascimento, fetcher = fetch) {
  const tk = await tokenSerpro(fetcher);
  // v3: a consulta exige CPF e data de nascimento (DDMMAAAA). Conferir nomes dos parâmetros na documentação do contrato.
  const nasc = nascimento.slice(8, 10) + nascimento.slice(5, 7) + nascimento.slice(0, 4);
  const r = await fetcher(SERPRO_CPF_URL.value() + cpf + '?dataNascimento=' + nasc, { headers: { Authorization: `Bearer ${tk}`, Accept: 'application/json' } });
  if (r.status === 404 || r.status === 422) return { nao_encontrado: true };
  if (r.status === 401) { tokenCache = { v: '', ate: 0 }; throw new HttpsError('unavailable', 'Sessão do Serpro expirou. Tente de novo.'); }
  if (!r.ok) throw new HttpsError('unavailable', `Serpro indisponível (${r.status}). Tente mais tarde.`);
  const j = await r.json();
  return { nome: j.nome || '', nome_social: j.nomeSocial || j.nome_social || '', situacao_codigo: j.situacao?.codigo ?? j.situacao_codigo ?? '', situacao: j.situacao?.descricao || j.situacao || '' };
}

export async function conferir({ db, uid, token, email, agora = new Date(), consultar = consultarSerpro }) {
  if (typeof email !== 'string' || !/^[^\s@\/]{1,64}@[^\s@\/]{1,190}$/.test(email)) throw new HttpsError('invalid-argument', 'Servidor inválido.');
  const [us, ss] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc(`servidores/${email}`).get()]);
  if (!ss.exists) throw new HttpsError('not-found', 'Salve a ficha antes de conferir o CPF.');
  const srv = ss.data(), u = us.data();
  if (!podeConferir(u, srv, token.email, token.email_verified === true)) throw new HttpsError('permission-denied', 'Você não pode conferir esta ficha.');
  if (!cpfValido(srv.cpf)) throw new HttpsError('failed-precondition', 'Preencha um CPF válido e salve a ficha.');
  if (!/^\d{4}-\d\d-\d\d$/.test(srv.nascimento || '')) throw new HttpsError('failed-precondition', 'A Receita exige a data de nascimento. Preencha e salve a ficha.');
  const imp = impressao(srv.cpf, srv.nascimento, srv.nome), ref = db.doc(`cpf_receita/${email}`);
  const atual = (await ref.get()).data();
  const idade = atual && atual.conferido_em && atual.conferido_em.toMillis ? (agora.getTime() - atual.conferido_em.toMillis()) / 864e5 : 1e9;
  if (atual && atual.impressao === imp && idade < VALIDADE_DIAS) return { ...publico(atual), reaproveitado: true };
  // cota diária do município (transação: dois cliques ao mesmo tempo não furam o limite)
  const cota = db.doc(`cpf_cota/${srv.municipio_id}_${hojeMS()}`);
  await db.runTransaction(async tx => { const c = (await tx.get(cota)).data(); const n = (c && c.n) || 0; if (n >= COTA_DIA_MUNICIPIO) throw new HttpsError('resource-exhausted', 'Limite diário de conferências do município atingido. Tente amanhã.'); tx.set(cota, { n: n + 1, municipio_id: srv.municipio_id, dia: hojeMS() }, { merge: true }); });
  const ret = await consultar(srv.cpf, srv.nascimento);
  const av = avaliarRetorno(srv.nome, ret);
  const reg = { email, municipio_id: srv.municipio_id, escolas_ids: srv.escolas_ids || [], impressao: imp, status: av.status, texto: av.texto, nome_confere: !!av.nome_confere,
    situacao: ret.situacao || '', nome_receita: ret.nao_encontrado ? '' : (ret.nome || ''), conferido_em: FieldValue.serverTimestamp(), conferido_por: uid };
  await ref.set(reg);
  await db.collection('auditoria').add({ uid, acao: 'cpf_receita', alvo: email, resultado: av.status, em: FieldValue.serverTimestamp() });
  return { ...publico(reg), reaproveitado: false };
}
const publico = r => ({ status: r.status, texto: r.texto, nome_receita: r.nome_receita || '', situacao: r.situacao || '' });

export const conferirCpfServidor = onCall({ region: 'southamerica-east1', secrets: [SERPRO_CHAVE, SERPRO_SEGREDO], maxInstances: 5, timeoutSeconds: 30 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  return conferir({ db: getFirestore(), uid: req.auth.uid, token: req.auth.token, email: String((req.data || {}).email || '').toLowerCase() });
});
