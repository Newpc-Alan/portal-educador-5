// GRAVA. Gera o vídeo interativo de todos os vídeos curtos do catálogo que ainda não têm e já PUBLICA (aparece o botão Interativo),
// e publica os rascunhos que existirem. Revisão depois, pela edição em /video/. Custo: ~R$ 0,30 por vídeo.
process.env.PUBLICAR = '1'; process.env.QTD = '100';
await import('./consulta-video-ia-catalogo-gravar.mjs');
