// Rede de demonstração: CONTA o que seria removido (não apaga nada). Para remover: consulta demo-apagar-gravar.
// Varre por municipio_id == 'demo-rede', por escola_id das escolas da demonstração e por demo == true.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldPath } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), M = 'demo-rede';
const APAGAR = process.argv.includes('--apagar') || /gravar/.test(process.argv[1] || '');

const POR_MUNI = ['escolas', 'usuarios', 'turmas', 'alunos', 'freq_resumo', 'freq_chamadas', 'avaliacoes', 'respostas', 'rec_itens', 'rec_chamados', 'tv_telas', 'tv_canais',
  'busca_ativa', 'relatorios', 'termometro_registros', 'users', 'provas_online', 'cal_escola', 'notas_escola', 'comunicados_familia', 'avisos_familia', 'trabalhos_rede', 'acervo_rede'];
const POR_ESCOLA = ['turmas', 'alunos', 'freq_chamadas', 'freq_resumo', 'avaliacoes', 'provas_online', 'notas_escola', 'cal_escola'];
const SO_DEMO = ['acessos_dia', 'certificados', 'formacao_lembretes', 'portal_ia_uso'];

const alvo = new Map();   // caminho -> ref
const junta = s => s.forEach(d => alvo.set(d.ref.path, d.ref));
const escolas = (await db.collection('escolas').where('municipio_id', '==', M).get()).docs.map(d => d.id);
for (const c of POR_MUNI) junta(await db.collection(c).where('municipio_id', '==', M).get().catch(() => ({ forEach() {} })));
for (const c of POR_ESCOLA) for (let i = 0; i < escolas.length; i += 10) junta(await db.collection(c).where('escola_id', 'in', escolas.slice(i, i + 10)).get().catch(() => ({ forEach() {} })));
for (const c of [...new Set([...POR_MUNI, ...SO_DEMO])]) junta(await db.collection(c).where('demo', '==', true).get().catch(() => ({ forEach() {} })));
const uids = [...alvo.keys()].filter(k => /^usuarios\//.test(k)).map(k => k.split('/')[1]);
for (let i = 0; i < uids.length; i += 10) {   // certificados e lembretes de quem é da rede de demonstração (inclusive gerados ao vivo)
  junta(await db.collection('certificados').where('uid', 'in', uids.slice(i, i + 10)).get());
  junta(await db.collection('formacao_lembretes').where('uid', 'in', uids.slice(i, i + 10)).get().catch(() => ({ forEach() {} })));
}
const muni = db.doc(`municipios/${M}`); if ((await muni.get()).exists) alvo.set(muni.path, muni);

const porColecao = {}; for (const k of alvo.keys()) { const c = k.split('/')[0]; porColecao[c] = (porColecao[c] || 0) + 1; }
// os perfis da Formação (users/...) levam junto as subcoleções (progresso, práticas, anotações, tentativas)
let sub = 0; for (const [k, r] of alvo) if (/^users\//.test(k)) for (const s of await r.listCollections()) sub += (await s.count().get()).data().count;
console.log(`::notice::Rede de demonstração: ${alvo.size} documentos + ${sub} em subcoleções dos perfis · ${JSON.stringify(porColecao)}`);
// conferência de segurança: nada fora da demonstração pode estar na lista
const suspeitos = [];
for (const [k, r] of alvo) { if (/^(municipios\/demo-rede|.*\/demo-)/.test(k)) continue; const x = (await r.get()).data() || {};
  if (x.demo !== true && x.municipio_id !== M && !escolas.includes(x.escola_id) && !uids.includes(x.uid)) suspeitos.push(k); }
if (suspeitos.length) { console.log('::error::Documentos fora da demonstração na lista; nada foi apagado: ' + suspeitos.slice(0, 10).join(', ')); process.exit(1); }

if (!APAGAR) { console.log('::notice::Só contagem. Para remover, rode a consulta demo-apagar-gravar.'); process.exit(0); }
let n = 0;
for (const [k, r] of alvo) { if (/^users\//.test(k)) await db.recursiveDelete(r); else await r.delete(); n++; }
const resta = (await db.collection('usuarios').where('municipio_id', '==', M).count().get()).data().count + (await db.collection('acessos_dia').where('demo', '==', true).count().get()).data().count;
console.log(`::notice::Removidos ${n} documentos (e subcoleções). Conferência: ${resta} restante(s).`);
