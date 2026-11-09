// IA na aula ao vivo (nov/2026). Primeiro recurso: Termômetro da turma.
// O professor lança uma pergunta aberta no Controle da aula; cada aluno escreve no tablet (aula_vivo/{turma}/alunos/{k}.pesquisa.texto);
// aqui a IA lê as respostas e agrupa: quem entendeu, quem entendeu em parte, quem confundiu e quem fugiu do tema, com um exemplo de cada
// e uma sugestão do que retomar. A IA recebe só os textos, numerados, NUNCA o nome do aluno; quem junta número e nome é a tela do professor.
// Liberação pela Central de IA (recurso aula_termometro), 1 crédito de texto por leitura.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { contexto, RESERVA_TEXTO, geminiJson } from './portal-ia.js';
import { reservarCreditos, estornarCreditos, registrarConsumo, cfgCreditos, usoJustoDiario } from './creditos.js';
import { acessoIA, mensagemAcesso } from './ia-acesso.js';

const GEMINI = defineSecret('GEMINI_API_KEY');
const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const S = d => ({ type: 'STRING', description: d });
const GRUPOS = ['entendeu', 'parcial', 'confundiu', 'fora'];
const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    grupos: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      tipo: { type: 'STRING', enum: GRUPOS, description: 'entendeu: resposta correta e completa o bastante; parcial: no caminho, faltou parte importante; confundiu: ideia errada (diga qual confusão); fora: em branco, brincadeira, cópia da pergunta ou fora do tema' },
      titulo: S('Rótulo curto do grupo, até 50 caracteres, ex.: "Confundiram fotossíntese com respiração"'),
      explicacao: S('O que esses alunos mostraram, em 1 frase para o professor'),
      exemplo: S('Trecho curto de UMA resposta do grupo, copiado como o aluno escreveu (até 120 caracteres), sem nome'),
      respostas: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'Números das respostas que estão neste grupo' }
    }, required: ['tipo', 'titulo', 'explicacao', 'exemplo', 'respostas'] } },
    sugestao: S('O que o professor pode fazer AGORA, na aula, em 1 ou 2 frases práticas (ex.: retomar um ponto, usar um exemplo, juntar alunos)'),
    resposta_modelo: S('Uma resposta esperada, curta, na linguagem da série')
  },
  required: ['grupos', 'sugestao', 'resposta_modelo']
};

export const aulaIa = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 120, memory: '512MiB', maxInstances: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const ctx = await contexto(db, uid); ctx.uid = uid;

  // a tela pergunta o que pode mostrar (os botões só aparecem para quem o plano libera)
  if (d.acao === 'acesso') {
    const a = acessoIA('aula_termometro', ctx.ia);
    return { termometro: a.ok, motivo: a.ok ? '' : mensagemAcesso('aula_termometro', a.motivo), custo: 0 };   // grátis desde nov/2026 (uso justo diário)
  }

  if (d.acao === 'termometro') {
    const tid = txt(d.tid, 64).replace(/[^\w-]/g, ''), pid = txt(d.pid, 64).replace(/[^\w-]/g, '');
    if (!tid || !pid) throw new HttpsError('invalid-argument', 'Aula não informada.');
    // só quem conduz a aula (quem abriu) ou o administrador
    const qa = await db.doc(`qr_aulas/${tid}`).get();
    if (!ctx.admin && !(qa.exists && qa.data().por === uid)) throw new HttpsError('permission-denied', 'Só quem está conduzindo a aula desta turma pode ler as respostas.');
    const av = (await db.doc(`aula_vivo/${tid}`).get()).data() || {}, pq = av.pesquisa || {};
    if (pq.id !== pid || pq.tipo !== 'aberta') throw new HttpsError('failed-precondition', 'Esta pergunta não está mais ativa.');
    const sn = await db.collection(`aula_vivo/${tid}/alunos`).get();
    const resp = sn.docs.map(x => ({ k: x.id, t: txt(((x.data().pesquisa || {}).id === pid ? x.data().pesquisa.texto : ''), 300) })).filter(x => x.t);
    if (resp.length < 2) throw new HttpsError('failed-precondition', 'Espere pelo menos 2 respostas para a IA ler a turma.');
    const a = acessoIA('aula_termometro', ctx.ia);
    if (!a.ok) throw new HttpsError('failed-precondition', mensagemAcesso('aula_termometro', a.motivo));
    // grátis (nov/2026): sem crédito, com limite diário por professor
    const uj = await usoJustoDiario(db, ctx, 'termometro', 60);
    if (!uj.ok) throw new HttpsError('resource-exhausted', 'Você chegou ao limite de ' + uj.limite + ' leituras do Termômetro hoje. Amanhã libera de novo.');
    const res = { acao: 'termometro' };
    const serie = txt(d.serie, 60), disc = txt(d.disciplina, 60);
    const sistema = 'Você é um professor experiente da educação básica brasileira ajudando um colega DURANTE a aula. Ele fez uma pergunta aberta e a turma respondeu no tablet. ' +
      'Leia todas as respostas e agrupe a turma por nível de entendimento, com olhar pedagógico e gentil. Regras: cada resposta entra em exatamente um grupo; ' +
      'considere a idade (erros de ortografia não contam como erro de conteúdo); seja específico sobre a confusão (ex.: "acham que a planta come terra"); ' +
      'no máximo 5 grupos, sem grupos vazios; no exemplo, copie um trecho real de uma resposta. A sugestão deve caber em 2 minutos de aula. Português do Brasil.';
    const pedido = 'Pergunta: "' + txt(pq.pergunta, 200) + '"' + (serie ? '\nSérie: ' + serie : '') + (disc ? '\nComponente: ' + disc : '') +
      '\n\nRespostas da turma (' + resp.length + '):\n' + resp.map((x, i) => (i + 1) + '. ' + x.t).join('\n');
    let r;
    try { r = await geminiJson(GEMINI.value(), [ctx.cfg.modelo_texto, ...RESERVA_TEXTO], sistema, pedido, ESQUEMA, undefined, 60000); }
    catch (e) { await uj.desfazer(); throw new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo.'); }
    if (!r.json || !Array.isArray(r.json.grupos)) { await uj.desfazer(); await registrarConsumo(db, ctx, null, { modelo: r.modelo, entrada: r.entrada, saida: r.saida }); throw new HttpsError('unavailable', 'A IA não conseguiu ler as respostas. Tente de novo.'); }
    // número da resposta -> chave do aluno (a tela troca pela foto e nome); resposta sem grupo vai para "fora"
    const usados = new Set();
    const grupos = r.json.grupos.filter(g => GRUPOS.includes(g.tipo)).map(g => {
      const ks = (g.respostas || []).map(n => resp[n - 1]).filter(x => x && !usados.has(x.k)).map(x => { usados.add(x.k); return x.k; });
      return { tipo: g.tipo, titulo: txt(g.titulo, 60), explicacao: txt(g.explicacao, 220), exemplo: txt(g.exemplo, 140), alunos: ks };
    }).filter(g => g.alunos.length);
    const sobra = resp.filter(x => !usados.has(x.k)).map(x => x.k);
    if (sobra.length) grupos.push({ tipo: 'fora', titulo: 'Sem classificação', explicacao: 'A IA não conseguiu encaixar estas respostas; vale ler.', exemplo: '', alunos: sobra });
    const ordem = t => GRUPOS.indexOf(t);
    grupos.sort((x, y) => ordem(x.tipo) - ordem(y.tipo));
    await registrarConsumo(db, ctx, { ...res, acao: 'termometro' }, { modelo: r.modelo, entrada: r.entrada, saida: r.saida });
    // registro para o Painel da Escola e da Rede: só contagens e os rótulos da IA, nunca o texto nem o nome do aluno.
    // id fixo por pergunta: "Ler de novo" substitui a leitura anterior.
    try {
      const t = (await db.doc(`turmas/${tid}`).get()).data() || {};
      if (t.municipio_id || t.escola_id) {
        const n = tp => grupos.filter(g => g.tipo === tp).reduce((s, g) => s + g.alunos.length, 0);
        await db.doc(`termometro_registros/${tid}_${pid}`).set({
          municipio_id: String(t.municipio_id || ''), escola_id: String(t.escola_id || ''), turma_id: tid, turma_nome: txt(t.nome, 80),
          por: uid, pergunta: txt(pq.pergunta, 200), disciplina: disc, dia: new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10),
          respostas: resp.length, entendeu: n('entendeu'), parcial: n('parcial'), confundiu: n('confundiu'), fora: n('fora'),
          grupos: grupos.map(g => ({ tipo: g.tipo, titulo: g.titulo, n: g.alunos.length })), em: FieldValue.serverTimestamp()
        });
      }
    } catch (e) { console.warn('termometro_registros', e.message); }
    return { grupos, sugestao: txt(r.json.sugestao, 400), resposta_modelo: txt(r.json.resposta_modelo, 300), total: resp.length, custo: res.custo || 0 };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});
