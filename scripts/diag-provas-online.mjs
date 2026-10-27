// Diagnóstico (só leitura) das últimas provas online: para quem foram, janela e situação.
// Uso no Cloud Shell, na pasta do repositório: (cd functions && node ../scripts/diag-provas-online.mjs)
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ projectId: 'portal-educador-5' });
const db = getFirestore(), ms = v => v && v.toMillis ? v.toMillis() : 0, h = m => m ? new Date(m).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' }) : '-';
const s = await db.collection('provas_online').orderBy('criado_em', 'desc').limit(4).get();
for (const d of s.docs) {
  const p = d.data();
  console.log('---', d.id, '|', p.titulo, '| status', p.status, '| modo', p.modo, '| fotos', p.fotos, '|', p.finalidade, p.periodo);
  console.log('   abre', h(ms(p.abre_em)), '| fecha', h(ms(p.fecha_em)), '| criada', h(ms(p.criado_em)), '| turma', p.turma_nome, p.turma_id);
  console.log('   alunos_ids', JSON.stringify(p.alunos_ids), '| alunos_uids', JSON.stringify(p.alunos_uids));
  for (const aid of (p.alunos_ids || []).slice(0, 5)) {
    const us = await db.collection('usuarios').where('aluno_id', '==', aid).get();
    console.log('   matrícula', aid, '-> contas', us.docs.map(u => u.id + ' ' + (u.data().email || '') + ' ' + u.data().perfil).join(' ; ') || 'nenhuma');
  }
}
process.exit(0);
