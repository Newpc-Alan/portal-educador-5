// Avisos às famílias por e-mail (contatos do cadastro Famílias: alunos_familia).
// Cada escola liga os seus em avisos_config/{escola} (o gestor decide; começa tudo desligado).
//   falta      faltou o dia inteiro, sem justificativa (sai ao fim do turno, depois das chamadas)
//   seguidos   3º dia seguido faltando: aviso mais firme pedindo contato
//   fora_sala  entrou pela portaria, mas está com falta em aula(s) do dia (sai ao fim do turno: dá tempo de a escola corrigir chamada errada)
//   chegada    "chegou à escola às 07:05", na hora da leitura da carteirinha
//   comunicado mensagem escrita pelo gestor para as famílias das turmas escolhidas
// Registro de tudo em avisos_familia/{tipo}_{aluno}_{dia}: o ID evita aviso repetido mesmo se a função rodar duas vezes.
// Limite de segurança: a conta de envio (Google Workspace) aceita cerca de 2.000 e-mails por dia; acima de LIMITE_DIA, para e registra.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { transporte, escHtml as esc, SMTP_SENHA, SMTP_USUARIO, REGIAO_FIRESTORE } from './dicas.js';
import * as FREQ from './frequencia-nucleo.js';

export const LIMITE_DIA = 1500;
const OPC = { region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] };
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const dataLonga = d => SEMANA[new Date(d + 'T12:00:00Z').getUTCDay()] + ', ' + d.slice(8, 10) + '/' + d.slice(5, 7);
const primeiro = n => String(n || '').trim().split(/\s+/)[0] || '';
export const turnoNorm = t => { const x = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return /^mat|manha/.test(x) ? 'matutino' : /^vesp|tarde/.test(x) ? 'vespertino' : /^not/.test(x) ? 'noturno' : /^int/.test(x) ? 'integral' : ''; };

// destinatários: e-mails dos responsáveis, se a família aceita avisos
export function destinatarios(f) {
  if (!f || !(f.responsaveis || []).length) return { st: 'sem_contato', para: [] };
  if (f.aceita_avisos === false) return { st: 'sem_aceite', para: [] };
  const para = [...new Set(f.responsaveis.map(r => String(r.email || '').trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  return para.length ? { st: 'ok', para } : { st: 'sem_email', para: [] };
}

// textos dos avisos (o nome do responsável principal abre a mensagem)
export function montar(tipo, x) {
  const al = esc(x.aluno), pri = esc(primeiro(x.aluno)), escola = esc(x.escola), dia = dataLonga(x.dia);
  const oi = `<p>Olá${x.resp ? ', ' + esc(primeiro(x.resp)) : ''}.</p>`;
  if (tipo === 'falta') return { assunto: `${primeiro(x.aluno)} faltou hoje · ${x.escola}`, html: oi +
    `<p>A <b>${escola}</b> registrou que <b>${al}</b> não esteve nas aulas de hoje, ${dia}${x.turma ? ' (turma ' + esc(x.turma) + ')' : ''}.</p>` +
    `<p>Se a falta teve um motivo (doença, consulta, viagem), avise a secretaria da escola para registrar a justificativa. Cada dia de aula faz diferença no aprendizado.</p>` };
  if (tipo === 'seguidos') return { assunto: `${primeiro(x.aluno)} está há ${x.dias} dias sem vir à escola · ${x.escola}`, html: oi +
    `<p><b>${al}</b> está há <b>${x.dias} dias letivos seguidos</b> sem comparecer à <b>${escola}</b> (último: hoje, ${dia}).</p>` +
    `<p>Pedimos que entre em contato com a escola o quanto antes. Queremos entender o que está acontecendo e ajudar ${pri} a voltar às aulas.</p>` };
  if (tipo === 'fora_sala') return { assunto: `Entrada de ${primeiro(x.aluno)} na escola e faltas de hoje · ${x.escola}`, html: oi +
    `<p>A carteirinha de <b>${al}</b> registrou a entrada na <b>${escola}</b> hoje, ${dia}, às <b>${esc(x.hora)}</b>, mas ${pri} consta como ausente em ${x.todas ? 'todas as aulas' : 'parte das aulas'} do dia${x.disc ? ' (' + esc(x.disc) + ')' : ''}.</p>` +
    `<p>A escola está verificando. Se você souber de algum motivo, fale com a coordenação.</p>` };
  if (tipo === 'chegada') return { assunto: `${primeiro(x.aluno)} chegou à escola às ${x.hora}`, html: oi +
    `<p><b>${al}</b> passou a carteirinha na entrada da <b>${escola}</b> hoje, ${dia}, às <b>${esc(x.hora)}</b>.</p>` };
  return { assunto: `${x.titulo} · ${x.escola}`, html: oi + `<p style="font-size:16px"><b>${esc(x.titulo)}</b></p>` +
    String(x.texto || '').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + `<p style="color:#6b7c90">Mensagem enviada pela gestão da escola${x.por ? ' (' + esc(x.por) + ')' : ''}.</p>` };
}
const moldura = (escola, corpo) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0c2338;max-width:600px">
<div style="background:#0c2338;color:#fff;padding:14px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">${esc(escola)}</b><br><span style="color:#8DC63F;font-size:12px">Aviso à família · Portal do Educador</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">${corpo}
<p style="margin-top:22px;color:#6b7c90;font-size:12px">Este e-mail é automático: para falar com a escola, procure a secretaria ou a coordenação. Se não quiser mais receber avisos por e-mail, avise a escola.</p></div></div>`;

// reserva o envio (ID único por aviso) e conta no limite do dia; devolve a referência ou null se já existe
async function reservar(db, id, base) {
  const ref = db.doc(`avisos_familia/${id}`);
  try { await ref.create({ ...base, status: 'enviando', em: FieldValue.serverTimestamp() }); } catch (e) { if (e.code === 6 || /already exists/i.test(e.message)) return null; throw e; }
  return ref;
}
async function cabeNoLimite(db, dia, n = 1) {
  const ref = db.doc(`avisos_contador/${dia}`);
  return db.runTransaction(async tx => { const s = await tx.get(ref), atual = (s.exists && s.data().n) || 0; if (atual + n > LIMITE_DIA) return false; tx.set(ref, { n: atual + n, dia }, { merge: true }); return true; });
}
// envia um aviso: reserva, confere contato e limite, manda e registra
async function avisar(db, tr, { tipo, id, f, escola, aluno, base, dados }) {
  const ref = await reservar(db, id, base); if (!ref) return 'repetido';
  const d = destinatarios(f);
  if (d.st !== 'ok') { await ref.update({ status: d.st }); return d.st; }
  if (!(await cabeNoLimite(db, base.dia))) { await ref.update({ status: 'limite' }); return 'limite'; }
  const resp = (f.responsaveis.find(r => r.principal) || f.responsaveis[0] || {}).nome || '';
  const m = montar(tipo, { ...dados, aluno, escola, resp, dia: base.dia });
  try {
    await tr.sendMail({ from: `"${escola.replace(/"/g, '')} · Portal do Educador" <${SMTP_USUARIO.value()}>`, to: d.para.join(', '), subject: m.assunto, html: moldura(escola, m.html) });
    await ref.update({ status: 'enviado', para: d.para, assunto: m.assunto.slice(0, 200) }); return 'enviado';
  } catch (e) { await ref.update({ status: 'erro', erro: String(e.message || e).slice(0, 200) }); return 'erro'; }
}

// ===== fim de turno: falta, 3 dias seguidos e "entrou, mas está com falta" =====
async function fimDeTurno(alvos) {
  const db = getFirestore(), dia = hojeMS(), ano = +dia.slice(0, 4), cfgs = await db.collection('avisos_config').get();
  const tr = transporte(), conta = {};
  for (const c of cfgs.docs) {
    const cfg = c.data(), escolaId = c.id;
    if (!cfg.falta_dia && !cfg.seguidos && !cfg.fora_sala) continue;
    const esc0 = (await db.doc(`escolas/${escolaId}`).get()).data() || {}, nomeEsc = esc0.nome || 'Escola';
    const [st, sr, se, sf, sc] = await Promise.all([
      db.collection('turmas').where('escola_id', '==', escolaId).get(),
      db.collection('freq_resumo').where('escola_id', '==', escolaId).where('ano', '==', ano).get(),
      db.collection('freq_entradas').where('escola_id', '==', escolaId).where('dia', '==', dia).get(),
      db.collection('alunos_familia').where('escola_id', '==', escolaId).get(),
      cfg.fora_sala ? db.collection('freq_chamadas').where('escola_id', '==', escolaId).where('dia', '==', dia).get() : Promise.resolve(null)
    ]);
    const turno = {}; st.forEach(d => { turno[d.id] = turnoNorm(d.data().turno); });
    const ent = {}; se.forEach(d => Object.entries(d.data().entradas || {}).forEach(([id, h]) => { ent[id] = h; }));
    const fam = {}; sf.forEach(d => { fam[d.id] = d.data(); });
    const discDe = {}; if (sc) sc.forEach(d => { const x = d.data(); Object.entries(x.faltas || {}).forEach(([id, n]) => { if (+n > 0) (discDe[id] = discDe[id] || []).push(x.disciplina); }); });
    for (const rd of sr.docs) {
      const r = rd.data(); if (!(r.turma_id in turno) || !alvos.includes(turno[r.turma_id])) continue;
      const d = r.dias && r.dias[dia] ? FREQ.decodificar(r.dias[dia]) : null; if (!d || !d.a) continue; // sem chamada hoje: não avisa
      for (const [id, a] of Object.entries(r.alunos || {})) {
        if (a.t !== dia) continue; // aluno não estava na chamada de hoje
        const x = FREQ.conciliar(id, ent[id] || '', d);
        let tipo = null, dados = { turma: r.turma_nome || '' };
        if (x.s === 'ausente' && !x.j) { if (cfg.seguidos && a.s === FREQ.DIAS_SEGUIDOS) { tipo = 'seguidos'; dados.dias = a.s; } else if (cfg.falta_dia) tipo = 'falta'; }
        else if ((x.s === 'saiu' || x.s === 'parcial') && cfg.fora_sala) { tipo = 'fora_sala'; dados = { ...dados, hora: ent[id], todas: x.s === 'saiu', disc: [...new Set(discDe[id] || [])].join(', ') }; }
        if (!tipo) continue;
        const base = { tipo, escola_id: escolaId, municipio_id: r.municipio_id || '', aluno_id: id, aluno_nome: String(a.n || '').slice(0, 80), turma_id: r.turma_id, turma_nome: String(r.turma_nome || '').slice(0, 80), dia };
        const res = await avisar(db, tr, { tipo, id: `${tipo}_${id}_${dia}`, f: fam[id], escola: nomeEsc, aluno: a.n || 'Aluno', base, dados });
        conta[res] = (conta[res] || 0) + 1;
      }
    }
  }
  console.log('avisos fim de turno', alvos.join(','), conta);
}
const AGENDA = { timeZone: 'America/Campo_Grande', timeoutSeconds: 540, memory: '512MiB' };
export const avisosFamiliaManha = onSchedule({ ...OPC, ...AGENDA, schedule: '40 12 * * 1-6' }, () => fimDeTurno(['matutino']));
export const avisosFamiliaTarde = onSchedule({ ...OPC, ...AGENDA, schedule: '10 18 * * 1-6' }, () => fimDeTurno(['matutino', 'vespertino', 'integral', '']));
export const avisosFamiliaNoite = onSchedule({ ...OPC, ...AGENDA, schedule: '40 22 * * 1-6' }, () => fimDeTurno(['matutino', 'vespertino', 'integral', '', 'noturno']));

// ===== chegada: na hora em que a carteirinha é lida (só entradas novas e do dia) =====
export const avisoChegada = onDocumentWritten({ ...OPC, document: 'freq_entradas/{id}', timeoutSeconds: 120, maxInstances: 10 }, async (event) => {
  const depois = event.data.after && event.data.after.exists ? event.data.after.data() : null; if (!depois) return;
  const antes = (event.data.before && event.data.before.exists && event.data.before.data().entradas) || {};
  const dia = hojeMS(); if (depois.dia !== dia) return;
  const novos = Object.keys(depois.entradas || {}).filter(id => !antes[id]); if (!novos.length) return;
  const db = getFirestore(), cfg = (await db.doc(`avisos_config/${depois.escola_id}`).get()).data();
  if (!cfg || !cfg.chegada) return;
  const nomeEsc = ((await db.doc(`escolas/${depois.escola_id}`).get()).data() || {}).nome || 'Escola';
  const fams = await db.getAll(...novos.map(id => db.doc(`alunos_familia/${id}`)));
  const tr = transporte();
  for (const s of fams) {
    const id = s.id, nome = (depois.nomes || {})[id] || 'Aluno';
    const base = { tipo: 'chegada', escola_id: depois.escola_id, municipio_id: depois.municipio_id || '', aluno_id: id, aluno_nome: String(nome).slice(0, 80), turma_id: depois.turma_id, turma_nome: String(depois.turma_nome || '').slice(0, 80), dia };
    await avisar(db, tr, { tipo: 'chegada', id: `chegada_${id}_${dia}`, f: s.exists ? s.data() : null, escola: nomeEsc, aluno: nome, base, dados: { hora: depois.entradas[id] } });
  }
});

// ===== comunicado escrito pelo gestor =====
export const comunicadoFamilias = onDocumentCreated({ ...OPC, document: 'comunicados_familia/{id}', timeoutSeconds: 540, memory: '512MiB' }, async (event) => {
  const snap = event.data; if (!snap) return;
  const c = snap.data(), db = getFirestore(), dia = hojeMS();
  if (c.status !== 'pendente' || !c.escola_id) return;
  await snap.ref.update({ status: 'enviando' });
  const nomeEsc = ((await db.doc(`escolas/${c.escola_id}`).get()).data() || {}).nome || c.escola_nome || 'Escola';
  const todas = (c.turmas || []).includes('*'), alvo = new Set(c.turmas || []);
  const [sa, sf] = await Promise.all([db.collection('alunos').where('escola_id', '==', c.escola_id).get(), db.collection('alunos_familia').where('escola_id', '==', c.escola_id).get()]);
  const fam = {}; sf.forEach(d => { fam[d.id] = d.data(); });
  const alunos = sa.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.nome && a.status !== 'inativo' && (todas || alvo.has(a.turma_id)));
  const tot = { alunos: alunos.length, enviados: 0, sem_contato: 0, erro: 0, limite: 0, irmaos: 0 };
  const jaMandado = new Set(), tr = transporte();
  for (const a of alunos) {
    const base = { tipo: 'comunicado', comunicado_id: snap.id, escola_id: c.escola_id, municipio_id: c.municipio_id || '', aluno_id: a.id, aluno_nome: String(a.nome).slice(0, 80), turma_id: a.turma_id, turma_nome: String(a.turma_nome || '').slice(0, 80), dia };
    const d = destinatarios(fam[a.id]);
    // irmãos com o mesmo e-mail recebem uma vez só
    if (d.st === 'ok' && d.para.every(e => jaMandado.has(e))) { tot.irmaos++; continue; }
    const r = await avisar(db, tr, { tipo: 'comunicado', id: `com_${snap.id}_${a.id}`, f: fam[a.id], escola: nomeEsc, aluno: a.nome, base, dados: { titulo: c.titulo, texto: c.texto, por: c.criado_por_nome } });
    if (r === 'enviado') { tot.enviados++; d.para.forEach(e => jaMandado.add(e)); } else if (r === 'erro') tot.erro++; else if (r === 'limite') tot.limite++; else if (r !== 'repetido') tot.sem_contato++;
  }
  await snap.ref.update({ status: 'enviado', totais: tot, enviado_em: FieldValue.serverTimestamp() });
});
