# Portal do Educador 5.0 · Notas para a Parte Técnica e a Operação Interna do manual

Levantamento feito direto no código do repositório local `/home/claude/portal-educador-5` (estado de 26/10/2026, 195 commits, último: "Prova online: um aparelho por vez..."). Tudo o que está aqui foi lido nos arquivos citados. O que não deu para confirmar só pelo código está marcado **(confirmar)**. Nenhum valor de senha, chave ou segredo foi copiado: aparecem só os NOMES.

Convenção de leitura:
- "admin" = usuário com `usuarios/{uid}.perfil == "admin"` e `status == "ativo"` (equipe NEWPC).
- "licenciado", "vinculado" etc. = funções auxiliares das regras, explicadas na seção 2.2.
- Horários das funções agendadas: fuso `America/Campo_Grande` (MS).

---

## 1. Arquitetura

### 1.1 Visão geral em uma frase

Site estático (HTML/JS autocontido, um arquivo por tela) publicado pelo GitHub Pages no domínio `app.portaldoeducador.com.br`, que conversa direto com o Firebase do projeto `portal-educador-5` (Authentication, Firestore, Storage) e com Cloud Functions v2 em `southamerica-east1`. Um Worker da Cloudflare (R2) serve o acervo de arquivos protegido por licença.

```
Navegador (professor, aluno, gestor, secretaria, TV, totem)
   |  HTML/JS estático (GitHub Pages, repo Newpc-Alan/portal-educador-5, CNAME app.portaldoeducador.com.br)
   |  Firebase JS SDK 10.12.2 (gstatic), login Google (popup/redirect) e e-mail/senha
   v
Firebase projeto portal-educador-5
   - Authentication
   - Firestore (regras em firestore.rules, índices em firestore.indexes.json)
   - Storage: 3 buckets (principal, portaria, backups)
   - Cloud Functions v2 (Node 22, southamerica-east1): callables, HTTP públicas, agendadas, gatilhos Firestore
   - Secret Manager: SMTP_SENHA
Cloudflare Worker "acervo" + bucket R2 pde-acervo (arquivos do acervo com link assinado de 5 min)
Google Drive (origem das importações de Atividades, Biblioteca, Colorir, Histórias; destino dos backups)
Gmail SMTP (envio de todos os e-mails automáticos)
```

### 1.2 Hospedagem do front (GitHub Pages)

- `CNAME` contém exatamente `app.portaldoeducador.com.br`.
- Remoto git: `https://github.com/Newpc-Alan/portal-educador-5`. Não há pasta `.github/` (sem CI, sem Actions): o GitHub Pages publica direto a branch configurada no repositório **(confirmar qual branch: provavelmente `main`, raiz)**.
- Não há etapa de build: o que está no repositório é o que vai ao ar. `.gitignore` exclui só `node_modules/`, `*.log` e `.firebase/`.
- Páginas (cada uma é um `index.html` autocontido, CSS e JS inline):

| Caminho | Título / função |
|---|---|
| `/index.html` | Página pública "Recursos digitais e IA para o professor" |
| `/entrar/` | App principal (541 KB): login, Início, módulos, painel do administrador (Usuários, Municípios, Plano e módulos, Importar, Acervo, Módulos do Portal, "Entrar como...") |
| `/aluno.html` | Avaliação legada por código de acesso (aluno sem login) |
| `/prova/` | Prova online (aluno logado, modo protegido) |
| `/provas/` | Gerador de Provas |
| `/painel/` | Painel da Rede (Secretaria / gestor) |
| `/gestao/` | Gestão Escolar (hub) |
| `/relatorios/` | Central de Relatórios |
| `/formacao/` e `/formacao/admin/` | Formação Continuada e painel editorial |
| `/validar/` | Validação pública de certificado |
| `/biblioteca/`, `/colorir/`, `/dicas/`, `/museus/`, `/lousa/`, `/vitrine/` | Módulos de conteúdo |
| `/chamado/` | Chamado técnico pela etiqueta QR (sem login) |
| `/tv/`, `/tv/leve/`, `/tv/teste/` | Portal do Educador TV (player da TV, PWA com `sw.js` e `manifest.webmanifest`) |
| `/apps/` | Aplicativos Úteis: `calendario`, `corretor`, `equipe`, `familias`, `folha`, `frequencia`, `notas`, `recursos`, `teleprompter` (+`controle`), `turma`, `tv` (painel das TVs) |

- `assets/`: imagens dos cards, logos das redes, mídias da TV (`assets/tv/campanhas/`), gibis próprios (`assets/gibis/...`), bibliotecas de terceiros (`assets/vendor`) e duas cópias de núcleos compartilhados com as functions: `assets/js/calendario-nucleo.js` e `assets/js/frequencia-nucleo.js` (os testes conferem que são idênticas às de `functions/`).

### 1.3 `firebase.json`: o que cada deploy publica

```json
firestore: { rules: "firestore.rules", indexes: "firestore.indexes.json" }
storage: [ {target:"principal", rules:"storage.rules"},
           {target:"portaria",  rules:"storage-portaria.rules"},
           {target:"backups",   rules:"storage-backups.rules"} ]
functions: [ {source:"functions", codebase:"default", ignore:[node_modules,.git,*.log]} ]
```

Mapa dos targets em `.firebaserc` (projeto padrão `portal-educador-5`):

| Target | Bucket | Regras | Uso |
|---|---|---|---|
| principal | `portal-educador-5.firebasestorage.app` | `storage.rules` | arquivos dos professores, TV, biblioteca, atividades, colorir, dicas, Formação |
| portaria | `portal-educador-5-portaria` | `storage-portaria.rules` | fotos da entrada (totem), guarda de 15 dias |
| backups | `portal-educador-5-backups` | `storage-backups.rules` | exportações do banco e pacotes de backup, apagados em 7 dias |

- `firebase deploy --only firestore:rules` publica só as regras do banco; `firestore:indexes` publica os índices.
- `firebase deploy --only storage` publica as três regras de Storage de uma vez (é possível `storage:principal` etc. **(confirmar sintaxe com target)**).
- `firebase deploy --only functions:NOME` publica uma função; `--only functions` publica todas (56 exportadas, ver seção 4).
- Parâmetros públicos das functions ficam em `functions/.env.portal-educador-5` (carregado automaticamente para esse projeto). Segredo fica no Secret Manager.
- **Não** está no `firebase.json`: Hosting (o front não é Firebase Hosting), regras de ciclo de vida dos buckets (7 e 15 dias), CORS do bucket, o Worker da Cloudflare. Tudo isso é configurado à parte (ver 1.4 a 1.6).

### 1.4 `cors.json`

Configuração de CORS para aplicar num bucket do Storage (via `gsutil cors set cors.json gs://BUCKET` ou `gcloud storage buckets update --cors-file`) **(confirmar em qual bucket foi aplicado; provavelmente o principal)**:
- Origens: `https://app.portaldoeducador.com.br` e `https://www.portaldoeducador.com.br`
- Métodos: GET, HEAD. Cabeçalhos expostos: Content-Type, Content-Encoding, Content-Length. Cache do preflight: 3600 s.
- Serve para o navegador baixar por `fetch` arquivos do Storage (ex.: aulas da Lousa e provas em JSON compactado, PDFs no leitor).

### 1.5 `cloudflare/acervo-worker.js` (Worker do Acervo, Cloudflare R2)

O que é: um Worker da Cloudflare que entrega arquivos do bucket R2 `pde-acervo` só para quem tem licença. Não é publicado pelo Firebase; é colado/configurado no painel da Cloudflare.

- Configuração no painel: vínculo R2 com nome de variável `BUCKET` (bucket `pde-acervo`) e variável secreta `SEGREDO` (assina os links).
- O endereço do Worker fica em Firestore `config/acervo.api` (o admin salva na tela Acervo do `/entrar/`).
- Origens CORS aceitas: app, www e `http://localhost:8811`.
- Rotas:
  - `GET /saude`: responde "ok".
  - `GET /link?key=...`: exige `Authorization: Bearer <ID token do Firebase>`; confere o token (JWKS do Google), lê `usuarios/{uid}` pela API REST do Firestore usando o próprio token do usuário (as regras valem) e aplica a mesma lógica de licença (admin; aluno com contrato do município vigente e chave começando por módulo liberado em `modulos_aluno`; professor institucional com contrato vigente; avulso/teste com `licenca_fim` no futuro). Devolve link assinado válido por 5 minutos.
  - `GET /baixar?key&exp&sig`: entrega o arquivo se a assinatura confere e não expirou.
  - `PUT /arquivo?key=...` e `DELETE /arquivo?key=...`: só admin; envia/apaga no R2 (cabeçalho `X-Nome-Arquivo` define o nome do download).
- Módulos que usam o acervo (constante `MODULOS_ACERVO` no `/entrar/`): atividades, colorir, biblioteca, datas, historias, dicas, provas, relatorios, formacao, apps. Metadados em Firestore `acervo/{id}`.
- Observação: hoje Atividades, Biblioteca, Colorir e Histórias são gravados no Firebase Storage pelas importações (seção 5). O comentário de `storage.rules` ("o acervo fica no Cloudflare R2, fora daqui") está desatualizado (ver dívida técnica).

### 1.6 Regras de Storage (`storage*.rules`)

Ver seção 3 (caminhos, limites, tipos).

### 1.7 `README.md`

Contém só `# portal-educador-5`. Não há documentação de instalação, deploy ou arquitetura no repositório: esta parte do manual é a primeira documentação técnica.

### 1.8 Dependências

- `functions/package.json`: `"type":"module"`, Node 22, `firebase-admin ^12.3.0`, `firebase-functions ^5.0.1`, `nodemailer ^6.10.1`. Scripts: `serve` (emulador de functions), `deploy`, `logs`.
- `scripts/package.json`: `firebase-admin`, `nodemailer`, `sharp` (para os scripts da pasta).
- Front: Firebase JS SDK 10.12.2 via `gstatic.com/firebasejs/10.12.2/...` em todas as páginas (98 referências), fontes do Google Fonts.

---

## 2. Firestore

### 2.1 Coleções (todas as que aparecem em `firestore.rules`)

Qualquer caminho que não aparece na lista é negado por padrão.

**Rede, cadastro e acesso**

| Coleção | Quem lê | Quem escreve | Campos-chave / observações |
|---|---|---|---|
| `municipios/{id}` | qualquer usuário com cadastro (`temCadastro`) | admin | `nome`, `uf`, `status` (piloto/ativo/inativo), `contrato_numero`, `vigencia_fim` (texto) e `vigencia_fim_ts` (timestamp, é o que as regras usam), `modulos_professor[]`, `modulos_aluno[]`, `modulos_secretaria[]` ("painel"), `recursos[]` ("prova_online"), `dominios_aluno[]`, `logo_url`, `demo` |
| `escolas/{id}` | admin ou quem tem cadastro no mesmo `municipio_id` | admin | `nome`, `inep`, `municipio_id`, `municipio_nome`, `municipio_uf`, `status` (ativa/inativa) |
| `turmas/{id}` | admin, vinculado das escolas da turma, gestor/secretaria escolar/portaria da escola | cria: admin ou vinculado da escola (`criado_por` = ele, mesmo município); edita: admin ou o criador; apaga: admin | `nome`, `escola_id`, `municipio_id`, `turno`, `ano_letivo`, `status`, `criado_por` |
| `usuarios/{uid}` | o próprio, admin; gestor lê equipe de apoio da escola dele | cria: o próprio, em 7 caminhos (ver 2.3); edita: admin, o próprio (só campos pessoais e vínculo de escolas), gestor (só `status` ativo/inativo da equipe de apoio); apaga: admin | `perfil`, `status`, `email`, `nome`, `licenca_tipo`, `licenca_fim`, `municipio_id`, `escola_id`, `escolas_ids[]` (1 a 5), `escolas_nomes[]`, `turmas_ids[]`, `turma_nome` (aluno), `ultimo_acesso`, `origem`, `demo` |
| `pre_cadastros/{email}` | admin, o dono do e-mail (verificado), gestor (convites da equipe de apoio da escola dele e checagem de e-mail livre) | admin; gestor cria/edita/apaga convites de `portaria` e `secretaria_escolar` só para a própria escola | chave = e-mail minúsculo; `perfil`, `status`, `licenca_tipo`, `municipio_id`, `escola_id`, `escolas_ids`, `turmas_ids`, `turma_nome`, `importado_em`, `convidado_por` |
| `dominios_aluno/{dominio}` | `get`: admin ou quem tem e-mail do próprio domínio; `list`: admin | admin | `municipio_id`, `municipio_nome`, `ativo`. Sincronizado pela tela Plano do município |
| `acessos_dia/{dia_uid}` | admin | o próprio usuário (ID tem de ser `{dia}_{uid}`) | 1 doc por pessoa por dia: `uid`, `dia`, `municipio` (nome), `perfil`, `modulos[]`. Alimenta Painel do admin e Painel da Rede |
| `config/{id}` | licenciado ou aluno | admin | `config/modulos` (situação global de cada botão: liberado/em breve, url, imagem), `config/acervo` (endereço do Worker), `config/atividades_resumo` (contagens, gravado pela função), `config/avisos_email` (marca do último envio de pré-cadastros, gravada pela função) |

**Subcoleções do usuário (`usuarios/{uid}/...`)**

| Subcoleção | Lê/apaga | Grava | Observação |
|---|---|---|---|
| `trabalhos` | dono, admin | dono licenciado | aulas da Lousa (conteúdo no Storage) |
| `provas` | dono, admin | dono licenciado | fichas do Gerador de Provas (conteúdo no Storage) |
| `pastas_provas` | dono, admin | dono licenciado | pastas do Gerador |
| `folhas` | dono, admin | dono licenciado, gestor ou secretaria | Folha Mágica: só `nome` (até 60), `tipo`, `cfg` (mapa) |
| `turma_lousa` | dono, admin | dono licenciado, gestor ou secretaria | Turma na Lousa: até 80 nomes, 120 sorteados |
| `roteiros` | dono, admin | dono licenciado, gestor ou secretaria | Teleprompter: texto até 200 mil caracteres, até 100 marcadores |
| `lembretes` | **só o dono** (nem o admin) | dono ativo que não é aluno | Minha agenda: `tipo` escola/pessoal, `data`, `hora`, `repetir` nao/semanal/mensal, `avisar` nao/resumo/hora, `antes_min` 0/15/60/1440, `tz_min`, `proxima`, `proximo_aviso` |

**Pedagógico e gestão escolar**

| Coleção | Quem lê | Quem escreve | Campos-chave |
|---|---|---|---|
| `relatorios/{id}` | admin, autor, gestor da escola, secretaria do município | autor ativo (licenciado, gestor ou secretaria) cria em rascunho/enviado e edita até ser aprovado; gestor só aprova/devolve; apaga: admin ou autor se não aprovado | `autor_uid`, `escola_id`, `municipio_id`, `status` (rascunho/enviado/devolvido/aprovado), `revisado_por`, `comentario` |
| `notas_regras/{municipio}` | admin, não-aluno ativo do município | admin ou secretaria do município | `periodos` (2/3/4), `pesos`, `media_minima`, `nota_max` (10/100), `arredondamento`, `composicao`, `rec_periodo`, `rec_final`, `freq_minima` |
| `notas_planilhas/{uid_...}` | dono, admin, gestor da escola, secretaria do município | dono (licenciado, gestor ou secretaria); ID começa pelo uid | uma por turma/disciplina/ano: `avaliacoes` (até 80), `notas` (até 120 alunos), `faltas`, `exame`, `conselho` |
| `cal_rede/{municipio_ano}` | admin, não-aluno do município | admin ou secretaria do município | `inicio`, `fim`, `dias_semana`, `horas_dia`, `meta_dias`, `meta_horas`, `periodos`, `facultativos_letivos`, `eventos` (até 200), `token` (20 caracteres, chave do link .ics) |
| `cal_escola/{escola_ano}` | admin, não-aluno do município ou das escolas dele | admin, secretaria do município, gestor da escola | ajustes da escola: `horas_dia`, `eventos` |
| `freq_chamadas/{uid_turma_dia_disc}` | admin, professor dono, gestor e secretaria escolar da escola | professor vinculado, só para turma da escola dele | `aulas` (1 a 6), `lista`, `nomes`, `faltas`, `just`, `conteudo` (até 600) |
| `freq_resumo/{turma_ano}` | admin, gestor/secretaria escolar, professores das escolas | **ninguém** (só a função `freqResumo`) | `dias` (JSON por dia), `alunos` (totais, risco, dias seguidos), `alerta`, `freq_min` |
| `freq_entradas/{turma_dia}` | admin, gestor, secretaria escolar, portaria da escola | admin, gestor, secretaria escolar, portaria (o totem grava via função `portaria`) | `entradas` {aluno: "HH:MM"}, `nomes`, `fotos` (não pode ser alterado pelo cliente) |
| `portaria_vistas/{id}` | admin, gestor da escola | admin, gestor (só cria; nunca edita nem apaga) | auditoria de quem abriu cada foto da entrada |
| `alunos/{id}` | admin, vinculado das escolas, gestor/secretaria escolar/portaria | cria: admin ou professor vinculado em turma que ele criou; edita: admin ou criador; apaga: admin | cadastro de aluno da turma (frequência, carteirinha, portaria): `nome`, `matricula`, `turma_id`, `turma_nome`, `escola_id`, `status`. **Não é a conta de login do aluno** |
| `alunos_familia/{aluno_id}` | admin, gestor e secretaria escolar da escola | idem | contatos dos responsáveis (até 4), `aceita_avisos`, `obs`. Professor não lê (LGPD) |
| `busca_ativa/{escola_aluno_ano}` | admin, gestor e secretaria escolar | idem; apaga: admin | `status` aberto/contato/encaminhado/resolvido, `registros` (até 200) |
| `avisos_config/{escola}` | admin, gestor e secretaria escolar | admin ou gestor | liga/desliga `falta_dia`, `seguidos`, `fora_sala`, `chegada` |
| `avisos_familia/{tipo_aluno_dia}` | admin, gestor e secretaria escolar da escola | ninguém (só funções) | registro de cada aviso enviado/recusado |
| `avisos_contador/{dia}` | admin | ninguém (só funções) | contador diário de e-mails às famílias |
| `comunicados_familia/{id}` | admin, equipe da escola | gestor ou secretaria escolar cria com `status:"pendente"`; ninguém edita | o envio é feito pela função `comunicadoFamilias` |
| `maestro_aulas/{id}` | admin, professor dono | professor vinculado cria; admin edita/apaga | histórico do Portal Maestro |

**Recursos da escola (patrimônio e chamados)**

| Coleção | Quem lê | Quem escreve | Campos-chave |
|---|---|---|---|
| `rec_config/{escola}` | não-aluno da escola ou secretaria do município | admin ou gestor | `turnos`, `chave_pub` (chave do cartaz) |
| `rec_itens/{id}` (+`mov/{mid}`) | não-aluno da escola / secretaria do município | gestor cria na escola dele (sem contrato); transferir de escola e ligar contrato: só admin; estoque do município (escola vazia): só admin. `mov`: só acrescenta | `nome`, `tipo`, `patrimonio`, `serie`, `origem` (newpc/prefeitura/doacao/outro), `contrato_id`, `situacao` (em_uso/manutencao/estoque/baixado), `reservavel`, `qr` |
| `rec_contratos/{id}` | admin, não-aluno do município | admin | locação/comodato/manutenção, `numero`, `sla_atendimento_h`, `sla_solucao_h` |
| `rec_busca/{patrimonio}` | público (`get`) | admin ou gestor que cuida do QR | busca pública por patrimônio/série, aponta para a etiqueta |
| `rec_pub/{chave}` | público (`get`) | admin ou gestor (a chave tem de ser a `chave_pub` da escola) | cartaz da escola: lista de até 1.500 equipamentos para abrir chamado |
| `rec_qr/{chave}` | público (`get`); `list` para leitores da escola | admin/gestor; sem login só "abrir chamado" e "confirmar chamado" | etiqueta QR do equipamento: `item_id`, `chamado_aberto`, `chamado_conf` |
| `rec_chamados/{id}` | leitores da escola/município | cria **sem login**, só pela etiqueta e só se não houver chamado aberto; atualiza: admin ou gestor | `problema`, `descricao`, `nome`, `funcao`, `contato`, `status` aberto/em_atendimento/resolvido, `resposta` |
| `rec_reservas/{item_data_turno_aula}` | o dono, leitores da escola | professor licenciado da escola, gestor, admin; o ID impede reserva dupla | `data`, `turno` (M/V/N/I), `aula` (1 a 12), `turma`, `atividade` |

**Portal do Educador TV e Teleprompter**

| Coleção | Quem lê | Quem escreve | Observação |
|---|---|---|---|
| `tv_pareamentos/{codigo6}` | `get`/apaga: ativo não-aluno | cria **sem login** (a TV), só `chave`, `criado_em`, `orientacao`, `resolucao` | código de 6 letras sem ambíguos mostrado na TV |
| `tv_telas/{chave20}` | `get`: público; `list`: equipe da escola/secretaria | equipe da escola (professor licenciado, gestor, secretaria do município, admin); a TV sem login só atualiza `visto_em`, `resolucao`, `aparelho` (batimento) | `modo` (tv/portaria), `foto_entrada`, `playlist_id`, `canal` |
| `tv_playlists/{id}` | `get`: público; `list`: equipe | equipe da escola | até 80 itens |
| `tv_canais/{id}` | `get`: público; `list`: não-aluno do município | cria: não-aluno do município (avisos vazio); edita: secretaria do município ou admin | comunicados da secretaria, até 30 avisos |
| `tv_campanhas/{id}` | `get`: público | admin | campanhas educativas (dengue, trânsito, Outubro Rosa), doc `tv_campanhas/padrao` |
| `tele_sessoes/{chave24}` (+`cmd/{id}`) | `get`: qualquer um com a chave | dono logado (licenciado, gestor, secretaria) cria e edita; o celular sem login só cria comandos da lista permitida em sessão ativa | controle remoto do Teleprompter por QR |

**Conteúdo e catálogo**

| Coleção | Quem lê | Quem escreve |
|---|---|---|
| `acervo/{id}` | admin; licenciado se `publicado`; aluno só módulos `datas`/`historias` liberados | admin |
| `atividades/{id}` | admin; licenciado se `publicado` | admin (e funções) |
| `atividades_ignoradas/{id}` | admin | admin (arquivos do Drive excluídos que a sincronização não traz de novo) |
| `atividades_reacoes/{atividade_uid}` | admin, o próprio | licenciado, 1 voto por atividade publicada |
| `biblioteca/{id}` | admin; não-aluno se publicado; aluno: seções `aprender`/`gibiteca` (módulo biblioteca) e `historias` (módulo historias) | admin |
| `biblioteca_triagem/{id}` | admin | admin |
| `biblioteca_reacoes/{livro_uid}` | admin, o próprio | quem pode ler o título |
| `colorir/{id}` | admin; não-aluno se publicado; aluno com módulo colorir | admin |
| `videos/{id}` | admin; licenciado se publicado; aluno com módulo videos e `para_alunos` | admin |
| `videos_reacoes/{video_uid}` | admin, o próprio | quem pode ver o vídeo |
| `jogos/{id}` | admin; licenciado se publicado; aluno com módulo jogos e `para_alunos` | admin |
| `ia_apps/{id}` | admin; licenciado se publicado | admin (Dicas de IA, apps do IA Studio) |
| `datas_comemorativas/{id}` | admin; logado se publicado | admin |
| `noticias/{id}` | admin; logado se publicado | admin (mural; `tipo:"pesquisa"` vira pesquisa rápida) |
| `noticias_reacoes/{noticia_uid}` | admin, o próprio | logado, notícia publicada |
| `pesquisa_respostas/{noticia_uid}` | admin, o próprio | logado, 1 resposta, sem trocar; anônima não leva nome nem escola |
| `dicas_envios/{id}` | admin, autor, não-aluno se publicado | não-aluno cria com `status:"novo"` (até 5 links e 5 arquivos); admin revisa |
| `dicas_alunos/{id}` | admin, autor | aluno com módulo `dicasaluno` (texto e até 2 links) |
| `dicas_alunos_pub/{id}` | ativo | admin (cópia pública só com primeiro nome e escola) |

**Avaliação**

| Coleção | Quem lê | Quem escreve | Observação |
|---|---|---|---|
| `provas_online/{id}` | admin, professor dono, alunos listados em `alunos_uids` | **ninguém** (só funções) | questões sem gabarito, janela `abre_em`/`fecha_em`, `duracao_min`, `avisos_max`, `status` agendada/encerrada/cancelada, `nota_liberada` |
| `provas_online/{id}/po_tentativas/{uid}` | admin, o aluno, o professor dono | aluno só atualiza a própria tentativa em andamento, até 2 min após o prazo, e só `respostas`, `desvios` (só sobe), `eventos`, `status` (pode ir a "bloqueada" quando passa de `avisos_max`), `sessao`/`disp`/`aparelho`/`trocas` (um aparelho por vez, `trocas` sobe de 1 em 1) | criação e entrega: funções |
| `provas_online/{id}/po_resultados/{uid}` | admin, professor dono; o aluno só depois de `fecha_em` ou se `nota_liberada` | ninguém (funções) | nota e correção |
| `provas_online_gab/{id}` | admin, professor dono | ninguém (funções) | gabarito separado |
| `avaliacoes/{id}` (legado) | **qualquer pessoa, sem login** | professor vinculado cria; dono ou admin edita/apaga | prova por código de acesso (`aluno.html`), `codigo_acesso`, `questoes` com alternativa correta marcada |
| `respostas/{id}` (legado) | admin, dono da prova, gestor da escola, secretaria do município | **cria qualquer pessoa sem login**; dono ou admin edita/apaga | respostas do aluno sem login. Usada pelo Painel da Rede para acerto por habilidade BNCC |

**Formação Continuada (ex-Academia do Educador)**

Papéis editoriais vêm de custom claim `papel` (admin | editor) no token; o admin do Portal também tem os poderes (`fAdmin()`/`fEditor()` incluem `admin()`).

| Coleção | Quem lê | Quem escreve |
|---|---|---|
| `equipe/{uid}` | editor | ninguém pelo cliente (função `definirPapel` / script) |
| `auditoria/{id}` | fAdmin | ninguém (funções) |
| `cursos/{cid}` | todos se publicado; editor | editor cria em rascunho e edita enquanto não publicado; publicar/congelar só pela função `publicarCurso`; ninguém apaga pelo cliente |
| `cursos/{cid}/modulos`, `aulas` | publicado ou editor | editor enquanto editável |
| `cursos/{cid}/questoes` | editor | editor enquanto editável |
| `cursos/{cid}/gabarito` | ninguém | editor enquanto editável |
| `trilhas/{id}` | publicado ou editor | editor (publicar só fAdmin) |
| `users/{uid}` | o dono | o dono, só campos de perfil (`nome`, `email` igual ao do token, `cpf`, `municipio`, `escola`, `cargo`...) |
| `users/{uid}/progresso`, `tentativas` | o dono | ninguém (funções) |
| `users/{uid}/anotacoes` | o dono | o dono (até 12 mil caracteres) |
| `users/{uid}/provas`, `sessoes`, `emissoes` | ninguém | ninguém (funções) |
| `certificados/{codigo}` | fAdmin e o titular | ninguém (funções); consulta pública só pela função `consultarCertificado` |
| `cpfs/{cpf}` | ninguém | ninguém (funções: um CPF por conta) |

**Backup**

| Coleção | Quem lê | Quem escreve |
|---|---|---|
| `backup_config/{id}` (`atual`) | admin | ninguém (funções) |
| `backups_log/{id}` | admin | ninguém (funções) |

### 2.2 Funções auxiliares das regras (`firestore.rules`)

Identidade:
- `logado()`: tem `request.auth`.
- `temCadastro()`: logado e existe `usuarios/{uid}`.
- `eu()`: dados de `usuarios/{uid}` (cada chamada é uma leitura cobrada nas regras).
- `admin()`: tem cadastro, `perfil == "admin"` e `status == "ativo"`.
- `ativo()`: tem cadastro e `status == "ativo"`.
- `naoAluno()`: ativo e perfil diferente de aluno.
- `novo()`: atalho para `request.resource.data`.

Licença:
- `tipoLic()`: `licenca_tipo`, padrão `"institucional"`.
- `meuMuni()`: documento do município do usuário.
- `contratoOk()`: município sem `vigencia_fim_ts` (sem vencimento) ou com `vigencia_fim_ts` no futuro. **Atenção: o campo `status` do município não entra nessa conta.**
- `vinculado()`: ativo e (admin, ou professor institucional com `escola_id` e contrato ok). É o "professor da rede atendida". `professor()` é sinônimo.
- `licenciado()`: `vinculado()` ou professor ativo com licença não institucional (avulsa, teste, cortesia) e `licenca_fim` no futuro.
- `minhasEscolas()`: `escolas_ids`, ou `[escola_id]` para cadastros antigos.

Pré-cadastro (importação):
- `meuEmail()`: e-mail do token em minúsculas.
- `emailVerificado()`: token com e-mail e `email_verified == true` (conta Google).
- `temPreCadastro()`: e-mail verificado e existe `pre_cadastros/{meuEmail}`.
- `pre()`: dados do pré-cadastro.

Aluno e domínio de aluno:
- `temEmail()`: token com e-mail válido (mesmo sem verificação).
- `meuDominio()`: parte depois do `@`.
- `dominioDeAluno()`: existe `dominios_aluno/{meuDominio}`. Usado também para **bloquear** autocadastro de professor com e-mail de domínio de aluno.
- `domAluno()`: dados do domínio.
- `camposAluno()`: lista fechada de campos que o cadastro de aluno pode ter (uid, nome, email, perfil, status, licenca_tipo, municipio_id/nome, escola_id/nome, turma_nome, origem, criado_*, atualizado_*).
- `aluno()`: ativo, perfil aluno, com `municipio_id` e contrato ok.
- `alunoPode(m)`: aluno e (lista `modulos_aluno` vazia = todos os de aluno, ou `m` está na lista).

Escolas do professor:
- `escolaDoMeuMuni(lista,i)` e `escolasValidas()`: o professor institucional escolhe de 1 a 5 escolas, todas do próprio município; `escola_id` tem de ser a primeira da lista e `vinculo_alterado_por` tem de ser ele.
- `semVinculoDeRede()`: cadastro sem escola, sem município, sem turmas.

Equipe da escola:
- `gestorDaEscola(esc)`, `secEscolar(esc)` (perfil `secretaria_escolar`), `portariaDaEscola(esc)`.
- `equipeEscola(esc)` = gestor ou secretaria escolar; `entradaEscola(esc)` = equipe ou portaria.
- `perfilApoio(p)`: `portaria` ou `secretaria_escolar` (convidados pelo gestor).
- `secretariaDoMuni(m)`: perfil `secretaria` (Secretaria Municipal de Educação) ativo do município.

TV, recursos e utilitários:
- `muniDaEscola(esc)`, `tvEquipeEscola(esc)`, `tvLeitor(esc,m)`, `recGestor(esc)`, `recLeitor(esc,m)`, `recReserva(esc)`, `camposItem()`, `lugarValido()`, `camposBusca()`, `cuidaDoQr(k)`, `abrirChamadoQr(chave)`, `confirmarChamadoQr()`, `acoesTele()`.
- `texto(v,n)`: é texto com até n caracteres. `dataOk(v)`: texto `AAAA-MM-DD` entre 2020 e 2099. `calEventosOk()`: até 200 eventos.
- `turmaDoc(t)`, `alunoDoc(a)`, `provaOnline(id)`, `prova(av)`, `donoDaProva(av)`, `pesquisa(nid)`, `pesquisaAberta(p)`, `podeLerLivro(l)`.
- Formação: `fPapel()`, `fDono(uid)`, `fAdmin()`, `fEditor()`, `fCurso(cid)`, `fPublicado(cid)`, `fEditavel(d)`, `fEditarConteudo(cid)`.

### 2.3 Os 7 caminhos de criação de `usuarios/{uid}`

O próprio usuário cria o seu documento no primeiro acesso, e só passa se cair em um destes casos:
1. **Autocadastro (teste grátis)**: professor, ativo, `licenca_tipo:"teste"`, `licenca_fim` em até 8 dias (o front dá 7), sem vínculo de rede, e e-mail que **não** seja de domínio de aluno.
2. **Legado**: professor `pendente`, sem vínculo, fora de domínio de aluno.
3. **Professor importado**: tem pré-cadastro de professor ativo; nasce ativo, institucional, com exatamente o município, escola, escolas e turmas do pré-cadastro.
4. **Aluno pelo domínio**: e-mail verificado de domínio em `dominios_aluno` ativo; nasce aluno ativo, só com o município do domínio, **sem escola** (`escola_id` nulo), campos restritos.
5. **Aluno importado**: pré-cadastro de aluno; nasce com município e escola do pré-cadastro.
6. **Equipe de apoio convidada pelo gestor** (portaria, secretaria escolar): exatamente o vínculo do convite, sem turmas.
7. **Gestor e Secretaria de Educação importados pelo admin**: exatamente o vínculo do pré-cadastro, sem turmas.

Perfis existentes (rótulos do front): admin (Administrador), secretaria (Secretaria de Educação), gestor (Gestor da escola), professor, aluno, secretaria_escolar (Secretaria escolar), portaria.

### 2.4 Índices (`firestore.indexes.json`)

Compostos:

| Coleção | Escopo | Campos | Usado por |
|---|---|---|---|
| `cursos` | coleção | status ↑, ordem ↑ | catálogo da Formação |
| `trilhas` | coleção | status ↑, ordem ↑ | trilhas da Formação |
| `certificados` | coleção | uid ↑, cursoId ↑ | `emitirCertificado` |
| `certificados` | coleção | uid ↑, emitidoEmISO ↓ | lista de certificados do professor |
| `provas` | coleção | cursoId ↑, respondida ↑, criadaEm ↓ | `sortearProva` (users/{uid}/provas) |
| `usuarios` | coleção | perfil ↑, criado_em ↑ | resumo diário (alunos novos) e listas do admin |
| `acessos_dia` | coleção | municipio ↑, dia ↑ | Painel da Rede (últimos 30 dias) |
| `po_tentativas` | grupo de coleções | status ↑, prazo ↑ | `fecharProvasOnline` |
| `provas_online` | coleção | status ↑, fecha_em ↑ | `fecharProvasOnline` |

Ajustes de campo (fieldOverrides):
- `lembretes.proxima` e `lembretes.proximo_aviso`: índices asc/desc na coleção e asc no grupo de coleções (necessários para `emailAgendaDia` e `emailLembretes`, que usam `collectionGroup('lembretes')`).
- Índices **desligados** (para não pagar índice de mapas grandes): `freq_resumo.dias`, `freq_resumo.alunos`, `freq_chamadas.nomes|faltas|just|lista|conteudo`, `busca_ativa.registros`, `freq_entradas.entradas|nomes`.

---

## 3. Storage

### 3.1 Bucket principal (`storage.rules`)

Licença no Storage (`licenciado()` própria do arquivo): ativo e (admin, ou institucional com `escola_id`, ou não institucional com `licenca_fim` no futuro). **Não confere o contrato do município** (diferente do Firestore).

`arquivoValido()`: menor que 20 MB e tipo PDF, imagem, áudio, Word, Excel ou PowerPoint (doc/xls/ppt e os formatos OpenXML).

| Caminho | Leitura | Gravação | Limite | Tipos |
|---|---|---|---|---|
| `professores/{uid}/lousa/{arquivo}` | dono licenciado, admin | dono licenciado | 50 MB | `application/gzip` ou `application/json` |
| `professores/{uid}/provas/{arquivo}` | dono licenciado, admin | dono licenciado | 50 MB | gzip ou json |
| `professores/{uid}/{qualquer}` | dono licenciado, admin | dono licenciado | 20 MB | `arquivoValido()` |
| `tv/escolas/{esc}/{arquivo}` | qualquer logado | equipe TV da escola (licenciado da escola, gestor, secretaria do município, admin) | 50 MB | jpeg, png, webp, gif, mp4, webm |
| `tv/campanhas/{arquivo}` | qualquer logado | admin | 10 MB | jpeg, png, webp |
| `tv/municipios/{m}/{arquivo}` | qualquer logado | admin ou secretaria do município | 10 MB | jpeg, png, webp |
| `capas/{tipo}/{arquivo}` | qualquer logado | admin | 3 MB | imagem |
| `biblioteca/**` (geral) | qualquer logado | ninguém (só servidor) | | |
| `biblioteca/historias/{arquivo}` | logado | admin; nome `slug.pdf` ou `slug-capa.jpg` | 100 MB | pdf, jpeg |
| `biblioteca/{secao}/{arquivo}` (livros, audiolivros, aprender, gibiteca) | logado | admin; nome `slug` + `.pdf`, `.cbz`, `.mp3`, `.m4a` ou `-capa.jpg` | 300 MB | pdf, zip, mpeg, mp4 (áudio), jpeg |
| `atividades/{etapa}/{arquivo}` (infantil, alfa, iniciais, finais, medio, inclusiva) | logado | admin (e a sincronização pelo servidor) | 60 MB | pdf, png, jpeg |
| `colorir/**` | logado | admin | 5 MB | imagem |
| `dicas/{uid}/{envio}/{arquivo}` | dono, admin, ou ativo se a dica estiver publicada | dono ativo; nunca atualiza; admin apaga | 10 MB | `arquivoValido()` |
| `materiais/{cursoId}/{arquivo}` | **público** | editor da Formação, só criação (versões antigas preservadas) | 40 MB | imagens, pdf, doc/ppt/xls (e OpenXML), txt |
| `capas/{arquivo}` (raiz, Formação) | **público** | editor, só criação | 3 MB | jpeg, png, webp, gif |
| qualquer outro caminho | negado | negado | | |

Caminhos gravados só pelo servidor (Admin SDK ignora as regras), com link de download por token:
- `provas_online/{provaId}/img-*.{png,jpg,webp,gif}` (imagens da Prova online, até 3 MB cada; leitura pelo link com token).
- `atividades/{etapa}/{driveId}.pdf` e `-mini.jpg` (sincronização de Atividades).
- `biblioteca/{secao}/{id}.*`, páginas de gibi `biblioteca/{secao}/{id}/pNNN.jpg`, capas.
- `colorir/{colecao}/{arquivo}.webp` e `colorir/{colecao}/miniaturas/...` (script de colorir).

### 3.2 Bucket da portaria (`storage-portaria.rules`, bucket `portal-educador-5-portaria`, São Paulo)

- Caminho único: `portaria/{escola}/{dia}/{arquivo}` (nome `{aluno}_{HHMM}.jpg`).
- Leitura (`get`): admin ou gestor da escola. `list` e escrita: negadas (só o servidor grava, pela função `portaria`).
- Foto: JPEG até cerca de 80 KB (o totem manda 320x240; a função recusa base64 com mais de 110 mil caracteres ou que não comece com assinatura JPEG).
- Guarda: 15 dias (`RETENCAO_FOTOS_DIAS`), apagadas pela função `limparFotosPortaria` e, como segunda garantia, por regra de ciclo de vida do próprio bucket, sem lixeira **(confirmar a regra de ciclo de vida configurada no console)**.
- Cada abertura de foto pelo gestor gera registro em `portaria_vistas` (auditoria).

### 3.3 Bucket de backups (`storage-backups.rules`, bucket `portal-educador-5-backups`, São Paulo)

- `downloads/{arquivo}`: `get` só admin ativo. `list` e escrita negadas.
- Todo o resto negado (as exportações cruas `exports/` e os pacotes `pacotes/` não são lidos pelo app; o download é por link assinado de 30 min gerado pela função).
- Tudo some em 7 dias por regra de ciclo de vida do bucket **(confirmar no console)**.

### 3.4 Cloudflare R2 (`pde-acervo`)

Fora do Firebase. Acesso só pelo Worker (seção 1.5), link de 5 minutos.

---

## 4. Cloud Functions

### 4.1 Configuração geral

- Código em `functions/`, ESM, Node 22. `index.js` chama `setGlobalOptions({ region:'southamerica-east1', maxInstances:10 })`; os módulos repetem a região.
- Gatilhos de Firestore usam `REGIAO_FIRESTORE = 'southamerica-east1'` (indica que o banco está em São Paulo) **(confirmar a localização do banco no console)**.
- Total de exportações: **56 funções**.

Parâmetros e segredos (só nomes):

| Nome | Tipo | Onde | Uso |
|---|---|---|---|
| `SMTP_SENHA` | segredo (`defineSecret`) | Secret Manager | senha de app da conta de envio |
| `SMTP_USUARIO` | parâmetro (`defineString`) | `functions/.env.portal-educador-5` | conta de envio. O padrão no código é um endereço `@portaldoeducador.com.br`, mas o `.env` aponta para uma conta **@gmail.com** |
| `SMTP_HOST` | parâmetro | `.env` | `smtp.gmail.com`, porta 465 SSL |
| `NOTIFICAR_EMAILS` | parâmetro | `.env` | lista de e-mails da equipe NEWPC que recebe os avisos internos (separados por vírgula) |
| `SEGREDO` | variável secreta | Cloudflare (Worker) | assinatura dos links do acervo |
| Chave da API do Google Drive | constante no código (`CHAVE` em `atividades.js`, `biblioteca.js` e scripts) | código-fonte | listar/baixar das pastas antigas da Webnode (ver dívida técnica) |

Permissões da conta de serviço citadas no código: `roles/monitoring.viewer` (Painel de uso); exportar o Firestore e gravar no bucket de backups; gerar URL assinada (`getSignedUrl`); "Gerente de conteúdo" no Drive compartilhado de backup **(confirmar papéis IAM exatos)**.

E-mail (como funciona):
- Transporte único `transporte()` em `dicas.js` (nodemailer, SMTP SSL 465, usuário `SMTP_USUARIO`, senha `SMTP_SENHA`). Todas as funções de e-mail importam daí.
- Remetente: `"Portal do Educador" <SMTP_USUARIO>`; nos avisos às famílias, `"<nome da escola> · Portal do Educador" <SMTP_USUARIO>`.
- Destinatários internos: `NOTIFICAR_EMAILS`. Destinatários externos: gestores (busca ativa, chamados), professores (agenda), famílias (avisos).
- Limite: `avisos.js` conta só os e-mails às famílias em `avisos_contador/{dia}` e para em `LIMITE_DIA = 1500`. O comentário do código supõe conta Google Workspace (cerca de 2.000/dia). Os demais e-mails (resumo, cadastros, pré-cadastros, dicas, chamados, TV, agenda, lembretes, busca ativa) usam a mesma conta e **não** entram nessa conta. Ver dívida técnica 8.3.

### 4.2 Formação Continuada (`index.js`)

Todas são callables. "login" = exige estar logado; "licença" = `exigirLicenca` (mesma lógica do Portal: institucional com escola e contrato vigente e, se o plano tiver lista, com `formacao` em `modulos_professor`; ou licença avulsa/teste no prazo); "claim admin/editor" = custom claim `papel` no token (não é o `perfil` do Portal).

| Função | Quem chama | O que faz |
|---|---|---|
| `iniciarAula` | login + licença | Abre sessão da aula com token rotativo (duas abas não somam tempo), confere ordem dos módulos. |
| `acompanharAula` | login | Recebe batimentos (posição do vídeo), credita tempo assistido (sem saltos, até 2x de velocidade), marca aula concluída quando cumpre o mínimo e 90% dos vídeos. |
| `sortearProva` | login + licença | Sorteia a avaliação final do banco de questões (aulas todas verificadas), embaralha alternativas, prazo de 90 min, limite de tentativas e intervalo de 30 s. |
| `salvarRespostas` | login | Grava rascunho das respostas da prova aberta. |
| `corrigirQuiz` | login | Corrige no servidor, registra tentativa, nota e aprovação. |
| `emitirCertificado` | login + licença | Exige aprovação e nome completo + CPF válido; um CPF por conta (`cpfs/`); código `AE-AAAA-XXXXXX`; grava `certificados/` e auditoria. Reaproveita se já emitido. |
| `consultarCertificado` | público (maxInstances 3) | Consulta por código exato e devolve só a projeção pública (nome, CPF mascarado, curso, carga horária, período, nota). |
| `revogarCertificado` | claim admin | Revoga com motivo (5 a 1.000 caracteres) e auditoria. |
| `obterGabarito` | claim admin ou editor | Devolve o gabarito do curso para o editor. |
| `definirPapel` | claim admin | Define claim `papel` (admin/editor/nenhum) por e-mail e espelha em `equipe/`. |
| `publicarCurso` | claim editor (revisão) ou admin (demais) | Muda situação do curso (rascunho/revisao/publicado/arquivado); ao publicar, valida pendências (carga horária x duração das aulas, banco de questões, tentativas). |
| `duplicarCurso` | claim editor | Cria nova versão em rascunho (até 440 documentos). |
| `excluirCurso` | claim admin | Apaga curso não publicado e sem certificado emitido. |
| `relatorioAdesao` | claim admin | Relatório paginado (100 por vez) de cursos iniciados, concluídos, certificados e horas por professor, com filtro de município. |
| `vincularContaFormacao` | login + licença | No primeiro acesso, cria `users/{uid}` a partir do cadastro do Portal e religa certificados da Academia antiga pelo e-mail verificado. |

### 4.3 Prova online (`provas-online.js`)

| Função | Tipo | Quem | O que faz |
|---|---|---|---|
| `publicarProvaOnline` | callable (120 s, 512 MiB) | professor, gestor ou admin ativo | Publica prova do Gerador para uma turma: confere que a turma é dele (ou da escola do gestor), que o município tem `"prova_online"` em `recursos` (admin dispensado), janela e duração (5 a 300 min), até 100 questões; transforma imagens base64 em arquivos do Storage; monta a lista de alunos; separa questões (`provas_online`) e gabarito (`provas_online_gab`). Limite de 900 KB por documento. |
| `iniciarProvaOnline` | callable | aluno listado | Cria a tentativa dentro da janela, com prazo = menor entre início + duração e fim da janela; embaralha questões e alternativas de forma determinística por aluno. |
| `entregarProvaOnline` | callable | o aluno | Entrega e corrige (recusa se bloqueada). |
| `acaoProvaOnline` | callable | professor dono ou admin | Ações do painel ao vivo: `liberar` (nova chance, com ou sem zerar respostas), `tempo` (+1 a 60 min), `encerrar` (finaliza todas), `liberar_notas`, `cancelar`. |
| `fecharProvasOnline` | agendada, a cada 5 min | sistema | Entrega tentativas com prazo vencido (até 300 por rodada) e encerra provas cuja janela passou (até 50), finalizando as bloqueadas. |

Correção automática: múltipla escolha e V/F; resposta curta confere com a lista de respostas aceitas (sem acento); dissertativa, caixas de seleção e grades ficam pendentes para o professor.

Como os alunos entram na lista: `usuarios` com `perfil=="aluno"`, ativo, mesmo `escola_id` da turma e `turma_nome` igual ao `nome` da turma (comparação sem acento, sem espaço, sem "ano", "º", "ª"). Ver dívida técnica 8.6.

### 4.4 Atividades e Biblioteca

| Função | Tipo | Quem | O que faz |
|---|---|---|---|
| `sincronizarAtividades` | callable (540 s, 1 GiB) | admin (perfil do Portal) | Lê as 6 pastas raiz do Banco Curricular no Drive (infantil, alfa, iniciais, finais, medio, inclusiva), classifica cada PDF/imagem por etapa, componente, ano, BNCC e categoria a partir do caminho e do nome, junta cópias repetidas, copia para `atividades/{etapa}/{id}` com miniatura e grava `atividades/{id}` publicado. Até 60 por chamada (padrão 40); `{resumo:true}` só recalcula `config/atividades_resumo`. Pula IDs já importados e os de `atividades_ignoradas`. |
| `importarBiblioteca` | callable (540 s, 1 GiB) | admin | Importa UM título da `biblioteca_triagem` do Drive para o Storage depois de o admin informar o tipo de licença (dominio-publico, licenca-aberta, licenciada, propria) e a comprovação (mínimo 10 caracteres). Obra marcada como comercial só entra como "licenciada". Grava a licença no próprio livro. |

### 4.5 E-mails internos e avisos (`dicas.js`, `tv.js`, `recursos.js`)

| Função | Tipo | O que faz |
|---|---|---|
| `emailDicaProfessor` | Firestore `onCreate` em `dicas_envios/{id}` | Manda a dica para `NOTIFICAR_EMAILS` com anexos (até 20 MB no total; os maiores ficam só no Portal), reply-to do professor. Marca `email_status`. |
| `emailNovoCadastro` | `onCreate` em `usuarios/{uid}` | Avisa a equipe de novo cadastro (nome, WhatsApp, município, escola, licença). Ignora alunos e usuários `demo`. |
| `emailCertificadoEmitido` | `onCreate` em `certificados/{codigo}` | Avisa a equipe de certificado emitido. |
| `emailRelatorioEnviado` | `onWrite` em `relatorios/{id}` | Avisa quando um relatório passa a "enviado" (sem nomes de alunos nem conteúdo, por LGPD). |
| `emailPreCadastros` | agendada, a cada 15 min | Junta os pré-cadastros importados no período em UM e-mail (professores/equipe com lista e CSV anexo; alunos só com contagem por escola). Marca o ponto em `config/avisos_email`. |
| `emailResumoDiario` | agendada, 07:00 todo dia | Resumo das últimas 24 h: professores e alunos que usaram, cadastros, pré-cadastros, relatórios, dicas pendentes, certificados. |
| `emailDicaAluno` | `onCreate` em `dicas_alunos/{id}` | Avisa a equipe; mais de 3 envios do mesmo aluno em 24 h não geram e-mail (`email_status:"limitado"`). |
| `emailTvConectada` | `onCreate` em `tv_telas/{chave}` | Avisa a equipe de TV nova conectada. |
| `emailComunicadoTv` | `onUpdate` em `tv_canais/{id}` | Avisa a equipe de cada comunicado novo da secretaria nas TVs (até 5 por alteração). |
| `emailChamadoTecnico` | `onCreate` em `rec_chamados/{id}` | Manda o chamado para a equipe NEWPC e para os gestores ativos da escola (até 10), com protocolo (6 últimos caracteres do ID), prazo de SLA do contrato ligado ao equipamento e link de WhatsApp. |

### 4.6 Frequência, busca ativa e portaria (`frequencia.js`, `frequencia-nucleo.js`, `portaria.js`)

| Função | Tipo | Quem | O que faz |
|---|---|---|---|
| `freqResumo` | Firestore `onWrite` em `freq_chamadas/{id}` | sistema | A cada chamada gravada, refaz o dia da turma e os totais de cada aluno em `freq_resumo/{turma}_{ano}` (frequência, faltas justificadas, dias seguidos, risco). Frequência mínima vem de `notas_regras/{municipio}.freq_minima` (padrão 75%). Idempotente. |
| `emailBuscaAtiva` | agendada, segunda 06:40 | sistema | Para cada gestor ativo, e-mail com alunos abaixo da frequência mínima (com pelo menos 10 aulas) ou com 3 dias seguidos de falta sem justificativa (até 60 por escola). |
| `portaria` | HTTP pública (POST, CORS, 30 s, 256 MiB, maxInstances 10) | totem (TV em modo Portaria), sem login, identificado pela chave da tela | `acao:"lista"`: primeiro nome e turma dos alunos da escola + quem já entrou hoje. `acao:"entrar"`: grava até 200 entradas por vez (dia de hoje até 3 dias atrás), só de alunos da escola da tela; a primeira hora do dia fica; foto opcional (se a tela tem `foto_entrada`) vai para o bucket da portaria. URL: `https://southamerica-east1-portal-educador-5.cloudfunctions.net/portaria`. |
| `limparFotosPortaria` | agendada, 03:17 todo dia | sistema | Apaga fotos da entrada com mais de 15 dias. |

Núcleo `frequencia-nucleo.js` (contas puras, copiado em `assets/js/`): `MIN_AULAS_RISCO = 10`, `DIAS_SEGUIDOS = 3`, funções `dia`, `aplicarDia`, `totais`, `emRisco`, `agregar`, `conciliar` (cruza entrada da carteirinha com a chamada: ok, saiu, parcial, sem_entrada, ausente, so_entrada, sem_dados).

### 4.7 Avisos às famílias (`avisos.js`)

| Função | Tipo | O que faz |
|---|---|---|
| `avisosFamiliaManha` | agendada, 12:40 de segunda a sábado | Fim de turno do matutino: falta no dia (sem justificativa), 3º dia seguido, "entrou mas está com falta". |
| `avisosFamiliaTarde` | agendada, 18:10 seg a sáb | Matutino, vespertino, integral e turmas sem turno. |
| `avisosFamiliaNoite` | agendada, 22:40 seg a sáb | Todos, incluindo noturno. |
| `avisoChegada` | Firestore `onWrite` em `freq_entradas/{id}` | "Chegou à escola às HH:MM" na hora da leitura da carteirinha (só entradas novas do dia). |
| `comunicadoFamilias` | Firestore `onCreate` em `comunicados_familia/{id}` | Envia o comunicado do gestor às famílias das turmas escolhidas (`*` = todas); irmãos com o mesmo e-mail recebem uma vez. Grava totais. |

Regras comuns: cada escola liga os tipos em `avisos_config/{escola}` (começa tudo desligado); só manda se a família tem e-mail e `aceita_avisos != false`; ID `{tipo}_{aluno}_{dia}` em `avisos_familia` evita repetição mesmo se a função rodar duas vezes; contador diário com teto de 1.500.

### 4.8 Calendário e agenda (`calendario.js`, `calendario-nucleo.js`, `agenda.js`)

| Função | Tipo | Quem | O que faz |
|---|---|---|---|
| `calendarioIcs` | HTTP pública (GET, 256 MiB, maxInstances 5) | qualquer um com o link | Gera arquivo iCalendar (.ics) do calendário da rede (e da escola, se `e=`) para assinatura no Google Agenda, Outlook, iPhone. Parâmetros `m` (município), `e` (escola, opcional), `t` (token de 20 caracteres de `cal_rede.token`; trocar o token desliga links antigos). Até os 3 anos mais recentes. Cache 30 min. |
| `emailAgendaDia` | agendada, 06:30 todo dia | sistema | Avança lembretes atrasados e manda UM e-mail por pessoa com os lembretes do dia. |
| `emailLembretes` | agendada, a cada 15 min | sistema | Avisa no horário (com antecedência de 0, 15, 60 min ou 1 dia) os lembretes marcados "na hora". |

Núcleo `calendario-nucleo.js` (copiado em `assets/js/` e no bloco `NUCLEO-INICIO/FIM` de `apps/calendario/index.html`): feriados nacionais (Páscoa por Meeus), estadual de MS (11/10), efeito de cada tipo de data na contagem, resumo de dias e horas letivas, divisão em períodos, geração .ics, recorrência de lembretes.

### 4.9 Painéis (`painel.js`, `painel-secretaria.js`)

| Função | Tipo | Quem | O que faz |
|---|---|---|---|
| `painelUso` | callable (60 s) | admin (perfil do Portal) | Métricas oficiais do Cloud Monitoring dos últimos 30 dias: leituras/gravações/exclusões do Firestore, tamanho do banco, bytes e objetos por bucket, saída do Storage, chamadas e erros 5xx por função. Cache de 5 min. |
| `painelSecretaria` | callable (120 s, 512 MiB) | secretaria do município (se `modulos_secretaria` contém `"painel"`), gestor (só as escolas dele, com a média da rede ao lado), admin (qualquer município, e pode simular gestor) | Painel da Rede só com números agregados: uso (professores ativos em 30/7 dias, online agora, módulos mais usados), aprendizagem (acerto por habilidade BNCC das `avaliacoes`/`respostas` do ano), calendário (dias e horas letivas x meta 200/800), infraestrutura (chamados abertos, atrasados 48 h, tempo médio, equipamentos, TVs online), frequência e busca ativa, relatórios. Cache de 20 min por município. |

### 4.10 Backup (`backup.js`)

| Função | Tipo | Quem | O que faz |
|---|---|---|---|
| `backupInfo` | callable | admin | Mostra o e-mail da conta de serviço (para adicionar ao Drive), a pasta configurada e o tamanho atual do Storage. |
| `backupConfigurar` | callable | admin | Recebe o link da pasta; testa gravando e apagando um arquivo; exige pasta em Drive compartilhado (conta de serviço não tem "Meu Drive"). Salva em `backup_config/atual`. |
| `backupAgora` | callable (1.800 s, 2 GiB, 2 CPU) | admin | Exportação oficial do Firestore para o bucket de backups, empacota em `.tar.gz` (opcional: todos os arquivos do Storage principal, "completo"), envia ao Drive ou deixa para baixar no computador (link de 30 min). Registra em `backups_log`. |
| `backupLink` | callable | admin | Gera novo link de 30 min para pacote ainda guardado (até 7 dias). |
| `backupSemanal` | agendada, domingo 03:23 | sistema | Backup automático só do banco para o Drive, se houver pasta e `automatico` não estiver desligado. |

Restauração (do LEIA-ME que vai no pacote): descompactar, subir `banco/` para um bucket e rodar `gcloud firestore import gs://BUCKET/CAMINHO/banco --project=PROJETO_DE_DESTINO`, primeiro num projeto de teste; arquivos com `gcloud storage cp -r arquivos/* gs://BUCKET_DE_DESTINO/`. O pacote não tem senhas nem fotos da portaria, mas tem dados pessoais (LGPD).

### 4.11 Contadores de reação (`videos.js`)

Todas são gatilhos `onWrite` (maxInstances 10) que mantêm a contagem agregada no documento-pai, para ninguém precisar ler o voto dos outros:

| Função | Gatilho | Atualiza |
|---|---|---|
| `contarReacaoVideo` | `videos_reacoes/{id}` | `videos/{id}.reacoes.<amei|gostei|meh|nao>` |
| `contarReacaoLivro` | `biblioteca_reacoes/{id}` | `biblioteca/{id}.reacoes` |
| `contarReacaoNoticia` | `noticias_reacoes/{id}` | `noticias/{id}.reacoes` |
| `contarRespostaPesquisa` | `pesquisa_respostas/{id}` | `noticias/{id}.votos.<0..4>` |
| `contarReacaoAtividade` | `atividades_reacoes/{id}` | `atividades/{id}.reacoes` |

### 4.12 `domain.js`

Funções puras (sem banco) usadas pela Formação e pelos testes: `idValido` (1 a 128 caracteres `[A-Za-z0-9_-]`), `minimoAula` (40% da duração, entre 60 s e 2 h), `unirTrechos`/`segundosTrechos`/`videoAtualizado` (tempo assistido sem saltos), `projecaoPublica` (lista positiva de campos do certificado), `pendenciasPublicacao` (checklist para publicar curso).

### 4.13 Agenda completa das funções agendadas

| Horário (MS) | Função |
|---|---|
| a cada 5 min | `fecharProvasOnline` |
| a cada 15 min | `emailPreCadastros`, `emailLembretes` |
| 03:17 diário | `limparFotosPortaria` |
| 03:23 domingo | `backupSemanal` |
| 06:30 diário | `emailAgendaDia` |
| 06:40 segunda | `emailBuscaAtiva` |
| 07:00 diário | `emailResumoDiario` |
| 12:40 seg a sáb | `avisosFamiliaManha` |
| 18:10 seg a sáb | `avisosFamiliaTarde` |
| 22:40 seg a sáb | `avisosFamiliaNoite` |

---

## 5. Scripts (`scripts/`)

Padrão: rodam no **Google Cloud Shell** com credencial padrão (`applicationDefault()`, a conta logada no `gcloud`), no projeto `portal-educador-5`. Vários reaproveitam o `firebase-admin` da pasta `functions` (rodar `cd functions && npm ci` antes). **Tudo que grava mexe no banco de produção**, exceto os testes de regras (emulador). Regra da casa: rodar primeiro sem `--gravar` (simulação) quando o script oferece.

### 5.1 Destaques

**`importar-atividades.mjs`** (Banco Curricular do Drive para Atividades)
- `node scripts/importar-atividades.mjs`: **simula**. Lista as pastas do Drive, mostra quantas atividades por etapa/componente/ano, amostra de títulos classificados e quantas ainda não estão no Portal.
- `node scripts/importar-atividades.mjs --gravar`: importa em rodadas de até 400, até acabar o que falta (pode rodar de novo: só traz o que é novo).
- Opções: `--etapa iniciais` (infantil, alfa, iniciais, finais, medio, inclusiva), `--limite 100`, `--paralelo 8` (downloads simultâneos; padrão 8).
- Usa as mesmas funções de `functions/atividades.js` (o botão "buscar novidades no Drive" do painel chama `sincronizarAtividades`, limitado a 60 por vez; o script é para cargas grandes).

**`demo-rede.mjs`** (Rede Modelo NEWPC, só dados fictícios)
- Rodar de dentro de `functions/`: `cd functions && node ../scripts/demo-rede.mjs <comando>`.
- `--criar`: cria município `demo-rede` ("Rede Modelo NEWPC", MS, ativo, `modulos_secretaria:["painel"]`), escolas, turmas, alunos, calendário, regras de notas, 6 semanas de chamadas, fichas de busca ativa e provas. Semente fixa: rodar de novo gera a mesma rede.
- `--simular`: mesmo fluxo de `--criar` sem gravar.
- `--manha`: simula as entradas de hoje pela portaria (rodar na manhã da demonstração).
- `--usuarios`: cria professores, gestores e secretaria fictícios (sem e-mail e sem senha, `demo:true`, não disparam o e-mail de novo cadastro) e 30 dias de acessos.
- `--apagar`: apaga tudo cujo ID começa com `demo-` nas coleções da demonstração.
- Para ver a rede: admin usa "Entrar como..." e escolhe a Rede Modelo. O Painel do admin e a lista de usuários escondem a Rede Modelo (chave "Incluir Rede Modelo").

**`definir-papel.mjs`** (papel editorial da Formação)
- `node definir-papel.mjs EMAIL admin|editor|nenhum`: grava a custom claim `papel` no Authentication e espelha em `equipe/{uid}`. **Grava direto** (sem simulação). A pessoa precisa sair e entrar de novo para o token trazer o papel.
- Faz o mesmo que a callable `definirPapel`, mas sem exigir que quem roda já seja admin (serve para o primeiro admin).

**`teste-regras-apps.mjs`** e **`teste-regras-aluno.mjs`** (regras no emulador)
- Não tocam no banco real: sobem dados fictícios no emulador (`demo-pe5`) e testam permissões com `@firebase/rules-unit-testing`.
- `teste-regras-apps.mjs`: 441 asserções. Folha Mágica, Teleprompter, TV (pareamento, telas, playlists, comunicados, campanhas), Recursos da escola, Frequência, Famílias, Busca ativa, Portaria, Calendário, Notas, convites da equipe de apoio, Atividades, Datas, Pesquisa etc.
- `teste-regras-aluno.mjs`: 89 asserções do perfil aluno (domínio, pré-cadastro, plano por município, contrato vencido, vídeos, jogos, biblioteca, histórias, colorir, dicas, acervo, config e 26 testes da Prova online).
- Cada um termina com `REGRAS ...: N ok, M falha(s)` e código de saída 1 se houver falha.

### 5.2 Tabela de todos os scripts

| Script | O que faz | Como rodar | Grava? |
|---|---|---|---|
| `aprovar-biblioteca.mjs` | Aprova e importa títulos da triagem quando a autorização foi dada fora do painel (usa `importarTitulo` de `functions/biblioteca.js`) | `node aprovar-biblioteca.mjs <licenca> "<comprovação>" ID1 ID2 ...` | Sim (Storage e Firestore) |
| `capas-audiolivros.py` | Gera capa PNG para audiolivros do LibriVox sem capa | `python3 capas-audiolivros.py` | Sim, direto |
| `definir-papel.mjs` | Claim `papel` da Formação | ver 5.1 | Sim, direto |
| `demo-olhar.mjs` | Procura municípios com "NEWPC" no nome e conta escolas, turmas, alunos, usuários, chamadas | `node scripts/demo-olhar.mjs` | Não (só leitura) |
| `demo-rede.mjs` | Rede Modelo | ver 5.1 | Sim (`--simular` não) |
| `enviar-historico.mjs` | Envia UMA vez o histórico de cadastros, pré-cadastros e dicas em CSV para a equipe | `SMTP_SENHA="$(gcloud secrets versions access latest --secret=SMTP_SENHA --project=portal-educador-5)" node enviar-historico.mjs` | Não grava; **envia e-mail** (remetente e destinatários fixos no código) |
| `historias-educativas.mjs` | Traz as Histórias Educativas da página antiga para a estante (usa `historias-ids.json` quando a pasta não é pública) | `node historias-educativas.mjs` (lista) / `--gravar` | Só com `--gravar` |
| `historias-ids.json` | Lista de IDs do Drive extraídos do HTML antigo | dado de apoio | |
| `importar-atividades.mjs` | Atividades | ver 5.1 | Só com `--gravar` |
| `importar-colorir.mjs` | Desenhos para Colorir do Drive: converte para WebP (1600 px e miniatura 360 px) e grava `colorir/{id}` | `npm i --silent sharp && node importar-colorir.mjs` (simula) / `--gravar` | Só com `--gravar` |
| `importar-gutenberg.py` | Livros em português de domínio público no Brasil (autores e tradutores falecidos há mais de 70 anos) do Project Gutenberg, gera PDF A5 com capa, remove a marca Gutenberg | baixar `pg_catalog.csv` para `/tmp`, depois `--listar`, `--teste 3` (PDFs locais), `--gravar [--max N] [--parte 1/3]` | Só com `--gravar` |
| `importar-librivox.py` | Audiolivros em português do LibriVox (o áudio fica no Internet Archive, não copia) | `--listar` / `--gravar` | Só com `--gravar` |
| `gutenberg-pt.py` | Lista livros em português do Gutenberg (gutendex) e classifica a situação de direitos | `python3 gutenberg-pt.py` (grava `/tmp/gutenberg-pt.json`) | Não (só arquivo local) |
| `inventario-atividades.mjs` | Inventário das pastas do Banco Curricular (contagem, tamanho, tipos) | `node scripts/inventario-atividades.mjs` (grava `/tmp/inventario-atividades.json`) | Não |
| `listar-audio-gibi.mjs` | Resumo da triagem de Audiolivros e Gibiteca | `node listar-audio-gibi.mjs` | Não |
| `listar-biblioteca.py` | Lista as pastas do Drive da Biblioteca antiga | `python3 listar-biblioteca.py` (grava `biblioteca-lista.json` local) | Não |
| `migrar-academia.mjs` | Migra a Formação do projeto antigo da Academia (cursos com subcoleções, trilhas, certificados, cpfs, `materiais/` e `capas/`) e reescreve links do bucket | `node scripts/migrar-academia.mjs` (simula) / `--gravar` | Só com `--gravar`; não sobrescreve o que já existe |
| `testar-metricas.sh` | Confere quais métricas do Cloud Monitoring têm dados (base do Painel de uso) | `bash scripts/testar-metricas.sh` | Não |
| `teste-calendario.mjs` | Testa o núcleo do Calendário e confere que as 3 cópias são idênticas | `node scripts/teste-calendario.mjs` | Não |
| `teste-frequencia.mjs` | Testa as contas da Frequência e a cópia do navegador | `node scripts/teste-frequencia.mjs` | Não |
| `teste-portaria.mjs` | Teste real da função `portaria` em produção com um totem temporário da Rede Modelo; apaga tudo no fim | `cd functions && node ../scripts/teste-portaria.mjs` (exige `demo-rede --criar` antes) | Sim, temporário (limpa no fim) |
| `teste-regras-apps.mjs`, `teste-regras-aluno.mjs` | Regras no emulador | ver seção 6 | Não (emulador) |
| `triagem-biblioteca.mjs` | Cria a lista `biblioteca_triagem` da Biblioteca antiga com sugestão (comercial, domínio público provável, revisar) e manda planilha por e-mail. Não copia obra nenhuma | `node triagem-biblioteca.mjs` (simula) / com `SMTP_SENHA=... --gravar` | Só com `--gravar` |
| `tv-campanhas-padrao.py` | Cria as 6 campanhas padrão da TV (dengue, trânsito, Outubro Rosa) se não existirem | `python3 tv-campanhas-padrao.py` | Sim, direto (idempotente) |
| `gibis/` (`arte.py`, `agua.py`, `hq.py`, `render.py`, `gerar.py`, `publicar.py`) | Gibi próprio "Turma do Pantanal: Pra onde vai a água?" (Ciências 5º ano, EF05CI02): `gerar.py` monta as páginas em WebP em `assets/gibis/...`; `publicar.py` grava `biblioteca/newpc-gibi-agua` apontando para as páginas no GitHub Pages | `cd scripts/gibis && npm install && python3 gerar.py`, depois git push, depois `python3 publicar.py` | `gerar.py` só arquivos locais; `publicar.py` grava direto |

---

## 6. Fluxo de trabalho da equipe: testes e deploy

### 6.1 Antes de qualquer deploy

1. JavaScript: validar sintaxe de todo arquivo alterado com `node --check arquivo.js`. Para JS embutido em HTML, extrair o `<script type="module">` para um arquivo temporário e rodar `node --check` nele **(confirmar o procedimento exato usado pela equipe)**.
2. Testes puros (rápidos, sem emulador):
   ```
   node scripts/teste-calendario.mjs
   node scripts/teste-frequencia.mjs
   ```
   Eles também falham se alguém alterou só uma das cópias dos núcleos (`functions/`, `assets/js/`, bloco do `apps/calendario`).
3. Testes de regras do Firestore no emulador (sempre que mexer em `firestore.rules`), a partir da raiz do repositório:
   ```
   mkdir -p /tmp/rt && cp scripts/teste-regras-apps.mjs scripts/teste-regras-aluno.mjs /tmp/rt/ && (cd /tmp/rt && [ -d node_modules/firebase ] || npm i --silent @firebase/rules-unit-testing@3 firebase@10.12.2) && firebase emulators:exec --only firestore --project demo-pe5 "node /tmp/rt/teste-regras-apps.mjs $PWD/firestore.rules && node /tmp/rt/teste-regras-aluno.mjs $PWD/firestore.rules"
   ```
   Os scripts são copiados para `/tmp/rt` para instalar as bibliotecas de teste fora do repositório. O projeto `demo-pe5` (prefixo `demo-`) garante que o emulador nunca fala com a nuvem. Resultado esperado: "0 falha(s)" nas duas linhas.
4. Regra nova ganha teste novo no script correspondente (apps ou aluno).

### 6.2 Deploy do back-end (Firebase CLI)

```
firebase deploy --only firestore:rules   --project portal-educador-5
firebase deploy --only firestore:indexes --project portal-educador-5
firebase deploy --only storage           --project portal-educador-5
firebase deploy --only functions:NOME    --project portal-educador-5   (várias: functions:a,functions:b)
```
- Publicar só a função alterada (deploy de todas leva mais tempo e reinicia as 56).
- Função nova que usa e-mail precisa declarar `secrets: [SMTP_SENHA]`; o segredo já existe no Secret Manager.
- Índice novo: publicar `firestore:indexes` e esperar o índice ficar "Ativo" no console antes de liberar a tela que usa a consulta.
- Ordem segura quando front e regras mudam juntos: **regras e funções primeiro**, front depois (o front novo quebra se a regra ainda for a antiga; o front antigo costuma continuar funcionando com a regra nova). O próprio front mostra "as regras do Firebase ainda não foram publicadas" quando recebe `permission-denied` em telas novas.
- Logs: `firebase functions:log --project portal-educador-5` ou console do Cloud Logging.

### 6.3 Publicação do front (GitHub Pages)

- `git add` + `git commit` + `git push` no repositório `Newpc-Alan/portal-educador-5`. O GitHub Pages publica sozinho em 1 a 2 minutos **(confirmar branch)**.
- Mensagens de commit no histórico: em português, descrevendo a tela e a mudança ("Prova online: ...", "Importação de atividades: ...").
- Cache: arquivos do GitHub Pages podem ficar em cache no navegador por alguns minutos; a TV tem service worker (`tv/sw.js`) e pode precisar recarregar **(confirmar estratégia de atualização do sw.js)**.

### 6.4 Convenções de código visíveis no repositório

- **Sem `onclick` inline**: nenhuma ocorrência de ` onclick=` nos 34 HTML; 853 usos de `data-action="..."` com um ouvinte central por página (delegação de eventos, ex.: `acao === "plano-todos"`).
- **Arquivos únicos autocontidos**: cada tela é um `index.html` com CSS e JS embutidos; dependências externas só do gstatic (Firebase 10.12.2), Google Fonts e `assets/vendor`.
- **Núcleos compartilhados**: lógica que roda no navegador e no servidor fica em um arquivo de núcleo copiado byte a byte, com teste que confere a igualdade.
- **Regras com lista fechada de campos** (`keys().hasOnly([...])`), limites de tamanho (`texto(v,n)`) e IDs determinísticos (`{uid}_{turma}_{dia}_{disc}`, `{item}_{data}_{turno}_{aula}`) para impedir duplicidade sem transação.
- **Dados sensíveis**: o que é de aluno (família, busca ativa, fotos) só a gestão da escola lê; e-mails internos não levam nome de aluno; painéis da secretaria só devolvem números.
- **Idempotência**: funções que podem rodar duas vezes usam ID único (`avisos_familia`, `freq_resumo` refeito do zero, `tx.create`).
- Textos, comentários e mensagens de erro em português, com a ação que a pessoa deve tomar.
- Projeto de teste do emulador sempre com prefixo `demo-`; dados de demonstração sempre com ID `demo-` e `demo:true`.

---

## 7. Modelo multi-município

### 7.1 `municipios/{id}`

Criado de duas formas: pela importação de escolas (se o município da planilha não existe, nasce com `status:"piloto"`, `modulos_professor:[]`, `modulos_aluno:[]`) ou pelo admin. Editado na tela **Municípios > Plano e módulos** (`/entrar/`, função `salvarPlano`).

| Campo | Valores / significado |
|---|---|
| `nome`, `uf` | identificação; `uf` alimenta feriados estaduais |
| `status` | `piloto`, `ativo` (contrato vigente), `inativo`. O front esconde municípios inativos das listas e bloqueia o aluno; **as regras não olham este campo** |
| `contrato_numero` | texto livre |
| `vigencia_fim` / `vigencia_fim_ts` | data de fim do contrato (texto e timestamp). Sem data = sem vencimento. É o `vigencia_fim_ts` que corta professor institucional e aluno nas regras, no Worker e nas funções |
| `modulos_professor[]` | IDs dos botões liberados ao professor. Lista vazia = todos (convenção do front e de `exigirLicenca`) |
| `modulos_aluno[]` | IDs liberados ao aluno (só módulos com `aluno:true`). Lista vazia = todos os de aluno. Aplicado nas regras por `alunoPode()` |
| `modulos_secretaria[]` | hoje só `"painel"` (Painel da Rede para secretaria e gestor) |
| `recursos[]` | recursos extras pagos; hoje só `"prova_online"` (exigido por `publicarProvaOnline`; o botão do Gerador só aparece para redes com o recurso) |
| `dominios_aluno[]` | domínios de e-mail dos alunos; espelhados em `dominios_aluno/{dominio}`. O front recusa domínios pessoais (gmail.com, hotmail.com, outlook.com, yahoo, live, icloud, bol, uol) e domínio que já pertence a outro município |
| `logo_url` | logo da rede (cabeçalho das provas, painel) |
| `demo` | `true` só na Rede Modelo |

IDs de módulos (constante `MODULOS` do `/entrar/`): `videos`*, `jogos`*, `ia` (inclui IA Studio), `provas`, `portal360`*, `atividades`, `relatorios`, `datas`*, `colorir`*, `historias`*, `biblioteca`*, `formacao`, `museus`*, `dicas`, `dicasaluno`* (só aluno), `apps`, `gestao`, `maestro`. (* = disponível para aluno.)

Além do plano por município existe a chave global `config/modulos` (situação de cada botão para todo o Portal: liberado ou "em breve", link e imagem), editada em **Módulos do Portal**.

### 7.2 `escolas/{id}`

`nome`, `inep`, `municipio_id`, `municipio_nome`, `municipio_uf`, `status` (`ativa`/`inativa`), `logo` **(confirmar campo do logo da escola)**. Criadas pela importação (colunas `municipio ; uf ; escola ; inep`); linha com escola já existente só atualiza o INEP.

### 7.3 `turmas/{id}`

Criadas pelo professor vinculado (ou admin) nas escolas dele: `nome` (ex.: "5º ano A"), `escola_id`, `escola_nome`, `municipio_id`, `turno` (matutino/vespertino/noturno/integral, normalizado pelos avisos), `ano_letivo`, `status` (`ativa`/`inativa`, desativar em vez de apagar), `criado_por`. Os alunos da turma (para chamada, carteirinha, portaria) ficam em `alunos/` com `turma_id`.

### 7.4 `usuarios/{uid}`

| Campo | Significado |
|---|---|
| `perfil` | admin, secretaria, gestor, professor, aluno, secretaria_escolar, portaria |
| `status` | `ativo`, `pendente`, `inativo` |
| `licenca_tipo` | `institucional` (padrão: vale enquanto o professor tem escola e o contrato do município está vigente), `teste` (autocadastro, 7 dias), `avulsa`, `cortesia` (com `licenca_fim`). Campos de apoio vistos no front: `licenca_inicio`, `licenca_plano`, `licenca_valor`, `licenca_ref`, `licenca_pacote`, `licenca_alterada` |
| `licenca_fim` | timestamp de fim para licenças não institucionais |
| `municipio_id`, `municipio_nome` | rede |
| `escola_id` | escola principal (primeira de `escolas_ids`) |
| `escolas_ids[]`, `escolas_nomes[]` | professor: 1 a 5 escolas do mesmo município (ele mesmo pode ajustar); gestor: até 5; secretaria escolar e portaria: 1; secretaria de educação: nenhuma |
| `turmas_ids[]` | turmas que o professor marcou como suas |
| `turma_nome` | só aluno: texto da turma (ex.: "5º ano A"), vindo da importação. É o que liga o aluno à Prova online |
| `ultimo_acesso` | atualizado pelo próprio usuário; usado em "ativos 30/7 dias" e "online agora" |
| `origem`, `origem_vinculo` | autocadastro, pre_cadastro, importacao |
| `demo` | Rede Modelo |

Atenção a duas entidades diferentes de "aluno":
- `usuarios/{uid}` com `perfil:"aluno"`: a **conta de login** do aluno (Início do aluno, módulos de aluno, Prova online, Dica do Aluno).
- `alunos/{id}`: o **cadastro do aluno na turma** feito pelo professor (frequência, carteirinha, portaria, famílias, avisos, busca ativa). Não há ligação automática entre os dois.

### 7.5 `pre_cadastros/{email}`

Gravado pelo importador do admin (professores, equipe, alunos) ou pelo convite do gestor (portaria e secretaria escolar). No primeiro login com a conta Google do e-mail (verificado), o próprio usuário cria `usuarios/{uid}` com exatamente esse vínculo (caminhos 3, 5, 6 e 7 da seção 2.3). Se a pessoa já entrou antes, o importador atualiza direto o `usuarios/{uid}`.

---

## 8. Pontos de atenção e dívida técnica

Cada item: risco, onde está, sugestão. Ordenados do mais sério para o menos sério (avaliação técnica).

### 8.1 Coleção legada `avaliacoes` com leitura pública (e gabarito junto)
- Onde: `firestore.rules`, `match /avaliacoes/{id} { allow read: if true; }`. As questões guardam a alternativa correta (`alternativas[].correta`, lido pelo `painelSecretaria`).
- Risco: qualquer pessoa, sem login, pode listar todas as provas de todos os municípios pela API do Firestore, com gabarito, `professor_uid`, `escola_id`. Aluno esperto acha a resposta antes da prova. Exposição de dados da rede.
- Sugestão: trocar `read: if true` por `get` (sem `list`) e mover a correção para o servidor; ou migrar de vez para a Prova online (gabarito em `provas_online_gab`). No mínimo, separar o gabarito em coleção fechada.

### 8.2 Coleção legada `respostas` com criação aberta
- Onde: `match /respostas/{id} { allow create: if true; }`, sem validação de campos nem de tamanho.
- Risco: qualquer um grava respostas falsas (ou milhares de documentos) em qualquer prova; isso entra no acerto por habilidade do Painel da Rede e gera custo.
- Sugestão: validar campos (`hasOnly`), exigir `avaliacao_id` existente e aberta, limitar tamanho; a médio prazo, aposentar `aluno.html` em favor da Prova online.

### 8.3 Envio de e-mail: conta Gmail comum e limite diário compartilhado
- Onde: `functions/.env.portal-educador-5` (`SMTP_USUARIO` é conta @gmail.com, `SMTP_HOST=smtp.gmail.com`), `avisos.js` (`LIMITE_DIA = 1500`, comentário fala em Workspace com cerca de 2.000/dia).
- Risco: conta Gmail comum tem limite bem menor que Workspace (da ordem de 500 destinatários por dia) **(confirmar o tipo da conta e o limite atual no Google)**. O teto de 1.500 conta só os avisos às famílias; resumo diário, pré-cadastros, cadastros, dicas, chamados, TV, agenda (um por professor por dia), lembretes e busca ativa usam a mesma conta sem contar. Num dia de muitos avisos, o Gmail bloqueia o envio e **todos** os e-mails param, inclusive chamados técnicos; a conta pode ser suspensa temporariamente.
- Sugestão: migrar para conta Workspace dedicada (ex.: `avisos@portaldoeducador.com.br`) ou serviço transacional (SendGrid, Amazon SES, Brevo); contar todos os envios num contador único; reduzir `LIMITE_DIA` para caber no limite real; separar remetente de avisos às famílias do remetente interno. Também ajustar o padrão de `SMTP_USUARIO` no código para bater com o `.env`, e tirar remetente e destinatários fixos de `scripts/enviar-historico.mjs`.

### 8.4 Pastas do Drive públicas e chave de API no código
- Onde: `functions/atividades.js`, `functions/biblioteca.js`, `scripts/importar-*.mjs`, `historias-educativas.mjs`, `triagem-biblioteca.mjs`, `listar-biblioteca.py`, `inventario-atividades.mjs` (constante `CHAVE` e cabeçalho `Referer` forjado).
- Risco: (a) as importações só funcionam porque as pastas do Banco Curricular, da Biblioteca antiga e do Colorir estão abertas a "qualquer pessoa com o link"; quem tiver o ID baixa todo o acervo sem licença do Portal. (b) A chave de API está no código e no git; restrição por Referer não protege, porque o próprio código mostra como forjar o cabeçalho (risco de uso de cota por terceiros).
- Sugestão: depois de concluir as importações, fechar o compartilhamento público das pastas e passar a ler o Drive com a conta de serviço (como o backup já faz, Drive compartilhado com a conta das funções); rotacionar a chave e restringi-la à API do Drive; tirar a chave do código (parâmetro).

### 8.5 Arquivos do acervo por link com token (acesso não depende de licença)
- Onde: atividades, biblioteca, colorir, provas online e TV são servidos por `firebasestorage.googleapis.com/...&token=...` gravado no documento.
- Risco: a licença é conferida só para ler o documento; o link em si funciona sem login, para sempre, para quem o receber (ex.: professor que encaminha o PDF de uma atividade). Também `storage.rules` libera `tv/**`, `biblioteca/**`, `atividades/**`, `colorir/**` para **qualquer logado**, incluindo professor em teste vencido e aluno de outro município.
- Sugestão: aceitável para material de divulgação; para o que é diferencial comercial, servir pelo Worker do acervo (link assinado de 5 min) ou por URL assinada curta gerada por função. Alinhar as regras de Storage à licença.

### 8.6 Ligação aluno ↔ turma por texto (Prova online)
- Onde: `provas-online.js`, `alunosDaTurma()`: casa `usuarios.turma_nome` com `turmas.nome` normalizado e exige `usuarios.escola_id == turma.escola_id`.
- Risco: aluno que entrou pelo **domínio** nasce sem escola (`escola_id: null`, caminho 4 das regras) e sem `turma_nome`: nunca aparece em prova nenhuma até ser importado. Diferenças de grafia ("5º A" x "5º ano A", "5A" x "5 A") excluem a turma inteira ("Nenhum aluno da turma ... tem conta"). Turmas com o mesmo nome em turnos diferentes se misturam.
- Sugestão: guardar `turma_id` no cadastro do aluno (importação com escolha da turma) e casar por ID; tela para o professor ver e corrigir quem está na turma; ligar `alunos/` (cadastro da turma) a `usuarios/` (conta) por e-mail ou matrícula.

### 8.7 `status` do município não bloqueia nas regras
- Onde: `contratoOk()` só olha `vigencia_fim_ts`. O `status: "inativo"` só é tratado no front (aluno) e nas listas.
- Risco: rede marcada "inativa" mas sem data de fim (ou com data futura) continua com professores e alunos acessando pela API; o mesmo vale para o Worker e o Storage.
- Sugestão: incluir `meuMuni().get("status","ativo") != "inativo"` em `contratoOk()` (e no Worker e em `exigirLicenca`), e na operação sempre preencher a data de fim do contrato.

### 8.8 Plano do professor (`modulos_professor`) só no front
- Onde: regras de `videos`, `jogos`, `atividades`, `biblioteca`, `acervo` etc. usam `licenciado()`, sem olhar `modulos_professor`. Só a Formação (`exigirLicenca`) confere o plano.
- Risco: professor de rede que não contratou um módulo consegue ler o catálogo pela API (baixo impacto, mas é o que diferencia planos).
- Sugestão: função `profPode(m)` nas regras, igual a `alunoPode(m)`, aplicada nas coleções de catálogo.

### 8.9 Licença diferente no Storage
- Onde: `storage.rules`, `licenciado()` não confere contrato vigente (`vigencia_fim_ts`).
- Risco: professor de município com contrato vencido continua lendo e gravando nas pastas pessoais (Lousa, provas).
- Sugestão: ler `municipios/{id}` também nas regras de Storage (custo de 1 leitura) ou aceitar conscientemente como "período de carência".

### 8.10 Dois sistemas de administrador
- Onde: Portal usa `usuarios.perfil == "admin"`; as callables da Formação (`definirPapel`, `revogarCertificado`, `excluirCurso`, `relatorioAdesao`, `publicarCurso` para publicar) usam a custom claim `papel == "admin"`.
- Risco: admin novo da NEWPC consegue tudo no Portal e nas regras, mas recebe "Acesso restrito ao administrador" nessas funções até rodar `definir-papel.mjs`. Ao desligar alguém, é preciso tirar os dois.
- Sugestão: nas callables aceitar também `perfil == "admin"` (como `fAdmin()` nas regras), ou registrar no checklist de entrada/saída de equipe.

### 8.11 Painel da Rede usa nome do município em `acessos_dia`
- Onde: `painel-secretaria.js` filtra `acessos_dia.municipio == muni.nome`.
- Risco: renomear o município ou dois municípios com o mesmo nome (UFs diferentes) misturam ou zeram o gráfico de uso.
- Sugestão: gravar `municipio_id` em `acessos_dia` e filtrar por ID.

### 8.12 Comentários e documentação desatualizados
- `storage.rules` diz que atividades, colorir e biblioteca ficam no Cloudflare R2; hoje ficam no Storage principal.
- `functions/package.json` descreve "Cloud Functions da Academia do Educador".
- `README.md` vazio; não há registro de configuração dos buckets (ciclo de vida, CORS), do Worker nem da branch do Pages.
- Sugestão: usar estas notas como base de um `docs/` ou do README.

### 8.13 Pontos menores
- `acessos_dia`: o cliente grava qualquer campo (só confere `uid` e ID). Sugestão: `hasOnly`.
- `config/{id}` só é lido por `licenciado() || aluno()`: gestor, secretaria de educação, secretaria escolar e portaria não leem `config/modulos` e `config/acervo` **(confirmar efeito nas telas desses perfis)**.
- `acompanharAula` não chama `exigirLicenca` (só `iniciarAula`); como a sessão nasce em `iniciarAula`, o impacto é pequeno.
- Funções agendadas a cada 5 e 15 minutos rodam 24 h, inclusive em férias (custo baixo, mas contínuo).
- `teste-portaria.mjs` roda contra a função de produção (com dados da Rede Modelo e limpeza no fim).
- Dependência de `scripts/` no `firebase-admin` de `functions/` (rodar `npm ci` em `functions` antes).
- `functions/node_modules` existe na cópia local; está no `.gitignore` e não vai ao Pages.

---

## 9. Checklist operacional da equipe NEWPC

### 9.1 Implantar um município novo (passo a passo)

Pré-requisitos: conta de admin no Portal (perfil `admin` ativo); planilhas da rede em CSV ou Excel (o importador lê a aba certa e ignora linhas de exemplo e vazias); contrato assinado (número e data de fim).

1. **Escolas (e o município)**: `/entrar/` > Importar > tipo **Escolas**. Baixar o modelo. Colunas `municipio ; uf ; escola ; inep`. Conferir a prévia (Novo / Atualiza / Ignorado / Erro) e gravar. Se o município não existe, ele é criado com status **Piloto** e plano vazio. Conferir na lista que não ficou município duplicado por grafia diferente.
2. **Plano e módulos**: Municípios > (o município) > **Plano e módulos**:
   - Número do contrato e **data de fim da vigência** (sem data = nunca vence; preencher sempre).
   - Status: Piloto durante o teste, **Ativo** com contrato vigente.
   - Marcar os módulos do professor e do aluno (atalhos "todos", "nenhum", "alunos = os do professor").
   - **Painel da Rede** (secretaria e gestores) se contratado.
   - Recursos extras: **Prova online** se contratada.
   - **Domínios de e-mail dos alunos** (ex.: `aluno.<municipio>.ms.gov.br`), só domínios exclusivos de alunos. Salvar.
3. **Logo da rede** (e das escolas, se houver): Municípios > logos (vai no cabeçalho das provas e no painel) **(confirmar caminho da tela)**.
4. **Gestão e equipe**: Importar > **Gestão e equipe**. Colunas `nome ; email ; perfil ; municipio ; escola`. Perfis aceitos: Gestor (até 5 escolas), Secretaria escolar e Portaria (1 escola), **Secretaria de Educação** (escola vazia). E-mail tem de ser a conta Google que a pessoa vai usar.
5. **Professores**: Importar > **Professores**. Colunas `nome ; email ; municipio ; escolas` (várias escolas separadas por `|`, aceita nome ou INEP). Quem já entrou no Portal tem o vínculo atualizado e é aprovado; os demais viram pré-cadastro. A equipe recebe um e-mail-resumo em até 15 minutos.
6. **Alunos**: duas formas, que podem conviver:
   - **Por domínio** (passo 2): qualquer conta Google do domínio vira aluno do município no primeiro acesso, **sem escola e sem turma**.
   - **Por importação**: Importar > **Alunos**, colunas `nome ; email ; municipio ; escola (opcional) ; turma (opcional)`. Para usar a Prova online, **escola e turma são obrigatórias na prática**, e o texto da turma tem de bater com o nome da turma criada pelo professor (ex.: "5º ano A").
7. **Calendário letivo**: a Secretaria de Educação (ou o admin) cria o calendário da rede em Aplicativos > Calendário; gestores ajustam a escola. Regras de notas e frequência mínima em Notas e Médias (secretaria).
8. **Turmas e alunos de turma**: cada professor cria as turmas dele e cadastra os alunos (frequência, carteirinha). A gestão cadastra as famílias (Famílias) e decide quais avisos às famílias ligar.
9. **Recursos da escola e TVs** (se contratados): cadastro de equipamentos e contratos de SLA (contrato e transferência de escola só o admin), etiquetas QR, cartaz da escola; pareamento das TVs pelo código de 6 letras; totem da portaria = TV em modo Portaria (opção de foto na entrada).
10. **Conferência final** com "Entrar como..." (admin): ver o Início como professor, aluno, gestor e secretaria do município; abrir o Painel da Rede; testar um login real de cada perfil.
11. **Comunicar a rede**: professores e equipe entram em `app.portaldoeducador.com.br/entrar/` com a conta Google do e-mail importado.

Para apresentação comercial sem dados reais: usar a Rede Modelo (`demo-rede.mjs --criar` e `--usuarios`, e `--manha` no dia).

### 9.2 Desligar ou suspender um município

1. Plano e módulos: status **Inativo** e **data de fim da vigência** no passado (é a data que corta o acesso nas regras; o status sozinho não corta, ver 8.7).
2. Opcional: desmarcar o domínio de alunos (para impedir cadastro novo).
3. Os dados ficam; backup semanal continua cobrindo.

### 9.3 Guia rápido de suporte (problema comum e onde olhar)

| Sintoma | Causa provável | Onde olhar / o que fazer |
|---|---|---|
| Professor importado entra e cai no "teste grátis" | Entrou com outro e-mail (ex.: pessoal) ou com e-mail/senha em vez da conta Google; o pré-cadastro é por e-mail exato e verificado | Usuários > pré-cadastros (`pre_cadastros/{email}`); corrigir o e-mail na planilha e reimportar, ou ajustar o usuário manualmente |
| "Seu cadastro ainda não está vinculado a uma escola" | `usuarios.escola_id` vazio | Usuários > editar vínculo; ou reimportar professor |
| Professor/aluno da rede perdeu acesso de repente | `vigencia_fim_ts` do município passou | Municípios > Plano e módulos > data de fim |
| Professor em teste sem acesso | `licenca_fim` venceu (7 dias) | Usuários > licença (avulsa, cortesia, institucional) |
| Aluno entra e vê "contrato" / sem botões | município inativo, vencido, ou `modulos_aluno` sem os botões | Plano e módulos |
| Aluno com e-mail da escola cai como professor em teste | domínio não cadastrado em `dominios_aluno` | Plano e módulos > domínios de aluno |
| Professor não consegue cadastrar com e-mail institucional | o domínio está cadastrado como domínio de aluno (bloqueio de propósito) | separar domínio de professor e de aluno |
| Botão aparece "Em breve" para todos | `config/modulos` com o módulo não liberado | Módulos do Portal |
| Prova online: "não está incluída no plano da sua rede" | município sem `prova_online` em `recursos` | Plano e módulos > Recursos extras |
| Prova online: "Nenhum aluno da turma ... tem conta" | alunos sem `escola_id`/`turma_nome` iguais aos da turma | Usuários > Alunos: conferir escola e turma; reimportar alunos com escola e turma (ver 8.6) |
| Aluno não acha a prova | não está em `alunos_uids` (entrou depois da publicação, ou turma diferente) | `provas_online/{id}`; republicar a prova depois de corrigir o cadastro |
| Aluno "bloqueado" na prova | passou do número de avisos (saiu da tela cheia) | professor usa "nova chance" ou "mais tempo" no painel ao vivo |
| Nota do aluno não aparece | janela não terminou e professor não liberou | professor: "liberar notas" |
| Família não recebe aviso | tipo de aviso desligado, família sem e-mail ou sem aceite, limite diário, erro do Gmail | `avisos_config/{escola}`; `avisos_familia` (campo `status`: enviado, sem_contato, sem_aceite, sem_email, limite, erro); `avisos_contador/{dia}`; logs das funções `avisosFamilia*` |
| Nenhum e-mail sai (chamados, agenda, resumo) | limite do Gmail estourado ou senha de app revogada | Cloud Logging das funções de e-mail; conta de envio; segredo `SMTP_SENHA` (ver 8.3) |
| Frequência/busca ativa não atualiza | chamada não gravou, ou `freqResumo` falhou | `freq_chamadas` do dia; `freq_resumo/{turma}_{ano}`; logs de `freqResumo` |
| Totem da portaria "Esta tela não está em modo Portaria" | `tv_telas/{chave}.modo` diferente de `portaria` | painel das TVs (Apps > TV) |
| Totem recusa aluno | aluno de outra escola, sem turma ativa, ou data com mais de 3 dias | `alunos/{id}` (escola e turma), `turmas` (status) |
| TV aparece offline no painel | sem batimento há mais de 15 min (`visto_em`) | rede/energia da TV; recarregar `/tv/` |
| Chamado técnico não chega por e-mail | falha em `emailChamadoTecnico` ou gestor sem e-mail | logs; `rec_chamados/{id}` existe? |
| Etiqueta QR não deixa abrir chamado | já existe chamado aberto naquele equipamento | gestor resolve o chamado anterior |
| Link do calendário (.ics) parou | token trocado no Portal | pedir link novo à secretaria |
| Painel da Rede: "ainda não faz parte do plano" | sem `painel` em `modulos_secretaria` | Plano e módulos > Painel da Rede |
| Formação: "contrato vencido" / "não faz parte do plano" | `vigencia_fim_ts` ou `formacao` fora de `modulos_professor` | Plano e módulos |
| Certificado: "CPF já vinculado a outra conta" | CPF usado em outra conta | suporte confere em `cpfs/` (só servidor) e com o professor |
| Admin novo recebe "Acesso restrito ao administrador" na Formação | falta a claim `papel` | `node scripts/definir-papel.mjs EMAIL admin` e sair/entrar |
| Download do acervo dá "licença expirada ou sem acesso" | Worker conferiu a licença e negou | licença do usuário / município; para aluno, módulo liberado |
| Backup falhou | pasta fora de Drive compartilhado, robô sem permissão | `backups_log` (status e erro); Backup > configurar pasta |
| Tela nova dá "Sem permissão: as regras do Firebase ainda não foram publicadas" | front publicado antes das regras | `firebase deploy --only firestore:rules` |

Ferramentas de diagnóstico do admin: "Entrar como..." (ver o Portal como outro perfil/rede), Painel do administrador (uso, Rede Modelo oculta por padrão), Painel de uso (`painelUso`: leituras, gravações, erros 5xx por função), Cloud Logging (`firebase functions:log`), console do Firestore.

---

## Apêndice: arquivos lidos

`CNAME`, `README.md`, `.firebaserc`, `.gitignore`, `firebase.json`, `cors.json`, `firestore.rules` (914 linhas), `firestore.indexes.json`, `storage.rules`, `storage-portaria.rules`, `storage-backups.rules`, `cloudflare/acervo-worker.js`, `functions/*.js` (todos), `functions/package.json`, nomes dos parâmetros em `functions/.env.portal-educador-5`, `scripts/*` (todos, cabeçalhos e lógica principal), trechos de `entrar/index.html` (plano, importador, MODULOS, perfis), `aluno.html`, títulos de todas as páginas, `git log`.
