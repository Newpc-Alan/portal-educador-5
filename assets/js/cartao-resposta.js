// Cartão-resposta do Portal do Educador: geometria, desenho em PDF e conversão das questões.
// Um arquivo só para quem IMPRIME (Corretor de Gabarito e Provas e Avaliações) e para quem LÊ (Corretor):
// mudar a geometria aqui muda as duas pontas juntas, e o cartão impresso continua sendo lido.

export const LETRAS = "ABCDE";
export const FID = 7;                                               // lado das marcas pretas dos cantos (mm)
export const FIDS = [[14, 14], [196, 14], [196, 283], [14, 283]];   // centros: sup. esq., sup. dir., inf. dir., inf. esq.
export const QR = { x:162, y:22, s:28 };
export const MAX_QUESTOES = 51;                                     // 3 colunas de 17

// posição de cada bolinha (milímetros, A4 em pé). O PDF e a leitura usam a mesma conta.
export function layout(nQ, nAlt){
  const cols = nQ <= 17 ? 1 : nQ <= 34 ? 2 : 3, linhas = Math.ceil(nQ / cols), r = 2.6, passoY = 8.5, passoX = 8;
  const x0s = cols === 1 ? [72] : cols === 2 ? [40, 118] : [22, 86, 150];
  const y0 = 100, bolhas = [];
  for(let q = 0; q < nQ; q++){
    const c = Math.floor(q / linhas), l = q % linhas, x0 = x0s[c], y = y0 + l * passoY;
    bolhas.push({ q:q + 1, nx:x0, y, alts:Array.from({ length:nAlt }, (_, k) => ({ letra:LETRAS[k], x:x0 + 14 + k * passoX, y })) });
  }
  return { nQ, nAlt, cols, linhas, r, y0, x0s, passoX, passoY, bolhas };
}

// questões objetivas de uma prova do Corretor (coleção avaliacoes), na ordem do número da prova
export const objetivas = a => (a.questoes || []).filter(q => q.tipo === "multipla").sort((x, y) => x.numero - y.numero);
export const nAltDe = obj => Math.max(4, Math.min(5, Math.max(...obj.map(q => (q.alternativas || []).length || 5))));
export const layoutDaProva = a => { const obj = objetivas(a); return layout(obj.length, nAltDe(obj)); };

export const textoQr = (avalId, alunoId) => "PDE1:" + avalId + ":" + (alunoId || "");
export function qrDataUrl(texto){
  const box = document.createElement("div");
  new window.QRCode(box, { text:texto, width:300, height:300, correctLevel:window.QRCode.CorrectLevel.M });
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

// carrega jsPDF e QRCode sob demanda (a página que só imprime a prova não paga esse peso)
const LIBS = { jspdf:"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", QRCode:"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" };
export function carregarLibs(){
  return Promise.all(Object.entries(LIBS).map(([g, src]) => window[g] ? null : new Promise((ok, erro) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => erro(new Error("Não foi possível carregar " + g)); document.head.appendChild(s);
  })));
}
