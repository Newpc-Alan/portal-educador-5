// Publica um PDF na Documentação do Portal (menu do administrador) ou na Ajuda (todos os perfis).
// Uso (Cloud Shell, conta com acesso ao projeto):
//   node scripts/publicar-documento.mjs --arquivo manual.pdf --titulo "Manual do Usuário" --categoria manual --publico todos --versao 1.0 [--codigo X] [--descricao "..."] [--id idExistente] [--nota "o que mudou"]
//   --categoria: manual | pop | tecnico | outro      --publico: admin (só a equipe NEWPC) | todos (aparece em Ajuda)
//   Com --id de um documento existente, publica uma NOVA VERSÃO (guarda o histórico). Sem --gravar, só mostra o que faria.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : ''; };
const gravar = process.argv.includes('--gravar');
const arquivo = arg('arquivo'), titulo = arg('titulo'), categoria = arg('categoria') || 'outro', publico = arg('publico') || 'admin', versao = arg('versao') || '1.0';
if (!arquivo || (!titulo && !arg('id'))) { console.log('Informe --arquivo e --titulo (ou --id para nova versão).'); process.exit(1); }
if (!['manual', 'pop', 'tecnico', 'outro'].includes(categoria)) { console.log('Categoria inválida.'); process.exit(1); }
if (!['admin', 'todos'].includes(publico)) { console.log('--publico deve ser admin ou todos.'); process.exit(1); }
const buf = readFileSync(arquivo);
if (buf.slice(0, 4).toString() !== '%PDF') { console.log('O arquivo não é PDF.'); process.exit(1); }

initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket();
const ref = arg('id') ? db.doc('documentos/' + arg('id')) : db.collection('documentos').doc();
const atual = arg('id') ? (await ref.get()).data() : null;
if (arg('id') && !atual) { console.log('Documento não encontrado: ' + arg('id')); process.exit(1); }
const pub = atual ? atual.publico : publico;
const caminho = 'documentos/' + (pub === 'todos' ? 'publico' : 'interno') + '/' + ref.id + '-v' + versao.replace(/[^0-9A-Za-z]+/g, '-') + '-' + Date.now().toString(36) + '.pdf';
console.log((atual ? 'Nova versão de "' + atual.titulo + '"' : 'Novo documento "' + titulo + '"') + ' · ' + pub + ' · v' + versao + ' · ' + (buf.length / 1048576).toFixed(1) + ' MB → ' + caminho);
if (!gravar) { console.log('Simulação. Rode de novo com --gravar.'); process.exit(0); }

await bucket.file(caminho).save(buf, { contentType: 'application/pdf', resumable: false });
const reg = { versao, arquivo: caminho, tamanho: buf.length, em: Timestamp.now(), por: 'script', nota: arg('nota').slice(0, 200) };
const quem = { atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'script' };
if (atual) {
  await ref.update({ versao, arquivo: caminho, tamanho: buf.length, versoes: [...(atual.versoes || []), reg].slice(-30), ...quem });
} else {
  await ref.set({ titulo: titulo.slice(0, 120), categoria, codigo: arg('codigo').slice(0, 40), descricao: arg('descricao').slice(0, 400), publico,
    versao, arquivo: caminho, tamanho: buf.length, versoes: [reg], criado_em: FieldValue.serverTimestamp(), criado_por: 'script', ...quem });
}
console.log('Publicado. id=' + ref.id);
process.exit(0);
