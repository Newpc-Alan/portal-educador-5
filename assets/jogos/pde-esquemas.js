// Esquemas científicos dos jogos (nov/2026), desenhados em vetor para ficarem CORRETOS (imagem gerada por IA erra anatomia e
// ordem dos planetas). Cada função devolve o SVG: sem nomes enquanto a pergunta está aberta e, depois da resposta
// (revelado = true), com o nome e o destaque do que foi perguntado.
(function(){
"use strict";
const T = '#0f2c4a', F = 'font-family="Fredoka, sans-serif" font-weight="600"';
const nome = (x, y, t, anc) => '<text x="' + x + '" y="' + y + '" text-anchor="' + (anc || "middle") + '" font-size="13" fill="' + T + '" ' + F + ' stroke="#fff" stroke-width="3" paint-order="stroke">' + t + "</text>";

/* ---------- Sistema Solar: o Sol e os 8 planetas, na ordem. Tamanhos e distâncias fora de escala (dito na legenda). ---------- */
const PLANETAS = [
  { k:"mercurio", n:"Mercúrio", x:62, r:4.5, c:"#9A9A9A" }, { k:"venus", n:"Vênus", x:88, r:7.5, c:"#E3B66B" }, { k:"terra", n:"Terra", x:118, r:8, c:"#2F7DD1" }, { k:"marte", n:"Marte", x:146, r:6, c:"#C1440E" },
  { k:"jupiter", n:"Júpiter", x:196, r:21, c:"#D9A066" }, { k:"saturno", n:"Saturno", x:262, r:16, c:"#E4C98B" }, { k:"urano", n:"Urano", x:320, r:11.5, c:"#8FDDE0" }, { k:"netuno", n:"Netuno", x:360, r:11, c:"#3F5FD9" }
];
function sistemaSolar(chave, rev){
  const Y = 78, alvo = k => rev && (chave === k || chave === "todos" || (chave === "rochosos" && ["mercurio", "venus", "terra", "marte"].includes(k)));
  let s = '<rect width="400" height="150" rx="12" fill="#0B1533"/>';
  [[30, 20], [90, 130], [150, 18], [230, 132], [300, 22], [345, 128], [385, 40], [120, 112], [270, 30], [200, 20]].forEach(p => { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1" fill="#fff" opacity=".7"/>'; });
  s += '<circle cx="-22" cy="' + Y + '" r="62" fill="#FFC93C"/><circle cx="-22" cy="' + Y + '" r="68" fill="none" stroke="#FFC93C" stroke-width="3" opacity=".35"/>';
  if(rev && (chave === "sol" || chave === "todos")) s += '<text x="14" y="' + (Y + 4) + '" text-anchor="middle" font-size="11" fill="#5c3b00" ' + F + ">Sol</text>";
  PLANETAS.forEach((p, i) => {
    if(p.k === "saturno") s += '<ellipse cx="' + p.x + '" cy="' + Y + '" rx="' + (p.r + 12) + '" ry="5.5" fill="none" stroke="#CBB27A" stroke-width="3.5" transform="rotate(-14 ' + p.x + " " + Y + ')"/>';
    s += '<circle cx="' + p.x + '" cy="' + Y + '" r="' + p.r + '" fill="' + p.c + '"/>';
    if(p.k === "terra") s += '<path d="M' + (p.x - 4) + " " + (Y - 4) + ' q4 -3 6 1 q-1 4 -4 3 z M' + (p.x + 1) + " " + (Y + 2) + ' q3 0 3 3 q-3 2 -4 -1 z" fill="#4CAF50"/>';
    if(p.k === "jupiter") s += '<path d="M' + (p.x - 19) + " " + (Y - 7) + " h38 M" + (p.x - 20.5) + " " + (Y + 3) + " h41 M" + (p.x - 17) + " " + (Y + 11) + ' h34" stroke="#B5763A" stroke-width="3" opacity=".7"/><ellipse cx="' + (p.x + 8) + '" cy="' + (Y + 6) + '" rx="5" ry="3" fill="#B5432A"/>';
    if(p.k === "saturno") s += '<path d="M' + (p.x - 26.5) + " " + (Y + 6.6) + " A" + (p.r + 12) + " 5.5 -14 0 0 " + (p.x + 26.5) + " " + (Y - 6.6) + '" fill="none" stroke="#CBB27A" stroke-width="3.5"/>';
    if(alvo(p.k)){ const cima = i % 2 === 0, ly = cima ? Y - p.r - 9 : Y + p.r + 17;
      s += '<circle cx="' + p.x + '" cy="' + Y + '" r="' + (p.r + 4) + '" fill="none" stroke="#FFE45C" stroke-width="2"/><text x="' + p.x + '" y="' + ly + '" text-anchor="middle" font-size="10.5" fill="#fff" ' + F + ">" + p.n + "</text>"; }
  });
  s += '<text x="392" y="144" text-anchor="end" font-size="7.5" fill="#9fb3d9" font-family="Fredoka, sans-serif">tamanhos e distâncias fora de escala</text>';
  return '<svg viewBox="0 0 400 150" width="640" height="240" role="img" aria-label="Esquema do Sistema Solar: o Sol e os oito planetas em ordem">' + s + "</svg>";
}

/* ---------- Corpo humano: tronco em esquema, de frente (o lado esquerdo da pessoa fica à direita de quem olha). ---------- */
// tipo "nutricao": digestório e respiratório. tipo "circulacao": coração, vasos, pulmões e rins.
// nome, ponto apontado (x, y) e posição do rótulo (x, y). Rótulo à esquerda começa na margem; à direita, termina na margem.
const ROT = { boca:["Boca", 150, 66, 290, 58], esofago:["Esôfago", 150, 112, 290, 100], pulmoes:["Pulmões", 112, 150, 10, 128], diafragma:["Diafragma", 150, 201, 290, 190], estomago:["Estômago", 172, 222, 290, 222],
  delgado:["Intestino delgado", 150, 288, 290, 300], grosso:["Intestino grosso", 112, 280, 10, 258], coracao:["Coração", 162, 160, 290, 146], rins:["Rins", 108, 238, 10, 226], arterias:["Artérias", 156, 250, 290, 262], veias:["Veias", 144, 262, 10, 280] };
function corpo(tipo){
  return function(chave, rev){
    const on = k => rev && chave === k, dest = k => on(k) ? ' stroke="#FFB000" stroke-width="4"' : ' stroke="' + T + '" stroke-width="1.6"';
    let s = '<rect width="300" height="350" rx="14" fill="#F4F8FC"/>';
    // silhueta neutra
    s += '<path d="M150 14 a32 32 0 0 1 32 32 a32 32 0 0 1 -18 28 v12 c40 6 62 20 66 54 l8 96 h-26 l-8 -66 v170 h-108 v-170 l-8 66 h-26 l8 -96 c4 -34 26 -48 66 -54 v-12 a32 32 0 0 1 -18 -28 a32 32 0 0 1 32 -32z" fill="#DCE6F1" stroke="#B8C7D9" stroke-width="2"/>';
    if(tipo === "nutricao"){
      s += '<path d="M150 70 V200" fill="none" stroke="#C97B5A" stroke-width="5" stroke-linecap="round"' + (on("esofago") ? ' style="stroke:#FFB000;stroke-width:8"' : "") + "/>";          // esôfago (atrás da traqueia)
      s += '<path d="M150 78 V128 M150 128 q-14 4 -24 16 M150 128 q14 4 24 16" fill="none" stroke="#7FA8D9" stroke-width="5" stroke-linecap="round"/>';                                    // traqueia e brônquios
      s += '<path d="M124 118 c-24 6 -30 44 -26 72 c18 8 34 4 40 -6 v-56 c0 -8 -6 -12 -14 -10z" fill="#F4A7B5"' + dest("pulmoes") + '/><path d="M176 118 c24 6 30 44 26 72 c-18 8 -34 4 -40 -6 v-56 c0 -8 6 -12 14 -10z" fill="#F4A7B5"' + dest("pulmoes") + "/>";
      s += '<path d="M92 204 q58 -20 116 0" fill="none" stroke="#B5533C" stroke-width="' + (on("diafragma") ? 7 : 4) + '" stroke-linecap="round"' + (on("diafragma") ? ' style="stroke:#FFB000"' : "") + "/>";
      s += '<path d="M150 204 c22 -4 44 6 42 26 c-2 16 -22 22 -40 14 c-6 -4 -4 -12 2 -14 c8 -4 4 -18 -4 -26z" fill="#F2B880"' + dest("estomago") + "/>";
      s += '<path d="M112 322 V262 q0 -10 10 -10 h56 q10 0 10 10 V322" fill="none" stroke="' + (on("grosso") ? "#FFB000" : "#B07A4B") + '" stroke-width="' + (on("grosso") ? 15 : 12) + '" stroke-linecap="round" stroke-linejoin="round"/>';
      s += '<path d="M130 270 h40 q8 0 8 7 t-8 7 h-40 q-8 0 -8 7 t8 7 h40 q8 0 8 7 t-8 7 h-34" fill="none" stroke="' + (on("delgado") ? "#FFB000" : "#E59A8F") + '" stroke-width="' + (on("delgado") ? 9 : 7) + '" stroke-linecap="round"/>';
      s += '<ellipse cx="150" cy="66" rx="9" ry="4.5" fill="#D64B5E"' + dest("boca") + "/>";
    }else{
      const A = on("arterias") ? ' style="stroke-width:6"' : "", V = on("veias") ? ' style="stroke-width:6"' : "";
      s += '<path d="M124 118 c-24 6 -30 44 -26 72 c18 8 34 4 40 -6 v-56 c0 -8 -6 -12 -14 -10z" fill="#F7C6CF"' + dest("pulmoes") + '/><path d="M176 118 c24 6 30 44 26 72 c-18 8 -34 4 -40 -6 v-56 c0 -8 6 -12 14 -10z" fill="#F7C6CF"' + dest("pulmoes") + "/>";
      s += '<path d="M156 176 V320 M156 120 V60 M156 110 q40 4 62 40 l8 70 M156 110 q-36 4 -70 40 l-8 70" fill="none" stroke="#D62839" stroke-width="3.5" stroke-linecap="round"' + A + "/>";       // artérias (vermelho)
      s += '<path d="M144 176 V320 M144 120 V60 M144 116 q38 6 68 44 l6 60 M144 116 q-34 6 -64 44 l-6 60" fill="none" stroke="#2F6FD1" stroke-width="3.5" stroke-linecap="round"' + V + "/>";      // veias (azul)
      s += '<path d="M112 222 c-10 0 -14 10 -12 20 c2 10 10 14 16 10 c4 -4 0 -8 0 -14 c0 -6 4 -12 -4 -16z" fill="#A6543C"' + dest("rins") + '/><path d="M188 222 c10 0 14 10 12 20 c-2 10 -10 14 -16 10 c-4 -4 0 -8 0 -14 c0 -6 -4 -12 4 -16z" fill="#A6543C"' + dest("rins") + "/>";
      s += '<path d="M162 144 c8 -10 24 -4 22 10 c-2 12 -14 20 -24 28 c-8 -8 -18 -16 -18 -28 c0 -12 14 -18 20 -10z" fill="#E63946"' + dest("coracao") + "/>";
    }
    if(rev && ROT[chave]){ const r = ROT[chave], esq = r[3] < 150, lx = esq ? r[3] + 30 : r[3] - 30;
      s += '<path d="M' + r[1] + " " + r[2] + " L" + lx + " " + (r[4] + 4) + '" stroke="' + T + '" stroke-width="1.5"/><circle cx="' + r[1] + '" cy="' + r[2] + '" r="3" fill="' + T + '"/>' + nome(r[3], r[4], r[0], esq ? "start" : "end"); }
    return '<svg viewBox="0 0 300 350" width="330" height="385" role="img" aria-label="' + (tipo === "nutricao" ? "Esquema dos sistemas digestório e respiratório" : "Esquema do sistema circulatório, com pulmões e rins") + '">' + s + "</svg>";
  };
}
window.PDEEsquemas = { sistemaSolar, corpo };
})();
