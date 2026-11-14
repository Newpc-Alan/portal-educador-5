// Motor de Jogos do Portal do Educador (nov/2026).
// Cada jogo reformulado é só o CONTEÚDO (como gerar cada desafio, a dica e a explicação); o motor cuida do resto, igual em todos:
//   · tela única que ocupa lousa, tablet e celular (pde-jogo.css), toque grande, teclado físico, voz ("Ouvir") e acessibilidade;
//   · ciclo pedagógico: 1ª tentativa → errou? DICA de estratégia e nova tentativa → errou de novo? EXPLICAÇÃO passo a passo,
//     e o desafio volta mais adiante na rodada (repetição espaçada); sem relógio e sem punição;
//   · nível adaptativo: 4 acertos seguidos de primeira sobem o nível, 2 desafios errados seguidos descem;
//   · modos: Sozinho, Dupla (2 jogadores se alternam) e Turma (lousa: alternativas grandes, a turma responde junta);
//   · resultado por habilidade da BNCC, "treinar o que errei" e registro para o professor (callable jogoResultado, sem nome).
// Uso: PDEJogo.criar({ id, titulo, emoji, descricao, tema:[cor1,cor2], habilidades:{COD:"texto"}, niveis:[{nome,hab}],
//        opcoes:[{id,rotulo,itens:[{v,t,s}],multi,num}], rodada:10, ajuda:[...], gerar(ctx) → desafio })
// desafio = { chave, hab, pergunta | desenhar(el), texto:true?, fala, tipo:"teclado"|"escolha"|"livre" (com montar(el, api) e tecla(e, api)?), resposta, alternativas?, apoio(el)?, dica, explicacao, rotulo }
(function(){
"use strict";
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const sorteia = a => a[Math.floor(Math.random() * a.length)];
const embaralha = a => { a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const guarda = { ler(k, p){ try{ const v = localStorage.getItem(k); return v === null ? p : JSON.parse(v); }catch(e){ return p; } }, por(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
const bruto = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };

/* ---------- acessibilidade (as mesmas chaves dos jogos antigos: vale para todos) ---------- */
const A11Y = { contraste:bruto("pde_a11y_contraste") === "1", daltonico:bruto("pde_a11y_daltonico") === "1", calmo:bruto("pde_a11y_animacoes") === "1", grande:guarda.ler("pde_jogo_grande", false), som:guarda.ler("pde_jogo_som", true) };
function aplicarA11y(){
  const h = document.documentElement.classList;
  h.toggle("pj-contraste", A11Y.contraste); h.toggle("pj-daltonico", A11Y.daltonico); h.toggle("pj-calmo", A11Y.calmo); h.toggle("pj-grande", A11Y.grande);
}
function salvarA11y(){
  try{ localStorage.setItem("pde_a11y_contraste", A11Y.contraste ? "1" : "0"); localStorage.setItem("pde_a11y_daltonico", A11Y.daltonico ? "1" : "0"); localStorage.setItem("pde_a11y_animacoes", A11Y.calmo ? "1" : "0"); }catch(e){}
  guarda.por("pde_jogo_grande", A11Y.grande); guarda.por("pde_jogo_som", A11Y.som); aplicarA11y();
}

/* ---------- som e voz ---------- */
let actx = null;
function tom(freqs, dur){
  if(!A11Y.som) return;
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if(actx.state === "suspended") actx.resume();
    freqs.forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * (dur || .11);
      o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + (dur || .11) + .08);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + (dur || .11) + .1); });
  }catch(e){}
}
const SOM = { certo:() => tom([660, 880]), dica:() => tom([330], .16), erro:() => tom([220, 196], .14), nivel:() => tom([523, 659, 784, 1047], .1), fim:() => tom([523, 659, 784, 659, 1047], .12), toque:() => tom([520], .04) };
function falar(txt){
  if(!txt || !("speechSynthesis" in window)) return;
  try{ speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(txt)); u.lang = "pt-BR"; u.rate = .92;
    const v = speechSynthesis.getVoices().find(x => /pt[-_]BR/i.test(x.lang)); if(v) u.voice = v; speechSynthesis.speak(u); }catch(e){}
}
function confete(){
  if(A11Y.calmo) return;
  const cores = ["#8DC63F", "#F5B700", "#37B1DA", "#EF7D22", "#ffffff"];
  for(let i = 0; i < 36; i++){ const c = document.createElement("i"); c.className = "pj-conf"; c.style.left = Math.random() * 100 + "vw"; c.style.background = sorteia(cores);
    c.style.animationDelay = Math.random() * .5 + "s"; c.style.borderRadius = Math.random() > .5 ? "50%" : ".15rem"; document.body.appendChild(c); setTimeout(() => c.remove(), 2600); }
}

/* ---------- registro para o professor (só com conta aberta; sem nome, por habilidade) ---------- */
let fbPronto = null;
function firebase(){
  if(fbPronto) return fbPronto;
  const cfg = window.PDE_AMBIENTE && window.PDE_AMBIENTE.fb;
  fbPronto = !cfg ? Promise.resolve(null) : (async () => {
    const V = "https://www.gstatic.com/firebasejs/10.12.2/";
    const [a, au, fn] = await Promise.all([import(V + "firebase-app.js"), import(V + "firebase-auth.js"), import(V + "firebase-functions.js")]);
    const app = a.getApps().length ? a.getApp() : a.initializeApp(cfg), auth = au.getAuth(app);
    const user = await new Promise(r => { const off = au.onAuthStateChanged(auth, u => { off(); r(u); }, () => r(null)); setTimeout(() => r(auth.currentUser), 4000); });
    const F = fn.getFunctions(app, "southamerica-east1");
    return user ? { chamar:fn.httpsCallable(F, "jogoResultado", { timeout:20000 }), turmas:fn.httpsCallable(F, "jogoTurmas", { timeout:20000 }) } : null;
  })().catch(e => { console.warn("jogo: sem registro", e && e.message); return null; });
  return fbPronto;
}
// turmas do professor (só para o modo Turma, na lousa): pede uma vez e guarda enquanto a página estiver aberta
let turmasProf = null, turmaSala = "";
function minhasTurmas(){
  if(!turmasProf) turmasProf = firebase().then(f => f ? f.turmas({}).then(r => (r.data && r.data.turmas) || []) : []).catch(() => []);
  return turmasProf;
}
async function registrar(dados){
  try{ const f = await firebase(); if(!f) return false; await f.chamar(dados); return true; }catch(e){ console.warn("jogo: registro", e && (e.code || e.message)); return false; }
}

/* ---------- o motor ---------- */
function criar(J){
  aplicarA11y();
  if(J.tema){ document.documentElement.style.setProperty("--tema", J.tema[0]); document.documentElement.style.setProperty("--tema2", J.tema[1] || J.tema[0]); }
  document.title = J.titulo + " · Portal do Educador";
  const CFG = Object.assign({ modo:"solo", nivel:0, trilha:true, opc:{} }, guarda.ler("pde_jogo_" + J.id, {}));
  (J.opcoes || []).forEach(o => { if(CFG.opc[o.id] === undefined) CFG.opc[o.id] = o.padrao !== undefined ? o.padrao : (o.multi ? [] : o.itens[0].v); });
  const RODADA = J.rodada || 10, NIVEIS = J.niveis || [{ nome:"Único" }];
  let E = null;   // estado da rodada

  const raiz = document.createElement("div"); raiz.className = "pj"; document.body.appendChild(raiz);
  raiz.innerHTML = '<header class="pj-topo"><button type="button" class="pj-ic" data-a="voltar" aria-label="Voltar" title="Voltar">←</button><h1><span aria-hidden="true">' + esc(J.emoji || "🎮") + "</span>" + esc(J.titulo) + '</h1>' +
    '<span class="pj-nivel" id="pjNivel" hidden></span><div class="pj-prog" id="pjProg" hidden><i><b></b></i><span></span></div>' +
    '<button type="button" class="pj-ic" data-a="som" aria-label="Som" title="Som"></button><button type="button" class="pj-ic" data-a="a11y" aria-label="Acessibilidade" title="Acessibilidade">♿</button>' +
    '<button type="button" class="pj-ic" data-a="ajuda" aria-label="Como jogar" title="Como jogar">?</button><button type="button" class="pj-ic" data-a="cheia" aria-label="Tela cheia" title="Tela cheia">⛶</button></header><main class="pj-tela" id="pjTela"></main>';
  const tela = $("#pjTela", raiz);
  const pintaSom = () => { const b = $('[data-a="som"]', raiz); b.textContent = A11Y.som ? "🔊" : "🔇"; b.setAttribute("aria-pressed", A11Y.som ? "true" : "false"); };
  pintaSom();
  const salvarCfg = () => guarda.por("pde_jogo_" + J.id, CFG);

  /* ----- abertura ----- */
  function abertura(){
    E = null; $("#pjProg", raiz).hidden = true; $("#pjNivel", raiz).hidden = true; raiz.classList.remove("jogando");
    const modos = [["solo", "🙂 Sozinho", "no seu ritmo"], ["dupla", "🧑‍🤝‍🧑 Dupla", "um de cada vez"], ["turma", "🖥️ Turma", "todos juntos na lousa"]];
    const chip = (grupo, v, t, s, on, num) => '<button type="button" class="pj-chip" data-g="' + grupo + '" data-v="' + esc(v) + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(t) + (s ? "<small>" + esc(s) + "</small>" : "") + "</button>";
    tela.innerHTML = '<div class="pj-ini"><section class="pj-ini-a"><span class="pj-selo">' + esc(J.selo || "Jogo do Portal do Educador") + '</span><div class="emoji" aria-hidden="true">' + esc(J.emoji || "🎮") + "</div><h2>" + esc(J.titulo) + "</h2><p>" + esc(J.descricao || "") + "</p>" +
      '<div class="pj-habs" title="Habilidades da BNCC trabalhadas">' + (hs => hs.slice(0, 6).map(h => "<span>" + esc(h) + "</span>").join("") + (hs.length > 6 ? "<span>+" + (hs.length - 6) + " habilidades</span>" : ""))(Object.keys(J.habilidades || {})) + "</div></section>" +
      '<section class="pj-ini-b"><div><div class="pj-rot">Como vamos jogar</div><div class="pj-chips" style="margin-top:.4rem">' + modos.map(m => chip("modo", m[0], m[1], m[2], CFG.modo === m[0])).join("") + "</div></div>" +
      (CFG.modo === "turma" ? '<div id="pjTurmaBox" hidden><div class="pj-rot">Qual turma está na sala?</div><select class="pj-sel" id="pjTurma" aria-label="Qual turma está na sala"></select><small class="pj-mini">Assim o resultado entra no Painel dos Jogos da turma certa.</small></div>' : "") +
      (NIVEIS.length > 1 ? '<div><div class="pj-rot">Por onde começar</div><div class="pj-chips" style="margin-top:.4rem">' + chip("trilha", "1", "✨ Trilha", "o jogo ajusta o nível", CFG.trilha) + NIVEIS.map((n, i) => chip("nivel", i, (i + 1) + " · " + n.nome, n.sub || "", !CFG.trilha && CFG.nivel === i)).join("") + "</div></div>" : "") +
      (J.opcoes || []).map(o => '<div><div class="pj-rot">' + esc(o.rotulo) + '</div><div class="pj-chips' + (o.num ? " num" : "") + '" style="margin-top:.4rem">' + o.itens.map(it => chip("o:" + o.id, it.v, it.t, it.s || "", o.multi ? (CFG.opc[o.id] || []).map(String).includes(String(it.v)) : String(CFG.opc[o.id]) === String(it.v))).join("") + "</div></div>").join("") +
      '<button type="button" class="pj-bt largo" data-a="jogar">▶ Jogar</button></section></div>';
    // só aparece para professor ou gestor com turmas; aluno e visitante não veem nada
    if(CFG.modo === "turma") minhasTurmas().then(l => { const box = $("#pjTurmaBox", raiz), sel = $("#pjTurma", raiz); if(!box || !l.length) return;
      // a escolha vale só enquanto a página estiver aberta: a lousa é de vários professores, e lembrar a turma de ontem gravaria na turma errada
      if(!l.some(t => t.id === turmaSala)) turmaSala = "";
      sel.innerHTML = '<option value="">Escolha a turma (opcional)</option>' + l.map(t => '<option value="' + esc(t.id) + '"' + (t.id === turmaSala ? " selected" : "") + ">" + esc(t.nome) + (t.minha ? " ★" : "") + "</option>").join("");
      sel.onchange = () => { turmaSala = sel.value; }; box.hidden = false; });
  }
  function tocarChip(b){
    const g = b.dataset.g, v = b.dataset.v;
    if(g === "modo") CFG.modo = v;
    else if(g === "trilha") CFG.trilha = true;
    else if(g === "nivel"){ CFG.trilha = false; CFG.nivel = +v; }
    else if(g.startsWith("o:")){ const o = (J.opcoes || []).find(x => x.id === g.slice(2)); if(!o) return;
      if(o.multi){ const l = (CFG.opc[o.id] || []).map(String), i = l.indexOf(v); if(i >= 0) l.splice(i, 1); else l.push(v); CFG.opc[o.id] = l; } else CFG.opc[o.id] = v;
      if(o.aoMudar) o.aoMudar(CFG); }
    salvarCfg(); SOM.toque(); abertura();
  }

  /* ----- rodada ----- */
  function comecar(soErros){
    const jog = CFG.modo === "dupla" ? 2 : 1;
    E = { modo:CFG.modo, nivel:CFG.trilha ? Math.min(guarda.ler("pde_jogo_nv_" + J.id, 0), NIVEIS.length - 1) : CFG.nivel, nivelMax:0, trilha:CFG.trilha && !soErros, feitos:0, total:soErros ? Math.min(RODADA, soErros.length) : RODADA * (jog === 2 ? 1.2 : 1) | 0,
      seguidos:0, errosSeg:0, fila:[], refazer:soErros ? soErros.slice() : null, vistos:[], habs:{}, erradas:[], jog, vez:0, placar:[0, 0], primeira:0, ini:Date.now(), item:null, tent:0, digit:"", travado:false };
    E.nivelMax = E.nivel; raiz.classList.add("jogando");
    tela.innerHTML = '<div class="pj-jogo"><section class="pj-palco" id="pjPalco"><span class="pj-vez" id="pjVez" hidden></span><button type="button" class="pj-ouvir" data-a="ouvir" aria-label="Ouvir a pergunta" title="Ouvir">🔊</button>' +
      '<div class="pj-apoio" id="pjApoio"></div><div class="pj-perg" id="pjPerg" aria-live="polite"></div><div class="pj-retorno" id="pjRet" role="status" aria-live="assertive"></div></section>' +
      '<section class="pj-resp" id="pjResp"></section></div>';
    $("#pjProg", raiz).hidden = false; $("#pjNivel", raiz).hidden = NIVEIS.length < 2;
    proximo();
  }
  function ctx(){ return { nivel:E.nivel, opc:CFG.opc, modo:E.modo, vistos:E.vistos, sorteia, embaralha }; }
  function proximo(){
    let it = null;
    const volta = E.fila.findIndex(f => f.em <= E.feitos);
    if(E.feitos >= E.total){                       // rodada base terminou: ainda devolve até 3 desafios que ficaram para rever
      if(E.fila.length && E.feitos < E.total + 3) it = E.fila.shift().item; else return fim();
    }
    else if(volta >= 0) it = E.fila.splice(volta, 1)[0].item;       // repetição espaçada: o que errou volta 3 desafios depois
    else if(E.refazer){ it = E.refazer.shift(); if(!it) return fim(); }
    else{ for(let k = 0; k < 12; k++){ it = J.gerar(ctx()); if(!E.vistos.slice(-5).includes(it.chave)) break; } }
    it = Object.assign({}, it);
    E.item = it; E.tent = 0; E.digit = ""; E.travado = false; E.vistos.push(it.chave);
    desenhar();
  }
  function desenhar(){
    const it = E.item, pg = $("#pjPerg", raiz), ap = $("#pjApoio", raiz), ret = $("#pjRet", raiz);
    $("#pjNivel", raiz).textContent = "Nível " + (E.nivel + 1) + " · " + NIVEIS[E.nivel].nome;
    const p = $("#pjProg", raiz); p.querySelector("b").style.width = Math.min(100, E.feitos / E.total * 100) + "%"; p.querySelector("span").textContent = Math.min(E.feitos + 1, E.total) + " de " + E.total;
    const vz = $("#pjVez", raiz); vz.hidden = E.jog < 2; if(E.jog === 2){ vz.textContent = "Vez do jogador " + (E.vez + 1); vz.className = "pj-vez" + (E.vez ? " j2" : ""); }
    pg.className = "pj-perg" + (it.texto ? " texto" : ""); pg.innerHTML = ""; ap.innerHTML = ""; ret.className = "pj-retorno"; ret.textContent = "";
    if(it.desenhar) it.desenhar(pg); else pg.innerHTML = it.perguntaHtml || esc(it.pergunta);
    if(it.apoio) it.apoio(ap);
    resposta();
  }
  // em Turma (lousa) e quando o desafio pede, a resposta é por alternativas grandes; senão, teclado numérico
  function alternativas(it){
    if(it.alternativas) return embaralha(it.alternativas);
    const r = Number(it.resposta), s = new Set([r]); let g = 0;
    while(s.size < 4 && g++ < 60){ const d = sorteia([-10, -3, -2, -1, 1, 2, 3, 10, r > 20 ? 11 : 4]), v = r + d; if(v >= 0) s.add(v); }
    return embaralha([...s]);
  }
  function resposta(){
    const it = E.item, box = $("#pjResp", raiz), escolha = it.tipo === "escolha" || E.modo === "turma";
    const placar = E.jog === 2 ? '<div class="pj-placar"><span class="' + (E.vez === 0 ? "vez" : "") + '">Jogador 1: ' + E.placar[0] + '</span><span class="j2 ' + (E.vez === 1 ? "vez" : "") + '">Jogador 2: ' + E.placar[1] + "</span></div>" : "";
    if(it.tipo === "livre"){
      // prática livre (mouse, teclado, arrastar): o jogo monta a própria área e avisa o motor a cada acerto ou erro
      box.innerHTML = placar + '<div class="pj-livre" id="pjLivre"></div>';
      it.montar($("#pjLivre", raiz), apiLivre());
    }else if(escolha){
      E.alts = alternativas(it);
      box.innerHTML = placar + '<div class="pj-opc' + (E.alts.some(a => String(a).length > 6) ? " texto" : "") + '">' + E.alts.map((a, i) => '<button type="button" data-alt="' + i + '">' + esc(a) + "</button>").join("") + "</div>" +
        (E.modo === "turma" ? '<div class="pj-seguir"><button type="button" class="pj-bt sec" data-a="mostrar">👀 Mostrar a resposta</button></div>' : "");
    }else{
      box.innerHTML = placar + '<div class="pj-visor vazio" id="pjVisor">toque nos números</div><div class="pj-tecl">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button type="button" data-n="' + n + '">' + n + "</button>").join("") +
        '<button type="button" class="apaga" data-n="x" aria-label="Apagar">⌫</button><button type="button" data-n="0">0</button><button type="button" class="ok" data-n="ok" aria-label="Confirmar">✓</button></div>';
    }
  }
  const ERRO_LIVRE = "\u0000";
  function apiLivre(){ return { certo:() => conferir(E.item.resposta), errado:() => conferir(ERRO_LIVRE), travado:() => !!E.travado, som:SOM }; }
  function digitar(n){
    if(E.travado) return;
    if(n === "ok") return E.digit ? conferir(E.digit) : null;
    E.digit = n === "x" ? E.digit.slice(0, -1) : (E.digit + n).slice(0, 5);
    const v = $("#pjVisor", raiz); v.textContent = E.digit || "toque nos números"; v.classList.toggle("vazio", !E.digit); SOM.toque();
  }
  function conferir(valor, botao){
    if(E.travado) return;
    const it = E.item, certo = String(valor).trim().toLowerCase() === String(it.resposta).trim().toLowerCase();
    const ret = $("#pjRet", raiz), palco = $("#pjPalco", raiz), h = it.hab || "geral", H = E.habs[h] || (E.habs[h] = { c:0, t:0 });
    E.tent++;
    if(certo){
      E.travado = true; const dePrimeira = E.tent === 1;
      if(!it._contado){ H.t++; if(dePrimeira) H.c++; }
      if(dePrimeira){ E.primeira++; E.seguidos++; E.errosSeg = 0; if(E.jog === 2) E.placar[E.vez]++; } else E.seguidos = 0;
      if(botao) botao.classList.add("certa");
      if(it.aoRevelar) it.aoRevelar($("#pjApoio", raiz));
      ret.className = "pj-retorno ok"; ret.textContent = dePrimeira ? sorteia(["Isso mesmo!", "Muito bem!", "Certinho!", "Mandou bem!", "Perfeito!"]) : "Agora sim! " + (it.fechamento || "");
      palco.classList.remove("pj-pulo"); void palco.offsetWidth; palco.classList.add("pj-pulo"); SOM.certo();
      seguir(dePrimeira ? 900 : 1500);
    }else if(E.tent === 1){
      // 1º erro: dica de estratégia, sem dar a resposta, e nova tentativa
      E.seguidos = 0; if(botao){ botao.classList.add("errada"); botao.disabled = true; }
      E.digit = ""; const v = $("#pjVisor", raiz); if(v){ v.textContent = "tente de novo"; v.classList.add("vazio"); }
      ret.className = "pj-retorno dica"; ret.innerHTML = "💡 " + (typeof it.dica === "function" ? it.dica() : esc(it.dica || "Olhe com calma e tente de novo."));
      palco.classList.remove("pj-treme"); void palco.offsetWidth; palco.classList.add("pj-treme"); SOM.dica();
    }else revelar(botao);
  }
  // 2º erro (ou "Mostrar a resposta" na lousa): explica passo a passo e o desafio volta mais adiante
  function revelar(botao, semErro){
    const it = E.item, ret = $("#pjRet", raiz), h = it.hab || "geral", H = E.habs[h] || (E.habs[h] = { c:0, t:0 });
    E.travado = true; if(botao) botao.classList.add("errada");
    if(it.aoRevelar) it.aoRevelar($("#pjApoio", raiz));
    if(!semErro){ if(!it._contado) H.t++; E.errosSeg++; E.seguidos = 0; if(!E.erradas.some(x => x.chave === it.chave)) E.erradas.push(it);
      if(!it._contado && E.fila.length < 3) E.fila.push({ em:E.feitos + 3, item:Object.assign({}, it, { _contado:true }) }); SOM.erro(); }
    document.querySelectorAll(".pj-opc button").forEach((b, i) => { if(String(E.alts[i]) === String(it.resposta)) b.classList.add("certa"); b.disabled = true; });
    ret.className = "pj-retorno " + (semErro ? "ok" : "no"); ret.innerHTML = (semErro ? "" : "Vamos ver juntos: ") + (typeof it.explicacao === "function" ? it.explicacao() : esc(it.explicacao || "A resposta é " + it.resposta + "."));
    const box = $("#pjResp", raiz), s = document.createElement("div"); s.className = "pj-seguir"; s.innerHTML = '<button type="button" class="pj-bt" data-a="seguir">Entendi, próxima ▶</button>';
    const m = box.querySelector(".pj-seguir"); if(m) m.remove(); box.appendChild(s); s.firstChild.focus();
  }
  function seguir(ms){
    const vai = () => {
      E.feitos++; if(E.jog === 2) E.vez = 1 - E.vez;
      // nível adaptativo (só na Trilha)
      if(E.trilha){
        if(E.seguidos >= 4 && E.nivel < NIVEIS.length - 1){ E.nivel++; E.nivelMax = Math.max(E.nivelMax, E.nivel); E.seguidos = 0; guarda.por("pde_jogo_nv_" + J.id, E.nivel); aviso("⬆️ Subiu para o nível " + (E.nivel + 1) + ": " + NIVEIS[E.nivel].nome); SOM.nivel(); }
        else if(E.errosSeg >= 2 && E.nivel > 0){ E.nivel--; E.errosSeg = 0; guarda.por("pde_jogo_nv_" + J.id, E.nivel); aviso("Vamos firmar o nível " + (E.nivel + 1) + " primeiro"); }
      }
      proximo();
    };
    if(ms) setTimeout(vai, A11Y.calmo ? Math.min(ms, 700) : ms); else vai();
  }
  function aviso(t){ const n = $("#pjNivel", raiz); n.textContent = t; n.classList.remove("pj-pulo"); void n.offsetWidth; n.classList.add("pj-pulo"); }

  /* ----- resultado ----- */
  function fim(){
    const tot = Object.values(E.habs).reduce((s, h) => s + h.t, 0) || 1, cer = Object.values(E.habs).reduce((s, h) => s + h.c, 0), pct = Math.round(cer / tot * 100);
    const est = pct >= 90 ? 3 : pct >= 65 ? 2 : pct >= 35 ? 1 : 0, dur = Math.round((Date.now() - E.ini) / 1000);
    $("#pjProg", raiz).hidden = true; raiz.classList.remove("jogando");
    const msg = E.jog === 2 ? (E.placar[0] === E.placar[1] ? "Empate! Os dois mandaram bem." : "Jogador " + (E.placar[0] > E.placar[1] ? 1 : 2) + " fez mais pontos. Parabéns aos dois!")
      : est === 3 ? "Você dominou esta rodada!" : est === 2 ? "Muito bom! Falta pouco para dominar." : est === 1 ? "Bom treino! Vale repetir o que errou." : "Cada tentativa ensina. Vamos de novo com calma?";
    const erradas = E.erradas.slice(0, 12);
    tela.innerHTML = '<div class="pj-fim"><section class="pj-fim-a"><div class="pj-estrelas" role="img" aria-label="' + est + ' de 3 estrelas">' + [0, 1, 2].map(i => '<span class="' + (i < est ? "" : "off") + '">⭐</span>').join("") + "</div><h2>" + cer + " de " + tot + " de primeira</h2><p>" + esc(msg) + "</p>" +
      (E.jog === 2 ? '<div class="pj-placar"><span>Jogador 1: ' + E.placar[0] + '</span><span class="j2">Jogador 2: ' + E.placar[1] + "</span></div>" : "") + "</section>" +
      '<section class="pj-fim-b"><div class="pj-rot">O que foi treinado</div>' + Object.entries(E.habs).map(([h, v]) => '<div class="pj-hab"><span><b>' + esc(h === "geral" ? "Desafios" : h) + "</b> " + esc((J.habilidades || {})[h] || "") + "</span><b>" + v.c + "/" + v.t + '</b><i><b style="width:' + (v.t ? v.c / v.t * 100 : 0) + '%"></b></i></div>').join("") +
      (erradas.length ? '<div class="pj-rot" style="margin-top:.3rem">Para treinar mais</div><div class="pj-treinar">' + erradas.map(x => "<span>" + esc(x.rotulo || x.pergunta || x.chave) + "</span>").join("") + "</div>" : '<p style="font-weight:600;color:var(--certo)">Nenhum erro nesta rodada. 🎉</p>') +
      '<div class="pj-acoes">' + (erradas.length ? '<button type="button" class="pj-bt" data-a="erros">🎯 Treinar o que errei</button>' : "") + '<button type="button" class="pj-bt' + (erradas.length ? " sec" : "") + '" data-a="denovo">▶ Jogar de novo</button><button type="button" class="pj-bt sec" data-a="inicio">Trocar o jeito de jogar</button></div>' +
      '<p class="pj-nota" id="pjNota"></p></section></div>';
    const guardadas = erradas.map(x => Object.assign({}, x)); raiz._erradas = guardadas;
    SOM.fim(); if(est >= 2) confete();
    registrar({ jogo:J.id, modo:E.modo, turma_id:E.modo === "turma" ? turmaSala : "", nivel:E.nivelMax + 1, niveis:NIVEIS.length, duracao:dur, acertos:cer, total:tot, habs:Object.entries(E.habs).map(([h, v]) => ({ h, c:v.c, t:v.t })).slice(0, 12) })
      .then(ok => { const n = $("#pjNota", raiz); if(n) n.textContent = ok ? "Resultado guardado para o professor acompanhar (por habilidade, sem expor nomes)." : ""; });
  }

  /* ----- janelas ----- */
  function janela(html){ const f = document.createElement("div"); f.className = "pj-fundo"; f.innerHTML = '<div class="pj-jan" role="dialog" aria-modal="true">' + html + '<button type="button" class="pj-bt largo" data-a="fechar">Entendi</button></div>'; document.body.appendChild(f); f.querySelector("[data-a=fechar]").focus(); return f; }
  function ajuda(){
    janela("<h2>" + esc(J.emoji || "") + " Como jogar</h2><ul>" + (J.ajuda || []).map(x => "<li>" + esc(x) + "</li>").join("") +
      "<li>Errou? Aparece uma <b>dica</b> e você tenta de novo. Se precisar, o jogo <b>explica</b> e a pergunta volta mais tarde.</li><li><b>Trilha</b>: o nível sobe sozinho quando você acerta 4 seguidas.</li><li><b>Turma</b>: para a lousa, com alternativas grandes; o professor toca na resposta que a turma escolher.</li></ul>" +
      (Object.keys(J.habilidades || {}).length ? '<p class="pj-rot">BNCC</p><ul>' + Object.entries(J.habilidades).map(([h, t]) => "<li><b>" + esc(h) + "</b>: " + esc(t) + "</li>").join("") + "</ul>" : ""));
  }
  function acess(){
    const lin = (k, t, s) => '<button type="button" class="pj-chip" data-acc="' + k + '" aria-pressed="' + (A11Y[k] ? "true" : "false") + '" style="width:100%">' + t + "<small>" + s + "</small></button>";
    const f = janela('<h2>♿ Acessibilidade</h2><p>Vale para todos os jogos do Portal neste aparelho.</p><div class="pj-chips" id="pjAcc">' + lin("grande", "🔠 Letras maiores", "para baixa visão ou sala grande") + lin("contraste", "🌓 Alto contraste", "preto e amarelo") +
      lin("daltonico", "🎨 Modo daltônico", "azul e laranja no lugar de verde e vermelho") + lin("calmo", "🧘 Menos animação", "sem confete nem tremidas") + "</div>");
    f.addEventListener("click", e => { const b = e.target.closest("[data-acc]"); if(!b) return; A11Y[b.dataset.acc] = !A11Y[b.dataset.acc]; b.setAttribute("aria-pressed", A11Y[b.dataset.acc] ? "true" : "false"); salvarA11y(); });
  }

  /* ----- eventos (toque, mouse e teclado físico) ----- */
  document.addEventListener("click", e => {
    const t = e.target;
    const f = t.closest('[data-a="fechar"]'); if(f){ f.closest(".pj-fundo").remove(); return; }
    if(t.classList.contains("pj-fundo")){ t.remove(); return; }
    const ch = t.closest("[data-g]"); if(ch) return tocarChip(ch);
    const n = t.closest("[data-n]"); if(n && E) return digitar(n.dataset.n);
    const al = t.closest("[data-alt]"); if(al && E && !al.disabled) return conferir(E.alts[+al.dataset.alt], al);
    const a = t.closest("[data-a]"); if(!a) return;
    const k = a.dataset.a;
    if(k === "jogar"){ if(J.validar){ const m = J.validar(CFG); if(m){ janela("<h2>Antes de começar</h2><p>" + esc(m) + "</p>"); return; } } comecar(); }
    else if(k === "denovo") comecar();
    else if(k === "erros") comecar(raiz._erradas);
    else if(k === "inicio") abertura();
    else if(k === "seguir") seguir(0);
    else if(k === "mostrar" && E && !E.travado) revelar(null, true);
    else if(k === "ouvir" && E) falar(E.item.fala || E.item.pergunta);
    else if(k === "som"){ A11Y.som = !A11Y.som; salvarA11y(); pintaSom(); if(!A11Y.som && "speechSynthesis" in window) speechSynthesis.cancel(); }
    else if(k === "a11y") acess();
    else if(k === "ajuda") ajuda();
    else if(k === "cheia"){ if(document.fullscreenElement) document.exitFullscreen(); else if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); }
    else if(k === "voltar"){ if(E) abertura(); else if(window.self !== window.top) window.parent.postMessage({ tipo:"pde-jogo-fechar" }, location.origin); else if(history.length > 1) history.back(); else location.href = "/entrar/"; }
  });
  document.addEventListener("keydown", e => {
    if(e.key === "Escape"){ const f = document.querySelector(".pj-fundo"); if(f) f.remove(); return; }
    if(!E || document.querySelector(".pj-fundo")) return;
    if(E.travado){ if(e.key === "Enter" || e.key === " "){ const b = $('[data-a="seguir"]', raiz); if(b){ e.preventDefault(); b.click(); } } return; }
    if(E.item && E.item.tipo === "livre"){ if(E.item.tecla) E.item.tecla(e, apiLivre()); return; }
    if($(".pj-tecl", raiz)){ if(/^[0-9]$/.test(e.key)) digitar(e.key); else if(e.key === "Backspace") digitar("x"); else if(e.key === "Enter") digitar("ok"); }
    else if(/^[1-4]$/.test(e.key)){ const b = raiz.querySelectorAll("[data-alt]")[+e.key - 1]; if(b && !b.disabled) b.click(); }
  });
  abertura();
  return { abertura, comecar };
}
// Jogos de conteúdo (Ciências, História...): banco fixo de perguntas revisadas, por nível.
//   niveis = [{ hab, arte?: "/assets/jogos/artes/x.webp", itens:[[pergunta, certa, [3 erradas], dica, explicacao, emoji?, habilidade própria?, chave do desenho?], ...], desenho?: (chave, revelado) => svg }, ...]
// Devolve a função gerar(ctx): percorre todas as perguntas do nível antes de repetir alguma.
function banco(niveis){
  const sacos = niveis.map(() => []);
  return c => {
    const n = Math.min(c.nivel, niveis.length - 1), N = niveis[n];
    if(!sacos[n].length) sacos[n] = embaralha(N.itens.map((_, i) => i));
    const i = sacos[n].pop(), q = N.itens[i];
    return { chave:"b" + n + "." + i, hab:q[6] || N.hab, rotulo:q[0], pergunta:q[0], texto:true, fala:q[0], tipo:"escolha", resposta:q[1], alternativas:[q[1]].concat(q[2]),
      // com ilustração do nível (arte), ela ambienta o tema e o emoji da pergunta vira um selo no canto; se a imagem falhar, fica só o emoji
      // esquema desenhado pelo jogo (desenho): aparece sem nomes na pergunta e, depois da resposta, com o nome e o destaque do que foi perguntado
      aoRevelar:N.desenho ? el => { if(el) el.innerHTML = N.desenho(q[7] || "", true); } : null,
      apoio:N.desenho ? el => { el.innerHTML = N.desenho(q[7] || "", false); } : N.arte ? el => { el.innerHTML = '<div class="pj-arte"><img src="' + esc(N.arte) + '" alt="" decoding="async">' + (q[5] ? '<span aria-hidden="true">' + esc(q[5]) + "</span>" : "") + "</div>";
          el.querySelector("img").onerror = () => { el.innerHTML = q[5] ? '<div class="pj-emoji" aria-hidden="true">' + esc(q[5]) + "</div>" : ""; }; }
        : q[5] ? el => { el.innerHTML = '<div class="pj-emoji" aria-hidden="true">' + esc(q[5]) + "</div>"; } : null,
      dica:q[3], explicacao:() => esc(q[4]) + " Resposta: <b>" + esc(q[1]) + "</b>.", fechamento:q[4] };
  };
}
window.PDEJogo = { criar, falar, sorteia, embaralha, esc, banco };
})();
