// Formação Continuada integrada ao Portal 5.0 (nov/2026): o perfil do cursista (users/{uid}) passa a vir do cadastro
// do Portal (usuarios/{uid}): município e escola pelos ids, perfil e licença. Atualizado a cada entrada na Formação
// (vincularContaFormacao) e pelo robô de migração. Os textos "municipio" e "escola" continuam para o certificado.
import { FieldValue } from 'firebase-admin/firestore';

export async function camposDoPortal(db, u) {
  const ids = [...new Set([...(Array.isArray(u.escolas_ids) ? u.escolas_ids : []), u.escola_id].filter(Boolean))].slice(0, 10);
  let escola = '', municipio = '';
  if (u.escola_id) { const e = (await db.doc(`escolas/${u.escola_id}`).get()).data() || {}; escola = e.nome || ''; }
  if (u.municipio_id) { const m = (await db.doc(`municipios/${u.municipio_id}`).get()).data() || {}; municipio = [m.nome, m.uf].filter(Boolean).join('/'); }
  const f = { municipio_id: String(u.municipio_id || ''), escola_id: String(u.escola_id || ''), escolas_ids: ids, perfil_portal: String(u.perfil || ''),
    licenca_portal: String(u.licenca_tipo || 'institucional'), atualizado_em: FieldValue.serverTimestamp() };
  // ligado a uma rede: o texto vem do cadastro (o professor não edita mais na Formação); avulso continua escrevendo o próprio
  if (f.municipio_id) { f.municipio = municipio.slice(0, 160); f.escola = escola.slice(0, 240); }
  return f;
}
