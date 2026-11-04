// GRAVA: cadastra as escolas municipais do Censo Escolar 2024 (scripts/dados/escolas-censo-2024.json) nos municípios que estavam
// sem escolas (São Gabriel do Oeste, Ribas do Rio Pardo, Rio Brilhante). Pula a escola cujo INEP já existe no município.
// Dados públicos (nome, INEP e endereço da escola). Conferir depois com a Secretaria (diretor, CNPJ, telefone ficam em branco).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), D = JSON.parse(readFileSync(new URL('../scripts/dados/escolas-censo-2024.json', pathToFileURL(process.cwd() + '/')), 'utf8'));
for (const [mid, lista] of Object.entries(D.municipios)) {
  const m = (await db.doc('municipios/' + mid).get()).data(); if (!m) { console.log('::notice::município ' + mid + ' não existe: pulado'); continue; }
  const ja = new Set((await db.collection('escolas').where('municipio_id', '==', mid).get()).docs.map(d => String(d.data().inep || '')));
  let n = 0;
  for (const [nome, inep, rua, num, bairro] of lista) {
    if (ja.has(inep)) continue;
    await db.collection('escolas').add({ nome, inep, municipio_id: mid, municipio_nome: m.nome || '', municipio_uf: m.uf || '', logradouro: rua, numero: num, complemento: '', bairro,
      endereco: rua ? rua + (num ? ', ' + num : ', S/N') + (bairro ? ', ' + bairro : '') : '', cnpj: '', email: '', diretor: '', coordenador: '', ato: '', cep: '', tel_ddd: '', tel_numero: '', telefone: '',
      status: 'ativa', origem: 'censo-2024', criado_em: FieldValue.serverTimestamp(), criado_por: 'censo', atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'censo' });
    n++;
  }
  console.log('::notice::' + m.nome + ': ' + n + ' escola(s) cadastrada(s) de ' + lista.length);
}
process.exit(0);
