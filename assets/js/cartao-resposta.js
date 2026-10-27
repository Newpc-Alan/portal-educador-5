// Cartão-resposta do Portal do Educador: geometria, desenho em PDF e conversão das questões.
// Um arquivo só para quem IMPRIME (Corretor de Gabarito e Provas e Avaliações) e para quem LÊ (Corretor):
// mudar a geometria aqui muda as duas pontas juntas, e o cartão impresso continua sendo lido.

export const LETRAS = "ABCDE";
export const FID = 7;                                               // lado das marcas pretas dos cantos (mm)
export const FIDS = [[14, 14], [196, 14], [196, 283], [14, 283]];   // centros: sup. esq., sup. dir., inf. dir., inf. esq.
export const QR = { x:162, y:22, s:28 };
export const MAX_QUESTOES = 51;                                     // 3 colunas de 17

/* Formatos (economia de papel). Todo cartão tem a MESMA proporção do A4 e é desenhado num "A4 virtual"
   (milímetros de 0 a 210 x 0 a 297) que depois é reduzido: a leitura endireita o cartão pelos 4 quadrados
   pretos e trabalha sempre nesse A4 virtual, seja o cartão de folha inteira, de meia folha ou de um quarto.
   Nos formatos menores as bolinhas e os quadrados são maiores no A4 virtual para continuarem do mesmo
   tamanho no papel. O formato vai no QR (PDE2:a6:...) e também se deduz pelo tamanho dos quadrados. */
export const FORMATOS = {
  a4:{ id:"a4", porFolha:1, s:1,    fid:7,    max:51, nome:"1 por folha (A4)",   curto:"folha inteira" },
  a5:{ id:"a5", porFolha:2, s:0.69, fid:9.5,  max:30, nome:"2 por folha (meia folha)", curto:"meia folha" },
  a6:{ id:"a6", porFolha:4, s:0.47, fid:12.8, max:20, nome:"4 por folha (um quarto)",  curto:"um quarto de folha" }
};
export const QR_COMPACTO = { x:144, y:18, s:42 };
export const qrArea = fmt => FORMATOS[fmt] && fmt !== "a4" ? QR_COMPACTO : QR;
// o menor formato em que as questões cabem (o que gasta menos papel)
export function formatoAuto(nQ){ return nQ <= FORMATOS.a6.max ? "a6" : nQ <= FORMATOS.a5.max ? "a5" : "a4"; }
export function formatoValido(fmt, nQ){ const F = FORMATOS[fmt]; return !!F && nQ <= F.max; }
export const folhasPara = (n, fmt) => Math.ceil(n / (FORMATOS[fmt] || FORMATOS.a4).porFolha);
// tamanho do quadrado (no A4 virtual) diz o formato quando o QR não foi lido
export function formatoPelaMarca(ladoVirtual){ return ladoVirtual < 8.2 ? "a4" : ladoVirtual < 11 ? "a5" : "a6"; }

// posição de cada bolinha (milímetros do A4 virtual). O PDF e a leitura usam a mesma conta.
export function layout(nQ, nAlt, fmt){
  if(fmt && fmt !== "a4" && FORMATOS[fmt]) return layoutCompacto(nQ, nAlt, FORMATOS[fmt]);
  const cols = nQ <= 17 ? 1 : nQ <= 34 ? 2 : 3, linhas = Math.ceil(nQ / cols), r = 2.6, passoY = 8.5, passoX = 8;
  const x0s = cols === 1 ? [72] : cols === 2 ? [40, 118] : [22, 86, 150];
  const y0 = 100, bolhas = [];
  for(let q = 0; q < nQ; q++){
    const c = Math.floor(q / linhas), l = q % linhas, x0 = x0s[c], y = y0 + l * passoY;
    bolhas.push({ q:q + 1, nx:x0, y, alts:Array.from({ length:nAlt }, (_, k) => ({ letra:LETRAS[k], x:x0 + 14 + k * passoX, y })) });
  }
  return { nQ, nAlt, cols, linhas, r, y0, x0s, passoX, passoY, bolhas, fmt:"a4" };
}
// formatos menores: no papel, bolinha de 4,6 mm e passo de 7,2 x 6,6 mm (como um cartão de vestibular)
function layoutCompacto(nQ, nAlt, F){
  const s = F.s, r = 2.3 / s, passoY = 7.2 / s, passoX = 6.6 / s, y0 = 96;
  const maxLinhas = Math.floor((262 - y0) / passoY) + 1, cols = Math.max(1, Math.ceil(nQ / maxLinhas)), linhas = Math.ceil(nQ / cols);
  const larg = 14 + (nAlt - 1) * passoX + r + 8, ini = 22 + Math.max(0, (168 - cols * larg) / 2), x0s = Array.from({ length:cols }, (_, i) => ini + i * larg);
  const bolhas = [];
  for(let q = 0; q < nQ; q++){
    const c = Math.floor(q / linhas), l = q % linhas, x0 = x0s[c], y = y0 + l * passoY;
    bolhas.push({ q:q + 1, nx:x0, y, alts:Array.from({ length:nAlt }, (_, k) => ({ letra:LETRAS[k], x:x0 + 14 + k * passoX, y })) });
  }
  return { nQ, nAlt, cols, linhas, r, y0, x0s, passoX, passoY, bolhas, fmt:F.id };
}

// questões objetivas de uma prova do Corretor (coleção avaliacoes), na ordem do número da prova
export const objetivas = a => (a.questoes || []).filter(q => q.tipo === "multipla").sort((x, y) => x.numero - y.numero);
export const nAltDe = obj => Math.max(4, Math.min(5, Math.max(...obj.map(q => (q.alternativas || []).length || 5))));
export const layoutDaProva = (a, fmt) => { const obj = objetivas(a); return layout(obj.length, nAltDe(obj), fmt); };

// PDE1 = cartão de folha inteira (o original); PDE2 leva o formato
export const textoQr = (avalId, alunoId, fmt) => (fmt && fmt !== "a4" ? "PDE2:" + fmt + ":" : "PDE1:") + avalId + ":" + (alunoId || "");
export function lerTextoQr(s){
  let m = /^PDE1:([A-Za-z0-9]{6,40}):([A-Za-z0-9_-]{0,40})$/.exec(s || "");
  if(m) return { av:m[1], aluno:m[2] || "", fmt:"a4" };
  m = /^PDE2:(a[456]):([A-Za-z0-9]{6,40}):([A-Za-z0-9_-]{0,40})$/.exec(s || "");
  return m ? { av:m[2], aluno:m[3] || "", fmt:m[1] } : null;
}
export function qrDataUrl(texto, nivel){
  const box = document.createElement("div");
  new window.QRCode(box, { text:texto, width:300, height:300, correctLevel:window.QRCode.CorrectLevel[nivel || "M"] });
  const c = box.querySelector("canvas"); return c ? c.toDataURL("image/png") : (box.querySelector("img") || {}).src;
}

// questões de Provas e Avaliações -> questões do cartão. Só múltipla escolha com gabarito marcado e até 5 alternativas;
// o número é o da prova impressa (a questão 4 da prova é a bolinha "04" do cartão, mesmo com dissertativas no meio).
export function questoesDoGerador(qs){
  const questoes = [], fora = [], semGab = [], muitas = [];
  (qs || []).forEach((q, i) => {
    const n = i + 1;
    if(!q || q.tipo !== "multipla" || !Array.isArray(q.alts) || q.alts.length < 2){ fora.push(n); return; }
    if(!(q.gab >= 0)){ semGab.push(n); return; }
    if(q.alts.length > 5 || q.gab > 4){ muitas.push(n); return; }
    questoes.push({ numero:n, tipo:"multipla", enunciado:String(q.enun || "Questão " + n).slice(0, 400), pontos:Math.max(0, Number(String(q.valor ?? 1).replace(",", ".")) || 0), bncc:String(q.bncc || "").slice(0, 40),
      alternativas:q.alts.slice(0, 5).map((t, k) => ({ letra:LETRAS[k], texto:String(t || "").slice(0, 200), correta:k === q.gab })) });
  });
  return { questoes, fora, semGab, muitas };
}
// impressão digital do gabarito: muda se mudar a questão, a alternativa certa ou o valor
export const assinaturaGab = questoes => questoes.map(q => q.numero + ":" + q.alternativas.length + ":" + ((q.alternativas.find(a => a.correta) || {}).letra || "-") + ":" + q.pontos).join("|");

// desenha um cartão (uma página do jsPDF). aluno = { id, nome } ou null para cartão em branco.
export function desenharCartao(pdf, { lay, aval, turma, aluno }){
  const L = lay, a = aval, t = turma || {}, nums = objetivas(a).map(q => q.numero);
  pdf.setFillColor(0, 0, 0); FIDS.forEach(([x, y]) => pdf.rect(x - FID / 2, y - FID / 2, FID, FID, "F"));
  pdf.setTextColor(12, 35, 56); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("PORTAL DO EDUCADOR · CARTÃO-RESPOSTA", 24, 20);
  pdf.setFontSize(15); pdf.text(pdf.splitTextToSize(a.titulo || "Prova", 128)[0], 24, 28);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(60, 75, 95);
  pdf.text([t.escola_nome, "Turma " + (t.nome || ""), a.disciplina].filter(Boolean).join("  ·  ").slice(0, 95), 24, 34);
  pdf.setDrawColor(150, 160, 175); pdf.setLineWidth(0.3); pdf.roundedRect(22, 39, 134, 13, 2, 2);
  pdf.setFontSize(7.5); pdf.text("ALUNO(A)", 25, 43);
  pdf.setTextColor(12, 35, 56); pdf.setFont("helvetica", "bold"); pdf.setFontSize(aluno ? 13 : 10);
  pdf.text(aluno ? String(aluno.nome).slice(0, 48) : "", 25, 49.5);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(60, 75, 95); pdf.text("DATA ____/____/______", 120, 43);
  pdf.addImage(qrDataUrl(textoQr(a.id, aluno && aluno.id)), "PNG", QR.x, QR.y, QR.s, QR.s);
  pdf.setFontSize(8.5); pdf.setTextColor(12, 35, 56); pdf.setFont("helvetica", "bold");
  pdf.text("Pinte a bolinha inteira com caneta azul ou preta.", 24, 62);
  pdf.setFont("helvetica", "normal"); pdf.setTextColor(60, 75, 95);
  pdf.text("Uma alternativa por questão. Não rasure e não dobre o cartão.", 24, 67);
  pdf.text("Certo:", 128, 64.5); pdf.setFillColor(20, 20, 20); pdf.circle(141, 63.6, 2.3, "F");
  pdf.text("Errado:", 148, 64.5); pdf.setDrawColor(20, 20, 20); pdf.setLineWidth(0.5); pdf.circle(162, 63.6, 2.3); pdf.line(160.4, 62, 163.6, 65.2); pdf.line(163.6, 62, 160.4, 65.2);
  pdf.setLineWidth(0.25); pdf.setDrawColor(180, 190, 200); pdf.line(22, 74, 188, 74);
  if(nums.some((n, i) => n !== i + 1)){ pdf.setFontSize(7.5); pdf.setTextColor(100, 115, 130); pdf.text("Os números são os da prova. Questões abertas são respondidas na própria prova.", 24, 79); }
  // cabeçalho das colunas
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(100, 115, 130);
  L.x0s.slice(0, L.cols).forEach(x0 => LETRAS.slice(0, L.nAlt).split("").forEach((l, k) => pdf.text(l, x0 + 14 + k * L.passoX, L.y0 - 6.5, { align:"center" })));
  L.bolhas.forEach(b => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5); pdf.setTextColor(12, 35, 56); pdf.text(String(nums[b.q - 1] || b.q).padStart(2, "0"), b.nx + 6, b.y + 1.2, { align:"right" });
    b.alts.forEach(al => {
      pdf.setDrawColor(55, 65, 80); pdf.setLineWidth(0.3); pdf.circle(al.x, al.y, L.r);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(185, 192, 200); pdf.text(al.letra, al.x, al.y + 0.9, { align:"center" });
    });
  });
  pdf.setFontSize(7); pdf.setTextColor(140, 150, 160);
  pdf.text("Não escreva perto dos quadrados pretos dos cantos. Corrigido pelo Corretor de Gabarito do Portal do Educador.", 105, 276, { align:"center" });
}

// cartão reduzido (meia folha ou um quarto): ox, oy = canto da célula no papel (mm)
export function desenharCompacto(pdf, { lay, aval, turma, aluno, fmt, ox, oy }){
  const F = FORMATOS[fmt], s = F.s, a = aval, t = turma || {}, nums = objetivas(a).map(q => q.numero), L = lay, peq = fmt === "a6";
  const X = x => ox + x * s, Y = y => oy + y * s, fs = (a6, a5) => peq ? a6 : a5;
  pdf.setFillColor(0, 0, 0); FIDS.forEach(([x, y]) => pdf.rect(X(x - F.fid / 2), Y(y - F.fid / 2), F.fid * s, F.fid * s, "F"));
  const larg = (138 - 24) * s;
  pdf.setTextColor(12, 35, 56); pdf.setFont("helvetica", "bold"); pdf.setFontSize(fs(5, 6)); pdf.text("CARTÃO-RESPOSTA · PORTAL DO EDUCADOR", X(24), Y(23));
  pdf.setFontSize(fs(8.5, 10.5)); pdf.text(pdf.splitTextToSize(a.titulo || "Prova", larg)[0], X(24), Y(31.5));
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(fs(6, 7)); pdf.setTextColor(60, 75, 95);
  pdf.text(pdf.splitTextToSize([t.escola_nome, "Turma " + (t.nome || ""), a.disciplina].filter(Boolean).join(" · "), larg)[0], X(24), Y(38.5));
  pdf.setDrawColor(150, 160, 175); pdf.setLineWidth(0.25); pdf.roundedRect(X(22), Y(43), (140 - 22) * s, 17 * s, 1.2, 1.2);
  pdf.setFontSize(fs(4.8, 5.5)); pdf.text("ALUNO(A)", X(25), Y(48));
  pdf.setTextColor(12, 35, 56); pdf.setFont("helvetica", "bold"); pdf.setFontSize(fs(8.5, 10.5));
  if(aluno) pdf.text(pdf.splitTextToSize(String(aluno.nome), (140 - 28) * s)[0], X(25), Y(56.5));
  pdf.addImage(qrDataUrl(textoQr(a.id, aluno && aluno.id, fmt), "M"), "PNG", X(QR_COMPACTO.x), Y(QR_COMPACTO.y), QR_COMPACTO.s * s, QR_COMPACTO.s * s);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(fs(5.8, 6.8)); pdf.setTextColor(12, 35, 56);
  pdf.text("Pinte a bolinha inteira com caneta azul ou preta. Uma por questão.", X(24), Y(69));
  pdf.setFont("helvetica", "normal"); pdf.setTextColor(100, 115, 130); pdf.setFontSize(fs(5, 6));
  pdf.text("Não rasure, não dobre e não escreva perto dos quadrados pretos." + (nums.some((n, i) => n !== i + 1) ? " Números = questões da prova." : ""), X(24), Y(75));
  pdf.setLineWidth(0.2); pdf.setDrawColor(190, 198, 208); pdf.line(X(22), Y(80), X(188), Y(80));
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(fs(6, 7)); pdf.setTextColor(100, 115, 130);
  L.x0s.forEach(x0 => LETRAS.slice(0, L.nAlt).split("").forEach((l, k) => pdf.text(l, X(x0 + 14 + k * L.passoX), Y(L.y0 - L.passoY * 0.62), { align:"center" })));
  L.bolhas.forEach(b => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(fs(7.5, 8.5)); pdf.setTextColor(12, 35, 56); pdf.text(String(nums[b.q - 1] || b.q).padStart(2, "0"), X(b.nx + 7), Y(b.y) + 1, { align:"right" });
    b.alts.forEach(al => {
      pdf.setDrawColor(55, 65, 80); pdf.setLineWidth(0.25); pdf.circle(X(al.x), Y(al.y), L.r * s);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(fs(5, 5.5)); pdf.setTextColor(185, 192, 200); pdf.text(al.letra, X(al.x), Y(al.y) + 0.7, { align:"center" });
    });
  });
}
// gera o PDF inteiro: lista = alunos ({ id, nome }) e null para cartão em branco
export function gerarPdfCartoes({ aval, turma, lista, fmt }){
  fmt = FORMATOS[fmt] ? fmt : "a4";
  const lay = layoutDaProva(aval, fmt);
  if(fmt === "a4"){
    const pdf = new window.jspdf.jsPDF({ unit:"mm", format:"a4" });
    lista.forEach((al, i) => { if(i) pdf.addPage(); desenharCartao(pdf, { lay, aval, turma, aluno:al }); });
    return pdf;
  }
  const F = FORMATOS[fmt], paisagem = fmt === "a5", pdf = new window.jspdf.jsPDF({ unit:"mm", format:"a4", orientation:paisagem ? "landscape" : "portrait" });
  // células: meia folha = A4 deitado com 2 cartões lado a lado; um quarto = A4 em pé, 2 x 2
  const W = paisagem ? 297 : 210, Hp = paisagem ? 210 : 297, cw = paisagem ? W / 2 : W / 2, ch = paisagem ? Hp : Hp / 2;
  const cels = paisagem ? [[0, 0], [cw, 0]] : [[0, 0], [cw, 0], [0, ch], [cw, ch]];
  const largC = 210 * F.s, altC = 297 * F.s, mx = (cw - largC) / 2, my = (ch - altC) / 2;
  lista.forEach((al, i) => {
    const k = i % F.porFolha;
    if(i && !k) pdf.addPage("a4", paisagem ? "landscape" : "portrait");
    if(!k){ // linhas de corte
      pdf.setDrawColor(170, 178, 188); pdf.setLineWidth(0.2); pdf.setLineDashPattern([2, 2], 0);
      pdf.line(cw, 4, cw, Hp - 4); if(!paisagem) pdf.line(4, ch, W - 4, ch);
      pdf.setLineDashPattern([], 0);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(5.5); pdf.setTextColor(160, 168, 178); pdf.text("corte na linha tracejada", cw + 1.5, 6);
    }
    desenharCompacto(pdf, { lay, aval, turma, aluno:al, fmt, ox:cels[k][0] + mx, oy:cels[k][1] + my });
  });
  return pdf;
}

// carrega jsPDF e QRCode sob demanda (a página que só imprime a prova não paga esse peso)
const LIBS = { jspdf:"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", QRCode:"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" };
export function carregarLibs(){
  return Promise.all(Object.entries(LIBS).map(([g, src]) => window[g] ? null : new Promise((ok, erro) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => erro(new Error("Não foi possível carregar " + g)); document.head.appendChild(s);
  })));
}
