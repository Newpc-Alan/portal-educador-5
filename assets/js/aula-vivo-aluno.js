// Aula ao vivo na tela do aluno (nov/2026), em QUALQUER página do Portal (Início, Biblioteca, Colorir, Museus, jogos...):
// com a aula da turma aberta pelo professor ("Dar aula agora"), a página segue o professor: pausa, conteúdo enviado (para a turma
// ou só para este aluno), pesquisa rápida, mão levantada e bate-papo. Carregado pelo /assets/pde-entrada.js, só para aluno
// (token com aluno_id e turma_id). Não depende do Maestro; no Chromebook com a extensão do Maestro, pausa e conteúdo ficam com ela.
// Banco: qr_aulas/{turma} (aula aberta), aula_vivo/{turma} (ordens), aula_vivo/{turma}/alunos/{matrícula} (mão, resposta), aula_vivo/{turma}/chat.
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CSS = `  .al-pausa{ position:fixed;inset:0;z-index:2147483000;background:#071621;display:grid;place-items:center;color:#fff;text-align:center;padding:20px }
  .al-pausa{ background:radial-gradient(circle at 50% 40%,#1a6b2a,#071621 65%) } .al-pausa div{ display:grid;gap:14px;justify-items:center;max-width:620px }
  .al-pausa img{ width:140px;height:140px;border-radius:50%;box-shadow:0 10px 40px rgba(0,0,0,.45);animation:alRespira 2.6s ease-in-out infinite } .al-pausa b{ font-size:30px }
  .al-pausa-msg{ font-size:20px;font-weight:600;min-height:52px;transition:opacity .3s;color:#e8f5d8 } .al-pausa small{ opacity:.7;font-size:14px } @keyframes alRespira{ 50%{ transform:scale(1.06) } }
  .al-cont{ position:fixed;inset:0;z-index:2147482700;background:#071621;display:flex;flex-direction:column } .al-cont iframe{ flex:1;border:0;width:100%;background:#fff }
  .al-cont-fora{ background:rgba(7,22,33,.92);align-items:center;justify-content:center;padding:20px } .al-fora{ background:#fff;color:#0c2338;border-radius:20px;padding:26px;display:grid;gap:12px;justify-items:center;text-align:center;max-width:440px }
  .al-fora span{ font-size:44px } .al-fora b{ font-size:21px } .al-fora small{ color:#5b6b7b;font-size:15px } .al-fora-ir{ display:block;width:100%;background:#8DC63F;color:#0f2c4a;font-weight:900;font-size:19px;border-radius:14px;padding:15px;text-decoration:none }
  .al-fora button{ font:inherit;border:0;background:none;color:#5b6b7b;cursor:pointer;text-decoration:underline }
  .al-cont-topo{ display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f2c4a;color:#fff } .al-cont-topo b{ flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  .al-cont-topo a{ color:#cfe3f5;font-weight:700 } .al-cont-topo button{ font:inherit;font-weight:800;border:0;border-radius:10px;padding:9px 14px;background:#8DC63F;color:#0f2c4a;cursor:pointer }
  .al-folha{ position:fixed;left:0;right:0;bottom:0;z-index:2147482650;background:#fff;color:#0c2338;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.3);padding:18px;display:grid;gap:12px;font-size:18px }
  .al-pq{ display:grid;grid-template-columns:repeat(3,1fr);gap:10px } .al-pq button{ font:inherit;font-weight:800;font-size:16px;border:0;border-radius:14px;padding:14px;cursor:pointer }
  .al-pq-txt{ font:inherit;font-size:17px;border:2px solid #c9d5e1;border-radius:14px;padding:12px;resize:vertical;min-height:90px;color:#0c2338 } .al-pq-txt:focus{ outline:none;border-color:#2E9BD6 }
  .al-pq-rodape{ display:flex;align-items:center;justify-content:space-between;gap:10px } .al-pq-rodape small{ color:#5b6b7b }
  .al-pq-env{ font:inherit;font-weight:800;font-size:16px;border:0;border-radius:14px;padding:12px 20px;background:#1a6b2a;color:#fff;cursor:pointer } .al-pq-env:disabled{ opacity:.6 }
  .al-pq button:nth-child(1){ background:#bfe5a1 } .al-pq button:nth-child(2){ background:#ffe58a } .al-pq button:nth-child(3){ background:#ffb4b4 }
  .al-botoes{ position:fixed;left:14px;bottom:14px;z-index:2147481000;display:flex;gap:8px;flex-wrap:wrap }
  .al-botoes button{ font:inherit;font-weight:800;font-size:15px;border:0;border-radius:40px;padding:11px 16px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.25) }
  body.al-com-folha .al-botoes{ bottom:150px } body.al-com-folha .al-chat{ bottom:206px }
  .al-mao{ background:#f5d547;color:#3d3000 } .al-mao.on{ background:#fff3d6;box-shadow:inset 0 0 0 3px #e0a321 } .al-chat-b{ background:#2671AB;color:#fff }
  .al-chat{ position:fixed;right:14px;bottom:70px;z-index:2147481500;width:min(92vw,360px);background:#fff;border-radius:18px;box-shadow:0 14px 40px rgba(0,0,0,.35);display:flex;flex-direction:column;max-height:60vh }
  .al-chat-topo{ display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0f2c4a;color:#fff;border-radius:18px 18px 0 0 } .al-chat-topo button{ font:inherit;border:0;background:#fff;border-radius:8px;padding:5px 10px;cursor:pointer }
  .al-chat-lista{ flex:1;overflow:auto;padding:10px;display:grid;gap:8px;align-content:start } .al-chat-vazio{ color:#6b7a89;font-size:14px }
  .al-chat-envio{ display:flex;gap:6px;padding:10px;border-top:1px solid #e1e8f0 } .al-chat-envio input{ flex:1;font:inherit;padding:9px 10px;border:1px solid #cfdbe7;border-radius:10px } .al-chat-envio button{ font:inherit;font-weight:800;border:0;border-radius:10px;padding:9px 12px;background:#8DC63F;cursor:pointer }
  .al-msg{ max-width:80%;padding:8px 12px;border-radius:14px;background:#eef3f8;justify-self:start;font-size:15px } .al-msg.eu{ justify-self:end;background:#0f2c4a;color:#fff }
  .al-quiz{ position:fixed;inset:0;z-index:2147482600;background:#f2f6fa;color:#0c2338;display:flex;flex-direction:column;font-size:18px }
  .al-qz-topo{ display:flex;align-items:center;gap:10px;padding:12px 16px;background:#0f2c4a;color:#fff } .al-qz-topo b{ flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis } .al-qz-topo span{ font-weight:800;color:#bfe5a1 }
  .al-qz-corpo{ flex:1;overflow:auto;padding:18px;display:grid;gap:14px;align-content:start;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box }
  .al-qz-p{ font-size:21px;font-weight:800;line-height:1.35 } .al-qz-ops{ display:grid;gap:10px }
  .al-qz-ops button{ display:flex;align-items:center;gap:12px;text-align:left;font:inherit;font-size:18px;font-weight:700;border:3px solid #d6e2ec;background:#fff;color:#0c2338;border-radius:16px;padding:14px;cursor:pointer }
  .al-qz-ops button i{ font-style:normal;flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#eef3f8;font-weight:900 }
  .al-qz-ops button.on{ border-color:#1a6b2a;background:#eaf6dc } .al-qz-ops button.on i{ background:#1a6b2a;color:#fff }
  .al-qz-ops button.certa{ border-color:#1a6b2a;background:#eaf6dc } .al-qz-ops button.errada{ border-color:#c62828;background:#fde8e8 }
  .al-qz-nav{ display:flex;gap:10px;padding:12px 16px;background:#fff;box-shadow:0 -6px 18px rgba(0,0,0,.08);justify-content:space-between;align-items:center }
  .al-qz-nav button{ font:inherit;font-weight:800;border:0;border-radius:14px;padding:13px 18px;cursor:pointer;background:#eef3f8;color:#0f2c4a } .al-qz-nav .vai{ background:#8DC63F;color:#0f2c4a } .al-qz-nav small{ color:#5b6b7b;font-size:14px;text-align:center }
  .al-qz-pts{ display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px } .al-qz-pts button{ width:46px;height:46px;padding:0;border:0;border-radius:50%;font:inherit;font-size:18px;font-weight:800;background:#e1e8f0;color:#0f2c4a;cursor:pointer }
  .al-qz-pts button.r{ background:#bfe5a1 } .al-qz-pts button.at{ box-shadow:0 0 0 4px #0f2c4a }
  .al-qz-fonte{ display:flex;gap:6px } .al-qz-fonte button{ font:inherit;font-weight:900;border:0;border-radius:10px;background:#fff;color:#0f2c4a;width:44px;height:38px;cursor:pointer } .al-qz-fonte button:disabled{ opacity:.4 }
  .al-quiz .al-qz-corpo{ zoom:var(--qz-zoom,1) }
  .al-qz-conf{ display:grid;gap:12px;justify-items:center;text-align:center;padding:24px 10px } .al-qz-conf b{ font-size:24px } .al-qz-conf p{ font-size:19px;color:#33475b }
  .al-qz-conf .bts{ display:flex;gap:10px;flex-wrap:wrap;justify-content:center } .al-qz-conf button{ font:inherit;font-weight:800;font-size:17px;border:0;border-radius:14px;padding:14px 20px;cursor:pointer }
  .al-qz-conf .vai{ background:#8DC63F;color:#0f2c4a } .al-qz-conf .volta{ background:#eef3f8;color:#0f2c4a }
  .al-qz-fim{ display:grid;gap:12px;justify-items:center;text-align:center;padding:30px 10px } .al-qz-fim b{ font-size:26px } .al-qz-fim .nota{ font-size:54px;font-weight:900;color:#1a6b2a }
  .al-qz-volta{ font:inherit;font-weight:800;font-size:17px;border:0;border-radius:14px;padding:13px 22px;background:#8DC63F;color:#0f2c4a;cursor:pointer;margin-top:6px }
  .al-qz-rev{ border:2px solid #e1e8f0;border-radius:14px;padding:10px 12px;display:grid;gap:4px;font-size:15px;text-align:left;background:#fff } .al-qz-rev.ok{ border-color:#bfe5a1 } .al-qz-rev.er{ border-color:#ffb4b4 }
  .al-aviso{ position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483100;background:#0f2c4a;color:#fff;padding:12px 18px;border-radius:12px;font-weight:700;box-shadow:0 8px 22px rgba(0,0,0,.3) }
`;
const LT = ["A", "B", "C", "D", "E"];
const RECADOS_PAUSA = ["Olhos no professor: ele vai explicar algo importante.", "Hora de ouvir. Depois a tela volta para você.", "Guarde sua dúvida: quando a tela voltar, use o ✋ para perguntar.",
  "Prestar atenção agora economiza tempo depois.", "Quem escuta com atenção aprende o dobro.", "Respire, olhe para a frente e acompanhe a explicação.", "Portal do Educador: aprender junto com a turma."];
const S = { qz:null, qzR:null, qzI:0, qzFechado:"", bat:null, batUlt:null, batEm:0, db:null, tid:"", chave:"", nome:"", aulaAte:0, maestro:"", ligado:false, unsub:[], unsubAula:null, vistos:null, pqResp:"", ultimaMsg:0, chat:[], mao:false, relogio:null, iniciado:false };
const $ = id => document.getElementById(id);
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const ms = x => x && x.toMillis ? x.toMillis() : 0;
const vibrar = p => { try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} };
const PORTAL = /^https:\/\/([\w-]+\.)*portaldoeducador\.com\.br\//;   // conteúdo do próprio Portal sempre abre dentro
const ext = () => !!(document.documentElement.dataset.maestroExt && S.maestro);
function aviso(t){ const a = document.createElement("div"); a.className = "al-aviso"; a.textContent = t; document.body.appendChild(a); setTimeout(() => a.remove(), 4000); }

export async function iniciar(app, user){
  if(S.iniciado) return; 
  let cl = {}; try{ cl = (await user.getIdTokenResult()).claims || {}; }catch(e){ return; }
  if(!cl.aluno_id || !cl.turma_id) return;            // só aluno da rede (cartão, código + PIN ou Google ligado à matrícula)
  S.iniciado = true;
  try{ S.qzFechado = sessionStorage.getItem("pde_qz_fechado") || ""; }catch(e){}
  Object.assign(S, { db:getFirestore(app), tid:String(cl.turma_id), chave:String(cl.aluno_id), nome:String(user.displayName || "Aluno").slice(0, 80) });
  try{ const u = (await getDoc(doc(S.db, "usuarios", user.uid))).data(); if(u && u.nome) S.nome = String(u.nome).slice(0, 80); }catch(e){}
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  document.addEventListener("click", clique);
  window.addEventListener("pde-saindo", parar);
  S.unsubAula = onSnapshot(doc(S.db, "qr_aulas", S.tid), s => { const x = s.data() || {};
    const ini = ms(x.aberta_em); if(S.ligado && S.aulaIni && ini !== S.aulaIni) desligar();   // outro professor assumiu: aula nova, tela limpa
    S.aulaAte = ms(x.aberta_ate); S.aulaIni = ini; S.maestro = /^\d{6}$/.test(String(x.maestro_codigo || "")) ? x.maestro_codigo : ""; conferir(); }, e => console.warn("aula da turma:", e.code));
  S.relogio = setInterval(conferir, 20000);
}
function conferir(){
  const ativa = S.aulaAte > Date.now();
  if(ativa && !S.ligado) ligar(); else if(!ativa && S.ligado) desligar();
}
function ligar(){
  S.ligado = true; S.vistos = null; S.ultimaMsg = 0;
  S.unsub.push(onSnapshot(doc(S.db, "aula_vivo", S.tid), s => {
    const d = s.data() || {}, k = S.chave;
    const cmds = [d.comando, (d.comandos || {})[k]].filter(c => c && c.id);
    if(S.vistos === null) S.vistos = new Set(cmds.map(c => c.id));      // o que já existia quando a página abriu não abre de novo
    else cmds.forEach(c => { if(!S.vistos.has(c.id)){ S.vistos.add(c.id); if(!ext() && /^https?:\/\//i.test(c.url || "")){ fecharCorrecao(); abrir(c.url, c.nome, c.embed !== false || PORTAL.test(c.url)); } } });
    const pa = d.pausa_alunos || {}; pausa(!ext() && (typeof pa[k] === "boolean" ? pa[k] : !!d.pausa));
    if(d.pesquisa && d.pesquisa.ativa && d.pesquisa.id !== S.pqResp) fecharCorrecao();
    pesquisa(d.pesquisa && d.pesquisa.ativa ? d.pesquisa : null);
    S.qz = d.quiz && d.quiz.id && Array.isArray(d.quiz.perguntas) ? d.quiz : null; quiz();
  }, e => console.warn("aula ao vivo:", e.code)));
  S.unsub.push(onSnapshot(doc(S.db, "aula_vivo", S.tid, "alunos", S.chave), s => { const d = s.data() || {}; S.mao = !!d.mao; if(d.nome) S.nome = d.nome;
    // respostas já gravadas (voltou para a página no meio do quiz): continua de onde parou
    if(d.quiz && d.quiz.id && (!S.qzR || S.qzR.id !== d.quiz.id || (!(s.metadata || {}).hasPendingWrites && d.quiz.fim && !S.qzR.fim))) { S.qzR = { id:d.quiz.id, r:Array.isArray(d.quiz.r) ? d.quiz.r.slice() : [], fim:!!d.quiz.fim }; quiz(); }
    botoes(); }, () => {}));
  bateria();
  S.unsub.push(onSnapshot(query(collection(S.db, "aula_vivo", S.tid, "chat"), where("aluno_id", "==", S.chave)), sn => {
    // só a conversa desta aula (a de outro professor, numa aula anterior, não aparece)
    const l = []; sn.forEach(x => { const m = x.data(); if(!S.aulaIni || !m.em || ms(m.em) >= S.aulaIni - 60000) l.push(m); }); l.sort((a, b) => ms(a.em) - ms(b.em)); S.chat = l;
    const ult = l[l.length - 1];
    if(ult && ult.de === "prof" && S.ultimaMsg && ms(ult.em) > S.ultimaMsg){ chat(true); vibrar(150); }
    S.ultimaMsg = Math.max(S.ultimaMsg || 1, ...l.map(m => ms(m.em))); desenharChat(); botoes();
  }, e => console.warn("bate-papo:", e.code)));
  botoes();
}
function desligar(){
  S.unsub.forEach(u => { try{ u(); }catch(e){} }); S.unsub = []; S.ligado = false; pausa(false); S.qz = null;
  ["alQuiz", "alConteudo", "alPesq", "alChatBox", "alBotoes"].forEach(i => { const e = $(i); if(e) e.remove(); }); document.body.classList.remove("al-com-folha");
}
function parar(){ desligar(); if(S.unsubAula){ S.unsubAula(); S.unsubAula = null; } clearInterval(S.relogio); }
const meu = dados => setDoc(doc(S.db, "aula_vivo", S.tid, "alunos", S.chave), { nome:S.nome, ...dados, em:serverTimestamp() }, { merge:true });

function pausa(ligar){
  let b = $("alPausa");
  if(!ligar){ if(b) b.remove(); return; }
  if(b) return;
  b = document.createElement("div"); b.id = "alPausa"; b.setAttribute("role", "alertdialog"); b.className = "al-pausa";
  b.innerHTML = '<div><img alt="Portal do Educador" src="/assets/pde-logo-256.png"><b>👀 Atenção ao professor</b><span class="al-pausa-msg"></span><small>A tela volta sozinha quando o professor liberar.</small></div>';
  document.body.appendChild(b); vibrar(150);
  // recados para o aluno, trocando enquanto a tela está pausada
  const m = b.querySelector(".al-pausa-msg"); let k = Math.floor(Math.random() * RECADOS_PAUSA.length); m.textContent = RECADOS_PAUSA[k];
  const rel = setInterval(() => { if(!b.isConnected) return clearInterval(rel); k = (k + 1) % RECADOS_PAUSA.length; m.style.opacity = 0; setTimeout(() => { m.textContent = RECADOS_PAUSA[k]; m.style.opacity = 1; }, 300); }, 6000);
}
function abrir(url, nome, dentro){
  const v = $("alConteudo"); if(v) v.remove();
  const f = document.createElement("div"); f.id = "alConteudo";
  if(dentro === false){
    f.className = "al-cont al-cont-fora";
    f.innerHTML = '<div class="al-fora"><span>📲</span><b></b><small>O professor mandou este site. Ele abre fora do Portal; quando terminar, volte para cá.</small><a class="al-fora-ir" target="_blank" rel="noopener">Abrir o site</a><button type="button" data-al="fechar">Agora não</button></div>';
    f.querySelector("b").textContent = nome || url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60); f.querySelector("a").href = url;
  } else {
    const yt = String(url).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
    f.className = "al-cont";
    f.innerHTML = '<div class="al-cont-topo"><b></b><a target="_blank" rel="noopener">Abrir fora</a><button type="button" data-al="fechar">✕ Fechar</button></div><iframe allow="autoplay; fullscreen; camera; microphone" allowfullscreen></iframe>';
    f.querySelector("b").textContent = "📲 " + (nome || "Atividade do professor"); f.querySelector("a").href = url;
    f.querySelector("iframe").src = yt ? "https://www.youtube-nocookie.com/embed/" + yt[1] + "?autoplay=1&rel=0" : url;
  }
  document.body.appendChild(f); vibrar(120);
}
function pesquisa(p){
  const atual = $("alPesq");
  if(!p || p.id === S.pqResp){ if(atual) atual.remove(); document.body.classList.remove("al-com-folha"); return; }
  if(atual && atual.dataset.id === p.id) return;
  if(atual) atual.remove();
  const f = document.createElement("div"); f.id = "alPesq"; f.className = "al-folha"; f.dataset.id = p.id;
  // termômetro da turma: pergunta aberta, o aluno escreve com as palavras dele
  if(p.tipo === "aberta"){
    f.innerHTML = '<b>🌡️ ' + esc(String(p.pergunta || "").slice(0, 140)) + '</b><textarea id="alPqTxt" class="al-pq-txt" maxlength="300" rows="3" placeholder="Escreva com as suas palavras…"></textarea>' +
      '<div class="al-pq-rodape"><small id="alPqN">0/300</small><button type="button" class="al-pq-env" data-al="pq-txt">Enviar resposta</button></div>';
    document.body.appendChild(f); document.body.classList.add("al-com-folha"); vibrar(120);
    const t = $("alPqTxt"); t.addEventListener("input", () => { $("alPqN").textContent = t.value.length + "/300"; }); setTimeout(() => t.focus(), 300);
    return;
  }
  f.innerHTML = '<b>📊 ' + esc(String(p.pergunta || "Entenderam?").slice(0, 140)) + '</b><div class="al-pq"><button type="button" data-al="pq" data-v="verde">🟢 Entendi</button><button type="button" data-al="pq" data-v="amarelo">🟡 Mais ou menos</button><button type="button" data-al="pq" data-v="vermelho">🔴 Não entendi</button></div>';
  document.body.appendChild(f); document.body.classList.add("al-com-folha"); vibrar(120);
}
// bateria do aparelho (Chromebook e Android informam; iPad e Firefox não): grava quando muda 5 pontos, começa ou para de carregar, ou a cada 5 min
async function bateria(){
  if(S.bat !== null) return enviarBat(); S.bat = false;
  try{ if(!navigator.getBattery) return; const b = await navigator.getBattery(); S.bat = b;
    ["levelchange", "chargingchange"].forEach(ev => b.addEventListener(ev, () => enviarBat())); enviarBat(); }catch(e){}
}
function enviarBat(){
  const b = S.bat; if(!b || !S.ligado) return;
  const n = Math.max(0, Math.min(100, Math.round(b.level * 100))), c = !!b.charging, u = S.batUlt;
  if(u && u.c === c && Math.abs(u.n - n) < 5 && Date.now() - S.batEm < 300000) return;
  S.batUlt = { n, c }; S.batEm = Date.now(); meu({ bateria:{ n, c } }).catch(() => {});
}
setInterval(() => enviarBat(), 300000);
// Quiz rápido: uma pergunta por vez; cada toque já fica gravado (se a página recarregar, continua de onde parou)
function quiz(){
  const q = S.qz; let f = $("alQuiz");
  if(!q || (!q.ativa && !Array.isArray(q.gab)) || S.qzFechado === q.id){ if(f) f.remove(); return; }
  const n = q.perguntas.length;
  if(!S.qzR || S.qzR.id !== q.id) S.qzR = { id:q.id, r:Array(n).fill(-1), fim:false };
  const R = S.qzR; while(R.r.length < n) R.r.push(-1);
  if(!q.ativa && !R.r.some(v => v >= 0)){ if(f) f.remove(); return; }
  // já enviou: volta para o Portal; a correção aparece sozinha quando o professor encerrar
  if(q.ativa && R.fim && S.qzVoltou === q.id){ if(f) f.remove(); return; }       // encerrou e este aluno não participou: nada a mostrar
  const O = ordemQuiz(q);
  if(!f){ f = document.createElement("div"); f.id = "alQuiz"; f.className = "al-quiz"; f.setAttribute("role", "dialog"); document.body.appendChild(f); vibrar(150); S.qzI = Math.max(0, O.q.findIndex(qi => R.r[qi] < 0)); }
  const topo = '<div class="al-qz-topo"><b>🧠 ' + esc(String(q.titulo || "Quiz").slice(0, 80)) + "</b>";
  // correção (o professor encerrou): nota e cada pergunta com a certa
  if(!q.ativa){
    const ac = R.r.filter((v, i) => v === q.gab[i]).length;
    f.innerHTML = topo + '</div><div class="al-qz-corpo"><div class="al-qz-fim"><span>' + (ac / n >= .7 ? "🎉" : ac / n >= .5 ? "👍" : "📚") + '</span><b>Você acertou</b><span class="nota">' + ac + " de " + n + "</span></div>" +
      O.q.map((qi, i) => { const p = q.perguntas[qi], v = R.r[qi], g = q.gab[qi], ok = v === g, L = x => LT[O.o[qi].indexOf(x)] || "?";
        return '<div class="al-qz-rev ' + (ok ? "ok" : "er") + '"><b>' + (ok ? "✅ " : "❌ ") + (i + 1) + ". " + esc(p.p) + "</b>" + (!ok ? "<span>Sua resposta: " + (v >= 0 ? L(v) + ") " + esc(p.ops[v] || "") : "em branco") + "</span>" : "") + "<span>Certa: <b>" + L(g) + ") " + esc(p.ops[g] || "") + "</b></span></div>"; }).join("") +
      '</div><div class="al-qz-nav"><span></span><button type="button" class="vai" data-al="qz-ok">Fechar</button></div>';
    return;
  }
  if(R.fim){ f.innerHTML = topo + '</div><div class="al-qz-corpo"><div class="al-qz-fim"><span style="font-size:54px">✅</span><b>Respostas enviadas!</b><small>Voltando para o Portal... A correção aparece aqui quando o professor encerrar.</small><button type="button" class="al-qz-volta" data-al="qz-voltar">Voltar ao Portal agora</button></div></div>';
    clearTimeout(S.qzVolta); S.qzVolta = setTimeout(() => { S.qzVoltou = q.id; quiz(); }, 2500); return; }
  const i = Math.min(Math.max(0, S.qzI), n - 1), qi = O.q[i], p = q.perguntas[qi], falta = R.r.slice(0, n).filter(v => v < 0).length;
  const z = zoomQuiz(); f.style.setProperty("--qz-zoom", ZOOMS[z]);
  // confirmação: enviar com perguntas em branco
  if(S.qzConf){ const brancos = O.q.map((x, k) => R.r[x] < 0 ? k + 1 : 0).filter(Boolean);
    if(brancos.length){ const lista = brancos.length === 1 ? "a " + brancos[0] : brancos.slice(0, -1).map(x => "a " + x).join(", ") + " e a " + brancos[brancos.length - 1];
      f.innerHTML = topo + '</div><div class="al-qz-corpo"><div class="al-qz-conf"><span style="font-size:50px">🤔</span><b>Faltam respostas</b><p>Você não respondeu ' + (brancos.length === 1 ? "a pergunta " + brancos[0] : "as perguntas " + lista.replace(/a /g, "")) + '.<br>Tem certeza que quer enviar assim?</p>' +
        '<div class="bts"><button type="button" class="volta" data-al="qz-ir" data-i="' + (brancos[0] - 1) + '">✏️ Responder ' + (brancos.length === 1 ? "a " + brancos[0] : "as que faltam") + '</button><button type="button" class="vai" data-al="qz-enviar-mesmo">Enviar assim mesmo</button></div></div></div>';
      return; }
    S.qzConf = false; }
  f.innerHTML = topo + "<span>" + (i + 1) + " de " + n + '</span><span class="al-qz-fonte"><button type="button" data-al="qz-fonte" data-d="-1" aria-label="Diminuir a letra"' + (z ? "" : " disabled") + '>A−</button><button type="button" data-al="qz-fonte" data-d="1" aria-label="Aumentar a letra"' + (z < ZOOMS.length - 1 ? "" : " disabled") + '>A+</button></span></div><div class="al-qz-corpo"><div class="al-qz-p">' + esc(p.p) + '</div><div class="al-qz-ops">' +
    O.o[qi].map((orig, k) => '<button type="button" data-al="qz-r" data-k="' + orig + '"' + (R.r[qi] === orig ? ' class="on"' : "") + "><i>" + LT[k] + "</i>" + esc(p.ops[orig]) + "</button>").join("") + "</div>" +
    '<div class="al-qz-pts">' + O.q.map((x, k) => '<button type="button" data-al="qz-ir" data-i="' + k + '" class="' + (R.r[x] >= 0 ? "r" : "") + (k === i ? " at" : "") + '">' + (k + 1) + "</button>").join("") + "</div></div>" +
    '<div class="al-qz-nav"><button type="button" data-al="qz-ir" data-i="' + (i - 1) + '"' + (i ? "" : " disabled") + '>← Anterior</button><small>' + (falta ? "Faltam " + falta : "Todas respondidas") + "</small>" +
    (i < n - 1 ? '<button type="button" class="vai" data-al="qz-ir" data-i="' + (i + 1) + '">Próxima →</button>' : '<button type="button" class="vai" data-al="qz-enviar">' + "✅ Enviar respostas" + "</button>") + "</div>";
}
// embaralha por aluno (perguntas e alternativas), sempre igual para o mesmo aluno no mesmo quiz; a resposta é gravada na ordem original,
// então o gabarito e o relatório do professor não mudam
function semente(t){ let h = 2166136261; for(let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let x = h; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
function embaralhar(n, rnd){ const a = Array.from({ length:n }, (_, i) => i); for(let i = n - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function ordemQuiz(q){
  if(S.qzOrd && S.qzOrd.id === q.id) return S.qzOrd;
  const rnd = semente(q.id + ":" + S.chave);
  return (S.qzOrd = { id:q.id, q:embaralhar(q.perguntas.length, rnd), o:q.perguntas.map(p => embaralhar((p.ops || []).length, rnd)) });
}
// o professor mandou outra coisa (conteúdo ou pesquisa): a correção do quiz já encerrado sai da frente
function fecharCorrecao(){ if(S.qz && !S.qz.ativa && S.qzFechado !== S.qz.id){ S.qzFechado = S.qz.id; try{ sessionStorage.setItem("pde_qz_fechado", S.qz.id); }catch(e){} const f = $("alQuiz"); if(f) f.remove(); } }
// tamanho da letra do quiz (fica guardado neste aparelho)
const ZOOMS = [1, 1.15, 1.3, 1.5, 1.75];
function zoomQuiz(){ let z = 0; try{ z = Number(localStorage.getItem("pde_qz_zoom")) || 0; }catch(e){} return Math.max(0, Math.min(ZOOMS.length - 1, z)); }
function gravarQuiz(){ const R = S.qzR; return meu({ quiz:{ id:R.id, r:R.r.slice(0, 30), fim:!!R.fim } }); }
function botoes(){
  if(!S.ligado) return;
  let b = $("alBotoes"); if(!b){ b = document.createElement("div"); b.id = "alBotoes"; b.className = "al-botoes"; document.body.appendChild(b); }
  const h = '<button type="button" class="al-mao' + (S.mao ? " on" : "") + '" data-al="mao">' + (S.mao ? "✋ Mão levantada" : "✋ Levantar a mão") + '</button>' +
    '<button type="button" class="al-chat-b" data-al="chat">💬 Falar com o professor' + (S.chat.length ? " (" + S.chat.length + ")" : "") + "</button>";
  if(b.innerHTML !== h) b.innerHTML = h;
}
function chat(abrirSempre){
  let f = $("alChatBox");
  if(f && !abrirSempre){ f.remove(); return; }
  if(!f){
    f = document.createElement("div"); f.id = "alChatBox"; f.className = "al-chat";
    f.innerHTML = '<div class="al-chat-topo"><b>💬 Professor</b><button type="button" data-al="chat">Fechar</button></div><div id="alChatLista" class="al-chat-lista"></div><div class="al-chat-envio"><input id="alChatTxt" maxlength="500" placeholder="Escreva sua mensagem"><button type="button" data-al="enviar">Enviar</button></div>';
    document.body.appendChild(f);
    $("alChatTxt").addEventListener("keydown", e => { if(e.key === "Enter") enviar(); });
  }
  desenharChat();
}
function desenharChat(){
  const box = $("alChatLista"); if(!box) return;
  box.innerHTML = S.chat.length ? S.chat.map(m => '<div class="al-msg' + (m.de === "aluno" ? " eu" : "") + '">' + esc(m.texto) + "</div>").join("") : '<div class="al-chat-vazio">Escreva sua dúvida. Só o seu professor vê.</div>';
  box.scrollTop = box.scrollHeight;
}
async function enviar(){
  const i = $("alChatTxt"), t = (i.value || "").trim().slice(0, 500); if(!t || !S.ligado) return;
  try{ await addDoc(collection(S.db, "aula_vivo", S.tid, "chat"), { aluno_id:S.chave, de:"aluno", texto:t, nome:S.nome, em:serverTimestamp() }); i.value = ""; }
  catch(e){ aviso("Não deu para enviar. Tente de novo."); }
}
function clique(ev){
  const b = ev.target.closest("[data-al]"); if(!b) return;
  const k = b.dataset.al;
  if(k === "fechar"){ const f = $("alConteudo"); if(f) f.remove(); }
  else if(k === "qz-r" && S.qz && S.qz.ativa && S.qzR && !S.qzR.fim){ const n = S.qz.perguntas.length, i = Math.min(S.qzI, n - 1);
    S.qzR.r[ordemQuiz(S.qz).q[i]] = Number(b.dataset.k); gravarQuiz().catch(() => aviso("Sem conexão: a resposta será enviada quando voltar."));
    quiz(); setTimeout(() => { if(S.qzI === i && i < n - 1){ S.qzI = i + 1; quiz(); } }, 450); }
  else if(k === "qz-ir"){ S.qzConf = false; S.qzI = Number(b.dataset.i) || 0; quiz(); }
  else if(k === "qz-fonte"){ const z = Math.max(0, Math.min(ZOOMS.length - 1, zoomQuiz() + Number(b.dataset.d))); try{ localStorage.setItem("pde_qz_zoom", String(z)); }catch(e){} quiz(); }
  else if(k === "qz-enviar" && S.qzR && S.qz && S.qzR.r.slice(0, S.qz.perguntas.length).some(v => v < 0)){ S.qzConf = true; quiz(); }
  else if((k === "qz-enviar" || k === "qz-enviar-mesmo") && S.qzR){ S.qzConf = false; S.qzR.fim = true; gravarQuiz().then(() => quiz()).catch(() => { S.qzR.fim = false; aviso("Sem conexão. Tente de novo."); }); quiz(); }
  else if(k === "qz-voltar" && S.qz){ clearTimeout(S.qzVolta); S.qzVoltou = S.qz.id; quiz(); }
  else if(k === "qz-ok" && S.qz){ S.qzFechado = S.qz.id; try{ sessionStorage.setItem("pde_qz_fechado", S.qz.id); }catch(e){} quiz(); }
  else if(k === "pq"){ const f = $("alPesq"); if(!f) return; const id = f.dataset.id;
    meu({ pesquisa:{ id, valor:b.dataset.v } }).then(() => { S.pqResp = id; f.innerHTML = "<b>✅ Resposta enviada</b>"; setTimeout(() => { f.remove(); document.body.classList.remove("al-com-folha"); }, 1300); }).catch(() => aviso("Sem conexão. Tente de novo.")); }
  else if(k === "pq-txt"){ const f = $("alPesq"), t = $("alPqTxt"); if(!f || !t) return; const id = f.dataset.id, texto = t.value.trim().slice(0, 300);
    if(texto.length < 2){ aviso("Escreva a sua resposta antes de enviar."); t.focus(); return; }
    b.disabled = true;
    meu({ pesquisa:{ id, texto } }).then(() => { S.pqResp = id; f.innerHTML = "<b>✅ Resposta enviada. Obrigado!</b>"; setTimeout(() => { f.remove(); document.body.classList.remove("al-com-folha"); }, 1500); }).catch(() => { b.disabled = false; aviso("Sem conexão. Tente de novo."); }); }
  else if(k === "mao"){ meu({ mao:S.mao ? null : serverTimestamp() }).catch(() => aviso("Sem conexão. Tente de novo.")); }
  else if(k === "chat"){ chat(!$("alChatBox")); }
  else if(k === "enviar"){ enviar(); }
}
