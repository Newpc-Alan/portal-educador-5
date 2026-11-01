// Ficha impressa do acervo (Atividades) no padrão do Portal: cabeçalho genérico para preencher à mão,
// páginas do aluno e, separada, a página do professor (orientações, gabarito e BNCC).
// Rodapé discreto: logotipo pequeno do Portal do Educador no canto. Sem prefeitura nem escola.
// Uso: const bytes = fichaPdf(jsPDF, { doc, contexto, imagem:{url,w,h}|null, logo:{url,w,h} })
const LETRAS = 'ABCDEFGH';
const MAPA = { 'π': 'pi', '≤': '<=', '≥': '>=', '≠': 'diferente de', '√': 'raiz de ', '−': '-', '–': '-', '—': ', ', '…': '...', '“': '"', '”': '"', '‘': "'", '’': "'", '•': '-', '→': '->', '≈': 'aprox. ', '★': '', '✓': '' };
const tx = s => String(s == null ? '' : s).replace(/[π≤≥≠√−–—…“”‘’•→≈★✓]/g, c => MAPA[c]).replace(/[^\u0000-ÿ\n]/g, '').replace(/\t/g, ' ').replace(/ +([,.;:])/g, '$1').replace(/_{3,}/g, '_______________').trim();
// seções que vão para a página do professor
const DO_PROFESSOR = /^(para o professor|orienta[cç][oõ]es|para ampliar|amplia|como conduzir|objetivo)/i;

export function fichaPdf(jsPDF, { doc: d, contexto: cx = {}, imagem = null, logo = null }) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, H = 297, mx = 16, larg = W - 2 * mx, corpo = 12, lh = corpo * 0.5;
  const AZUL = [15, 44, 74], VERDE = [26, 107, 42], CINZA = [90, 106, 122], TINTA = [20, 30, 40];
  let y = 0;
  const cor = c => pdf.setTextColor(c[0], c[1], c[2]);
  const fim = H - 18;
  const quebra = n => { if (y + n > fim) { pdf.addPage(); y = 18; } };
  const escrever = (t, x, w, bold, tam, c) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(tam || corpo); cor(c || TINTA); const l2 = (tam || corpo) * 0.5;
    String(t || '').split(/\n/).forEach(par => pdf.splitTextToSize(tx(par) || ' ', w).forEach(l => { quebra(l2); pdf.text(l, x, y); y += l2; }));
  };
  const secoes = d.secoes || [];
  const doAluno = secoes.filter(s => !DO_PROFESSOR.test(String(s.titulo || '').trim()));
  const doProf = secoes.filter(s => DO_PROFESSOR.test(String(s.titulo || '').trim()));

  // ---------- página do aluno ----------
  // cabeçalho genérico: linhas para preencher à mão
  y = 14; pdf.setDrawColor(190, 202, 214); pdf.setLineWidth(0.3); pdf.roundedRect(mx, y, larg, 25, 2.5, 2.5);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); cor(CINZA);
  const campo = (rot, x, yy, ate) => { pdf.text(rot, x, yy); const w = pdf.getTextWidth(rot + ' '); pdf.line(x + w, yy + 0.8, ate, yy + 0.8); };
  campo('Escola:', mx + 4, y + 7, W - mx - 4);
  campo('Professor(a):', mx + 4, y + 14, mx + 118); campo('Turma:', mx + 122, y + 14, W - mx - 4);
  campo('Aluno(a):', mx + 4, y + 21, mx + 118); pdf.text('Data: ____/____/______', W - mx - 4, y + 21, { align: 'right' });
  y += 33;
  const selo = [cx.disciplina, cx.serie].filter(Boolean).join(' · ');
  if (selo) { escrever(selo.toUpperCase(), mx, larg, true, 8.5, VERDE); y += 4; }
  escrever(d.titulo || 'Atividade', mx, larg, true, 17, AZUL); y += 4;

  let n = 0;
  const desenharSecao = s => {
    const qs = s.questoes || [];
    if (s.titulo && !/^atividade$/i.test(String(s.titulo).trim())) { quebra(lh * 3); escrever(s.titulo, mx, larg, true, 12.5, AZUL); y += 1.5; }
    if (s.texto) { escrever(s.texto, mx, larg, false); y += 2; }
    (s.itens || []).forEach((it, i) => {
      quebra(lh * 2); pdf.setFillColor(VERDE[0], VERDE[1], VERDE[2]); pdf.circle(mx + 3, y - 1.6, 2.6, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(255, 255, 255); pdf.text(String(i + 1), mx + 3, y - 0.6, { align: 'center' });
      escrever(it, mx + 9, larg - 9, false, 13); y += 2;
    });
    if (s.tabela && s.tabela.grade) {
      const ls = s.tabela.linhas || [], nc = Math.max(1, ...ls.map(l => (l.celulas || []).length)), c = Math.min(11, larg / nc), x0 = mx + (larg - c * nc) / 2;
      quebra(c * ls.length + 6); pdf.setDrawColor(150, 170, 190); pdf.setFont('courier', 'bold'); pdf.setFontSize(Math.min(15, c * 1.5)); cor(TINTA);
      ls.forEach((l, i) => (l.celulas || []).forEach((v, j) => { pdf.rect(x0 + j * c, y + i * c, c, c); pdf.text(tx(v), x0 + j * c + c / 2, y + i * c + c * 0.68, { align: 'center' }); }));
      y += c * ls.length + 6;
    } else if (s.tabela && (s.tabela.colunas || []).length) {
      const cols = s.tabela.colunas, cw = larg / cols.length;
      const linha = (cel, bold) => { pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(10); cor(TINTA); const ls = cel.map(c => pdf.splitTextToSize(tx(c) || ' ', cw - 3)), alt = Math.max(...ls.map(l => l.length)) * 4.6 + 3;
        quebra(alt); if (bold) { pdf.setFillColor(238, 243, 248); pdf.rect(mx, y - 4, larg, alt, 'F'); } pdf.setDrawColor(201, 213, 225);
        ls.forEach((l, i) => { pdf.rect(mx + i * cw, y - 4, cw, alt); l.forEach((t, k) => pdf.text(t, mx + i * cw + 1.5, y + k * 4.6)); }); y += alt; };
      y += 2; linha(cols, true); (s.tabela.linhas || []).forEach(l => linha(cols.map((_, i) => (l.celulas || [])[i] || ''), false)); y += 4;
    }
    qs.forEach(q => {
      n++; quebra(lh * 3);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(corpo); cor(TINTA); pdf.text(n + '.', mx, y);
      escrever(q.enunciado, mx + 7, larg - 7, false); y += 1;
      const caixa = w => { pdf.setDrawColor(90, 110, 130); pdf.rect(mx + 9, y - lh * 0.72, lh * w, lh * 0.8); };
      if (q.tipo === 'multipla') (q.alternativas || []).forEach((a, j) => { quebra(lh); caixa(0.8); escrever(LETRAS[j] + ') ' + a, mx + 9 + lh * 1.3, larg - 9 - lh * 1.3, false); });
      if (q.tipo === 'vf') (q.alternativas || []).forEach(a => { quebra(lh); caixa(1.4); escrever(a, mx + 9 + lh * 1.9, larg - 9 - lh * 1.9, false); });
      const nl = q.tipo === 'aberta' ? 4 : q.tipo === 'curta' ? 2 : 0;
      for (let k = 0; k < nl; k++) { quebra(9); y += 7; pdf.setDrawColor(170, 185, 200); pdf.line(mx + 7, y, W - mx, y); }
      y += 4.5;
    });
    y += 3;
  };
  doAluno.forEach(desenharSecao);
  // ilustração: ocupa o espaço que sobra na folha (na Educação Infantil é onde a criança faz a atividade)
  if (imagem) {
    const sobra = fim - y - 4, k0 = Math.min(larg / imagem.w, Math.max(sobra, 120) / imagem.h);
    if (sobra < 90) { pdf.addPage(); y = 18; }
    const k = Math.min(larg / imagem.w, (fim - y - 4) / imagem.h, k0 * 1.0);
    pdf.addImage(imagem.url, 'JPEG', mx + (larg - imagem.w * k) / 2, y, imagem.w * k, imagem.h * k); y += imagem.h * k + 4;
  }

  // ---------- página do professor ----------
  const temGab = (d.gabarito || []).length > 0, temBncc = (d.bncc || []).some(b => b.codigo || b.descricao);
  if (doProf.length || temGab || temBncc || d.nota_professor) {
    pdf.addPage(); y = 14;
    pdf.setFillColor(238, 243, 248); pdf.roundedRect(mx, y, larg, 13, 2.5, 2.5, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); cor(AZUL); pdf.text('Página do professor', mx + 4, y + 8.5);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); cor(CINZA); pdf.text(tx(d.titulo || '').slice(0, 70), W - mx - 4, y + 8.5, { align: 'right' });
    y += 22;
    doProf.forEach(s => { quebra(lh * 3); escrever(/^para o professor$/i.test(String(s.titulo).trim()) ? 'Como conduzir' : s.titulo, mx, larg, true, 12.5, AZUL); y += 1.5; if (s.texto) { escrever(s.texto, mx, larg, false, 11); y += 2; }
      (s.itens || []).forEach(it => { quebra(lh); escrever('- ' + it, mx + 2, larg - 2, false, 11); y += 1; }); y += 4; });
    if (temGab) { quebra(lh * 3); escrever('Gabarito', mx, larg, true, 12.5, AZUL); y += 1.5;
      d.gabarito.forEach(g => { escrever(g.questao + '. ' + g.resposta, mx, larg, true, 11); if (g.comentario) escrever(g.comentario, mx + 6, larg - 6, false, 10, CINZA); y += 2; }); y += 3; }
    if (temBncc) { quebra(lh * 3); escrever(/infantil/i.test(cx.disciplina || '') ? 'Objetivos de aprendizagem (BNCC)' : 'Habilidades da BNCC', mx, larg, true, 12.5, AZUL); y += 1.5;
      d.bncc.forEach(b => escrever('- ' + [b.codigo, b.descricao].filter(Boolean).join(': '), mx + 2, larg - 2, false, 10.5)); y += 3; }
    if (d.nota_professor) { quebra(lh * 3); escrever('Dica: ' + d.nota_professor, mx, larg, false, 10.5, VERDE); }
  }

  // ---------- rodapé: logotipo pequeno no canto ----------
  const np = pdf.getNumberOfPages();
  for (let i = 1; i <= np; i++) {
    pdf.setPage(i); pdf.setDrawColor(222, 229, 236); pdf.setLineWidth(0.2); pdf.line(mx, H - 13, W - mx, H - 13);
    if (logo) pdf.addImage(logo.url, 'PNG', W - mx - 7, H - 11.5, 7, 7);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); cor(AZUL); pdf.text('Portal do Educador', W - mx - 8.5, H - 8.6, { align: 'right' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.8); cor(CINZA); pdf.text('portaldoeducador.com.br', W - mx - 8.5, H - 5.6, { align: 'right' });
    if (np > 1) pdf.text('Página ' + i + ' de ' + np, mx, H - 7);
  }
  return pdf.output('arraybuffer');
}
