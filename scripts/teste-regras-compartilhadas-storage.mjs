// Storage do QR code da Lousa: compartilhadas/{codigo}/... Emulador; não toca no banco real.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const [fh, fp] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const [sh, sp] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5',
  firestore: { host: fh, port: Number(fp) }, storage: { rules: readFileSync(process.argv[2], 'utf8'), host: sh, port: Number(sp) } });
const jpg = new Uint8Array(800), C = 'abcdefghij0123456789wxyz', C2 = 'zzzzzzzzzz0000000000aaaa';
const agora = Date.now(), hoje = String(agora + 6 * 3600e3), passado = String(agora - 60e3), longe = String(agora + 3 * 86400e3);
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore(), s = (p, d) => setDoc(doc(db, p), d);
  await s('usuarios/p1', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1' });
  await s('usuarios/p2', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1' });
  await s('usuarios/pv', { perfil: 'professor', status: 'ativo', licenca_tipo: 'avulsa', licenca_fim: new Date(agora - 86400000) });
  await s('usuarios/al1', { perfil: 'aluno', status: 'ativo', escola_id: 'e1' });
  const st = c.storage();
  await uploadBytes(ref(st, 'compartilhadas/' + C2 + '/p01.jpg'), jpg, { contentType: 'image/jpeg', customMetadata: { dono: 'p1', expira: passado } });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const st = uid => uid ? env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).storage() : env.unauthenticatedContext().storage();
const up = (u, cod, arq, expira, extra = {}) => uploadBytes(ref(st(u), 'compartilhadas/' + cod + '/' + arq), jpg,
  { contentType: extra.tipo || 'image/jpeg', customMetadata: Object.assign({ dono: extra.dono || u, expira }, extra.meta || {}) });
await t('professor licenciado gera o QR', assertSucceeds(up('p1', C, 'p01.jpg', hoje)));
await t('professor sobe o PDF', assertSucceeds(up('p1', C, 'aula.pdf', hoje, { tipo: 'application/pdf' })));
await t('professor sobe o info.json', assertSucceeds(up('p1', C, 'info.json', hoje, { tipo: 'application/json' })));
await t('aluno sem login abre a página', assertSucceeds(getBytes(ref(st(null), 'compartilhadas/' + C + '/p01.jpg'))));
await t('sem login abre o PDF', assertSucceeds(getBytes(ref(st(null), 'compartilhadas/' + C + '/aula.pdf'))));
await t('depois da validade ninguém abre', assertFails(getBytes(ref(st(null), 'compartilhadas/' + C2 + '/p01.jpg'))));
await t('sem login não envia', assertFails(up(null, C, 'p02.jpg', hoje, { dono: 'x' })));
await t('aluno não envia', assertFails(up('al1', C, 'p02.jpg', hoje)));
await t('licença vencida não envia', assertFails(up('pv', C, 'p02.jpg', hoje)));
await t('não grava em nome de outro professor', assertFails(up('p1', C, 'p02.jpg', hoje, { dono: 'p2' })));
await t('validade além de 26 h é recusada', assertFails(up('p1', C, 'p02.jpg', longe)));
await t('validade no passado é recusada', assertFails(up('p1', C, 'p02.jpg', passado)));
await t('código curto é recusado', assertFails(up('p1', 'abc123', 'p01.jpg', hoje)));
await t('nome de arquivo fora do padrão é recusado', assertFails(up('p1', C, 'virus.html', hoje)));
await t('tipo de arquivo fora do padrão é recusado', assertFails(up('p1', C, 'p03.jpg', hoje, { tipo: 'text/html' })));
await t('não substitui página já enviada', assertFails(up('p1', C, 'p01.jpg', hoje)));
await t('outro professor não apaga', assertFails(deleteObject(ref(st('p2'), 'compartilhadas/' + C + '/p01.jpg'))));
await t('o dono apaga', assertSucceeds(deleteObject(ref(st('p1'), 'compartilhadas/' + C + '/p01.jpg'))));
console.log('::notice::QR code no Storage: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);
