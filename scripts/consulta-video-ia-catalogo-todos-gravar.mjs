// GRAVA. Igual à rotina de publicar o catálogo, incluindo os vídeos longos (até ~1 h), os sem duração cadastrada e os de crianças bem pequenas.
// Custo: ~R$ 0,30 por vídeo curto, ~R$ 2 a 3 por vídeo de 50 minutos.
process.env.PUBLICAR = '1'; process.env.QTD = '100'; process.env.TODOS = '1';
await import('./consulta-video-ia-catalogo-gravar.mjs');
