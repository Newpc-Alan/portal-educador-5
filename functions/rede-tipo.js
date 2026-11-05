// Nomenclatura por tipo de rede contratante (servidor). Cópia fiel de assets/js/rede.js (páginas): mude os dois juntos.
export const TIPOS_REDE = { municipal:"Municipal", estadual:"Estadual", particular:"Particular", instituicao:"Instituição" };
const UF_NOME = { AC:"Acre", AL:"Alagoas", AP:"Amapá", AM:"Amazonas", BA:"Bahia", CE:"Ceará", DF:"Distrito Federal", ES:"Espírito Santo", GO:"Goiás", MA:"Maranhão",
  MT:"Mato Grosso", MS:"Mato Grosso do Sul", MG:"Minas Gerais", PA:"Pará", PB:"Paraíba", PR:"Paraná", PE:"Pernambuco", PI:"Piauí", RJ:"Rio de Janeiro", RN:"Rio Grande do Norte",
  RS:"Rio Grande do Sul", RO:"Rondônia", RR:"Roraima", SC:"Santa Catarina", SP:"São Paulo", SE:"Sergipe", TO:"Tocantins" };
export const tipoRede = m => (m && TIPOS_REDE[m.tipo_rede]) ? m.tipo_rede : "municipal";
// m: documento do município/rede (ou só { nome, uf, tipo_rede, cidade }). Devolve os textos prontos.
export function rede(m){
  m = m || {};
  const t = tipoRede(m), nome = String(m.nome || "").trim(), uf = String(m.uf || "").trim(), comUf = nome + (nome && uf ? "/" + uf : "");
  const local = [m.cidade, uf].filter(Boolean).join("/");
  return Object.assign(textos(m, t, nome, uf, comUf, local), { cidade:t === "municipal" ? comUf : local });   // cidade: onde fica (para data e endereço)
}
function textos(m, t, nome, uf, comUf, local){
  if(!nome) return { tipo:t, publica:t === "municipal" || t === "estadual", orgao:"", secretaria:"", secretariaDe:"", linhaDoc:"", cartao:"", papel:"Gestão da rede", rede:"rede de ensino", oferta:"" };
  if(t === "estadual"){ const est = UF_NOME[uf] || uf;
    return { tipo:t, publica:true, orgao:"Governo do Estado " + (est ? (/^(Bahia|Paraíba)$/.test(est) ? "da " : /^(Acre|Amapá|Amazonas|Ceará|Distrito Federal|Espírito Santo|Maranhão|Pará|Paraná|Piauí|Rio de Janeiro|Rio Grande do Norte|Rio Grande do Sul|Tocantins)$/.test(est) ? "do " : "de ") + est : ""),
      secretaria:"Secretaria de Estado de Educação", secretariaDe:"Secretaria de Estado de Educação" + (uf ? " · " + uf : ""), get linhaDoc(){ return this.orgao + " · Secretaria de Estado de Educação"; },
      get cartao(){ return this.orgao; }, papel:"Secretaria de Estado", rede:"rede estadual", get oferta(){ return "O " + this.orgao + ", por meio da Secretaria de Estado de Educação,"; } };
  }
  if(t === "particular" || t === "instituicao"){
    return { tipo:t, publica:false, orgao:nome, secretaria:t === "particular" ? "Direção" : "Coordenação", secretariaDe:nome + (local ? " · " + local : ""), linhaDoc:nome + (local ? " · " + local : ""),
      cartao:nome, papel:t === "particular" ? "Direção / Mantenedora" : "Coordenação", rede:t === "particular" ? "rede da escola" : "rede da instituição", oferta:nome };
  }
  return { tipo:t, publica:true, orgao:"Prefeitura Municipal de " + comUf, secretaria:"Secretaria Municipal de Educação", secretariaDe:"Secretaria Municipal de Educação de " + comUf,
    linhaDoc:"Prefeitura Municipal de " + comUf + " · Secretaria Municipal de Educação", cartao:"Prefeitura Municipal de " + nome, papel:"Secretaria de Educação", rede:"rede municipal",
    oferta:"A Prefeitura Municipal de " + nome + ", por meio da Secretaria Municipal de Educação," };
}
// linha logo abaixo do nome da escola nos documentos: na rede pública, a secretaria; na particular, a mantenedora (se o nome
// for diferente do da escola) e a cidade, para não repetir o nome do colégio
export function subtitulo(m, escola){
  const R = rede(m); if(!m || !m.nome) return "";
  if(R.publica) return R.secretariaDe;
  const igual = String(m.nome).trim().toLowerCase() === String(escola || "").trim().toLowerCase();
  return [igual ? "" : m.nome, R.cidade].filter(Boolean).join(" · ");
}
