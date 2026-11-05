// Comunicação automática com o professor (nov/2026): boas-vindas e avisos de licença por e-mail.
// Momentos: início do teste, fim do teste (2 dias antes), compra da licença avulsa, renovação,
// licença vencendo (7 dias antes), professor da rede aprovado e mudança de plano.
// Professor de rede: a mensagem valoriza o município ("a Prefeitura de X oferece o Portal a você").
// Cada envio grava comunicacoes/{uid}_{momento}_{chave} com create(): nunca manda o mesmo aviso duas vezes.
// WhatsApp: fase 2, quando os modelos forem aprovados pela Meta (o mesmo registro guarda o canal).
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { transporte, escHtml as esc, SMTP_SENHA, SMTP_USUARIO } from './dicas.js';

const REGIAO = 'southamerica-east1';
const SITE = 'https://www.portaldoeducador.com.br';
const ENTRAR = SITE + '/entrar/';
const LOGO = SITE + '/assets/pde-logo-256.png';
const LAB = 'lab-muni';
const NOME_PLANO = { basico: 'Básico', intermediario: 'Intermediário', completo: 'Completo', personalizado: 'Personalizado' };
const ITENS_PLANO = {
  basico: 'atividades prontas, vídeos, jogos, datas comemorativas, desenhos para colorir, histórias, biblioteca, museus virtuais e lousa interativa',
  intermediario: 'tudo do Básico, mais o Portal IA (sem imagens), a Formação Continuada, o Portal 360º VR e o Portal Maestro',
  completo: 'tudo do Intermediário, mais imagens no Portal IA e todos os recursos de sala de aula',
  personalizado: 'os recursos combinados com a sua instituição'
};
const ms = x => x && x.toMillis ? x.toMillis() : (x instanceof Date ? x.getTime() : (typeof x === 'string' && x ? Date.parse(x) || 0 : 0));
const dataBR = m => m ? new Date(m).toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' }) : '';
const primeiro = n => esc(String(n || '').trim().split(/\s+/)[0] || 'professor(a)');

export function moldura(titulo, corpo, rotulo, link) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#0c2338;max-width:600px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f2c4a;border-radius:12px 12px 0 0;border-bottom:4px solid #8DC63F"><tr>
<td width="76" style="padding:16px 0 16px 20px;vertical-align:middle"><img src="${LOGO}" width="60" height="60" alt="Portal do Educador" style="display:block;border:0;border-radius:50%"></td>
<td style="padding:16px 22px 16px 14px;vertical-align:middle;color:#fff"><b style="font-size:18px">${esc(titulo)}</b><br><span style="color:#b9d7a3;font-size:12px">Portal do Educador · uma solução NEWPC Tecnologia</span></td></tr></table>
<div style="border:1px solid #dce4ed;border-top:0;padding:20px 22px;border-radius:0 0 12px 12px">${corpo}
<p style="margin:18px 0 6px"><a href="${link}" style="display:inline-block;background:#1a6b2a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">${esc(rotulo)}</a></p>
<p style="margin:14px 0 0;font-size:12px;color:#5b6b7b">Dúvidas? Responda este e-mail ou fale com o nosso atendimento pelo WhatsApp do Portal do Educador.</p></div></div>`;
}

// decide qual momento a mudança do cadastro representa (puro, testável)
export function momentoDe(antes, depois) {
  const a = antes || null, d = depois || null;
  if (!d || d.perfil !== 'professor' || !d.email) return null;
  if (d.municipio_id === LAB || String(d.email).endsWith('@portaldoeducador.com.br')) return null;   // contas do laboratório
  const ta = a ? (a.licenca_tipo || 'institucional') : '', td = d.licenca_tipo || 'institucional';
  const ativo = d.status === 'ativo', eraAtivo = !!a && a.status === 'ativo';
  if (td === 'teste' && ta !== 'teste') return { momento: 'teste_inicio', chave: String(ms(d.licenca_fim) || 'x') };
  if (!ativo) return null;
  if (td === 'avulsa' && (ta !== 'avulsa' || !eraAtivo)) return { momento: 'compra', chave: String(ms(d.licenca_fim) || 'x') };
  if (td === 'avulsa' && ta === 'avulsa' && ms(d.licenca_fim) > ms(a.licenca_fim) + 864e5) return { momento: 'renovacao', chave: String(ms(d.licenca_fim)) };
  if (td === 'avulsa' && ta === 'avulsa' && (a.plano_avulso || 'completo') !== (d.plano_avulso || 'completo')) return { momento: 'plano', chave: (a.plano_avulso || 'completo') + '-' + (d.plano_avulso || 'completo'), de: a.plano_avulso || 'completo', para: d.plano_avulso || 'completo' };
  // rede: só na passagem (aprovação ou troca de licença); cadastro já criado ativo vem de importação, que tem o convite próprio
  if (a && td === 'institucional' && d.municipio_id && (!eraAtivo || ta !== 'institucional')) return { momento: 'rede', chave: d.municipio_id, vinhaDe: eraAtivo ? ta : '' };
  if (td === 'cortesia' && (ta !== 'cortesia' || !eraAtivo)) return { momento: 'cortesia', chave: String(ms(d.licenca_fim) || 'x') };
  return null;
}

async function contexto(db, u) {
  let muni = null, escola = '';
  if (u.municipio_id && u.municipio_id !== LAB) { const m = await db.doc(`municipios/${u.municipio_id}`).get(); if (m.exists) muni = m.data(); }
  const eid = u.escola_id || (Array.isArray(u.escolas_ids) && u.escolas_ids[0]) || '';
  if (eid) { const e = await db.doc(`escolas/${eid}`).get().catch(() => null); if (e && e.exists) escola = e.data().nome || ''; }
  return { muni, escola };
}

// texto de cada momento
export function mensagem(ev, u, ctx) {
  const ola = `<p>Olá, ${primeiro(u.nome)}!</p>`, fim = dataBR(ms(u.licenca_fim));
  const plano = u.plano_avulso || 'completo';
  const nomeMuni = ctx.muni ? esc(ctx.muni.nome || '') + (ctx.muni.uf ? '/' + esc(ctx.muni.uf) : '') : '';
  const planoRede = ctx.muni ? (ctx.muni.plano_nome || 'basico') : '';
  switch (ev.momento) {
    case 'teste_inicio': return { assunto: 'Bem-vindo(a) ao Portal do Educador: seu teste grátis começou',
      html: moldura('Seu teste grátis começou', `${ola}<p>Que bom ter você no <b>Portal do Educador</b>. Seu teste grátis vai até <b>${fim}</b>, com acesso aos conteúdos e <b>créditos de demonstração do Portal IA</b>.</p>
<p><b>Para aproveitar logo no primeiro dia:</b></p><ol style="padding-left:20px;margin:0 0 8px"><li>Abra o <b>Portal IA</b> e peça um plano de aula ou uma atividade com gabarito para a sua turma.</li><li>Veja as <b>Atividades prontas</b> e os <b>Jogos</b> para usar ainda esta semana.</li><li>Confira as <b>Datas comemorativas</b> do mês, com kits prontos.</li></ol>`, 'Entrar no Portal', ENTRAR) };
    case 'teste_fim': return { assunto: 'Seu teste do Portal do Educador termina em 2 dias',
      html: moldura('Faltam 2 dias do seu teste', `${ola}<p>Seu teste grátis termina em <b>${fim}</b>. Para continuar com seus materiais e o Portal IA, escolha um plano: <b>mensal, semestral ou anual</b>.</p><p>Responda este e-mail que a nossa equipe envia os valores e a forma de pagamento.</p>`, 'Entrar no Portal', ENTRAR) };
    case 'compra': return { assunto: 'Sua licença do Portal do Educador está ativa',
      html: moldura('Licença ativa', `${ola}<p>Obrigado por escolher o <b>Portal do Educador</b>! Sua licença está ativa até <b>${fim}</b>, no plano <b>${esc(NOME_PLANO[plano] || plano)}</b>.</p><p>Ele inclui ${ITENS_PLANO[plano] || ITENS_PLANO.completo}.</p><p>Os créditos do plano renovam todo mês. Se precisar de mais, os pacotes extras acumulam no seu saldo e valem 12 meses.</p>`, 'Entrar no Portal', ENTRAR) };
    case 'renovacao': return { assunto: 'Licença do Portal do Educador renovada',
      html: moldura('Licença renovada', `${ola}<p>Sua licença foi renovada e agora vale até <b>${fim}</b>. Obrigado por seguir com a gente!</p>`, 'Entrar no Portal', ENTRAR) };
    case 'vencendo': return { assunto: 'Sua licença do Portal do Educador vence em 7 dias',
      html: moldura('Sua licença vence em 7 dias', `${ola}<p>Sua licença do Portal do Educador vence em <b>${fim}</b>. Para não perder o acesso aos seus materiais e ao Portal IA, responda este e-mail que enviamos a renovação.</p>`, 'Entrar no Portal', ENTRAR) };
    case 'plano': return { assunto: 'Seu plano do Portal do Educador mudou',
      html: moldura('Plano atualizado', `${ola}<p>Seu plano mudou de <b>${esc(NOME_PLANO[ev.de] || ev.de)}</b> para <b>${esc(NOME_PLANO[ev.para] || ev.para)}</b>.</p><p>Agora você tem ${ITENS_PLANO[ev.para] || ITENS_PLANO.completo}.</p>`, 'Ver o que mudou', ENTRAR) };
    case 'cortesia': return { assunto: 'Você ganhou acesso ao Portal do Educador',
      html: moldura('Acesso liberado', `${ola}<p>A NEWPC Tecnologia liberou para você um acesso de cortesia ao <b>Portal do Educador</b>${fim ? ', válido até <b>' + fim + '</b>' : ''}.</p>`, 'Entrar no Portal', ENTRAR) };
    case 'rede': return { assunto: nomeMuni ? `O Portal do Educador chegou para você: Prefeitura de ${ctx.muni.nome}` : 'Seu acesso ao Portal do Educador foi liberado',
      html: moldura(nomeMuni ? 'Um presente da sua rede de ensino' : 'Acesso liberado', `${ola}<p>${nomeMuni ? `A <b>Prefeitura Municipal de ${nomeMuni}</b>, por meio da Secretaria Municipal de Educação, oferece a você o <b>Portal do Educador</b>, em parceria com a NEWPC Tecnologia. É um investimento da sua rede no seu dia a dia em sala.` : 'Seu acesso ao <b>Portal do Educador</b> foi liberado pela sua rede de ensino.'}</p>
${ctx.escola ? `<p>Você está vinculado(a) à <b>${esc(ctx.escola)}</b>.</p>` : ''}${planoRede ? `<p>O plano da sua rede inclui ${ITENS_PLANO[planoRede] || ITENS_PLANO.basico}.</p>` : ''}
${ev.vinhaDe === 'avulsa' || ev.vinhaDe === 'teste' ? '<p>Como a sua rede agora oferece o Portal, você passa a usar o acesso institucional, sem custo para você. Seus materiais continuam no seu cadastro.</p>' : ''}
<p><b>Primeiro passo:</b> entre com o mesmo e-mail e confira suas turmas em <b>Minhas Turmas</b>.</p>`, 'Entrar no Portal', ENTRAR) };
    default: return null;
  }
}

async function enviar(db, uid, u, ev) {
  const ref = db.doc(`comunicacoes/${uid}_${ev.momento}_${String(ev.chave).replace(/[^\w-]/g, '').slice(0, 60)}`);
  try { await ref.create({ uid, momento: ev.momento, canal: 'email', status: 'enviando', em: FieldValue.serverTimestamp(), expira_em: Timestamp.fromMillis(Date.now() + 400 * 864e5) }); }
  catch (e) { return false; }   // já foi (ou está indo): não repete
  const ctx = await contexto(db, u), m = mensagem(ev, u, ctx);
  if (!m) { await ref.delete().catch(() => {}); return false; }
  try {
    await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: u.email, subject: m.assunto, html: m.html });
    await ref.set({ status: 'enviado', municipio_id: u.municipio_id || '' }, { merge: true });
    return true;
  } catch (e) { console.warn('comunicacoes:', ev.momento, e.message); await ref.set({ status: 'falhou', erro: String(e.message).slice(0, 200) }, { merge: true }); return false; }
}

export const comunicacaoProfessor = onDocumentWritten({ document: 'usuarios/{uid}', region: REGIAO, secrets: [SMTP_SENHA], maxInstances: 5 }, async ev => {
  const a = ev.data.before.exists ? ev.data.before.data() : null, d = ev.data.after.exists ? ev.data.after.data() : null;
  const m = momentoDe(a, d); if (!m) return;
  await enviar(getFirestore(), ev.params.uid, d, m);
});

// reenvio manual (administrador, botão no Gerenciar): manda o e-mail que cabe na situação atual da pessoa; no máximo 1 por dia
export const comunicacaoManual = onCall({ region: REGIAO, secrets: [SMTP_SENHA], maxInstances: 3, timeoutSeconds: 30 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const db = getFirestore(), eu = (await db.doc('usuarios/' + req.auth.uid).get()).data() || {};
  if (eu.perfil !== 'admin' || eu.status !== 'ativo') throw new HttpsError('permission-denied', 'Só o administrador do Portal faz isso.');
  const uid = String((req.data || {}).uid || ''); if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new HttpsError('invalid-argument', 'Cadastro inválido.');
  const u = (await db.doc('usuarios/' + uid).get()).data();
  if (!u || u.perfil !== 'professor' || u.status !== 'ativo' || !u.email) throw new HttpsError('failed-precondition', 'O e-mail de boas-vindas é para professor ativo com e-mail.');
  if (u.municipio_id === LAB || String(u.email).endsWith('@portaldoeducador.com.br')) throw new HttpsError('failed-precondition', 'Conta do laboratório não recebe e-mail.');
  const t = u.licenca_tipo || 'institucional';
  const momento = t === 'teste' ? 'teste_inicio' : t === 'avulsa' ? 'compra' : t === 'cortesia' ? 'cortesia' : u.municipio_id ? 'rede' : '';
  if (!momento) throw new HttpsError('failed-precondition', 'Vincule o professor a uma rede ou a uma licença antes.');
  const dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
  const ok = await enviar(db, uid, u, { momento, chave: 'manual-' + dia });
  if (!ok) throw new HttpsError('already-exists', 'Este e-mail já foi enviado hoje para esta pessoa (ou o envio falhou). Tente amanhã.');
  await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), acao: 'alterou', origem: 'funcao', colecao: 'comunicacoes', doc: uid, autor_uid: req.auth.uid, autor_tipo: 'usuario', autor_email: eu.email || '', perfil: 'admin',
    detalhe: 'E-mail de boas-vindas (' + momento + ') reenviado pelo administrador', campos: [], valores: {} }).catch(() => {});
  return { momento };
});

// todo dia às 9h: teste terminando em 2 dias e licença avulsa vencendo em 7 dias
export const comunicacaoLembretes = onSchedule({ schedule: '7 9 * * *', timeZone: 'America/Campo_Grande', region: REGIAO, secrets: [SMTP_SENHA], maxInstances: 1, timeoutSeconds: 300 }, async () => {
  const db = getFirestore(), agora = Date.now(); let n = 0;
  for (const [tipo, dias, momento] of [['teste', 2, 'teste_fim'], ['avulsa', 7, 'vencendo']]) {
    const de = Timestamp.fromMillis(agora + (dias - 1) * 864e5), ate = Timestamp.fromMillis(agora + dias * 864e5);
    const s = await db.collection('usuarios').where('licenca_tipo', '==', tipo).where('licenca_fim', '>', de).where('licenca_fim', '<=', ate).get();
    for (const doc of s.docs) { const u = doc.data();
      if (u.perfil !== 'professor' || u.status !== 'ativo' || !u.email || u.municipio_id === LAB) continue;
      if (await enviar(db, doc.id, u, { momento, chave: String(ms(u.licenca_fim)) })) n++; }
  }
  console.log('comunicacoes: lembretes enviados', n);
});

// modelos do WhatsApp (mesmo texto cadastrado na Meta); exemplo = valores de teste de cada {{n}}
export const RODAPE_WA = 'Portal do Educador · NEWPC Tecnologia';
export const MODELOS_WA = [
  { nome: 'pde_boas_vindas_teste', momento: 'teste_inicio', categoria: 'UTILITY', corpo: 'Olá, {{1}}! Seu teste grátis do Portal do Educador começou e vai até {{2}}. Para começar, abra o Portal IA e peça um plano de aula ou uma atividade com gabarito para a sua turma. Qualquer dúvida, é só responder esta mensagem.', exemplo: ['Maria', '11/11/2026'] },
  { nome: 'pde_teste_terminando', momento: 'teste_fim', categoria: 'MARKETING', corpo: 'Olá, {{1}}! Seu teste grátis do Portal do Educador termina em {{2}}. Para continuar com seus materiais e com o Portal IA, responda esta mensagem que enviamos os planos disponíveis.', exemplo: ['Maria', '11/11/2026'] },
  { nome: 'pde_licenca_ativa', momento: 'compra', categoria: 'UTILITY', corpo: 'Olá, {{1}}! Sua licença do Portal do Educador está ativa até {{2}}, no plano {{3}}. Os créditos do plano renovam todo mês, e os pacotes extras acumulam no seu saldo por 12 meses.', exemplo: ['Maria', '04/11/2027', 'Intermediário'] },
  { nome: 'pde_licenca_renovada', momento: 'renovacao', categoria: 'UTILITY', corpo: 'Olá, {{1}}! Sua licença do Portal do Educador foi renovada e agora vale até {{2}}. Obrigado por seguir com a gente!', exemplo: ['Maria', '04/11/2027'] },
  { nome: 'pde_licenca_vencendo', momento: 'vencendo', categoria: 'UTILITY', corpo: 'Olá, {{1}}! Sua licença do Portal do Educador vence em {{2}}. Para não perder o acesso aos seus materiais, responda esta mensagem que enviamos a renovação.', exemplo: ['Maria', '11/11/2026'] },
  { nome: 'pde_plano_alterado', momento: 'plano', categoria: 'UTILITY', corpo: 'Olá, {{1}}! Seu plano do Portal do Educador mudou de {{2}} para {{3}}. Entre no Portal para conhecer os recursos do seu novo plano.', exemplo: ['Maria', 'Básico', 'Completo'] },
  { nome: 'pde_boas_vindas_rede', momento: 'rede', categoria: 'UTILITY', corpo: 'Olá, {{1}}! A Prefeitura Municipal de {{2}}, por meio da Secretaria Municipal de Educação, liberou para você o Portal do Educador, em parceria com a NEWPC Tecnologia. Entre com o e-mail {{3}} e confira suas turmas em Minhas Turmas.', exemplo: ['Maria', 'São Gabriel do Oeste/MS', 'maria@gmail.com'] }
];
// boas-vindas universal no WhatsApp (nov/2026): todo cadastro novo com WhatsApp recebe, sem ninguém da equipe tocar
export const MODELO_BOAS_VINDAS_WA = { nome: 'pde_boas_vindas', momento: 'cadastro', categoria: 'UTILITY', corpo: 'Olá, {{1}}! Recebemos o seu cadastro no Portal do Educador. Entre com o e-mail que você cadastrou e conheça tudo o que preparamos para a sua aula. Qualquer dúvida, é só responder esta mensagem.', exemplo: ['Maria'] };
// aviso para a equipe de atendimento (Alan, Leonardo...): {{1}} quem, {{2}} a situação
export const MODELO_ALERTA_WA = { nome: 'pde_alerta_atendimento', momento: 'equipe', categoria: 'UTILITY', corpo: '🔔 Atendimento do Portal do Educador: {{1}} {{2}}. Toque no botão para abrir a conversa.', exemplo: ['Maria (São Gabriel do Oeste/MS)', 'precisa de um atendente (Suporte)'], rodape: 'Aviso para a equipe', botao: 'Abrir o atendimento', url: SITE + '/atendimento/' };
export const preencherWA = (corpo, vals) => corpo.replace(/\{\{(\d+)\}\}/g, (_, n) => String(vals[Number(n) - 1] ?? ''));
export const URL_ENTRAR = ENTRAR;

