// Rede Municipal de Demonstração: resultados SIMULADOS dos jogos (Painel dos Jogos, por turma e por escola), para apresentações.
// Só grava para a rede demo-rede, em alunos fictícios que já existem (consulta demo-criar-gravar). Todo documento leva demo:true,
// id começando com "demo-jg-" e municipio_id demo-rede: a consulta demo-apagar-gravar remove junto com o resto.
// Idempotente: rodar de novo refaz os mesmos documentos (sorteio com semente fixa), com as datas relativas ao dia da execução.
// Retrato de propósito desigual, como numa rede de verdade: uma escola usa muito, uma usa bem, uma usa pouco e uma só na lousa.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), M = 'demo-rede', DIA = 864e5, agora = Date.now();
const iso = ms => new Date(ms - 4 * 36e5).toISOString().slice(0, 10);
let semente = 20261114; const rnd = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
const ent = (a, b) => a + Math.floor(rnd() * (b - a + 1)), um = l => l[Math.floor(rnd() * l.length)];

const turmas = (await db.collection('turmas').where('municipio_id', '==', M).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.demo === true);
if (!turmas.length) { console.log('::error::A rede de demonstração não existe (nenhuma turma demo). Rode antes a consulta demo-criar-gravar.'); process.exit(1); }
const alunos = (await db.collection('alunos').where('municipio_id', '==', M).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.demo === true);
const profs = (await db.collection('usuarios').where('municipio_id', '==', M).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.demo === true && u.perfil === 'professor');
const escolas = [...new Set(turmas.map(t => t.escola_id))].sort();

// jogos por ano, com as habilidades que cada um realmente treina (os mesmos códigos dos jogos publicados)
const JOGOS = {
  3: [['tabuada', 5, ['EF03MA07', 'EF03MA03']], ['que-horas-sao', 6, ['EF03MA23', 'EF03MA22']], ['explorando-habitats', 6, ['EF03CI04', 'EF03CI06']], ['mouse-e-teclado', 6, ['MT-CLICAR', 'MT-DUPLO', 'MT-ARRASTAR']]],
  4: [['tabuada', 5, ['EF03MA03', 'EF04MA04', 'EF04MA07']], ['fracao-magica', 6, ['EF04MA09']], ['que-horas-sao', 6, ['EF03MA22', 'EF04MA22']], ['sistema-solar', 6, ['EF03CI08', 'EF04CI11']]],
  5: [['fracao-magica', 6, ['EF05MA03', 'EF05MA04', 'EF05MA05']], ['corpo-humano', 6, ['EF05CI06', 'EF05CI07', 'EF05CI08']], ['sistema-solar', 6, ['EF05CI11', 'EF05CI12']], ['tabuada', 5, ['EF04MA04', 'EF04MA07']]]
};
// dificuldade de cada habilidade (chance de acertar de primeira para um aluno mediano)
const BASE = { EF03MA07: .84, EF03MA03: .56, EF03MA23: .68, EF03MA22: .6, EF03CI04: .8, EF03CI06: .74, 'MT-CLICAR': .93, 'MT-DUPLO': .5, 'MT-ARRASTAR': .72, EF04MA04: .63, EF04MA07: .52, EF04MA09: .77,
  EF04MA22: .58, EF03CI08: .82, EF04CI11: .66, EF05MA03: .71, EF05MA04: .49, EF05MA05: .57, EF05CI06: .7, EF05CI07: .58, EF05CI08: .81, EF05CI11: .64, EF05CI12: .69 };
// perfil de uso por escola (na ordem dos ids): participação dos alunos, rodadas por aluno, ajuste de acerto, rodadas na lousa
const PERFIL = [{ part: .86, rod: [3, 10], aj: 0, lousa: 14 }, { part: .6, rod: [2, 7], aj: .08, lousa: 26 }, { part: .24, rod: [1, 4], aj: -.04, lousa: 9 }, { part: 0, rod: [0, 0], aj: 0, lousa: 5 }];
const diasUteis = []; for (let d = 0; d < 30; d++) { const ms = agora - d * DIA, s = new Date(ms - 4 * 36e5).getUTCDay(); if (s !== 0 && s !== 6) diasUteis.push(ms); }

let lote = db.batch(), nLote = 0, total = 0, nLousa = 0;
const grava = async (id, dados) => { lote.set(db.doc(`jogo_resultados/${id}`), dados); nLote++; total++; if (nLote >= 400) { await lote.commit(); lote = db.batch(); nLote = 0; } };
function rodada(lista, habil, nivelMax) {
  const [jogo, niveis, habs] = um(lista), tot = jogo === 'tabuada' || jogo === 'que-horas-sao' || jogo === 'fracao-magica' ? 10 : 8, usadas = habs.length > 2 && rnd() < .5 ? habs.slice(0, 2) : habs, hs = {};
  for (let q = 0; q < tot; q++) { const h = usadas[q % usadas.length], o = hs[h] || (hs[h] = { h, c: 0, t: 0 }); o.t++; if (rnd() < Math.max(.08, Math.min(.98, BASE[h] + habil))) o.c++; }
  const lh = Object.values(hs), ac = lh.reduce((s, x) => s + x.c, 0);
  return { jogo, niveis, nivel: Math.max(1, Math.min(niveis, Math.round(1 + ac / tot * (nivelMax - 1)))), total: tot, acertos: ac, habs: lh, duracao_s: ent(150, 420) };
}
for (const t of turmas) {
  const ano = +(String(t.nome || '').match(/^(\d)/) || [])[1] || 5, lista = JOGOS[ano] || JOGOS[5], P = PERFIL[Math.min(PERFIL.length - 1, escolas.indexOf(t.escola_id))];
  for (const a of alunos.filter(x => x.turma_id === t.id)) {
    if (rnd() >= P.part) continue;
    const habil = (rnd() - .5) * .34 + P.aj, n = ent(P.rod[0], P.rod[1]);
    for (let k = 0; k < n; k++) { const ms = um(diasUteis) - ent(0, 5) * 36e5, r = rodada(lista, habil + k * .012, 4);     // melhora um pouco a cada rodada
      await grava(`demo-jg-${a.id.slice(8)}-${k}`, { demo: true, ...r, dia: iso(ms), em: Timestamp.fromMillis(ms), modo: 'solo', perfil: 'aluno', uid: 'demo-' + a.id, aluno_id: a.id, turma_id: t.id, escola_id: t.escola_id, municipio_id: M }); }
  }
}
// rodadas que o professor conduz na lousa (modo Turma), sem aluno nem turma
escolas.forEach((e, i) => { const P = PERFIL[Math.min(PERFIL.length - 1, i)], ps = profs.filter(p => p.escola_id === e); if (!ps.length) return;
  for (let k = 0; k < P.lousa; k++) nLousa++; });
for (let i = 0; i < escolas.length; i++) { const e = escolas[i], P = PERFIL[Math.min(PERFIL.length - 1, i)], ps = profs.filter(p => p.escola_id === e); if (!ps.length) continue;
  for (let k = 0; k < P.lousa; k++) { const ms = um(diasUteis) - ent(0, 4) * 36e5, r = rodada(JOGOS[um([3, 4, 5])], P.aj + .06, 4);
    await grava(`demo-jg-lousa-${i + 1}-${k}`, { demo: true, ...r, dia: iso(ms), em: Timestamp.fromMillis(ms), modo: 'turma', perfil: 'equipe', uid: um(ps).id, aluno_id: '', turma_id: '', escola_id: e, municipio_id: M }); } }
if (nLote) await lote.commit();
// o Painel da Rede (e a visão dos jogos para a secretaria) é um módulo do plano: a rede de demonstração tem
await db.doc(`municipios/${M}`).set({ modulos_secretaria: ['painel'] }, { merge: true });
console.log(`::notice::Jogos da demonstração: ${total} rodadas simuladas (${total - nLousa} de alunos, ${nLousa} na lousa) em ${turmas.length} turmas de ${escolas.length} escolas · ${alunos.length} estudantes fictícios · módulo Painel ligado na rede demo`);
