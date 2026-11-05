// Só leitura: mostra quantas escolas do Censo seriam cadastradas em cada rede (não grava nada).
process.env.SO_LER = '1';
await import('./consulta-escolas-censo2-gravar.mjs');
