// Totem da portaria: uma tela do Portal do Educador TV em "modo Portaria" registra a entrada dos alunos pela carteirinha.
// O totem não tem login: é identificado pela chave da tela (20 caracteres, criada no pareamento pelo gestor).
// Só o servidor grava as entradas, e só de alunos da escola da tela.
//   POST { chave, acao:"lista" }                         -> primeiro nome e turma dos alunos da escola + quem já entrou hoje
//   POST { chave, acao:"entrar", entradas:[{ id, hora, dia, foto? }] } -> grava (até 200 por vez; a fila do totem manda as atrasadas juntas)
//   foto: JPEG pequeno em base64, só quando a tela tem "foto na entrada" ligada
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// foto da entrada (opcional, por totem): conferência de carteirinha emprestada; guardada só por este prazo
export const RETENCAO_FOTOS_DIAS = 15;
// bucket só das fotos, em São Paulo (southamerica-east1), sem lixeira e com apagamento automático no próprio bucket como segunda garantia
export const BUCKET_PORTARIA = 'portal-educador-5-portaria';

const CHAVE = /^[A-Za-z0-9]{20}$/, ID = /^[A-Za-z0-9_-]{1,64}$/, HORA = /^[0-2]\d:[0-5]\d$/, DATA = /^20\d\d-[01]\d-[0-3]\d$/;
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const diasAtras = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };

export const portaria = onRequest({ region: 'southamerica-east1', cors: true, invoker: 'public', maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ erro: 'Use POST.' }); return; }
  const b = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const chave = String(b.chave || '');
  if (!CHAVE.test(chave)) { res.status(400).json({ erro: 'Tela inválida.' }); return; }
  const db = getFirestore(), tela = (await db.doc(`tv_telas/${chave}`).get()).data();
  if (!tela || tela.modo !== 'portaria' || !ID.test(String(tela.escola_id || ''))) { res.status(403).json({ erro: 'Esta tela não está em modo Portaria.' }); return; }
  const escola = tela.escola_id, hoje = hojeMS();

  if (b.acao === 'lista') {
    const [sa, st, se] = await Promise.all([
      db.collection('alunos').where('escola_id', '==', escola).get(),
      db.collection('turmas').where('escola_id', '==', escola).get(),
      db.collection('freq_entradas').where('escola_id', '==', escola).where('dia', '==', hoje).get()
    ]);
    const turmas = {}; st.forEach(d => { const t = d.data(); if (t.status !== 'inativa') turmas[d.id] = t.nome || 'Turma'; });
    // só o primeiro nome vai para o aparelho (é o que aparece na tela)
    const alunos = {}; sa.forEach(d => { const a = d.data(); if (a.nome && a.status !== 'inativo' && turmas[a.turma_id]) alunos[d.id] = [String(a.nome).trim().split(/\s+/)[0], a.turma_id]; });
    const entraram = []; se.forEach(d => entraram.push(...Object.keys(d.data().entradas || {})));
    res.json({ escola: tela.escola_nome || '', dia: hoje, turmas, alunos, entraram, foto: tela.foto_entrada === true, retencao: RETENCAO_FOTOS_DIAS });
    return;
  }

  if (b.acao === 'entrar') {
    const lista = (Array.isArray(b.entradas) ? b.entradas : []).slice(0, 200)
      .filter(e => e && ID.test(String(e.id || '')) && HORA.test(String(e.hora || '')) && DATA.test(String(e.dia || '')) && e.dia <= hoje && e.dia >= diasAtras(hoje, 3));
    if (!lista.length) { res.json({ ok: [] }); return; }
    const ids = [...new Set(lista.map(e => e.id))];
    const docs = await db.getAll(...ids.map(id => db.doc(`alunos/${id}`)));
    const al = {}; docs.forEach(d => { if (d.exists && d.data().escola_id === escola) al[d.id] = d.data(); });
    const turmasIds = [...new Set(Object.values(al).map(a => a.turma_id).filter(t => ID.test(String(t || ''))))];
    const tds = turmasIds.length ? await db.getAll(...turmasIds.map(t => db.doc(`turmas/${t}`))) : [];
    const turmas = {}; tds.forEach(d => { if (d.exists && d.data().escola_id === escola) turmas[d.id] = d.data(); });
    // agrupa por turma e dia; a primeira hora registrada fica (não sobrescreve quem já entrou)
    const grupos = {}, ok = [];
    lista.forEach(e => { const a = al[e.id]; if (!a || !turmas[a.turma_id]) return; const k = a.turma_id + '_' + e.dia; (grupos[k] = grupos[k] || { turma: a.turma_id, dia: e.dia, itens: [] }).itens.push({ ...e, nome: String(a.nome).slice(0, 80) }); });
    const comFoto = tela.foto_entrada === true, bucket = comFoto ? getStorage().bucket(BUCKET_PORTARIA) : null;
    for (const [k, g] of Object.entries(grupos)) {
      const ref = db.doc(`freq_entradas/${k}`);
      let novos = [];
      await db.runTransaction(async tx => {
        const atual = (await tx.get(ref)).data() || {}, ja = atual.entradas || {}, entradas = {}, nomes = {}, fotos = {};
        novos = [];
        g.itens.forEach(e => { if (!ja[e.id] && !entradas[e.id]) { entradas[e.id] = e.hora; nomes[e.id] = e.nome; novos.push(e);
          if (comFoto && fotoOk(e.foto)) fotos[e.id] = `portaria/${escola}/${e.dia}/${e.id}_${e.hora.replace(':', '')}.jpg`; } });
        const t = turmas[g.turma];
        if (Object.keys(entradas).length) tx.set(ref, { escola_id: escola, municipio_id: t.municipio_id || tela.municipio_id || '', turma_id: g.turma, turma_nome: String(t.nome || '').slice(0, 80),
          dia: g.dia, ano: +g.dia.slice(0, 4), entradas, nomes, ...(Object.keys(fotos).length ? { fotos } : {}), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
      });
      // só a foto da primeira passagem do dia fica guardada
      if (comFoto) await Promise.all(novos.filter(e => fotoOk(e.foto)).map(e => bucket.file(`portaria/${escola}/${e.dia}/${e.id}_${e.hora.replace(':', '')}.jpg`)
        .save(Buffer.from(e.foto, 'base64'), { contentType: 'image/jpeg', resumable: false, metadata: { cacheControl: 'private, max-age=3600', metadata: { dia: e.dia, aluno: e.id } } }).catch(err => console.error('foto', e.id, err.message))));
      g.itens.forEach(e => ok.push(e.id));
    }
    const recusados = lista.map(e => e.id).filter(id => !ok.includes(id));
    res.json({ ok, recusados });
    return;
  }
  res.status(400).json({ erro: 'Ação desconhecida.' });
});

// JPEG de até 80 KB (o totem manda 320 x 240)
function fotoOk(b64) {
  if (typeof b64 !== 'string' || b64.length < 200 || b64.length > 110000 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return false;
  const b = Buffer.from(b64.slice(0, 8), 'base64'); return b[0] === 0xFF && b[1] === 0xD8;
}

// apaga todo dia as fotos da entrada que passaram do prazo de guarda (pasta portaria/{escola}/{dia}/)
export const limparFotosPortaria = onSchedule({ schedule: '17 3 * * *', timeZone: 'America/Campo_Grande', region: 'southamerica-east1', timeoutSeconds: 540 }, async () => {
  const limite = diasAtras(hojeMS(), RETENCAO_FOTOS_DIAS), bucket = getStorage().bucket(BUCKET_PORTARIA);
  let apagadas = 0, pagina = null;
  do {
    const [arqs, prox] = await bucket.getFiles({ prefix: 'portaria/', autoPaginate: false, maxResults: 1000, pageToken: pagina || undefined });
    const velhas = arqs.filter(f => { const dia = f.name.split('/')[2] || ''; return DATA.test(dia) && dia < limite; });
    await Promise.all(velhas.map(f => f.delete().catch(() => {}))); apagadas += velhas.length;
    pagina = prox && prox.pageToken;
  } while (pagina);
  console.log('limparFotosPortaria', { limite, apagadas });
});
