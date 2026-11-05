// Carteirinha do aluno (CR80, 85,6 x 54 mm), com QR "PDEA:<id>" lido pela portaria.
// Dois jeitos de imprimir: folha A4 (10 por folha, para recortar) ou impressora de crachá (um cartão por página CR80, sem borda).
// Usada pela Frequência (Carteirinhas) e pela Ficha do Aluno. Precisa de window.jspdf e window.QRCode carregados na página.
import { rede } from "/assets/js/rede.js";
// faixa verde do cartão: quem emite (prefeitura, governo do estado) ou, na rede particular, a mantenedora/cidade
export function linhaCartao(muni, escola){
  if(!muni || !muni.nome) return "";
  const R = rede(muni); if(R.publica) return R.cartao;
  return String(muni.nome).trim().toLowerCase() === String(escola || "").trim().toLowerCase() ? R.cidade : muni.nome;
}
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
export function cartao(pdf, x, y, al, turma, escola, muni, lg, ano, foto, cracha){
  const W = 85.6, H = 54;
  // na folha A4 vai a linha de corte; na impressora de crachá o cartão já é o PVC, sem borda
  if(!cracha){ pdf.setDrawColor(200, 210, 222); pdf.setLineWidth(0.2); pdf.roundedRect(x, y, W, H, 3, 3, "S"); }
  pdf.setFillColor(12, 35, 56); pdf.roundedRect(x, y, W, 14, 3, 3, "F"); pdf.rect(x, y + 10, W, 4, "F");
  let tx = x + 3.5;
  if(lg){ pdf.setFillColor(255, 255, 255); pdf.roundedRect(x + 2.5, y + 2, 10, 10, 1.5, 1.5, "F"); const k = Math.min(8.6 / lg.w, 8.6 / lg.h); pdf.addImage(lg.url, "PNG", x + 2.5 + (10 - lg.w * k) / 2, y + 2 + (10 - lg.h * k) / 2, lg.w * k, lg.h * k); tx = x + 15; }
  pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.2); pdf.text(pdf.splitTextToSize(escola.toUpperCase(), x + W - 3 - tx)[0] || "", tx, y + 6.2);
  pdf.setTextColor(141, 198, 63); pdf.setFontSize(5.4); pdf.text(pdf.splitTextToSize(String(muni || "").toUpperCase(), x + W - 3 - tx)[0] || "", tx, y + 10.2);
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
export async function gerarPdf({ lista, escola, muni, ano, urlFoto, progresso, formato }){
  const cracha = formato === "cracha";
  const fotos = {}, comFoto = urlFoto ? lista.filter(x => x.a.foto) : [];
  for(let i = 0; i < comFoto.length; i += 6){
    if(progresso) progresso("Preparando fotos " + Math.min(comFoto.length, i + 6) + " de " + comFoto.length + "...");
    await Promise.all(comFoto.slice(i, i + 6).map(async x => { const u = await urlFoto(x.a.foto); if(!u) return; try{ const img = await new Promise((ok, er) => { const m = new Image(); m.onload = () => ok(m); m.onerror = er; m.src = u; });
      const c = document.createElement("canvas"); c.width = c.height = 240; c.getContext("2d").drawImage(img, 0, 0, 240, 240); fotos[x.a.id] = c.toDataURL("image/jpeg", 0.8); }catch(e){} }));
  }
  const lg = await logoPng(muni && muni.logo_url);
  const pdf = cracha ? new window.jspdf.jsPDF({ unit:"mm", format:[85.6, 54], orientation:"landscape" }) : new window.jspdf.jsPDF({ unit:"mm", format:"a4" });
  for(let i = 0; i < lista.length; i++){
    const al = lista[i];
    if(cracha){ if(i) pdf.addPage([85.6, 54], "landscape"); cartao(pdf, 0, 0, al.a, al.turma || "", escola || "", linhaCartao(muni, escola), lg, ano, fotos[al.a.id], true); }
    else{ const k = i % 10; if(i && !k) pdf.addPage();
      cartao(pdf, 14 + (k % 2) * (85.6 + 11), 8 + Math.floor(k / 2) * 56.5, al.a, al.turma || "", escola || "", linhaCartao(muni, escola), lg, ano, fotos[al.a.id]); }
    if(progresso && i % 40 === 39){ progresso("Gerando " + (i + 1) + " de " + lista.length + "..."); await new Promise(r => setTimeout(r, 0)); }
  }
  return { pdf, comFoto:Object.keys(fotos).length, pedidas:comFoto.length };
}

// Pergunta onde imprimir: folha A4 ou impressora de crachá (CR80). Lembra a escolha neste navegador.
// Devolve "a4", "cracha" ou null (cancelou).
export function perguntarFormato(titulo){
  return new Promise(ok => {
    let lembrado = ""; try{ lembrado = localStorage.getItem("pde_cartao_formato") || ""; }catch(e){}
    const fundo = document.createElement("div");
    fundo.setAttribute("style", "position:fixed;inset:0;background:rgba(12,35,56,.55);z-index:2147483300;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif");
    const opc = (v, ico, t, d) => '<button type="button" data-fmt="' + v + '" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;border:2px solid ' + (lembrado === v ? "#1a6b2a" : "#d5dde5") +
      ';background:#fff;border-radius:12px;padding:12px 14px;margin:0 0 10px;cursor:pointer;font:inherit;color:#0f2c4a"><span style="font-size:26px">' + ico + '</span><span><b style="display:block;font-size:15px">' + t + '</b><small style="color:#5b6b7c;font-size:12.5px">' + d + '</small></span></button>';
    fundo.innerHTML = '<div role="dialog" aria-modal="true" style="background:#f4f7fa;border-radius:16px;max-width:420px;width:100%;padding:18px 18px 8px;box-shadow:0 12px 40px rgba(0,0,0,.3)">' +
      '<b style="display:block;font-size:17px;color:#0f2c4a;margin:0 0 4px">' + (titulo || "Imprimir cartões") + '</b><p style="margin:0 0 14px;color:#5b6b7c;font-size:13px">Onde você vai imprimir?</p>' +
      opc("a4", "📄", "Folha A4", "10 cartões por folha, para recortar e plastificar") +
      opc("cracha", "🪪", "Impressora de crachá", "Um cartão por página, no tamanho do cartão de PVC (CR80, 85,6 x 54 mm)") +
      '<button type="button" data-fmt="" style="width:100%;border:0;background:none;color:#5b6b7c;padding:10px;cursor:pointer;font:inherit">Cancelar</button></div>';
    fundo.addEventListener("click", e => {
      const b = e.target.closest("[data-fmt]"); if(!b) return;
      const v = b.dataset.fmt || null; if(v){ try{ localStorage.setItem("pde_cartao_formato", v); }catch(e){} }
      fundo.remove(); ok(v);
    });
    document.body.appendChild(fundo);
  });
}
