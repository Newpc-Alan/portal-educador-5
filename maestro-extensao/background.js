// Portal Maestro · extensão do aluno · v0.9.0
// v0.9 (nov/2026): o aluno pode entrar pela conta do Portal do Educador (portal.js avisa o número da aula, o nome e a matrícula).
// Service worker: liga o dispositivo à aula, envia presença e executa os comandos do professor.
//
// Estrutura no Realtime Database (projeto newpc-sala):
//   aulas/{codigo}/professor, criadaEm
//   aulas/{codigo}/controle/encerrada        true quando o professor encerra
//   aulas/{codigo}/controle/ate              (v0.9) fim da aula aberta pelo Portal, em ms do servidor
//   aulas/{codigo}/controle/professorVivo    sinal do painel (servidor, ms); sem sinal por 2 min = bloqueio liberado
//   aulas/{codigo}/controle/bloqueioGeral    true/false para a turma inteira
//   aulas/{codigo}/controle/bloqueio/{id}    true/false para um aluno (sobrepõe o geral)
//   aulas/{codigo}/controle/comando          último comando para todos  {id, tipo, url}
//   aulas/{codigo}/controle/comandos/{id}    último comando para um aluno
//   aulas/{codigo}/alunos/{id}               presença que o aluno envia
//   aulas/{codigo}/controle/afinacao         {id, pergunta, ativa}            termômetro de compreensão
//   aulas/{codigo}/controle/compasso         {id, titulo, inicio, duracaoMs, ativo}   cronômetro da atividade
//   aulas/{codigo}/respostas/afinacao/{idPergunta}/{id}   {valor, nome, ts}
//   aulas/{codigo}/controle/perguntas/{id}   {id, texto, opcoes|null, ativa}   pergunta individual (só este aluno vê)
//   aulas/{codigo}/respostas/perguntas/{id}/{idPergunta}  {resposta, ts}
//   aulas/{codigo}/alunos/{id}/mao           timestamp da mão levantada (o professor apaga ao atender)
//   aulas/{codigo}/alunos/{id}/ultimoCmd     {id, ts} confirmação de que o comando foi executado (v0.8)
//   aulas/{codigo}/alunos/{id}/entrouEm      hora em que o aluno entrou (o painel não espera comandos anteriores) (v0.8)
//
// Política da escola (Google Admin Console → Apps e extensões → esta extensão → Política):
//   { "entradaObrigatoria": { "Value": true } }
//   true  → o aluno só usa o Chrome depois de entrar numa aula (tela de entrada travada)
//   false → a tela de entrada abre ao ligar, mas o aluno pode fechar (padrão)

const FIREBASE_URL = "https://newpc-sala-default-rtdb.firebaseio.com";
const VERSAO = "0.9.0";
const URL_PORTAL = "https://app.portaldoeducador.com.br/";
const VALIDADE_COMANDO_MS = 120000; // ordem com mais de 2 min (ex.: aluno voltou de uma queda de rede) não é executada
const INTERVALO_MS = 3000;          // consulta de comandos
const HEARTBEAT_A_CADA = 5;         // presença a cada 5 ciclos (15 s)
const PAINEL_SEM_SINAL_MS = 120000; // trava de segurança: sem sinal do painel por 2 min, o bloqueio cai
const URL_BLOQUEIO = chrome.runtime.getURL("bloqueio.html");
const URL_ENTRADA = chrome.runtime.getURL("entrar.html");
const URL_REGENCIA = chrome.runtime.getURL("regencia.html"); // janela da Afinação e do Compasso

let cicloRodando = false;

// ---------- utilidades ----------

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function estado() {
  return chrome.storage.local.get(["deviceId", "aula", "nome", "bloqueado", "executados", "alunoId"]);
}

async function entradaObrigatoria() {
  try {
    const p = await chrome.storage.managed.get("entradaObrigatoria");
    return p.entradaObrigatoria === true;
  } catch (e) {
    return false; // sem política da escola (instalação manual)
  }
}

async function obterDeviceId() {
  const d = await chrome.storage.local.get("deviceId");
  if (d.deviceId) return d.deviceId;
  const novo = "device_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
  await chrome.storage.local.set({ deviceId: novo });
  return novo;
}

function obterEmail() {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }, (info) => {
      resolve((info && info.email) || "");
    });
  });
}

async function fb(caminho, metodo, corpo) {
  const opcoes = { method: metodo || "GET", headers: { "Content-Type": "application/json" } };
  if (corpo !== undefined) opcoes.body = JSON.stringify(corpo);
  const r = await fetch(`${FIREBASE_URL}/${caminho}.json`, opcoes);
  if (!r.ok) throw new Error(`Firebase ${r.status} em ${caminho}`);
  return r.json();
}

async function abaAtiva() {
  const [aba] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!aba) return null;
  return { titulo: (aba.title || "").slice(0, 120), url: (aba.url || "").slice(0, 300) };
}

// ---------- presença ----------

async function enviarPresenca() {
  const st = await estado();
  if (!st.aula) return;
  const id = await obterDeviceId();
  const email = await obterEmail();
  const antes = Date.now();
  const r = await fb(`aulas/${st.aula}/alunos/${id}`, "PATCH", {
    nome: st.nome || email || "Aluno sem nome",
    email: email,
    aluno_id: st.alunoId || null,
    bloqueado: !!st.bloqueado,
    aba: await abaAtiva(),
    versao: VERSAO,
    ultimaAtividade: { ".sv": "timestamp" }
  });
  // diferença entre o relógio deste Chromebook e o do servidor (para o Compasso ficar sincronizado)
  if (r && typeof r.ultimaAtividade === "number") {
    const meio = Math.round((antes + Date.now()) / 2);
    await chrome.storage.local.set({ offset: r.ultimaAtividade - meio });
  }
}

// ---------- comandos e bloqueio ----------

async function marcarExecutado(idComando) {
  const st = await estado();
  const lista = (st.executados || []).filter((x) => x !== idComando);
  lista.push(idComando);
  await chrome.storage.local.set({ executados: lista.slice(-30) });
}

async function executarComando(cmd) {
  if (!cmd || !cmd.id) return;
  const st = await estado();
  if ((st.executados || []).includes(cmd.id)) return;
  await marcarExecutado(cmd.id);

  // ordem antiga (aluno reconectou depois de muito tempo): não executa
  const offset = (await chrome.storage.local.get("offset")).offset || 0;
  if (typeof cmd.ts === "number" && Date.now() + offset - cmd.ts > VALIDADE_COMANDO_MS) {
    console.log("[Portal Maestro] Comando antigo ignorado:", cmd.id);
    return;
  }

  if (cmd.tipo === "abrirLink" && /^https?:\/\//i.test(cmd.url || "")) {
    await chrome.tabs.create({ url: cmd.url, active: true });
    console.log("[Portal Maestro] Link aberto:", cmd.url);
    // confirma ao painel que abriu (o professor vê "Abriu o conteúdo")
    try {
      const id = await obterDeviceId();
      await fb(`aulas/${st.aula}/alunos/${id}`, "PATCH", { ultimoCmd: { id: cmd.id, ts: { ".sv": "timestamp" } } });
    } catch (e) { /* a presença seguinte mostra a aba aberta */ }
  }
}

async function verificarControle() {
  const st = await estado();
  if (!st.aula) return;
  const id = await obterDeviceId();
  const controle = await fb(`aulas/${st.aula}/controle`);

  // aula aberta pelo Portal tem hora para acabar (controle.ate): passou 1 minuto do fim, sai sozinho (o professor pode ter fechado o Portal)
  const offFim = (await chrome.storage.local.get("offset")).offset || 0;
  const passouDoFim = controle && typeof controle.ate === "number" && Date.now() + offFim > controle.ate + 60000;
  if (!controle || controle.encerrada || passouDoFim) {
    console.log("[Portal Maestro] Aula encerrada pelo professor.");
    await sairDaAula(false);
    return;
  }

  // bloqueio individual sobrepõe o geral
  const individual = controle.bloqueio ? controle.bloqueio[id] : undefined;
  let deveBloquear = typeof individual === "boolean" ? individual : !!controle.bloqueioGeral;

  // TRAVA DE SEGURANÇA: o bloqueio só vale enquanto o painel do professor estiver vivo.
  // Se o painel ficar mais de 2 min sem sinal (aba fechada, sem internet, notebook desligado),
  // a tela do aluno é liberada sozinha. Ninguém fica preso.
  if (deveBloquear) {
    const offset = (await chrome.storage.local.get("offset")).offset || 0;
    const agoraServidor = Date.now() + offset;
    const vivo = typeof controle.professorVivo === "number" ? controle.professorVivo : 0;
    if (agoraServidor - vivo > PAINEL_SEM_SINAL_MS) {
      if (!(await chrome.storage.local.get("avisoTrava")).avisoTrava) {
        console.warn("[Portal Maestro] Painel do professor sem sinal: bloqueio liberado por segurança.");
        await chrome.storage.local.set({ avisoTrava: true });
      }
      deveBloquear = false;
    } else {
      await chrome.storage.local.set({ avisoTrava: false });
    }
  }
  await aplicarBloqueio(deveBloquear);

  // comandos: geral e individual, na ordem em que foram criados
  const meu = controle.comandos ? controle.comandos[id] : null;
  const fila = [controle.comando, meu].filter((c) => c && c.id).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  for (const c of fila) await executarComando(c);

  try {
    await atualizarRegencia(controle, deveBloquear, id);
  } catch (e) {
    console.warn("[Portal Maestro] Falha na Afinação/Compasso:", e.message);
  }
}

// ---------- Afinação e Compasso (janela própria do Maestro, sem permissões extras) ----------

async function atualizarRegencia(controle, bloqueado, idAluno) {
  const st = await chrome.storage.local.get(["afinacaoRespondida", "perguntaRespondida", "regencia", "regenciaVista", "offset"]);
  const offset = st.offset || 0;
  let afinacao = null;
  let compasso = null;
  let pergunta = null;

  const pq = controle.perguntas ? controle.perguntas[idAluno] : null;
  if (pq && pq.ativa && pq.id && pq.id !== st.perguntaRespondida) {
    const opcoes = Array.isArray(pq.opcoes) ? pq.opcoes.map((o) => String(o).slice(0, 80)).filter(Boolean).slice(0, 4) : null;
    pergunta = { id: pq.id, texto: String(pq.texto || "").slice(0, 300), opcoes: opcoes && opcoes.length >= 2 ? opcoes : null };
  }

  const a = controle.afinacao;
  if (a && a.ativa && a.id && a.id !== st.afinacaoRespondida) {
    afinacao = { id: a.id, pergunta: String(a.pergunta || "Entenderam?").slice(0, 140) };
  }
  const c = controle.compasso;
  if (c && c.ativo && c.id && typeof c.inicio === "number" && c.duracaoMs > 0) {
    const fimLocal = c.inicio + c.duracaoMs - offset;
    if (Date.now() < fimLocal + 8000) compasso = { id: c.id, titulo: String(c.titulo || "Atividade").slice(0, 60), fimLocal };
  }

  const novo = { afinacao, compasso, pergunta };
  if (JSON.stringify(novo) !== JSON.stringify(st.regencia || { afinacao: null, compasso: null, pergunta: null })) {
    await chrome.storage.local.set({ regencia: novo });
  }
  await atualizarBadge(compasso);

  if (bloqueado || (!afinacao && !compasso && !pergunta)) {
    await fecharTela(URL_REGENCIA);
    return;
  }

  // traz a janela para frente só quando chega uma novidade (pergunta ou cronômetro novo)
  const vistos = st.regenciaVista || [];
  const ids = [afinacao && afinacao.id, compasso && compasso.id, pergunta && pergunta.id].filter(Boolean);
  const novidade = ids.some((x) => !vistos.includes(x));
  await abrirJanelaRegencia(novidade);
  if (novidade) await chrome.storage.local.set({ regenciaVista: vistos.concat(ids).slice(-20) });
}

async function abrirJanelaRegencia(trazerParaFrente) {
  const abas = await chrome.tabs.query({ url: URL_REGENCIA });
  if (abas.length) {
    if (trazerParaFrente) await chrome.windows.update(abas[0].windowId, { focused: true, drawAttention: true });
    return;
  }
  const opcoes = { url: URL_REGENCIA, type: "popup", width: 400, height: 420, focused: true };
  try {
    const w = await chrome.windows.getLastFocused();
    if (w && w.width > 500 && w.height > 400) {
      opcoes.left = Math.max(0, (w.left || 0) + w.width - 420);
      opcoes.top = Math.max(0, (w.top || 0) + 80);
    }
  } catch (e) { /* posição padrão */ }
  try {
    await chrome.windows.create(opcoes);
  } catch (e) {
    // o Chrome recusa posições fora da tela visível: abre na posição padrão
    delete opcoes.left;
    delete opcoes.top;
    await chrome.windows.create(opcoes);
  }
}

async function atualizarBadge(compasso) {
  if (!compasso) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  const resta = compasso.fimLocal - Date.now();
  const s = Math.ceil(resta / 1000);
  const texto = resta <= 0 ? "FIM" : s >= 60 ? Math.ceil(s / 60) + "m" : s + "s";
  await chrome.action.setBadgeBackgroundColor({ color: resta <= 0 ? "#c0392b" : "#184489" });
  await chrome.action.setBadgeText({ text: texto });
}

async function responderAfinacao(idPergunta, valor) {
  if (!["verde", "amarelo", "vermelho"].includes(valor)) return { ok: false, erro: "Resposta inválida." };
  const st = await estado();
  if (!st.aula) return { ok: false, erro: "Você não está numa aula." };
  const id = await obterDeviceId();
  try {
    await fb(`aulas/${st.aula}/respostas/afinacao/${idPergunta}/${id}`, "PUT", {
      valor, nome: st.nome || "", ts: { ".sv": "timestamp" }
    });
  } catch (e) {
    return { ok: false, erro: "Sem conexão. Tente de novo." };
  }
  const reg = (await chrome.storage.local.get("regencia")).regencia || {};
  await chrome.storage.local.set({ afinacaoRespondida: idPergunta, regencia: { afinacao: null, compasso: reg.compasso || null, pergunta: reg.pergunta || null } });
  return { ok: true };
}

// ---------- mão levantada ----------

async function alternarMao() {
  const st = await chrome.storage.local.get(["aula", "mao", "bloqueado"]);
  if (!st.aula) return { ok: false, erro: "Você não está numa aula." };
  const id = await obterDeviceId();
  const levantar = !st.mao;
  try {
    if (levantar) await fb(`aulas/${st.aula}/alunos/${id}/mao`, "PUT", { ".sv": "timestamp" });
    else await fb(`aulas/${st.aula}/alunos/${id}/mao`, "DELETE");
  } catch (e) {
    return { ok: false, erro: "Sem conexão. Tente de novo." };
  }
  await chrome.storage.local.set({ mao: levantar });
  return { ok: true, mao: levantar };
}

// enquanto a mão estiver levantada, confere se o professor já atendeu
async function conferirMao() {
  const st = await chrome.storage.local.get(["aula", "mao"]);
  if (!st.aula || !st.mao) return;
  const id = await obterDeviceId();
  const v = await fb(`aulas/${st.aula}/alunos/${id}/mao`);
  if (v === null) await chrome.storage.local.set({ mao: false });
}

async function responderPergunta(idPergunta, resposta) {
  resposta = String(resposta || "").trim().slice(0, 500);
  if (!resposta) return { ok: false, erro: "Escreva sua resposta." };
  const st = await estado();
  if (!st.aula) return { ok: false, erro: "Você não está numa aula." };
  const id = await obterDeviceId();
  try {
    await fb(`aulas/${st.aula}/respostas/perguntas/${id}/${idPergunta}`, "PUT", { resposta, ts: { ".sv": "timestamp" } });
  } catch (e) {
    return { ok: false, erro: "Sem conexão. Tente de novo." };
  }
  const reg = (await chrome.storage.local.get("regencia")).regencia || {};
  await chrome.storage.local.set({ perguntaRespondida: idPergunta, regencia: { afinacao: reg.afinacao || null, compasso: reg.compasso || null, pergunta: null } });
  return { ok: true };
}

async function aplicarBloqueio(ligar) {
  const st = await estado();
  if (ligar !== !!st.bloqueado) await chrome.storage.local.set({ bloqueado: ligar });
  if (ligar) await garantirTela(URL_BLOQUEIO, true);
  else if (st.bloqueado) await fecharTela(URL_BLOQUEIO);
}

// ---------- telas da extensão (bloqueio e entrada) ----------

// Abre a tela (ou traz para frente). "travada" = janela própria em tela cheia.
async function garantirTela(url, travada) {
  const abas = await chrome.tabs.query({ url });
  if (abas.length) {
    const aba = abas[0];
    await chrome.tabs.update(aba.id, { active: true });
    await chrome.windows.update(aba.windowId, travada ? { focused: true, state: "fullscreen" } : { focused: true });
    for (const extra of abas.slice(1)) chrome.tabs.remove(extra.id).catch(() => {});
  } else if (travada) {
    await chrome.windows.create({ url, type: "popup", state: "fullscreen", focused: true });
  } else {
    await chrome.tabs.create({ url, active: true });
  }
}

async function fecharTela(url) {
  const abas = await chrome.tabs.query({ url });
  for (const a of abas) await chrome.tabs.remove(a.id).catch(() => {});
}

// Qual tela deve ficar na frente agora (ou null se nenhuma é obrigatória).
async function telaObrigatoria() {
  const st = await estado();
  if (st.bloqueado) return URL_BLOQUEIO;
  if (!st.aula && (await entradaObrigatoria())) return URL_ENTRADA;
  return null;
}

// Abre a tela de entrada quando o aluno liga o Chromebook / abre o Chrome.
async function abrirEntradaAoIniciar() {
  const st = await estado();
  if (st.aula) return;
  await garantirTela(URL_ENTRADA, await entradaObrigatoria());
}

// Enquanto uma tela é obrigatória, qualquer tentativa de sair dela volta para ela.
let reforcoAgendado = false;
async function reforcarTela() {
  if (reforcoAgendado) return;
  reforcoAgendado = true;
  await esperar(300);
  reforcoAgendado = false;
  const url = await telaObrigatoria();
  if (!url) return;
  const [ativa] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (ativa && ativa.url === url) return;
  // entrada obrigatória: o aluno pode usar o Portal para entrar com a conta dele (o bloqueio do professor continua valendo)
  if (url === URL_ENTRADA && ativa && String(ativa.url || ativa.pendingUrl || "").startsWith(URL_PORTAL)) return;
  await garantirTela(url, true);
}

chrome.tabs.onActivated.addListener(reforcarTela);
chrome.windows.onFocusChanged.addListener(reforcarTela);
chrome.tabs.onRemoved.addListener(reforcarTela);
chrome.tabs.onCreated.addListener(async (aba) => {
  const url = await telaObrigatoria();
  const destino = aba.pendingUrl || aba.url || "";
  if (!url || destino.startsWith(chrome.runtime.getURL(""))) return;
  if (url === URL_ENTRADA && destino.startsWith(URL_PORTAL)) return;
  // Nunca fechar a última aba de uma janela: isso fecharia o próprio Chrome.
  // Nesse caso a aba é levada para a tela obrigatória em vez de ser fechada.
  const irmas = await chrome.tabs.query({ windowId: aba.windowId });
  if (irmas.length <= 1) {
    chrome.tabs.update(aba.id, { url }).catch(() => {});
  } else {
    chrome.tabs.remove(aba.id).catch(() => {});
  }
});

// ---------- ciclo principal ----------

async function ciclo() {
  if (cicloRodando) return;
  cicloRodando = true;
  let volta = 0;
  try {
    // cada volta chama a API de storage, o que mantém o service worker acordado durante a aula
    while ((await estado()).aula) {
      // comandos e presença em blocos separados: uma falha num não derruba o outro
      try {
        await verificarControle();
      } catch (e) {
        console.warn("[Portal Maestro] Falha nos comandos:", e.message);
      }
      try {
        await conferirMao();
      } catch (e) { /* tenta de novo na próxima volta */ }
      if (volta % HEARTBEAT_A_CADA === 0) {
        try {
          await enviarPresenca();
        } catch (e) {
          console.warn("[Portal Maestro] Falha na presença:", e.message);
        }
      }
      volta++;
      await esperar(INTERVALO_MS);
    }
  } finally {
    cicloRodando = false;
  }
}

// ---------- entrar e sair da aula ----------

async function entrarNaAula(codigo, nome, alunoId) {
  codigo = String(codigo || "").replace(/\D/g, "");
  if (codigo.length !== 6) return { ok: false, erro: "O número da aula tem 6 dígitos." };
  if (!String(nome || "").trim()) return { ok: false, erro: "Digite seu nome." };

  let aula;
  try {
    aula = await fb(`aulas/${codigo}`);
  } catch (e) {
    return { ok: false, erro: "Sem conexão com o servidor. Verifique a internet." };
  }
  if (!aula) return { ok: false, erro: "Aula não encontrada. Confira o número com o professor." };
  if (aula.controle && aula.controle.encerrada) return { ok: false, erro: "Esta aula já foi encerrada." };

  // pelo Portal: se já está nesta mesma aula, não entra de novo (a página do Portal avisa a cada carregamento)
  const atual = await estado();
  if (atual.aula === codigo) return { ok: true, ja: true, professor: aula.professor || "" };

  // comandos que já existiam antes de o aluno entrar não são reexecutados
  const id = await obterDeviceId();
  const antigos = [];
  if (aula.controle && aula.controle.comando) antigos.push(aula.controle.comando.id);
  if (aula.controle && aula.controle.comandos && aula.controle.comandos[id]) antigos.push(aula.controle.comandos[id].id);

  const matricula = /^[A-Za-z0-9_-]{1,64}$/.test(String(alunoId || "")) ? String(alunoId) : "";
  await chrome.storage.local.set({ aula: codigo, nome: String(nome).trim().slice(0, 60), alunoId: matricula, executados: antigos, bloqueado: false, mao: false });
  await fecharTela(URL_ENTRADA);
  await enviarPresenca().catch(() => {});
  await fb(`aulas/${codigo}/alunos/${id}`, "PATCH", { entrouEm: { ".sv": "timestamp" } }).catch(() => {});
  ciclo();
  return { ok: true, professor: aula.professor || "" };
}

async function sairDaAula(avisarServidor) {
  const st = await estado();
  const id = await obterDeviceId();
  if (avisarServidor && st.aula) {
    await fb(`aulas/${st.aula}/alunos/${id}`, "DELETE").catch(() => {});
  }
  await chrome.storage.local.set({ aula: null, bloqueado: false, executados: [], regencia: { afinacao: null, compasso: null, pergunta: null }, mao: false });
  await fecharTela(URL_BLOQUEIO);
  await fecharTela(URL_REGENCIA);
  await chrome.action.setBadgeText({ text: "" });
  // com entrada obrigatória, ao sair/encerrar a tela de entrada volta
  if (await entradaObrigatoria()) await garantirTela(URL_ENTRADA, true);
}

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  (async () => {
    if (msg.tipo === "entrar") return entrarNaAula(msg.aula, msg.nome, msg.aluno);
    if (msg.tipo === "abrirPortal") { await chrome.tabs.create({ url: URL_PORTAL + "entrar/?qr", active: true }); return { ok: true }; }
    if (msg.tipo === "afinacao") return responderAfinacao(msg.id, msg.valor);
    if (msg.tipo === "pergunta") return responderPergunta(msg.id, msg.resposta);
    if (msg.tipo === "mao") return alternarMao();
    if (msg.tipo === "sair") {
      const st = await estado();
      if (st.bloqueado) return { ok: false, erro: "Tela pausada pelo professor." };
      await sairDaAula(true);
      return { ok: true };
    }
    if (msg.tipo === "status") {
      const st = await estado();
      return {
        ok: true, aula: st.aula || null, nome: st.nome || "", bloqueado: !!st.bloqueado,
        email: await obterEmail(), obrigatoria: await entradaObrigatoria(),
        mao: !!(await chrome.storage.local.get("mao")).mao
      };
    }
    return { ok: false, erro: "Mensagem desconhecida." };
  })().then(responder);
  return true; // resposta assíncrona
});

// ---------- inicialização ----------

chrome.alarms.create("vigia", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "vigia") ciclo(); // religa o ciclo se o Chrome tiver hibernado o service worker
});
chrome.runtime.onStartup.addListener(async () => {
  // O bloqueio nunca sobrevive a um reinício do Chrome: ele só volta se o painel
  // do professor confirmar (em até 3 s, pelo ciclo). Evita aluno preso com estado antigo.
  await chrome.storage.local.set({ bloqueado: false });
  ciclo();
  abrirEntradaAoIniciar();
});
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ bloqueado: false });
  ciclo();
  abrirEntradaAoIniciar();
});
chrome.storage.onChanged.addListener((_mudancas, area) => {
  if (area === "managed") reforcarTela(); // escola mudou a política
});
ciclo();
