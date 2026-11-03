// Diagnóstico e conserto da ligação Meta → robô (usa WHATSAPP_TOKEN; nunca imprime o token).
// CONTAS: ids candidatos da conta do WhatsApp (copiados do painel). PNID: id do número (wa_config/geral).
// ASSINAR=true: inscreve o app na conta que contém o número (POST subscribed_apps), se ainda não estiver.
const G = 'https://graph.facebook.com/v25.0/', T = process.env.WHATSAPP_TOKEN;
if (!T) { console.log('::error::WHATSAPP_TOKEN ausente'); process.exit(1); }
const limpa = s => String(s).replace(/\+?\d{10,13}(?!\d)/g, m => m.length > 14 ? m : '#tel');
const api = async (path, method = 'GET') => { const r = await fetch(G + path, { method, headers: { Authorization: 'Bearer ' + T } }); const j = await r.json().catch(() => ({})); return { ok: r.ok, j }; };
const pnid = String(process.env.PNID || '').trim();
let contas = String(process.env.CONTAS || '').split(/[\s,]+/).filter(x => /^\d{10,20}$/.test(x));
// as contas que o token alcança (granular_scopes do próprio token): é daqui que sai o id certo da conta
{ const d = await api('debug_token?input_token=' + encodeURIComponent(T));
  const gs = (d.j.data && d.j.data.granular_scopes) || [];
  gs.forEach(g => console.log('::notice::permissão ' + g.scope + ' → ' + (g.target_ids || ['todas']).join(', ')));
  const ids = gs.filter(g => /whatsapp/.test(g.scope)).flatMap(g => g.target_ids || []);
  contas = [...new Set([...contas, ...ids])]; }
if (pnid) {
  const n = await api(pnid + '?fields=verified_name,name_status,status,code_verification_status,quality_rating,platform_type,throughput,messaging_limit_tier');
  console.log('::notice::número: ' + (n.ok ? JSON.stringify(n.j).replace(/[{}"]/g, ' ') : 'ERRO ' + limpa(JSON.stringify(n.j.error || {}).slice(0, 300))));
}
for (const c of contas) {
  const ph = await api(c + '/phone_numbers?fields=id');
  const tem = ph.ok && (ph.j.data || []).some(x => x.id === pnid);
  const sa = await api(c + '/subscribed_apps');
  const apps = sa.ok ? (sa.j.data || []).map(a => (a.whatsapp_business_api_data || a).name || (a.whatsapp_business_api_data || a).id).join(', ') : 'ERRO ' + JSON.stringify(sa.j.error && sa.j.error.message).slice(0, 200);
  console.log('::notice::conta ' + c + ': ' + (ph.ok ? (tem ? 'contém o número' : 'NÃO contém o número') : 'sem acesso (' + String(ph.j.error && ph.j.error.message).slice(0, 120) + ')') + ' · apps inscritos: ' + (apps || 'nenhum'));
  if (tem && process.env.ASSINAR === 'true') {
    const p = await api(c + '/subscribed_apps', 'POST');
    console.log('::notice::inscrever app na conta ' + c + ': ' + (p.ok ? 'OK' : 'ERRO ' + String(p.j.error && p.j.error.message).slice(0, 200)));
  }
}
