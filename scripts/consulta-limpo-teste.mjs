// Teste do "Passar a limpo" da Lousa (nov/2026), só leitura: manda 3 amostras de letra à mão (scripts/amostras-limpo, geradas
// com fonte de traço cursiva, sem dado de ninguém) ao modelo leve, com o mesmo pedido da função, e mostra o texto, o tempo e o custo.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const L = await import(pathToFileURL(process.cwd() + '/lousa-limpo.js').href);
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 3000));

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const tk = await (await auth.getClient()).getAccessToken();
const rs = await fetch('https://secretmanager.googleapis.com/v1/projects/portal-educador-5/secrets/GEMINI_API_KEY/versions/latest:access', { headers: { Authorization: 'Bearer ' + tk.token } });
const js = await rs.json(); if (!js.payload) { console.log('::error::sem acesso ao segredo GEMINI_API_KEY (HTTP ' + rs.status + ')'); process.exit(1); }
const CHAVE = Buffer.from(js.payload.data, 'base64').toString().trim(); console.log('::add-mask::' + CHAVE);

const MODELO = process.env.MODELO || 'gemini-3.1-flash-lite', PRECO = { 'gemini-3.1-flash-lite': [0.1, 0.4], 'gemini-3.6-flash': [0.75, 3.75] }[MODELO] || [0.1, 0.4];
let falhou = false, usdTotal = 0;
for (const nome of ['fotossintese.png', 'fracoes-verde.png', 'historia.png']) {
  const dados = readFileSync('../scripts/amostras-limpo/' + nome).toString('base64'), t0 = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${CHAVE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: L.SISTEMA_LIMPO }] }, contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: dados } }, { text: 'Transcreva e organize.' }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: L.ESQUEMA_LIMPO, maxOutputTokens: 3000 } }) });
  const j = await r.json(), s = ((Date.now() - t0) / 1000).toFixed(1);
  if (!r.ok) { falhou = true; console.log('::error::' + nome + ': HTTP ' + r.status + ' ' + limpo(JSON.stringify(j.error || j)).slice(0, 300)); continue; }
  const u = j.usageMetadata || {}, ent = u.promptTokenCount || 0, sai = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), usd = ent / 1e6 * PRECO[0] + sai / 1e6 * PRECO[1]; usdTotal += usd;
  let o = null; try { o = JSON.parse((j.candidates[0].content.parts || []).filter(p => !p.thought).map(p => p.text || '').join('')); } catch (e) {}
  const bl = L.limparBlocos(o);
  if (!bl.length) falhou = true;
  aviso(nome + ' · ' + MODELO + ' · ' + s + 's · ' + ent + ' tokens entrada, ' + sai + ' saída · US$ ' + usd.toFixed(5) + ' (R$ ' + (usd * 5.6).toFixed(4) + ')');
  bl.forEach(b => aviso('   ' + b.tipo.toUpperCase() + ': ' + b.texto));
}
aviso('custo médio por uso: R$ ' + (usdTotal / 3 * 5.6).toFixed(4));
if (falhou) process.exit(1);
