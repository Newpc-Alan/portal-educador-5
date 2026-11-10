// Testa o relatório de execução (só leitura): monta os números de uma rede e mês sem gravar nada.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { montarExecucao } = await import(pathToFileURL(process.cwd() + '/relatorio-execucao.js').href);
const db = getFirestore();
const ms = (await db.collection('municipios').where('status', 'in', ['ativo', 'piloto']).get()).docs.filter(d => !['lab-muni', 'demo-rede'].includes(d.id));
for (const m of ms) for (const mes of ['2026-10', '2026-11']) {
  try { const d = await montarExecucao(db, m.id, mes);
    console.log(`::notice::${m.id} ${mes} | disp=${d.disponibilidade.pct} prof=${d.cadastro.professores} acessaram=${d.acesso.professores} acessos=${d.acesso.acessos} | uso semanas=${d.uso.semanas} pico=${d.uso.pico_semanal} acoes=${d.uso.acoes.map(a => a.n).join('/')} | provas=${d.provas.aplicadas} | cert mes=${d.formacao.certificados_mes} ano=${d.formacao.certificados_ano} cursistas=${d.formacao.cursistas} | itens=${d.equipamentos.itens} ch=${d.equipamentos.chamados_abertos}/${d.equipamentos.chamados_resolvidos} | contrato=${d.rede.contrato ? 'sim' : 'não'}`); }
  catch (e) { console.log(`::notice::${m.id} ${mes} ERRO ${e.message}`); }
}
