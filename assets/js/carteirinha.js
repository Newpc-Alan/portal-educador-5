// Carteirinha do aluno (CR80, 85,6 x 54 mm), 10 por folha A4, com QR "PDEA:<id>" lido pela portaria.
// Usada pela Frequência (Carteirinhas) e pela Ficha do Aluno. Precisa de window.jspdf e window.QRCode carregados na página.
export function qrDataUrl(texto){
  const box = document.createElement("div");
  new window.QRCode(box, { text:texto, width:256, height:256, correctLevel:window.QRCode.CorrectLevel.M });
  const c = box.querySelector("canvas"); return c ? c.toDataURL("image/png") : (box.querySelector("img") || {}).src;
}
export function logoPng(url){
  return new Promise(ok => {
    if(!url){ ok(null); return; }
    const img = new Image(), t = setTimeout(() => ok(null), 7000); img.crossOrigin = "anonymous";
    img.onload = () => { clearTimeout(t); try{ const k = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k)); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      ok({ url:c.toDataURL("image/png"), w:c.width, h:c.height }); }catch(e){ ok(null); } };
    img.onerror = () => { clearTimeout(t); ok(null); }; img.src = url;
  });
}
export function cartao(pdf, x, y, al, turma, escola, muni, lg, ano, foto){
  const W = 85.6, H = 54;
  pdf.setDrawColor(200, 210, 222); pdf.setLineWidth(0.2); pdf.roundedRect(x, y, W, H, 3, 3, "S");
  pdf.setFillColor(12, 35, 56); pdf.roundedRect(x, y, W, 14, 3, 3, "F"); pdf.rect(x, y + 10, W, 4, "F");
  let tx = x + 3.5;
  if(lg){ pdf.setFillColor(255, 255, 255); pdf.roundedRect(x + 2.5, y + 2, 10, 10, 1.5, 1.5, "F"); const k = Math.min(8.6 / lg.w, 8.6 / lg.h); pdf.addImage(lg.url, "PNG", x + 2.5 + (10 - lg.w * k) / 2, y + 2 + (10 - lg.h * k) / 2, lg.w * k, lg.h * k); tx = x + 15; }
  pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.2); pdf.text(pdf.splitTextToSize(escola.toUpperCase(), x + W - 3 - tx)[0] || "", tx, y + 6.2);
  pdf.setTextColor(141, 198, 63); pdf.setFontSize(5.4); pdf.text(pdf.splitTextToSize(("Prefeitura Municipal de " + muni).toUpperCase(), x + W - 3 - tx)[0] || "", tx, y + 10.2);
  // com foto do cadastro: foto à esquerda e o texto ao lado; sem foto, o desenho original
  const fx = foto ? x + 26 : x + 4, larg = foto ? 27 : 50;
  if(foto){ pdf.setFillColor(230, 238, 246); pdf.roundedRect(x + 3.5, y + 16.5, 20, 20, 1.5, 1.5, "F"); pdf.addImage(foto, "JPEG", x + 4, y + 17, 19, 19); }
  pdf.setTextColor(107, 124, 144); pdf.setFontSize(5.5); pdf.text("ALUNO(A)", fx, y + 20);
  pdf.setTextColor(12, 35, 56); pdf.setFont("helvetica", "bold"); pdf.setFontSize(foto ? 8.6 : 10.5);
  const nm = pdf.splitTextToSize(al.nome, larg).slice(0, foto ? 3 : 2); pdf.text(nm, fx, y + 24.5);
  const yb = Math.max(y + 24.5 + nm.length * (foto ? 3.6 : 4.4) + 2, foto ? y + 39.5 : 0);
  const xb = x + 4, xa = foto ? x + 30 : x + 34;
  pdf.setTextColor(107, 124, 144); pdf.setFont("helvetica", "bold"); pdf.setFontSize(5.5); pdf.text("TURMA", xb, yb); pdf.text("ANO LETIVO", xa, yb);
  pdf.setTextColor(12, 35, 56); pdf.setFontSize(8.5); pdf.text(pdf.splitTextToSize(turma, 24)[0] || "", xb, yb + 4); pdf.text(String(ano), xa, yb + 4);
  pdf.addImage(qrDataUrl("PDEA:" + al.id), "PNG", x + W - 30, y + 17, 27, 27);
  pdf.setFillColor(141, 198, 63); pdf.rect(x + 3, y + H - 6.5, W - 6, 0.5, "F");
  pdf.setTextColor(107, 124, 144); pdf.setFont("helvetica", "normal"); pdf.setFontSize(5.2); pdf.text("Apresente na entrada da escola · Portal do Educador", x + 4, y + H - 3);
}
// lista: [{ a:{ id, nome, foto? }, turma:"5º Ano A" }]; urlFoto(path) devolve um endereço de imagem (blob:) ou ""
export async function gerarPdf({ lista, escola, muni, ano, urlFoto, progresso }){
  const fotos = {}, comFoto = urlFoto ? lista.filter(x => x.a.foto) : [];
  for(let i = 0; i < comFoto.length; i += 6){
    if(progresso) progresso("Preparando fotos " + Math.min(comFoto.length, i + 6) + " de " + comFoto.length + "...");
    await Promise.all(comFoto.slice(i, i + 6).map(async x => { const u = await urlFoto(x.a.foto); if(!u) return; try{ const img = await new Promise((ok, er) => { const m = new Image(); m.onload = () => ok(m); m.onerror = er; m.src = u; });
      const c = document.createElement("canvas"); c.width = c.height = 240; c.getContext("2d").drawImage(img, 0, 0, 240, 240); fotos[x.a.id] = c.toDataURL("image/jpeg", 0.8); }catch(e){} }));
  }
  const lg = await logoPng(muni && muni.logo_url), pdf = new window.jspdf.jsPDF({ unit:"mm", format:"a4" });
  for(let i = 0; i < lista.length; i++){
    const k = i % 10; if(i && !k) pdf.addPage();
    cartao(pdf, 14 + (k % 2) * (85.6 + 11), 8 + Math.floor(k / 2) * 56.5, lista[i].a, lista[i].turma || "", escola || "", (muni && muni.nome) || "", lg, ano, fotos[lista[i].a.id]);
    if(progresso && i % 40 === 39){ progresso("Gerando " + (i + 1) + " de " + lista.length + "..."); await new Promise(r => setTimeout(r, 0)); }
  }
  return { pdf, comFoto:Object.keys(fotos).length, pedidas:comFoto.length };
}
