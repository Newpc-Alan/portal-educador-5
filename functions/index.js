import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, FieldPath } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { randomBytes, randomInt } from 'node:crypto';
import { idValido, minimoAula, videoAtualizado, projecaoPublica, pendenciasPublicacao } from './domain.js';
export { emailDicaProfessor, emailNovoCadastro, emailCertificadoEmitido, emailRelatorioEnviado, emailPreCadastros, emailResumoDiario, emailDicaAluno } from './dicas.js';
export { importarBiblioteca } from './biblioteca.js';
export { sincronizarAtividades } from './atividades.js';
export { publicarProvaOnline, iniciarProvaOnline, entregarProvaOnline, acaoProvaOnline, fecharProvasOnline, aplicarRecuperacao, corrigirProvaOnline } from './provas-online.js';
export { limparFotosProvas } from './fotos-provas.js';
initializeApp();
const db = getFirestore();
setGlobalOptions({ region:'southamerica-east1', maxInstances:10 });
const login = req => { if (!req.auth) throw new HttpsError('unauthenticated','Entre na sua conta para continuar.'); return req.auth.uid; };
const equipe = req => { const uid=login(req); if (!['admin','editor'].includes(req.auth.token.papel)) throw new HttpsError('permission-denied','Acesso restrito à equipe.'); return uid; };
const admin = req => { const uid=login(req); if(req.auth.token.papel!=='admin') throw new HttpsError('permission-denied','Acesso restrito ao administrador.'); return uid; };
const id = (v,n='Identificador') => { if(!idValido(v)) throw new HttpsError('invalid-argument',`${n} inválido.`); return v; };
const fail = msg => { throw new HttpsError('failed-precondition',msg); };
// Portal do Educador 5.0: a Formação segue a licença do professor (mesma lógica do Portal e das regras).
async function exigirLicenca(uid){
  const u=(await db.doc(`usuarios/${uid}`).get()).data();
  if(!u || u.status!=='ativo') fail('Seu acesso ao Portal do Educador não está ativo.');
  if(u.perfil==='admin') return u;
  const ms = v => v && typeof v.toMillis==='function' ? v.toMillis() : 0;
  const tipo=u.licenca_tipo||'institucional';
  if(tipo==='institucional'){
    if(!u.escola_id || !u.municipio_id) fail('Seu cadastro ainda não está vinculado a uma escola. Fale com a secretaria.');
    const m=(await db.doc(`municipios/${u.municipio_id}`).get()).data()||{};
    const fim=ms(m.vigencia_fim_ts); if(fim && fim<Date.now()) fail('O contrato do seu município com o Portal está vencido.');
    const plano=m.modulos_professor, extra=Array.isArray(u.modulos_extra) && u.modulos_extra.includes('formacao');   // liberação exclusiva do professor (só o admin grava)
    if(!extra && Array.isArray(plano) && plano.length && !plano.includes('formacao')) fail('A Formação Continuada não faz parte do plano do seu município.');
    return u;
  }
  const fim=ms(u.licenca_fim); if(!fim || fim<Date.now()) fail('Sua licença do Portal do Educador expirou.');
  // licença avulsa no pacote Básico não inclui a Formação (Intermediário e Completo incluem), salvo liberação exclusiva do admin
  const extraF=Array.isArray(u.modulos_extra) && u.modulos_extra.includes('formacao');
  if(u.plano_avulso==='basico' && !extraF) fail('A Formação Continuada não faz parte do pacote da sua licença.');
  return u;
}
const arr = snap => snap.docs.map(d=>({ ...d.data(), id:d.id }));
const carimbo = () => FieldValue.serverTimestamp();
const audit = (tx, uid, acao, dados) => tx.create(db.collection('auditoria').doc(),{uid,acao,...dados,em:carimbo()});
const embaralhar = valores => { const a=[...valores]; for(let i=a.length-1;i>0;i--){const j=randomInt(i+1); [a[i],a[j]]=[a[j],a[i]];} return a; };
// Alfabeto sem caracteres ambíguos: alguém vai digitar isto a partir de papel
// impresso. Sem I, O, 0 e 1. Seis posições dão mais de 1 bilhão de combinações,
// e a unicidade é garantida pelo tx.create, que falha se o código já existir.
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codigoCurto = () => Array.from({length:6},()=>ABC[randomInt(ABC.length)]).join('');
const CPF = v => String(v || '').replace(/\D/g,'');
function cpfValido(v) { const c=CPF(v); if(c.length!==11 || /^(\d)\1{10}$/.test(c))return false; const dv=n=>{let s=0;for(let i=0;i<n;i++)s+=Number(c[i])*(n+1-i);const r=(s*10)%11;return r===10?0:r;};return dv(9)===Number(c[9])&&dv(10)===Number(c[10]); }
async function contexto(tx, uid, cursoId) {
  const ref=db.doc(`cursos/${cursoId}`), progRef=db.doc(`users/${uid}/progresso/${cursoId}`);
  const [c,p,a,m]=await Promise.all([tx.get(ref),tx.get(progRef),tx.get(ref.collection('aulas')),tx.get(ref.collection('modulos'))]);
  if(!c.exists || c.data().status!=='publicado') fail('Este curso não está disponível.');
  return {ref,progRef,curso:c.data(),prog:p.data() || {},aulas:arr(a),modulos:arr(m)};
}
function exigirConclusao(x) {
  // A lista verificada só pode ser escrita por estas funções. Progresso antigo
  // continua visível, mas novas certificações exigem validação das aulas.
  const feitas=new Set(x.prog.aulasVerificadas || []);
  if(!x.aulas.length || x.aulas.some(a=>!feitas.has(a.id))) fail('Conclua as aulas com o acompanhamento atualizado antes de abrir a avaliação.');
}
function exigirModulo(x,aula) {
  const feitas=new Set(x.prog.aulasVerificadas || []);
  for(const m of [...x.modulos].sort((a,b)=>(a.ordem||0)-(b.ordem||0))){
    if(m.id===aula.moduloId)return;
    if(x.aulas.some(a=>a.moduloId===m.id && !feitas.has(a.id)))fail('Conclua o módulo anterior primeiro.');
  }
  fail('A aula não está vinculada a um módulo válido.');
}

// Uma sessão por curso/aluno, com token rotativo: duas abas não acumulam tempo.
export const iniciarAula = onCall(async req => {
  const uid=login(req), cursoId=id(req.data?.cursoId), aulaId=id(req.data?.aulaId);
  await exigirLicenca(uid);
  const token=randomBytes(20).toString('hex');
  return db.runTransaction(async tx=>{
    const x=await contexto(tx,uid,cursoId), aula=x.aulas.find(a=>a.id===aulaId);
    if(!aula)fail('Aula não encontrada.'); exigirModulo(x,aula);
    const ref=db.doc(`users/${uid}/sessoes/${cursoId}`), prev=await tx.get(ref);
    const anterior=prev.data(), agora=Date.now();
    const sessao={aulaId,token,ultimoMs:agora,segundos:anterior?.aulaId===aulaId ? anterior.segundos||0 : 0,
      videos:anterior?.aulaId===aulaId ? anterior.videos||{} : {},
      minimo:minimoAula(aula),idsAulas:x.aulas.map(a=>a.id),videosAula:(aula.videos||[]).map(v=>({youtubeId:v.youtubeId}))};
    // Pausa entre acessos nunca conta como reprodução.
    for(const v of Object.values(sessao.videos))v.tocando=false;
    tx.set(ref,sessao);
    tx.set(x.progRef,{ultimaAula:aulaId,ultimoAcessoISO:new Date(agora).toISOString(),...(!x.prog.iniciadoServidorISO?{iniciadoServidorISO:new Date(agora).toISOString()}:{}),atualizadoEm:carimbo()},{merge:true});
    return {token,segundos:sessao.segundos,minimo:minimoAula(aula),videos:sessao.videos,
      concluida:(x.prog.aulasVerificadas||[]).includes(aulaId)};
  });
});
export const acompanharAula = onCall(async req => {
  const uid=login(req), cursoId=id(req.data?.cursoId), aulaId=id(req.data?.aulaId);
  return db.runTransaction(async tx=>{
    const ref=db.doc(`users/${uid}/sessoes/${cursoId}`),progRef=db.doc(`users/${uid}/progresso/${cursoId}`);
    const [snap,progSnap,cursoSnap]=await Promise.all([tx.get(ref),tx.get(progRef),tx.get(db.doc(`cursos/${cursoId}`))]);
    const s=snap.data();
    if(!cursoSnap.exists || cursoSnap.data().status!=='publicado')fail('Este curso não está disponível.');
    // Conteúdo publicado é imutável. Reutilizar o contexto da sessão reduz leituras.
    const aula={videos:s?.videosAula||[]};
    const x={progRef,prog:progSnap.data()||{},aulas:(s?.idsAulas||[]).map(id=>({id}))};
    if(!s || s.aulaId!==aulaId || s.token!==req.data?.token)fail('A aula foi aberta em outra aba. Reabra esta página para continuar aqui.');
    const agora=Date.now(), decorrido=Math.max(0,(agora-s.ultimoMs)/1000);
    const amostra=req.data?.video, videos=s.videos||{};
    let credito=0;
    if(amostra){
      if(!(aula.videos||[]).some(v=>v.youtubeId===amostra.id))fail('Vídeo não pertence a esta aula.');
      try {
        const ant=videos[amostra.id]||{};
        const novo=videoAtualizado(ant,amostra,decorrido);
        if(req.data.ativo===true)credito=Math.min(60,decorrido,Math.max(0,novo.assistido-(ant.assistido||0)));
        videos[amostra.id]=novo;
      }catch{throw new HttpsError('invalid-argument','Amostra de reprodução inválida.');}
    } else if(!aula.videos?.length && req.data.ativo===true)credito=Math.min(60,decorrido);
    const segundos=(s.segundos||0)+credito;
    const videosOk=(aula.videos||[]).every(v=>{const d=videos[v.youtubeId];return d && d.assistido>=d.duracao*0.9;});
    const pronta=segundos>=s.minimo&&videosOk;
    let prog=x.prog;
    if(req.data.concluir===true && pronta){
      const validos=new Set(x.aulas.map(a=>a.id));
      const verificadas=[...new Set([...(prog.aulasVerificadas||[]),aulaId])].filter(a=>validos.has(a));
      const aulas=[...new Set([...(prog.aulas||[]),aulaId])].filter(a=>validos.has(a));
      const completo=verificadas.length===x.aulas.length;
      prog={...prog,aulas,aulasVerificadas:verificadas,percentual:Math.round(verificadas.length/x.aulas.length*100),
        concluido:completo,progressoVersao:2,iniciadoEmISO:prog.iniciadoServidorISO || new Date(agora).toISOString(),
        concluidoEmISO:completo?((prog.progressoVersao===2 && prog.concluido===true && prog.concluidoEmISO)||new Date(agora).toISOString()):null};
      tx.set(x.progRef,{...prog,atualizadoEm:carimbo()});
    }
    tx.set(ref,{...s,ultimoMs:agora,segundos,videos});
    return {segundos,minimo:s.minimo,pronta,concluida:(prog.aulasVerificadas||[]).includes(aulaId),
      progresso:JSON.parse(JSON.stringify(prog))};
  });
});

export const sortearProva = onCall(async req=>{
  const uid=login(req), cursoId=id(req.data?.cursoId), provaRef=db.collection(`users/${uid}/provas`).doc();
  await exigirLicenca(uid);
  return db.runTransaction(async tx=>{
    const x=await contexto(tx,uid,cursoId); exigirConclusao(x);
    if(!x.curso.quizAtivo)fail('Este curso não possui avaliação.');
    const refTent=db.doc(`users/${uid}/tentativas/${cursoId}`), t=(await tx.get(refTent)).data()||{};
    if(t.aprovado)throw new HttpsError('already-exists','Você já foi aprovado.');
    const max=Number(x.curso.quizTentativasMax??3), usadas=t.tentativas||0;
    if(max>0 && usadas>=max)throw new HttpsError('resource-exhausted','Tentativas esgotadas. Procure o suporte.');
    const [q,g]=await Promise.all([tx.get(x.ref.collection('questoes')),tx.get(x.ref.collection('gabarito'))]);
    const mapa=Object.fromEntries(g.docs.map(d=>[d.id,d.data()]));
    const antigas=await tx.get(db.collection(`users/${uid}/provas`).where('cursoId','==',cursoId).where('respondida','==',false).orderBy('criadaEm','desc').limit(1));
    const aberta=antigas.docs[0], d=aberta?.data();
    const agora=Date.now();
    const resposta=p=>({provaId:p.id,questoes:p.questoesExibidas,notaCorte:p.notaCorte,tentativasMax:p.tentativasMax,
      tentativasUsadas:usadas,expiraEmISO:p.expiraEmISO,respostas:p.rascunho||{}});
    if(d && new Date(d.expiraEmISO).getTime()>agora && d.versao===2)return {...resposta({...d,id:aberta.id}),reaberta:true};
    if(max>0 && (t.sorteios||0)>=max+2)throw new HttpsError('resource-exhausted','Limite de aberturas atingido. Procure o suporte.');
    if(t.ultimoSorteioMs && agora-t.ultimoSorteioMs<30000)throw new HttpsError('resource-exhausted','Aguarde 30 segundos antes de abrir outra avaliação.');
    const banco=arr(q), erros=pendenciasPublicacao(x.curso,x.modulos,x.aulas,banco,mapa);
    if(erros.length)fail('A avaliação precisa de revisão pela equipe: '+erros.slice(0,3).join(' '));
    const escolhidas=embaralhar(banco).slice(0,Number(x.curso.quizPorProva??10));
    const itens=escolhidas.map(q=>({questaoId:q.id,ordem:embaralhar(q.alternativas.map((_,i)=>i)),correta:Number(mapa[q.id].correta),explicacao:mapa[q.id].explicacao||''}));
    const questoesExibidas=escolhidas.map((q,i)=>({id:q.id,enunciado:q.enunciado,alternativas:itens[i].ordem.map(k=>q.alternativas[k])}));
    const p={uid,cursoId,itens,questoesExibidas,notaCorte:Number(x.curso.quizNotaCorte??70),tentativasMax:max,
      versao:2,respondida:false,criadaEm:carimbo(),expiraEmISO:new Date(agora+90*60000).toISOString(),rascunho:{}};
    if(aberta)tx.set(aberta.ref,{respondida:true,expirada:true},{merge:true});
    tx.create(provaRef,p);
    tx.set(refTent,{...t,cursoId,sorteios:(t.sorteios||0)+1,ultimoSorteioMs:agora},{merge:true});
    return {...resposta({...p,id:provaRef.id}),reaberta:false};
  });
});
function respostasValidas(p,respostas,completa=false){
  if(!respostas || typeof respostas!=='object' || Array.isArray(respostas))throw new HttpsError('invalid-argument','Respostas inválidas.');
  if(Object.keys(respostas).some(k=>!p.itens.some(i=>i.questaoId===k)))throw new HttpsError('invalid-argument','Questão inválida.');
  for(const item of p.itens){const r=respostas[item.questaoId];if(r===undefined && !completa)continue;
    if(!Number.isInteger(r)||r<0||r>=item.ordem.length)throw new HttpsError('invalid-argument','Responda todas as questões com alternativas válidas.');}
}
export const salvarRespostas = onCall(async req=>{
  const uid=login(req), provaId=id(req.data?.provaId), ref=db.doc(`users/${uid}/provas/${provaId}`);
  return db.runTransaction(async tx=>{
    const p=(await tx.get(ref)).data();if(!p || p.uid!==uid || p.versao!==2)fail('Reabra a avaliação.');
    if(p.respondida || Date.parse(p.expiraEmISO)<=Date.now())fail('Esta avaliação foi encerrada.');
    respostasValidas(p,req.data.respostas);
    tx.update(ref,{rascunho:req.data.respostas,rascunhoEm:carimbo()});return {ok:true};
  });
});
export const corrigirQuiz = onCall(async req=>{
  const uid=login(req), provaId=id(req.data?.provaId), ref=db.doc(`users/${uid}/provas/${provaId}`);
  return db.runTransaction(async tx=>{
    const p=(await tx.get(ref)).data();if(!p || p.uid!==uid)throw new HttpsError('not-found','Prova não encontrada.');
    if(p.resultadoFinal)return p.resultadoFinal; // Reenvio após perda da resposta é seguro.
    if(p.versao!==2)fail('Reabra a avaliação para usar a versão atualizada.');
    if(p.respondida || Date.parse(p.expiraEmISO)<=Date.now())throw new HttpsError('deadline-exceeded','A prova foi encerrada. Abra uma nova tentativa.');
    respostasValidas(p,req.data.respostas,true);
    const refTent=db.doc(`users/${uid}/tentativas/${p.cursoId}`), t=(await tx.get(refTent)).data()||{};
    if(t.aprovado)fail('Você já foi aprovado.');
    if(p.tentativasMax>0 && (t.tentativas||0)>=p.tentativasMax)fail('Tentativas esgotadas.');
    const detalhes=p.itens.map(i=>({questaoId:i.questaoId,acertou:i.ordem[req.data.respostas[i.questaoId]]===i.correta,
      corretaExibida:i.ordem.indexOf(i.correta),explicacao:i.explicacao}));
    const acertos=detalhes.filter(d=>d.acertou).length,total=detalhes.length,nota=Math.round(acertos/total*100),aprovado=nota>=p.notaCorte,usadas=(t.tentativas||0)+1;
    const r={nota,acertos,total,aprovado,notaCorte:p.notaCorte,tentativasUsadas:usadas,tentativasMax:p.tentativasMax,
      tentativasRestantes:p.tentativasMax>0?Math.max(0,p.tentativasMax-usadas):null,
      detalhes:aprovado?detalhes:detalhes.map(d=>({questaoId:d.questaoId,acertou:d.acertou}))};
    const quandoISO=new Date().toISOString();
    tx.update(ref,{respondida:true,respondidaEmISO:quandoISO,resultadoFinal:r,respostas:req.data.respostas});
    tx.set(refTent,{...t,cursoId:p.cursoId,tentativas:usadas,ultimaNota:nota,melhorNota:Math.max(t.melhorNota||0,nota),aprovado,
      aprovadoEmISO:aprovado?quandoISO:null,ultimaEmISO:quandoISO,registros:[...(t.registros||[]).slice(-49),{provaId,nota,acertos,total,aprovado,quandoISO}]},{merge:true});
    return r;
  });
});
export const emitirCertificado = onCall(async req=>{
  const uid=login(req), cursoId=id(req.data?.cursoId), codigo=`AE-${new Date().getFullYear()}-${codigoCurto()}`;
  await exigirLicenca(uid);
  return db.runTransaction(async tx=>{
    const lock=db.doc(`users/${uid}/emissoes/${cursoId}`), l=(await tx.get(lock)).data();
    const existentes=await tx.get(db.collection('certificados').where('uid','==',uid).where('cursoId','==',cursoId).limit(1));
    if(l || !existentes.empty){
      const snap=l?await tx.get(db.doc(`certificados/${l.codigo}`)):existentes.docs[0];
      if(!snap.exists)fail('Registro de emissão inconsistente. Procure o suporte.');
      if(snap.data().ativo===false)fail('Este certificado foi revogado. Procure o suporte.');
      if(!l)tx.create(lock,{codigo:snap.id});
      return {codigo:snap.id,...snap.data(),reaproveitado:true};
    }
    const x=await contexto(tx,uid,cursoId);exigirConclusao(x);
    const perfil=(await tx.get(db.doc(`users/${uid}`))).data()||{};
    const t=(await tx.get(db.doc(`users/${uid}/tentativas/${cursoId}`))).data()||{};
    if(x.curso.quizAtivo && !t.aprovado)fail('É preciso ser aprovado na avaliação final.');
    const nome=String(perfil.nome||'').trim(),cpf=CPF(perfil.cpf);
    if(nome.length<3 || nome.length>160 || !nome.includes(' '))fail('Preencha seu nome completo.');
    if(!cpfValido(cpf))fail('Confira o CPF no seu cadastro.');
    // Um CPF pertence a uma conta só. Sem isto, bastaria preencher o perfil com
    // o CPF de outra pessoa, concluir o curso e emitir um certificado autêntico
    // em nome dela. O registro é criado na primeira emissão e não sai mais.
    const cpfRef=db.doc(`cpfs/${cpf}`), cpfDono=(await tx.get(cpfRef)).data();
    if(cpfDono && cpfDono.uid!==uid)
      fail('Este CPF já está vinculado a outra conta da Academia. Se o CPF é seu, escreva para suporte@portaldoeducador.com.br.');
    const ref=db.doc(`certificados/${codigo}`);if((await tx.get(ref)).exists)throw new HttpsError('aborted','Tente emitir novamente.');
    const programa=x.modulos.sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(m=>({modulo:m.titulo||'',aulas:x.aulas.filter(a=>a.moduloId===m.id).sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(a=>a.titulo||'')}));
    const c={uid,nome,cpf,cpfMascarado:`***.${cpf.slice(3,6)}.${cpf.slice(6,9)}-**`,email:req.auth.token.email||'',cursoId,
      cursoTitulo:x.curso.titulo,cargaHoraria:Number(x.curso.horas||0),municipio:perfil.municipio||'',escola:perfil.escola||'',
      notaFinal:x.curso.quizAtivo?t.melhorNota:null,periodoInicioISO:x.prog.iniciadoServidorISO||x.prog.iniciadoEmISO,
      periodoFimISO:x.prog.concluidoEmISO,programa,totalAulas:x.aulas.length,emitidoEmISO:new Date().toISOString(),ativo:true,
      versaoCurso:Number(x.curso.versao||1)};
    tx.create(ref,{...c,emitidoEm:carimbo()});tx.create(lock,{codigo});if(!cpfDono)tx.create(cpfRef,{uid,em:carimbo()});audit(tx,uid,'emitirCertificado',{codigo,cursoId});
    return {codigo,...c,reaproveitado:false};
  });
});
// A coleção completa é privada. Consulta pública apenas por código exato.
export const consultarCertificado = onCall({maxInstances:3},async req=>{
  const codigo=String(req.data?.codigo||'').trim().toUpperCase();
  if(!/^AE-\d{4}-(?:[A-Z0-9]{6}|[A-F0-9]{12})$/.test(codigo))throw new HttpsError('invalid-argument','Código inválido.');
  const d=await db.doc(`certificados/${codigo}`).get();
  return d.exists?{encontrado:true,certificado:projecaoPublica(d.data())}:{encontrado:false};
});
export const revogarCertificado = onCall(async req=>{
  const uid=admin(req), codigo=id(req.data?.codigo),motivo=String(req.data?.motivo||'').trim();
  if(motivo.length<5 || motivo.length>1000)fail('Informe o motivo da revogação (5 a 1.000 caracteres).');
  return db.runTransaction(async tx=>{const ref=db.doc(`certificados/${codigo}`);if(!(await tx.get(ref)).exists)fail('Certificado não encontrado.');
    tx.update(ref,{ativo:false,revogadoEm:carimbo(),revogadoPor:uid,motivoRevogacao:motivo});audit(tx,uid,'revogarCertificado',{codigo,motivo});return {ok:true};});
});
export const obterGabarito = onCall(async req=>{
  equipe(req);const snap=await db.collection(`cursos/${id(req.data?.cursoId)}/gabarito`).get();return {gabarito:Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]))};
});
export const definirPapel = onCall(async req=>{
  const autor=admin(req),{email,papel}=req.data||{};
  if(!['admin','editor','nenhum'].includes(papel)||typeof email!=='string')throw new HttpsError('invalid-argument','Papel ou e-mail inválido.');
  let u;try{u=await getAuth().getUserByEmail(email.trim());}catch{fail('Peça ao usuário para entrar na Academia primeiro.');}
  if(u.uid===autor && papel!=='admin')fail('Outro administrador deve alterar seu acesso.');
  const claims={...u.customClaims};if(papel==='nenhum')delete claims.papel;else claims.papel=papel;
  await getAuth().setCustomUserClaims(u.uid,claims);
  const batch=db.batch(),ref=db.doc(`equipe/${u.uid}`);
  if(papel==='nenhum')batch.delete(ref);else batch.set(ref,{email:u.email,papel,nome:u.displayName||'',atualizadoEm:carimbo()},{merge:true});
  batch.create(db.collection('auditoria').doc(),{uid:autor,acao:'definirPapel',alvo:u.uid,papel,em:carimbo()});await batch.commit();
  return {ok:true,uid:u.uid,papel};
});
export const publicarCurso = onCall(async req=>{
  const uid=equipe(req),cursoId=id(req.data?.cursoId),status=req.data?.status;
  if(!['rascunho','revisao','publicado','arquivado'].includes(status))throw new HttpsError('invalid-argument','Situação inválida.');
  if(status!=='revisao')admin(req);
  return db.runTransaction(async tx=>{
    const ref=db.doc(`cursos/${cursoId}`),s=await tx.get(ref);if(!s.exists)fail('Curso não encontrado.');
    const c=s.data();if(req.auth.token.papel!=='admin' && c.status==='publicado')fail('Somente administrador altera um curso publicado.');
    let totalAulas=Number(c.totalAulas||0);
    if(status==='publicado'){
      const [m,a,q,g]=await Promise.all(['modulos','aulas','questoes','gabarito'].map(n=>tx.get(ref.collection(n))));
      totalAulas=a.size;
      const erros=pendenciasPublicacao(c,arr(m),arr(a),arr(q),Object.fromEntries(g.docs.map(d=>[d.id,d.data()])));
      if(erros.length)fail(erros.slice(0,8).join('\n'));
    }
    tx.update(ref,{status,totalAulas,atualizadoEm:carimbo(),...((c.status==='publicado'||c.publicadoEm||status==='publicado')?{historicoPublicado:true}:{}),
      ...(status==='publicado'?{publicadoEm:c.publicadoEm||new Date().toISOString()}: {})});
    audit(tx,uid,'situacaoCurso',{cursoId,status});return {ok:true};
  });
});
export const duplicarCurso = onCall(async req=>{
  const uid=equipe(req),cursoId=id(req.data?.cursoId),novo=db.collection('cursos').doc();
  return db.runTransaction(async tx=>{
    const ref=db.doc(`cursos/${cursoId}`),s=await tx.get(ref);if(!s.exists)fail('Curso não encontrado.');
    const subs=await Promise.all(['modulos','aulas','questoes','gabarito'].map(async n=>[n,await tx.get(ref.collection(n))]));
    if(subs.reduce((n,[,s])=>n+s.size,0)>440)fail('Curso grande: solicite a cópia à equipe técnica.');
    const c={...s.data()};delete c.publicadoEm;delete c.historicoPublicado;
    c.status='rascunho';c.versao=Number(c.versao||1)+1;c.origemId=cursoId;c.titulo=`${String(c.titulo||'').replace(/\s*\(vers[ãa]o\s*\d+\)\s*$/i,'')} (versão ${c.versao})`;
    tx.create(novo,{...c,atualizadoEm:carimbo()});
    for(const [n,s] of subs)for(const d of s.docs)tx.create(novo.collection(n).doc(d.id),d.data());
    audit(tx,uid,'duplicarCurso',{cursoId,novoId:novo.id});return {id:novo.id};
  });
});
export const excluirCurso = onCall(async req=>{
  const uid=admin(req),cursoId=id(req.data?.cursoId);
  // O que impede apagar é uso real, não histórico. Versão de teste que foi
  // publicada e ninguém cursou não deixa rastro nenhum ao sair.
  // A conferência fica fora da transação de propósito: emitirCertificado exige
  // curso publicado, e curso publicado já é recusado abaixo, então não há corrida.
  const [certs,atual]=await Promise.all([
    db.collection('certificados').where('cursoId','==',cursoId).limit(1).get(),
    db.doc(`cursos/${cursoId}`).get()]);
  if(!atual.exists)return {ok:true};
  if(atual.data().status==='publicado')fail('Curso publicado não pode ser excluído. Tire do ar primeiro: volte para rascunho ou arquive.');
  if(!certs.empty)fail('Este curso já emitiu certificado e não pode ser apagado, porque o registro do professor aponta para ele. Use Arquivar: sai do catálogo e da lista, e os certificados seguem válidos.');
  return db.runTransaction(async tx=>{
    const ref=db.doc(`cursos/${cursoId}`),s=await tx.get(ref);if(!s.exists)return {ok:true};
    const subs=await Promise.all(['modulos','aulas','questoes','gabarito'].map(n=>tx.get(ref.collection(n))));
    if(subs.reduce((n,s)=>n+s.size,0)>440)fail('Solicite a exclusão à equipe técnica.');
    for(const s of subs)for(const d of s.docs)tx.delete(d.ref);tx.delete(ref);audit(tx,uid,'excluirCurso',{cursoId});return {ok:true};
  });
});
export const relatorioAdesao = onCall({timeoutSeconds:120},async req=>{
  admin(req);const municipio=String(req.data?.municipio||'').trim().slice(0,160),cursor=req.data?.cursor;
  let q=db.collection('users').orderBy(FieldPath.documentId());if(municipio)q=q.where('municipio','==',municipio);
  if(cursor)q=q.startAfter(id(cursor));
  const snap=await q.limit(101).get(),docs=snap.docs.slice(0,100),linhas=[];
  // Lotes pequenos para manter latência e uso de recursos previsíveis.
  for(let i=0;i<docs.length;i+=10)linhas.push(...await Promise.all(docs.slice(i,i+10).map(async u=>{
    const d=u.data(),[p,cs]=await Promise.all([db.collection(`users/${u.id}/progresso`).get(),db.collection('certificados').where('uid','==',u.id).get()]);
    const ativos=cs.docs.filter(c=>c.data().ativo!==false);
    return {nome:d.nome||'',email:d.email||'',municipio:d.municipio||'',escola:d.escola||'',cargo:d.cargo||'',
      cursosIniciados:p.size,cursosConcluidos:p.docs.filter(p=>p.data().progressoVersao===2&&p.data().concluido===true).length,
      certificados:ativos.length,horasCertificadas:ativos.reduce((s,c)=>s+Number(c.data().cargaHoraria||0),0)};
  })));
  return {geradoEmISO:new Date().toISOString(),municipio:municipio||'todas as redes',linhas,
    totalProfessores:linhas.length,totalCertificados:linhas.reduce((s,l)=>s+l.certificados,0),totalHoras:linhas.reduce((s,l)=>s+l.horasCertificadas,0),
    proximoCursor:snap.size>100?docs.at(-1).id:null};
});

// Portal 5.0: no primeiro acesso à Formação, cria o perfil a partir do cadastro do Portal
// e traz os certificados emitidos na Academia antiga com o mesmo e-mail verificado.
export const vincularContaFormacao = onCall(async req=>{
  const uid=login(req);
  const u=await exigirLicenca(uid);
  const perfilRef=db.doc(`users/${uid}`), perfil=(await perfilRef.get()).data();
  let escola='', municipio='';
  if(u.escola_id){ const e=(await db.doc(`escolas/${u.escola_id}`).get()).data()||{}; escola=e.nome||''; }
  if(u.municipio_id){ const m=(await db.doc(`municipios/${u.municipio_id}`).get()).data()||{}; municipio=[m.nome,m.uf].filter(Boolean).join('/'); }
  if(!perfil){
    await perfilRef.set({ nome:String(u.nome||req.auth.token.name||'').slice(0,160), email:req.auth.token.email||'',
      municipio:(municipio||u.municipio_cad||'').slice(0,160), escola:(escola||u.escola_texto||'').slice(0,240),
      cargo:u.funcao||'Professor(a)', cpf:'', aceiteTermos:'1.0', criadoEm:carimbo() });
  }
  let movidos=0;
  const email=req.auth.token.email||'';
  if(email && req.auth.token.email_verified){
    const s=await db.collection('certificados').where('email','==',email).get();
    for(const d of s.docs){
      const c=d.data(); if(c.uid===uid) continue;
      const b=db.batch();
      b.update(d.ref,{uid,uidAnterior:c.uid});
      if(c.cursoId) b.set(db.doc(`users/${uid}/emissoes/${c.cursoId}`),{codigo:d.id},{merge:true});
      if(c.cpf) b.set(db.doc(`cpfs/${c.cpf}`),{uid,em:carimbo()},{merge:true});
      b.create(db.collection('auditoria').doc(),{uid,acao:'vincularCertificado',codigo:d.id,de:c.uid||'',em:carimbo()});
      await b.commit(); movidos++;
    }
  }
  return { ok:true, certificados:movidos, perfilCriado:!perfil };
});
export { painelUso } from './painel.js';
export { emailTvConectada, emailComunicadoTv } from './tv.js';
export { emailChamadoTecnico } from './recursos.js';
export { calendarioIcs } from './calendario.js';
export { emailAgendaDia, emailLembretes } from './agenda.js';
export { painelSecretaria } from './painel-secretaria.js';
export { freqResumo, emailBuscaAtiva } from './frequencia.js';
export { portaria, limparFotosPortaria } from './portaria.js';
export { limparFotosAlunos } from './fichas.js';
export { senhaProvisoria, trocarSenhaProvisoria, expirarSenhasProvisorias } from './senha-provisoria.js';
export { gerarAcessoTurma, codigoAlunoQr, vincularContaAluno } from './acesso-aluno.js';
export { criarUsuarioManual, contasSemCadastro } from './usuario-manual.js';
export { backupInfo, backupConfigurar, backupAgora, backupSemanal, backupLink } from './backup.js';
export { avisosFamiliaManha, avisosFamiliaTarde, avisosFamiliaNoite, avisoChegada, comunicadoFamilias } from './avisos.js';
export { contarReacaoVideo, contarReacaoLivro, contarReacaoNoticia, contarRespostaPesquisa, contarReacaoAtividade } from './videos.js';
