// Inventário das pastas do Banco Curricular no Google Drive (só leitura): conta arquivos, tamanho e tipos por módulo
// e grava o detalhe em /tmp/inventario-atividades.json. Uso: node scripts/inventario-atividades.mjs
import { writeFileSync } from 'node:fs';
const CHAVE = 'AIzaSyAx_g0vpxZsYpUX7mOYjEX2Uj3l3jHHkmU'; // chave pública que já estava nas páginas antigas da Webnode
const RAIZ = {
  infantil: '1uNXhR4t2fTnLePpBofcqoOv7JihkxVhu', alfa: '1TcepN1czXDDcezZk5bmU_sziSnpaem12', iniciais: '1YF6QsJicwaBMnS9XDBYv2mrP-t3JgmYH',
  finais: '10nD0GDEy-F9Wo0VQAJrucCaTdMnaug_I', medio: '1eRrVbxEZeqYe9x1Hk1BWcYQridnhrUMS', inclusiva: '1wZFlZRHQ6NU_qPBuRllal7Xg6_xs2mvb'
};
async function listar(pai) {
  const out = []; let tok = '';
  do {
    const u = `https://www.googleapis.com/drive/v3/files?q='${pai}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&pageSize=1000&key=${CHAVE}` + (tok ? '&pageToken=' + tok : '');
    const r = await fetch(u); if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 150));
    const j = await r.json(); out.push(...j.files); tok = j.nextPageToken;
  } while (tok);
  return out;
}
const tudo = [], resumo = {};
for (const [mod, id] of Object.entries(RAIZ)) {
  const fila = [[id, '']]; let n = 0, bytes = 0, pastas = 0; const tipos = {};
  try {
    while (fila.length) {
      const [p, cam] = fila.shift();
      for (const f of await listar(p)) {
        if (f.mimeType === 'application/vnd.google-apps.folder') { pastas++; fila.push([f.id, cam + '/' + f.name]); }
        else { n++; bytes += +(f.size || 0); const t = f.mimeType.replace('application/', '').replace('vnd.google-apps.', 'g:'); tipos[t] = (tipos[t] || 0) + 1; tudo.push({ mod, cam, nome: f.name, id: f.id, mime: f.mimeType, tam: +(f.size || 0), mod_em: f.modifiedTime }); }
      }
    }
    resumo[mod] = { arquivos: n, pastas, MB: Math.round(bytes / 1e6), tipos };
  } catch (e) { resumo[mod] = { erro: e.message }; }
  console.log(mod, JSON.stringify(resumo[mod]));
}
writeFileSync('/tmp/inventario-atividades.json', JSON.stringify(tudo));
const cams = {}; tudo.forEach(f => { const k = f.mod + f.cam; cams[k] = (cams[k] || 0) + 1; });
console.log('PASTAS COM ARQUIVOS:', Object.keys(cams).length);
Object.entries(cams).slice(0, 400).forEach(([k, v]) => console.log(v, k));
console.log('TOTAL', tudo.length, 'arquivos', Math.round(tudo.reduce((a, f) => a + f.tam, 0) / 1e6), 'MB');
