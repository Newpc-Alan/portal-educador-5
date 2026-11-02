# Atualização dos manuais do Portal do Educador 5.0 (nov/2026)

## Contexto
- Sistema: repositório /home/claude/portal-educador-5 (branch vitrine-ia = main). Firebase `portal-educador-5`, telas em HTML/JS por pasta (entrar/, apps/*, lousa/, provas/, prova/, formacao/, gestao/, relatorios/, bncc/ ...), funções em functions/*.js, regras em firestore.rules e storage.rules, robôs em .github/workflows e scripts/.
- Os manuais em Markdown foram escritos em 26/10/2026 (nesta pasta: parte0u.md, parte0.md, parte1.md, parte2.md, parte3.md, pops0.md, pops1.md; notas-*.md são anotações de pesquisa daquela época).
- Desde então entraram ~325 commits. Veja: `cd /home/claude/portal-educador-5 && git log --since=2026-10-26T04:00 --reverse --pretty='%h %ad %s' --date=short`. Use `git show <hash>` e o código atual para confirmar como cada coisa funciona HOJE.

## O que fazer
Atualizar o arquivo que é seu (o pedido do agente diz qual), deixando-o fiel ao sistema de hoje:
- Corrigir o que mudou, acrescentar o que é novo, tirar o que não existe mais (ex.: "Dicas de IA / IA do Educador / 46 aplicações do IA Studio" saiu e virou **Portal IA**; a tela "Avaliações" foi excluída; a Rede Modelo de demonstração foi apagada; "Atividades prontas" saiu do Início do professor e foi para "Mais recursos").
- Novidades importantes desde 26/10 (confirmar no código): Portal IA (tipos, temas múltiplos da BNCC, quantidade de questões até 40, gabarito em página separada, Word/PDF, BNCC por questão, ligação com o Corretor de gabarito por botão e QR, enviar para alunos/e-mail/rede, créditos pré-pagos, Central de IA, tela "Estou pensando"); Aula com IA da Lousa (Básica/Ultra, cores, temas); Buscador BNCC público (/bncc/); Sala Conectada / Turma ao Vivo / Educador em Rede (nomes comerciais), Enviar para a turma, Materiais da turma, Meus trabalhos e Compartilhar, moderação da rede (Materiais da rede), Novidades da rede; entrada do aluno por cartão QR e tempo de aula; Famílias (envio de material); Notícias (destaque, link público, imagem para Instagram); Municípios (cadastro completo); Simulador de preços; Uso real; Vídeos/Jogos com posição e selo Novo; Acervo (Storage do Firebase, cópia para o servidor NEWPC/Nextcloud, Acervo por município com árvore de pastas definida pelo admin, material NEWPC protegido, botão Baixar); **Auditoria** (Sistema › Auditoria; trilha gravada pelo servidor, entradas com IP em todas as telas via /assets/pde-entrada.js, retenção 6 meses por TTL, Marco Civil art. 15); Documentação e Ajuda; e tudo mais que o git log mostrar.

## Estilo (obrigatório)
- Português do Brasil, natural, direto, frases curtas. Sem travessão (—): use vírgula, dois-pontos ou parênteses.
- Mesma marcação dos arquivos atuais: títulos `#`/`##`/`###`, tabelas Markdown, listas numeradas para passo a passo, caixas `:::dica`, `:::atencao`, `:::regra`, `:::nota` (fecham com `:::` em linha própria), nomes de botões/menus em **negrito** exatamente como aparecem na tela (confira o texto no código).
- POPs: cabeçalho `@@ Código | Área | Responsável | Quando aplicar` logo abaixo do `##`, e seções Objetivo, Pré-requisitos (ou Entradas), Procedimento, Pontos de controle, Registros, Erros comuns/Exceções, como nos atuais.
- Figuras: `![legenda](arquivo.png){largura}`. Só mantenha figuras que já existem e cuja tela não mudou muito (as capturas estão em /tmp/claude-0/t5). NÃO invente arquivos de imagem. Onde uma captura nova seria útil, deixe um comentário HTML `<!-- captura: descrição da tela -->` (fica invisível no PDF).
- Não exponha segredos, chaves, senhas nem e-mails pessoais. Pode citar nomes de coleções, funções e workflows na parte técnica.
- Seja fiel: se não tiver certeza de um comportamento, confira no código; não descreva o que não existe.

## Entrega
Sobrescreva SÓ o seu arquivo nesta pasta (/tmp/claude-0/manual2/). Ao terminar, responda com: lista das seções alteradas/novas/removidas, pontos em que ficou em dúvida e sugestões de capturas de tela novas.
