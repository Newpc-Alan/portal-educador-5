# Parte 3 · Manual técnico

Esta parte é para quem mantém e evolui o código. Ela descreve o estado do repositório em 01/11/2026 e continua sendo a principal documentação técnica do projeto (o `README.md` do repositório tem só o título).

## Arquitetura

O Portal é um site estático: cada tela é um `index.html` autocontido, com CSS e JavaScript embutidos, sem etapa de build. O navegador conversa direto com o Firebase. O que precisa de segredo (IA, e-mail, links assinados, contas técnicas) passa pelas Cloud Functions.

```
Navegador (professor, aluno, gestão, secretaria, TV, totem, tablet do Maestro)
   |  HTML/JS estático no GitHub Pages
   |  repo Newpc-Alan/portal-educador-5 · domínio app.portaldoeducador.com.br
   |  Firebase JS SDK 10.12.2 (gstatic) · login Google, e-mail/senha ou cartão QR
   v
Firebase · projeto portal-educador-5
   - Authentication (Google, e-mail e senha, link por e-mail, token próprio do aluno)
   - Firestore em southamerica-east1 (firestore.rules, firestore.indexes.json)
   - Storage: 3 buckets (principal, portaria, backups)
   - Cloud Functions v2 · Node 22 · southamerica-east1 · 91 funções
   - Secret Manager: SMTP_SENHA, GEMINI_API_KEY, NC_ENTREGA_CHAVE
API do Gemini (Google): Portal IA, Aula com IA da Lousa, Gerar com IA das Provas
Servidor NEWPC (Nextcloud, cloud.portaldoeducador.com.br): cópia do acervo e entrega por link assinado
GitHub Actions: publicação do Firebase, cópia diária para o Nextcloud, consultas e robôs
Gmail SMTP (conta Google da NEWPC): envio de todos os e-mails automáticos
```

### Hospedagem do front

| Item | Situação |
|---|---|
| Repositório | `github.com/Newpc-Alan/portal-educador-5` |
| Domínio | arquivo `CNAME` com `app.portaldoeducador.com.br` |
| Publicação | GitHub Pages publica a branch `main` a cada `git push` (1 a 2 minutos) |
| Branch de trabalho | `vitrine-ia`, mantida igual à `main` (ver **Fluxo de publicação**) |
| Build | Não há. O que está na `main` é o que vai ao ar |
| CI | Só os workflows de `.github/workflows`, todos acionados à mão, menos a cópia diária para o Nextcloud |
| Dependências do front | Firebase SDK 10.12.2 via gstatic, Google Fonts e bibliotecas em `assets/vendor` |

### Páginas

| Caminho | Função |
|---|---|
| `/` | Apresentação pública do Portal, com a seção Notícias (notícias públicas) e Gestão da rede |
| `/entrar/` | App principal: login, Início de cada perfil, módulos e toda a administração |
| `/provas/` | Provas e Avaliações (antigo Gerador de Provas), com **Gerar com IA** e cartão-resposta |
| `/prova/` | Prova online (aluno em modo protegido, sala de espera e painel ao vivo do professor) |
| `/aluno.html` | Aviso de que a prova por código foi aposentada, com link para o Portal do Aluno |
| `/painel/` | Painel da Rede (secretaria e gestor) |
| `/gestao/` | Gestão Escolar |
| `/relatorios/` | Central de Relatórios |
| `/formacao/`, `/formacao/admin/`, `/validar/` | Formação Continuada, painel editorial e validação pública de certificado |
| `/biblioteca/`, `/colorir/`, `/dicas/`, `/museus/`, `/lousa/` | Módulos de conteúdo. A Lousa traz a Aula com IA (Básica e Ultra) |
| `/bncc/` | Buscador da BNCC, público e sem login |
| `/maestro/` | Página de apresentação do Portal Maestro (substitui a página antiga da Webnode) |
| `/noticia/` | Notícia aberta por link público (lê `noticias_publicas`) |
| `/privacidade/` | Privacidade e cookies (LGPD) |
| `/vitrine/` | Só redireciona para `/` |
| `/chamado/` | Chamado técnico pela etiqueta QR (sem login) |
| `/tv/`, `/tv/leve/`, `/tv/teste/` | Player do Portal do Educador TV (PWA com service worker) |
| `/apps/portal-ia/` | Portal IA. O endereço antigo `/apps/ia-studio/` redireciona para cá |
| `/apps/...` | Ficha do Aluno (`alunos`), Calendário, Corretor, Equipe, Famílias, Folha Mágica, Frequência, Grade das turmas (`grade`), Notas, Recursos, Ficha do Servidor (`servidores`), Teleprompter (+ controle), Turma na Lousa (`turma`) e painel das TVs (`tv`) |

O projeto Android do app do aluno do Portal Maestro fica em `maestro-app/` (WebView próprio, com câmera liberada para a entrada por QR).

### Componentes compartilhados

| Arquivo | Para que serve | Onde entra |
|---|---|---|
| `/assets/pde-entrada.js` | Registra a entrada de cada pessoa em cada tela (auditoria com IP). Espera a página criar o app do Firebase, ouve o login e chama a função `registrarEntrada` uma vez por sessão do navegador e por tela | Todas as telas com login (hoje 30 páginas, inclusive a Formação Continuada) |
| `/assets/pde-pensando.js` | Tela **Estou pensando**: logo do Portal no centro, etapas e recados de uso consciente da IA trocando a cada 7 s | Lousa, Provas e Portal IA |
| `/lousa/temas-bncc.js` | Banco de temas por série e disciplina (BNCC), da Educação Infantil ao Ensino Médio | Aula com IA da Lousa e Portal IA |
| `/assets/js/` | Núcleos de calendário e frequência (cópias idênticas dos do servidor), cartão-resposta, carteirinha e plano | Telas de gestão e provas |

Uso do componente de entrada:

```
<script type="module" src="/assets/pde-entrada.js"></script>
```

:::regra
Toda tela nova com login inclui `/assets/pde-entrada.js`. Sem ele, a entrada da pessoa naquela tela não aparece na Auditoria.
:::

### O que cada deploy do Firebase publica

| Comando (ou campo **alvo** do workflow) | Publica |
|---|---|
| `firestore:rules` | Regras do banco |
| `firestore:indexes` | Índices compostos e a política de TTL da auditoria |
| `storage` | As três regras de Storage |
| `functions:NOME` | Uma função (várias: `functions:a,functions:b`) |

Ficam **fora** do `firebase.json` e são configurados à parte: hospedagem (GitHub Pages), regras de ciclo de vida dos buckets, CORS do bucket (`cors.json`), o script `arquivo.php` do servidor NEWPC e o antigo Worker da Cloudflare.

### Buckets do Storage

| Bucket | Regras | Uso | Guarda |
|---|---|---|---|
| principal (`portal-educador-5.firebasestorage.app`) | `storage.rules` | Arquivos dos professores, Acervo (NEWPC e redes), Portal IA, Materiais da turma, TV, Biblioteca, Atividades, Colorir, Dicas, Formação, fichas e documentos | Permanente |
| `portal-educador-5-portaria` | `storage-portaria.rules` | Fotos da entrada (totem) | 15 dias |
| `portal-educador-5-backups` | `storage-backups.rules` | Exportações e pacotes de backup | 7 dias |

O banco fica em São Paulo. O bucket principal fica nos Estados Unidos (a página Privacidade informa isso). O script `migrar-arquivos-sp.mjs` está pronto para levar os arquivos a um bucket novo em São Paulo, mas a migração não foi feita.

### Servidor NEWPC (Nextcloud)

O acervo continua no Storage do Firebase, que é a origem. O servidor da NEWPC guarda uma **cópia de segurança** e pode **entregar** arquivos por link assinado.

| Peça | O que faz |
|---|---|
| Pasta raiz | `Drive Portal do Educador`, na conta `alan` do Nextcloud |
| `01-Acervo-NEWPC/` | Atividades (por etapa e componente), Biblioteca (por seção) e Colorir (por tema e coleção) |
| `02-Formacao-Continuada/` | Materiais dos cursos, por curso |
| `03-Acervo-Municipios/{município}/{pastas}/` | Acervo de cada rede, na mesma árvore de pastas definida no Portal. Links externos não são copiados |
| `nc_mapa/{id}` | Mapa "arquivo do Portal = caminho no Nextcloud", gravado pelo robô de cópia |
| `config/nc_copia` | Resumo da cópia (números por tipo) para o painel **Servidor NEWPC** do admin |
| `servidor-nextcloud/arquivo.php` | Instalado no servidor (`/pde/arquivo.php`). Confere a assinatura e entrega o arquivo. Não acessa o banco |
| Função `linkArquivoNc` | Confere a licença com a mesma lógica das regras e devolve um link assinado (HMAC) que vence em 5 a 15 minutos |
| `stats/nc_acessos` | Quantos arquivos o servidor entregou por dia (só o número) |

O passo a passo de instalação do servidor está em `servidor-nextcloud/LEIAME.md`. Só itens com o campo `nc_caminho` abrem pelo servidor NEWPC; os demais abrem pelo Storage do Firebase. Renomear ou mover uma pasta do acervo de um município no Portal move também no Nextcloud na rodada seguinte.

:::nota
O Worker da Cloudflare (`cloudflare/acervo-worker.js`, bucket R2) está fora de uso desde out/2026. O arquivo fica no repositório só como referência.
:::

## Modelo multi-município

Tudo no Portal gira em torno do município. A rede define o que professores e alunos veem, até quando têm acesso, qual plano contratou e quais recursos extras e de IA estão liberados.

### Município (`municipios/{id}`)

| Campo | Significado |
|---|---|
| `nome`, `uf` | Identificação. A UF alimenta os feriados estaduais |
| `status` | `piloto`, `ativo` ou `inativo`. O front esconde redes inativas e bloqueia o aluno, mas as regras não olham este campo |
| `arquivado`, `arquivado_em`, `arquivado_por` | Município arquivado na tela Municípios (some das listas, pode ser reativado) |
| `contrato_numero` | Texto livre |
| `vigencia_fim` / `vigencia_fim_ts` | Fim do contrato. É o `vigencia_fim_ts` que corta o acesso nas regras e nas funções. Sem data, nunca vence |
| `plano_nome` | `basico` (padrão de município novo), `intermediario`, `completo` ou `personalizado` |
| `modulos_professor[]` | Botões liberados ao professor. Lista vazia significa todos |
| `modulos_aluno[]` | Botões liberados ao aluno (só os que aceitam aluno). Aplicado nas regras por `alunoPode()` |
| `modulos_secretaria[]` | Hoje só `"painel"` (Painel da Rede) |
| `recursos[]` | Recursos extras: `prova_online`, `rede_colab` (Educador em Rede), `sala_digital` (Sala Conectada) e `turma_ao_vivo` (Turma ao Vivo) |
| `ia[]` | Recursos de IA liberados pela Central de IA: `portalia`, `portalia_imagem`, `provas_ia`, `lousa_ia`, `lousa_ia_ultra`. Sem o campo, vale o plano |
| `rede_moderacao` | `antes` (aprovação antes de aparecer para os colegas, padrão de município novo) ou `depois` (publica na hora e modera depois) |
| `dominios_aluno[]` | Domínios de e-mail dos alunos, espelhados em `dominios_aluno/{dominio}` |
| `logo_url`, `cnpj`, `ideb` e demais dados de identificação e rede | Cadastro completo da tela Municípios |

Dados sigilosos do cliente (pessoas, valores, processo, empenho) ficam em `municipios_privado/{id}`, que só o administrador lê e grava.

IDs dos módulos: `videos`, `jogos`, `portalia`, `provas`, `portal360`, `atividades`, `relatorios`, `datas`, `colorir`, `historias`, `biblioteca`, `formacao`, `museus`, `dicas`, `dicasaluno`, `apps`, `gestao`, `maestro`. O antigo `ia` (IA do Educador) saiu e é ignorado na comparação dos planos. Lousa, Calendário e Notícias não dependem do plano. A situação global de cada botão (Liberado, Em breve, Oculto, link e imagem) fica em `config/modulos`.

### Planos

| Plano | Módulos do professor | Recursos da sala | IA |
|---|---|---|---|
| Básico | Atividades, Vídeos, Jogos, Datas, Colorir, Histórias, Biblioteca, Museus, Dicas, Aplicativos | Educador em Rede | Não tem |
| Intermediário | Básico + Formação, Portal 360, Maestro e Portal IA | + Sala Conectada | Recursos de texto (Portal IA, Provas com IA, Lousa IA Básica) |
| Completo | Todos, com Prova online e Painel da Rede | + Turma ao Vivo | Tudo, inclusive imagens e Lousa IA Ultra |

A lista de recursos da sala por plano fica duplicada em `entrar/index.html` e em `functions/envio-comum.js` (`recursosDoPlano`). A de IA fica em `functions/ia-acesso.js`. Mudou uma, mude a outra.

### Usuário (`usuarios/{uid}`)

| Campo | Significado |
|---|---|
| `perfil` | `admin`, `secretaria`, `gestor`, `professor`, `aluno`, `secretaria_escolar`, `portaria` |
| `status` | `ativo`, `pendente`, `inativo` |
| `licenca_tipo` | `institucional` (padrão), `teste` (7 dias), `avulsa`, `cortesia` |
| `licenca_fim` | Fim das licenças não institucionais |
| `plano_avulso` | Pacote da licença avulsa (Básico, Intermediário, Completo) |
| `modulos_extra[]`, `recursos_extra[]`, `ia_extra[]` | Liberações exclusivas da pessoa, por cima do plano do município. Só o administrador grava; ninguém nasce com elas |
| `municipio_id`, `escola_id`, `escolas_ids[]` | Vínculo. Professor e gestor: 1 a 5 escolas do mesmo município. Secretaria escolar e portaria: 1. Secretaria de Educação: nenhuma |
| `turmas_ids[]` | Turmas que o professor marcou como suas |
| `turma_nome`, `turma_id` | Só aluno: turma vinda da importação ou da matrícula |
| `resumo_rede` | `false` quando a pessoa desliga o e-mail diário das Novidades da rede |
| `ultimo_acesso`, `origem` | Uso e origem do cadastro |

O aluno que entra pela matrícula (código + PIN ou cartão QR) usa uma conta técnica `al-<id da matrícula>` e recebe o claim `aluno_id` (e `turma_id`), assinado pelo Firebase. As regras de Materiais da turma, presença e fotos da prova usam esses claims.

:::atencao
Existem duas entidades de "aluno". `usuarios/{uid}` com perfil aluno é a **conta de login**. `alunos/{id}` é o **aluno na turma** (matrícula, Ficha do Aluno, frequência, carteirinha, portaria, famílias). O acesso por código + PIN e o vínculo do Google da escola ligam as duas pela matrícula; o aluno que entra só pelo domínio do e-mail continua sem esse vínculo.
:::

### Caminhos de criação de cadastro

O próprio usuário cria o documento dele no primeiro acesso, e as regras só aceitam um destes casos:

1. **Autocadastro de professor**: teste de 7 dias, sem vínculo de rede, com e-mail que não seja de domínio de aluno.
2. **Legado**: professor pendente, sem vínculo.
3. **Professor importado**: nasce com exatamente o vínculo do pré-cadastro.
4. **Aluno pelo domínio**: nasce aluno do município do domínio, sem escola.
5. **Aluno importado**: nasce com município, escola e turma do pré-cadastro.
6. **Equipe de apoio convidada pelo gestor** (portaria e secretaria escolar).
7. **Gestor e Secretaria de Educação importados pelo admin**.

O pré-cadastro (`pre_cadastros/{email}`) só vale para login com e-mail verificado do mesmo endereço. Fora das regras, as funções criam contas em três situações: cadastro manual pela rede (`criarUsuarioManual`, com senha provisória), acesso do aluno pela matrícula (`gerarAcessoTurma`, `entrarAlunoQr`) e Escola de laboratório (script).

## Banco de dados (Firestore)

Qualquer caminho que não aparece nas regras é negado. As coleções, por área:

### Rede, cadastro e acesso

| Coleção | Leitura | Escrita |
|---|---|---|
| `municipios` | Quem tem cadastro | Admin |
| `municipios_privado` | Admin | Admin |
| `escolas` | Admin e cadastrados do município | Admin |
| `turmas` | Admin, professores e equipe da escola | Professor vinculado cria; criador edita; Direção e Secretaria da escola gravam só a grade; admin apaga |
| `usuarios` | O próprio e o admin; gestor lê a equipe de apoio | 7 caminhos de criação; o próprio edita só dados pessoais e escolas |
| `usuarios/{uid}/trabalhos`, `provas`, `folhas`, `roteiros`, `turma_lousa`, `lembretes`, `pastas_provas` | O dono | O dono (Meus trabalhos) |
| `pre_cadastros` | Admin, o dono do e-mail, gestor (convites) | Admin; gestor só convites de portaria e secretaria escolar |
| `senhas_provisorias` | O próprio usuário | Só funções |
| `dominios_aluno` | Admin; `get` por quem tem o domínio | Admin |
| `acessos_dia` | Admin | O próprio (um documento por pessoa por dia, com módulos e arquivos do acervo abertos) |
| `config` | Licenciados e alunos (`config/portal_ia`: qualquer logado; `config/acervo`: também a secretaria) | Admin e robôs |
| `documentos` | Admin; quem tem acesso ativo vê os marcados `publico: "todos"` (Ajuda) | Admin |

Coleções gravadas só pelas funções e sem regra de leitura (o navegador nunca acessa): `alunos_acesso` e `alunos_acesso_cod` (código e PIN do aluno) e `nc_mapa` (mapa da cópia para o Nextcloud).

### Pedagógico e gestão escolar

| Coleção | Uso |
|---|---|
| `relatorios` | Central de Relatórios: rascunho, enviado, devolvido, aprovado |
| `notas_regras`, `notas_planilhas`, `notas_escola` | Regras de média da rede, planilhas do professor e notas digitadas pela escola (diário de papel, exame final) |
| `fechamentos`, `notas_fechadas`, `notas_historico` | Fechamento do bimestre, cópia oficial e histórico de alterações. Só funções gravam |
| `cal_rede`, `cal_escola` | Calendário letivo da rede e ajustes da escola |
| `freq_chamadas`, `freq_resumo`, `freq_entradas`, `substituicoes` | Chamadas, resumo calculado pelo servidor, entradas da portaria e substituição de professor |
| `alunos`, `alunos_ficha`, `alunos_saude`, `alunos_autorizados`, `alunos_familia`, `alunos_acessos` | Aluno da turma, Ficha do Aluno, saúde e inclusão (dado sensível), autorizados a buscar, contatos das famílias e registro de quem abriu dados sensíveis (só cria) |
| `servidores`, `cpf_receita` | Ficha do Servidor (autosserviço com validação da escola) e conferência do CPF na Receita (desligada até o contrato) |
| `busca_ativa` | Fichas de busca ativa |
| `avisos_config`, `avisos_familia`, `avisos_contador`, `comunicados_familia` | Avisos e materiais às famílias e comunicados da escola |
| `portaria_vistas` | Quem abriu cada foto da entrada |
| `maestro_aulas` | Histórico do Portal Maestro |

### Sala Conectada, Turma ao Vivo e Educador em Rede

| Coleção | Uso | Quem grava |
|---|---|---|
| `turma_materiais/{turma}/itens` | Materiais da turma no Portal do Aluno (Portal IA, Meus trabalhos, **Enviar para a turma**) | Só funções |
| `turma_materiais/{turma}/itens/{id}/vistos` | Quem já abriu | O aluno, só o próprio registro |
| `turma_presenca/{turma}/alunos` | Presença ao vivo: o Portal do Aluno avisa a cada 20 s (`fora` = saiu da página; `saiu` = saiu da conta, gravado antes do `signOut`). Professor: verde = sinal há menos de 50 s; vermelho = `fora` ou sinal parado, desde que o sinal seja da aula atual (depois de `qr_aulas.aberta_em`, aula ainda aberta e no máximo 3 h); sem cor = `saiu`, sem sinal ou sinal com mais de 3 h | O aluno da turma |
| `turma_aluno_estado/{turma}/alunos` | Aulas abertas e fechadas (Histórico de aulas) | O próprio aluno |
| `qr_aulas/{turma}` | Entrada por QR aberta e tempo de aula | Só funções |
| `trabalhos_rede` | Trabalhos compartilhados com a rede (Lousa, provas, roteiros, folhas) | Só funções |
| `portal_ia_rede` (+ `denuncias`) | Materiais do Portal IA compartilhados com a rede | Só funções |
| `rede_feed/{município}` | Novidades da rede: os 10 últimos materiais compartilhados | Só funções |

### Portal IA e créditos

| Coleção | Uso | Quem lê |
|---|---|---|
| `portal_ia_docs` | Material gerado. Nasce só na função; o dono edita texto, título e favorito, e exclui | O dono |
| `portal_ia_uso`, `ia_uso` | Uso por pessoa | O dono e o admin |
| `ia_materiais`, `ia_apps` | Pedidos e catálogo do antigo IA Studio (guardados) | O dono; licenciado |
| `creditos/{conta}` (+ `movimentos`) | Carteira pré-paga: `mun_{município}` (rede) e `prof_{uid}` (professor), com pacotes de 12 meses | Admin, o professor (a dele) e a secretaria (a da rede) |
| `recargas_pedidos`, `creditos_alertas` | Pedidos de recarga e alertas de saldo | Admin; o autor do pedido; a secretaria vê os da rede |
| `temas_populares` | Ranking dos temas escolhidos (só identificadores do banco de temas) | Qualquer logado |
| `config/portal_ia` | Modelos, preços, pacotes e chave geral de cada recurso de IA | Qualquer logado |

Preço padrão: 1 material = 1 crédito, 1 ajuste = 1 crédito, 1 imagem = 5 créditos. A rede paga primeiro (com teto mensal por professor); acabou ou bateu o teto, usa os créditos do próprio professor. Toda escrita nessas coleções é das funções.

### Recursos da escola, TV e Teleprompter

| Coleção | Uso |
|---|---|
| `rec_config`, `rec_itens`, `rec_contratos` | Equipamentos, movimentações e contratos com SLA |
| `rec_qr`, `rec_busca`, `rec_pub` | Etiqueta QR, busca pública por patrimônio e cartaz da escola |
| `rec_chamados`, `rec_reservas` | Chamados técnicos (abertos sem login pela etiqueta) e reservas de equipamento |
| `tv_pareamentos`, `tv_telas`, `tv_playlists`, `tv_canais`, `tv_campanhas` | Pareamento por código, telas, programação, comunicados da secretaria e campanhas padrão |
| `tele_sessoes` | Controle remoto do Teleprompter pelo celular |

### Conteúdo, acervo, avaliação e Formação

| Coleção | Uso |
|---|---|
| `videos`, `jogos`, `atividades`, `biblioteca`, `colorir`, `datas_comemorativas` | Catálogos. Vídeos e jogos têm posição (1 primeiro, 2 normal, 3 fim) e selo Novo por 15 dias |
| `acervo` | Acervo da NEWPC (arquivos em `acervo/{botão}/`) |
| `acervo_rede`, `acervo_rede_arvore` | Acervo de cada município e a árvore de pastas que o admin define (até 400 pastas) |
| `noticias`, `noticias_publicas` | Mural de notícias (fechado) e a cópia pública de cada notícia para compartilhar fora do Portal |
| `*_reacoes`, `pesquisa_respostas` | Votos de cada pessoa; os totais são somados por funções |
| `biblioteca_triagem`, `atividades_ignoradas` | Controle das importações |
| `dicas_envios`, `dicas_alunos`, `dicas_alunos_pub` | Dicas do Professor e do Aluno com moderação |
| `provas_online` (+ `po_tentativas`, `po_resultados`, `po_sala`), `provas_online_gab` | Prova online. Só funções criam e corrigem; o gabarito fica em coleção separada |
| `avaliacoes`, `respostas` | Provas do Corretor de Gabarito (inclusive as trazidas de Provas e Avaliações e do Portal IA) e notas lançadas |
| `cursos`, `trilhas`, `users`, `certificados`, `cpfs`, `equipe` | Formação Continuada |
| `auditoria` | Trilha de auditoria do Portal (ver **Auditoria**) |
| `uso_real`, `stats` | Uso real por semana e contadores do painel de uso. Só funções gravam, só admin lê |
| `backup_config`, `backups_log` | Backup |
| `comunicados_email` (+ `envio_lotes`), `comunicados_pref` | Comunicados por e-mail: o comunicado, o público, totais e situação; destinatários em lotes de 400 com o andamento e as falhas; token do link de descadastro e a escolha da pessoa (`off`). Só funções gravam, só admin lê. `config/comunicados` guarda servidor, porta, conta, nome e envios por hora (sem senha) |
| `busca_indice` | Índice compacto da busca geral do Início (`_meta` + partes `p01`, `p02`...). Só funções gravam; lê quem lê os catálogos (`licenciado()`) |
| `buscas_mes` | O que a rede procura, por mês: termo normalizado e contadores (`n`, `zero`, `clique`), geral e por município, sem identificar a pessoa. Só funções gravam, só admin lê. TTL em `expira_em` (13 meses) |

### Regras de acesso que merecem atenção

| Ponto | Como está |
|---|---|
| Acervo da rede | Lê só quem é do município (aluno nunca); o professor vê só o publicado, a Secretaria vê também o que ainda não publicou |
| Material da NEWPC no acervo do município | Itens com `origem: "newpc"` e arquivo `acervo-rede/{mun}/newpc-...`: só o admin cria, edita e apaga. A Secretaria lê, mas não envia nem apaga arquivo com esse prefixo (Firestore e Storage conferem) |
| Acervo da rede, link externo | Aceito só com `https://` e sem arquivo; o link não muda depois de criado |
| Árvore de pastas | Só o admin grava (`pastas`, até 400); a rede lê |
| Auditoria | Ninguém grava pelo navegador (`write: if false`). Lê só o administrador do Portal (`admin()`); o papel admin da Formação não lê |
| Portal IA | `portal_ia_docs` não aceita criação pelo navegador; a edição só mexe em texto, título, favorito e HTML (até 300 KB) |
| Créditos | Leitura por dono da carteira; nenhuma escrita pelo navegador |
| Notícias públicas | `noticias_publicas` tem leitura aberta (sem login) e guarda só título, texto, foto e mídia |
| Materiais da turma | O aluno lê pela turma do claim `turma_id` ou do cadastro; a equipe da escola também |

### Funções auxiliares das regras

| Função | Significado |
|---|---|
| `admin()` | Perfil admin e ativo |
| `contratoOk()` | Município sem `vigencia_fim_ts` ou com data no futuro |
| `vinculado()` | Admin, ou professor institucional com escola e contrato vigente |
| `licenciado()` | Vinculado, ou professor com licença avulsa, teste ou cortesia dentro do prazo |
| `aluno()`, `alunoPode(m)` | Aluno ativo com contrato vigente; e com o módulo `m` no plano |
| `alunoDaTurma(t)`, `souChave(k)`, `equipeTurma(t)` | Aluno da turma (claim ou cadastro), o próprio registro e a equipe da escola da turma |
| `temPreCadastro()`, `dominioDeAluno()` | Pré-cadastro do e-mail verificado; domínio cadastrado como de aluno |
| `gestorDaEscola()`, `secEscolar()`, `portariaDaEscola()`, `secretariaDoMuni()`, `equipeEscola()` | Equipe da escola e da secretaria |
| `acervoRedeOk()` | Lista fechada de campos do acervo da rede, categoria, título e origem válidos |
| `fAdmin()`, `fEditor()` | Papel na Formação (ou perfil admin do Portal) |

### Índices e retenção

| Coleção | Campos | Usado por |
|---|---|---|
| `usuarios` | perfil, criado_em | Resumo diário e listas do admin |
| `acessos_dia` | municipio, dia | Painel da Rede |
| `po_tentativas` (grupo) | status, prazo | `fecharProvasOnline` |
| `provas_online` | status, fecha_em | `fecharProvasOnline` |
| `servidores` | municipio_id, escolas_ids (contém) | Ficha do Servidor |
| `notas_historico` | escola_id, turma_id, em (desc) | Histórico das notas |
| `auditoria` | autor_uid, em · municipio_id, em · colecao, em · acao, em (todos com em desc) | Tela Auditoria |
| `cursos`, `trilhas`, `certificados`, `provas` | vários | Formação |

Em `fieldOverrides` do `firestore.indexes.json`:

- **TTL** em `auditoria.expira_em`: o Firestore apaga sozinho o registro vencido (em geral até 24 h depois da data).
- **TTL** em `buscas_mes.expira_em` (13 meses) e índice desligado em `buscas_mes.termos`, `buscas_mes.por_mun` e `busca_indice.itens`.
- Índice desligado nos mapas grandes da frequência, da busca ativa e das entradas, para não pagar indexação desnecessária.
- Índices próprios em `lembretes` (`proxima`, `proximo_aviso`).

## Armazenamento de arquivos (Storage)

| Caminho | Quem lê | Quem grava | Limite |
|---|---|---|---|
| `professores/{uid}/lousa/` e `/provas/` | Dono licenciado e admin | Dono licenciado | 50 MB |
| `professores/{uid}/turma/` | Dono | Professor, gestor, secretaria ou admin ativo (envio para a turma; a função copia para a turma) | 100 MB (inclui vídeo) |
| `professores/{uid}/...` | Dono e admin | Dono licenciado | 20 MB (pdf, imagem, áudio, Office) |
| `acervo/{botão}/` | Licenciado, secretaria e gestor do município; aluno só Datas e Histórias | Admin | 100 MB |
| `acervo-rede/{mun}/` | Quem é do município (aluno não) | Secretaria do município, menos `newpc-*`; admin | 100 MB |
| `portal-ia/{uid}/` | Dono | Só função (imagens geradas) | |
| `portal-ia-rede/{mun}/{id}/` | Quem é do município | Só função (imagens dos materiais compartilhados) | |
| `turma-materiais/`, `trabalhos-rede/{mun}/` | Pelo link com token gerado pela função | Só função | |
| `documentos/interno/`, `documentos/publico/` | Admin; todos os ativos | Admin (PDF; APK só no interno) | 80 MB |
| `fotos_alunos/`, `fotos_autorizados/`, `alunos_docs/` | Gestão e secretaria escolar (professor e portaria veem a foto do aluno; portaria vê os autorizados) | Gestão e secretaria escolar | 1 MB foto, 15 MB documento |
| `servidores/{email}/` | O servidor, a gestão das escolas dele e a Secretaria | Os mesmos | 1 MB foto, 15 MB documento |
| `provas_online/{p}/fotos/` | Professor da prova, gestor da escola e admin | O aluno, só quando a prova pede foto | 400 KB |
| `tv/escolas/{escola}/` | Logado | Equipe da escola | 50 MB |
| `tv/campanhas/`, `tv/municipios/{m}/` | Logado | Admin; secretaria do município | 10 MB |
| `capas/{tipo}/` | Logado | Admin | 3 MB |
| `biblioteca/`, `atividades/`, `colorir/` | Logado | Admin e funções de importação | 300, 60 e 5 MB |
| `dicas/{uid}/{envio}/` | Dono, admin, ou todos se publicada | Dono (nunca altera) | 10 MB |
| `materiais/{curso}/`, `capas/` | Público | Editor da Formação | 40 MB e 3 MB |

Qualquer outro caminho é negado. Fotos de cadastro de aluno saem 1 ano depois da saída do aluno; fotos da prova online saem no fim do ano letivo.

## Funções do servidor (Cloud Functions)

São 91 funções exportadas por `functions/index.js`, todas em `southamerica-east1`. A conferência de CPF na Receita (`conferirCpfServidor`, em `cpf-receita.js`) está pronta, mas não é exportada até o contrato com o Serpro.

### Parâmetros e segredos (só os nomes)

| Onde | Nome | Para que |
|---|---|---|
| Secret Manager | `SMTP_SENHA` | Envio de e-mail |
| Secret Manager | `GEMINI_API_KEY` | IA (Portal IA, Lousa, Provas) |
| Secret Manager | `NC_ENTREGA_CHAVE` | Assinatura dos links do servidor NEWPC (a mesma chave fica no servidor) |
| Secret Manager | `COMUNICADOS_SMTP_SENHA` | Senha da conta comunicados@portaldoeducador.com.br (Webnode), usada pelos Comunicados por e-mail |
| Secret Manager (quando ativar) | `SERPRO_CHAVE`, `SERPRO_SEGREDO` | Conferência de CPF |
| `functions/.env.portal-educador-5` | `SMTP_USUARIO`, `SMTP_HOST`, `NOTIFICAR_EMAILS`, `NC_ENTREGA_URL` | Parâmetros públicos (sem senha) |
| Segredos do GitHub | `FIREBASE_SERVICE_ACCOUNT`, `NC_APP_SENHA`, `MAESTRO_KEYSTORE_B64`, `MAESTRO_SENHA` | Workflows |

:::regra
Segredo nunca entra no código, no chat ou em arquivo do repositório. Fica só no Secret Manager do Google ou nos segredos do GitHub, gravado pelo Alan.
:::

### Portal IA, créditos e Central de IA

| Função | Tipo | O que faz |
|---|---|---|
| `portalIa` | callable | Porta única da IA. Ações: `cota`, `entender`, `gerar`, `ajustar`, `imagem`, `remover_imagem`, `questoes_prova` (Gerar com IA das Provas), `aula_lousa` (Aula com IA), `converter_atividade` e `foto_ref` (só admin), `compartilhar`, `descompartilhar`, `usar`, `denunciar`, `enviar_email`, `opcoes_envio`, `enviar_turma`, `pref_resumo_rede` |
| `portalIaLimpar` | gatilho ao excluir `portal_ia_docs` | Apaga as imagens do material excluído |
| `creditosPedido`, `creditosAdmin` | callables | Pedido de recarga (professor ou secretaria) e gestão das carteiras e da Central de IA pelo admin |
| `emailPedidoRecarga`, `emailAlertaCreditos` | gatilhos | Avisam a NEWPC de pedidos e de saldo baixo |

Detalhes do `portalIa`:

- 19 tipos de material (plano, sequência, atividade, prova, parecer, inclusão, redação, recado, explicação, planejamento, diagnóstica, simulado SAEB, lista por nível, rubrica, projeto, resumo, dinâmica, ficha da Educação Infantil e caça-palavras). 16 deles podem ir para a rede.
- Vários temas da BNCC no mesmo pedido; até 40 questões; o servidor descarta código BNCC que não existe (`bncc-codigos.js`).
- Resposta lida em fluxo, com corte e nova tentativa quando a IA entra em repetição, e troca para outros modelos do Gemini (lista de reserva). Modelos e preços podem ser trocados em `config/portal_ia`.
- Acesso decidido em `ia-acesso.js` (chave geral, rede e professor); quanto pode gastar, em `creditos.js` (reserva antes, estorno se a IA falhar, registro do custo real).

### Sala Conectada, rede e moderação

| Função | Tipo | O que faz |
|---|---|---|
| `trabalhoRede` | callable | Compartilhar trabalhos de Meus trabalhos (Lousa, provas, roteiros, folhas) com a rede, por e-mail, com os alunos e com as famílias; **Enviar para a turma** por link ou arquivo; "usar uma cópia" |
| `moderarRede` | callable | Materiais da rede: listar, ver, decidir (aprovar, ocultar, remover) e trocar o modo de moderação do município |
| `resumoRedeDiario` | 18:00, seg a sáb | E-mail das Novidades da rede para professores e gestores, só quando houve novidade |
| `resumoRedeTeste` | callable | Envio de teste do resumo |
| `gerarAcessoTurma`, `codigoAlunoQr`, `entrarAlunoQr`, `entradaQrTurma`, `vincularContaAluno` | callables | Código + PIN da turma, cartão QR, login do aluno pelo QR (token próprio), abrir e fechar a entrada por QR com tempo de aula, e vínculo do Google da escola à matrícula |

Os envios usam `envio-comum.js`: quem a pessoa alcança, destinatários, limite diário, o e-mail em PDF e a publicação em Materiais da turma. Arquivos enviados à turma viram cópia em `turma-materiais/` com link de download.

### Acervo e servidor NEWPC

| Função | Tipo | O que faz |
|---|---|---|
| `linkArquivoNc` | callable | Link assinado para abrir no servidor NEWPC um item de `acervo` ou `acervo_rede` que tenha `nc_caminho` |

### Comunicados por e-mail (`comunicados.js`)

| Função | Tipo | O que faz |
|---|---|---|
| `comunicadoEmail` | callable, só admin | `contar` (público por perfil, município (`__sem` = sem município), escola e licença do professor (`licencas`, `vencidas`); só conta ativa com e-mail; informativo pula `comunicados_pref.off`), `teste` (manda só para o admin), `enviar` (confere o número confirmado, cria tokens, grava o comunicado e os lotes), `cancelar` |
| `enviarComunicados` | agendada, a cada 5 min | Manda a cota do período (envios por hora / 12) pela conta da Webnode (SMTP com `COMUNICADOS_SMTP_SENHA`), um e-mail por pessoa com `List-Unsubscribe`; para tudo se o servidor recusar a senha; conclui e registra na Auditoria |
| `descadastroEmail` | HTTP público | Página "não quero mais receber" com confirmação por botão (POST) e opção de voltar a receber; registra na Auditoria |

### Busca geral do Início (`busca.js`)

| Função | Tipo | O que faz |
|---|---|---|
| `indiceBusca` | agendada (a cada 2 h, 06:15 a 22:15) | Lê os catálogos publicados (`videos`, `jogos`, `atividades`, `biblioteca`, `colorir`, `acervo`) e grava o índice compacto em `busca_indice` (partes de até ~700 KB; imagem do Storage guardada só como caminho e token) |
| `atualizarIndiceBusca` | callable, só admin | O mesmo, na hora (botão no Painel); registra na Auditoria |
| `registrarBusca` | callable | Soma o termo em `buscas_mes/{AAAA-MM}` (geral e por município). Ignora termo com menos de 3 letras ou com 5+ dígitos. Não grava uid nem e-mail |

No navegador, a busca lê `busca_indice/_meta` (1 leitura) e só baixa as partes quando o índice mudou (guarda em `localStorage`, chave `pde_busca_idx`). Acervo do município e Meus trabalhos são lidos na primeira busca da sessão. Ferramentas vêm dos próprios cartões da tela, que já seguem plano e perfil. O registro do termo é feito uma vez por termo por sessão, 2,5 s depois de parar de digitar ou ao abrir um resultado.

### Auditoria

| Função | Tipo | O que faz |
|---|---|---|
| `auditarBanco` | `onDocumentWrittenWithAuthContext` em `{colecao}/{id}` | Registra criação, alteração e exclusão em qualquer coleção de primeiro nível |
| `auditarBancoSub` | `onDocumentWrittenWithAuthContext` em `{colecao}/{id}/{sub}/{subId}` | O mesmo para subcoleções (um nível) |
| `registrarEntrada` | callable | Registra a entrada com IP, navegador, perfil e tela (chamada pelo `pde-entrada.js`) |

### Prova online (`provas-online.js`, `fotos-provas.js`)

| Função | Tipo | O que faz |
|---|---|---|
| `publicarProvaOnline` | callable | Confere turma e recurso `prova_online`, valida janela, duração e questões, sobe imagens, monta a lista de alunos (pela matrícula) e separa questões e gabarito. Inclui o modo **Aplicar agora** e a sala de espera |
| `iniciarProvaOnline` | callable | Cria a tentativa dentro da janela, com prazo e embaralhamento determinístico por aluno |
| `entregarProvaOnline` | callable | Entrega e corrige (recusa se bloqueada) |
| `acaoProvaOnline` | callable | Nova chance, mais tempo, encerrar, liberar notas, cancelar |
| `corrigirProvaOnline` | callable | Correção das questões abertas pelo professor. `finalizar: true` trava a correção (só com prova encerrada e nenhum `pendentes > 0`; grava `correcao_finalizada`, `_em`, `_por` e um registro na Auditoria). Depois disso, mudar questão já corrigida exige `justificativa` (15+ letras): entra em `por_questao[q].revisoes` (até 20: em, por, de, para, motivo), marca `reavaliada` e grava na Auditoria com nota antes e depois. Entrega tardia ainda pendente corrige sem justificativa |
| `aplicarRecuperacao` | callable | Reaplica a prova como recuperação |
| `fecharProvasOnline` | a cada 5 min | Entrega tentativas vencidas e encerra provas cuja janela terminou |
| `limparFotosProvas` | 03:15 diário | Apaga fotos de confirmação de anos anteriores |

Correção automática: múltipla escolha, verdadeiro ou falso, resposta curta (sem acento, com tolerância), várias respostas e grades. Dissertativas ficam para o professor.

### Cadastro, senhas e fichas

| Função | Tipo | O que faz |
|---|---|---|
| `criarUsuarioManual`, `contasSemCadastro` | callables | Cadastro manual pela rede com senha provisória; lista de contas criadas sem cadastro no Portal (admin) |
| `senhaProvisoria`, `trocarSenhaProvisoria` | callables | Admin, secretaria e direção geram senha de 24 h; troca obrigatória no primeiro login |
| `expirarSenhasProvisorias` | de hora em hora (minuto 15) | Invalida a provisória não trocada em 24 h |
| `limparFotosAlunos` | domingo 03:40 | Apaga fotos de cadastro 1 ano depois da saída do aluno |
| `professoresDaEscola` | callable | Lista de professores para a Grade das turmas (só nome e e-mail) |

### Gestão escolar e notas

| Função | Tipo | O que faz |
|---|---|---|
| `freqResumo` | gatilho em `freq_chamadas` | Recalcula o resumo da turma (frequência, faltas, dias seguidos, risco) |
| `fecharPeriodo`, `reabrirPeriodo` | callables | Fechamento do bimestre com cópia oficial; reabrir só a Direção, com motivo |
| `historicoPlanilha`, `historicoEscola` | gatilhos | Histórico de alterações das notas |
| `portaria` | HTTP pública | Totem: lista de alunos e registro de entradas, com foto opcional |
| `limparFotosPortaria` | 03:17 diário | Apaga fotos com mais de 15 dias |
| `avisoChegada`, `avisosFamilia*`, `comunicadoFamilias` | gatilhos e agendadas | Avisos às famílias e comunicados da escola. O envio de material do professor às famílias também passa por `avisos.js`, com cota diária |
| `emailBuscaAtiva` | segunda 06:40 | Lista de alunos em risco para cada gestor |
| `calendarioIcs` | HTTP pública | Calendário da rede em .ics, protegido por token |
| `emailAgendaDia`, `emailLembretes` | 06:30 e a cada 15 min | Agenda do professor |
| `painelSecretaria`, `painelUso` | callables | Painel da Rede (só números) e painel de uso da infraestrutura (inclui Servidor NEWPC e Novidades em uso) |
| `usoRealDiario`, `usoRealAgora` | 03:20 diário e callable | Uso real: quem fez ação de valor na semana, por município e escola, com horas economizadas estimadas |

### Conteúdo, e-mails internos, backup e Formação

| Função | O que faz |
|---|---|
| `sincronizarAtividades`, `importarBiblioteca` | Importação do Banco Curricular e da Biblioteca (admin) |
| `contarReacao*`, `contarRespostaPesquisa` | Somam votos de vídeos, livros, notícias, atividades e pesquisas |
| `emailNovoCadastro`, `emailPreCadastros`, `emailResumoDiario` | Avisam a equipe NEWPC de cadastros e mandam o resumo das 07:00 |
| `emailDicaProfessor`, `emailDicaAluno`, `emailRelatorioEnviado`, `emailCertificadoEmitido` | Avisos de envios para moderação |
| `emailChamadoTecnico`, `emailTvConectada`, `emailComunicadoTv` | Chamados técnicos e eventos das TVs |
| `backupInfo`, `backupConfigurar`, `backupAgora`, `backupLink`, `backupSemanal` | Backup para Drive compartilhado ou download, semanal aos domingos 03:23 |
| `iniciarAula`, `acompanharAula`, `sortearProva`, `salvarRespostas`, `corrigirQuiz`, `emitirCertificado`, `consultarCertificado`, `revogarCertificado`, `obterGabarito`, `definirPapel`, `publicarCurso`, `duplicarCurso`, `excluirCurso`, `relatorioAdesao`, `vincularContaFormacao` | Formação Continuada |

### Agenda das funções e robôs automáticos (horário de MS)

| Quando | O quê |
|---|---|
| A cada 5 min | `fecharProvasOnline` |
| A cada 15 min | `emailPreCadastros`, `emailLembretes` |
| De hora em hora, minuto 15 | `expirarSenhasProvisorias` |
| A cada 2 h, das 06:15 às 22:15 | `indiceBusca` |
| A cada 5 min | `enviarComunicados` (só trabalha com comunicado na fila) |
| 02:17 diário | Workflow **Copiar acervo para o Nextcloud** (GitHub Actions, só arquivos novos) |
| 03:15 diário | `limparFotosProvas` |
| 03:17 diário | `limparFotosPortaria` |
| 03:20 diário | `usoRealDiario` |
| 03:23 domingo | `backupSemanal` |
| 03:40 domingo | `limparFotosAlunos` |
| 06:30 diário | `emailAgendaDia` |
| 06:40 segunda | `emailBuscaAtiva` |
| 07:00 diário | `emailResumoDiario` |
| 12:40, 18:10 e 22:40, seg a sáb | `avisosFamiliaManha`, `Tarde`, `Noite` |
| 18:00, seg a sáb | `resumoRedeDiario` |

## Auditoria

Trilha de tudo o que acontece no Portal, para atender o pedido de auditar qualquer ação e o Marco Civil da Internet (art. 15: guarda dos registros de acesso por 6 meses). Fica no menu do administrador em **Sistema › Auditoria**.

<!-- captura: tela Sistema › Auditoria com filtros De, Até, Ação, Município, Pessoa e a lista de registros -->

### Como é gravada

1. **Mudanças no banco**: `auditarBanco` e `auditarBancoSub` disparam em toda gravação e montam o registro com `montarRegistro()` (função pura, testável). Ação `criou`, `alterou` ou `excluiu`; em `acessos_dia`, vira `acessou` e mostra quais arquivos do acervo foram abertos ou baixados.
2. **Entradas**: o `pde-entrada.js` chama `registrarEntrada` uma vez por sessão e por tela. O servidor grava ação `entrou`, IP (do cabeçalho `x-forwarded-for`), navegador, perfil, município, escola e nome da tela. Contas só da Formação aparecem com perfil `formacao`.
3. **Autor**: gravação feita pelo navegador chega com o uid do usuário (`autor_tipo: usuario`). Gravação das funções aparece como `sistema`, e o autor vem do campo de autoria do próprio documento (`atualizado_por`, `criado_por`, `autor_uid`, `uid`).

### O que fica e o que não fica

| Item | Regra |
|---|---|
| Campos alterados | Sempre a lista de campos que mudaram (até 60) |
| Valor antes e depois | Só nos campos de controle da lista `VALOR` (perfil, status, papel, vínculo, licença, publicado, notas, faltas, saldo, título, pasta, origem, plano, cota, bimestre e outros) |
| Segredos | Nunca: campos com senha, PIN, token, chave, segredo ou hash ficam sem valor |
| Campos técnicos | `atualizado_em`, `ultimo_acesso`, `ultimo`, `em`, `ts` e semelhantes não contam como alteração |
| Coleções ignoradas (`IGNORAR`) | A própria `auditoria`, contadores, presença ao vivo, filas internas e reações: `backups_log`, `stats`, `temas_populares`, `vistos`, `tele_sessoes`, `cmd`, `avisos_contador`, `rec_busca`, `uso_real`, `ia_uso`, `portal_ia_uso`, `freq_resumo`, `rede_feed`, `nc_mapa`, `qr_aulas`, `po_sala`, `turma_aluno_estado`, `turma_presenca`, `*_reacoes`, `tv_telas`, `tv_pareamentos`, `portaria_vistas` |
| Documento ignorado | `config/nc_copia` |
| Busca geral | `busca_indice` e `buscas_mes` estão em `IGNORAR` (índice refeito a cada 2 h e contadores). A busca de cada pessoa **não** é auditada, por decisão de privacidade (é leitura e já é agregada sem identificar). O botão **Atualizar o índice** grava um registro próprio |
| Retenção | `expira_em` = gravação + 183 dias. A política de TTL apaga sozinha |

A tela busca por período com um filtro de igualdade no banco (pessoa, município ou ação, nessa ordem de prioridade), filtra o resto na tela, carrega de 300 em 300 e exporta com **Exportar planilha (CSV)**.

:::regra
Regra permanente: toda tela ou coleção nova entra na auditoria.
- Coleção nova de primeiro nível ou com um nível de subcoleção já é auditada sozinha. Decida se ela é ruído técnico (vai para `IGNORAR`) e se tem campo de controle cujo valor deve ficar (vai para `VALOR`, nunca dado sensível).
- Dê um nome legível para a coleção em `AUD_COLECOES` (tela Auditoria, `entrar/index.html`).
- Subcoleção com dois níveis ou mais (`a/{id}/b/{id}/c/{id}`) não é pega pelos gatilhos atuais: crie o gatilho ou guarde em outro formato.
- Toda tela nova com login inclui `/assets/pde-entrada.js`.
:::

## Robôs do GitHub Actions

Todos ficam em `.github/workflows` e usam o segredo `FIREBASE_SERVICE_ACCOUNT`. Rodam pela aba Actions, no botão **Run workflow**. O resumo da execução mostra os avisos (`::notice::`, `::warning::`, `::error::`), porque o log completo não é baixado daqui.

| Workflow | Quando | O que faz |
|---|---|---|
| Publicar no Firebase (`publicar-firebase.yml`) | À mão | Confere a sintaxe de `functions/*.js`, roda os testes de regras se **testar_regras** estiver marcado (padrão: sim), publica o que estiver em **alvo** (formato do `--only`; `nada` só testa) e apaga as funções listadas em **apagar_funcoes** (`nome` ou `nome@regiao`). Erros do deploy aparecem no resumo |
| Copiar acervo para o Nextcloud (`copiar-nextcloud.yml`) | Todo dia 02:17 (Cuiabá) e à mão | Etapas `teste` (amostra), `copiar` (o que falta, retoma de onde parou) e `conferir` (só leitura). Coleções: `atividades`, `biblioteca`, `colorir`, `materiais`, `rede`. Nunca apaga o original. Usa `NC_APP_SENHA` |
| Consulta (só leitura) (`consulta-leitura.yml`) | À mão | Roda `scripts/consulta-{nome}.mjs`. A opção `portal-ia` roda o teste real do Portal IA; as `arquivos-*` rodam a migração para São Paulo. Arquivos gerados saem como artefato `saida` (3 dias) |
| Escola de laboratório (`escola-laboratorio.yml`) | À mão | `diagnostico` (só lê), `criar`, `historico`, `apagar`, no município `lab-muni` |
| Fichas do acervo em PDF (`fichas-acervo.yml`) | À mão | Gera os PDFs das fichas recriadas no ramo `fichas-candidatas`; com **publicar** = `sim`, troca o PDF no acervo (o antigo fica em `url_original`) |
| Fotos candidatas para card do Início (`fotos-card.yml`) | À mão | Gera fotos pelo Portal IA (`consulta-foto-card` ou `fotos-portal-ia`) e grava no ramo `fotos-candidatas` |
| App do Maestro (aluno) (`maestro-apk.yml`) | À mão | Gera o APK do aluno (`maestro-app/`) e publica numa Release do GitHub (pública; o cartão **App do Maestro** em `apps/` busca a Release `maestro-*` mais nova pela API do GitHub e, se falhar, usa o link da 1.1.0 gravado na página); **so_testar** usa chave descartável e não publica. Usa `MAESTRO_KEYSTORE_B64` e `MAESTRO_SENHA` |
| Publicar documento (manual/POP) (`publicar-documento.yml`) | À mão | Publica nova versão de um PDF do ramo `manuais` na Documentação/Ajuda; sem **gravar**, só simula |
| Backup no servidor NEWPC (`backup-servidor.yml`) | Todo dia 01:41 (backup) e dia 2 às 03:11 (teste), e à mão | `scripts/backup-servidor.mjs`: banco inteiro em NDJSON (com subcoleções), contas de login (`listUsers`) e `git bundle --all` num pacote `tar` cifrado com `openssl enc -aes-256-cbc -pbkdf2 -iter 200000` (senha no segredo `BACKUP_SENHA`), em `04-Backups/diario` (30 dias) e `mensal` (12 meses); arquivos do bucket principal em espelho incremental cifrado (`04-Backups/arquivos`, nomes por hash, manifesto cifrado; sai do espelho 30 dias depois de sumir do Portal; bucket da portaria fica de fora). Grava `backups_log` (destino `servidor`), `stats/backup_servidor` e um registro na auditoria. Restauração: `scripts/restaurar-backup.mjs` (abrir, banco, arquivos) e POP-PDE-29 |

:::atencao
Apesar do nome, o workflow **Consulta (só leitura)** tem opções que gravam: `creditos-implantacao` (carga de créditos), `portal-ia` (cria materiais de teste), `arquivos-preparar` e `arquivos-links`, os ajustes de posição de vídeos e jogos, `capas-jogos`, `acervo-renomear`, `converter-acervo` e `nc-teste`. Confira o cabeçalho do script antes de rodar.
:::

## Scripts de manutenção

Ficam em `scripts/`. Os que usam `firebase-admin` rodam na pasta `functions` (pelo GitHub Actions ou no Cloud Shell), com a credencial da conta, contra o banco de produção. Regra da casa: rodar primeiro sem gravar (simulação) quando o script oferece.

| Script | O que faz | Grava? |
|---|---|---|
| `copiar-nextcloud.mjs` | Cópia do acervo para o Nextcloud e resumo em `config/nc_copia` | Sim (no Nextcloud e no mapa), nunca apaga o original |
| `migrar-arquivos-sp.mjs` | Migração do bucket principal para São Paulo: `levantar`, `preparar`, `links` | Só nas etapas 2 e 3 |
| `lab-escola.mjs` | Escola de laboratório (`lab-muni`, 30 alunos fictícios, 9 contas de teste) | Sim, exceto `--diagnostico` |
| `teste-portal-ia.mjs` | Teste de ponta a ponta do Portal IA com a conta de laboratório | Sim (materiais de teste) |
| `fichas-acervo.mjs`, `ficha-pdf.mjs` | Fichas do acervo no padrão do Portal IA, em PDF | Só com `PUBLICAR=1` |
| `fotos-portal-ia.mjs`, `consulta-foto-card.mjs` | Fotos dos cards com os personagens da NEWPC | Não (grava em `functions/saida/`) |
| `publicar-documento.mjs` | PDF para a Documentação/Ajuda, com versões | Sim |
| `limpar-testes.mjs`, `inventario-dados.mjs` | Limpeza dos dados de teste e da Rede Modelo; inventário demonstração x real | Só com `--executar`; não |
| `consulta-*.mjs` | Consultas para decisão e diagnóstico (auditoria, acervo, Portal IA, rede, uso real, logs, `busca-indice` para medir o índice da busca e `buscas` para o que a rede procura) | A maioria não (ver o aviso acima) |
| `diag-provas-online.mjs` | Diagnóstico das provas online | Não |
| `enviar-historico.mjs` | Envia uma vez o histórico de cadastros e Dicas em CSV | Não grava, envia e-mail |
| `importar-atividades.mjs` | Banco Curricular do Drive para Atividades | Só com `--gravar` |
| `definir-papel.mjs` | Papel editorial da Formação (`admin`, `editor`, `nenhum`) | Sim, direto |
| `importar-colorir.mjs`, `historias-educativas.mjs` | Desenhos e Histórias Educativas | Só com `--gravar` |
| `triagem-biblioteca.mjs`, `aprovar-biblioteca.mjs` | Triagem de direitos e aprovação da Biblioteca | Só com `--gravar` / sim |
| `importar-gutenberg.py`, `importar-librivox.py` | Livros e audiolivros em domínio público | Só com `--gravar` |
| `migrar-academia.mjs` | Migração da antiga Academia para a Formação | Só com `--gravar` |
| `tv-campanhas-padrao.py` | Campanhas padrão da TV | Sim (idempotente) |
| `gibis/` | Gibi próprio "Turma do Pantanal" | `publicar.py` grava |
| `maestro-apk.sh`, `maestro-apk-webview.sh` | Geração do APK do Maestro (usados pelo workflow) | Não |
| `teste-regras-*.mjs` | Testes das regras no emulador | Não |
| `teste-calendario.mjs`, `teste-frequencia.mjs` | Testes dos núcleos de cálculo | Não |
| `teste-portaria.mjs` | Teste real da função de portaria | Temporário, limpa no fim |

A Rede Modelo de demonstração foi apagada antes do cadastro real. `demo-rede.mjs` e `demo-olhar.mjs` ficam só como referência; os testes com dados de verdade usam a Escola de laboratório.

:::atencao
Scripts que usam o `firebase-admin` precisam terminar com `process.exit(0)`, senão o processo fica preso. No Cloud Shell, cargas longas devem rodar com `nohup`, gravando log em arquivo, porque a sessão cai. Pelo GitHub Actions isso não é problema.
:::

## Testes e publicação

### Antes de publicar

1. Validar a sintaxe de todo JavaScript alterado com `node --check`. Para o JavaScript embutido em HTML, extrair o bloco `<script type="module">` para um arquivo temporário e checar.
2. Rodar os testes dos núcleos: `node scripts/teste-calendario.mjs` e `node scripts/teste-frequencia.mjs`.
3. Sempre que mexer em `firestore.rules` ou `storage.rules`, rodar os testes de regras. O caminho normal é o workflow **Publicar no Firebase** com **testar_regras** marcado: ele roda todos os `scripts/teste-regras-*.mjs` no emulador, e as falhas aparecem como avisos no resumo.

| Script | Cobre |
|---|---|
| `teste-regras-apps.mjs` | Aplicativos, gestão escolar e a maior parte das regras gerais |
| `teste-regras-presenca.mjs` | Presença da Turma ao Vivo (campos `fora` e `saiu`, só o próprio aluno grava, professor da escola lê) |
| `teste-regras-comunicados.mjs` | Comunicados por e-mail: só admin lê, ninguém grava pelo navegador |
| `teste-regras-busca.mjs` | Busca geral: índice lido por licenciados, buscas só pelo admin, ninguém grava pelo navegador |
| `teste-regras-aluno.mjs` | Perfil aluno |
| `teste-regras-extras.mjs` | Liberações exclusivas do professor |
| `teste-regras-grade.mjs`, `teste-regras-substituicao.mjs` | Grade das turmas e substituição de professor |
| `teste-regras-sala.mjs` | Sala de espera da prova online |
| `teste-regras-ia.mjs`, `teste-regras-portal-ia.mjs` | IA Studio antigo e Portal IA |
| `teste-regras-acervo-rede.mjs` | Acervo da rede no Firestore (inclui origem NEWPC e links) |
| `teste-regras-acervo-storage.mjs`, `teste-regras-fotos.mjs` | Storage do acervo e fotos da prova online |

Para rodar localmente, a partir da raiz do repositório (com Java instalado):

```
mkdir -p /tmp/rt && cp scripts/teste-regras-*.mjs firestore.rules storage.rules /tmp/rt/ \
 && cd /tmp/rt && npm init -y >/dev/null && npm i --silent @firebase/rules-unit-testing@3 firebase@10 \
 && echo '{"firestore":{"rules":"firestore.rules"},"storage":{"rules":"storage.rules"}}' > firebase.json \
 && for t in teste-regras-*.mjs; do firebase emulators:exec --only firestore,storage --project demo-pe5 \
    "node $t $(case $t in *fotos*|*storage*) echo storage.rules;; *) echo firestore.rules;; esac)"; done
```

O resultado esperado é "0 falha(s)" em cada script. Regra nova ganha teste novo no script correspondente.

4. Para telas, a equipe usa testes de ponta a ponta com Playwright e um Firebase simulado em memória, cobrindo os fluxos principais e os perfis envolvidos. Para a IA e os envios, os testes reais usam as contas da Escola de laboratório.

### Fluxo de publicação

| Ramo | Papel |
|---|---|
| `vitrine-ia` | Ramo de trabalho. Recebe os commits e é mantido no mesmo ponto da `main` |
| `main` | O que está no ar: o GitHub Pages publica a cada push |
| Ramos de funcionalidade (`noticias`, `tempo-aula`, `moderacao` e outros) | Prévias e trabalhos em andamento, juntados depois |
| `manuais`, `fichas-candidatas`, `fotos-candidatas` | Arquivos gerados para revisão (PDFs, fichas e fotos), fora do site |

Front: commit na `vitrine-ia` e push para as duas (`git push origin vitrine-ia` e `git push origin vitrine-ia:main`). Regras, índices e funções: workflow **Publicar no Firebase**, sem depender do Cloud Shell. Nenhuma chave passa pelo chat: a conta de serviço fica no segredo do GitHub e as chaves das funções no Secret Manager.

### Ordem de publicação

:::regra
Quando front e regras mudam juntos, publique **primeiro as regras e as funções**, depois o front. O front novo quebra com a regra antiga; o front antigo costuma funcionar com a regra nova.
:::

1. Rodar **Publicar no Firebase** com o **alvo** certo (por exemplo `firestore:rules,functions:portalIa`) e **testar_regras** marcado.
2. Função que usa segredo novo: gravar o segredo no Secret Manager **antes**. Sem ele, o deploy de qualquer função falha.
3. Índice ou TTL novo: publicar `firestore:indexes` e esperar o índice ficar "Ativo" no console. Enquanto isso, a tela mostra erro de índice.
4. `git commit` e push da `vitrine-ia` para a `main`. O GitHub Pages publica em 1 a 2 minutos.
5. Conferir no ar (por exemplo, buscando um trecho novo da página publicada). A Lousa usa endereço com versão que troca a cada 10 minutos, para o navegador não ficar com uma Lousa antiga.

Logs das funções: `firebase functions:log --project portal-educador-5`, o Cloud Logging ou as consultas `logs-portal-ia` e `logs-nc` do workflow de consulta.

### Convenções de código

- **Sem `onclick` no HTML**: todo botão usa `data-action` e um ouvinte central por página (delegação de eventos).
- **Um arquivo por tela**, autocontido, com CSS e JS embutidos. Componentes comuns só em `/assets`.
- **Toda tela com login inclui `/assets/pde-entrada.js`**, e toda coleção nova é avaliada para a auditoria (ver **Auditoria**).
- **Núcleos compartilhados** entre navegador e servidor (calendário e frequência) são cópias idênticas, conferidas por teste. Listas de planos e recursos repetidas entre front e funções mudam juntas.
- **Regras com lista fechada de campos** (`keys().hasOnly`), limites de tamanho e IDs determinísticos para impedir duplicidade sem transação.
- **O que custa ou é sensível passa pela função**: IA, créditos, materiais da turma, rede, links assinados e contas técnicas são gravados só pelo servidor.
- **Dados sensíveis**: famílias, saúde, busca ativa e fotos só a gestão da escola lê; e-mails internos não levam nome de aluno; painéis da secretaria só devolvem números; a auditoria não guarda valor de campo sensível.
- **Idempotência**: funções que podem rodar duas vezes usam ID único.
- **Testes**: dados de teste só no `lab-muni`; projeto do emulador sempre com prefixo `demo-`.
- Textos, comentários e mensagens de erro em português, dizendo o que a pessoa deve fazer.

## Pontos de atenção e melhorias

:::nota
Resolvidos em 01/11/2026: todos os registros da coleção `auditoria` (inclusive os gravados pelas funções antigas) passaram a ter `expira_em` e vencem em 6 meses; a leitura da auditoria ficou restrita ao administrador do Portal (`admin()`).
:::

Os itens abaixo estão ordenados do mais sério para o menos sério.

| # | Ponto | Risco | Recomendação |
|---|---|---|---|
| 1 | Arquivos servidos por link com token permanente (Storage), inclusive os copiados para Materiais da turma e rede | O link de um PDF funciona fora do Portal, para sempre | Para o que é diferencial comercial, servir pelo `linkArquivoNc` (link de minutos) ou por URL temporária |
| 2 | E-mail por conta Google com limite diário compartilhado | Num dia de muitos avisos e envios, os e-mails param, inclusive chamados técnicos. Os avisos às famílias param em 1.500 por dia e o professor tem cota própria, mas não há contador único | Serviço transacional ou conta dedicada; contador único de envios para todas as funções |
| 3 | Custo da auditoria | Cada gravação no banco dispara uma função e grava mais um documento | Acompanhar no painel de uso; mandar para `IGNORAR` o que for ruído |
| 4 | Bucket principal nos Estados Unidos | Transferência internacional de dados (informada na Privacidade) | Concluir a migração com `migrar-arquivos-sp.mjs` |
| 5 | Pastas do Drive públicas e chave da API no código | Quem tiver o ID baixa o acervo sem licença | Fechar as pastas depois das importações, ler com a conta de serviço, trocar a chave |
| 6 | Entrega do servidor NEWPC no mesmo domínio do login do Nextcloud | Arquivo entregue e tela de login do Nextcloud dividem a mesma origem | Subdomínio só para arquivos e trocar `NC_ENTREGA_URL` |
| 7 | `status` "inativo" do município não bloqueia nas regras | Rede inativa sem data de fim continua acessando | Incluir o status em `contratoOk()` e sempre preencher a data de fim |
| 8 | Plano do professor conferido no front e nas telas, não nas regras | Professor lê catálogos fora do plano pela API | Criar `profPode(m)` nas regras, como `alunoPode(m)` |
| 9 | Storage não confere contrato vigente | Professor de rede vencida continua usando pastas pessoais | Ler o município nas regras de Storage ou assumir como carência |
| 10 | Dois sistemas de administrador (perfil e papel da Formação) | Admin novo é barrado em callables da Formação | Aceitar o perfil admin nas callables ou incluir no checklist |
| 11 | Painel da Rede filtra uso pelo nome do município | Renomear ou homônimos misturam os números | Gravar e filtrar por `municipio_id` |
| 12 | Workflow **Consulta (só leitura)** com opções que gravam | Alguém roda achando que só lê | Separar em dois workflows ou marcar no nome da opção |
| 13 | Listas de planos e recursos duplicadas entre front e funções | Mudança num lado só libera ou trava errado | Uma fonte única em `config` ou arquivo comum |
| 14 | Aluno ligado à turma por texto | **Melhorou**: a matrícula (código + PIN, QR, Google da escola) liga por ID. O aluno que entra só pelo domínio do e-mail ainda nasce sem escola | Levar todos para a matrícula |
| 15 | `avaliacoes` pública com gabarito e `respostas` sem dono | **Resolvido em 26/10/2026** | |
| 16 | Documentação e comentários desatualizados | Retrabalho de quem chega ao código | Usar esta parte como base de um `docs/` no repositório |
