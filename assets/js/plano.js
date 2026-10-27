// Portal do Educador · trava de tela pelo plano
// Uso (depois do script principal da página):
//   <script type="module" src="/assets/js/plano.js" data-plano-modulo="provas" data-plano-recurso="prova_online"></script>
// Vale para professor (o administrador, o gestor e a secretaria não são travados aqui).
// É a mesma regra do Início: plano do município (ou pacote da licença avulsa) + liberações exclusivas do professor.
// A trava de verdade de cada função crítica fica no servidor (prova online e formação); esta só evita abrir a tela pelo endereço.
import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const PLANO_BASICO = ["atividades","videos","jogos","ia","datas","colorir","historias","biblioteca","museus","dicas","apps"];
export const PLANO_INTERMEDIARIO = PLANO_BASICO.concat(["formacao","portal360","maestro"]);
const lista = (x) => Array.isArray(x) ? x : [];

// true quando o professor pode usar o módulo (e o recurso extra, se pedido)
export function liberado(u, m, modulo, recurso){
  const ex = lista(u.modulos_extra), rx = lista(u.recursos_extra);
  let mods = null, recs;
  if((u.licenca_tipo || "institucional") === "institucional"){
    const l = lista(m && m.modulos_professor);
    mods = l.length ? new Set(l.concat(ex)) : null;          // município sem plano configurado: tudo
    recs = new Set(lista(m && m.recursos).concat(rx));
  }else{
    const p = u.plano_avulso;                                  // sem campo: Completo
    mods = p === "basico" ? new Set(PLANO_BASICO.concat(ex)) : p === "intermediario" ? new Set(PLANO_INTERMEDIARIO.concat(ex)) : null;
    recs = new Set(rx);
  }
  if(modulo && mods && !mods.has(modulo)){
    // Gestão e Central de Relatórios andam juntas (mesma regra do Início e da Gestão Escolar)
    const par = modulo === "gestao" ? "relatorios" : modulo === "relatorios" ? "gestao" : "";
    if(!par || !mods.has(par)) return false;
  }
  if(recurso && !recs.has(recurso)) return false;
  return true;
}

function bloquear(nome){
  if(document.getElementById("pdePlanoTrava")) return;
  const d = document.createElement("div"); d.id = "pdePlanoTrava"; d.setAttribute("role", "alertdialog"); d.setAttribute("aria-modal", "true");
  d.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:#f2f5f8;font-family:'Segoe UI',system-ui,sans-serif;color:#0f2c4a";
  d.innerHTML = '<div style="max-width:440px;background:#fff;border:1.5px solid #dce4ed;border-radius:20px;padding:28px 26px;text-align:center;box-shadow:0 18px 50px -22px rgba(15,44,74,.45)">'+
    '<img src="/assets/pde-logo-128.png" alt="" width="64" height="64" style="display:block;margin:0 auto 12px">'+
    '<div style="display:inline-block;background:#fff4e0;color:#9a6700;font-size:12px;font-weight:800;padding:4px 12px;border-radius:20px;margin-bottom:10px">Fora do seu plano</div>'+
    '<h1 style="font-size:21px;margin:0 0 8px"></h1>'+
    '<p style="font-size:14.5px;line-height:1.5;color:#4a5d72;margin:0 0 18px">Este recurso não está liberado para você. No Início, em “Conheça mais do Portal”, toque nele e em “Tenho interesse”.</p>'+
    '<a href="/entrar/" style="display:inline-block;background:#1a6b2a;color:#fff;text-decoration:none;font-weight:800;padding:13px 24px;border-radius:12px">Voltar ao Início</a></div>';
  d.querySelector("h1").textContent = nome || "Recurso fora do plano";
  document.body.appendChild(d);
  document.documentElement.style.overflow = "hidden";
}

// configuração vem do próprio <script> que carregou este arquivo
const tag = document.querySelector("script[data-plano-modulo], script[data-plano-recurso]");
if(tag){
  const modulo = tag.dataset.planoModulo || "", recurso = tag.dataset.planoRecurso || "", nome = tag.dataset.planoNome || "";
  (async () => {
    let app = null;
    for(let i = 0; i < 100 && !app; i++){ if(getApps().length) app = getApp(); else await new Promise(r => setTimeout(r, 100)); }
    if(!app) return;
    const db = getFirestore(app);
    onAuthStateChanged(getAuth(app), async (user) => {
      if(!user) return;
      try{
        const u = (await getDoc(doc(db, "usuarios", user.uid))).data();
        if(!u || u.perfil !== "professor" || u.status !== "ativo") return;   // a página cuida dos outros casos
        const m = u.municipio_id ? (await getDoc(doc(db, "municipios", u.municipio_id))).data() : null;
        if(!liberado(u, m, modulo, recurso)) bloquear(nome);
      }catch(e){ console.warn("plano:", e.code || e); }
    });
  })();
}
