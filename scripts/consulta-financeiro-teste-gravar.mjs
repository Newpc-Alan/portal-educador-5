// Apaga o Financeiro de teste (ver consulta-financeiro-teste.mjs).
process.env.GRAVAR = '1';
await import('./consulta-financeiro-teste.mjs');
