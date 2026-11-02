# Parte 2 · Manual da equipe NEWPC

Esta parte é para quem implanta, opera e dá suporte ao Portal: administradores, implantação, comercial e atendimento. Tudo começa em `app.portaldoeducador.com.br/entrar/` com uma conta de perfil **Administrador**.

## O menu do administrador

O menu fica dividido em cinco grupos. Cada grupo abre e fecha com um toque no título, e o Portal lembra neste aparelho quais grupos você deixou fechados.

| Grupo | Item do menu | Para que serve |
|---|---|---|
| Visão geral | Painel | Números de uso, conteúdo, infraestrutura e backup |
| | Uso real | Quantos professores **usaram** o Portal na semana (não só entraram) e as horas economizadas |
| | Painel da Rede (secretarias) | Abre o painel que a Secretaria de Educação vê |
| | Início (prévia) | Mostra o Início como o professor ou o aluno vê |
| | Simulador de preços | Monta o preço do Portal para um município (planos, itens e enquadramento) |
| Redes e cadastros | Municípios | Cadastro completo das redes, plano, módulos, recursos e domínios de aluno |
| | Escolas, Turmas, Alunos | Cadastros de apoio |
| | Servidores da rede | Fichas dos servidores (abre `/apps/servidores/`) |
| | Usuários | Aprovação, licenças, vínculos, recursos exclusivos e senha provisória |
| | Importar cadastros | Escolas, professores, equipe e alunos por planilha |
| Gestão das escolas | Gestão Escolar | Abre a Gestão Escolar (`/gestao/`) |
| Conteúdo do Portal | Notícias | Notícias, podcasts, ações, novidades e pesquisas rápidas |
| | Datas Comemorativas | Catálogo de datas e montagem dos kits |
| | Acervo | Acervo do Portal (todos) e Acervo por município |
| | Vídeos, Jogos | Catálogos de vídeos e jogos |
| | Dicas recebidas | Moderação das Dicas do Professor |
| | Materiais da rede | Moderação do que os professores compartilham com a rede |
| | Formação Continuada | Painel editorial dos cursos (o administrador do Portal já entra como administrador; curso sem capa própria aparece com uma foto padrão do Portal, escolhida pelo tema) |
| Sistema | Central de IA | Quem usa cada recurso de IA, carteiras de créditos, recargas, preços e pacotes |
| | Módulos do Portal | Situação global de cada botão do Início |
| | Documentação | Manuais, POPs e arquivos internos, com versões |
| | Auditoria | Trilha de tudo o que foi criado, alterado ou excluído, entradas com IP e acessos ao acervo |
| | Entrar como... | Ver o Portal exatamente como outro perfil vê |

<!-- captura: menu lateral do administrador com os cinco grupos abertos (Visão geral, Redes e cadastros, Gestão das escolas, Conteúdo do Portal, Sistema) -->

:::nota
Saíram do menu: **Dicas de IA** (o catálogo das 46 aplicações do IA Studio foi retirado; o recurso de IA agora é o **Portal IA**, liberado pela Central de IA) e **Avaliações** (a tela foi excluída; as provas ficam em Provas e Avaliações e no Corretor de Gabarito).
:::

## Entrar como outro perfil

Na primeira entrada de cada sessão, o administrador vê a tela **Como você quer entrar?**, com sete opções: Administrador, Professor, Aluno, Gestor da escola, Secretaria de Educação, Secretaria escolar e Portaria. Escolha também a **Rede usada no teste** e a **Escola (teste de gestor e professor)**.

Durante a simulação aparece a faixa "🧪 Modo de teste: você está vendo como <perfil> · <município>. O que você gravar é real.", com os botões **Trocar** e **Voltar a administrador**. Para voltar a esta tela depois, use **Entrar como...** no menu.

![Escolha do perfil para testes e homologação](s89-admin-escolha.png){80}

:::atencao
O que você grava em modo de teste é real. A antiga Rede Modelo NEWPC foi apagada. Para testes e demonstrações, use o município **Laboratório NEWPC** (Escola Laboratório NEWPC, turma 6º Ano A, com alunos fictícios), criado pelo robô "Escola de laboratório" da equipe técnica. Nunca teste gravando em uma rede de cliente.
:::

## Implantar um município novo

Este é o roteiro completo de implantação. Siga na ordem: cada passo depende do anterior.

### Antes de começar

- Contrato assinado: número, modalidade, processo, valores e **data de fim da vigência**.
- CNPJ da Prefeitura e da Secretaria (ou Fundo) de Educação, código IBGE e contatos (secretário, TI da rede, gestor e fiscal do contrato).
- Números do Censo Escolar (escolas, alunos, professores) e o último IDEB.
- Planilha das escolas com código INEP.
- Planilha de professores e da equipe, com o **e-mail** que cada pessoa vai usar.
- Definição dos alunos: matrícula pela Ficha do Aluno, domínio de e-mail próprio para alunos (ex.: `aluno.municipio.ms.gov.br`) ou lista.
- Plano contratado (Básico, Intermediário, Completo ou personalizado) e os recursos extras: Prova online, Painel da Rede, Educador em Rede, Sala Conectada, Turma ao Vivo e os recursos de IA.

### Passo 1 · Cadastrar o município

Menu **Municípios** › **+ Novo Município**. Veja a seção [Cadastro completo do município](#cadastro-completo-do-município). Só o nome e a UF são obrigatórios, mas preencha tudo o que já tiver: os números da rede alimentam os painéis, as cotas de IA e o Simulador de preços.

Se preferir, o município também nasce sozinho na importação de escolas (passo 2). Nos dois casos ele começa com situação **Piloto**, **plano Básico** e moderação da rede em **Aprovação antes**.

### Passo 2 · Importar as escolas

Menu **Importar cadastros** › **Escolas**. Clique em **Baixar modelo**, preencha e cole a planilha (ou envie o arquivo). Colunas: `municipio ; uf ; escola ; inep`.

Confira depois na lista de Municípios se o município não nasceu duplicado por grafia diferente. O cadastro recusa outro município com o mesmo nome e UF, mas a importação compara pela grafia da planilha.

![Prévia da importação de escolas](s6-prev-esc.png){90}

Em **Escolas** › **Dados da escola**, complete INEP, CNPJ (o botão **Buscar** preenche com os dados da Receita), DDD e telefone, e-mail, CEP (preenche o endereço), número, complemento, bairro, diretor, coordenador e ato de criação. Esses dados saem nos relatórios, declarações, provas e documentos.

### Passo 3 · Configurar o plano do município

Menu **Municípios** › botão **Plano e módulos** na linha da rede.

| Campo | O que preencher |
|---|---|
| Nº do contrato / ata | Ex.: 045/2026 (é o mesmo campo da aba Contrato do cadastro) |
| Vigência até | Data de fim do contrato. **Sempre preencha**: é ela que corta o acesso quando o contrato vence |
| Situação do município | Piloto (teste), Ativo (contrato vigente) ou Inativo |
| Domínios de e-mail dos alunos | Só domínios exclusivos de alunos, separados por vírgula |
| O que fica liberado | Caixas por módulo, uma coluna para Professor e outra para Aluno |
| Secretaria de Educação | Painel da Rede |
| Recursos extras | Prova online, Educador em Rede, Sala Conectada e Turma ao Vivo |

Atalhos: **Plano básico**, **Plano intermediário**, **Plano completo**, **Limpar** e **Aluno igual ao professor**. O contador no alto mostra o nome do plano reconhecido (Básico, Intermediário, Completo ou Personalizado). Finalize com **Salvar plano**.

![Plano e módulos do município](plano-basico.png){85}

:::regra
- Município novo já nasce no plano Básico. Lista de módulos vazia (cadastros antigos) significa "todos liberados": marque explicitamente o que foi contratado.
- Domínios pessoais (gmail.com, hotmail.com, outlook.com, yahoo, live, icloud, bol, uol) são recusados como domínio de aluno.
- Um domínio não pode pertencer a dois municípios.
- Para o aluno, módulo fora do plano nem aparece. Para o professor, o contratado aparece grande no Início e o resto continua visível, menor, em "Conheça mais do Portal", com o botão "Tenho interesse".
- Os recursos de IA não ficam mais nesta tela: são liberados na **Central de IA**.
:::

Na lista de Municípios, envie também o **logo da prefeitura** (botão **Enviar**, ou **Trocar**). Passe o mouse no botão para ver o tamanho ideal: quadrado, 400 x 400 px, PNG com fundo transparente. Ele sai no cabeçalho das provas e dos documentos.

### Passo 4 · Importar a gestão e a equipe

**Importar cadastros** › **Gestão e equipe**. Colunas: `nome ; email ; perfil ; municipio ; escola`.

| Perfil na planilha | Vira | Escolas |
|---|---|---|
| Gestor, diretor, coordenador, vice | Gestor da escola | Até 5 |
| Secretaria escolar, escriturária, administrativo | Secretaria escolar | 1 |
| Portaria, porteiro, inspetor | Portaria | 1 |
| Secretaria de Educação, SEMED, técnico da secretaria | Secretaria de Educação | Deixe a escola vazia |

### Passo 5 · Importar os professores

**Importar cadastros** › **Professores**. Colunas: `nome ; email ; municipio ; escolas`. Mais de uma escola na mesma célula: separe com `|`. A escola pode ser o nome ou o INEP.

- Quem ainda não entrou no Portal vira **pré-cadastro** e entra já aprovado no primeiro acesso com o e-mail importado.
- Quem já entrou (por exemplo, em teste grátis) é aprovado e vinculado na hora.
- A equipe NEWPC recebe um e-mail-resumo dos pré-cadastros em até 15 minutos.

![Prévia da importação de professores](s7-prev-prof.png){90}

### Passo 6 · Liberar os alunos

São três formas, que podem conviver:

| Forma | Como | Resultado |
|---|---|---|
| Pela matrícula | A escola cadastra o aluno na **Ficha do Aluno**, na turma | O aluno entra por **código + PIN** (cartão com QR) e pode ter o Google da escola vinculado na própria ficha |
| Por domínio | Cadastrar o domínio no Plano (passo 3) | Qualquer conta Google do domínio vira aluno do município, **sem escola e sem turma** |
| Por lista | **Importar cadastros** › **Alunos**, colunas `nome ; email ; municipio ; escola ; turma` | Aluno entra com escola e turma |

:::atencao
A **Prova online** e a **Turma ao Vivo** trabalham com a matrícula da turma. Se a turma não tiver alunos na Ficha do Aluno, o professor recebe "A turma ... ainda não tem alunos matriculados. Cadastre na Ficha do Aluno." Contas antigas que entraram só pelo domínio não aparecem até terem escola e turma.
:::

### Passo 7 · Calendário, turmas e gestão escolar

- A Secretaria de Educação monta o **calendário letivo** da rede (Aplicativos › Calendário) e as **regras de notas e frequência mínima**. Os gestores ajustam o calendário da escola.
- As turmas seguem o nome padrão da rede (etapa + letra, sem digitação livre) e não aceitam duplicadas.
- A Direção monta a **grade** de cada turma (professor por disciplina e dias da semana).
- A gestão cadastra as famílias e decide quais avisos às famílias ligar.
- Se contratados: equipamentos e contratos com SLA, etiquetas QR, pareamento das TVs e totem da portaria.

### Passo 8 · Créditos de IA e acervo da rede

1. Se o plano tiver Portal IA (Intermediário, Completo ou personalizado), lance os créditos de implantação da rede na **Central de IA** e confira o teto por professor.
2. Em **Acervo** › **Acervo por município**, monte a árvore de pastas da rede (estrutura modelo ou cópia de outro município) e coloque o material da NEWPC que fizer parte do contrato.
3. Em **Materiais da rede**, confirme com a Secretaria o modo de moderação (aprovação antes ou moderação depois).

### Passo 9 · Conferir e comunicar

1. Use **Entrar como...** para ver o Início como professor, aluno, gestor e Secretaria da rede.
2. Abra o Painel da Rede da Secretaria.
3. Teste um login real de cada perfil.
4. Comunique a rede: todos entram em `app.portaldoeducador.com.br/entrar/` com o Google, com o link de acesso por e-mail ou com a senha (opção "Tenho senha"). Para alunos com conta Google, divulgue `app.portaldoeducador.com.br/entrar/?como=aluno`; alunos pela matrícula usam o cartão com QR.

### Suspender ou encerrar uma rede

1. Abra o **Cadastro** do município e use **Arquivar município** (aba Identificação). Deixe marcada a opção **Ao arquivar, encerrar a vigência hoje**: a data é o que corta o acesso dos professores; a situação sozinha não corta.
2. O município some das listas e o Portal do Aluno fica bloqueado. Os dados ficam guardados e o backup semanal continua.
3. Para voltar, marque **Mostrar arquivados** na lista e clique em **Reativar**: a situação e a vigência anteriores voltam.
4. Se quiser impedir novos alunos, retire também o domínio de alunos em Plano e módulos.

## Cadastro completo do município

Menu **Municípios** › **+ Novo Município** ou botão **Cadastro** na linha da rede. A janela tem quatro abas:

| Aba | Campos | Quem vê |
|---|---|---|
| Identificação | Nome *, UF *, código IBGE (7 dígitos), CNPJ da Prefeitura, CNPJ da Secretaria / Fundo de Educação, endereço da Secretaria, CEP, telefone, e-mail institucional, site da Prefeitura | Quem tem cadastro no município |
| Pessoas | Prefeito(a) e mandato; Secretário(a) de Educação; Ponto focal técnico (TI da rede); Gestor do contrato (Lei 14.133, art. 117); Fiscal do contrato. Cada um com nome, e-mail e telefone | 🔒 Só o administrador |
| Contrato | Nº do contrato / ata, vigência início e fim, modalidade (pregão eletrônico, adesão a ata, concorrência, dispensa, inexigibilidade, outra), processo / edital, valor total, valor mensal, nota de empenho, objeto e observações | Nº e vigência: o Portal usa para a licença. Valores, processo e empenho: 🔒 só o administrador |
| Rede e IDEB | Escolas, alunos, professores e ano do Censo; último IDEB (anos iniciais, anos finais, ensino médio) e a edição | Usado nos painéis, nas cotas de IA e nas propostas |

<!-- captura: janela de cadastro do município na aba Contrato, com as quatro abas visíveis -->

:::regra
- O Portal confere o IBGE (7 dígitos), os dois CNPJ (dígitos verificadores), a vigência (o fim não pode vir antes do início) e o IDEB (0 a 10).
- Nome e UF iguais a outro município já cadastrado são recusados.
- Trocar o nome ou a UF atualiza sozinho o nome copiado nas escolas e turmas.
- A lista mostra o plano reconhecido, os módulos (professor e aluno), o nº do contrato, a vigência (com o selo "vencido") e, embaixo do nome, escolas, alunos e IDEB.
:::

### Arquivar ou excluir

Ao editar, a aba Identificação mostra o bloco **Arquivar ou excluir**:

- **Arquivar município**: tira das listas e bloqueia o Portal do Aluno; o histórico fica guardado e dá para reativar.
- **Excluir de vez**: só funciona sem escolas, turmas e usuários ligados. O Portal pede para digitar o nome do município. Os domínios de aluno e a parte privada do cadastro também são apagados.

## Planos e recursos

### O que cada plano libera

| | Básico | Intermediário | Completo |
|---|---|---|---|
| Conteúdos (Atividades, Vídeos, Jogos, Datas, Colorir, Histórias, Biblioteca, Museus, Dicas, Aplicativos) | ✅ | ✅ | ✅ |
| Formação Continuada, Portal 360º VR, Portal Maestro | | ✅ | ✅ |
| Portal IA | | ✅ só texto | ✅ texto e imagens |
| Provas e Avaliações, Central de Relatórios, Gestão Escolar | | | ✅ |
| Prova online | | | ✅ |
| Painel da Rede (Secretaria) | | | ✅ |
| 🤝 Educador em Rede | ✅ | ✅ | ✅ |
| 🎒 Sala Conectada | | ✅ | ✅ |
| 📡 Turma ao Vivo | | | ✅ |

Lousa, Calendário e Notícias não dependem do plano: aparecem sempre. Qualquer combinação diferente dos atalhos vira plano **Personalizado** (com IA só de texto, se ligada na Central de IA).

### Os recursos da sala conectada

| Recurso | O que faz | Padrão |
|---|---|---|
| 🤝 Educador em Rede | Compartilhamento de materiais entre os professores da rede (vitrine "Da sua rede", Novidades no Início, resumo diário por e-mail e envio por e-mail) | Todos os planos |
| 🎒 Sala Conectada | Envio de conteúdos digitais aos alunos (materiais, links, documentos e vídeos até 20 MB), com histórico de aulas no Portal do Aluno | Intermediário e Completo |
| 📡 Turma ao Vivo | Presença digital e acesso dos alunos aos conteúdos em tempo real; vídeos até 100 MB e envio para a rede inteira por escola e série | Completo |

Enquanto o plano do município não for salvo de novo, essas três caixas seguem o padrão do plano. Depois do primeiro **Salvar plano**, vale o que estiver marcado.

### Recursos exclusivos por professor

Para liberar algo **só para um professor**, por cima do plano do município: **Usuários** › **Gerenciar** › bloco **Recursos exclusivos deste professor**.

- **Professor da rede**: aparecem só os módulos e recursos que o município não tem (Prova online, Educador em Rede, Sala Conectada, Turma ao Vivo e os módulos fora do plano). Os outros professores continuam vendo esses itens em "Conheça mais".
- **Licença avulsa**: escolha o pacote em **Recursos liberados (pacote)** (Básico, Intermediário ou Completo) e marque o que ele recebe a mais. Prova online não entra no avulso, porque depende de turmas da rede.
- Se o município passar a ter o recurso, a exceção do professor deixa de ser necessária e sai da lista.
- Recursos de IA do professor: libere na **Central de IA**, não aqui.

![Recursos exclusivos na ficha do professor](usr-extras.png){80}

### Portal IA por plano

| Plano do município | Portal IA | Imagens | Provas com IA | Lousa IA |
|---|---|---|---|---|
| Básico | Não | Não | Não | Não |
| Intermediário / Personalizado | Sim | Não | Sim | Básica |
| Completo | Sim | Sim | Sim | Básica e Ultra |

Esse é o padrão. Na Central de IA dá para ajustar caixa por caixa, por rede e por professor.

## Central de IA e créditos

Menu **Central de IA**. Aqui se decide **quem pode usar** cada recurso de IA e **quanto cada um pode gastar**. Os créditos são pré-pagos: sem crédito, a IA não roda, e não há surpresa na fatura.

<!-- captura: Central de IA com os indicadores no topo, o bloco Redes com Portal IA e a tabela "1 · Recursos (chave geral)" -->

### Como o crédito funciona

- Cada rede tem uma **carteira** (a bolsa da rede). Cada professor pode ter a sua, comprada à parte.
- Cada lançamento vira um **pacote com validade** (padrão: 12 meses). O consumo tira primeiro do pacote que vence antes.
- Preços padrão: **1 material = 1 crédito**, **1 ajuste com a IA = 1 crédito**, **1 imagem = 5 créditos**. A Lousa Ultra soma a aula e as ilustrações escolhidas; o professor vê o custo antes de gerar.
- A rede paga primeiro, até o **teto por professor** no mês (padrão: 60 créditos; 0 = sem teto). Bateu o teto ou acabou o saldo da rede, o Portal usa os créditos próprios do professor, se ele tiver.
- **Alertas automáticos** por e-mail para a NEWPC e para a Secretaria quando o saldo da rede chega a 20% e a 5%.
- O administrador usa a IA sem gastar créditos de ninguém (o custo fica registrado na conta interna da NEWPC).

### O que a tela mostra

| Bloco | O que tem |
|---|---|
| Indicadores | Créditos ativos nas carteiras, consumo do mês, custo real de IA no mês (Google Gemini, em reais), custo real por crédito e pedidos aguardando |
| Pedidos de recarga | Data, quem pediu, pacote, valor, com **Liberar** e **Cancelar** |
| Lançar créditos | Conta (rede ou professor, ou "Outro professor (pelo e-mail)..."), créditos, validade em meses e observação (nº do empenho, NF, Pix) |
| Redes com Portal IA | Saldo, situação (barra e %), vencimento, uso e custo no mês, **Teto por professor** com **Salvar**, e **+ Créditos** |
| Professores com créditos avulsos | Saldo, vencimento, uso no mês e **+ Créditos** |
| ✨ Central de IA | Quem pode usar cada recurso (abaixo) |
| Preços e pacotes | Créditos por material, ajuste e imagem; teto padrão; alertas 1 e 2 (%); validade; dólar; pacotes da rede e do professor |

### Quem pode usar cada recurso

O bloco **✨ Central de IA** tem três partes, salvas juntas em **Salvar Central de IA**:

1. **Recursos (chave geral)**: Portal IA, Imagens, Provas com IA, Lousa IA Básica e Lousa IA Ultra. **Ligado** desmarcado: ninguém usa. **Compra avulsa** marcada: o professor que tem créditos próprios usa mesmo sem a rede ter liberado (ele paga).
2. **Redes**: uma linha por município, com o saldo e uma caixa por recurso. Os botões **Intermediário**, **Completo** e **Nenhum** aplicam o pacote de uma vez; depois ajuste caixa por caixa. "Seguindo o plano" quer dizer que a rede ainda não foi ajustada à mão.
3. **Professores (avulsos e exceções)**: digite o e-mail ou o nome em **Adicionar professor pelo e-mail ou nome** (o Portal sugere enquanto você digita), clique em **Adicionar**, marque os recursos e salve. A liberação vale só para a pessoa, paga com os créditos dela.

:::regra
A Ultra inclui a Básica: marcar a Lousa IA Ultra marca a Básica; desmarcar a Básica desmarca a Ultra.
:::

### Recargas

1. A **Secretaria** pede pelo Painel da Rede (**Solicitar recarga**). O **professor avulso** pede no Portal IA (**Comprar créditos**). Cada conta pode ter até 3 pedidos aguardando.
2. O pedido aparece em **Pedidos de recarga**. Rede: libere depois do empenho. Professor avulso: libere depois do pagamento (Pix ou boleto enviado por e-mail).
3. Clique em **Liberar**: o formulário **Lançar créditos** já vem preenchido. Complete a observação (nº do empenho ou do pagamento) e clique em **Lançar créditos**.
4. O pedido fica como aprovado e quem pediu recebe um e-mail. Pedido que não vai seguir: **Cancelar** (pede confirmação).

Para crédito de cortesia ou de implantação, use **Lançar créditos** direto, sem pedido, e registre o motivo na observação.

## Simulador de preços

Menu **Simulador de preços**. Serve para preparar a proposta comercial e o Termo de Referência de um município.

1. **Município**: escolha um município cadastrado (o Portal conta alunos, escolas e professores já cadastrados), uma estimativa pronta ou digite os números.
2. **Contrato**: **Portal avulso** ou **Junto da locação NEWPC** (na locação, o plano Básico sai sem custo) e o prazo em meses.
3. **Preço por aluno/mês** de cada plano.
4. **Itens à parte**: implantação (única), créditos de IA (por ano), turmas de formação de 4 h e valor por turma.
5. **Custos da NEWPC** (para a margem): infra por aluno/mês, suporte e acompanhamento, impostos e comissão.

O resultado mostra três cartões (Básico, Intermediário e Completo) com valor mensal, anual, por professor, 1º ano com itens à parte, total do contrato, margem da licença e o enquadramento: **Cabe em dispensa (art. 75, II)** ou **Pregão eletrônico, de preferência com Ata de Registro de Preços**. Clique num cartão para ver a tabela de itens. Use **Copiar para planilha** ou **Imprimir / PDF**.

:::atencao
Os valores de partida são hipóteses para discussão. Antes de propor, confira a faixa de preços de contratos parecidos no PNCP (a prefeitura vai fazer essa pesquisa). O limite de dispensa soma tudo do mesmo ramo no ano: se a prefeitura já contratou algo parecido, o espaço é menor. O último cenário fica guardado só neste navegador.
:::

<!-- captura: Simulador de preços com os três cartões de plano e a tabela de itens -->

## Uso real

Menu **Uso real**. Mostra quem **usou** o Portal na semana, isto é, quem fez uma ação de valor, e não só quem entrou. Os números são calculados toda madrugada; para atualizar na hora, clique em **Recalcular agora** (leva alguns minutos).

- Filtros: **Município** (ou Todos) e **Semana** (as últimas 12; a atual aparece como "em andamento").
- Indicadores: professores que usaram (e o %), quem entrou e não fez nada, ações de valor na semana e horas economizadas.
- Gráfico de 12 semanas com o % de professores que usaram.
- Tabela **O que foi feito**: material gerado no Portal IA, aula da Lousa salva, prova do Gerador salva, prova online aplicada, prova de aluno corrigida automaticamente, conteúdo enviado para a turma, material enviado às famílias e material reaproveitado da rede.
- **Por município** (clique no nome para abrir) e, dentro do município, **Por escola**.

:::atencao
As horas economizadas são **estimativa**: quantidade de ações vezes os minutos por ação da tabela. Ajuste os minutos com quem conhece a rotina do professor e clique em **Salvar minutos**. Ao mostrar para cliente, diga sempre que é estimativa.
:::

<!-- captura: Uso real com os quatro indicadores, o gráfico de 12 semanas e a tabela por município -->

## Usuários e licenças

Menu **Usuários**. As abas organizam o trabalho do dia a dia:

| Aba | O que mostra |
|---|---|
| Aguardando aprovação | Cadastros pendentes (o menu mostra um contador laranja) |
| Institucionais | Professores vinculados às redes |
| Avulsos e teste | Licenças avulsas, testes e cortesias |
| Vencendo / vencidas | Licenças a vencer em 30 dias e vencidas |
| Desativados | Acessos desligados |
| Gestão e equipe | Gestores, Secretaria de Educação, secretaria escolar e portaria |
| Todos | Todos os cadastros, menos alunos |
| Pré-cadastrados | Importados que ainda não fizeram o primeiro acesso |
| Alunos | Contas de aluno e pré-cadastros de aluno |

![Lista de usuários](s1-lista.png){90}

### Aprovar e vincular

O botão **Aprovar e vincular** (ou **Gerenciar**) abre a ficha do cadastro:

- **Situação**: Aprovado, Em análise ou Recusado / desativado.
- **Perfil** e **Município**.
- **Licença**: Institucional (contrato do município), Avulsa (venda direta), Teste grátis ou Cortesia. Para avulsa: plano (mensal, semestral, anual, pacote por escola, personalizado), início, validade, valor, referência do pagamento e **Recursos liberados (pacote)**.
- **Escolas** (até 5) e **Turmas**.
- **Recursos exclusivos deste professor** (veja Planos e recursos).

![Ficha de aprovação e licença](s14-licenca.png){85}

:::dica
Quando o professor de teste informa um município atendido, a lista mostra a etiqueta "Município atendido: X". Para trazê-lo para a rede, mude a licença para **Institucional** e marque as escolas.
:::

### Cadastro manual e senha provisória

Para quem não tem Google ou não consegue entrar:

- **+ Novo usuário**: nome, e-mail, perfil, município, escolas e turmas (aluno: escola, turma e a matrícula da Ficha do Aluno). Ao clicar em **Cadastrar e gerar senha**, o Portal mostra uma senha provisória.
- **🔑 Senha provisória** (na ficha do usuário): gera uma nova senha para quem esqueceu.
- **Contas sem cadastro**: lista quem criou conta (Google ou e-mail e senha) mas não tem cadastro no Portal, com o botão **Cadastrar**.

:::regra
A senha provisória aparece uma vez só, vale 24 horas e a pessoa troca no primeiro acesso. Passe a senha por um canal direto com a pessoa, nunca em grupo. A Secretaria e a direção da escola também podem gerar senhas provisórias.
:::

### Venda avulsa

O professor que se cadastra sozinho ganha 7 dias de teste. O aviso de fim do teste e a tela de licença vencida levam a um botão de WhatsApp da NEWPC com mensagem pronta. Depois do pagamento (por link), o administrador abre o cadastro, muda a licença para **Avulsa**, escolhe o plano e o pacote e salva. O professor toca em **Já paguei, verificar** e o acesso volta. Créditos de IA do avulso são vendidos à parte (Central de IA).

## Módulos do Portal

Menu **Módulos do Portal**. Aqui fica a situação **global** de cada um dos 19 botões, válida para todas as redes:

| Situação | Efeito |
|---|---|
| Em breve | Aparece com cadeado para todos (padrão) |
| Liberado | Abre o link informado |
| Oculto | Some da tela (o admin ainda vê, com o selo "🔒 Oculto") |

Os links internos aceitos são `#acervo`, `#videos`, `#jogos`, `#portalia`, `#provas`, `#relatorios`, `#formacao`, `#museus`, `#dicas`, `#colorir`, `#biblioteca`, `#historias`, `#datas`, `#atividades`, `#apps`, `#gestao` e `#dicasaluno`. Links externos precisam começar com `https://`. Finalize com **Salvar alterações**.

![Módulos do Portal](s10-modulos.png){90}

:::regra
Um botão aparece liberado para o professor só quando está **Liberado** aqui **e** marcado no plano do município (ou nos recursos exclusivos dele). Para o aluno, também precisa estar marcado na coluna Aluno do plano. A trava vale também dentro das telas: quem abre o endereço direto de um módulo fora do plano vê o cadeado.
:::

## Publicar conteúdo

### Notícias e pesquisas rápidas

Menu **Notícias**. Tipos: Notícia, Podcast, Ação, Novidade no Portal e Pesquisa rápida.

| Campo | Observação |
|---|---|
| Título | Na pesquisa, é a pergunta |
| Chamada curta | Aparece no destaque do Início |
| Opções de resposta | Pesquisa: de 2 a 5 |
| Resposta identificada | Marcado: a NEWPC vê nome e escola. Desmarcado: anônima, só totais |
| Matéria completa, link, imagem | Links do YouTube e do Spotify viram player. A imagem vira capa |
| Quem vê | Professores e equipe, alunos, ou ambos |
| Período e Municípios | Sem municípios marcados, vale para todos |
| ⭐ Fixar no topo | A notícia aparece com o selo "em destaque" |
| Publicar | Sai do rascunho |
| 🔔 Abrir em pop-up ao entrar | Abre sozinha uma vez por entrada |
| 🌐 Pode ser compartilhada fora do Portal (link público) | Cria o link público da notícia |

![Formulário de notícia com pesquisa e pop-up](pesquisa-admin.png){85}

**Destaque no Início.** As notícias no ar aparecem no topo do Início, com foto grande, uma por vez, trocando sozinhas até a pessoa mexer. Cada pessoa reage num toque e pode compartilhar.

**Compartilhar.** O botão **↗ Compartilhar** abre WhatsApp, E-mail, Copiar link, Mais opções e **Instagram / TikTok**.

- Notícia com **link público**: qualquer pessoa abre, mesmo sem conta (`app.portaldoeducador.com.br/noticia/?id=...`). Ela também entra na seção Notícias da página inicial do Portal. Só vão para fora título, texto, foto, mídia e data; a notícia original continua fechada.
- Sem link público: o link pede para entrar no Portal.
- **Instagram / TikTok**: o Portal monta uma imagem vertical (formato Stories, como capa de revista: foto na tela toda, marca no alto, título grande e convite) e copia o link para colar na legenda ou no adesivo de link. No celular abre o menu de compartilhar do aparelho; no computador, baixa a imagem.

<!-- captura: janela Compartilhar notícia com os botões WhatsApp, E-mail, Copiar link e Instagram / TikTok -->
<!-- captura: imagem vertical gerada para Instagram/TikTok -->

:::regra
- O pop-up abre no máximo uma vez por entrada e some para a pessoa quando ela responde ou fecha.
- Depois da primeira resposta, as opções e a identificação da pesquisa ficam travadas, para não misturar resultados.
- Pesquisa nunca tem link público.
- Desmarcar o link público, tirar do ar ou excluir a notícia apaga a cópia pública: o link para de funcionar.
- Pesquisas identificadas podem ser baixadas em planilha (Baixar respostas).
:::

### Datas Comemorativas e kits

Menu **Datas Comemorativas**. O catálogo base (datas nacionais e de MS) entra pelo botão **Importar catálogo base (nacionais e MS)**. Cada data tem nome, tema, nível (nacional ou estadual), regra de data (dia fixo, dia da semana do mês ou ligada à Páscoa), duração, antecedência no Início (padrão 21 dias), texto para o professor, curiosidade para o aluno e lei ou origem.

Para montar o kit, use **Abrir e montar kit**: o cartão "Montar o kit" permite buscar e adicionar atividades, arquivos, vídeos, jogos, livros e desenhos que já estão no Portal.

![Administração de datas e kit](data-admin.png){85}

### Atividades (Banco Curricular)

As atividades em PDF vieram do Google Drive e são classificadas automaticamente por etapa, componente, ano, BNCC e tipo. No módulo Atividades (no Início do professor, agora em "Mais recursos"), o administrador vê dois botões a mais:

- **➕ Adicionar atividade**: envia PDF, PNG ou JPG (até 60 MB cada), com etapa, componente, anos, tipo e BNCC. Dá para mandar vários arquivos com as mesmas etiquetas.
- **🔄 Buscar novidades no Drive**: traz o que foi colocado nas pastas do Drive desde a última vez.

Dentro de cada atividade, o administrador corrige título, anos, tipo e BNCC, publica ou oculta, e exclui. A exclusão é definitiva: a atividade não volta na sincronização.

![Edição de atividade pelo administrador](at-admin.png){85}

### Vídeos e Jogos

| Catálogo | Como cadastrar |
|---|---|
| Vídeos | Cole o link do YouTube e clique em **Buscar** (título e capa vêm sozinhos). Informe faixa de séries, componente, duração, tema, canal, BNCC, sugestão de uso, **Posição na tela** e quem pode ver. Na lista, **🎬 Em cartaz** coloca o vídeo no topo da página Vídeos (só vídeo publicado) |
| Jogos | Link do jogo, nome, descrição curta, faixa, componente, tema, capa (link ou **Enviar imagem**), ícone, BNCC, quem pode ver, **Posição na tela**, **Destaque** e **Abrir em nova aba**. **Trazer como rascunho** importa os jogos do site que ainda não estão no catálogo |

**Posição na tela** tem três níveis: **1 · Aparece primeiro**, **2 · Normal** e **3 · Vai para o fim**. A posição manda; dentro da mesma posição, os novos vêm primeiro.

**Selo Novo.** Vídeo ou jogo recém-publicado ganha o selo **Novo no Portal** por 15 dias, contados da primeira publicação, e vai para o começo da sua posição. As abas **Novos** da lista mostram quais estão com o selo.

Todos funcionam com rascunho: salve, confira e publique. **Editar** abre o formulário numa janela no meio da tela; **Fechar** ou Esc volta para a lista.

<!-- captura: janela de edição de vídeo com o campo Posição na tela e o aviso do selo Novo no Portal -->

### Biblioteca e Histórias Educativas

A Biblioteca tem estantes (livros, audiolivros, aprender, gibiteca e histórias). Em `/biblioteca/`, o administrador usa o botão **➕ Adicionar** para enviar títulos em qualquer estante (PDF, CBZ para gibis, MP3/M4A para audiolivros, até 300 MB). Títulos vindos da Biblioteca antiga passam pela **triagem** (`/biblioteca/#triagem`), onde se registra o tipo de licença e a comprovação antes de importar.

![Administração da Biblioteca](bib-admin.png){85}

:::atencao
Só publique obras de domínio público, com licença aberta, licenciadas ou próprias da NEWPC, sempre com a comprovação registrada. Personagens e marcas de terceiros não entram.
:::

### Moderação de dicas

As Dicas do Professor chegam por e-mail à equipe e ficam em **Dicas recebidas** (`/dicas/#recebidas`) para revisão e publicação. As Dicas do Aluno ficam em `/dicas/?aluno=1#recebidas`; a versão publicada mostra só o primeiro nome e a escola do aluno.

## Acervo

Os arquivos do acervo ficam no Storage do Firebase. Menu **Acervo**, com duas abas: **Acervo do Portal (todos)** e **Acervo por município**. Na tela do professor, cada arquivo tem **Ver** e **Baixar** (o arquivo original, para editar).

### Acervo do Portal (todos)

Material da NEWPC que vale para todas as redes, organizado pelo botão do Portal.

- **Adicionar arquivos**: escolha o **Botão do Portal**, a disciplina, as etapas e as habilidades BNCC (valem para todos os arquivos do envio), depois **Escolher arquivos** (até 100 MB cada), ajuste o título de cada um e envie.
- **Vincular arquivos do servidor NEWPC**: para arquivos que já estão no Nextcloud. Cole um caminho por linha, a partir da pasta principal (ex.: `01-Acervo-NEWPC/Atividades/Anos-Iniciais/Frações 3º ano.pdf`) e clique em **Vincular ao acervo**.
- **Arquivos no acervo**: busca, **Abrir**, **Publicar** / **Ocultar** e **Excluir**.

<!-- captura: aba Acervo do Portal (todos) com as abas no alto, o painel da cópia, Adicionar arquivos e Vincular arquivos do servidor NEWPC -->

### Acervo por município

Cada rede tem o seu acervo, que só os professores daquele município veem (em Acervo, "Da minha rede"). A Secretaria envia o material da rede; o administrador define as pastas e coloca o material da NEWPC.

1. Na aba **Acervo por município**, escolha o **Município**.
2. Em **🌳 Estrutura de pastas**, monte a árvore (até 4 níveis e 400 pastas):
   - **Usar estrutura modelo**: cria Documentos oficiais (Leis, decretos e resoluções; Calendário escolar; Regimento e PPP), Currículo e referenciais (Educação Infantil, Anos Iniciais, Anos Finais, EJA), Modelos e formulários (Planejamento; Relatórios e fichas; Avaliações), Formação de professores, Projetos da rede e Livros e obras. Só aparece quando o município ainda não tem pastas.
   - **Copiar estrutura de...**: escolha outro município e clique em **Copiar**. As pastas que faltam são criadas; as que já existem ficam.
   - Em cada pasta: **+ Subpasta**, **Renomear**, ↑ e ↓ para ordenar e **Excluir** (só pasta vazia e sem subpastas).
   - **+ Pasta principal** cria uma pasta no primeiro nível.
3. Em **Adicionar arquivos da NEWPC**, escolha a pasta, a disciplina, as etapas e a BNCC. Para mandar o mesmo arquivo a outras redes, abra **Copiar também para outros municípios** e marque as redes: o arquivo vai para a pasta de mesmo nome em cada uma (se ela não existir, o Portal cria).
4. Marque a declaração de direitos e de que os arquivos **não contêm dados pessoais de alunos**, escolha os arquivos (até 100 MB cada) e envie. Também dá para adicionar um **link** (Drive, site, YouTube) em vez de arquivo.
5. Em **Arquivos da rede**, os itens aparecem dentro das pastas, com **Ver**, **Renomear**, **Mover**, **Publicar** / **Ocultar** e **Excluir**. Arquivo sem pasta aparece em "Sem pasta": use **Mover** para organizar.

<!-- captura: Acervo por município com a árvore de pastas montada e os botões + Subpasta, Renomear, setas e Excluir -->

:::regra
- O material colocado pela NEWPC leva o selo **NEWPC**. A Secretaria vê, mas não consegue renomear, mover, ocultar nem excluir: aparece "Mantido pela NEWPC".
- Cada rede tem 2 GB de espaço por padrão. A barra de uso aparece no topo; para aumentar, acione a equipe técnica.
- Com pastas, a categoria do arquivo sai da pasta principal. O professor navega pelas pastas; se a rede só tem material próprio, a tela dele já abre nas pastas.
:::

### Cópia para o servidor NEWPC (Nextcloud)

Um robô copia o acervo do Firebase para o servidor da NEWPC (Nextcloud), **toda madrugada**, só com o que for novo. Entram as atividades, a biblioteca, os desenhos para colorir, os materiais da Formação e o acervo de cada município (na pasta `03-Acervo-Municipios/{município}/{pastas}`). Renomear ou mover uma pasta no Portal move também no Nextcloud, na rodada seguinte. O original continua no Firebase: nada é apagado.

O painel **☁️ Cópia para o servidor NEWPC**, no alto da aba Acervo do Portal, mostra:

- o percentual copiado, arquivos copiados de quantos e o tamanho;
- a situação: **Copiando agora**, **Cópia parcial: falta rodar de novo** ou **Cópia concluída**, com a hora da atualização;
- uma linha por tipo (Atividades, Biblioteca, Para colorir, Formação continuada, Acervos dos municípios);
- arquivos com erro na última rodada (entram de novo na próxima) e o resultado da última conferência (quantos conferem com o original, faltando ou com tamanho diferente).

Clique em **Atualizar** para ler de novo. O Painel › Infraestrutura também mostra se o servidor está no ar e quantos arquivos ele entregou.

<!-- captura: painel Cópia para o servidor NEWPC com a barra de progresso e a tabela por tipo -->

## Materiais da rede (moderação)

Menu **Materiais da rede**. É onde se confere o que os professores compartilham com a rede (Portal IA e Meus trabalhos). Quem modera: o administrador (qualquer rede), a Secretaria de Educação (a rede inteira) e o gestor (só o que vem das escolas dele).

1. Escolha o **Município** no alto.
2. Confira o modo da rede em **Como os materiais entram na rede**:
   - **✋ Aprovação antes**: o material só aparece para os colegas depois que a Secretaria ou a gestão da escola aprova. Quem modera recebe um e-mail a cada material novo.
   - **⚡ Publica direto, modera depois**: o material aparece na hora; a moderação oculta ou retira depois. Com 3 denúncias de colegas, ele sai sozinho da vitrine.
3. Use as abas **Aguardando**, **Com denúncia**, **Publicados**, **Ocultos** e **Tudo**, e a busca (título, professor, escola, disciplina).
4. **Aprovar** direto na lista, ou **Conferir** para ler o conteúdo e as denúncias.
5. Na conferência: **Aprovar**, **Pedir ajuste** (pendente) ou **Ocultar** (publicado), ou **Retirar da rede** (pede confirmação). Para ocultar ou retirar, a **Observação para o professor** é obrigatória e vai no e-mail para ele.

:::regra
- Só o administrador e a Secretaria trocam o modo. Município novo nasce em **Aprovação antes**; municípios antigos sem a escolha ficam em **Publica direto, modera depois**.
- Retirar da rede não apaga o original: ele continua na conta do professor.
- Material oculto só volta para a vitrine com nova aprovação.
:::

<!-- captura: tela Materiais da rede com o seletor de município, os dois modos e a aba Aguardando -->

## Painel do administrador

Menu **Painel**, com seis abas. **Todo número, barra e linha é clicável**: abre uma janela com os dados de onde ele saiu (quem é, município, situação, datas), com busca, **Exportar planilha (CSV)** e o botão **Abrir cadastro** em cada pessoa, que leva direto ao cadastro na tela Usuários. O ícone 🔎 ao lado do título indica o que é clicável.

| Aba | O que mostra |
|---|---|
| Pessoas e uso | Cadastros, testes, conversão, licenças vencendo, aguardando aprovação, alunos, quem acessou (hoje e em 7 dias, com os botões abertos), cadastros e acessos por dia (clique na barra do dia), professores por estado, **pessoas por perfil**, **entradas por tela** (da Auditoria, com IP), botões mais abertos, recursos mais pedidos fora do plano, arquivos do acervo mais abertos e últimos cadastros; **Aulas abertas agora** (Turma ao Vivo: turma, professor e horário de término) |
| Portal IA e créditos | Usos, créditos consumidos e custo estimado do mês; **redes com saldo baixo** (20% ou menos); **pedidos de recarga pendentes**; alertas de saldo; usos por tipo; quem mais consumiu; e a tabela de **contas de créditos** (clique numa conta para ver os movimentos: quando, quem, quanto e em quê) |
| Sala Conectada e rede | Educador em Rede (compartilhados, publicados, **aguardando aprovação**, ocultos, com denúncia, por município); envios para a turma, entradas de alunos pelo cartão QR e envios às famílias, com gráfico por dia; **Turma ao Vivo agora e app do Maestro** (aulas abertas neste momento e downloads do app do aluno nos últimos 30 dias, com quem baixou; contagem desde 01/11/2026) |
| Conteúdo e participação | Rede atendida, conteúdo publicado, Novidades em uso, **acervo dos municípios** (arquivos, material NEWPC, por município), **O que a rede procura** (veja abaixo), participação e as pendências com atalho. Cada cartão abre a lista do banco (até 1.000 itens); **Provas online · correção** (provas esperando correção, pendentes há mais de 7 dias, correções finalizadas e reavaliações de nota com justificativa); **Comunicados por e-mail** (no mês, e-mails enviados e falhas, fila e quem pediu para não receber); **Formação Continuada · acompanhamento** (professores e cursistas, em andamento, **pararam no meio**, concluíram e ainda não começaram, cada um com a lista). As **Pendências** ganham "correção pendente há mais de 7 dias" e "comunicado com falhas" |
| Infraestrutura e custos | Leituras e gravações do banco, armazenamento, funções e erros, **registros de auditoria por dia** (clique no dia para ver o que aconteceu), Servidor NEWPC e atalhos para os consoles |
| 💾 Backup | Backup manual e semanal automático |

![Painel do administrador](s15-painel.png){85}

:::nota
A rede de demonstração (Rede Modelo) foi apagada; as demonstrações usam o município Laboratório NEWPC.
:::

:::dica
A tabela "Interesse por município" é argumento de venda: mostra quantos professores de cada rede tocaram em "Tenho interesse" num recurso que o plano não tem. Exportada em CSV, vai direto para a conversa de ampliação do contrato.
:::

:::regra
Envios para a turma, avisos às famílias e entradas por tela vêm da **Auditoria**, que começou em 01/11/2026. Antes dessa data não há registro nominal desses eventos. O Painel lê os dados direto do banco a cada abertura; quando a base passar de uns 2 mil usuários, a NEWPC vai ligar um resumo calculado pelo servidor para manter a tela rápida e barata.
:::

### Comunicados por e-mail

Menu **Sistema › ✉️ Comunicados por e-mail**. Mensagem para a rede cadastrada, separada por público, enviada pela conta **comunicados@portaldoeducador.com.br** (Webnode), aos poucos e separada dos e-mails do sistema.

<!-- captura: tela Comunicados por e-mail com Para quem, a caixa azul de contagem e a lista Enviados e agendados -->

| Campo | Para quê |
|---|---|
| Tipo | **Informativo** (respeita quem pediu para não receber) ou **Aviso de serviço** (vai para todos) |
| Para quem | Professores, Gestão da escola (direção e coordenação), Secretaria de Educação e Alunos; municípios (nenhum = todos) e escola (com um município marcado) |
| Situação na Formação | Professores e gestão: **ainda não começaram**, **começaram e não concluíram**, **pararam no meio** (14 dias sem avançar) ou **concluíram**. É a campanha que mais gera certificado |
| Licença dos professores | **Contrato da rede**, **Avulsa**, **Teste** e **Cortesia** (nenhuma = todas). Licença vencida fica de fora, a não ser que marque **Incluir licenças vencidas** (oferta de renovação) |
| Sem município | Na lista de municípios, **Sem município (professores avulsos)** alcança quem não está ligado a uma rede. Sem nenhum município marcado, os avulsos já entram |
| Caixa azul | Quantas pessoas recebem, por público; quantas não têm e-mail; quantas pediram para não receber; tempo estimado |
| Assunto, Mensagem, Botão | O e-mail começa com "Olá, nome!" e sai com a identidade do Portal |
| Enviar em | Agenda o envio (até 60 dias) |

- **Enviar teste para mim** manda só para o seu e-mail, com [TESTE] no assunto.
- **Enviar comunicado** pede confirmação com o número de pessoas. Se o público mudar entre a contagem e o envio, o Portal pede para conferir de novo.
- **Enviados e agendados**: progresso, falhas (**Ver falhas** baixa CSV) e **Cancelar**.
- **Configuração do envio**: servidor, porta, conta, nome do remetente e **envios por hora**. A senha não fica no Portal: está no Secret Manager do Google (`COMUNICADOS_SMTP_SENHA`).
- Comunicado informativo traz no rodapé "Não quer mais receber?". A pessoa confirma numa página (um clique automático de antivírus não descadastra) e pode voltar a receber pelo mesmo link.
- Tudo fica na **Auditoria**: criar, testar, cancelar, concluir e quem pediu para não receber.

:::regra
Alunos só recebem avisos escolares, nunca conteúdo comercial. Só recebe quem tem conta ativa e e-mail no cadastro (quem entra só pelo cartão QR não tem e-mail). Ver POP-PDE-30.
:::

### O que a rede procura

Na aba **Conteúdo e participação**, o bloco **O que a rede procura** mostra o que professores e gestores digitaram na busca do Início no mês: total de buscas, **procuraram e não acharam**, quantos abriram um resultado, municípios buscando e quantos conteúdos estão na busca.

- **Mais procurados** e **Procurados e não achados**: clique no termo para ver os números por município.
- Os termos aparecem sem acento e em minúsculas, do jeito que são somados ("educacao financeira").
- Nada identifica a pessoa: só o termo e os contadores, por município. Números longos (CPF, telefone, matrícula) nem são guardados. Cada mês fica guardado por 13 meses.
- **Atualizar o índice da busca agora**: refaz na hora a lista de conteúdos da busca (ela se refaz sozinha a cada 2 horas, das 6h às 22h). Use depois de publicar muitos conteúdos de uma vez. A ação fica na Auditoria.

:::dica
"Procurados e não achados" é a pauta de produção de conteúdo: o que os professores querem e o Portal ainda não tem. Por município, é argumento para a conversa com a Secretaria ("seus professores procuraram alfabetização 300 vezes este mês").
:::

### Backup

Na aba **💾 Backup**:

1. Crie uma pasta num **Drive compartilhado** e adicione o robô (o e-mail aparece na tela) como Gerente de conteúdo.
2. Cole o link da pasta e clique em **Salvar e testar**.
3. Marque o backup semanal automático (domingo de madrugada).

Também é possível fazer **backup agora** (só o banco ou completo, com arquivos) e **baixar no computador** (link válido por 7 dias). A restauração é feita pelo suporte técnico.

No topo da aba fica o card **🖥️ Servidor NEWPC**: a cópia da **aplicação inteira** (banco, contas de login, código e todos os arquivos) que um robô faz toda madrugada no servidor da NEWPC, cifrada, com 30 cópias diárias e 12 mensais e **teste de restauração** todo dia 2. O card mostra o último backup e o resultado do último teste; o botão **Fazer agora pelo GitHub** roda o robô na hora. Procedimento completo no POP-PDE-29.

![Configuração do backup](backup.png){85}

:::atencao
O pacote de backup contém dados pessoais (LGPD). Guarde só em Drive compartilhado da NEWPC, com acesso restrito.
:::

## Auditoria

Menu **Sistema** › **Auditoria**. É a trilha de tudo o que acontece no Portal. Quem grava é o servidor: ninguém consegue apagar nem editar um registro, nem o administrador.

### O que entra

| Ação | O que registra |
|---|---|
| Entrou no Portal | Data, hora, IP, navegador e a tela. Vale para todas as telas com login, inclusive a Formação Continuada, uma vez por sessão do navegador em cada tela |
| Criou, Alterou, Excluiu | Qualquer cadastro ou registro: usuários, municípios, escolas, turmas, alunos e fichas, notas, frequência, relatórios, provas online, Portal IA, créditos, acervo, notícias, vídeos, jogos, configurações e outros |
| Abriu/baixou | Arquivos abertos ou baixados no Acervo |

Em cada alteração, o registro guarda **quais campos** mudaram. O valor de antes e de depois só aparece nos campos de controle (perfil, situação, município, escola, turma, licença, notas, faltas, presença, créditos, título, pasta e similares). Senha, PIN, token e chaves nunca são guardados. Contadores e dados técnicos (presença ao vivo, estatísticas) ficam de fora.

### Como consultar

1. Escolha o período em **De** e **Até** (o padrão são os últimos 7 dias).
2. Se quiser, filtre por **Ação**, **Município** ou **Pessoa (e-mail)**.
3. Clique em **Buscar**. Vêm até 300 registros por vez, do mais novo para o mais antigo; use **Carregar mais** até acabar.
4. Para afinar o resultado, use a caixa **Filtrar o resultado** (o quê, campo, IP, documento).
5. Clique em **Exportar planilha (CSV)** para baixar o que está na tela, com as colunas Quando, Quem, Ação, Onde, Documento, Município e Detalhe.

<!-- captura: tela Auditoria com os filtros De, Até, Ação, Município, Pessoa e a tabela de registros -->

:::atencao
O banco aplica só um filtro por vez, nesta ordem: Pessoa, depois Município, depois Ação. Os outros filtros valem sobre os registros já carregados. Para não perder nada numa consulta com dois filtros, carregue tudo com **Carregar mais** antes de exportar.
:::

### Retenção

Os registros ficam guardados por **6 meses** e depois se apagam sozinhos (Marco Civil da Internet, art. 15). Fatos com mais de 6 meses não estão mais na trilha: se um caso precisa de prova por mais tempo, exporte o CSV e guarde junto com o processo.

### Usar para responder um ofício

1. Registre o pedido: número do ofício, quem pediu, o que pediu e o período.
2. Leve à direção da NEWPC antes de enviar qualquer dado.
3. Faça a consulta com o período e o filtro certos (a pessoa ou o município), carregue tudo e exporte o CSV.
4. Confira o arquivo: entregue só o que foi pedido, sobre a rede que pediu.
5. Responda por escrito, anexando o CSV, e guarde o ofício, a resposta e o arquivo na pasta da rede no Drive NEWPC.

:::regra
Registros de acesso (IP, data e hora de entrada) de uma pessoa só são entregues a terceiros com **ordem judicial** (Marco Civil, arts. 10 e 15). Pedido da Secretaria sobre o que foi feito na própria rede (quem alterou uma nota, quem excluiu um cadastro) pode ser atendido depois da aprovação da direção da NEWPC, sempre com o mínimo de dados pessoais (LGPD).
:::

## Documentação e Ajuda

Menu **Documentação**. É a estante dos manuais, POPs, documentos técnicos e aplicativos. Os documentos marcados para **Todos os usuários** aparecem na tela **Ajuda**, que todos os perfis têm no menu, sempre na versão mais nova.

![Documentação do administrador](docs-admin.png){85}

### Publicar um documento novo

1. Clique em **+ Novo documento**.
2. Preencha **Título**, **Categoria** (Manuais, POPs, Técnico, Aplicativos ou Outros), **Código** (opcional, ex.: POP-PDE-01), **Quem pode ver** (Só a equipe NEWPC ou Todos os usuários), **Versão** e descrição.
3. Escolha o arquivo: PDF ou aplicativo Android (APK), até 80 MB.
4. Clique em **Publicar**.

### Publicar uma nova versão

1. Na linha do documento, clique em **Nova versão**.
2. Confira a **Versão** (o Portal sugere a seguinte, ex.: 1.1) e escreva **O que mudou** (ex.: inclusão do POP 18).
3. Escolha o novo PDF e clique em **Publicar**.

A versão nova passa a ser a que abre em **Abrir** e **Baixar**. As anteriores ficam em **Histórico** (até 30), cada uma com **Abrir**. **Editar** muda título, categoria, código e descrição sem trocar o arquivo; **Excluir** apaga o documento e todas as versões (pede confirmação).

:::regra
- APK fica sempre só para a equipe NEWPC e sempre é baixado, nunca aberto. Para os professores, o app do Maestro fica em **Aplicativos Úteis › App do Maestro**, que baixa sempre a versão mais nova publicada pelo robô do Maestro.
- Quem pode ver é escolhido na criação e não muda nas versões seguintes.
- A equipe técnica também publica pelo script `publicar-documento` (Parte 3).
:::

## Guia rápido de suporte

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Professor importado entra e cai no teste grátis | Entrou com outro e-mail | Conferir em Usuários › Pré-cadastrados; corrigir o e-mail e reimportar, ou vincular manualmente |
| Pessoa sem Google não consegue entrar | Não recebeu o link de acesso por e-mail ou não tem senha | Pedir para usar o link por e-mail (conferir a caixa de spam) ou gerar **Senha provisória** em Usuários |
| Conta existe mas a pessoa não aparece em Usuários | Criou a conta sem cadastro no Portal | Usuários › **Contas sem cadastro** › **Cadastrar** |
| Professor ou aluno da rede perdeu o acesso de repente | A data de fim do contrato passou ou o município foi arquivado | Municípios › Cadastro (aba Contrato) ou Plano e módulos › Vigência até; Mostrar arquivados › Reativar |
| Professor em teste sem acesso | Os 7 dias acabaram | Usuários › licença avulsa, cortesia ou institucional |
| Aluno com e-mail da escola cai como professor em teste | Domínio não cadastrado | Plano e módulos › Domínios de e-mail dos alunos |
| Professor não consegue se cadastrar com o e-mail institucional | O domínio dele está cadastrado como domínio de aluno | Separar domínio de professor e de aluno |
| Aluno sem botões no Início | Rede inativa, vencida ou sem módulos de aluno no plano | Plano e módulos |
| Botão "Em breve" para todos | Módulo não liberado no catálogo geral | Módulos do Portal |
| Recurso com cadeado só para um professor | Fora do plano do município | Plano e módulos, ou Usuários › Recursos exclusivos deste professor |
| Portal IA: "O Portal IA faz parte dos planos Intermediário e Completo" | Rede no plano Básico ou recurso desligado para a rede | Central de IA › Redes, ou venda de créditos avulsos ao professor |
| Portal IA: "Gerar imagens faz parte do plano Completo" | Rede sem Imagens liberadas | Central de IA › Redes › Imagens |
| Portal IA: "Os créditos da sua rede acabaram" | Saldo da rede zerado | Pedir à Secretaria a recarga pelo Painel da Rede; liberar em Central de IA › Pedidos de recarga |
| Portal IA: "Você chegou ao limite mensal de créditos da rede" | Teto por professor atingido (renova no dia 1º) | Aumentar o teto da rede em Central de IA, se a Secretaria pedir, ou o professor compra créditos avulsos |
| Lousa: "licença ainda não está habilitada para este recurso" | Aula com IA desligada para a rede ou o professor | Central de IA › Lousa IA Básica / Ultra (e a chave geral ligada) |
| Recarga não aparece para liberar | Pedido cancelado ou já liberado | Central de IA › Professores ou Redes (conferir saldo) |
| Material compartilhado não aparece para os colegas | Rede em "Aprovação antes" e material aguardando, ou material oculto | Materiais da rede › Aguardando / Ocultos |
| Material sumiu da vitrine da rede | Recebeu 3 denúncias ou foi ocultado | Materiais da rede › Com denúncia; conferir e aprovar se estiver correto |
| Professor não vê o acervo da rede | Arquivo oculto ou da outra rede | Acervo › Acervo por município › Publicar |
| Secretaria não consegue mexer num arquivo do acervo | É material da NEWPC ("Mantido pela NEWPC") | Alteração só pelo administrador |
| Acervo da rede: "não cabe no espaço" | Cota de 2 GB atingida | Excluir o que não serve ou pedir aumento à equipe técnica |
| Cópia para o servidor NEWPC parcial ou com erro | Rodada interrompida | A próxima rodada da madrugada completa; persistindo, acionar a equipe técnica |
| Prova online: "não está incluída no plano da sua rede" | Recurso não contratado | Plano e módulos › Recursos extras › Prova online, ou recurso exclusivo do professor |
| Prova online: "A turma ... ainda não tem alunos matriculados" | Turma sem alunos na Ficha do Aluno | A escola cadastra os alunos na Ficha do Aluno |
| Aluno não acha a prova | Está em outra turma ou entrou com outra conta | Conferir a matrícula e o cartão do aluno; aplicar a prova de novo |
| Aluno bloqueado na prova | Saiu da prova além dos avisos | O professor dá nova chance no painel ao vivo |
| Nota não aparece para o aluno | O professor guardou a nota até o fechamento do bimestre ou o horário não terminou | O professor usa **Mostrar notas já** |
| Aluno não aparece na Turma ao Vivo | Aula fechada, aluno em outra turma ou rede sem Turma ao Vivo | Abrir a aula pelo Dar aula agora; conferir a matrícula, o Plano e os módulos |
| Chromebook não entra sozinho na aula | Extensão do Maestro antiga (abaixo de 0.9) ou aluno sem conta do Portal | Atualizar a extensão (Google Admin ou chrome://extensions); entrar pelo número da aula enquanto isso |
| Tablet não vai para a aula | App do Maestro abaixo de 1.2 ou aula fechada | Instalar o app 1.2 pelo cartão **App do Maestro**; abrir a aula |
| Entrada por QR não abre a câmera | Câmera bloqueada no navegador, em uso por outro app, ou app do Maestro antigo | Liberar a câmera; atualizar o app do Maestro (1.2.0 ou mais novo) |
| Link da notícia pede para entrar | Notícia sem link público | Notícias › Editar › marcar 🌐 link público e salvar |
| Família não recebe aviso | Tipo de aviso desligado, família sem e-mail ou sem aceite, limite diário | Configuração de avisos da escola e cadastro da família |
| Nenhum e-mail automático sai | Limite da conta de envio ou senha revogada | Acionar a equipe técnica (Parte 3) |
| TV aparece offline | Sem sinal há mais de 15 minutos | Rede e energia da TV; recarregar a página da TV |
| Etiqueta QR não deixa abrir chamado | Já existe chamado aberto para o equipamento | O gestor resolve o chamado anterior |
| Painel da Rede: "ainda não faz parte do plano" | Painel não contratado | Plano e módulos › Painel da Rede |
| Formação: "contrato vencido" ou "fora do plano" | Vigência vencida ou Formação fora do plano | Plano e módulos |
| Certificado: "CPF já vinculado a outra conta" | CPF usado em outra conta | Suporte confere com o professor |
| Admin novo barrado na Formação | O papel de admin da Formação ainda não chegou ao token | Administrador do Portal ganha o papel sozinho: saia e entre de novo. Editor de curso (que não é admin do Portal) continua sendo nomeado no painel da Formação |
| Auditoria: erro ao buscar | Índice do banco ainda sendo criado | Tentar de novo em alguns minutos |
| Precisa saber quem alterou um cadastro ou uma nota | | Auditoria › filtrar por município ou pessoa e período |
| Tela nova com erro de permissão | O front foi publicado antes das regras | Equipe técnica publica as regras |
