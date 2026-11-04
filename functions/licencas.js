// Coerência da licença (nov/2026): licença de teste, avulsa ou cortesia só existe para PROFESSOR.
// Quem vira equipe NEWPC (admin), gestão, Secretaria ou apoio da escola perde a licença antiga na hora,
// venha a mudança de onde vier (tela de Usuários, script, importação). Assim ninguém aparece como "Teste vencido"
// na Central de IA nem é tratado como avulso por engano.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const LICENCAS_PROFESSOR = ['teste', 'avulsa', 'cortesia'];
export const licencaIncoerente = u => !!u && !!u.perfil && u.perfil !== 'professor' && u.perfil !== 'aluno' && LICENCAS_PROFESSOR.includes(u.licenca_tipo);
export const correcaoLicenca = () => ({ licenca_tipo: 'institucional', licenca_fim: null, licenca_plano: '', licenca_pacote: '',
  licenca_corrigida_em: FieldValue.serverTimestamp(), licenca_corrigida_motivo: 'perfil sem licença de professor' });

export const coerenciaLicenca = onDocumentWritten({ document: 'usuarios/{uid}', region: 'southamerica-east1', maxInstances: 5 }, async ev => {
  const depois = ev.data && ev.data.after && ev.data.after.exists ? ev.data.after.data() : null;
  if (!licencaIncoerente(depois)) return;   // a correção grava de novo e cai aqui como coerente: sem laço
  await ev.data.after.ref.update(correcaoLicenca());
});
