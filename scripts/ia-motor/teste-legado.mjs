// Prova de que o motor novo do IA Studio não perdeu nada: no modo legado ele precisa gerar,
// caractere por caractere, o mesmo comando que as ferramentas antigas geravam (referências colhidas delas).
//   node scripts/ia-motor/teste-legado.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const { montar, tipoDe } = await import(path.join(aqui, '../../apps/ia-studio/motor.js'));
let ok = 0, falha = 0;
const conferir = (nome, t, esperado) => { if(t === esperado) ok++; else { falha++; let i = 0; while(t[i] === esperado[i]) i++; console.log('FALHA', nome, 'na posição', i, JSON.stringify(esperado.slice(i - 40, i + 60))); } };
for(const a of ['ciencias', 'matematica', 'historia']){
  const ref = JSON.parse(fs.readFileSync(path.join(aqui, 'ref_atividades-de-' + a + '.json'), 'utf8'));
  for(const [k, esperado] of Object.entries(ref)){
    const [modo, vari] = k.split('__'), tipo = tipoDe(a, modo), campos = {};
    for(const c of tipo.campos){ if(c.tipo === 'select') campos[c.id] = c.padrao || c.ops[0][0]; else if(c.tipo === 'texto') campos[c.id] = c.obrig ? '[OBRIG ' + c.id + ']' : ''; }
    const p = { area:a, tipo:modo, campos, chips:{}, serie:vari === 'serie3' ? '3º Ano' : '6º Ano', orient:vari === 'paisagem' ? 'paisagem' : 'retrato', cor:vari === 'pb' ? 'pb' : 'colorido',
      incl:vari === 'tea' ? 'tea' : '', roteiro:vari === 'roteiro', temaLivre:vari === 'livre' ? 'a água na nossa cidade' : '' };
    conferir(a + ':' + k, montar(p, { legado:true }), esperado);
  }
}
for(const k of JSON.parse(fs.readFileSync(path.join(aqui, 'ref2.json'), 'utf8'))){
  const tipo = tipoDe(k.a, k.modo), campos = {};
  for(const c of tipo.campos){ if(c.tipo === 'select') campos[c.id] = c.padrao || c.ops[0][0]; else if(c.tipo === 'texto') campos[c.id] = ''; }
  for(const [id, v] of Object.entries(k.campos)){ if(!id.startsWith('i-') && id !== 'tema-livre'){ const c = tipo.campos.find(x => x.id === id); campos[id] = c && c.tipo === 'select' ? (c.ops.find(o => o[0] === v || o[1] === v || o[1].startsWith(v)) || [v])[0] : v; } }
  const p = { area:k.a, tipo:k.modo, campos, chips:k.chips, serie:k.campos['i-serie'] || '6º Ano', orient:'retrato', cor:k.campos['i-cor'] === 'Preto' ? 'pb' : 'colorido',
    incl:k.campos['i-incl'] || '', roteiro:k.campos['i-roteiro'] === 'Sim', temaLivre:k.campos['tema-livre'] || '' };
  conferir(k.a + ':' + k.modo + ' (variado)', montar(p, { legado:true }), k.t);
}
console.log('motor legado idêntico às ferramentas antigas:', ok, 'ok,', falha, 'falha(s)');
process.exit(falha ? 1 : 0);
