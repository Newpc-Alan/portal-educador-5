// Aula ao vivo na tela do aluno (nov/2026), em QUALQUER página do Portal (Início, Biblioteca, Colorir, Museus, jogos...):
// com a aula da turma aberta pelo professor ("Dar aula agora"), a página segue o professor: pausa, conteúdo enviado (para a turma
// ou só para este aluno), pesquisa rápida, mão levantada e bate-papo. Carregado pelo /assets/pde-entrada.js, só para aluno
// (token com aluno_id e turma_id). Não depende do Maestro; no Chromebook com a extensão do Maestro, pausa e conteúdo ficam com ela.
// Banco: qr_aulas/{turma} (aula aberta), aula_vivo/{turma} (ordens), aula_vivo/{turma}/alunos/{matrícula} (mão, resposta), aula_vivo/{turma}/chat.
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CSS = `  .al-pausa{ position:fixed;inset:0;z-index:2147483000;background:#071621;display:grid;place-items:center;color:#fff;text-align:center;padding:20px }
  .al-pausa div{ display:grid;gap:14px;justify-items:center;max-width:620px } .al-pausa img{ width:min(86vw,560px);border-radius:18px } .al-pausa b{ font-size:26px } .al-pausa span{ opacity:.8 }
  .al-cont{ position:fixed;inset:0;z-index:2147482000;background:#071621;display:flex;flex-direction:column } .al-cont iframe{ flex:1;border:0;width:100%;background:#fff }
  .al-cont-fora{ background:rgba(7,22,33,.92);align-items:center;justify-content:center;padding:20px } .al-fora{ background:#fff;color:#0c2338;border-radius:20px;padding:26px;display:grid;gap:12px;justify-items:center;text-align:center;max-width:440px }
  .al-fora span{ font-size:44px } .al-fora b{ font-size:21px } .al-fora small{ color:#5b6b7b;font-size:15px } .al-fora-ir{ display:block;width:100%;background:#8DC63F;color:#0f2c4a;font-weight:900;font-size:19px;border-radius:14px;padding:15px;text-decoration:none }
  .al-fora button{ font:inherit;border:0;background:none;color:#5b6b7b;cursor:pointer;text-decoration:underline }
  .al-cont-topo{ display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f2c4a;color:#fff } .al-cont-topo b{ flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  .al-cont-topo a{ color:#cfe3f5;font-weight:700 } .al-cont-topo button{ font:inherit;font-weight:800;border:0;border-radius:10px;padding:9px 14px;background:#8DC63F;color:#0f2c4a;cursor:pointer }
  .al-folha{ position:fixed;left:0;right:0;bottom:0;z-index:2147482500;background:#fff;color:#0c2338;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.3);padding:18px;display:grid;gap:12px;font-size:18px }
  .al-pq{ display:grid;grid-template-columns:repeat(3,1fr);gap:10px } .al-pq button{ font:inherit;font-weight:800;font-size:16px;border:0;border-radius:14px;padding:14px;cursor:pointer }
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
  .al-aviso{ position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483100;background:#0f2c4a;color:#fff;padding:12px 18px;border-radius:12px;font-weight:700;box-shadow:0 8px 22px rgba(0,0,0,.3) }
`;
const S = { db:null, tid:"", chave:"", nome:"", aulaAte:0, maestro:"", ligado:false, unsub:[], unsubAula:null, vistos:null, pqResp:"", ultimaMsg:0, chat:[], mao:false, relogio:null, iniciado:false };
const $ = id => document.getElementById(id);
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const ms = x => x && x.toMillis ? x.toMillis() : 0;
const vibrar = p => { try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} };
const ext = () => !!(document.documentElement.dataset.maestroExt && S.maestro);
function aviso(t){ const a = document.createElement("div"); a.className = "al-aviso"; a.textContent = t; document.body.appendChild(a); setTimeout(() => a.remove(), 4000); }

export async function iniciar(app, user){
  if(S.iniciado) return; 
  let cl = {}; try{ cl = (await user.getIdTokenResult()).claims || {}; }catch(e){ return; }
  if(!cl.aluno_id || !cl.turma_id) return;            // só aluno da rede (cartão, código + PIN ou Google ligado à matrícula)
  S.iniciado = true;
  Object.assign(S, { db:getFirestore(app), tid:String(cl.turma_id), chave:String(cl.aluno_id), nome:String(user.displayName || "Aluno").slice(0, 80) });
  try{ const u = (await getDoc(doc(S.db, "usuarios", user.uid))).data(); if(u && u.nome) S.nome = String(u.nome).slice(0, 80); }catch(e){}
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  document.addEventListener("click", clique);
  window.addEventListener("pde-saindo", parar);
  S.unsubAula = onSnapshot(doc(S.db, "qr_aulas", S.tid), s => { const x = s.data() || {};
    S.aulaAte = ms(x.aberta_ate); S.maestro = /^\d{6}$/.test(String(x.maestro_codigo || "")) ? x.maestro_codigo : ""; conferir(); }, e => console.warn("aula da turma:", e.code));
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
    else cmds.forEach(c => { if(!S.vistos.has(c.id)){ S.vistos.add(c.id); if(!ext() && /^https?:\/\//i.test(c.url || "")) abrir(c.url, c.nome, c.embed !== false); } });
    const pa = d.pausa_alunos || {}; pausa(!ext() && (typeof pa[k] === "boolean" ? pa[k] : !!d.pausa));
    pesquisa(d.pesquisa && d.pesquisa.ativa ? d.pesquisa : null);
  }, e => console.warn("aula ao vivo:", e.code)));
  S.unsub.push(onSnapshot(doc(S.db, "aula_vivo", S.tid, "alunos", S.chave), s => { const d = s.data() || {}; S.mao = !!d.mao; if(d.nome) S.nome = d.nome; botoes(); }, () => {}));
  S.unsub.push(onSnapshot(query(collection(S.db, "aula_vivo", S.tid, "chat"), where("aluno_id", "==", S.chave)), sn => {
    const l = []; sn.forEach(x => l.push(x.data())); l.sort((a, b) => ms(a.em) - ms(b.em)); S.chat = l;
    const ult = l[l.length - 1];
    if(ult && ult.de === "prof" && S.ultimaMsg && ms(ult.em) > S.ultimaMsg){ chat(true); vibrar(150); }
    S.ultimaMsg = Math.max(S.ultimaMsg || 1, ...l.map(m => ms(m.em))); desenharChat(); botoes();
  }, e => console.warn("bate-papo:", e.code)));
  botoes();
}
function desligar(){
  S.unsub.forEach(u => { try{ u(); }catch(e){} }); S.unsub = []; S.ligado = false; pausa(false);
  ["alConteudo", "alPesq", "alChatBox", "alBotoes"].forEach(i => { const e = $(i); if(e) e.remove(); }); document.body.classList.remove("al-com-folha");
}
function parar(){ desligar(); if(S.unsubAula){ S.unsubAula(); S.unsubAula = null; } clearInterval(S.relogio); }
const meu = dados => setDoc(doc(S.db, "aula_vivo", S.tid, "alunos", S.chave), { nome:S.nome, ...dados, em:serverTimestamp() }, { merge:true });

function pausa(ligar){
  let b = $("alPausa");
  if(!ligar){ if(b) b.remove(); return; }
  if(b) return;
  b = document.createElement("div"); b.id = "alPausa"; b.setAttribute("role", "alertdialog"); b.className = "al-pausa";
  b.innerHTML = '<div><img alt="" src="/maestro/aluno/bloqueio/msg' + (1 + Math.floor(Math.random() * 3)) + '.jpg"><b>⏸️ Atenção ao professor</b><span>A tela volta sozinha quando o professor liberar.</span></div>';
  document.body.appendChild(b); vibrar(150);
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
  f.innerHTML = '<b>📊 ' + esc(String(p.pergunta || "Entenderam?").slice(0, 140)) + '</b><div class="al-pq"><button type="button" data-al="pq" data-v="verde">🟢 Entendi</button><button type="button" data-al="pq" data-v="amarelo">🟡 Mais ou menos</button><button type="button" data-al="pq" data-v="vermelho">🔴 Não entendi</button></div>';
  document.body.appendChild(f); document.body.classList.add("al-com-folha"); vibrar(120);
}
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
  else if(k === "pq"){ const f = $("alPesq"); if(!f) return; const id = f.dataset.id;
    meu({ pesquisa:{ id, valor:b.dataset.v } }).then(() => { S.pqResp = id; f.innerHTML = "<b>✅ Resposta enviada</b>"; setTimeout(() => { f.remove(); document.body.classList.remove("al-com-folha"); }, 1300); }).catch(() => aviso("Sem conexão. Tente de novo.")); }
  else if(k === "mao"){ meu({ mao:S.mao ? null : serverTimestamp() }).catch(() => aviso("Sem conexão. Tente de novo.")); }
  else if(k === "chat"){ chat(!$("alChatBox")); }
  else if(k === "enviar"){ enviar(); }
}
