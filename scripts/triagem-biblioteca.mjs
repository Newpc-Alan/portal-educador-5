// Triagem da Biblioteca antiga (Google Drive) para o Portal 5.0.
// NÃO copia nenhuma obra: só cria a lista de títulos em Firestore (biblioteca_triagem) com uma sugestão
// de classificação (comercial, domínio público provável ou revisar) e manda a planilha por e-mail.
// A cópia de cada título só acontece no painel da Biblioteca, depois que um administrador confirma a licença.
// Rodar no Cloud Shell (pasta scripts):
//   node triagem-biblioteca.mjs                 -> simulação (mostra o resumo)
//   SMTP_SENHA="$(gcloud secrets versions access latest --secret=SMTP_SENHA --project=portal-educador-5)" node triagem-biblioteca.mjs --gravar
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

const CHAVE = 'AIzaSyAx_g0vpxZsYpUX7mOYjEX2Uj3l3jHHkmU'; // chave que já estava publicada nas páginas antigas
const REFERER = 'https://www.portaldoeducador.com.br/';
const SECOES = {
  livros: { pasta: '1yxyIz94iDBeo09Ksm3AhDCsWkFCYQQIu', nome: 'Livros' },
  audiolivros: { pasta: '1lcHqRadyhD_xohNe9N7OMs7icIJc3xw9', nome: 'Audiolivros' },
  aprender: { pasta: '1X2uCQ-mh_Xq6pL7DdY5PywmzX8MD0onZ', nome: 'Livros para aprender brincando' },
  gibiteca: { pasta: '1Dt-c3na1gPHqemoi1yoY01mF8oT1zejZ', nome: 'Gibiteca' }
};
const GRAVAR = process.argv.includes('--gravar');
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' }));

const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// obras e marcas com dono conhecido: não entram sem licença comprovada
const COMERCIAL = [
  [/monica|cebolinha|cascao|magali|chico bento|turma da|mauricio de sousa|horacio|penadinho|astronauta.*mauricio/, 'Turma da Mônica (Mauricio de Sousa / Panini)'],
  [/ze carioca|disney|mickey|minnie|pato donald|donald|tio patinhas|pateta|margarida|peninha/, 'Disney'],
  [/chaves|chapolin|chespirito/, 'Chaves (Televisa / Chespirito)'],
  [/panini|abril|marvel|\bdc\b|batman|super-?homem|homem-?aranha|vingadores|liga da justica|x-?men/, 'Editora de quadrinhos'],
  [/cortella|clovis de barros|karnal|cury|gasparetto|romero britto/, 'Autor contemporâneo'],
  [/sublimax|o misterioso/, 'Quadrinho comercial'],
  [/turma do perere|ziraldo|menino maluquinho|ruth rocha|ana maria machado|pedro bandeira|eva furnari|mary franca|sonia junqueira|marcelo marcelino/, 'Autor contemporâneo (direitos ativos)'],
  [/editora|moderna|atica|scipione|ftd|salamandra|companhia das letrinhas|rocco|melhoramentos|brinque-?book|global editora|saraiva/, 'Editora comercial']
];
// autores e obras em domínio público no Brasil (autor falecido há mais de 70 anos). A edição ainda precisa ser conferida:
// ilustrações e traduções recentes têm direito próprio.
const DOMINIO_PUBLICO = [
  /monteiro lobato|sitio do picapau|emilia|narizinho|pedrinho|visconde de sabugosa/, /machado de assis|dom casmurro|memorias postumas|quincas borba/,
  /jose de alencar|iracema|o guarani|senhora|lucíola|luciola/, /lima barreto|policarpo/, /aluisio azevedo|o cortico/, /olavo bilac/, /castro alves/,
  /goncalves dias|cancao do exilio/, /alvares de azevedo/, /raul pompeia|o ateneu/, /euclides da cunha|os sertoes/, /joaquim manuel de macedo|a moreninha/,
  /irmaos grimm|grimm/, /andersen|patinho feio|soldadinho de chumbo|pequena sereia|roupa nova do imperador/, /perrault/, /esopo|la fontaine|fabulas de esopo/,
  /collodi|pinoquio/, /lewis carroll|alice no pais/, /julio verne|volta ao mundo em 80|viagem ao centro da terra|vinte mil leguas/, /dominio publico/
];
function classificar(nome, secao) {
  const n = norm(nome);
  for (const [re, motivo] of COMERCIAL) if (re.test(n)) return { sugestao: 'comercial', motivo };
  for (const re of DOMINIO_PUBLICO) if (re.test(n)) return { sugestao: 'dominio-publico', motivo: 'Autor ou obra em domínio público (conferir a edição)' };
  if (secao === 'audiolivros') return { sugestao: 'revisar', motivo: 'Audiolivro: confirmar quem gravou e se há licença' };
  if (secao === 'gibiteca') return { sugestao: 'revisar', motivo: 'Quadrinho: confirmar editora e licença' };
  return { sugestao: 'revisar', motivo: 'Confirmar autor, editora e licença' };
}
const TIPOS = { 'application/pdf': 'pdf', 'audio/mpeg': 'audio', 'audio/mp3': 'audio', 'application/x-cbz': 'cbz', 'application/vnd.comicbook+zip': 'cbz' };

async function listar(pasta) {
  let tok = '', out = [];
  do {
    const p = new URLSearchParams({ key: CHAVE, q: `'${pasta}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,mimeType,size)', pageSize: '1000' });
    if (tok) p.set('pageToken', tok);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + p, { headers: { Referer: REFERER } });
    if (!r.ok) throw new Error('Drive ' + r.status);
    const d = await r.json(); out = out.concat(d.files || []); tok = d.nextPageToken || '';
  } while (tok);
  return out;
}

const itens = [];
for (const [secao, cfg] of Object.entries(SECOES)) {
  const raiz = await listar(cfg.pasta);
  for (const f of raiz) {
    if (f.mimeType === 'application/vnd.google-apps.folder') {
      const dentro = await listar(f.id);
      const imgs = dentro.filter(x => /^image\//.test(x.mimeType)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
      if (imgs.length >= 3) { // pasta de páginas de um gibi vira um título só
        itens.push({ id: f.id, nome: f.name.replace(/^aplica[cç][aã]o\s*gibi\s*\/?/i, '').trim() || f.name, secao, tipo: 'imagens', mime: 'pasta',
          tamanho: imgs.reduce((s, x) => s + Number(x.size || 0), 0), paginas: imgs.map(x => x.id), pasta: f.name });
      }
      for (const x of dentro.filter(x => TIPOS[x.mimeType])) itens.push({ id: x.id, nome: x.name, secao, tipo: TIPOS[x.mimeType], mime: x.mimeType, tamanho: Number(x.size || 0), pasta: f.name });
      continue;
    }
    if (!TIPOS[f.mimeType]) continue; // html, pptx, rar e outros ficam de fora
    itens.push({ id: f.id, nome: f.name, secao, tipo: TIPOS[f.mimeType], mime: f.mimeType, tamanho: Number(f.size || 0), pasta: '' });
  }
}
for (const it of itens) Object.assign(it, classificar(it.pasta + ' ' + it.nome, it.secao), { titulo: it.nome.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s*\(\d\)\s*$/, '').trim() });

const resumo = {};
itens.forEach(i => { const k = `${SECOES[i.secao].nome} · ${i.sugestao}`; resumo[k] = (resumo[k] || 0) + 1; });
console.table(resumo);
console.log(`${itens.length} títulos (${Math.round(itens.reduce((s, i) => s + i.tamanho, 0) / 1e9)} GB).`);
if (!GRAVAR) { console.log('SIMULAÇÃO: nada foi gravado.'); process.exit(0); }

for (let i = 0; i < itens.length; i += 400) {
  const b = db.batch();
  itens.slice(i, i + 400).forEach(it => {
    const { id, ...dados } = it;
    b.set(db.doc(`biblioteca_triagem/${id}`), { ...dados, drive_id: id, status: 'pendente', atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
  });
  await b.commit();
}
console.log('Triagem gravada no Portal.');

if (process.env.SMTP_SENHA) {
  const cel = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const ROT = { comercial: 'Comercial (só com licença)', 'dominio-publico': 'Domínio público provável (conferir edição)', revisar: 'Revisar' };
  const csv = '﻿' + ['Seção;Título;Pasta;Formato;Tamanho (MB);Sugestão;Motivo;Decisão (preencher)']
    .concat(itens.sort((a, b) => a.secao.localeCompare(b.secao) || a.sugestao.localeCompare(b.sugestao) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
      .map(i => [SECOES[i.secao].nome, i.titulo, i.pasta, i.tipo, (i.tamanho / 1e6).toFixed(1).replace('.', ','), ROT[i.sugestao], i.motivo, ''].map(cel).join(';'))).join('\r\n');
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'newpc.educador@gmail.com', pass: process.env.SMTP_SENHA } });
  const linhas = Object.entries(resumo).map(([k, v]) => `<li>${k}: <b>${v}</b></li>`).join('');
  await t.sendMail({
    from: '"Portal do Educador" <newpc.educador@gmail.com>', to: ['alan@newpc.com.br', 'leonardo@newpc.com.br'],
    subject: `Triagem da Biblioteca: ${itens.length} títulos para decidir`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338"><p><b>Triagem da Biblioteca do Portal do Educador</b></p>
<p>Nenhuma obra foi copiada. Cada título só entra no Portal 5.0 depois que um administrador confirma a licença no painel da Biblioteca (aba Triagem), e a confirmação fica registrada.</p>
<ul>${linhas}</ul><p>A planilha completa vai anexa. Comerciais só entram com contrato ou autorização da editora ou autor.</p>
<p><a href="https://app.portaldoeducador.com.br/biblioteca/#triagem">Abrir a Triagem no Portal</a></p></div>`,
    attachments: [{ filename: 'triagem-biblioteca.csv', content: csv, contentType: 'text/csv; charset=utf-8' }]
  });
  console.log('Planilha enviada para alan@ e leonardo@.');
}
