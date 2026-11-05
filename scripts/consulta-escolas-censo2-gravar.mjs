// GRAVA: cadastra as escolas e CMEIs municipais do Censo Escolar (scripts/dados/escolas-censo-2026-11-05.json) que faltavam em
// Bonito, Brasilândia, Camapuã, Corumbá, Itaporã, Jardim e Sonora. Pula a escola cujo INEP já existe no município.
// Dados públicos (nome, INEP e endereço da escola). Diretor, CNPJ e telefone ficam em branco para a Secretaria completar.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const GRAVAR = process.env.SO_LER !== '1';
const db = getFirestore(), D = JSON.parse(readFileSync(new URL('../scripts/dados/escolas-censo-2026-11-05.json', pathToFileURL(process.cwd() + '/')), 'utf8'));
let total = 0;
for (const [mid, lista] of Object.entries(D.municipios)) {
  const m = (await db.doc('municipios/' + mid).get()).data(); if (!m) { console.log('::notice::município ' + mid + ' não existe: pulado'); continue; }
  const ja = new Set((await db.collection('escolas').where('municipio_id', '==', mid).get()).docs.map(d => String(d.data().inep || '')));
  const novas = lista.filter(([, inep]) => !ja.has(inep));
  for (const [nome, inep, rua, num, bairro, cep] of GRAVAR ? novas : []) {
    await db.collection('escolas').add({ nome, inep, municipio_id: mid, municipio_nome: m.nome || '', municipio_uf: m.uf || '', logradouro: rua, numero: num, complemento: '', bairro,
      endereco: rua ? rua + (num ? ', ' + num : ', S/N') + (bairro ? ', ' + bairro : '') : '', cnpj: '', email: '', diretor: '', coordenador: '', ato: '', cep: cep || '', tel_ddd: '', tel_numero: '', telefone: '',
      status: 'ativa', origem: 'censo-2026-11', criado_em: FieldValue.serverTimestamp(), criado_por: 'censo', atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'censo' });
  }
  total += novas.length;
  console.log('::notice::' + m.nome + ': ' + novas.length + ' escola(s) ' + (GRAVAR ? 'cadastrada(s)' : 'a cadastrar') + ' de ' + lista.length + (lista.length - novas.length ? ' (' + (lista.length - novas.length) + ' já existiam pelo INEP)' : ''));
}
console.log('::notice::TOTAL ' + (GRAVAR ? 'cadastradas' : 'a cadastrar') + ': ' + total);
process.exit(0);
