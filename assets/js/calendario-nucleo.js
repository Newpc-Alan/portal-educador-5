/* NUCLEO-INICIO: este bloco é idêntico em apps/calendario/index.html e functions/calendario-nucleo.js (o teste confere) */
const CAL = (() => {
  // datas sempre em texto "AAAA-MM-DD" e contas em UTC: sem surpresa de fuso horário
  const p2 = n => String(n).padStart(2, "0");
  const ds = d => d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate());
  const dd = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  const soma = (s, n) => { const d = dd(s); d.setUTCDate(d.getUTCDate() + n); return ds(d); };
  const semana = s => dd(s).getUTCDay(); // 0 domingo ... 6 sábado
  // Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
  function pascoa(a){
    const b = Math.floor(a / 100), c = a % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * (a % 19) + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor(((a % 19) + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return ds(new Date(Date.UTC(a, mes - 1, dia)));
  }
  const ESTADUAIS = { MS:[["10-11", "Criação do Estado de Mato Grosso do Sul"]] };
  // feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e pontos facultativos que as redes costumam seguir
  function feriados(ano, uf){
    const P = pascoa(ano), l = [
      [ano + "-01-01", "Confraternização Universal", false], [soma(P, -48), "Carnaval", true], [soma(P, -47), "Carnaval", true],
      [soma(P, -2), "Paixão de Cristo", false], [ano + "-04-21", "Tiradentes", false], [ano + "-05-01", "Dia do Trabalho", false],
      [soma(P, 60), "Corpus Christi", true], [ano + "-09-07", "Independência do Brasil", false], [ano + "-10-12", "Nossa Senhora Aparecida", false],
      [ano + "-11-02", "Finados", false], [ano + "-11-15", "Proclamação da República", false], [ano + "-11-20", "Dia Nacional de Zumbi e da Consciência Negra", false],
      [ano + "-12-25", "Natal", false]
    ];
    (ESTADUAIS[String(uf || "").toUpperCase()] || []).forEach(([md, t]) => l.push([ano + "-" + md, t, false]));
    return l.map(([data, titulo, facultativo]) => ({ data, titulo, facultativo })).sort((a, b) => a.data < b.data ? -1 : 1);
  }
  // o que cada tipo de data faz com a contagem: "nao" tira o dia, "sim" conta o dia, "" só informa
  const EFEITO = { feriado:"nao", recesso:"nao", ferias:"nao", planejamento:"nao", paralisacao:"nao", reposicao:"sim", sabado:"sim", evento:"" };
  const NOMES = { feriado:"Feriado", recesso:"Recesso escolar", ferias:"Férias", planejamento:"Planejamento sem alunos", paralisacao:"Paralisação ou suspensão",
    reposicao:"Reposição de aula", sabado:"Sábado letivo", evento:"Evento" };
  // monta o ano dia a dia: rede primeiro, escola por cima
  function classificar(R, Esc, uf){
    const ano = R.ano, nac = {}, dias = {}, ini = R.inicio, fim = R.fim, sem = new Set(R.dias_semana || [1, 2, 3, 4, 5]);
    const fac = new Set(R.facultativos_letivos || []);
    feriados(ano, uf).forEach(f => nac[f.data] = f);
    const porDia = (lista, nivel) => { const m = {}; (lista || []).forEach(ev => { if(!ev || !ev.ini) return; const f = ev.fim && ev.fim >= ev.ini ? ev.fim : ev.ini;
      for(let d = ev.ini, n = 0; d <= f && n < 400; d = soma(d, 1), n++) (m[d] = m[d] || []).push({ ...ev, nivel }); }); return m; };
    const evR = porDia(R.eventos, "rede"), evE = porDia(Esc && Esc.eventos, "escola");
    for(let d = ano + "-01-01"; d <= ano + "-12-31"; d = soma(d, 1)){
      const dentro = d >= ini && d <= fim, w = semana(d), f = nac[d];
      let letivo = dentro && sem.has(w);
      if(letivo && f && !(f.facultativo && fac.has(d))) letivo = false;
      const aplica = l => { if(l.some(e => EFEITO[e.tipo] === "nao")) letivo = false; if(dentro && l.some(e => EFEITO[e.tipo] === "sim")) letivo = true; };
      if(evR[d]) aplica(evR[d]);
      if(evE[d]) aplica(evE[d]);
      dias[d] = { letivo, dentro, w, feriado:f || null, facultativoLetivo:!!(f && f.facultativo && fac.has(d)), eventos:[...(evR[d] || []), ...(evE[d] || [])] };
    }
    return dias;
  }
  function resumo(R, Esc, uf){
    const dias = classificar(R, Esc, uf), horasDia = (Esc && Esc.horas_dia) || R.horas_dia || 4;
    const letivos = Object.keys(dias).filter(d => dias[d].letivo).sort();
    const periodos = (R.periodos || []).map((p, i) => ({ n:i + 1, inicio:p.inicio, fim:p.fim, dias:letivos.filter(d => d >= p.inicio && d <= p.fim).length }));
    const foraPeriodo = periodos.length ? letivos.filter(d => !periodos.some(p => d >= p.inicio && d <= p.fim)).length : 0;
    const total = letivos.length, horas = Math.round(total * horasDia * 100) / 100;
    return { dias, letivos, total, horas, horasDia, periodos, foraPeriodo, metaDias:R.meta_dias || 200, metaHoras:R.meta_horas || 800 };
  }
  // divide os dias letivos em períodos iguais; com número par de períodos, corta primeiro no recesso do meio do ano
  function dividir(R, Esc, uf, n){
    const { letivos, dias } = resumo({ ...R, periodos:[] }, Esc, uf);
    if(!letivos.length || n < 1) return [];
    const partes = (l, k) => Array.from({ length:k }, (_, i) => l.slice(Math.round(i * l.length / k), Math.round((i + 1) * l.length / k)));
    let blocos = [letivos];
    if(n % 2 === 0 && n >= 2){
      let melhor = -1, maior = 0;
      for(let i = Math.floor(letivos.length * 0.3); i < Math.floor(letivos.length * 0.7); i++){
        let gap = 0; for(let d = soma(letivos[i], 1); d < letivos[i + 1]; d = soma(d, 1)) if(dias[d].w !== 0 && dias[d].w !== 6) gap++;
        if(gap > maior){ maior = gap; melhor = i; }
      }
      blocos = maior >= 5 ? [letivos.slice(0, melhor + 1), letivos.slice(melhor + 1)] : partes(letivos, 2);
      blocos = blocos.flatMap(b => partes(b, n / 2));
    } else blocos = partes(letivos, n);
    return blocos.filter(b => b.length).map(b => ({ inicio:b[0], fim:b[b.length - 1] }));
  }
  // arquivo de agenda (iCalendar, RFC 5545): eventos de dia inteiro
  function ics(R, Esc, uf, nome, agora){
    const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Portal do Educador//Calendario Escolar//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "X-WR-CALNAME:" + txt(nome), "X-WR-TIMEZONE:America/Campo_Grande", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
    const carimbo = (agora || new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const vistos = new Set(), ev = (ini, fim, titulo, desc) => {
      const uid = "pde-" + hash(R.municipio_id + "|" + ((Esc && Esc.escola_id) || "") + "|" + ini + "|" + titulo) + "@portaldoeducador.com.br";
      if(vistos.has(uid)) return; vistos.add(uid);
      linhas.push("BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + carimbo, "DTSTART;VALUE=DATE:" + ini.replace(/-/g, ""), "DTEND;VALUE=DATE:" + soma(fim || ini, 1).replace(/-/g, ""),
        "SUMMARY:" + txt(titulo), ...(desc ? ["DESCRIPTION:" + txt(desc)] : []), "TRANSP:TRANSPARENT", "END:VEVENT");
    };
    const fac = new Set(R.facultativos_letivos || []);
    feriados(R.ano, uf).forEach(f => ev(f.data, f.data, f.titulo + (f.facultativo ? (fac.has(f.data) ? " (ponto facultativo, dia letivo)" : " (ponto facultativo, sem aula)") : " (feriado)")));
    ev(R.inicio, R.inicio, "Início do ano letivo"); ev(R.fim, R.fim, "Fim do ano letivo");
    const nomePer = ["", "semestre", "semestre", "trimestre", "bimestre"][(R.periodos || []).length] || "período";
    (R.periodos || []).forEach((p, i) => { ev(p.inicio, p.inicio, "Início do " + (i + 1) + "º " + nomePer); ev(p.fim, p.fim, "Fim do " + (i + 1) + "º " + nomePer); });
    const todos = [...(R.eventos || []).map(e => ({ ...e, nivel:"Rede" })), ...((Esc && Esc.eventos) || []).map(e => ({ ...e, nivel:"Escola" }))];
    todos.forEach(e => ev(e.ini, e.fim || e.ini, e.titulo || NOMES[e.tipo] || "Data", (NOMES[e.tipo] || "") + (EFEITO[e.tipo] === "nao" ? " · sem aula" : EFEITO[e.tipo] === "sim" ? " · dia letivo" : "") + " · " + e.nivel));
    linhas.push("END:VCALENDAR");
    return linhas.map(dobrar).join("\r\n") + "\r\n";
  }
  function txt(s){ return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  // linhas de no máximo 75 bytes (UTF-8), continuação começa com espaço
  function dobrar(l){
    const out = []; let atual = "", bytes = 0;
    for(const ch of l){ const b = unescape(encodeURIComponent(ch)).length; if(bytes + b > (out.length ? 74 : 75)){ out.push(atual); atual = ""; bytes = 0; } atual += ch; bytes += b; }
    out.push(atual); return out.join("\r\n ");
  }
  function hash(s){ let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  return { ds, dd, soma, semana, pascoa, feriados, EFEITO, NOMES, classificar, resumo, dividir, ics };
})();
/* NUCLEO-FIM */
export default CAL;
