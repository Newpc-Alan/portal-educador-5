// Formação Continuada · lembrete automático para quem parou um curso (nov/2026).
// Todo dia útil às 9h10 (Campo Grande): curso começado, não concluído, sem acesso há 7 dias ou mais
// -> e-mail com o curso, a aula onde parou e o botão "Continuar de onde parei".
// No máximo 3 lembretes por curso, com 14 dias entre eles; para quem desmarcou "lembretes" no perfil, nada.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { emailAlerta } from './dicas.js';

const SMTP_SENHA = defineSecret('SMTP_SENHA');
const DIA = 864e5, PARADO = 7 * DIA, INTERVALO = 14 * DIA, MAX_POR_CURSO = 3, MAX_POR_RODADA = 150;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const msISO = s => { const t = Date.parse(s || ''); return isNaN(t) ? 0 : t; };
const msTs = v => v && typeof v.toMillis === 'function' ? v.toMillis() : 0;

// pura: quem deve receber (testável sem banco)
export function devoLembrar(p, estado, agora) {
  if (!p || p.concluido === true) return false;
  const ult = Math.max(msISO(p.ultimoAcessoISO), msTs(p.atualizadoEm));
  if (!ult || agora - ult < PARADO) return false;
  const n = (estado && estado.n) || 0, ultEnvio = (estado && estado.ultimo_ms) || 0;
  if (n >= MAX_POR_CURSO) return false;
  if (ultEnvio && agora - ultEnvio < INTERVALO) return false;
  if (ultEnvio && ult > ultEnvio) return true;   // voltou a estudar depois do último lembrete e parou de novo: conta de novo, mas respeita o máximo
  return true;
}

export function emailLembrete({ nome, curso, aula, pct, faltam, link, dias }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'professor(a)';
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0c2338;max-width:600px">
<div style="background:#0f2c4a;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:17px">Seu curso está esperando por você</b><br><span style="color:#8DC63F;font-size:12px">Formação Continuada · Portal do Educador</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
<p style="margin:0 0 12px">Olá, ${esc(primeiro)}.</p>
<p style="margin:0 0 12px">Faz ${dias} dias que você não avança em <b>${esc(curso)}</b>. Você já fez <b>${pct}%</b>${faltam ? ` e faltam <b>${faltam} aula${faltam > 1 ? 's' : ''}</b>` : ''} para chegar à avaliação e ao certificado.</p>
${aula ? `<p style="margin:0 0 16px">Você parou em: <b>${esc(aula)}</b>.</p>` : ''}
<a href="${esc(link)}" style="display:inline-block;background:#1a6b2a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Continuar de onde parei</a>
<p style="margin:16px 0 0;color:#3c4b5f">Dica: 20 minutos no horário de planejamento já fecham uma aula.</p>
<p style="font-size:12px;color:#6b7c90;margin:18px 0 0">Você recebe este lembrete porque começou o curso na Formação Continuada do Portal do Educador. Para não receber mais, abra a Formação, toque no seu nome no topo da página e desmarque "Lembretes por e-mail".</p>
</div></div>`;
}

async function rodada(db, { simular = false, so } = {}) {
  const agora = Date.now(), cursos = {}, enviados = [], pulados = { optout: 0, sem_email: 0, curso_fora: 0, inativo: 0 };
  const progs = await db.collectionGroup('progresso').get();
  const candidatos = [];
  progs.forEach(d => { const u = d.ref.parent.parent; if (u && u.parent.id === 'users' && (!so || u.id === so)) candidatos.push({ uid: u.id, cursoId: d.id, p: d.data() }); });
  for (const c of candidatos) {
    if (enviados.length >= MAX_POR_RODADA) break;
    const estRef = db.doc(`formacao_lembretes/${c.uid}__${c.cursoId}`), est = (await estRef.get()).data();
    if (!devoLembrar(c.p, est, agora)) continue;
    if (!(c.cursoId in cursos)) {
      const cs = await db.doc(`cursos/${c.cursoId}`).get();
      cursos[c.cursoId] = cs.exists && cs.data().status === 'publicado'
        ? { titulo: cs.data().titulo, aulas: (await cs.ref.collection('aulas').get()).docs.map(a => ({ id: a.id, ...a.data() })) } : null;
    }
    const curso = cursos[c.cursoId]; if (!curso) { pulados.curso_fora++; continue; }
    const [fs, ps] = await Promise.all([db.doc(`users/${c.uid}`).get(), db.doc(`usuarios/${c.uid}`).get()]);
    const f = fs.data() || {}, p = ps.data();
    if (f.lembretes === false) { pulados.optout++; continue; }
    if (p && p.status && p.status !== 'ativo') { pulados.inativo++; continue; }
    const email = String(f.email || (p && p.email) || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || /@aluno\.portaldoeducador\.com\.br$/.test(email)) { pulados.sem_email++; continue; }
    const feitas = new Set(c.p.aulasVerificadas || []), total = curso.aulas.length;
    const pct = total ? Math.round(feitas.size / total * 100) : Number(c.p.percentual || 0);
    const aula = curso.aulas.find(a => a.id === c.p.ultimaAula);
    const ult = Math.max(msISO(c.p.ultimoAcessoISO), msTs(c.p.atualizadoEm));
    const link = `https://www.portaldoeducador.com.br/formacao/#/${aula ? `aula/${c.cursoId}/${aula.id}` : `curso/${c.cursoId}`}`;
    const html = emailLembrete({ nome: f.nome || (p && p.nome), curso: curso.titulo, aula: aula && aula.titulo, pct, faltam: Math.max(0, total - feitas.size), link, dias: Math.floor((agora - ult) / DIA) });
    if (!simular) {
      await emailAlerta(email, `Continue o curso "${String(curso.titulo || '').slice(0, 80)}"`, html);
      await estRef.set({ uid: c.uid, cursoId: c.cursoId, n: ((est && est.n) || 0) + 1, ultimo_ms: agora, em: FieldValue.serverTimestamp() }, { merge: true });
    }
    enviados.push({ cursoId: c.cursoId, pct });
  }
  return { enviados: enviados.length, pulados, candidatos: candidatos.length };
}

export const lembretesFormacao = onSchedule({ region: 'southamerica-east1', schedule: '10 9 * * 1-5', timeZone: 'America/Campo_Grande', secrets: [SMTP_SENHA], timeoutSeconds: 540, memory: '512MiB' }, async () => {
  const db = getFirestore(), r = await rodada(db);
  await db.doc('stats/formacao_lembretes').set({ [new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10)]: r }, { merge: true });
  console.log('lembretes da Formação', JSON.stringify(r));
});

// administrador: simula a rodada (quantos receberiam) ou manda o lembrete só para si, para conferir o e-mail
export const lembretesFormacaoTeste = onCall({ region: 'southamerica-east1', secrets: [SMTP_SENHA], timeoutSeconds: 300 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), eu = (await db.doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!eu || eu.perfil !== 'admin') throw new HttpsError('permission-denied', 'Só o administrador.');
  if (req.data && req.data.paraMim) {
    return { exemplo: true, ...(await emailAlerta(req.auth.token.email, 'Teste · lembrete da Formação Continuada',
      emailLembrete({ nome: eu.nome, curso: 'Lousa Digital - NEWPC TECNOLOGIA', aula: 'Introdução à lousa digital', pct: 25, faltam: 12, link: 'https://www.portaldoeducador.com.br/formacao/', dias: 9 })).then(() => ({ enviado: true }))) };
  }
  return rodada(db, { simular: true });
});
