// Confere o núcleo do Calendário: o bloco do app e o da Cloud Function precisam ser iguais, e as contas precisam bater.
//   node scripts/teste-calendario.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import CAL from '../functions/calendario-nucleo.js';
const bloco = s => s.slice(s.indexOf('/* NUCLEO-INICIO'), s.indexOf('/* NUCLEO-FIM */'));
const raiz = new URL('..', import.meta.url).pathname;
assert.equal(bloco(readFileSync(raiz + 'apps/calendario/index.html', 'utf8')), bloco(readFileSync(raiz + 'functions/calendario-nucleo.js', 'utf8')), 'núcleo do app diferente do da function');
assert.equal(readFileSync(raiz + 'assets/js/calendario-nucleo.js', 'utf8'), readFileSync(raiz + 'functions/calendario-nucleo.js', 'utf8'), 'cópia do núcleo em assets/js diferente');
assert.deepEqual([2024, 2025, 2026, 2027, 2028, 2030].map(CAL.pascoa), ['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2030-04-21']);
const f26 = CAL.feriados(2026, 'MS');
assert.ok(f26.some(f => f.data === '2026-02-16' && f.facultativo) && f26.some(f => f.data === '2026-06-04' && f.titulo === 'Corpus Christi'));
assert.ok(f26.some(f => f.data === '2026-11-20') && f26.some(f => f.data === '2026-10-11'));
assert.ok(!CAL.feriados(2026, 'SP').some(f => f.data === '2026-10-11'));
const R = { municipio_id: 'm1', ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', dias_semana: [1, 2, 3, 4, 5], horas_dia: 4, periodos: [], facultativos_letivos: [],
  eventos: [{ id: 'r', ini: '2026-07-13', fim: '2026-07-24', tipo: 'recesso', titulo: 'Recesso' }] };
const base = CAL.resumo(R, null, 'MS').total;
assert.equal(CAL.resumo({ ...R, facultativos_letivos: ['2026-02-16'] }, null, 'MS').total, base + 1, 'carnaval com aula');
assert.equal(CAL.resumo({ ...R, eventos: [...R.eventos, { id: 'f', ini: '2026-08-26', fim: '2026-08-26', tipo: 'feriado' }] }, null, 'MS').total, base - 1, 'feriado municipal');
const esc = { escola_id: 'e1', eventos: [{ id: 's', ini: '2026-08-29', tipo: 'sabado' }, { id: 'p', ini: '2026-09-14', fim: '2026-09-15', tipo: 'paralisacao' }], horas_dia: 5 };
const re = CAL.resumo(R, esc, 'MS');
assert.equal(re.total, base - 1, 'sábado +1, paralisação -2');
assert.equal(re.horas, (base - 1) * 5, 'horas da escola');
assert.equal(CAL.resumo(R, { eventos: [{ id: 'x', ini: '2026-07-15', tipo: 'reposicao' }] }, 'MS').total, base + 1, 'reposição no recesso da rede');
assert.equal(CAL.resumo(R, { eventos: [{ id: 'x', ini: '2026-12-26', tipo: 'sabado' }] }, 'MS').total, base, 'fora do ano letivo não conta');
const per = CAL.dividir(R, null, 'MS', 4);
assert.equal(per.length, 4); assert.ok(per[1].fim < '2026-07-13' && per[2].inicio > '2026-07-24', 'corta no recesso');
const r4 = CAL.resumo({ ...R, periodos: per }, null, 'MS'); assert.equal(r4.foraPeriodo, 0); assert.equal(r4.periodos.reduce((s, p) => s + p.dias, 0), base);
assert.equal(CAL.dividir(R, null, 'MS', 3).length, 3);
const ics = CAL.ics({ ...R, periodos: per }, esc, 'MS', 'Calendário · EM Centro, Vila; teste');
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
assert.ok(ics.split('\r\n').every(l => Buffer.byteLength(l) <= 75), 'linhas de até 75 bytes');
assert.ok(ics.replace(/\r\n /g, '').includes('X-WR-CALNAME:Calendário · EM Centro\\, Vila\\; teste'), 'nome escapado');
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
const uids = ics.match(/^UID:.*$/gm); assert.equal(new Set(uids).size, uids.length, 'UIDs únicos');
console.log('CALENDÁRIO: ok (' + base + ' dias na base de teste)');
