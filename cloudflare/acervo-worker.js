// Portal do Educador · Worker do Acervo (Cloudflare R2)
// Confere o login (Firebase) e a licenca antes de entregar qualquer arquivo do bucket pde-acervo.
//
// Configuracao no painel da Cloudflare (Workers > este worker > Configuracoes):
//   Vinculo R2:      nome da variavel BUCKET  -> bucket pde-acervo
//   Variavel secreta: SEGREDO -> um texto longo e aleatorio (assina os links temporarios)
//
// Rotas:
//   GET    /saude                         -> teste rapido ("ok")
//   GET    /link?key=...                  -> (professor licenciado) devolve link de download valido por 5 min
//   GET    /baixar?key=...&exp=...&sig=.. -> entrega o arquivo (so com link assinado e dentro do prazo)
//   PUT    /arquivo?key=...               -> (admin) envia arquivo para o bucket
//   DELETE /arquivo?key=...               -> (admin) apaga arquivo do bucket

const PROJETO = "portal-educador-5";
const ORIGENS = ["https://app.portaldoeducador.com.br", "https://www.portaldoeducador.com.br", "http://localhost:8811"];
const VALIDADE_LINK = 5 * 60; // segundos
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const FIRESTORE = "https://firestore.googleapis.com/v1/projects/" + PROJETO + "/databases/(default)/documents/";

let cacheChaves = { chaves: null, ate: 0 };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = cabecalhosCors(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === "/saude") return texto("ok", 200, cors);

      if (url.pathname === "/baixar" && req.method === "GET") return await baixar(url, env);

      // demais rotas exigem login
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token) return json({ erro: "login necessario" }, 401, cors);
      const quem = await verificarToken(token);
      const usuario = await lerDoc("usuarios/" + quem.uid, token);
      if (!usuario) return json({ erro: "cadastro nao encontrado" }, 403, cors);

      const key = limparChave(url.searchParams.get("key"));
      if (!key) return json({ erro: "arquivo nao informado" }, 400, cors);

      if (url.pathname === "/link" && req.method === "GET") {
        if (!(await licencaValida(usuario, token))) return json({ erro: "licenca expirada ou sem acesso" }, 403, cors);
        const exp = Math.floor(Date.now() / 1000) + VALIDADE_LINK;
        const sig = await assinar(env.SEGREDO, key + "|" + exp);
        const link = url.origin + "/baixar?key=" + encodeURIComponent(key) + "&exp=" + exp + "&sig=" + sig;
        return json({ link, expira_em: exp }, 200, cors);
      }

      // rotas de administracao
      if (!ehAdmin(usuario)) return json({ erro: "somente administrador" }, 403, cors);
      if (url.pathname === "/arquivo" && req.method === "PUT") {
        const tipo = req.headers.get("Content-Type") || "application/octet-stream";
        const nome = req.headers.get("X-Nome-Arquivo") || key.split("/").pop();
        const obj = await env.BUCKET.put(key, req.body, {
          httpMetadata: { contentType: tipo, contentDisposition: 'inline; filename="' + nome.replace(/"/g, "") + '"' },
          customMetadata: { enviado_por: quem.uid }
        });
        return json({ ok: true, key, tamanho: obj ? obj.size : null }, 200, cors);
      }
      if (url.pathname === "/arquivo" && req.method === "DELETE") {
        await env.BUCKET.delete(key);
        return json({ ok: true }, 200, cors);
      }
      return json({ erro: "rota nao encontrada" }, 404, cors);
    } catch (e) {
      return json({ erro: String(e && e.message || e) }, e && e.status || 500, cors);
    }
  }
};

// ---------- download com link assinado ----------
async function baixar(url, env) {
  const key = limparChave(url.searchParams.get("key"));
  const exp = parseInt(url.searchParams.get("exp") || "0", 10);
  const sig = url.searchParams.get("sig") || "";
  if (!key || !exp || exp < Date.now() / 1000) return texto("Link expirado. Volte ao Portal e abra o arquivo de novo.", 403, {});
  const esperado = await assinar(env.SEGREDO, key + "|" + exp);
  if (!iguais(esperado, sig)) return texto("Link invalido.", 403, {});
  const obj = await env.BUCKET.get(key);
  if (!obj) return texto("Arquivo nao encontrado.", 404, {});
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("Cache-Control", "private, max-age=300");
  h.set("X-Content-Type-Options", "nosniff");
  return new Response(obj.body, { headers: h });
}

// ---------- licenca (mesma logica do Portal e das regras do Firestore) ----------
function ehAdmin(u) { return u.perfil === "admin" && u.status === "ativo"; }
async function licencaValida(u, token) {
  if (u.status !== "ativo") return false;
  if (u.perfil === "admin") return true;
  const tipo = u.licenca_tipo || "institucional";
  if (tipo === "institucional") {
    if (!u.escola_id || !u.municipio_id) return false;
    const m = await lerDoc("municipios/" + u.municipio_id, token);
    if (!m || !m.vigencia_fim_ts) return true;                 // contrato sem data de fim
    return new Date(m.vigencia_fim_ts).getTime() > Date.now();
  }
  return !!u.licenca_fim && new Date(u.licenca_fim).getTime() > Date.now();
}

// le um documento do Firestore com o proprio token do usuario (respeita as regras)
async function lerDoc(caminho, token) {
  const r = await fetch(FIRESTORE + caminho, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw Object.assign(new Error("falha ao consultar o banco"), { status: 502 });
  const d = await r.json();
  return converter(d.fields || {});
}
function converter(campos) {
  const out = {};
  for (const k in campos) out[k] = valor(campos[k]);
  return out;
}
function valor(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valor);
  if ("mapValue" in v) return converter(v.mapValue.fields || {});
  return null;
}

// ---------- verificacao do token do Firebase (RS256) ----------
async function verificarToken(token) {
  const partes = token.split(".");
  if (partes.length !== 3) throw Object.assign(new Error("token invalido"), { status: 401 });
  const cab = JSON.parse(b64texto(partes[0]));
  const dados = JSON.parse(b64texto(partes[1]));
  const agora = Math.floor(Date.now() / 1000);
  if (cab.alg !== "RS256") throw Object.assign(new Error("token invalido"), { status: 401 });
  if (dados.aud !== PROJETO || dados.iss !== "https://securetoken.google.com/" + PROJETO) throw Object.assign(new Error("token de outro projeto"), { status: 401 });
  if (!dados.exp || dados.exp < agora || !dados.sub) throw Object.assign(new Error("sessao expirada, entre de novo"), { status: 401 });
  const chave = (await chavesGoogle()).find(k => k.kid === cab.kid);
  if (!chave) throw Object.assign(new Error("token invalido"), { status: 401 });
  const pub = await crypto.subtle.importKey("jwk", chave, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pub, b64bytes(partes[2]), new TextEncoder().encode(partes[0] + "." + partes[1]));
  if (!ok) throw Object.assign(new Error("token invalido"), { status: 401 });
  return { uid: dados.sub, email: dados.email || "" };
}
async function chavesGoogle() {
  if (cacheChaves.chaves && cacheChaves.ate > Date.now()) return cacheChaves.chaves;
  const r = await fetch(JWKS_URL);
  const j = await r.json();
  const idade = /max-age=(\d+)/.exec(r.headers.get("Cache-Control") || "");
  cacheChaves = { chaves: j.keys, ate: Date.now() + (idade ? parseInt(idade[1], 10) * 1000 : 3600000) };
  return j.keys;
}

// ---------- utilitarios ----------
function limparChave(k) {
  if (!k) return "";
  k = String(k).replace(/^\/+/, "");
  if (k.includes("..") || k.length > 400) return "";
  return k;
}
async function assinar(segredo, msg) {
  if (!segredo) throw new Error("SEGREDO nao configurado no Worker");
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function b64bytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64texto(s) { return new TextDecoder().decode(b64bytes(s)); }
function cabecalhosCors(req) {
  const origem = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.includes(origem) ? origem : ORIGENS[0],
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Nome-Arquivo",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(obj, status, cors) { return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } }); }
function texto(t, status, cors) { return new Response(t, { status, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } }); }
