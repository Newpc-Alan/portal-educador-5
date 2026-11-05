// GRAVA: a escola de cada rede particular de Campo Grande (Colégio Status 2 e Colégio Liceu · Unidade II), com o mesmo nome da rede,
// para receber turmas, professores e equipamentos. Não duplica: pula a rede que já tem escola. Dados públicos (nome e cidade).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const ms = await db.collection('municipios').where('tipo_rede', '==', 'particular').get();
for (const d of ms.docs) {
  const m = d.data(), ja = await db.collection('escolas').where('municipio_id', '==', d.id).limit(1).get();
  if (!ja.empty) { console.log('::notice::' + m.nome + ': já tem escola, pulada'); continue; }
  await db.collection('escolas').add({ nome: m.nome, inep: '', municipio_id: d.id, municipio_nome: m.nome || '', municipio_uf: m.uf || '', logradouro: m.logradouro || '', numero: m.numero || '', complemento: '', bairro: m.bairro || '',
    endereco: m.endereco || '', cnpj: m.cnpj_prefeitura || '', email: '', diretor: '', coordenador: '', ato: '', cep: m.cep || '', tel_ddd: '', tel_numero: '', telefone: '',
    status: 'ativa', origem: 'rede-particular', criado_em: FieldValue.serverTimestamp(), criado_por: 'newpc', atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'newpc' });
  console.log('::notice::' + m.nome + ' (' + (m.cidade || '') + '): escola cadastrada');
}
process.exit(0);
