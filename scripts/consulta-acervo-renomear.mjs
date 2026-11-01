// Ação pontual (pedido do Alan, 01/11/2026): corrige o nome da pasta do acervo do Laboratório NEWPC.
// Só troca o nome na árvore (acervo_rede_arvore/lab-muni); os arquivos continuam ligados à pasta pelo id.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), ref = db.doc('acervo_rede_arvore/lab-muni');
const MUN = 'lab-muni', ID = 'xyxszc2v0b', NOVO = 'Identidade Visual Portal do Educador';
const d = await ref.get(); const pastas = (d.exists && d.data().pastas) || [];
const p = pastas.find(x => x.id === ID);
if (!p) { console.log('::error::pasta ' + ID + ' não encontrada em ' + MUN); process.exit(1); }
const antes = p.nome; p.nome = NOVO;
await ref.update({ pastas, atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'acao-alan' });
console.log('::notice::pasta renomeada: ' + antes + ' -> ' + NOVO);
