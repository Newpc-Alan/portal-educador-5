// Frequência digital: contas puras (sem banco), usadas pela função que monta o resumo da turma e pelos testes.
// Uma chamada (freq_chamadas) = um professor, uma turma, um dia, uma disciplina, N aulas.
// O resumo da turma no ano (freq_resumo/{turma}_{ano}) guarda:
//   dias:   { "AAAA-MM-DD": texto JSON { a: aulas no dia, f: { aluno: aulas faltadas }, j: [alunos com falta justificada] } }
//   alunos: { aluno: { n: nome, d: primeiro dia na lista, t: último dia na lista, a: aulas, f: faltas, j: faltas justificadas, s: dias seguidos faltando, u: último dia com falta } }
// Texto JSON por dia mantém o documento pequeno (só quem faltou aparece) e cada dia é refeito do zero: a conta é sempre a mesma, mesmo se a função rodar duas vezes.

export const MIN_AULAS_RISCO = 10;   // antes disso a porcentagem ainda oscila demais
export const DIAS_SEGUIDOS = 3;      // dias inteiros seguidos faltando, sem justificativa = busca ativa

const int = (v, max) => { const n = Math.round(Number(v) || 0); return Math.max(0, Math.min(max, n)); };

// junta as chamadas de UM dia de uma turma
export function dia(chamadas) {
  let a = 0; const f = {}, j = new Set(), lista = new Set(), nomes = {};
  for (const c of chamadas || []) {
    const aulas = int(c.aulas, 6); if (!aulas) continue;
    a += aulas;
    (Array.isArray(c.lista) ? c.lista : []).forEach(id => lista.add(String(id)));
    Object.entries(c.nomes || {}).forEach(([id, nm]) => { if (nm) nomes[id] = String(nm).slice(0, 80); });
    Object.entries(c.faltas || {}).forEach(([id, n]) => { const v = int(n, aulas); if (v) f[id] = (f[id] || 0) + v; });
    Object.entries(c.just || {}).forEach(([id, v]) => { if (v && f[id]) j.add(id); });
  }
  return { a, f, j: [...j].filter(id => f[id]), lista: [...lista], nomes };
}

export const codificar = d => JSON.stringify({ a: d.a, f: d.f, j: d.j });
export function decodificar(s) {
  try { const o = JSON.parse(s); return { a: int(o.a, 99), f: o.f && typeof o.f === 'object' ? o.f : {}, j: Array.isArray(o.j) ? o.j : [] }; }
  catch (e) { return { a: 0, f: {}, j: [] }; }
}

// refaz um dia dentro do resumo e recalcula os totais de todos os alunos
export function aplicarDia(resumo, D, chamadas, freqMin) {
  const dias = { ...((resumo && resumo.dias) || {}) };
  const alunos = {};
  Object.entries((resumo && resumo.alunos) || {}).forEach(([id, x]) => { alunos[id] = { n: x.n || '', d: x.d || D, t: x.t || D }; });
  const x = dia(chamadas);
  if (!x.a) delete dias[D];
  else {
    dias[D] = codificar(x);
    x.lista.forEach(id => {
      const al = alunos[id] || (alunos[id] = { n: '', d: D, t: D });
      if (x.nomes[id]) al.n = x.nomes[id];
      if (D < al.d) al.d = D; if (D > al.t) al.t = D;
    });
  }
  return { dias, ...totais(dias, alunos, freqMin) };
}

// totais por aluno a partir dos dias (aulas só contam entre o primeiro e o último dia em que o aluno esteve na lista)
export function totais(dias, base, freqMin) {
  const min = Number(freqMin) > 0 ? Number(freqMin) : 75;
  const ordem = Object.keys(dias).sort(), dec = {};
  ordem.forEach(d => { dec[d] = decodificar(dias[d]); });
  const alunos = {}; let risco = 0, atencao = 0, totalAulas = 0;
  ordem.forEach(d => { totalAulas += dec[d].a; });
  Object.entries(base).forEach(([id, b]) => {
    let a = 0, f = 0, j = 0, u = '';
    for (const d of ordem) {
      if (d < b.d || d > b.t) continue;
      const x = dec[d], fd = int(x.f[id], x.a);
      a += x.a; f += fd; if (fd && x.j.includes(id)) j += fd; if (fd) u = d;
    }
    // dias seguidos: do dia mais recente para trás, enquanto faltou o dia inteiro sem justificativa
    let s = 0;
    for (let i = ordem.length - 1; i >= 0; i--) {
      const d = ordem[i]; if (d > b.t) continue; if (d < b.d) break;
      const x = dec[d], fd = int(x.f[id], x.a);
      if (x.a && fd >= x.a && !x.j.includes(id)) s++; else break;
    }
    const freq = a ? Math.round(1000 * (a - f) / a) / 10 : null;
    const r = a >= MIN_AULAS_RISCO && freq !== null && freq < min, at = s >= DIAS_SEGUIDOS;
    if (r) risco++; if (at) atencao++;
    alunos[id] = { n: b.n || '', d: b.d, t: b.t, a, f, j, s, u, p: freq, r, at };
  });
  return { alunos, total_aulas: totalAulas, total_dias: ordem.length, ultimo_dia: ordem[ordem.length - 1] || '', risco, atencao, alerta: risco + atencao > 0, freq_min: min };
}

// lista para busca ativa: em risco primeiro, depois dias seguidos, depois menor frequência
export function emRisco(resumos) {
  const out = [];
  (resumos || []).forEach(r => Object.entries(r.alunos || {}).forEach(([id, a]) => {
    if (a.r || a.at) out.push({ id, nome: a.n, turma: r.turma_nome || '', turma_id: r.turma_id, escola_id: r.escola_id, freq: a.p, faltas: a.f, aulas: a.a, seguidos: a.s, ultima: a.u, risco: !!a.r, atencao: !!a.at });
  }));
  return out.sort((x, y) => (y.risco - x.risco) || (y.seguidos - x.seguidos) || ((x.freq ?? 101) - (y.freq ?? 101)) || String(x.nome).localeCompare(String(y.nome), 'pt-BR'));
}

// números da escola para o Painel (sem nomes)
export function agregar(resumos, hoje) {
  let alunos = 0, a = 0, f = 0, risco = 0, atencao = 0, alerta = 0, turmas = 0, turmas7 = 0;
  const lim = hoje ? semanaAntes(hoje) : '';
  (resumos || []).forEach(r => {
    turmas++; if (lim && (r.ultimo_dia || '') >= lim) turmas7++;
    Object.values(r.alunos || {}).forEach(x => { if (!x.a) return; alunos++; a += x.a; f += x.f; if (x.r) risco++; if (x.at) atencao++; if (x.r || x.at) alerta++; });
  });
  return { turmas, turmas7, alunos, aulas: a, faltas: f, freq: a ? (a - f) / a : null, risco, atencao, alerta };
}
function semanaAntes(d) { const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - 6 * 864e5, x = new Date(t); return x.toISOString().slice(0, 10); }

// Auditoria da portaria: cruza a entrada pela carteirinha com a chamada do professor, aluno por aluno, num dia.
//   entrou: hora da entrada ("07:12") ou vazio; d: dia da turma (saída de dia()) ou null quando ainda não houve chamada
// Situações:
//   ok          entrou e está presente na chamada
//   saiu        entrou e está com falta em TODAS as aulas do dia (o caso mais sério: entrou e não está na sala)
//   parcial     entrou e faltou parte das aulas (chegou atrasado na sala ou saiu antes)
//   sem_entrada está presente na chamada mas não passou a carteirinha (esqueceu, outro portão, emprestou)
//   ausente     não entrou e faltou (coerente)
//   so_entrada  entrou, mas a turma ainda não tem chamada no dia
//   sem_dados   nem entrada nem chamada
export const DIVERGENCIAS = ['saiu', 'parcial', 'sem_entrada'];
export function conciliar(id, entrou, d) {
  const a = d ? d.a : 0, f = d ? int((d.f || {})[id], a) : 0, j = !!(d && (d.j || []).includes(id));
  if (!a) return { s: entrou ? 'so_entrada' : 'sem_dados', a: 0, f: 0, j: false };
  const s = entrou ? (!f ? 'ok' : f >= a ? 'saiu' : 'parcial') : (f >= a ? 'ausente' : 'sem_entrada');
  return { s, a, f, j };
}
