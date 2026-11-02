# Implantação e rede

## POP-PDE-01 · Implantação de um município {: .nova }

@@ POP-PDE-01 | Implantação | Coordenação de implantação | Contrato assinado com uma nova rede

### Objetivo
Colocar uma rede municipal em funcionamento no Portal com cadastros corretos, plano conforme o contrato e todos os perfis entrando no primeiro acesso.

### Pré-requisitos
- Contrato ou ata assinado, com número, modalidade e datas de início e fim da vigência.
- Lista do que foi contratado: pacote (Básico, Intermediário ou Completo) ou módulos avulsos, Painel da Rede, Prova online, recursos de sala (Educador em Rede, Sala Conectada, Turma ao Vivo) e créditos de IA.
- Planilhas da rede: escolas com INEP; gestão e equipe; professores; matrículas dos alunos (planilha do sistema de matrícula ou do Educacenso).
- Logo da prefeitura em PNG ou JPG.
- Contatos da Secretaria: secretário(a), ponto focal técnico, gestor e fiscal do contrato.

### Procedimento
1. **Reunião de partida** com a Secretaria: confirmar escopo, cronograma, responsável local, forma de acesso dos alunos (conta Google da escola, link de acesso por e-mail ou cartão com QR e PIN) e o modo de moderação dos materiais da rede (POP-PDE-21).
2. **Cadastrar o município** em **Municípios** › **Cadastro** (ou **+ Novo Município**), preenchendo as abas **Identificação** (IBGE, CNPJs, endereço), **Pessoas**, **Contrato** e **Rede e IDEB**. Nº do contrato e vigência da aba Contrato são os mesmos do Plano e módulos.
3. **Conferir as planilhas** recebidas: e-mails válidos, uma escola por linha, INEP com 8 dígitos, turmas no padrão do Portal (etapa e letra, ex.: "5º Ano A").
4. **Importar as escolas** (POP-PDE-02). Conferir em Municípios se não nasceu município duplicado.
5. **Configurar o plano** (POP-PDE-03), enviar o logo da prefeitura e liberar a IA na **Central de IA** quando contratada (POP-PDE-20).
6. **Completar os dados de cada escola** em **Escolas**: INEP, CNPJ (botão **Buscar** traz os dados da Receita), CEP (preenche o endereço), DDD, telefone, diretor e coordenador. Esses dados saem no cabeçalho de relatórios, declarações e provas.
7. **Cadastrar as turmas** em **Turmas** (etapa, letra, turno e ano letivo). O Portal monta o nome e bloqueia turma repetida.
8. **Importar gestão e equipe**, depois **professores** (POP-PDE-02), nessa ordem.
9. **Matricular os alunos** pela **Ficha do Aluno** › **📥 Importar planilha** (as turmas precisam existir antes). Se a rede tiver e-mail próprio de aluno, informe o domínio no plano ou importe a lista de alunos em Importar cadastros.
10. **Orientar a escola** a montar a **Grade das turmas** (qual professor dá cada disciplina) e a Secretaria a montar o calendário letivo e a regra de notas da rede.
11. **Montar a árvore de pastas do acervo da rede** e colocar o material NEWPC previsto no contrato (POP-PDE-18).
12. **Conferência com "Entrar como..."**: ver o Início como professor, aluno, gestor e Secretaria de Educação da rede.
13. **Teste real**: um login de cada perfil com contas verdadeiras da rede e um cartão de aluno lido pela câmera (POP-PDE-23).
14. **Capacitação** dos gestores e professores (usar o Manual do Usuário, disponível em **Ajuda**).
15. **Comunicar a liberação** à rede, com os links de entrada (professor e aluno).
16. **Acompanhar a primeira semana** pelo **Painel** e pelo **Uso real** do administrador (acessos, cadastros pendentes, chamados).

### Pontos de controle
- ☐ Data de fim da vigência preenchida no plano.
- ☐ Pacote e recursos marcados iguais ao contrato (nada a mais, nada a menos).
- ☐ Nenhum município ou turma duplicada.
- ☐ Pelo menos um login real de cada perfil funcionou.
- ☐ Rede comunicada por escrito, com data de início.

### Registros
Contrato e planilhas recebidas (pasta da rede no Drive NEWPC), prévias das importações, e-mail de liberação enviado à Secretaria, lista de presença da capacitação.

:::atencao
Nunca importe professores antes das escolas, nem matricule alunos antes de cadastrar as turmas: a Prova online, a chamada e os cartões de acesso dependem da matrícula do aluno na turma certa.
:::

<!-- captura: Municípios › Cadastro com as abas Identificação, Pessoas, Contrato e Rede e IDEB -->

## POP-PDE-02 · Importação de cadastros por planilha {: .nova }

@@ POP-PDE-02 | Implantação | Administrador do Portal | Rede nova, novos servidores ou alunos, atualização de vínculos

### Objetivo
Trazer escolas, gestão, equipe, professores e alunos sem erros de vínculo, garantindo que cada pessoa entre já com o perfil e as escolas certas.

### Procedimento
1. Em **Importar cadastros**, escolha o tipo e clique em **Baixar modelo**. Use sempre o modelo da tela.
2. Preencha respeitando as colunas:

| Tipo | Colunas |
|---|---|
| Escolas | `municipio ; uf ; escola ; inep` |
| Gestão e equipe | `nome ; email ; perfil ; municipio ; escola` (escola vazia para a Secretaria de Educação) |
| Professores | `nome ; email ; municipio ; escolas` (várias escolas separadas por `\|`) |
| Alunos | `nome ; email ; municipio ; escola ; turma` (escola e turma opcionais) |

3. Cole a planilha (ou envie o arquivo) e clique em **Conferir antes de gravar**.
4. Leia a prévia linha a linha. Corrija na planilha toda linha com **Erro** e confira de novo.
5. Confira os **Ignorados**: são repetidos ou já cadastrados, e não devem esconder um erro de digitação.
6. Clique em **Gravar** e aguarde a mensagem **Importação concluída**.
7. Confira o resultado: Usuários › **Pré-cadastrados** (professores e equipe) ou Usuários › **Alunos**.
8. Arquive a planilha final na pasta da rede, com a data no nome.

### Pontos de controle
- ☐ Zero linhas com erro gravadas.
- ☐ E-mails são contas que a pessoa realmente usa (institucionais ou Gmail).
- ☐ Nenhum e-mail de aluno importado como professor ou equipe.
- ☐ A importação de alunos por e-mail cria só o acesso: a **matrícula** na turma é feita na Ficha do Aluno (POP-PDE-01, passo 9).

### Registros
Planilha final arquivada; e-mail automático de resumo de pré-cadastros (chega à equipe em até 15 minutos).

:::regra
O pré-cadastro vale quando a pessoa entra com o **mesmo e-mail**, pelo Google ou pelo **link de acesso** enviado ao e-mail. Se entrar com outro e-mail, cai no teste grátis e precisa ser vinculada manualmente (POP-PDE-04). Quem não tem conta Google pode receber um cadastro manual com senha provisória (POP-PDE-27).
:::

## POP-PDE-03 · Configuração e alteração do plano do município {: .nova }

@@ POP-PDE-03 | Contratos | Administrador do Portal | Contrato novo, aditivo, renovação ou mudança de escopo

### Objetivo
Manter o que cada rede enxerga exatamente igual ao que foi contratado, com vigência sempre atualizada.

### Procedimento
1. Separe o documento que autoriza a mudança (contrato, aditivo, ata, ordem de serviço).
2. Em **Municípios**, abra **Plano e módulos** da rede.
3. Atualize **Nº do contrato / ata** e **Vigência até**.
4. Ajuste a **Situação do município** (Piloto, Ativo ou Inativo).
5. Aplique o pacote contratado com **Plano básico**, **Plano intermediário** ou **Plano completo** e, se o contrato for diferente, ajuste módulo por módulo nas colunas **Professor** e **Aluno**. Use **Aluno igual ao professor** só se o contrato prever o mesmo escopo.
6. Marque **Painel da Rede** e, em **Recursos extras**, **Prova online**, **🤝 Educador em Rede**, **🎒 Sala Conectada** e **📡 Turma ao Vivo** conforme o contrato (o padrão é Educador em Rede em todos os planos, Sala Conectada no Intermediário e no Completo, Turma ao Vivo só no Completo).
7. Confira os **Domínios de e-mail dos alunos** (só domínios exclusivos de alunos; e-mail pessoal como gmail.com é recusado).
8. Clique em **Salvar plano**. O nome do pacote aparece na lista de Municípios.
9. Os recursos de IA (Portal IA, imagens, Provas com IA, Lousa IA Básica e Ultra) são liberados à parte, na **Central de IA** (POP-PDE-20).
10. Professor com direito a algo além do plano: em Usuários › **Gerenciar**, marque em **Recursos exclusivos deste professor**.
11. Valide com **Entrar como...** um professor e um aluno da rede.
12. Comunique a mudança à Secretaria, com a data em que passou a valer.

### Pontos de controle
- ☐ Vigência igual à do documento.
- ☐ Nenhum módulo ou recurso liberado sem cobertura contratual.
- ☐ Teste de visualização feito após salvar.

### Registros
Documento autorizador arquivado e e-mail à Secretaria. A alteração do plano fica na trilha de **Auditoria** (quem alterou, quando e quais campos); anote também no histórico da rede o motivo.

:::atencao
Lista de módulos vazia (botão **Limpar**) significa "tudo liberado". Ao tirar todos os módulos, a rede passa a ver tudo. Para bloquear, use o POP-PDE-05.
:::

:::nota
Todo município novo nasce no **plano básico**, na situação **Piloto** e com a moderação **Aprovação antes** para os materiais compartilhados na rede.
:::

## POP-PDE-04 · Aprovação de cadastros e gestão de licenças {: .nova }

@@ POP-PDE-04 | Contratos | Administrador do Portal | Cadastro aguardando aprovação, venda avulsa, renovação ou vínculo incorreto

### Objetivo
Garantir que só tenha acesso quem tem direito, com a licença certa e o prazo correto.

### Procedimento
**Rotina diária**

1. Abra **Usuários** › **Aguardando aprovação** (o menu mostra o contador).
2. Para cada cadastro, confira nome, e-mail, município, escola e WhatsApp informados.
3. Professor de rede atendida: **Aprovar e vincular** com licença **Institucional (contrato do município)**, município, escolas e turmas.
4. Professor sem vínculo com rede: mantenha em teste ou recuse, conforme a política comercial.
5. Clique em **Contas sem cadastro** de vez em quando: lista contas que entraram mas não completaram o cadastro.

**Venda avulsa**

1. Confirme o pagamento e guarde o comprovante.
2. Abra o cadastro (**Gerenciar**), escolha licença **Avulsa (venda direta)**, o plano (mensal, semestral, anual, pacote por escola ou personalizado), as datas, o **Valor (R$)**, a **Ref. do pagamento** e os **Recursos liberados (pacote)**: Básico, Intermediário ou Completo.
3. Marque em **Recursos exclusivos deste professor** o que foi vendido a mais.
4. **Salvar** e avise o professor para tocar em **Já paguei, verificar**.
5. Créditos de IA avulsos seguem o POP-PDE-20.

**Rotina semanal**

1. Abra **Vencendo / vencidas** e acione o comercial para renovação.
2. Revise **Desativados** e **Pré-cadastrados** antigos que nunca entraram.

### Pontos de controle
- ☐ Nenhum cadastro parado em análise por mais de 1 dia útil (meta sugerida).
- ☐ Toda licença avulsa com valor, referência de pagamento e pacote.
- ☐ Perfil Administrador só para a equipe NEWPC.

### Registros
Comprovante de pagamento (avulsas); o próprio cadastro guarda tipo, plano, pacote, valor, referência e datas, e a Auditoria registra quem aprovou ou alterou.

## POP-PDE-05 · Suspensão e encerramento de uma rede {: .nova }

@@ POP-PDE-05 | Contratos | Coordenação de implantação | Fim de contrato, inadimplência formal ou pedido da prefeitura

### Objetivo
Cortar o acesso na data certa, preservando os dados e a relação com a rede.

### Procedimento
1. Obtenha a autorização por escrito (diretoria NEWPC) com a data de corte.
2. Avise a Secretaria com antecedência (meta sugerida: 15 dias), informando a data e que os dados ficam guardados.
3. **Suspensão** (pode voltar logo): na data, abra **Plano e módulos**, coloque **Vigência até** no passado e a **Situação do município** em **Inativo**.
4. **Encerramento definitivo**: abra **Cadastro** do município, desça até **Arquivar ou excluir**, deixe marcado **Ao arquivar, encerrar a vigência hoje** e clique em **Arquivar município**. O município sai das listas e o Portal do Aluno fica bloqueado; o histórico fica guardado.
5. No encerramento definitivo, retire também o domínio de e-mail dos alunos e confira se a carteira de créditos de IA tem saldo a tratar com o comercial.
6. Teste com **Entrar como...**: o professor deve ver a tela de licença expirada e o aluno, o aviso de pausa.
7. Confirme que o backup semanal seguinte rodou (POP-PDE-16).
8. Registre o encerramento no histórico da rede.

### Pontos de controle
- ☐ A data de vigência foi alterada (a situação "Inativo" sozinha não corta o acesso).
- ☐ A rede foi avisada por escrito.
- ☐ **Excluir de vez** só para município cadastrado por engano: o Portal só deixa excluir sem escolas, turmas e usuários ligados.

:::nota
Na renovação, use **Reativar** na lista de Municípios (volta a situação e a vigência anteriores) ou ajuste a vigência no Plano e módulos. Os usuários recuperam o acesso com tudo o que já tinham feito.
:::

# Conteúdo e atendimento

## POP-PDE-06 · Publicação de conteúdo no catálogo {: .nova }

@@ POP-PDE-06 | Conteúdo | Curadoria de conteúdo | Vídeo, jogo, atividade, livro, desenho, arquivo do acervo ou kit de data

### Objetivo
Publicar só conteúdo com qualidade pedagógica, classificação correta e direito de uso comprovado.

### Procedimento
1. **Direito de uso**: confirme que o material é próprio da NEWPC, de domínio público, de licença aberta ou licenciado. Registre a comprovação. Personagens e marcas de terceiros não entram.
2. **Revisão pedagógica**: adequação à faixa etária, correção do conteúdo, linguagem e acessibilidade.
3. **Cadastro como rascunho** no lugar certo: **Vídeos** e **Jogos** (menu Conteúdo do Portal), **Acervo** (escolha o **Botão do Portal**: Atividades, Desenhos para Colorir, Biblioteca, Datas Comemorativas e outros) ou a própria tela de Atividades, que o administrador edita.
4. **Classificação**: faixa de séries ou etapa, componente, tema, habilidades BNCC, tipo, e quem pode ver (professores, alunos ou ambos).
5. **Conferência por outra pessoa** da curadoria (abrir, testar, ler a ficha).
6. **Publicar**. Vídeos e jogos recém-publicados ganham o selo **Novo no Portal** por 15 dias.
7. Se o conteúdo serve a uma data comemorativa, inclua no **kit da data** (Datas Comemorativas › Abrir e montar kit).
8. Ordem e destaque: em Vídeos e Jogos, use **Posição na tela** (1 aparece primeiro, 2 normal, 3 vai para o fim). Para destaque, use **🎬 Em cartaz** (Vídeos) ou **Destaque (aparece primeiro)** (Jogos).
9. Material para uma rede só vai para o **Acervo por município** (POP-PDE-18), não para o catálogo geral.

### Pontos de controle
- ☐ Direito de uso registrado.
- ☐ BNCC conferida (formato válido e coerente com o conteúdo).
- ☐ "Para alunos" marcado só quando adequado ao aluno sozinho.
- ☐ Segunda pessoa conferiu antes de publicar.

### Registros
Comprovação de licença (no próprio item ou na pasta de curadoria) e data de publicação.

:::atencao
Excluir uma atividade vinda do Drive é definitivo: ela não volta na sincronização. Para retirar temporariamente, use **Ocultar**.
:::

## POP-PDE-07 · Notícias, pesquisas e pop-ups {: .nova }

@@ POP-PDE-07 | Conteúdo | Administrador do Portal | Comunicado da NEWPC, novidade do Portal, podcast ou pesquisa

### Objetivo
Comunicar com clareza, para o público certo, sem excesso de interrupções.

### Procedimento
1. Em **Notícias**, defina **Tipo**, **Quem vê** (Professores e equipe, Alunos) e **Municípios** (nenhum marcado = todos).
2. Escreva **Título** (na pesquisa, a pergunta), **Chamada curta** e **Matéria completa**. Revise a ortografia.
3. Para pesquisa: de 2 a 5 opções e a decisão **Resposta identificada** ou anônima. Na dúvida, use anônima.
4. Imagem: envie uma foto boa (vira a capa e a foto grande do destaque no Início). Link do Spotify ou YouTube vira player.
5. Defina o **Período**. Notícia sem data de fim fica no ar até alguém tirar.
6. Use **⭐ Fixar no topo** e **🔔 Abrir em pop-up ao entrar** só para o que é prioritário (no máximo uma campanha de pop-up por vez, meta sugerida).
7. Para divulgar fora do Portal, siga o POP-PDE-25 (link público e imagem para Instagram e TikTok).
8. Salve sem marcar **Publicar (sai do rascunho)**, use **Ver**, peça uma segunda leitura e só então publique.
9. Ao fim do período, baixe as respostas da pesquisa (**Baixar respostas (planilha)**, se identificada) e registre o resultado.

### Pontos de controle
- ☐ Público e municípios corretos.
- ☐ Opções da pesquisa revisadas antes da primeira resposta (depois ficam travadas).
- ☐ Nenhum dado pessoal de aluno no texto ou na foto.

### Registros
Planilha de respostas da pesquisa e resumo do resultado.

## POP-PDE-08 · Moderação de dicas de professores e alunos {: .nova }

@@ POP-PDE-08 | Conteúdo | Curadoria de conteúdo | Nova Dica do Professor ou Dica do Aluno recebida

### Objetivo
Dar retorno rápido a quem compartilha e publicar só o que é seguro e útil.

### Procedimento
1. Ao receber o e-mail de nova dica, abra **Dicas recebidas** (professor) ou a fila de Dicas do Aluno.
2. Verifique: conteúdo correto, adequação, links seguros, arquivos sem dados pessoais e sem material protegido.
3. Decida: **Publicar** ou **Não publicar**, sempre com um retorno respeitoso que o autor verá em Meus envios.
4. Dica do aluno: publique só com texto adequado à idade; a versão pública mostra apenas o primeiro nome e a escola.
5. Dicas boas podem virar notícia ou entrar em kits de datas (POP-PDE-06 e 07).

### Pontos de controle
- ☐ Retorno dado em até 5 dias úteis (meta sugerida).
- ☐ Nenhum link ou arquivo com dados pessoais publicado.

:::nota
Materiais que os professores compartilham com a própria rede (Portal IA e Meus trabalhos) não passam por aqui: seguem a moderação da rede (POP-PDE-21).
:::

## POP-PDE-09 · Atendimento de suporte ao usuário {: .nova }

@@ POP-PDE-09 | Atendimento | Suporte NEWPC | Dúvida ou problema relatado por WhatsApp, e-mail, telefone ou na escola

### Objetivo
Resolver no primeiro contato sempre que possível, registrar tudo e escalar com informação completa quando não der.

### Procedimento
1. **Registrar** o atendimento: nome, perfil, município, escola, e-mail de login, canal e descrição.
2. **Identificar o perfil e a situação** em Usuários (busca por nome ou e-mail).
3. **Conferir na Auditoria** (filtro **Pessoa (e-mail)**) se e quando a pessoa entrou e o que fez, quando isso ajudar a entender o problema (POP-PDE-19).
4. **Reproduzir** com **Entrar como...** na mesma rede e perfil, quando aplicável.
5. **Consultar o Guia rápido de suporte** (Manual, Parte 2) e os manuais em **Documentação** e aplicar a solução indicada. O usuário encontra os mesmos manuais em **Ajuda**.
6. **Problemas de entrada**: orientar o **link de acesso** por e-mail (sem senha); se não resolver, gerar **senha provisória** (POP-PDE-27). Aluno com cartão: POP-PDE-23.
7. **Classificar a prioridade**:

| Prioridade | Exemplo | Primeira resposta (meta sugerida) |
|---|---|---|
| Alta | Rede inteira sem acesso, prova online em andamento com falha | Imediata |
| Média | Um usuário sem acesso, importação com erro, créditos de IA da rede zerados | No mesmo dia |
| Baixa | Dúvida de uso, sugestão | Até 2 dias úteis |

8. **Escalar** para a equipe técnica o que não for resolvido, com: passos para reproduzir, prints, e-mail do usuário, horário e mensagem de erro.
9. **Retornar** ao usuário com a solução e confirmar que resolveu.
10. **Encerrar** o registro com a causa e a solução.

### Pontos de controle
- ☐ Nenhum atendimento sem registro.
- ☐ Nunca pedir a senha ao usuário.
- ☐ Problema repetido mais de 3 vezes vira melhoria no Guia de suporte, num manual (POP-PDE-24) ou no sistema.

## POP-PDE-10 · Chamado técnico de equipamento {: .nova }

@@ POP-PDE-10 | Atendimento | Suporte NEWPC e gestor da escola | Chamado aberto pela etiqueta QR, pelo cartaz ou pelo painel

### Objetivo
Atender equipamentos (Chromebooks, tablets, lousas, redes, TVs) dentro do SLA do contrato, com histórico completo.

### Procedimento
1. O chamado chega por e-mail à equipe NEWPC e aos gestores da escola, com protocolo e prazo do contrato.
2. O suporte confirma o recebimento ao solicitante (WhatsApp informado no chamado, quando houver).
3. Em **Recursos da Escola › Chamados**, mude para **Em atendimento** e registre o técnico responsável.
4. Diagnostique (remoto ou visita). Se precisar de troca, registre a movimentação do equipamento.
5. Resolva e mude para **Resolvido**, descrevendo o que foi feito (o texto aparece para a escola).
6. Acompanhe semanalmente o painel **Rede e SLA** (chamados fora do prazo, tempo médio).

### Pontos de controle
- ☐ Chamado em atendimento dentro do prazo de atendimento do contrato.
- ☐ Resolução descrita de forma que a escola entenda.
- ☐ Equipamento substituído com patrimônio e série atualizados.

### Registros
O próprio chamado (histórico, datas e resposta) e a planilha **Chamados e SLA** exportada mensalmente para o relatório do contrato.

## POP-PDE-11 · Demonstração comercial com o Laboratório NEWPC {: .nova }

@@ POP-PDE-11 | Comercial | Comercial e Administrador do Portal | Reunião com prefeitura, evento ou feira

### Objetivo
Demonstrar o Portal com dados realistas, sem expor nenhum dado real de rede cliente.

### Pré-requisitos
- Município **Laboratório NEWPC** (`lab-muni`) com a **Escola Laboratório NEWPC** e a turma **6º Ano A** (30 alunos fictícios, sem CPF, NIS ou telefone).
- As 9 contas de teste do laboratório (4 professores, direção, coordenação, secretaria escolar, portaria e Secretaria de Educação), com e-mails institucionais do Portal. As credenciais ficam com a equipe técnica.
- Simulação de preços pronta no **Simulador de preços**, quando a reunião for de proposta.

### Procedimento
1. **Na véspera**, peça à equipe técnica para rodar o workflow **Escola de laboratório** no modo **diagnostico** (só lê): ele mostra as escolas de teste e a situação das 9 contas.
2. Se o laboratório estiver vazio ou desatualizado, a equipe técnica roda **criar** (município, escola, turma, fichas, famílias, calendário, regras de notas, chamados e pré-cadastros) e, depois que os 4 professores entraram, **historico** (6 semanas de chamadas, notas do 1º ao 3º bimestre, 1 prova corrigida e busca ativa). Esses modos gravam no banco e só rodam com o ok do Alan.
3. Para mostrar a visão de cada perfil, abra **Entrar como...**, escolha em **Rede usada no teste** o **Laboratório NEWPC** e a escola do laboratório, e toque no perfil. Para mostrar fluxos que gravam (Portal IA, Prova online, Turma ao Vivo), use as contas de teste do laboratório.
4. **Roteiro sugerido (30 min)**: Início do professor › **Portal IA** (material com gabarito e BNCC) › **Provas e Avaliações** com **Aplicar online** › painel da prova no modo **▦ Sala** › **Dar aula agora** e **Turma ao Vivo** › Frequência e Mural de chegada › Painel da Rede › Portal do Educador TV.
5. Para mostrar o lado do aluno, gere os cartões da turma do laboratório (POP-PDE-23) e entre num segundo aparelho com **Sou aluno** (código e PIN) ou lendo o QR.
6. Se for apresentar valores, use o **Simulador de preços** (porte do município, avulso ou junto da locação, prazo, itens à parte) e entregue a proposta pelo canal comercial.
7. Ao final, volte a **Administrador** e confira que nada foi gravado fora do Laboratório.

### Pontos de controle
- ☐ Nenhuma tela de rede real exibida (cuidado com listas de municípios no administrador).
- ☐ Recursos mostrados correspondem ao que está sendo ofertado (sem prometer o que não existe ou o que não está no plano oferecido).
- ☐ Nenhuma conta de teste usada em rede real.

:::atencao
Não diga que a Prova online "impede" a cola: ela detecta, avisa, bloqueia e registra. O travamento total do aparelho depende dos recursos de cada sistema (Portal Maestro no Chromebook e no tablet, por exemplo).
:::

:::nota
A antiga **Rede Modelo NEWPC** (demonstração com dados gerados por script) foi apagada. O Laboratório NEWPC fica num município próprio, separado das redes clientes, e o modo **apagar** do workflow remove tudo o que é dele (as contas de e-mail continuam).
:::

# Escola e técnico

## POP-PDE-12 · Aplicação de Prova online {: .nova }

@@ POP-PDE-12 | Escola | Professor, com apoio do gestor | Avaliação aplicada pelo Portal em computadores, tablets ou celulares

### Objetivo
Aplicar a prova com segurança, sem perda de respostas e com regras iguais para todos os alunos.

### Pré-requisitos
- **Prova online** liberada no plano do município (POP-PDE-03).
- Alunos matriculados na turma (Ficha do Aluno) e com forma de entrada definida: conta Google da escola, link de acesso por e-mail ou **código e PIN** do cartão da turma (POP-PDE-23).

### Procedimento
**Antes (até 1 dia antes)**

1. Monte a prova em **Provas e Avaliações**, marque o gabarito de todas as objetivas (múltipla escolha, V ou F, caixas e grades) e confira o resumo de questões corrigidas sozinhas.
2. Confirme que todos os alunos da turma entram no Portal do Aluno. Imprima a **📋 Lista com PIN (professor)** para quem esquecer o cartão.
3. Teste os aparelhos: carga da bateria, internet e navegador atualizado.
4. Clique em **Aplicar online** e preencha: **Turma**, **Para que serve** (vale nota: avaliação, trabalho, recuperação; não vale nota: diagnóstica, exercício, simulado) e o **bimestre**. É essa classificação que leva a nota para Notas e Médias.
5. Escolha o modo: **▶️ Aplicar agora** (tempo de prova e tolerância para entrar) ou **🗓️ Horário marcado** (dia, abre às, fecha às e tempo de prova).
6. Defina **Nota para o aluno** (mostrar quando a prova terminar ou guardar até o fechamento do bimestre), deixe **Embaralhar questões e alternativas** marcado e decida sobre a **📸 Foto de confirmação** (começo e entrega).
7. Clique em **Enviar para a sala de espera** ou **Agendar para a turma**.

**No dia**

8. Abra o painel da prova (**Provas online**) antes do horário.
9. Explique as regras: tela cheia, um aparelho só, 1 aviso e bloqueio na segunda saída. Mostre os botões **A−** e **A+** para quem precisa de letra maior.
10. **Aplicar agora**: espere os alunos tocarem em "Estou pronto" e clique em **▶️ Iniciar a prova agora** (contagem de 10 segundos e a prova abre junto para todos). **Horário marcado**: a prova abre sozinha; **▶️ Abrir agora (contagem de 10 s)** antecipa.
11. Acompanhe pelo modo **▦ Sala** (cartões da turma, bloqueados primeiro, alerta e bipe a cada bloqueio) ou **☰ Lista**. Os números do topo funcionam como filtro.
12. Bloqueio: ouça o aluno e decida **Dar nova chance** (Continuar de onde parou ou Recomeçar do zero) com critério igual para todos.
13. Problema técnico de um aluno: use **+10 min** para compensar.
14. Para enviar a prova pelo Portal Maestro, use **🔗 Copiar link da prova (para o Portal Maestro)**.

**Depois**

15. Ao fim do tempo, confira se todos entregaram (a entrega é automática quando o tempo acaba; **Encerrar agora** fecha antes).
16. Corrija as questões abertas com **✍️ Corrigir questões abertas**, um aluno por vez (**Salvar e ir para o próximo**). Com tudo corrigido e a prova encerrada, toque em **🔒 Finalizar correção**. Depois, mudar nota só por **Reavaliar**, com justificativa (fica no histórico e na Auditoria). Libere as notas (**Liberar notas aos alunos** ou **Mostrar notas já**), conforme o combinado.
17. Baixo aproveitamento: **🔁 Recuperação** reaplica a prova aos alunos escolhidos; vale a maior nota e a original fica preservada.
18. Em Notas e Médias, puxe as notas da prova online para a planilha da turma.
19. Registre as ocorrências (bloqueios, trocas de aparelho, novas chances).

### Pontos de controle
- ☐ Correção das questões abertas finalizada em até 7 dias depois do fim da prova (o Painel do administrador mostra as atrasadas).
- ☐ Gabarito e classificação conferidos antes de aplicar.
- ☐ Mesmo critério de nova chance para toda a turma.
- ☐ Ocorrências registradas.

### Registros
O painel guarda situação, saídas, trocas, liberações (com o nome do professor) e horários pelo relógio do servidor. Gere **📄 Relatório** do aluno, **🖨️ Relatórios da turma** e **⬇️ Auditoria (planilha CSV)** quando a escola ou a família pedir. Fotos de confirmação só para professor e direção; são apagadas no fim do ano letivo.

<!-- captura: painel da prova online no modo Sala, com um aluno bloqueado no topo -->

## POP-PDE-13 · Conexão de TVs e totem da portaria {: .nova }

@@ POP-PDE-13 | Escola | Técnico NEWPC e gestor da escola | Instalação de TV, troca de aparelho ou novo totem

### Procedimento
1. Na TV, abra `app.portaldoeducador.com.br/tv/teste/`. Se o veredito indicar versão leve ou TV box, siga a orientação da tela.
2. Abra `app.portaldoeducador.com.br/tv/` e anote o código de 6 caracteres.
3. No painel (**Portal do Educador TV › Telas**), toque em **＋ Conectar TV**, informe o código, o nome do local (ex.: "Pátio · Entrada"), o formato e a playlist.
4. Para totem da portaria: ligue **Totem da portaria** e, se a escola decidir, **Foto na entrada**.
5. Configure a TV para abrir o Portal sozinha ao ligar (modo quiosque, conforme a orientação **Tela cheia e quiosque**).
6. Confira no painel o status **No ar**.
7. Teste o totem lendo uma carteirinha e conferindo a entrada no mural.

### Pontos de controle
- ☐ TV com status No ar e nome do local claro.
- ☐ Fotos na entrada só com decisão registrada da gestão (LGPD).
- ☐ Nenhum dado pessoal de aluno em playlists de áreas públicas.

:::nota
A carteirinha da portaria e o cartão de acesso da turma (POP-PDE-23) são diferentes: a carteirinha registra a chegada na escola; o cartão de acesso entra no Portal do Aluno.
:::

## POP-PDE-14 · Rotina de frequência e busca ativa {: .nova }

@@ POP-PDE-14 | Escola | Professores, gestor e secretaria escolar | Diário (chamada) e semanal (busca ativa)

### Objetivo
Manter a frequência em dia e agir cedo com os alunos em risco de abandono.

### Procedimento
**Diário (professor)**

1. Lançar a chamada de cada aula no mesmo dia, com faltas justificadas quando houver atestado ou motivo informado. Professor substituto nomeado pela Direção faz a chamada no lugar da titular.
2. Preencher o registro da aula, quando a rede exigir diário.

**Diário (gestão)**

3. Conferir no **📺 Mural de chegada** quem faltou e as turmas ainda sem chamada.
4. Conferir na **🧾 Auditoria da portaria** (aba da Frequência) os alunos que entraram na escola mas estão com falta.

**Semanal (gestão, segunda-feira)**

5. Ler o e-mail de busca ativa e abrir **🔎 Busca ativa**.
6. Abrir a ficha de cada aluno da lista, registrar o contato com a família e o motivo.
7. Encaminhar à rede de proteção quando necessário (CRAS, CREAS, Conselho Tutelar, Saúde, Secretaria, Ministério Público).
8. Cobrar as turmas sem chamada há mais de 7 dias.

**Mensal**

9. Gerar o diário do mês em PDF (cabeçalho com brasão, rodapé e assinaturas) para o arquivo da escola, quando a rede exigir.

### Pontos de controle
- ☐ Nenhuma turma sem chamada por mais de 7 dias.
- ☐ Todo aluno em risco com ficha aberta e um contato registrado na semana.

### Registros
Fichas de busca ativa (histórico de contatos e encaminhamentos), impressas quando a rede de proteção pedir; PDFs da chamada do dia e do diário do mês.

:::atencao
Dados de famílias, busca ativa e fotos da entrada são de uso restrito da gestão da escola e da rede de proteção (LGPD).
:::

## POP-PDE-15 · Publicação de mudança no sistema {: .nova }

@@ POP-PDE-15 | Técnico | Equipe técnica | Qualquer alteração de tela, regra de acesso, função, índice, coleção ou robô

### Objetivo
Evoluir o Portal sem quebrar o que está no ar, com aprovação, rastreabilidade e possibilidade de voltar atrás.

### Procedimento
1. **Registrar a mudança**: o que muda, por quê e quem pediu.
2. **Desenvolver** no ramo **vitrine-ia** do repositório (é o ramo de trabalho; o **main** é mantido no mesmo ponto). Mudança grande pode nascer num ramo próprio e ser juntada ao vitrine-ia depois. Convenções: arquivo único por tela, `data-action` com delegação de eventos (nunca `onclick`), textos em português.
3. **Cumprir a regra permanente** de auditoria e documentação (caixa abaixo).
4. **Validar**:
   - `node --check` em todo JavaScript alterado.
   - Testes de ponta a ponta das telas afetadas, de preferência com as contas do Laboratório NEWPC (POP-PDE-11).
   - Testes de regras no emulador sempre que `firestore.rules` ou `storage.rules` mudar, com teste novo (`scripts/teste-regras-*.mjs`) para a regra nova. Resultado obrigatório: 0 falha.
5. **Aprovar com o Alan** antes de publicar regras, funções, índices ou configuração, e antes de rodar qualquer robô que grava no banco.
6. **Publicar regras e funções pelo GitHub Actions**: aba **Actions** › **Publicar no Firebase** › **Run workflow**. Em **alvo**, informe o que publicar no formato do Firebase (ex.: `firestore:rules`, `storage`, `functions:nomeDaFuncao`, `firestore:indexes`). Deixe **testar_regras** marcado: o workflow confere a sintaxe das funções e roda os testes de regras no emulador (sem tocar no banco real); se algum falhar, nada é publicado. Função retirada do código vai em **apagar_funcoes** (nome ou nome@regiao).
7. **Ordem**: regras e funções primeiro, depois índices, depois o front (commit no vitrine-ia e `git push` do vitrine-ia e do main).
8. **Conferir no ar**: abrir a tela publicada, testar o fluxo principal e olhar o resumo da execução no Actions (erros aparecem ali).
9. **Comunicar** a novidade (notícia no Portal, se for visível ao usuário) e publicar os manuais e POPs atualizados (POP-PDE-24).

:::regra
**Toda função, tela ou coleção nova entra na auditoria e vem com manuais e POPs atualizados.**

- Tela nova com login: incluir `<script type="module" src="/assets/pde-entrada.js"></script>`. Ele registra a entrada (data, hora, IP, navegador e perfil) pela função `registrarEntrada`.
- Coleção nova: a trilha grava sozinha toda criação, alteração e exclusão (`auditarBanco`). Decida se ela é ruído técnico (lista `IGNORAR` em `functions/auditoria.js`), se tem campo de controle cujo valor deve aparecer (lista `VALOR`, nunca senha, PIN, token ou chave) e dê a ela um nome legível na tela Auditoria (`AUD_COLECOES`).
- Função nova que grava no banco: preencher `atualizado_por` ou `criado_por`, para a trilha mostrar quem fez.
- Manual do Usuário, Manual Técnico e POPs revisados no mesmo ciclo da publicação.
:::

### Pontos de controle
- ☐ Testes de regras com 0 falha.
- ☐ Nada publicado sem `node --check`.
- ☐ Aprovação do Alan registrada para regras, funções e robôs que gravam.
- ☐ Tela nova com `pde-entrada.js`; coleção nova conferida na auditoria.
- ☐ Commit com mensagem descritiva em português.

### Registros
Histórico do git (commit e mensagem), execução do workflow no GitHub Actions (quem rodou, alvo e resultado) e a mensagem de aprovação.

### Volta atrás
Front: reverter o commit e publicar de novo. Regras: publicar a versão anterior do `firestore.rules` (histórico do git) pelo mesmo workflow. Funções: publicar a versão anterior da função.

## POP-PDE-16 · Backup e restauração {: .nova }

@@ POP-PDE-16 | Técnico | Administrador do Portal e equipe técnica | Semanal (automático), antes de mudanças grandes e mensal (conferência)

### Procedimento
**Configuração (uma vez)**

1. Criar pasta em Drive compartilhado da NEWPC (pasta no "Meu Drive" de uma pessoa não funciona) e adicionar o robô indicado na tela como Gerente de conteúdo.
2. Em **Painel › 💾 Backup**, colar o link, **Salvar e testar** e marcar o backup semanal automático.

**Rotina**

3. Toda segunda-feira, conferir em **🗂️ Últimos backups** se o automático de domingo (madrugada) terminou com sucesso.
4. Antes de mudança grande ou importação em massa, usar **💾 Fazer backup agora** (só o banco).
5. Uma vez por mês, fazer backup **completo** (banco e arquivos). Se precisar de uma cópia fora do Google, use **⬇️ Baixar no computador** e guarde em HD externo com senha ou no servidor da empresa.
6. Conferir também, toda segunda-feira, o card **🖥️ Servidor NEWPC** na mesma aba: o backup diário da aplicação inteira no servidor da NEWPC (banco, contas de login, código e todos os arquivos, cifrado) precisa ter menos de 36 horas, e o último **teste de restauração** (todo dia 2) precisa estar com ✅. Detalhes no POP-PDE-29.

**Restauração**

7. Só a equipe técnica restaura, sempre primeiro num projeto de teste, conferindo os dados antes de qualquer restauração em produção, com aprovação do Alan (POP-PDE-29).

### Pontos de controle
- ☐ Nenhuma semana sem backup concluído.
- ☐ Acesso à pasta de backup restrito a quem precisa (os pacotes têm dados pessoais).

:::nota
O backup do Google (Drive) não leva as contas de login; o do servidor NEWPC leva. Nenhum dos dois guarda as fotos da portaria (apagadas em 15 dias). Para guardar registros de auditoria além de 6 meses, exporte a planilha (POP-PDE-19).
:::

## POP-PDE-17 · Entrada e saída de pessoas da equipe NEWPC {: .nova }

@@ POP-PDE-17 | Técnico | Administrador do Portal | Contratação, mudança de função ou desligamento

### Procedimento
**Entrada**

1. Criar ou confirmar a conta Google corporativa da pessoa.
2. Definir o perfil necessário (Administrador só para quem opera o Portal).
3. Formação Continuada: o administrador do Portal já é administrador da Formação (automático). Quem só vai editar cursos recebe o papel **editor** no painel da Formação.
4. Acessos técnicos só para quem precisa: Firebase, repositório no GitHub (e permissão para rodar workflows), servidor NEWPC (Nextcloud) e pasta de backup.
5. Entregar o Manual e os POPs da área (**Documentação**) e registrar o treinamento.

**Saída ou mudança de função (no mesmo dia)**

6. Em Usuários, mudar a situação para **Recusado / desativado** ou ajustar o perfil.
7. Retirar o papel de editor da Formação, quando houver (o de administrador sai sozinho quando a pessoa deixa de ser admin do Portal).
8. Retirar o acesso ao Firebase, ao Cloud Shell, ao repositório e ao GitHub Actions, ao Nextcloud e à pasta de backup.
9. Se a pessoa conhecia algum segredo (conta de serviço do Firebase, senha de aplicativo do Nextcloud, chaves de assinatura), pedir ao Alan a troca e a atualização nos segredos do repositório e do Firebase.
10. Trocar senhas de contas compartilhadas e das contas de teste do Laboratório, se a pessoa as conhecia.
11. Conferir na **Auditoria** (filtro Pessoa) os últimos registros da conta antes de desativar, quando a saída não for amigável.

### Pontos de controle
- ☐ Nenhum ex-colaborador com acesso ativo.
- ☐ Revisão trimestral da lista de administradores e de quem tem acesso ao GitHub e ao Nextcloud (meta sugerida).

### Registros
Lista de acessos por pessoa (data de concessão e retirada). A troca de perfil e a desativação ficam na Auditoria.

# Acervo, auditoria e IA

## POP-PDE-18 · Acervo por município {: .nova }

@@ POP-PDE-18 | Conteúdo | Administrador do Portal e Secretaria de Educação | Rede nova, material novo da NEWPC para uma rede ou reorganização do acervo

### Objetivo
Entregar a cada rede um acervo organizado em pastas, com o material da Secretaria e o material da NEWPC separados, protegidos e guardados também no servidor NEWPC.

### Pré-requisitos
- Município cadastrado e com plano salvo.
- Material com direito de distribuição (próprio, licenciado ou de domínio público) e **sem dados pessoais de alunos**.
- Arquivos de até 100 MB. A cota padrão do acervo da rede é de 2 GB.

### Procedimento
**Montar a árvore de pastas (administrador)**

1. Em **Acervo**, abra a aba **Acervo por município** e escolha o **Município**.
2. Em **🌳 Estrutura de pastas**, use **Usar estrutura modelo** (Documentos oficiais, Currículo e referenciais, Modelos e formulários, Formação de professores, Projetos da rede, Livros e obras) ou **Copiar estrutura de...** outro município. Ajuste com **+ Pasta principal**, **+ Subpasta**, **Renomear** e as setas **↑** e **↓**.
3. Até 4 níveis e 400 pastas por município. Só exclua pasta vazia (mova os arquivos e as subpastas antes).

**Publicar material NEWPC**

4. Em **Adicionar arquivos da NEWPC**, escolha a **Pasta**, a **Disciplina**, as **Etapas** e as habilidades **BNCC**.
5. Marque a declaração de direito de distribuição e ausência de dados pessoais, clique em **Escolher arquivos** e ajuste o título de cada um antes de enviar.
6. Material que já está em outro lugar (Drive, site, YouTube): use **🔗 Ou aponte para onde o material já está** e **Adicionar link**. Confira se o link está liberado para os professores.
7. Confira na lista **Arquivos da rede**: o material da NEWPC aparece com o selo **NEWPC** e a Secretaria vê "Mantido pela NEWPC" (não altera nem exclui).

**Copiar para outros municípios**

8. Antes de enviar, abra **Copiar também para outros municípios** e marque as redes. O arquivo vai para a pasta de mesmo nome em cada uma (se não existir, o Portal cria).

**Rotina da Secretaria**

9. A Secretaria envia o material dela em **Acervo da rede**, nas mesmas pastas. Ela pode **Renomear**, **Mover**, **Ocultar** e **Excluir** o que é dela.

**Conferir a cópia no servidor NEWPC**

10. Na madrugada seguinte, o robô copia os arquivos novos para `03-Acervo-Municipios/{município}/{pastas}` no Nextcloud. Pasta renomeada ou arquivo movido no Portal também muda lá na rodada seguinte. Links não são copiados.
11. No dia seguinte, confira em **Acervo** › aba **Acervo do Portal (todos)** › **☁️ Cópia para o servidor NEWPC** se a linha **Acervos dos municípios** está completa (POP-PDE-22).
12. Entre com **Entrar como...** um professor da rede e confira em **Acervo** › **Da minha rede** se as pastas e os arquivos aparecem, com **Ver** e **⬇ Baixar**.

### Pontos de controle
- ☐ Árvore de pastas aprovada pela Secretaria antes da carga.
- ☐ Declaração de direito e de ausência de dados pessoais marcada em cada envio.
- ☐ Material NEWPC com selo NEWPC.
- ☐ Cópia no servidor NEWPC conferida no dia seguinte.

### Registros
A Auditoria registra os envios, as alterações de pastas e os acessos dos professores aos arquivos (quem abriu ou baixou). Guarde a comprovação de direito de uso na pasta de curadoria.

:::atencao
A cópia para o servidor NEWPC não apaga nada lá: arquivo excluído no Portal continua no Nextcloud até a equipe técnica remover à mão. Exclusão por pedido de dados pessoais precisa ser feita também no servidor.
:::

<!-- captura: Acervo por município com a árvore de pastas e o selo NEWPC na lista de arquivos -->

## POP-PDE-19 · Consulta de auditoria e resposta a pedidos de dados {: .nova }

@@ POP-PDE-19 | Privacidade | Administrador do Portal, com a diretoria NEWPC | Ofício de órgão de controle, ordem judicial, pedido da Secretaria ou pedido do titular de dados

### Objetivo
Responder pedidos de registros do Portal no prazo, com o mínimo de dados necessário, base legal clara e registro do atendimento.

### Pré-requisitos
- Pedido por escrito (ofício, e-mail institucional, ordem judicial ou protocolo da Secretaria), com período, pessoa ou escola e finalidade.
- Perfil Administrador (só o administrador vê a Auditoria).

### Procedimento
1. **Registrar o pedido**: número do protocolo, quem pediu, data de chegada, prazo de resposta e o que foi pedido.
2. **Analisar a base legal com a diretoria** (e o jurídico, quando houver dúvida):
   - Rede pública: a Prefeitura ou a Secretaria é a **controladora** dos dados e a NEWPC é a **operadora**. Pedido do titular (aluno, família, servidor) é atendido junto com a Secretaria, que responde ao titular.
   - Professor com licença individual: a NEWPC é a controladora e responde diretamente.
   - Registros de acesso com IP para terceiros só com **ordem judicial** (Marco Civil da Internet, arts. 10 e 15).
3. **Agir rápido se houver pedido de guarda**: a trilha apaga sozinha cada registro com 6 meses (retenção do Marco Civil, art. 15). Se o órgão pedir que os registros sejam preservados por mais tempo, exporte a planilha no mesmo dia e guarde em local restrito.
4. **Consultar**: em **Sistema** › **Auditoria**, escolha **De** e **Até**, e um filtro principal: **Pessoa (e-mail)**, **Município** ou **Ação** (Entrou no Portal, Criou, Alterou, Excluiu, Abriu/baixou). Clique em **Buscar**.
5. Use **Filtrar o resultado** para achar campo, IP ou documento. A tela traz 300 registros por vez: clique em **Carregar mais** até acabar antes de exportar.
6. **Exportar planilha (CSV)**: sai o que está carregado e filtrado, com as colunas Quando, Quem, Ação, Onde, Documento, Município e Detalhe.
7. **Separar só o necessário**: apague da cópia de resposta as linhas e colunas que não fazem parte do pedido (outras pessoas, outras escolas).
8. **Fontes complementares**, quando o pedido for sobre elas: relatório de auditoria da Prova online (POP-PDE-12), Auditoria da portaria (POP-PDE-14), histórico de alterações das notas (POP-PDE-28) e registro de quem abriu a saúde ou os anexos na Ficha do Aluno.
9. **Responder** por canal oficial, com a planilha protegida (senha enviada por outro canal) e um texto que explica o que cada coluna significa.
10. **Encerrar o registro**: data da resposta, o que foi entregue, por quem e por qual canal.

### Pontos de controle
- ☐ Base legal conferida antes de entregar qualquer dado.
- ☐ Registros de acesso com IP entregues a terceiros só com ordem judicial.
- ☐ Pedido de guarda atendido no mesmo dia (exportação antes dos 6 meses).
- ☐ Só os dados do pedido saíram (minimização, LGPD).
- ☐ Prazo de resposta cumprido.

### Registros
Pedido original, planilha exportada (guardada em pasta restrita), resposta enviada e ficha de atendimento.

:::regra
A trilha é gravada pelo servidor: ninguém consegue editar ou apagar um registro, nem o administrador. Ela guarda **quais** campos mudaram; o valor antes e depois só aparece nos campos de controle (perfil, situação, notas, publicação, créditos e similares). Senha, PIN e token nunca entram. A trilha começou em 01/11/2026: não há registros anteriores.
:::

:::nota
Prazos de resposta: o órgão costuma fixar o prazo no ofício. Para o titular, a LGPD prevê resposta imediata em formato simplificado ou declaração completa em até 15 dias (art. 19). Na rede pública, combine o prazo com a Secretaria.
:::

<!-- captura: Sistema › Auditoria com os filtros e uma busca por pessoa -->

## POP-PDE-20 · Créditos de IA (Central de IA) {: .nova }

@@ POP-PDE-20 | Contratos | Administrador do Portal | Venda ou recarga de créditos, implantação de rede com IA, alerta de saldo ou pedido avulso de professor

### Objetivo
Liberar a IA só para quem tem direito, com créditos pré-pagos, validade controlada e nenhuma surpresa na fatura da rede.

### Como funciona
- Cada rede tem uma carteira e cada professor pode ter a sua (créditos avulsos). Cada lançamento vira um pacote com validade própria (padrão: 12 meses); o consumo tira primeiro do pacote que vence antes.
- Preços padrão: 1 material = 1 crédito, 1 ajuste com a IA = 1 crédito, 1 imagem = 5 créditos.
- A rede paga primeiro, até o **teto por professor** no mês (padrão: 60 créditos; 0 = sem teto). Bateu o teto ou acabou o saldo, o Portal usa os créditos próprios do professor, se ele tiver.
- Alertas automáticos por e-mail para a NEWPC e para a Secretaria quando o saldo da rede chega a 20% e a 5%.

### Procedimento
**Liberar a IA para uma rede (implantação ou aditivo)**

1. Em **Sistema** › **Central de IA**, bloco **✨ Central de IA**, confira em **1 · Recursos (chave geral)** se o recurso está **Ligado**.
2. Em **2 · Redes**, aplique o pacote com **Intermediário** ou **Completo** (ou **Nenhum**) e ajuste caixa por caixa: Portal IA, Imagens, Provas com IA, Lousa IA Básica e Ultra. Clique em **Salvar Central de IA**.
3. Em **Redes com Portal IA**, ajuste o **Teto por professor** se o contrato definir outro valor e clique em **Salvar** na linha.

**Vender ou recarregar créditos da rede**

4. A Secretaria pede pelo **Painel da Rede** › **Solicitar recarga** (até 3 pedidos aguardando por conta). A NEWPC recebe o e-mail e envia a proposta.
5. Depois do **empenho**, abra o pedido em **Pedidos de recarga** e clique em **Liberar**: o formulário **Lançar créditos** já vem preenchido. Confira créditos e validade, escreva em **Observação** o nº do empenho ou da NF e clique em **Lançar créditos**. O pedido fica aprovado e quem pediu recebe e-mail.
6. Venda sem pedido pelo Portal: em **Lançar créditos**, escolha a **Conta** (rede), a quantidade, a validade e a observação.

**Pedido avulso do professor**

7. O professor pede no Portal IA em **💳 Comprar créditos** › **Fazer o pedido**. A NEWPC envia os dados de pagamento (Pix ou boleto) ao e-mail dele.
8. Confirmado o pagamento, **Liberar** o pedido e **Lançar créditos** com a referência do pagamento na observação.
9. Pedido que não será atendido: **Cancelar** (confirmar).
10. Professor que deve usar um recurso de IA fora do plano da rede: em **3 · Professores (avulsos e exceções)**, **Adicionar professor pelo e-mail ou nome**, marque os recursos e salve (ele paga com os créditos próprios).

**Alerta de saldo**

11. Ao receber o alerta de 20%, o comercial procura a Secretaria para a recarga. Com 5%, a prioridade é alta: quando zerar, os professores deixam de gerar materiais pela rede.

**Revisão mensal**

12. Confira os indicadores do topo (créditos ativos, consumo do mês, **Custo real de IA no mês**, **Custo real por crédito**) e compare com o preço de venda. Ajustes em **Preços e pacotes** só com aprovação do Alan.

### Pontos de controle
- ☐ Nenhum crédito de rede lançado sem empenho, nem crédito avulso sem pagamento confirmado (cortesias registradas como tal na observação).
- ☐ Recursos marcados na Central de IA iguais ao contrato.
- ☐ Alerta de 5% tratado no mesmo dia (meta sugerida).

### Registros
Cada lançamento fica na carteira com observação, validade e quem lançou; o consumo fica registrado por uso. A Auditoria registra as mudanças nas carteiras e na Central de IA. Guarde empenho, NF ou comprovante de pagamento na pasta da rede.

:::atencao
O sistema é pré-pago: quando o saldo da rede acaba, a IA para para os professores daquela rede (a não ser que tenham créditos próprios). Nunca prometa à Secretaria "uso ilimitado".
:::

## POP-PDE-21 · Moderação da rede (Materiais da rede) {: .nova }

@@ POP-PDE-21 | Conteúdo | Secretaria de Educação e gestor da escola, com apoio do Administrador | Material compartilhado por professor com a rede, denúncia de colega ou escolha do modo de moderação

### Objetivo
Garantir que o que circula entre os professores da rede (Portal IA, aulas da Lousa, provas, roteiros e folhas) seja correto e seguro, com retorno rápido ao autor.

### Quem faz o quê
| Quem | O que modera | Troca o modo? |
|---|---|---|
| Administrador NEWPC | Qualquer rede | Sim |
| Secretaria de Educação | A rede inteira | Sim |
| Gestor da escola | Só o que vem das escolas dele | Não |

### Procedimento
**Escolher o modo (uma vez, revisar quando a rede pedir)**

1. Em **Materiais da rede**, no topo, escolha **✋ Aprovação antes** (o material só aparece para os colegas depois de aprovado; quem modera recebe um e-mail a cada material novo) ou **⚡ Publica direto, modera depois** (aparece na hora; com 3 avisos de colegas ele sai sozinho da vitrine). Município novo começa em Aprovação antes.
2. Registre a decisão da Secretaria (e-mail ou ata).

**Rotina (diária no modo Aprovação antes, semanal no outro)**

3. Abra **Materiais da rede** e veja as abas **Aguardando**, **Com denúncia**, **Publicados**, **Ocultos** e **Tudo**. Use a busca por título, professor, escola ou disciplina.
4. Clique em **Conferir**: leia o conteúdo, a primeira página e as denúncias dos colegas.
5. Decida:
   - **Aprovar**: os colegas passam a ver e o autor recebe e-mail.
   - **Pedir ajuste** (pendente) ou **Ocultar** (publicado): escreva a **Observação para o professor**, que vai no e-mail dele.
   - **Retirar da rede** (confirmar): sai da vitrine; o original continua na conta do professor.
6. Material com erro de conteúdo, dado pessoal de aluno ou material protegido de terceiros nunca é aprovado.

### Pontos de controle
- ☐ Nenhum material aguardando por mais de 2 dias úteis no modo Aprovação antes (meta sugerida).
- ☐ Toda ocultação ou retirada com observação ao autor.
- ☐ Denúncias conferidas na semana.

### Registros
Cada decisão guarda quem moderou, a decisão e o motivo, e entra na Auditoria. Os e-mails ao autor ficam como comprovante.

:::nota
O professor só compartilha com a rede se o recurso **🤝 Educador em Rede** estiver no plano do município (POP-PDE-03). Ao compartilhar, ele aceita o termo de autoria e LGPD. Os colegas usam uma cópia, sem gastar créditos de IA.
:::

## POP-PDE-22 · Cópia de segurança para o servidor NEWPC {: .nova }

@@ POP-PDE-22 | Técnico | Equipe técnica | Toda madrugada (automático), conferência semanal e quando o painel mostrar falha

### Objetivo
Manter uma cópia do acervo do Portal (Firebase) no servidor próprio da NEWPC (Nextcloud), sem mexer no original.

### Como funciona
- O workflow **Copiar acervo para o Nextcloud** (GitHub Actions) roda toda madrugada às 02h17 (horário de MS) e copia só o que for novo.
- Destino: pasta **Drive Portal do Educador** no Nextcloud (`cloud.portaldoeducador.com.br`), com `01-Acervo-NEWPC` (atividades, biblioteca, colorir), `02-Formacao-Continuada` (materiais) e `03-Acervo-Municipios` (acervo de cada rede).
- O original no Firebase fica intacto. Cada arquivo copiado entra no mapa `nc_mapa`, e o resumo vai para o painel do Portal.

### Procedimento
**Conferência (toda segunda-feira, meta sugerida)**

1. Em **Acervo** › **Acervo do Portal (todos)** › **☁️ Cópia para o servidor NEWPC**, confira o percentual, a situação (**Cópia concluída**, **Cópia parcial: falta rodar de novo** ou **Copiando agora**) e a data de atualização. Clique em **Atualizar** se precisar.
2. Em **Painel** › **Infraestrutura e custos** › **Servidor NEWPC · acervo no Nextcloud**, confira se a situação está **🟢 No ar**.

**Rodar manualmente**

3. No GitHub, aba **Actions** › **Copiar acervo para o Nextcloud** › **Run workflow**.
4. Escolha a **etapa**: **teste** (amostra, para checar a ligação), **copiar** (tudo o que falta; pode rodar de novo que retoma de onde parou) ou **conferir** (só leitura: compara o mapa com o Nextcloud, quantos existem lá e com o mesmo tamanho).
5. Deixe os outros campos no padrão (usuário, pasta raiz, coleções `atividades,biblioteca,colorir,materiais,rede` e limite 0), a não ser que queira uma rodada parcial.
6. Ao terminar, leia os avisos no resumo da execução e confira o painel do Portal.
7. Uma vez por mês, rode **conferir** e registre o resultado (quantos conferem, faltando, tamanho diferente).

**Se falhar**

8. Leia o erro no resumo da execução do Actions:
   - Falta usuário ou senha do Nextcloud: o segredo `NC_APP_SENHA` sumiu ou venceu. Peça ao Alan uma nova senha de aplicativo no Nextcloud e a atualização do segredo no repositório.
   - Servidor fora do ar (painel 🔴): verifique o servidor Ubuntu, a internet e o DNS antes de rodar de novo.
   - Erros em alguns arquivos: eles entram de novo na próxima rodada; rode **copiar** e depois **conferir**.
9. Enquanto o servidor estiver fora, o acervo continua abrindo pelo Firebase. Os arquivos que só existem no servidor (vinculados em **Vincular arquivos do servidor NEWPC**) ficam indisponíveis: avise o suporte (POP-PDE-09).
10. Duas madrugadas seguidas com falha: abrir chamado interno de prioridade alta.

### Pontos de controle
- ☐ Situação "Cópia concluída" na conferência semanal.
- ☐ Conferência mensal sem arquivos faltando ou com tamanho diferente.
- ☐ Segredo do Nextcloud nunca colado em chat, código ou documento.

### Registros
Histórico de execuções no GitHub Actions e o resumo `config/nc_copia` mostrado no painel. Anote na ficha de execução as conferências mensais e as falhas tratadas.

:::nota
Esta cópia é dos **arquivos** do acervo. O banco de dados tem backup próprio (POP-PDE-16).
:::

# Sala de aula, comunicação e documentos

## POP-PDE-23 · Entrada do aluno por cartão QR e tempo de aula {: .nova }

@@ POP-PDE-23 | Escola | Professor, com apoio da secretaria escolar | Início do ano, aluno novo, cartão perdido e toda aula com os aparelhos da escola

### Objetivo
Fazer o aluno entrar no Portal em segundos, sem e-mail e sem senha, só durante a aula, e sair sozinho quando ela acaba.

### Pré-requisitos
- Alunos matriculados na turma (Ficha do Aluno).
- Professor vinculado à turma.
- Aparelho com câmera liberada para o navegador (ou o app do Portal Maestro nos tablets).

### Procedimento
**Gerar e imprimir os cartões (uma vez por turma)**

1. Em **Minhas Turmas**, clique em **Alunos** na turma.
2. No passo 1, **Acesso dos alunos**, clique em **🔑 Gerar / ver cartões**. Cada aluno recebe um código de 6 caracteres, um PIN de 4 números e um QR.
3. Clique em **🖨️ Imprimir cartões com QR** (folha A4, 2 colunas) e em **📋 Lista com PIN (professor)**. O PIN não vai no cartão.
4. Recorte e entregue os cartões. Guarde a lista com PIN com o professor ou na secretaria escolar.

**Abrir a aula**

5. No Início, use **Sala de aula gerenciada** › **▶ Começar a aula**, escolha a turma e o tempo (30 min, 40 min, 50 min, 1 hora, 2 horas ou outro tempo de 5 a 360 minutos). Sem Turma ao Vivo no plano, abra pela tela da turma: **Alunos** › **Abrir entrada por QR**.
6. Os alunos apontam a câmera para o QR do cartão e entram direto, com boas-vindas pelo nome. Sem câmera: em `app.portaldoeducador.com.br/entrar` › **Sou aluno**, digitam o código e o PIN (ou usam **📷 Ler QR**).
7. Faltando 5 minutos, o professor recebe um aviso; aos 3 minutos, pode prorrogar (+10 min a +1 hora) ou **Encerrar agora**. No painel da Turma ao Vivo, **+10 min** e **⏹ Encerrar aula** fazem o mesmo.
8. Quando o tempo acaba, quem entrou pelo cartão vê "A aula terminou" e sai sozinho, liberando o aparelho para o próximo colega.

**Reimpressão e cartão perdido**

9. Cartão perdido ou visto por outra pessoa: na lista da turma, clique em **Novo PIN e QR** no aluno, confirme e imprima um cartão novo. O cartão antigo deixa de valer na hora.
10. Aluno novo na turma: matricule na Ficha do Aluno, volte em **🔑 Gerar / ver cartões** e imprima só o cartão dele.

### Pontos de controle
- ☐ Entrada por QR aberta só durante a aula (fechada no fim).
- ☐ Lista com PIN guardada fora do alcance dos alunos.
- ☐ Cartão perdido substituído no mesmo dia, com novo PIN e QR.

### Registros
O Portal registra quem abriu a aula, o tempo e as prorrogações, e a Auditoria registra cada entrada (com IP). Anote na ficha de execução as reimpressões por perda.

:::atencao
O cartão de acesso não é a carteirinha da portaria. Se o aluno mostrar a carteirinha para a câmera, o Portal avisa que é preciso usar o cartão da turma. Mensagem "A entrada por QR da sua turma está fechada": o professor precisa abrir a aula.
:::

:::nota
Quem gera os cartões e abre a aula pela tela: o professor da turma (o administrador pode testar com **Entrar como...**). A Turma ao Vivo (presença em tempo real e abertura automática dos materiais) vale só para quem entrou pelo cartão; aluno que entra com Google ou senha vê os materiais na lista de **Materiais da turma**.
:::

<!-- captura: cartões de acesso impressos e a janela "Abrir a entrada da aula" com as opções de tempo -->

## POP-PDE-24 · Publicação de manuais e POPs {: .nova }

@@ POP-PDE-24 | Documentação | Responsável pela qualidade e Administrador do Portal | Mudança no sistema publicada, revisão de POP ou novo documento

### Objetivo
Manter os manuais e os POPs sempre na versão que corresponde ao sistema no ar, com histórico de versões e controle de revisões.

### Procedimento
1. **Revisar o texto** do documento afetado (Manual do Usuário, Manual Técnico ou POPs) contra o sistema publicado, no mesmo ciclo da mudança (POP-PDE-15).
2. **Atualizar o controle de revisões** do documento: nova versão, data, o que mudou, quem elaborou e quem aprovou. POP novo entra na lista mestra.
3. **Gerar o PDF** e conferir capa, sumário, figuras e numeração.
4. **Pedir aprovação** ao responsável pela qualidade (e ao Alan, quando for POP técnico ou de contrato).
5. **Publicar pela tela**: em **Sistema** › **Documentação**, ache o documento e clique em **Nova versão**. Confira a **Versão** sugerida, escreva **O que mudou** (ex.: inclusão do POP 18), escolha o PDF (até 80 MB) e clique em **Publicar**.
6. Documento novo: **+ Novo documento**, com **Título**, **Categoria**, **Código** (ex.: POP-PDE-01), **Quem pode ver** (**Só a equipe NEWPC** ou **Todos os usuários (aparece em Ajuda)**), **Versão**, descrição e o PDF.
7. **Alternativa pelo GitHub Actions** (PDF guardado no ramo `manuais` do repositório): rode a consulta **documentos** do workflow **Consulta (só leitura)** para copiar o id do documento, depois **Publicar documento (manual/POP)** com arquivo, id, versão, o que mudou e código. Rode primeiro sem **gravar** (simulação) e, conferido, de novo com **gravar** marcado.
8. **Conferir**: o documento mostra a versão nova; **Histórico** lista as versões anteriores; para documento público, confira em **Ajuda** com **Entrar como...** um professor.
9. **Avisar** a equipe (e as redes, quando for manual do usuário) que há versão nova.

### Pontos de controle
- ☐ Versão e data do controle de revisões iguais às da publicação.
- ☐ Manual interno (técnico, POPs com dados operacionais) publicado como **Só a equipe NEWPC**.
- ☐ Nenhum segredo, senha ou e-mail pessoal no documento.
- ☐ Aplicativo Android (APK) só como documento da equipe NEWPC.

### Registros
O próprio documento guarda as versões (até 30) com data e nota; o controle de revisões fica dentro do PDF.

## POP-PDE-25 · Notícias com link público e imagem para redes sociais {: .nova }

@@ POP-PDE-25 | Conteúdo | Administrador do Portal e comunicação NEWPC | Notícia que deve ser divulgada fora do Portal (site, WhatsApp, Instagram, TikTok)

### Objetivo
Divulgar notícias do Portal fora dele sem expor nada que seja só para quem tem conta.

### Procedimento
1. Escreva a notícia conforme o POP-PDE-07, com foto boa e sem dado pessoal de aluno (foto de aluno só com autorização de imagem registrada pela escola).
2. Marque **🌐 Pode ser compartilhada fora do Portal (link público)** e **Publicar (sai do rascunho)**. Pesquisas nunca ficam públicas.
3. Salve. O Portal cria uma cópia pública só com título, chamada, texto, foto, mídia e data; a notícia original continua fechada. Ela também aparece na seção Notícias da página inicial do Portal.
4. Abra a notícia e clique em **↗ Compartilhar**. A janela mostra "🌐 Link público: qualquer pessoa abre, mesmo sem conta no Portal."
5. Escolha o canal: **WhatsApp**, **E-mail**, **Copiar link**, **Mais opções** ou **📸 Instagram / TikTok**.
6. Instagram e TikTok: o Portal monta uma imagem vertical (formato Stories, 1080 x 1920) com a foto, a marca e o título, e copia o link. No celular abre o menu do aparelho; no computador baixa a imagem. Cole o link na legenda ou no adesivo de link.
7. Confira o link público numa janela anônima antes de divulgar.
8. Para tirar do ar: desmarque o link público ou clique em **Tirar do ar**. A cópia pública some e o link deixa de abrir.

### Pontos de controle
- ☐ Link público só para conteúdo sem restrição (nada de dados de rede, de alunos ou de contrato).
- ☐ Imagem de Stories conferida antes de postar.
- ☐ Notícia com prazo de fim quando o assunto vence.

### Registros
Link publicado, data e canais usados (planilha de comunicação da NEWPC).

:::nota
Notícia não marcada como pública também pode ser compartilhada, mas o link pede para entrar no Portal ("🔒 Esta notícia é só para quem tem conta no Portal").
:::

## POP-PDE-26 · Envio de material às famílias {: .nova }

@@ POP-PDE-26 | Escola | Gestor da escola e professor | Escola que decide abrir o envio de materiais dos professores para as famílias

### Objetivo
Permitir que o professor envie material da turma às famílias por e-mail, só onde a escola autorizou e só para quem aceita receber.

### Pré-requisitos
- Contatos das famílias cadastrados em **Famílias**, com e-mail e a opção de aceitar avisos da escola marcada.
- Decisão da gestão registrada (reunião ou comunicado).

### Procedimento
**Liberar (gestor da escola)**

1. Em **Gestão Escolar** › **Famílias** › **📣 Avisos às famílias**, ligue **Professores podem enviar material às famílias**.
2. Confira na lista de Famílias quantos alunos estão sem contato e peça à secretaria escolar para completar.
3. Comunique aos professores a regra de uso (o que pode ir, tom, horário).

**Enviar (professor)**

4. Em **🔗 Enviar conteúdo para a turma** (Início ou Turma ao Vivo), escolha as turmas, o link ou arquivo e a orientação.
5. Marque **👪 Também enviar às famílias por e-mail**. A janela mostra quantos alunos das turmas têm e-mail de família que aceita avisos.
6. Envie. O e-mail sai com o nome do professor e a família responde direto para o e-mail dele. O material também fica em **Materiais da turma** no Portal do Aluno.

### Pontos de controle
- ☐ Envio liberado só com decisão da gestão.
- ☐ Nada de nota, falta ou assunto individual de aluno nesse envio (é material da turma).
- ☐ Limite respeitado: até 5 envios por professor por dia; irmãos com o mesmo e-mail recebem uma vez.

### Registros
Cada envio fica registrado por aluno (turma, material, professor e data). A gestão pode desligar a opção a qualquer momento em Avisos às famílias.

:::atencao
Família que não aceita avisos ou está sem e-mail não recebe: ela só vê o material pelo Portal do Aluno. Não use este envio para comunicados oficiais da escola; eles seguem os avisos automáticos e os comunicados da gestão.
:::

## POP-PDE-27 · Senha provisória e cadastro manual {: .nova }

@@ POP-PDE-27 | Atendimento | Suporte NEWPC, Secretaria de Educação e Direção da escola | Pessoa que não consegue entrar ou que não tem conta Google

### Objetivo
Devolver o acesso com segurança, sem nunca conhecer a senha pessoal de ninguém.

### Quem gera para quem
| Quem gera | Para quem |
|---|---|
| Administrador NEWPC | Qualquer perfil, menos outro administrador (alunos só o administrador) |
| Secretaria de Educação | Gestores, professores, secretaria escolar e portaria do município |
| Direção da escola | Professores, secretaria escolar e portaria das suas escolas |

### Procedimento
**Antes de gerar senha**

1. Confirme a identidade da pessoa (cadastro, escola, contato institucional).
2. Tente primeiro o **link de acesso** por e-mail (sem senha) ou a conta Google do mesmo e-mail.

**Gerar senha provisória**

3. Administrador: Usuários › **Gerenciar** › **🔑 Senha provisória**. Secretaria e Direção: **Ficha do Servidor** (menu **Servidores da rede** ou Gestão Escolar), abra a pessoa e use **🔑 Senha provisória**.
4. Confirme. A senha aparece **uma única vez**, vale 24 horas e já vem com botões para copiar ou mandar por WhatsApp.
5. Repasse pessoalmente ou pelo WhatsApp da própria pessoa. Ela entra com o e-mail e a senha (**Tenho senha**) e é obrigada a criar a senha pessoal (mínimo de 8 caracteres, com letras e números).
6. Se não usar em 24 horas, a senha provisória deixa de funcionar sozinha: gere outra.

**Cadastro manual (pessoa sem conta)**

7. Administrador: Usuários › **+ Novo usuário**. Informe nome, e-mail, **Perfil**, **Município** e as escolas (e turmas, para professor). Aluno é ligado a uma matrícula da Ficha do Aluno.
8. Clique em **Cadastrar e gerar senha** e siga os passos 4 a 6.

### Pontos de controle
- ☐ Identidade confirmada antes de gerar.
- ☐ Senha nunca enviada a terceiros nem anotada no atendimento.
- ☐ Cadastro ativo (o Portal não gera senha para cadastro desativado).

### Registros
A geração entra na Auditoria (quem gerou, para quem e quando). Registre o atendimento conforme o POP-PDE-09. Há limite diário de senhas por pessoa que gera.

:::nota
Aluno que usa o aparelho da escola normalmente entra pelo cartão com QR (POP-PDE-23), sem senha.
:::

## POP-PDE-28 · Fechamento do bimestre e boletim {: .nova }

@@ POP-PDE-28 | Escola | Direção e secretaria escolar | Fim de cada bimestre (ou período da rede) e emissão de boletins

### Objetivo
Congelar as notas do período numa cópia oficial, para que o boletim não mude depois sem registro.

### Pré-requisitos
- Regra de notas da rede definida (períodos, pesos, média mínima, recuperação).
- Professores com as notas lançadas em **Notas e Médias** (ou a escola com as notas do diário de papel lançadas em **✏️ Lançar notas da turma**).

### Procedimento
1. Uma semana antes do fim do período, avise os professores do prazo para lançar notas e puxar as notas da prova online (meta sugerida).
2. Em **Notas e Médias** › **🧾 Boletins**, confira turma por turma em **🧾 Emitir boletins** se não há aluno sem nota.
3. Abra **🔒 Fechamento e histórico** e clique em **Fechar o 1º bimestre** (ou o período correspondente). O fechamento vale para todas as turmas da escola: o Portal grava a cópia oficial e o boletim passa a usá-la.
4. Emita e imprima os boletins do período.
5. **Correção depois do fechamento**: só a Direção reabre. Clique em **Reabrir**, escreva o motivo (fica registrado), corrija e feche de novo.
6. Confira no **🕘 Histórico de alterações** da turma o que mudou e quando. Mudança depois do fechamento aparece em vermelho.

### Pontos de controle
- ☐ Período fechado dentro do calendário da rede.
- ☐ Toda reabertura com motivo.
- ☐ Boletins impressos a partir do período fechado.

### Registros
O registro de fechamentos e reaberturas (data, quem e motivo) e o histórico de alterações de cada nota ficam no Portal e na Auditoria. Arquive os boletins impressos ou em PDF conforme a regra da rede.

## POP-PDE-29 · Backup no servidor NEWPC e restauração em caso de desastre {: .nova }

@@ POP-PDE-29 | Técnico | Equipe técnica, com aprovação do Alan | Rotina diária (automática), conferência semanal e mensal, e em caso de desastre

### Objetivo
Garantir que a aplicação inteira do Portal 5.0 possa ser remontada a partir do servidor da NEWPC, mesmo que o projeto no Google fique indisponível, e que essa cópia seja testada de verdade todo mês.

### O que é copiado
| Parte | Como | Onde (Drive Portal do Educador › 04-Backups) |
|---|---|---|
| Banco de dados inteiro, com subcoleções | Um documento por linha (NDJSON), dentro do pacote do dia | `diario/AAAA-MM-DD.tar.enc` (30 dias) e `mensal/AAAA-MM.tar.enc` (12 meses) |
| Contas de login | `contas.json` dentro do pacote | Idem |
| Código, regras, funções e robôs | Repositório completo (`codigo.bundle`) dentro do pacote | Idem |
| Arquivos do Storage (Lousa, provas, acervos, documentos, TV) | Espelho incremental, um arquivo cifrado por arquivo | `arquivos/` com `_manifesto.json.enc` |

Ficam de fora as fotos da portaria (apagadas em 15 dias pela política de privacidade). Arquivo que some do Portal sai do espelho 30 dias depois.

### Pré-requisitos (uma vez)
1. Segredos no GitHub (Settings › Secrets and variables › Actions): `FIREBASE_SERVICE_ACCOUNT`, `NC_APP_SENHA` e **`BACKUP_SENHA`** (senha da cifra, no mínimo 12 caracteres). Quem cadastra é o Alan; a senha nunca passa por chat nem e-mail.
2. Guardar uma cópia da `BACKUP_SENHA` **fora do sistema** (cofre de senhas da diretoria ou envelope lacrado). Sem ela nenhum backup abre.

### Rotina
1. **Diária (automática):** o robô **Backup no servidor NEWPC** roda às 01:41. Registro em **Painel › 💾 Backup** (lista "Últimos backups", tipo "Automático · servidor NEWPC") e na Auditoria.
2. **Semanal (segunda-feira):** conferir no card **🖥️ Servidor NEWPC** que o último backup tem menos de 36 horas. Se não tiver, abrir o robô no GitHub, ler o erro e rodar de novo (**Run workflow › backup**).
3. **Mensal (dia 2, automático):** teste de restauração. Ele baixa o último pacote, decifra, confere o número de documentos, as contas, o código e uma amostra de 15 arquivos. Conferir que o card mostra ✅. Se mostrar ⚠️, tratar como incidente.
4. **Antes de mudança grande:** rodar o robô à mão (**backup**) além do backup do Google (POP-PDE-16).

### Restauração em caso de desastre
1. **Declarar o incidente** e obter a aprovação do Alan. Registrar hora, motivo e responsável na Ficha de execução.
2. **Escolher o pacote:** o diário mais recente anterior ao problema (ou o mensal, se o problema for antigo).
3. **Abrir:** num computador seguro, com `BACKUP_SENHA` no ambiente: `node scripts/restaurar-backup.mjs abrir --pacote AAAA-MM-DD.tar.enc --saida ./restauro` (ou o comando `openssl` descrito no próprio script). Conferir o `resumo.json`.
4. **Restaurar primeiro num projeto de TESTE:** `restaurar-backup.mjs banco --pasta ./restauro --projeto ID_TESTE --gravar` e `restaurar-backup.mjs arquivos --projeto ID_TESTE --bucket BUCKET_TESTE --gravar`. Conferir telas e contagens.
5. **Contas de login:** importar o `contas.json` com `firebase auth:import`. Quem entra com Google ou link por e-mail volta sem depender de senha; para senhas, usar os parâmetros de hash do projeto original.
6. **Código:** `git clone codigo.bundle portal` recupera todos os ramos; publicar regras e funções pelo fluxo normal (POP-PDE-15).
7. **Só depois da conferência no teste**, repetir no projeto real, com nova aprovação do Alan.
8. Comunicar as Secretarias afetadas e registrar o encerramento do incidente.

### Pontos de controle
- ☐ Último backup no servidor com menos de 36 horas.
- ☐ Último teste de restauração com ✅.
- ☐ Cópia da `BACKUP_SENHA` guardada fora do sistema e conferida a cada troca de pessoas da equipe (POP-PDE-17).
- ☐ Restauração sempre em projeto de teste antes do real.

### Registros
Lista "Últimos backups" do Painel, Auditoria (origem robô), execuções do robô no GitHub e Ficha de execução nos incidentes.

:::atencao
Os pacotes têm dados pessoais de alunos e servidores (LGPD). Mesmo cifrados, a pasta 04-Backups do Nextcloud deve ficar acessível só à equipe técnica. Nunca baixe um pacote para computador pessoal ou pen drive sem necessidade e sem apagar depois.
:::

## POP-PDE-30 · Comunicado por e-mail para a rede {: .nova }

@@ POP-PDE-30 | Comunicação | Administrador do Portal (NEWPC) | A cada comunicado

### Objetivo
Enviar mensagens por e-mail a professores, gestão das escolas, Secretarias de Educação ou alunos cadastrados, sem prejudicar os e-mails do sistema (senhas, avisos) e respeitando quem pediu para não receber.

### Pré-requisitos (uma vez)
1. Conta **comunicados@portaldoeducador.com.br** criada na Webnode.
2. Senha dessa conta cadastrada pelo Alan no Google Cloud, em **Secret Manager › COMUNICADOS_SMTP_SENHA** (nunca em chat, planilha ou código).
3. Em **Comunicados por e-mail › Configuração do envio**: servidor `smtp.mail.webnode.com`, porta 465 e envios por hora (comece com 100).

### Passo a passo
1. Menu **Sistema › Comunicados por e-mail**.
2. **Tipo:** **Informativo** (novidades, formação, pesquisas: respeita quem pediu para não receber) ou **Aviso de serviço** (mudança de acesso, manutenção: vai para todos). Na dúvida, Informativo.
3. **Para quem:** marque os públicos (para campanhas da Formação, use **Situação na Formação**) e, se for o caso, a **licença dos professores** (contrato da rede, avulsa, teste, cortesia; vencidas só marcando a opção), os municípios (inclusive **Sem município**, para os avulsos) e a escola. Confira a caixa azul: total de pessoas, quantas não têm e-mail e o tempo estimado.
4. Escreva **Assunto** e **Mensagem** (parágrafos separados por linha em branco). Botão e link são opcionais e o link precisa começar com https://.
5. Toque em **Enviar teste para mim** e confira na sua caixa de entrada (e no spam) como chegou.
6. Se quiser, preencha **Enviar em** para agendar.
7. Toque em **Enviar comunicado** e confirme o número de pessoas tocando de novo.
8. Acompanhe em **Enviados e agendados**: barra de progresso, falhas (**Ver falhas** baixa a planilha) e **Cancelar** enquanto não terminou.

### Pontos de controle
- ☐ Teste conferido antes do envio (texto, link, remetente, não caiu no spam).
- ☐ Público e número de pessoas conferidos na caixa azul.
- ☐ Para alunos: só avisos escolares, nunca conteúdo comercial.
- ☐ Falhas conferidas no fim (e-mails errados corrigidos no cadastro).
- ☐ Primeiro envio grande: medir o tempo e a entrega com cerca de 100 pessoas antes de mandar para toda a rede.

### Registros
Lista **Enviados e agendados**, **Auditoria** (quem criou, testou, cancelou, a conclusão e quem pediu para não receber) e a planilha de falhas.

:::atencao
Nunca use várias contas para "dividir" o envio e passar do limite da Webnode: isso leva o domínio para listas de spam. Se o volume crescer além do que a Webnode aguenta, troca-se o serviço de envio (Amazon SES ou Brevo) na configuração, sem mudar a tela.
:::

## POP-PDE-31 · Acompanhamento semanal pelo Painel do administrador {: .nova }

@@ POP-PDE-31 | Gestão | Administrador do Portal (NEWPC) | Toda segunda-feira, e antes de reunião com Secretaria

### Objetivo
Ler o Painel do administrador numa rotina fixa, para agir antes que o problema chegue como reclamação da escola ou da Secretaria. Todo número é clicável e mostra de onde veio (com planilha).

### Passo a passo
1. **Pessoas e uso:** conferir **Aguardando aprovação** (aprovar ou recusar no mesmo dia), **Vencendo em 30 dias** (avisar o comercial) e **Conversão do teste**. **Aulas abertas agora** mostra quem está dando aula no Turma ao Vivo.
2. **Portal IA e créditos:** redes com saldo baixo e pedidos de recarga pendentes (POP-PDE-20).
3. **Sala Conectada e rede:** materiais **aguardando aprovação** e **com denúncia** (POP-PDE-21); envios para a turma e entradas pelo QR no mês; **downloads do app do Maestro** (escola com Maestro contratado e nenhum download = oferecer ajuda na instalação dos tablets).
4. **Conteúdo e participação:**
   - **Provas online · correção:** se houver **pendentes há mais de 7 dias**, clicar, ver professor e turma e avisar a direção da escola. Olhar as **reavaliações de nota** da semana (motivo e professor).
   - **Formação Continuada · acompanhamento:** quem **parou no meio** e quem **ainda não começou**. Uma vez por mês, mandar um Comunicado com **Situação na Formação** = "Começaram e não concluíram" (lembrete) e avisar as Secretarias pelo Painel da Rede.
   - **Comunicados por e-mail:** fila andando e **falhas** (baixar a lista em Comunicados › Ver falhas e corrigir os e-mails no cadastro).
   - **O que a rede procura:** levar os **procurados e não achados** para a pauta de produção de conteúdo.
   - **Pendências:** resolver cada linha pelo atalho.
5. **Infraestrutura e custos:** leituras e gravações do banco perto das cotas, erros de funções, **Servidor NEWPC** no ar e registros de auditoria por dia.
6. **💾 Backup:** último backup no servidor com menos de 36 horas (POP-PDE-29).

### Pontos de controle
- ☐ Nenhum cadastro aguardando aprovação há mais de 2 dias úteis.
- ☐ Nenhuma prova online com correção pendente há mais de 7 dias sem contato com a escola.
- ☐ Comunicados sem falhas pendentes de correção.
- ☐ Backup e servidor NEWPC em dia.

### Registros
O próprio Painel (com Exportar planilha em cada número), a Auditoria e a Ficha de execução quando houver contato com escola ou Secretaria.

## POP-PDE-32 · Aula com aparelhos controlados (Dar aula + Portal Maestro) {: .nova }

@@ POP-PDE-32 | Sala de aula | Professor (com apoio da TI da escola na instalação) | Toda aula com tablets ou Chromebooks dos alunos

### Objetivo
Conduzir a aula com os aparelhos dos alunos seguindo o professor (pausar telas, abrir conteúdo, atender mãos levantadas), com presença nominal registrada, sem ditar número de aula.

### Pré-requisitos
- Município com **Portal Maestro** e **Turma ao Vivo** no plano.
- Alunos cadastrados na turma (Ficha do Aluno) e com acesso: cartão QR, código e PIN ou conta Google da escola.
- Tablets com o **app do Maestro 1.2 ou mais novo** (Aplicativos Úteis › App do Maestro) ou Chromebooks com a **extensão do Maestro 0.9 ou mais nova** (instalada pelo Google Admin da escola).

### Procedimento
1. No Início, toque em **▶ Começar a aula**, escolha a turma e o tempo.
2. Peça aos alunos que entrem no Portal: os menores mostram o **cartão** para a câmera; os maiores usam **código e PIN** ou a **conta Google** da escola.
3. Confira na faixa **🎼 Maestro** quantos aparelhos estão seguindo a aula e, nos cartões, quem está 🟢 na aula, 🔴 fora da página ou sem cor.
4. Para explicar algo, toque no cadeado verde **Telas liberadas** (ele fecha e fica vermelho); para voltar à atividade, toque no cadeado vermelho **Telas pausadas**.
5. Para abrir um conteúdo em todas as telas, use **📲 Abrir conteúdo para a turma** (ou **📚 Acervo do município** para um arquivo da rede, navegando pelas pastas) (ou **🔗 Enviar link ou arquivo**, que também registra o material na turma).
6. Atenda as mãos ✋ (o Controle da aula mostra quantas e de quem): toque no aluno, use **💬 Conversar** e, ao terminar, **✋ Atendi: baixar a mão**. Aluno fora da tarefa: toque nele e **⏸️ Pausar a tela**. Para checar a turma, **📊 Pesquisa rápida**. Atividade ou prova adaptada: **📲 Enviar só para ...** no cartão do aluno.
7. Se a escola liga a foto da carteirinha, confira em **📸 Entradas pela carteirinha** quem entrou sem senha (**👁️ Ver foto**). Rosto que não confere: **Não é este aluno**.
8. Antes de encerrar, verifique a aprendizagem com **🧠 Quiz rápido** (3 a 10 perguntas bastam; procure antes em **📁 Meus quizzes** e **🤝 Da rede** para não gastar crédito de IA à toa): lance, acompanhe quantos terminaram e toque em **🏁 Encerrar e ver relatório**. Pergunta com menos de 50% de acerto é a primeira a retomar na próxima aula; exporte o PDF se a coordenação pedir.
9. Tablet com 🪫 (bateria baixa) na faixa do Controle da aula: peça para ligar na tomada ou no carrinho antes da próxima atividade.
10. No fim, toque em **⏹ Encerrar aula** e confirme em **⏹ Encerrar agora** (dá para encerrar antes do tempo, pela Turma ao Vivo ou pelo cartão do Início; ou deixe o tempo acabar): os aparelhos são liberados e saem da aula, e o quiz aberto é encerrado com o relatório salvo.

### Pontos de controle
- ☐ Todos os alunos presentes aparecem verdes antes de começar a atividade.
- ☐ Nenhuma tela ficou pausada ao encerrar.
- ☐ Quiz rápido encerrado (relatório salvo em Meus trabalhos) e aparelhos com bateria baixa encaminhados para carregar.
- ☐ Quiz que funcionou bem compartilhado com a rede (🤝), para os colegas reaproveitarem.
- ☐ Entradas pela carteirinha conferidas (foto ou presença visual).
- ☐ Alunos que entraram pelo número da aula (linha à parte) foram identificados e orientados a usar a conta.

### Registros
Presença em `turma_presenca`, materiais em "Enviados" (com quem abriu) e abertura e encerramento da aula na Auditoria.

### Erros comuns
- **Tablet não vai para a aula:** app abaixo de 1.2 ou aula fechada. Atualizar o app; conferir o cartão **Aula em andamento**.
- **Chromebook não entra sozinho:** extensão abaixo de 0.9. Pedir a atualização à TI; enquanto isso, usar **Entrar com o número da aula**.
- **Aluno aparece como "conectado pelo número":** entrou sem conta. Orientar a entrar com o cartão ou código e PIN na próxima aula.

# Ficha de execução

## Ficha de execução de POP {: .nova }

Use esta ficha quando a rotina não gerar registro automático no sistema.

| Campo | Preenchimento |
|---|---|
| POP | |
| Rede / escola | |
| Executado por | |
| Data e horário | |
| Documento de origem (contrato, chamado, pedido) | |

<table class="chk"><thead><tr><th></th><th>Ponto de controle</th><th>Observação</th></tr></thead><tbody>
<tr><td>☐</td><td>&nbsp;</td><td></td></tr><tr><td>☐</td><td>&nbsp;</td><td></td></tr><tr><td>☐</td><td>&nbsp;</td><td></td></tr>
<tr><td>☐</td><td>&nbsp;</td><td></td></tr><tr><td>☐</td><td>&nbsp;</td><td></td></tr><tr><td>☐</td><td>&nbsp;</td><td></td></tr>
</tbody></table>

**Ocorrências e desvios:**

<div style="border:1px solid #dce4ec;border-radius:6px;height:26mm"></div>

<div class="assina"><div>Executado por</div><div>Conferido por</div><div>Data</div></div>
