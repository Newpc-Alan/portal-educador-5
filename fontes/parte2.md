# Parte 2 · Manual da equipe NEWPC

Esta parte é para quem implanta, opera e dá suporte ao Portal: administradores, implantação, comercial e atendimento. Tudo começa em `www.portaldoeducador.com.br/entrar/` com uma conta de perfil **Administrador**.

## O menu do administrador

O menu fica dividido em cinco grupos. Cada grupo abre e fecha com um toque no título, e o Portal lembra neste aparelho quais grupos você deixou fechados.

| Grupo | Item do menu | Para que serve |
|---|---|---|
| Visão geral | Painel | Números de uso, conteúdo, infraestrutura e backup |
| | Uso real | Quantos professores **usaram** o Portal na semana (não só entraram) e as horas economizadas |
| | Painel da Rede (secretarias) | Abre o painel que a Secretaria de Educação vê |
| | Início (prévia) | Mostra o Início como o professor ou o aluno vê |
| | Simulador de preços | Monta o preço do Portal para um município (planos, itens e enquadramento) |
| Redes e cadastros | Redes contratantes | Cadastro completo das redes (municipal, estadual, particular, instituição ou cidade), plano, módulos, recursos, domínios de aluno e equipamentos |
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
| | Financeiro | Abre `/financeiro/` (só aparece para quem tem acesso; o dono é alan@newpc.com.br) |

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

Menu **Redes contratantes** › **+ Nova rede contratante**. Veja a seção [Cadastro completo do município](#cadastro-completo-do-município). Só o nome e a UF são obrigatórios, mas preencha tudo o que já tiver: os números da rede alimentam os painéis, as cotas de IA e o Simulador de preços.

Se preferir, o município também nasce sozinho na importação de escolas (passo 2). Nos dois casos ele começa com situação **Piloto**, **plano Básico** e moderação da rede em **Aprovação antes**.

### Passo 2 · Importar as escolas

Menu **Importar cadastros** › **Escolas**. Clique em **Baixar modelo**, preencha e cole a planilha (ou envie o arquivo). Colunas: `municipio ; uf ; escola ; inep`.

Confira depois na lista de Municípios se o município não nasceu duplicado por grafia diferente. O cadastro recusa outro município com o mesmo nome e UF, mas a importação compara pela grafia da planilha.

![Prévia da importação de escolas](s6-prev-esc.png){90}

A importação ignora escola com o mesmo nome no município ("Já cadastrada"), mas não reconhece grafias diferentes (ex.: "Cívico-Militar Maj." e "Cívico-militar - Maj."). Achou duplicada? Abra **Dados da escola** na que sobra e use o quadro **Excluir ou juntar escola** (no fim do formulário):

1. Em **Juntar com**, confira a escola certa (o Portal já sugere a de nome parecido no mesmo município).
2. Toque em **Excluir escola**: o primeiro toque mostra quantas pessoas vão mudar de escola; toque de novo em até 8 segundos para confirmar.
3. Professores e pré-cadastros passam para a escola escolhida e a duplicada é excluída.

:::regra
Escola com turmas ou alunos não sai por aqui. Com pessoas ligadas e nada escolhido em **Juntar com**, o Portal também não exclui: ninguém fica sem escola.
:::

Em **Escolas** › **Dados da escola**, complete INEP, CNPJ (o botão **Buscar** preenche com os dados da Receita), DDD e telefone, e-mail, CEP (preenche o endereço), número, complemento, bairro, diretor, coordenador e ato de criação. Esses dados saem nos relatórios, declarações, provas e documentos.

### Passo 3 · Configurar o plano do município

Menu **Redes contratantes** › botão **Plano e módulos** na linha da rede.

| Campo | O que preencher |
|---|---|
| Nº do contrato / ata | Ex.: 045/2026 (é o mesmo campo da aba Contrato do cadastro) |
| Vigência até | Data de fim do contrato. **Sempre preencha**: é ela que corta o acesso quando o contrato vence |
| Situação do município | Piloto (teste), Ativo (contrato vigente) ou Inativo |
| Domínios de e-mail dos alunos | Só domínios exclusivos de alunos, separados por vírgula |
| O que fica liberado | Caixas por módulo, uma coluna para Professor e outra para Aluno |
| Secretaria de Educação | Painel da Rede |
| Recursos extras | Prova online, Educador em Rede, Sala Conectada e Turma ao Vivo |
| Confirmação de entrada na escola | **Desligada** (some a Portaria, a auditoria e a portaria na chamada; as carteirinhas continuam, porque também servem para entrar no Portal), **Só QR** (carteirinha, sem foto: o totem não liga a câmera) ou **QR + câmera** (o totem pode tirar a foto, se a escola ligar em cada totem). **Reconhecimento facial** aparece como em breve. Sem escolha gravada, vale QR + câmera |
| Chamada com dupla confirmação | Ligada (padrão): no dia em que a turma tem entradas na portaria, a chamada do professor já vem marcada e o que ele mudar contra a portaria pede motivo, que vai para a Auditoria. Desligada: a chamada só mostra quem passou |

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

- Quem ainda não entrou no Portal vira **pré-cadastro** e entra já aprovado no primeiro acesso com o e-mail importado. No primeiro acesso, o professor passa pela **atualização cadastral obrigatória** (CPF, nascimento, WhatsApp, escolas, anos, etapas e disciplinas) e só depois o Portal abre.
- A coluna `escolas` pode ficar vazia (ex.: contas Google da rede sem a escola organizada): o professor entra ligado só ao município e escolhe as escolas na atualização cadastral.
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

1. Se o plano tiver Portal IA (Intermediário, Completo ou personalizado), a **franquia mensal** entra sozinha conforme os professores fazem o primeiro acesso (ver Central de IA). Créditos extras (implantação, cortesia) vão em **Lançar créditos**; use a coluna **Créditos por educador** para dimensionar.
2. Em **Acervo** › **Acervo por município**, monte a árvore de pastas da rede (estrutura modelo ou cópia de outro município) e coloque o material da NEWPC que fizer parte do contrato.
3. Em **Materiais da rede**, confirme com a Secretaria o modo de moderação (aprovação antes ou moderação depois).

### Passo 9 · Conferir e comunicar

1. Use **Entrar como...** para ver o Início como professor, aluno, gestor e Secretaria da rede.
2. Abra o Painel da Rede da Secretaria.
3. Teste um login real de cada perfil.
4. Mande o convite de primeiro acesso por **Comunicados por e-mail**, público **Pré-cadastrados que ainda não entraram**, um comunicado por rede com o nome do município (POP-PDE-30). Avise a Secretaria antes: e-mail de domínio de fora na conta institucional tem mais chance de ser ignorado.
5. Comunique a rede: todos entram em `www.portaldoeducador.com.br/entrar/` com o Google, com o link de acesso por e-mail ou com a senha (opção "Tenho senha"). Para alunos com conta Google, divulgue `www.portaldoeducador.com.br/entrar/?como=aluno`; alunos pela matrícula usam o cartão com QR.

### Suspender ou encerrar uma rede

1. Abra o **Cadastro** do município e use **Arquivar município** (aba Identificação). Deixe marcada a opção **Ao arquivar, encerrar a vigência hoje**: a data é o que corta o acesso dos professores; a situação sozinha não corta.
2. O município some das listas e o Portal do Aluno fica bloqueado. Os dados ficam guardados e o backup semanal continua.
3. Para voltar, marque **Mostrar arquivados** na lista e clique em **Reativar**: a situação e a vigência anteriores voltam.
4. Se quiser impedir novos alunos, retire também o domínio de alunos em Plano e módulos.

## Cadastro completo do município

Menu **Redes contratantes** › **+ Nova rede contratante** ou botão **Cadastro** na linha da rede. Na mesma cidade podem existir clientes separados (a rede municipal, a rede estadual e um colégio particular), por isso o cadastro começa pelo **tipo de rede**: **Municipal**, **Estadual**, **Particular**, **Instituição** ou cidade. O tipo muda os rótulos (endereço da Secretaria, da mantenedora ou da instituição), os documentos, as carteirinhas, os painéis, os e-mails e os textos de LGPD em todo o Portal. O botão **Equipamentos** da linha abre o inventário da rede. A janela tem quatro abas:

| Aba | Campos | Quem vê |
|---|---|---|
| Identificação | Nome *, UF *, código IBGE (7 dígitos), CNPJ da Prefeitura, CNPJ da Secretaria / Fundo de Educação, endereço da Secretaria (CEP, logradouro, número, complemento e bairro: o CEP preenche a rua e o bairro e avisa se for de outra cidade), telefone, e-mail institucional, site da Prefeitura | Quem tem cadastro no município |
| Pessoas | Prefeito(a) e mandato; Secretário(a) de Educação; Ponto focal técnico (TI da rede); Gestor do contrato (Lei 14.133, art. 117); Fiscal do contrato. Cada um com nome, e-mail e telefone | 🔒 Só o administrador |
| Contrato | Nº do contrato / ata, vigência início e fim, modalidade (pregão eletrônico, adesão a ata, concorrência, dispensa, inexigibilidade, outra), processo / edital, valor total, valor mensal, nota de empenho, objeto e observações | Nº e vigência: o Portal usa para a licença. Valores, processo e empenho: 🔒 só o administrador |
| Rede e IDEB | Histórico do Censo Escolar ano a ano (escolas, alunos, professores) e do IDEB edição a edição (anos iniciais, anos finais, ensino médio), com ▲ ou ▼ em relação à edição anterior | O ano mais recente de cada um é o usado nos painéis, nas cotas de IA e nas propostas |

<!-- captura: janela de cadastro do município na aba Contrato, com as quatro abas visíveis -->

:::regra
- O Portal confere o IBGE (7 dígitos, começando pelo código da UF: MS = 50), os dois CNPJ (dígitos verificadores), a vigência (o fim não pode vir antes do início) e o IDEB (0 a 10).
- Telefones, CEP, e-mails e site seguem o padrão de cadastro (veja abaixo). O nome do município fica sem "Município de" ou "Prefeitura Municipal de": "MUNICIPIO DE BONITO" vira "Bonito".
- Nome e UF iguais a outro município já cadastrado são recusados.
- Rede e IDEB: digite o ano e os números e toque em **+ Guardar no histórico**; o que estiver nos campos ao salvar também entra. A edição do IDEB precisa ser um ano ímpar a partir de 2005 (o IDEB sai a cada dois anos). Para corrigir um ano já guardado, digite o ano dele: os números voltam para os campos. O ✕ tira o ano do histórico.
- Trocar o nome ou a UF atualiza sozinho o nome copiado nas escolas e turmas.
- A lista mostra o plano reconhecido, os módulos (professor e aluno), o nº do contrato, a vigência (com o selo "vencido") e, embaixo do nome, escolas, alunos e IDEB.
:::

### Padrão de cadastro (vale para toda a plataforma)

Todo cadastro do Portal grava os dados num formato só, para a base não ficar com cada registro de um jeito. O Portal corrige sozinho o que dá para corrigir e não deixa salvar o que está errado.

| Dado | Como fica gravado | O Portal corrige sozinho | O Portal recusa |
|---|---|---|---|
| Telefone | (67) 3255-1351, (67) 99999-0000, 0800 067 0053 ou 4004-1234 | Falta de parênteses ou espaço, +55, 0 + operadora | Sem DDD, DDD que não existe, número curto, fixo começando com 1 |
| WhatsApp | (67) 99999-0000 (ou fixo com DDD) | O mesmo do telefone | Também recusa 0800 e números únicos (4004, 3003...), que não têm WhatsApp |
| CEP | 79290-000 | Só números | Menos ou mais de 8 números |
| CPF e CNPJ | 123.456.789-09 · 03.073.673/0001-60 | Só números | Dígitos verificadores errados |
| NIS e Cartão SUS (ficha do aluno) | NIS com 11 números; SUS com 15 | Só números | Tamanho errado; NIS com dígito verificador errado |
| E-mail | Tudo em minúsculas | Maiúsculas e espaços | Sem @ ou sem domínio completo (ex.: nome@municipio) |
| Site | https://www.municipio.ms.gov.br | Falta do https:// | Endereço sem domínio |
| Nomes de pessoas | Maria da Silva | Nome todo em MAIÚSCULAS ou todo em minúsculas | Não recusa |

Onde vale: Municípios (dados e pessoas), Escolas, primeiro cadastro do professor, Meu cadastro, novo usuário, importação de professores e equipe, Ficha do Aluno e responsáveis, Famílias, Servidores, Equipe de apoio e abertura de chamado pelo QR do equipamento. O campo errado fica vermelho e a mensagem diz o formato certo. Nomes de alunos não são mexidos, para continuarem iguais aos do Censo.

Nas janelas de cadastro, clicar fora da janela não fecha mais (a janela balança para mostrar que continua aberta): feche em **Cancelar** ou salve. Assim ninguém perde o que já digitou por um clique sem querer.

Os cadastros feitos antes desse padrão continuam como estavam até alguém abrir e salvar de novo; aí passam pela mesma conferência.

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
- Preços padrão (nov/2026, margem de 200% sobre o custo real): **material do Portal IA = 2**, **ajuste = 1**, **Aula IA da Lousa = 6**, **Aula avançada = 24**, **imagem (inclusive Pintor e ilustração da Lousa Ultra) = 6**, **texto (questões, quiz, Perguntar, Circular, Mapa) = 1**, **vídeo interativo por link = 3**. Todos editáveis em **Preços e pacotes** (a Aula avançada tem mínimo 1). O professor sempre vê o custo antes de gerar.
- **Grátis com uso justo** (a NEWPC absorve o custo, centavos por uso): Termômetro da turma (60 por professor por dia), Pareceres da turma (150 por dia), Passar a limpo (100 por dia), Legendas, Aulas prontas e vídeos interativos do catálogo. Os limites ficam em `config/portal_ia` (`termometro_dia`, `parecer_dia`, `limpo_dia`); o custo continua medido no ranking de IA.
- A rede paga primeiro, até o **teto por professor** no mês, que é o **dobro da franquia** do plano. Bateu o teto ou acabou o saldo da rede, o Portal usa os créditos próprios do professor, se ele tiver.
- **Franquia incluída na licença**: todo dia às 3h15 o Portal soma na carteira de cada rede ativa com plano de IA a franquia (**educadores de rede ativos × franquia**: 60 no Intermediário e no Personalizado, 120 no Completo). Desde 08/11/2026 a franquia **acumula até o fim do contrato** (vence na vigência, não mais no fim do mês). O botão **Conferir a franquia do mês** (em Redes com Portal IA) mostra quanto cada rede vai receber e aplica na hora.
- Quando o crédito do Google (a conta da IA) se esgota, o professor vê uma mensagem honesta, sem desconto de crédito, e o Alan recebe um e-mail de alerta (no máximo 1 a cada 6 horas).
- Só a **licença institucional** usa a carteira da rede. Professor avulso, de cortesia ou em teste usa sempre a própria carteira, mesmo com o município no cadastro.
- **Demonstração no teste**: quem se cadastra sozinho (teste de 7 dias) ganha **10 créditos** na carteira própria, válidos até o fim do teste, uma vez por e-mail. **Plano Gratuito**: quem está no Gratuito ganha **10 créditos por mês** (`creditos.gratuito_mes` em config/portal_ia; 0 desliga), válidos até o fim do mês, uma vez por e-mail e por mês. A rotina `gratuitoVencidos` passa de hora em hora quem teve o teste ou a licença avulsa vencida para o Gratuito; `gratuitoCreditosMes` dá os créditos todo dia 1º. Em Usuários, o tipo de licença **Gratuito (permanente)** pode ser escolhido à mão. Ajuste ou desligue (0) em **Preços e pacotes**.
- **Alertas automáticos** por e-mail para a NEWPC e para a Secretaria quando o saldo da rede chega a 20% e a 5%.
- O administrador usa a IA sem gastar créditos de ninguém (o custo fica registrado na conta interna da NEWPC).

### O que a tela mostra

| Bloco | O que tem |
|---|---|
| Indicadores | Créditos ativos nas carteiras, consumo do mês, custo real de IA no mês (Google Gemini, em reais), custo real por crédito e pedidos aguardando |
| Pedidos de recarga | Data, quem pediu, pacote, valor, com **Liberar** e **Cancelar** |
| Lançar créditos | Conta (rede ou professor, ou "Outro professor (pelo e-mail)..."), créditos, validade em meses, **Tipo** (**Venda (empenho, NF, Pix)** ou **Cortesia da diretoria**) e observação (nº do empenho, NF, Pix ou motivo da cortesia) |
| Redes com Portal IA | **Educadores** (quantos já entraram e quantos importados aguardam o 1º acesso, só licença institucional), **Créditos por educador** (saldo ÷ educadores, com a sugestão de 15 por educador), saldo, situação (barra e %), vencimento, uso e custo no mês, **Teto por professor/mês** com **Salvar**, **+ Créditos** e **Pacotes** |
| Pacotes (botão da linha) | Cada pacote ativo: data, créditos, quanto resta, vencimento e origem (Pedido, Manual, Cortesia ou Compra). **Retirar** (dois toques) zera o que resta do pacote; o pacote fica guardado como retirado, para o histórico e o relatório de cortesias saberem quanto foi usado |
| Cortesias da diretoria | Créditos dados sem venda: créditos dados, já usados (e %), **custo real estimado** (custo médio por crédito da própria conta, em reais) e **valor de tabela** (quanto valeriam pelos pacotes de venda). Tabela com conta, data, créditos, usados, restam, vencimento, custo, valor e observação. Lançamentos manuais antigos com "cortesia" na observação também entram |
| Professores fora de rede | Todos os professores avulsos, de cortesia e em teste (e quem tem carteira própria): licença e vencimento, saldo, uso no mês, **+ Créditos** e **Pacotes**. O botão **Dar a demonstração a quem já está em teste** lança os 10 créditos para quem está em teste ativo e ainda não recebeu |
| ✨ Central de IA | Quem pode usar cada recurso (abaixo) |
| Preços e pacotes | Créditos por material, ajuste e imagem; teto padrão; alertas 1 e 2 (%); validade; dólar; demonstração do teste; **franquia mensal** por plano; pacotes da rede e do professor |

**Tabela de pacotes (nov/2026)**, com pelo menos o dobro do custo real (R$ 0,19 por crédito em out/2026):

| Pacote | Valor | Por crédito |
|---|---|---|
| Rede · 1.000 créditos | R$ 400 | R$ 0,40 |
| Rede · 5.000 créditos | R$ 1.900 | R$ 0,38 |
| Rede · 20.000 créditos | R$ 7.200 | R$ 0,36 |
| Professor · 100 créditos | R$ 49,90 | R$ 0,50 |
| Professor · 300 créditos | R$ 129,90 | R$ 0,43 |

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

Para crédito de cortesia ou de implantação, use **Lançar créditos** direto, sem pedido, com o **Tipo** **Cortesia da diretoria** e o motivo na observação: o lançamento entra no relatório **Cortesias da diretoria**. Para desfazer um lançamento, use **Pacotes** › **Retirar** na linha da rede ou do professor.

### Pagamento online pelo Asaas {: .nova }

O professor avulso compra a licença e os créditos sozinho, sem pedido à equipe.

| Etapa | O que acontece |
|---|---|
| Compra | O professor toca em **Comprar créditos** (Portal IA) ou em **Assinar** / **Renovar** (aviso de licença) e escolhe o item na janela **Pagamento seguro pelo Asaas**. Na primeira compra informa o CPF de quem paga |
| Cobrança | A função `pagamentos` cria o cliente e a cobrança no Asaas (vencimento em 3 dias) e abre a página de pagamento: Pix, boleto ou cartão |
| Confirmação | O Asaas avisa a função `asaasWebhook`. O Portal libera sozinho a licença (Intermediário R$ 59,90 ou Completo R$ 99,90 por 1 mês, somando ao que ainda resta) ou os créditos (12 meses), lança a venda no **Financeiro** (bruto, taxa e líquido) e a nota a emitir, e manda e-mail ao professor e ao Alan |
| Estorno ou contestação | O Portal marca o pedido, registra na auditoria do Financeiro e avisa o Alan por e-mail. A liberação **não** é desfeita sozinha: confira e retire à mão se for o caso |

- Professor de rede (licença institucional) não vê a compra de licença, só a de créditos.
- Cada professor pode ter até 5 cobranças aguardando pagamento.
- O CPF vai só para o Asaas; o Portal guarda apenas o CPF mascarado (`fin_clientes`).
- Com a **chave de teste** (sandbox), a compra direta só aparece para o administrador e para os e-mails em `config/pagamentos.testadores`; os demais seguem no pedido manual. Com a chave oficial, aparece para todos.
- A troca de chave e o cadastro do aviso de pagamento ficam no POP-PDE-37.

## Formação Continuada: Fábrica de cursos e cursos de rede {: .nova }

No painel editorial da Formação (menu **Formação Continuada**):

- **✨ Fábrica de cursos com IA**: informe o tema, o público, a carga horária (1 a 40 h), o nível, as orientações para a IA e, de preferência, o **material base** (texto da apostila ou PDF de até 7 MB) e, se quiser, o título. A IA monta o plano e escreve uma aula por vez, com passos no imperativo, atividade prática e questões, e faz uma segunda passada de revisão. O curso nasce como **rascunho**, com o aviso de revisão pendente: só publica depois que a equipe revisa (e sem trechos "[Conteúdo a completar"). Limite de 10 cursos por dia.
- **Quem pode ver este curso**: aberto a todos ou exclusivo de uma ou mais redes. O curso exclusivo aparece só para os professores daquelas redes, com o selo **Formação da sua rede**, e o certificado traz a Secretaria como promotora. Ele não entra na busca geral.
- **Nova versão**: ao publicar a versão nova de um curso, o progresso de quem estava no meio vai junto (aulas com os mesmos vídeos contam como feitas).
- **Em breve**: os cursos dos recursos do Portal ainda não publicados aparecem como **Em breve** na página da Formação e somem sozinhos quando o curso é publicado.
- **Lembretes**: dias úteis às 9h10, e-mail para quem parou um curso há 7 dias ou mais (no máximo 3 por curso, 14 dias entre eles).
- Cada curso do Portal tem capa própria; curso novo sem capa recebe uma das capas gerais pelo tema.

## Simulador de preços

Menu **Simulador de preços**. Serve para preparar a proposta comercial e o Termo de Referência de um município.

Os campos ficam em blocos no topo e o resultado embaixo.

1. **Município**: escolha um município cadastrado (o Portal conta alunos, escolas e professores já cadastrados), uma estimativa pronta ou digite os números.
2. **Contrato**: **Portal avulso** ou **Junto da locação NEWPC** (na locação, o plano Básico sai sem custo) e o prazo em meses. Na locação, o projeto é montado como **lista de itens**: Portal cobrado por sala, sala só com lousa, equipamento do aluno (tablet, Chromebook ou notebook), licença Google for Education, óculos VR e carrinho de recarga VR opcionais, com o resumo do projeto, o peso do Portal sobre a locação e o **preço para a margem desejada**. O modo avulso segue o mesmo formato (rede, preço, serviços em lista e resultado).
3. **Preço por aluno/mês** de cada plano. Padrão de nov/2026: Básico R$ 3, Intermediário R$ 6 e Completo R$ 10 (R$ 36, R$ 72 e R$ 120 por aluno/ano). Referências públicas encontradas em nov/2026: só gestão escolar entre ~R$ 30 e R$ 110 por aluno/ano; plataforma pedagógica com conteúdo e formação entre ~R$ 240 e R$ 660.
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

O professor que se cadastra sozinho ganha 7 dias de teste. Com o **pagamento online** ligado (Asaas), os botões **Assinar** e **Renovar** do aviso de fim do teste e da tela de licença vencida abrem a compra direta: a licença é liberada sozinha quando o pagamento é confirmado (veja "Pagamento online pelo Asaas" na Central de IA). Sem ele, os botões levam ao WhatsApp do Portal com mensagem pronta; depois do pagamento, o administrador abre o cadastro, muda a licença para **Avulsa**, escolhe o plano e o pacote e salva, e o professor toca em **Já paguei, verificar**.

O Portal manda e-mails automáticos ao professor: início do teste e 2 dias antes do fim, compra, renovação, licença vencendo e mudança de plano. Em **Gerenciar usuário**, o botão **E-mail de boas-vindas** (só administrador) reenvia o e-mail que cabe na situação do professor, no máximo 1 por dia.

### Aparelhos conectados

O aluno fica conectado em 1 aparelho por vez; professor e equipe, em até 3 (valores em `config/sessoes`). Quem passa do limite tem o aparelho mais antigo desconectado com aviso. A pessoa vê a lista em **Meu cadastro** e pode usar **Sair de todos os outros aparelhos**.

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

- Notícia com **link público**: qualquer pessoa abre, mesmo sem conta (`www.portaldoeducador.com.br/noticia/?id=...`). Ela também entra na seção Notícias da página inicial do Portal. Só vão para fora título, texto, foto, mídia e data; a notícia original continua fechada.
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

**Selo Novo.** Vídeo ou jogo recém-publicado ganha o selo **Novo** por 5 dias, contados da primeira publicação, e vai para o começo da sua posição. As abas **Novos** da lista mostram quais estão com o selo. Vídeos do canal do Portal do Educador recebem a marca **Produção própria**.

**Vídeo interativo do catálogo.** Todo vídeo publicado ganha, por padrão, a versão interativa gerada pela IA (perguntas nas pausas), grátis para o professor. No cadastro do vídeo há o interruptor para desligar a versão interativa; no painel, a situação de cada vídeo e o botão **Refazer IA**. Os avisos **⚑ Avisar problema** dos professores chegam para a equipe revisar a pergunta.

**Aulas prontas da Lousa.** O acervo oficial (temas transversais da BNCC, 1º ao 9º ano) é gerado em lote pelo administrador na própria Lousa (**Gerar o lote oficial**), uma aula por vez no servidor. Cada aula passa por revisão: **Aprovar**, **Voltar para revisão** ou **Tirar da rede**. Só as aprovadas aparecem para os professores, e o uso não gasta crédito.

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
- **Enviados e agendados**: progresso, falhas (**Ver falhas** baixa CSV), **Reenviar falhas** e **Cancelar**.
- **Reenviar falhas** (comunicado concluído com falhas): dois toques; quem não recebeu entra num comunicado novo igual ao original. E-mail inexistente fica de fora. Depois aparece "falhas reenviadas" e o botão some (ninguém recebe duas vezes).
- **Configuração do envio**: servidor, porta, conta, nome do remetente, **envios por hora** e **Máximo por dia** (padrão 700). A senha não fica no Portal: está no Secret Manager do Google (`COMUNICADOS_SMTP_SENHA`).
- **Limite diário da Webnode**: acima de um certo número de destinatários por dia, o servidor recusa com "Sending Prohibited (Max RcptTo Daily limit)". Isso não é falha da pessoa: o robô pausa 6 horas e continua de onde parou, e nunca passa do **Máximo por dia**. Em 03/11/2026 o limite chegou perto de 750 envios no dia.
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

Além do servidor da NEWPC, os mesmos pacotes cifrados vão para um **cofre fora da NEWPC no Google Cloud**, com trava contra apagamento (o robô só cria e lê). O teste mensal confere também o cofre, e o teste de restauração compara todas as coleções com a contagem feita na hora do backup. Um vigia diário manda e-mail se o backup não rodou, e o resumo diário da equipe traz a situação do backup.

No topo da aba fica o card **🖥️ Servidor NEWPC**: a cópia da **aplicação inteira** (banco, contas de login, código e todos os arquivos) que um robô faz toda madrugada no servidor da NEWPC, cifrada, com 30 cópias diárias e 12 mensais e **teste de restauração** todo dia 2. O card mostra o último backup e o resultado do último teste; o botão **Fazer agora pelo GitHub** roda o robô na hora. Procedimento completo no POP-PDE-29.

![Configuração do backup](backup.png){85}

:::atencao
O pacote de backup contém dados pessoais (LGPD). Guarde só em Drive compartilhado da NEWPC, com acesso restrito.
:::

## Monitoramento

O Portal registra os erros que acontecem no navegador dos usuários, confere a cada 15 minutos se o site e as funções estão no ar e manda um resumo diário por e-mail para a equipe.

## Atendimento WhatsApp {: .nova }

Menu **Sistema** › **Atendimento WhatsApp**. É a central do robô do Portal no WhatsApp, que se apresenta como **Lara, assistente virtual** (a mesma Lara que fica no canto da página principal no lugar do ícone do WhatsApp). A Lara entende áudio (a IA transcreve; o áudio não é guardado) e oferece um atalho direto para falar com atendente. número **(67) 9875-7275** (API oficial da Meta, número exclusivo do Portal). O botão verde **Fale conosco** do site, os botões comerciais do site e a Ajuda do Portal levam para ele.

O que o robô faz sozinho:

| Opção do menu | O que acontece |
|---|---|
| Dúvida sobre o Portal | Responde a partir do **Manual do Usuário**. Se a resposta não estiver no manual, não inventa: passa a conversa sozinho para alguém do Suporte |
| Problema em equipamento | Pede escola, equipamento e defeito, abre um chamado com **protocolo** e avisa a equipe por e-mail |
| Não consigo entrar | Se o número for de um cadastro do Portal, manda o link de acesso para o e-mail cadastrado (mostra o e-mail mascarado). Número desconhecido não recebe link |
| Falar com atendente | Passa a conversa, por rodízio, para alguém do setor Suporte, que recebe um e-mail de aviso |
| Portal na minha rede | Contato comercial: pede nome, cargo, instituição e município e passa para a equipe comercial (selo **comercial** na tela). Os botões do site ("Falar com um consultor", "Pedir uma proposta") e os de assinar ou renovar a licença caem direto aqui |

O robô como agente: antes de procurar no manual, ele entende o pedido e responde com os dados do Portal, só da própria pessoa (reconhecida pelo WhatsApp do cadastro):

| Pedido | O que o robô faz |
|---|---|
| "Até quando vale minha licença?", "a que escola estou ligado?" | Mostra situação, perfil, rede, escola e validade do acesso |
| "Não consigo entrar", "esqueci a senha" | Manda o link de acesso para o e-mail do cadastro |
| "Como está o protocolo AB12CD?" | Mostra a situação dos chamados abertos por aquele número |
| "A escola X já está cadastrada?" | Procura entre as escolas da rede da pessoa; se não achar, passa para o Suporte |
| Contratar, renovar, proposta | Vai para o Comercial |
| Pede uma pessoa ou reclamação | Vai para o Suporte |

Número que não é de nenhum cadastro não recebe dado algum.

**Avisos no celular da equipe.** Cada membro pode cadastrar um WhatsApp de avisos: ele recebe mensagem quando uma conversa precisa de atendente, quando alguém espera resposta e no primeiro contato do dia com a Lara. Todo cadastro novo com WhatsApp recebe a boas-vindas universal automática (modelo aprovado pela Meta, com nova tentativa de hora em hora se falhar). A tela mostra a situação de cada modelo de mensagem enviado à Meta e o botão **Enviar teste ao meu WhatsApp** (só administrador).

**App Atendimento PDE** (www.portaldoeducador.com.br/atendimento/, também em app Android, com o card para baixar por botão ou QR): a equipe atende pelo celular sem abrir o Portal. Abra o link no celular, use **Adicionar à tela inicial** (no iPhone: Compartilhar › Adicionar à Tela de Início), entre com a conta do Portal (fica conectada) e toque em **Ativar** nas notificações. O celular avisa quando chega conversa para você, quando o professor responde e quando alguém transfere uma conversa. No app: Minhas, Fila, Todas, responder, Assumir, Transferir, Encerrar e Disponível.

Rodízio e transferência:

- A **Equipe de atendimento** (quadro no fim da tela, só o administrador edita) lista quem atende e em quais setores: **Suporte**, **Técnico** e **Comercial**. Para cadastrar, digite o e-mail da pessoa no Portal (ela precisa ter entrado uma vez), marque os setores e toque em **Adicionar ou atualizar**. **Tirar da equipe** não apaga nada: o histórico continua com o nome.
- Cada conversa que sai do robô vai para o próximo **disponível** do setor, em rodízio (quem recebeu há mais tempo). Só essa pessoa recebe o e-mail de aviso. Sem ninguém disponível, a conversa fica em **Fila sem dono** e o aviso vai para o e-mail padrão da equipe.
- Chamado de equipamento vai para o técnico da vez (aparece no cartão do chamado).
- Cada membro liga ou desliga o próprio **Disponível para receber conversas** (almoço, reunião, férias).
- Filtros: **Minhas** (comigo), **Fila sem dono** e **Todas**.
- **Quadro da equipe** (app Atendimento PDE › **▦ Quadro**, ou www.portaldoeducador.com.br/atendimento/#quadro): uma coluna por pessoa da equipe, mais **Fila sem dono** e **Encerrar**. Arraste o cartão da conversa para a coluna de quem vai atender (no celular, segure o cartão meio segundo e arraste). Soltar na Fila devolve sem dono; soltar em Encerrar encerra e manda a pesquisa. O cartão mostra o setor, mensagens novas e há quanto tempo espera (laranja; vermelho a partir de 10 minutos). Toque no cartão para abrir a conversa.
- **Assumir** traz a conversa para você. **Transferir** manda para o próximo do setor (rodízio) ou para uma pessoa da equipe, com recado opcional; quem recebe ganha um e-mail.
- Quem responde uma conversa da fila fica com ela. A pessoa do outro lado sempre vê **Equipe Portal do Educador**, nunca o nome de quem atendeu.
- Fora do horário (segunda a sexta, das 7h às 17h, horário de MS), o robô passa a conversa para a equipe e avisa que em breve entraremos em contato.
- **Ninguém fica no vácuo:** enquanto a equipe não responde, o robô tenta ajudar pelo manual com a nova mensagem ou confirma que ela chegou (no máximo a cada 10 min). Se a pessoa disser *resolvido*, a conversa se encerra.
- **10 minutos sem resposta da equipe** (no horário de atendimento): a conversa passa para o próximo do setor, até 2 vezes; depois, todos do setor são avisados.
- **2 horas sem retorno da pessoa** depois da última resposta da equipe: o robô encerra sozinho e manda a pesquisa.
- **Pesquisa de satisfação** ao encerrar (Ótimo, Regular, Ruim). Avaliação ruim gera e-mail para a equipe; o painel da TV mostra a % de ótimo do dia.

Na tela:

- **Chamados abertos pelo WhatsApp**: cada um com protocolo, quem abriu e o defeito. **Marcar resolvido** tira da lista.
- **Conversas**: as que estão com o selo **aguardando** sobem para o topo, com o número de mensagens não lidas. Toque numa conversa para ver o histórico (pessoa, robô e equipe).
- **Enviar** manda a resposta pelo WhatsApp assinada como **Equipe Portal do Educador** (o nome de quem respondeu fica só no histórico interno). Enquanto a conversa está com a equipe, o robô fica quieto.
- **Encerrar atendimento** devolve a conversa ao robô e avisa a pessoa que ela pode digitar *menu*.

REGRA
Pelas regras da Meta, a equipe só pode responder até **24 horas** depois da última mensagem da pessoa. Passado esse prazo, o Portal recusa o envio: é preciso esperar a pessoa escrever de novo.

O robô reconhece o professor pelo WhatsApp do cadastro (com ou sem o 9). Dados de alunos não passam pelo robô nem pela IA. Tudo o que importa (chamado aberto, link enviado, conversa passada ou encerrada) fica na **Auditoria**.


### Memória curta, print e foto {: .nova }

- A Lara considera as mensagens das últimas 2 horas da conversa para entender continuações ("e no celular?").
- **Print de tela:** a IA lê a imagem, identifica a tela e o texto do erro e responde pelo manual como se a pessoa tivesse escrito. No histórico aparece "🖼️ Imagem: descrição".
- **Foto de equipamento:** a Lara descreve o defeito e oferece **Abrir chamado**; o chamado já sai com "[Foto enviada] descrição".
- A imagem **não é guardada** em lugar nenhum. A descrição não traz nomes, notas, documentos nem rostos (proteção de dados de alunos, que são menores). Por isso a equipe não vê a foto na tela de atendimento: se o técnico precisar dela, combina com a pessoa na visita.

### Lara da equipe (POPs) {: .nova }

Quem é **administrador** do Portal ou está **ativo na Equipe de atendimento** fala com a Lara em modo equipe: ela responde também pelos **POPs** e pela **Parte 2 deste manual** e cita o código do POP (ex.: POP-PDE-39). O WhatsApp de avisos da pessoa precisa ser o mesmo do cadastro no Portal. Para professor e público, POPs e manual da equipe nunca entram: o filtro é feito no servidor, antes da IA ver qualquer trecho. No modo equipe não há roteamento comercial nem passagem para atendente: se ela não souber, a pergunta vai para a lista do que a Lara não soube.

### A Lara em números e o que ela não soube {: .nova }

No topo da tela (só administrador): mensagens entendidas, dúvidas respondidas pelo manual, % resolvidas sem a equipe, perguntas sem resposta, respostas marcadas como "não resolveu", áudios e imagens entendidos e satisfação, nos últimos 30 dias com movimento. Embaixo, a lista **O que a Lara não soube**: cada pergunta sem resposta no manual ou resposta que não resolveu, com perfil e município (sem nome nem telefone). Rotina semanal:

1. Leia a lista e complete o Manual do Usuário (ou o POP, se a pergunta for da equipe).
2. Republique o manual na Documentação.
3. Em GitHub › Actions › **Robô do WhatsApp**, rode **conhecimento** (recarrega Manual do Usuário, POPs e manual da equipe).
4. Marque cada pergunta como **Resolvida**, ou **Ignorar** quando não é dúvida do Portal.

## Financeiro {: .nova }

Em `www.portaldoeducador.com.br/financeiro/` (atalho **Financeiro** no menu, só para quem tem acesso). O dono (alan@newpc.com.br) libera e retira o acesso por e-mail na aba **Quem tem acesso**.

| Aba | O que tem |
|---|---|
| **Visão geral** | Recebido no mês, a receber, taxas e inadimplência |
| **Recebimentos** | Cada venda (Asaas ou lançada à mão em **Lançar recebido**): cliente, item, forma, bruto, taxa e líquido |
| **Conciliação** | Conferir o que entrou no banco e **Marcar conciliado** |
| **Notas fiscais** | Notas a emitir de cada venda; depois de emitir, **Marcar como emitida** |
| **Inadimplência** | Cobranças vencidas |
| **Auditoria** | Tudo o que aconteceu no Financeiro (cobrança criada, pagamento confirmado, estorno, quem marcou o quê) |
| **Comissões** | Equipe e percentual sobre o **lucro do mês** (depois de impostos, taxas e outros custos), não por venda; também comissão **por projeto** (um vendedor ganha sobre o lucro de um contrato ou cliente) |

:::regra
Só o servidor grava os lançamentos do Asaas. Estorno nunca é desfeito sozinho: confira e ajuste a licença ou os créditos à mão.
:::

## Recursos da Escola: inventário de equipamentos {: .nova }

Em **Recursos da Escola** (administrador escolhe primeiro a rede contratante e depois a escola):

- **Importar inventário por planilha**: a rede é reconhecida pelo CNPJ e a escola pelo setor. A prévia é ajustável antes de gravar; equipamentos novos entram e mudanças de escola viram transferência, com histórico.
- **Visão geral** do inventário por tipo (inclusive suporte e nobreak) e por rede, e a **licença Google for Education por Chromebook**.
- O número do contrato da rede aparece no inventário.

## Rede de demonstração (eventos)

Para eventos como o SENACOP, a equipe pode criar a **Rede Municipal de Demonstração**, com dados fictícios marcados como demonstração. O painel mostra a faixa **Ambiente de demonstração**, nenhum gatilho manda e-mail ou WhatsApp para essa rede e os relatórios de uso real a ignoram. Os scripts `demo-criar-gravar`, `demo-apagar` (só conta) e `demo-apagar-gravar` (apaga) ficam na consulta do GitHub. Nunca apresente esses números como reais.

## Painel da TV {: .nova }

Painel ao vivo para a **TV touch da recepção**, em **www.portaldoeducador.com.br/tv/painel/**. Atualiza a cada minuto e cabe inteiro em qualquer TV (HD, Full HD ou 4K, na horizontal ou em pé): o próprio painel mede a tela e diminui a letra até nada ficar cortado, inclusive em navegador de Smart TV antigo. Tocar na tela entra em tela cheia; a tela não apaga sozinha.

| Modo | Quem vê | O que mostra |
|---|---|---|
| **Vitrine** (em repouso) | Qualquer visitante | Apresentação automática em 4 telas, trocando a cada 12 s: números ao vivo, redes atendidas (escolas, alunos e IDEB do cadastro de Municípios), o que o professor encontra e o QR do WhatsApp. Embaixo, **Toque na tela para conhecer** |
| **Menu** (ao tocar) | Qualquer visitante | **Números ao vivo**, **Nossas redes** (toque numa rede para o detalhe), **O que o Portal faz** (toque em cada recurso) e **Fale com a gente**. Sem toque por 60 s, volta para a vitrine |
| **Demonstração** (link com **&demo=1**) | Qualquer visitante, em eventos | A vitrine intercala 4 telas do Painel da Secretaria da Rede de Demonstração, com a faixa **Ambiente de demonstração · dados simulados** (ver POP-PDE-41). Os números reais nunca somam os usuários da demonstração |
| **Gestão da equipe** | Só com o **PIN** | Fila e conversas do WhatsApp, equipe, novos cadastros, vencimentos, convites por e-mail saindo, uso de hoje e redes (quem já entrou + convidados). Sem toque por 3 min, volta para a vitrine e pede o PIN de novo |

**Os números da vitrine:**

- **Redes municipais atendidas**: só redes ativas com dado oficial cadastrado (Censo ou IDEB). Rede interna sem dado oficial (Campo Grande da NEWPC, Laboratório) não aparece para o visitante.
- **Escolas e alunos nas redes atendidas**: do Censo cadastrado em **Redes contratantes** › **Rede e IDEB** (sem Censo, as escolas do Portal).
- **Educadores com acesso ao Portal**: quem já entrou + importados que ainda não entraram (sem contar duas vezes quem já entrou).
- Se a TV perder a internet, o selo do topo fica vermelho com "sem atualização desde HH:MM".

Para colocar na TV: **Sistema** › **Atendimento WhatsApp** › **Painel da TV** › **Mostrar o link**. Abra o link no navegador da TV. Em **Definir PIN**, grave o PIN da gestão (4 a 6 números). O link leva uma chave: **Trocar a chave** desliga o link antigo na hora e apaga o PIN (defina de novo).

:::regra
O PIN é conferido no servidor e nunca vai na URL. Cinco PINs errados seguidos travam a gestão por 5 minutos. A vitrine mostra só totais; a gestão mostra só números e o primeiro nome da equipe (nenhum telefone, e-mail ou texto de conversa).
:::

:::dica
Se a imagem sair cortada nas bordas, confira no menu da TV o ajuste de imagem: use **Ajustar à tela** ou **Original**, não **Zoom** ou **16:9 ampliado**.
:::

## Pedidos "Quero isso na minha escola" {: .nova }

O professor em teste ou avulso que toca num recurso com cadeado (Gestão Escolar, Central de Relatórios, Portal 360º VR, Portal Maestro) pode pedir o Portal para a escola dele. O comercial recebe na hora um e-mail **[Lead Portal]** (ou **[Lead sala VR]** para o Portal 360º VR, que vai para a oferta da sala de realidade virtual) com nome, e-mail, WhatsApp, escola e município. Responder o e-mail fala direto com o professor. Só sai com a autorização de contato marcada (LGPD) e no máximo 1 pedido por recurso por pessoa a cada 24 h. O pedido fica registrado na Auditoria. Ver POP-PDE-34.

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


### Revisão do acervo geral de quizzes (NEWPC)

Em **Materiais da rede**, o administrador vê no alto o cartão **🧠 Acervo geral de quizzes**, com quantos quizzes saíram do ar por 3 avisos de erro. Em **Revisar agora** (ou **Ver o acervo**): abas **⚠️ Em revisão**, **🌎 No ar** e **🗑️ Retirados**. Ao abrir um quiz aparecem os avisos dos professores e as perguntas (as marcadas como suspeitas ficam com borda laranja); dá para corrigir o texto, as alternativas e a alternativa certa. **✅ Salvar e deixar no ar** devolve o quiz ao acervo (zera os avisos); **🗑️ Retirar do acervo** tira de todas as redes.
