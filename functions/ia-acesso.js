// Central de IA: quem pode usar cada recurso de IA do Portal (funções puras, testáveis).
// Acesso e crédito são coisas separadas: aqui se decide QUEM pode; a carteira (creditos.js) decide QUANTO.
//   chave geral  config/portal_ia.ia_recursos.{recurso} = { ligado, avulso }   (avulso: quem tem créditos próprios usa sem liberação)
//   rede         municipios.ia = [recursos]       (sem o campo: vale o plano da rede, como era antes)
//   professor    usuarios.ia_extra = [recursos]   (exceção individual; sem o campo: plano da licença avulsa)
export const RECURSOS_IA = ['portalia', 'portalia_imagem', 'provas_ia', 'lousa_ia', 'lousa_ia_ultra'];
export const NOMES_IA = {
  portalia: 'Portal IA (materiais)', portalia_imagem: 'Imagens no Portal IA', provas_ia: 'Provas com IA',
  lousa_ia: 'Lousa IA Básica', lousa_ia_ultra: 'Lousa IA Ultra'
};
// pacotes: Intermediário = recursos de texto; Completo = tudo
export const IA_INTERMEDIARIO = ['portalia', 'provas_ia', 'lousa_ia'];
export const GERAL_PADRAO = {
  portalia: { ligado: true, avulso: true }, portalia_imagem: { ligado: true, avulso: true }, provas_ia: { ligado: true, avulso: true },
  lousa_ia: { ligado: true, avulso: false }, lousa_ia_ultra: { ligado: false, avulso: false }
};

export function iaDoPlano(plano) {
  if (plano === 'completo') return RECURSOS_IA.slice();
  if (plano === 'intermediario' || plano === 'personalizado') return IA_INTERMEDIARIO.slice();
  return [];
}
// a Ultra inclui a Básica; a imagem do Portal IA não depende de nada
function normalizar(lista) {
  const s = new Set((Array.isArray(lista) ? lista : []).filter(r => RECURSOS_IA.includes(r)));
  if (s.has('lousa_ia_ultra')) s.add('lousa_ia');
  return s;
}
// chave geral, com o legado da primeira versão da Lousa (config/portal_ia.lousa = { basica, ultra })
export function geralIA(cfgRaw) {
  const c = (cfgRaw && cfgRaw.ia_recursos) || {}, l = (cfgRaw && cfgRaw.lousa) || null, g = {};
  for (const r of RECURSOS_IA) g[r] = { ...GERAL_PADRAO[r], ...(c[r] || {}) };
  if (l && !c.lousa_ia && typeof l.basica === 'boolean') g.lousa_ia.ligado = l.basica;
  if (l && !c.lousa_ia_ultra && typeof l.ultra === 'boolean') g.lousa_ia_ultra.ligado = l.ultra;
  return g;
}
// rede: lista explícita da Central de IA; sem ela, o plano (e a Lousa marcada em "recursos", da primeira versão)
export function iaDaRede(muni, plano) {
  if (!muni) return new Set();
  if (Array.isArray(muni.ia)) return normalizar(muni.ia);
  return normalizar(iaDoPlano(plano).concat((muni.recursos || []).filter(r => r === 'lousa_ia' || r === 'lousa_ia_ultra')));
}
// professor: exceção individual; o avulso (sem rede) sem lista explícita segue o pacote da licença
export function iaDoUsuario(eu) {
  if (!eu) return new Set();
  if (Array.isArray(eu.ia_extra)) return normalizar(eu.ia_extra);
  const legado = (eu.recursos_extra || []).filter(r => r === 'lousa_ia' || r === 'lousa_ia_ultra');
  return normalizar((eu.municipio_id ? [] : iaDoPlano(eu.plano_avulso)).concat(legado));
}
// decide o acesso a um recurso. via: admin | rede (a carteira da rede paga) | usuario | avulso (créditos próprios)
export function acessoIA(recurso, { admin, geral, rede, user }) {
  if (!RECURSOS_IA.includes(recurso)) return { ok: false, motivo: 'desconhecido' };
  if (admin) return { ok: true, via: 'admin' };
  const g = (geral || GERAL_PADRAO)[recurso] || {};
  if (!g.ligado) return { ok: false, motivo: 'desligado' };
  if (rede && rede.has(recurso)) return { ok: true, via: 'rede' };
  if (user && user.has(recurso)) return { ok: true, via: 'usuario' };
  if (g.avulso) return { ok: true, via: 'avulso' };
  return { ok: false, motivo: 'nao_liberado' };
}
export function mensagemAcesso(recurso, motivo) {
  const n = NOMES_IA[recurso] || 'Este recurso de IA';
  if (motivo === 'desligado') return n + ' está desligado no momento.';
  return 'Sua licença ainda não está habilitada para ' + n + '. Fale com a Secretaria de Educação ou com a NEWPC.';
}
// mapa para a tela (cota): o que cada recurso permite a esta pessoa
export function mapaAcesso(base) {
  const m = {};
  for (const r of RECURSOS_IA) { const a = acessoIA(r, base); m[r] = { ok: a.ok, via: a.via || '', motivo: a.motivo || '' }; }
  return m;
}
