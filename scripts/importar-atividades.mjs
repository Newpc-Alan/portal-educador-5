// Atividades: traz os PDFs do Banco Curricular (Google Drive) para o acervo de Atividades do Portal 5.0.
// Uso no Cloud Shell, na pasta do repositório (com functions/node_modules instalado):
//   node scripts/importar-atividades.mjs                 -> só simula: mostra quantas atividades e como foram classificadas
//   node scripts/importar-atividades.mjs --gravar        -> importa tudo o que ainda não está no Portal (pode rodar de novo: só traz o que falta)
//   opções: --etapa iniciais  --limite 100
import { createRequire } from 'node:module';
const req = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, applicationDefault } = req('firebase-admin/app');
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const A = await import('../functions/atividades.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const GRAVAR = process.argv.includes('--gravar');
const etapas = arg('etapa') ? [arg('etapa')] : Object.keys(A.RAIZES);
const limite = Number(arg('limite', 100000));

if (!GRAVAR) {
  const ja = await A.conhecidos(); let total = 0, novos = 0; const porComp = {}, semAno = {}, amostra = [];
  for (const e of etapas) {
    const arqs = await A.listarEtapa(e), grupos = A.agrupar(arqs);
    console.log(`${e}: ${arqs.length} arquivos no Drive -> ${grupos.length} atividades (sem repetição)`);
    for (const g of grupos) {
      total++; if (!g.ids.some(id => ja.has(id))) novos++;
      const c = A.classificar(e, g.principal.caminho, g.principal.name), k = e + ' · ' + c.componente;
      porComp[k] = porComp[k] || {}; (c.anos.length ? c.anos : ['(sem ano)']).forEach(a => porComp[k][a] = (porComp[k][a] || 0) + 1);
      if (!c.anos.length) semAno[k] = (semAno[k] || 0) + 1;
      if (amostra.length < 40 && Math.random() < 0.02) amostra.push(`${c.categoria} | ${c.titulo} | ${c.anos.join(',')} | ${c.bncc.join(',')} | ${c.componente}`);
    }
  }
  console.log('\nPOR COMPONENTE E ANO'); Object.entries(porComp).sort().forEach(([k, v]) => console.log(' ', k, JSON.stringify(v)));
  console.log('\nAMOSTRA DE TÍTULOS'); amostra.forEach(x => console.log(' ', x));
  console.log(`\nTOTAL ${total} atividades · ${novos} ainda não estão no Portal. Simulação: use --gravar para importar.`);
  process.exit(0);
}
let rodada = 0;
while (true) {
  rodada++;
  const r = await A.sincronizar({ limite: Math.min(limite, 400), etapas, log: m => console.log(m), paralelo: Number(arg("paralelo", 16)) });
  console.log(`RODADA ${rodada}: ${r.importadas} importadas, ${r.erros} com erro, ${r.restantes} restantes`);
  if (!r.importadas || !r.restantes || rodada * 400 >= limite) break;
}
await A.atualizarResumo();
console.log('FIM');
process.exit(0);   // o firebase-admin deixa conexões abertas: sem isto o processo não termina
