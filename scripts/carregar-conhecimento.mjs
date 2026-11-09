// Carrega a base que o robô do WhatsApp usa para responder dúvidas: o Manual do Usuário (fontes .md do ramo "manuais").
// Corta por seção (## e ###), guarda "Parte › Seção › Subseção" como título e o texto limpo (sem imagens nem marcação).
// Público: --publico todos (padrão, professor e equipe) ou --publico equipe (POPs e Manual da equipe: só a equipe NEWPC recebe;
// o filtro é feito na função do robô, no servidor, pelo cadastro de quem escreve).
// Uso: node scripts/carregar-conhecimento.mjs --origem manual-usuario manuais/fontes/parte0u.md manuais/fontes/parte1.md [--gravar]
// Sem --gravar só mostra quantos trechos sairiam. Com --gravar troca os trechos daquela origem (os de outras origens ficam).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2), gravar = args.includes('--gravar');
const iOrigem = args.indexOf('--origem'), origem = iOrigem >= 0 ? args[iOrigem + 1] : 'manual-usuario';
const iPub = args.indexOf('--publico'), publico = iPub >= 0 ? args[iPub + 1] : 'todos';
if (!['todos', 'equipe'].includes(publico)) { console.error('::error::--publico todos ou equipe'); process.exit(1); }
const arquivos = args.filter((a, i) => !a.startsWith('--') && i !== iOrigem + 1 && i !== iPub + 1);
if (!/^[a-z0-9-]{3,40}$/.test(origem) || !arquivos.length) { console.error('::error::informe --origem e os arquivos .md'); process.exit(1); }

const LIMITE = 1800;
function limpar(l) {
  return l.replace(/!\[[^\]]*\]\([^)]*\)/g, '')          // imagens
    .replace(/\{:[^}]*\}/g, '')                          // atributos {: .nova }
    .replace(/<[^>]+>/g, '')                              // html
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')             // links: fica o texto
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')                 // negrito no jeito do WhatsApp
    .replace(/`([^`]+)`/g, '$1')
    .replace(/app\.portaldoeducador\.com\.br/g, 'www.portaldoeducador.com.br')
    .replace(/^@@.*$/, '').replace(/[ \t]+$/g, '');
}
const trechos = [];
for (const arq of arquivos) {
  let parte = '', secao = '', sub = '', buf = [];
  const fechar = () => {
    const corpo = buf.join('\n').replace(/\n{3,}/g, '\n\n').trim(); buf = [];
    if (corpo.length < 40) return;
    const titulo = [parte, secao, sub].filter(Boolean).join(' › ');
    // seção longa: corta por parágrafo, mantendo o título em cada pedaço
    let atual = '';
    for (const p of corpo.split(/\n\n/)) {
      if (atual && (atual + '\n\n' + p).length > LIMITE) { trechos.push({ titulo, texto: atual }); atual = ''; }
      atual = atual ? atual + '\n\n' + p : p;
    }
    if (atual) trechos.push({ titulo, texto: atual.slice(0, 4000) });
  };
  for (const linha of readFileSync(arq, 'utf8').split('\n')) {
    const h = /^(#{1,3})\s+(.*)$/.exec(linha);
    if (h) {
      fechar(); const t = limpar(h[2]).trim();
      if (h[1] === '#') { parte = t; secao = ''; sub = ''; } else if (h[1] === '##') { secao = t; sub = ''; } else sub = t;
      continue;
    }
    buf.push(limpar(linha));
  }
  fechar();
}
console.log('::notice::' + trechos.length + ' trechos de ' + arquivos.length + ' arquivo(s), origem ' + origem + ', público ' + publico);
if (!gravar) { console.log('::notice::simulação: nada gravado'); process.exit(0); }

const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: process.env.PROJETO || 'portal-educador-5' });
const db = getFirestore();
// troca só os trechos desta origem (é conteúdo gerado a partir do manual; o manual continua sendo a fonte)
const velhos = await db.collection('bot_conhecimento').where('origem', '==', origem).get();
let lote = db.batch(), n = 0;
const comprometer = async () => { if (n) { await lote.commit(); lote = db.batch(); n = 0; } };
for (const d of velhos.docs) { lote.delete(d.ref); if (++n >= 400) await comprometer(); }
await comprometer();
for (const [i, t] of trechos.entries()) {
  lote.set(db.doc('bot_conhecimento/' + origem + '-' + String(i).padStart(4, '0')), { ...t, origem, publico, ordem: i, em: FieldValue.serverTimestamp() });
  if (++n >= 400) await comprometer();
}
await comprometer();
console.log('::notice::gravado: ' + velhos.size + ' trechos antigos trocados por ' + trechos.length);
