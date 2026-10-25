// Teste das contas da Frequência digital (functions/frequencia-nucleo.js) e da cópia usada pelo navegador.
// Rodar: node scripts/teste-frequencia.mjs
import { readFileSync } from 'node:fs';
import * as F from '../functions/frequencia-nucleo.js';

let ok = 0, falhas = 0;
const t = (nome, cond) => { if (cond) ok++; else { falhas++; console.log('FALHOU:', nome); } };

t('cópia do navegador idêntica', readFileSync(new URL('../functions/frequencia-nucleo.js', import.meta.url), 'utf8') === readFileSync(new URL('../assets/js/frequencia-nucleo.js', import.meta.url), 'utf8'));

const lista = ['a1', 'a2', 'a3'], nomes = { a1: 'Ana', a2: 'Bruno', a3: 'Carla' };
const ch = (aulas, faltas, just, l) => ({ aulas, faltas: faltas || {}, just: just || {}, lista: l || lista, nomes, ano: 2026 });

// um dia com duas chamadas (Português 2 aulas, Matemática 3 aulas)
const d = F.dia([ch(2, { a1: 2, a2: 1 }), ch(3, { a1: 3, a3: 9 }, { a3: true })]);
t('aulas do dia somam', d.a === 5);
t('faltas somam por aluno', d.f.a1 === 5 && d.f.a2 === 1);
t('falta não passa do número de aulas da chamada', d.f.a3 === 3);
t('justificativa só vale para quem faltou', d.j.length === 1 && d.j[0] === 'a3');

// três dias seguidos: Ana falta tudo, Carla falta tudo mas justificado no 3º dia
let r = null;
r = F.aplicarDia(r, '2026-03-02', [ch(4, { a1: 4, a3: 4 })], 75);
r = F.aplicarDia(r, '2026-03-03', [ch(4, { a1: 4, a3: 4 })], 75);
r = F.aplicarDia(r, '2026-03-04', [ch(4, { a1: 4, a3: 4 }, { a3: true })], 75);
t('Ana: 3 dias seguidos', r.alunos.a1.s === 3 && r.alunos.a1.at === true);
t('Carla: justificado quebra a sequência', r.alunos.a3.s === 0 && r.alunos.a3.at === false);
t('Ana: 12 aulas e 12 faltas', r.alunos.a1.a === 12 && r.alunos.a1.f === 12 && r.alunos.a1.p === 0);
t('Ana em risco (12 aulas, 0%)', r.alunos.a1.r === true);
t('Bruno sem alerta', r.alunos.a2.r === false && r.alunos.a2.at === false && r.alunos.a2.p === 100);
t('nomes copiados', r.alunos.a2.n === 'Bruno');
t('alerta na turma', r.alerta === true && r.atencao === 1 && r.total_dias === 3 && r.total_aulas === 12);

// refazer o mesmo dia não muda nada (a função pode rodar duas vezes)
const r2 = F.aplicarDia(r, '2026-03-04', [ch(4, { a1: 4, a3: 4 }, { a3: true })], 75);
t('idempotente', JSON.stringify(r2.alunos) === JSON.stringify(r.alunos));

// Ana volta: sequência zera
r = F.aplicarDia(r, '2026-03-05', [ch(4, {})], 75);
t('presença zera a sequência', r.alunos.a1.s === 0 && r.alunos.a1.u === '2026-03-04');

// apagar a chamada de um dia tira o dia
r = F.aplicarDia(r, '2026-03-05', [], 75);
t('chamada apagada sai do resumo', !('2026-03-05' in r.dias) && r.total_dias === 3);

// aluno que entrou depois: aulas só a partir do primeiro dia na lista
r = F.aplicarDia(r, '2026-03-09', [ch(4, {}, {}, [...lista, 'a4'])], 75);
t('aluno novo conta só a partir da entrada', r.alunos.a4.a === 4 && r.alunos.a1.a === 16);

// pouca aula: não acusa risco antes de 10 aulas
const p = F.aplicarDia(null, '2026-02-10', [ch(4, { a2: 4 })], 75);
t('sem risco com menos de 10 aulas', p.alunos.a2.r === false && p.alunos.a2.p === 0);

// lista de busca ativa e agregado do painel
const res = [{ ...r, turma_id: 't1', turma_nome: '5º A', escola_id: 'e1' }];
const l = F.emRisco(res);
t('busca ativa: Ana e Carla (justificada ainda conta na frequência)', l.length === 2 && l[0].nome === 'Ana' && l[1].nome === 'Carla' && l.every(x => x.risco));
const g = F.agregar(res, '2026-03-10');
t('agregado sem nomes', g.alunos === 4 && g.risco === 2 && g.turmas === 1 && g.turmas7 === 1 && !JSON.stringify(g).includes('Ana'));
t('frequência média', Math.abs(g.freq - (1 - (12 + 0 + 12 + 0) / (16 + 16 + 16 + 4))) < 1e-9);

// texto ruim no banco não derruba a conta
t('dia corrompido vira zero', F.totais({ '2026-03-01': '{x' }, { a1: { d: '2026-03-01', t: '2026-03-01' } }, 75).alunos.a1.a === 0);

console.log(`${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
