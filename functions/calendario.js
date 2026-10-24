// Calendário escolar como link de assinatura (iCalendar): o Google Agenda, o Outlook e o iPhone leem este endereço.
// Endereço: .../calendarioIcs?m=<municipio>&e=<escola opcional>&t=<chave da rede>
// A chave fica no calendário da rede (cal_rede.token); trocar a chave no Portal desliga os links antigos.
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';
import CAL from './calendario-nucleo.js';

const ID = /^[A-Za-z0-9_-]{1,64}$/, CHAVE = /^[A-Za-z0-9]{20}$/;
const igual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const calendarioIcs = onRequest({ region:'southamerica-east1', invoker:'public', cors:false, memory:'256MiB', maxInstances:5 }, async (req, res) => {
  const m = String(req.query.m || ''), e = String(req.query.e || ''), t = String(req.query.t || '');
  if(req.method !== 'GET' && req.method !== 'HEAD'){ res.status(405).send('Use GET.'); return; }
  if(!ID.test(m) || (e && !ID.test(e)) || !CHAVE.test(t)){ res.status(400).send('Link de calendário inválido.'); return; }
  try{
    const db = getFirestore();
    const s = await db.collection('cal_rede').where('municipio_id', '==', m).get();
    const anos = s.docs.map(d => d.data()).filter(r => typeof r.token === 'string' && igual(r.token, t)).sort((a, b) => a.ano - b.ano);
    if(!anos.length){ res.status(404).send('Calendário não encontrado. Peça o link novo à secretaria.'); return; }
    const muni = (await db.doc(`municipios/${m}`).get()).data() || {};
    let escola = null;
    if(e){
      escola = (await db.doc(`escolas/${e}`).get()).data();
      if(!escola || escola.municipio_id !== m){ res.status(404).send('Escola não encontrada nesta rede.'); return; }
    }
    // um arquivo com todos os anos da rede (ano atual e o próximo, quando já existir)
    let corpo = null;
    for(const R of anos.slice(-3)){
      const Esc = e ? ((await db.doc(`cal_escola/${e}_${R.ano}`).get()).data() || null) : null;
      const nome = 'Calendário escolar · ' + (escola ? escola.nome : 'Rede municipal de ' + (muni.nome || '')), parte = CAL.ics(R, Esc, muni.uf, nome);
      if(!corpo) corpo = parte;
      else corpo = corpo.replace(/END:VCALENDAR\r\n$/, '') + parte.slice(parte.indexOf('BEGIN:VEVENT'));
    }
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'inline; filename="calendario-escolar.ics"');
    res.set('Cache-Control', 'public, max-age=1800');
    res.status(200).send(corpo);
  }catch(err){
    console.error('calendarioIcs', err);
    res.status(500).send('Não foi possível gerar o calendário agora.');
  }
});
