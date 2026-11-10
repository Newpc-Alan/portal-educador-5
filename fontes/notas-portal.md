# Notas para o Manual do Usuário · Portal do Educador 5.0

Fonte única: `/home/claude/portal-educador-5/entrar/index.html` (≈6.550 linhas, SPA em JS puro + Firebase Auth/Firestore/Storage/Functions).
Endereço da tela: `/entrar/` (o próprio arquivo). Notas fiéis ao código; o que não foi possível confirmar está marcado "(confirmar)".

> IMPORTANTE SOBRE ROTAS: o app `/entrar/` **não usa rotas #hash internas para navegar entre seções**. A navegação é pelo menu lateral (itens com `id` interno, ex.: `municipios`, `usuarios`), que troca o conteúdo da área principal sem mudar o endereço. As "rotas" `#acervo`, `#videos`, `#jogos`, `#ia`, `#provas`, `#relatorios`, `#formacao`, `#museus`, `#dicas`, `#colorir`, `#biblioteca`, `#historias`, `#datas`, `#atividades`, `#apps`, `#gestao`, `#dicasaluno` existem como **valores de URL de um botão do Início** (lista `ROTAS_MODULO`): quando o botão de um módulo tem esse "endereço", o Portal abre a tela interna correspondente (ação `ini-<nome>`). Vários módulos levam a OUTRAS páginas do site (`/gestao/`, `/painel/`, `/relatorios/`, `/apps/calendario/`, `/apps/frequencia/#portaria`, `/dicas/`, `/formacao/admin/`, `/biblioteca/#triagem` etc.), documentadas por outros agentes.

---

---

## 1. LOGIN E CADASTRO

### 1.1 Tela de login (`#loginView`)
- Marca: logo "Portal do Educador · Plataforma de apoio ao professor".
- Seletor no topo (botões de rádio): **"👩‍🏫 Sou professor"** e **"🎒 Sou aluno"**. A escolha fica guardada na sessão do navegador (`sessionStorage pde_como`) e também pode vir pela URL: `/entrar/?como=aluno` ou `/entrar/?como=professor`.
  - Comentário no código: o botão só muda a tela e o que acontece se a conta ainda não tem cadastro; **quem decide o perfil é o banco** (domínio da rede ou lista importada), nunca o botão.
- Modo **Sou professor** (padrão):
  - Título "Acesse sua conta"; subtítulo "Recursos pedagógicos, turmas e avaliações em um só lugar."
  - Campos **E-mail** e **Senha** + botão **Entrar** (login por e-mail/senha do Firebase).
  - Divisor "ou" + botão **Entrar com Google**.
  - Rodapé: "Acesso restrito a secretarias, escolas e professores" + link **"Conhecer o Portal do Educador"** (vai para `/`).
- Modo **Sou aluno**:
  - Título "Entrar como aluno"; subtítulo "Vídeos, jogos, desenhos, histórias e muito mais para aprender brincando."
  - Esconde e-mail/senha; mostra nota: "Entre com a **conta Google da sua escola** (o e-mail que a escola te deu)." Só o botão **Entrar com Google**.
  - Rodapé: "Acesso para alunos das redes que usam o Portal".
- Login Google: abre janela (popup) com "escolher conta"; se o celular bloquear a janela, o Portal faz o login na própria página (redirect) automaticamente.
- **Navegador embutido** (WhatsApp, Instagram, Facebook, TikTok, LinkedIn, Pinterest, WebView Android, WKWebView iOS): aparece o aviso **"Abra no Safari ou no Chrome"** · "Você abriu o Portal dentro de outro aplicativo. Por segurança, o Google não permite entrar com a conta Google por aqui. Copie o link e abra no navegador do celular." + botão **Copiar link** (copia `.../entrar/`; ao copiar vira "Link copiado! Cole no Safari ou Chrome").
- Botão **Sair** fica no rodapé do menu lateral (caixa do usuário com inicial, nome e perfil).

### 1.2 O que acontece no primeiro login (função `carregarUsuario`)
Ordem de verificação quando a pessoa entra e ainda não existe em `usuarios/{uid}`:
1. **Pré-cadastro** (`pre_cadastros/{email}`), só com e-mail verificado (ex.: Google) e pré-cadastro com status "ativo":
   - perfil **aluno** importado: entra já ativo, licença institucional, com município, escola e turma (nome) do pré-cadastro.
   - perfis **portaria, secretaria_escolar, gestor, secretaria** (equipe convidada pelo gestor ou importada): entra ativo, institucional, com exatamente a escola/escolas do convite. Origem gravada: `convite_gestor` (se veio de convite) ou `pre_cadastro`.
   - perfil **professor** importado: entra ativo, institucional, com município, escolas e turmas do pré-cadastro.
2. **Domínio de e-mail de aluno** (`dominios_aluno/{dominio}`): se o domínio do e-mail Google estiver cadastrado no município (ex.: `aluno.ribasdoriopardo.ms.gov.br`) e ativo, a pessoa vira **aluno** daquele município (ativo, institucional, sem escola definida; origem `dominio`).
3. **Nenhum dos dois**:
   - Se escolheu "Sou professor": abre o **formulário de autocadastro** (teste grátis de 7 dias), ver 1.3.
   - Se escolheu "Sou aluno": mostra o aviso "Ainda não encontramos sua escola" (nada é criado).

### 1.3 Autocadastro do professor (teste grátis de 7 dias) · `mostrarCadastro` (≈ linha 3284)
Ver 1.5 (campos e regras) e 1.6 (avisos de licença).

### 1.4 Telas de bloqueio / espera (função `abrirApp`)
Regras por perfil, na ordem:
- **Administrador**: na primeira entrada da sessão vê a tela **"Como você quer entrar?"** (ver 2.1 "Entrar como...").
- **Aluno**:
  - status diferente de ativo → aviso **"Seu acesso está pausado"** · "Fale com o professor ou a secretaria da sua escola para liberar de novo."
  - município inexistente, contrato vencido ou município "inativo" → **"O Portal da sua escola está em pausa"** · "Assim que a sua rede renovar, o acesso volta sozinho. Seus favoritos continuam guardados."
  - Aluno sem acesso (escolheu "Sou aluno" e não foi reconhecido) → **"Ainda não encontramos sua escola"** · "Você entrou com <e-mail>. Para usar o Portal como aluno, entre com a conta Google que a sua escola te deu. Se já é essa, peça para o professor ou a secretaria da escola liberar o seu acesso."
  - Botões nesses avisos: **"Entrar com outra conta"** e (só no "não encontramos") **"Na verdade, sou professor"**.
  - Título da barra: "Portal do Aluno", selo "Aluno".
- **Demais perfis (professor, gestor, secretaria, equipe de apoio)**:
  - sem cadastro → formulário de autocadastro;
  - status diferente de "ativo" → **tela de espera** (`mostrarEspera`, cadastro em análise);
  - licença institucional sem vínculo (secretaria sem município; demais sem escola) → tela de espera;
  - licença vencida → **tela de licença expirada** (`mostrarExpirada`);
  - licença não institucional (avulsa, teste, cortesia) → menu reduzido **"avulso"** (sem turmas da rede);
  - aviso de licença no topo (`avisoDeLicenca`), ver 1.6.

### 1.5 Autocadastro (teste grátis) · detalhes
Tela "Complete seu cadastro", selo "Primeiro acesso". Cartão "Bem-vindo(a) ao Portal do Educador! Preencha seus dados para liberar **7 dias de teste grátis**. Leva menos de 1 minuto."
Campos: **Nome completo** (mín. 5 letras) · **WhatsApp** (com DDD, 10 ou 11 dígitos, máscara automática) · **Função** (Professor(a), Coordenador(a) pedagógico(a), Diretor(a), Técnico(a) da Secretaria, Outra) · **Estado** (UF) · **Município** (lista do IBGE após escolher UF; se o IBGE não responder, vira campo de texto "Digite o município") · **Rede** (Municipal, Estadual, Particular, Federal, Outra) · **Código INEP da escola** (opcional, 8 números) · **Escola onde dá aula** · **Etapas em que atua** (Educação Infantil; Anos Iniciais (1º ao 5º); Anos Finais (6º ao 9º); Ensino Médio; EJA; Educação Especial; ao menos uma) · caixa de aceite da **Política de Privacidade** (link iubenda).
Botão **Liberar meu teste grátis** → toast "Pronto! Seu teste de 7 dias está liberado." e entra direto (status ativo, licença tipo "teste", fim = hoje + 7 dias, origem "autocadastro"). Se faltar algo: toast "Falta: ...".
Rodapé: "Sua escola é atendida pela prefeitura com o Portal do Educador? Preencha normalmente: a equipe vincula você à sua rede." (no painel Usuários aparece a etiqueta "Município atendido: X" quando o município digitado coincide com um cliente; o admin converte para Institucional).

### 1.6 Avisos e telas de licença
- **Aviso no topo** (`avisoDeLicenca`), quando é teste ou faltam ≤15 dias: "⏳ Seu teste grátis termina em N dia(s), em dd/mm/aaaa." / "O contrato do seu município vence em N dia(s)." / "Sua licença vence em N dia(s), em dd/mm/aaaa." Botão (não institucional) **Assinar agora** (teste) ou **Renovar** → WhatsApp da NEWPC (55 67 3026-6571) com mensagem pronta "Olá! Quero assinar/renovar o Portal do Educador. Meu e-mail de acesso: ...". Fica vermelho (urgente) com ≤3 dias.
- **Licença expirada** (título "Licença expirada", selo "Expirada", ícone 🔑):
  - Institucional: "O acesso do seu município está suspenso · O contrato do Portal do Educador com a sua rede venceu em dd/mm/aaaa. Assim que for renovado, seu acesso volta sozinho, com tudo o que você já fez."
  - Teste/avulsa: "Seu teste grátis terminou" ou "Sua licença venceu" · "Seu cadastro e seu histórico continuam guardados. Assine ou renove para continuar usando os recursos do Portal." Selos: Mensal · Semestral · Anual · Pacote para escola. Botão **Falar com a equipe e assinar** (WhatsApp).
  - Sempre: botão **Já paguei, verificar** (recarrega o cadastro).
- **Cadastro em análise** (status pendente; ou institucional sem vínculo): título "Cadastro em análise", selo "Aguardando aprovação", ⏳ "Recebemos seu cadastro · Agora o administrador vai aprovar seu acesso e vincular o município, as escolas e as turmas em que você dá aula. Quando isso acontecer, é só tocar em 'Verificar novamente'." + e-mail + botão **Verificar novamente**.
- **Acesso desativado** (status inativo): título "Acesso desativado", 🔒 "Seu acesso está desativado · Se acha que isso é um engano, fale com a coordenação da sua escola ou com a equipe do Portal do Educador." + **Verificar novamente**.
- Regra de validade (`licencaDe`): institucional usa a **vigência do contrato do município** (`vigencia_fim`); sem vigência cadastrada = sem fim. Avulsa/teste/cortesia usam `licenca_fim` do usuário.

---

## 2. PERFIS E MENUS (constante `MENUS`, linha ≈1077)

Nomes oficiais visíveis (`LABELS_PERFIL`): **Administrador**, **Secretaria de Educação**, **Gestor da escola**, **Professor**, **Aluno**, **Secretaria escolar**, **Portaria**. Existe ainda o menu interno **avulso** (professor com licença avulsa, teste ou cortesia), que aparece com o rótulo de perfil "Professor".

Na caixa "Gerenciar cadastro" (admin) o seletor de Perfil mostra: "Professor", "Gestor da escola (diretor ou coordenador)", "Secretaria de Educação", "Administrador (equipe NEWPC)". Secretaria escolar e Portaria só nascem por convite do gestor ou importação de equipe.

### 2.1 Administrador (equipe NEWPC)
Menu lateral (na ordem, nomes exatos):
1. 📈 **Painel** → painel interno (abas Pessoas e uso / Conteúdo e participação / Infraestrutura e custos / 💾 Backup)
2. 📊 **Painel da Rede (secretarias)** → abre `/painel/`
3. 🏠 **Início (prévia)** → prévia da tela inicial (pode alternar professor/aluno, ver seção 3)
4. 📰 **Notícias** → administração de notícias
5. 📅 **Datas Comemorativas** → administração das datas
6. 🧩 **Módulos do Portal** → catálogo de botões do Início
7. 🏛️ **Municipios**
8. 🏫 **Escolas**
9. 📚 **Turmas**
10. 🧒 **Alunos**
11. 📝 **Avaliacoes**
12. 👥 **Usuarios** (com contador de pendentes no menu)
13. 📥 **Importar cadastros**
14. 🗂️ **Acervo** (administração)
15. 🎬 **Vídeos** (administração)
16. 🎮 **Jogos** (administração)
17. 🤖 **Dicas de IA** (administração)
18. 🎓 **Formação Continuada** → abre `/formacao/admin/`
19. 💡 **Dicas recebidas** → abre `/dicas/#recebidas`
20. 🧪 **Entrar como...** → volta à tela de escolha de simulação

**"Como você quer entrar?"** (admin, uma vez por sessão do navegador): "Para testes e homologação: veja o Portal exatamente como cada perfil vê. Você pode trocar a qualquer momento." Cartões:
- 🛡️ Administrador · "Gestão completa: municípios, usuários, módulos e conteúdos"
- 👩‍🏫 Professor · "Tela e módulos de um professor da rede escolhida"
- 🎒 Aluno · "Tela e módulos de um aluno da rede escolhida"
- 🏫 Gestor da escola · "Painel da Escola, Gestão Escolar e calendário da escola escolhida"
- 🏛️ Secretaria de Educação · "Painel da Rede e as ferramentas da secretaria do município"
- 🗂️ Secretaria escolar · "Famílias, busca ativa, portaria e comunicados da escola escolhida"
- 🚪 Portaria · "Só a tela de entrada com as carteirinhas da escola escolhida"
- Campos: **Rede usada no teste** (município) e **Escola (teste de gestor e professor)**.
- Durante a simulação aparece a faixa: "🧪 Modo de teste: você está vendo como <perfil> · <município>. O que você gravar é real." com botões **Trocar** e **Voltar a administrador**.
- Na simulação: gestor/secretaria escolar/portaria ficam com 1 escola; professor com até 5; secretaria sem escola. As regras do banco continuam tratando a conta como administrador.

### 2.2 Secretaria de Educação (`secretaria`)
Menu: 📊 **Painel da Rede** · 🏫 **Gestão Escolar** (`/gestao/`) · 📅 **Calendário Letivo** (`/apps/calendario/`) · 📋 **Central de Relatórios** (`/relatorios/`).
- Não tem "Início" no menu. O 1º item (Painel da Rede) abre sozinho.
- Se o plano do município inclui o Painel (`modulos_secretaria` contém "painel"), na 1ª vez da sessão vai direto para `/painel/`. Ao voltar, mostra cartão "Painel da Rede · Uso do Portal, aprendizagem (habilidades BNCC), calendário letivo e suporte técnico das escolas do município, em uma tela." com botões **Abrir o painel** e **Gestão Escolar**. Sem o painel no plano: selo **"🔒 Fora do plano do município"**.
- Vínculo: só o município (sem escolas).

### 2.3 Gestor da escola (`gestor`)
Menu: 🏠 **Início** · 📊 **Painel da Escola** · 🏫 **Gestão Escolar** · 📅 **Calendário Letivo** · 📋 **Central de Relatórios** · 👤 **Meu cadastro**.
- Painel da Escola: cartão "Professores ativos, aprendizagem (habilidades BNCC) comparada com a rede, dias letivos, equipamentos e chamados da sua escola, em uma tela." → **Abrir o painel** (`/painel/`) se o município tiver o painel no plano; senão "🔒 Fora do plano do município". Também redireciona direto na 1ª vez da sessão.
- Pode ter até **5 escolas** (regra do cadastro). Licença sempre institucional. Pode ter turmas marcadas se também dá aula.
- Convida a equipe de apoio (Secretaria escolar, Portaria): o convite em si está em `/gestao/` (confirmar com o agente da Gestão); aqui só existe o tratamento do pré-cadastro com `convidado_por`.

### 2.4 Professor (`professor`, licença institucional)
Menu: 🏠 **Início** · 📚 **Minhas Turmas** · 🤖 **Plano de Aula IA** · 📝 **Avaliacoes** · 🗂️ **Acervo** · 📁 **Meus trabalhos** · 👤 **Meu cadastro**.

### 2.5 Professor avulso / em teste / cortesia (menu `avulso`)
Menu: 🏠 **Início** · 🤖 **Plano de Aula IA** · 🗂️ **Acervo** · 📁 **Meus trabalhos** · 👤 **Meu cadastro** (sem Minhas Turmas e sem Avaliações).

### 2.6 Aluno (`aluno`)
Menu: só 🏠 **Início** (com os botões liberados para alunos). Sem Lousa, sem atalho de aula, sem mini-calendário.

### 2.7 Secretaria escolar (`secretaria_escolar`, equipe de apoio convidada pelo gestor)
Menu: 🏠 **Início** · 🏫 **Gestão Escolar** · 👤 **Meu cadastro**.
- "Início" (apoioInicio): na 1ª vez da sessão vai direto para `/gestao/`. Ao voltar mostra cartão "🏫 Secretaria escolar · Famílias e responsáveis, busca ativa, portaria, mural de chegada, auditoria e comunicados de <escola>." + botão **Abrir a Gestão Escolar**.
- Sem Lousa; tem mini-calendário. Fica em uma escola só.

### 2.8 Portaria (`portaria`)
Menu: 🏠 **Início** · 🚪 **Portaria (entrada)** (`/apps/frequencia/#portaria`) · 👤 **Meu cadastro**.
- "Início": na 1ª vez da sessão vai direto para a portaria. Ao voltar: cartão "🚪 Portaria da escola · Tela de leitura das carteirinhas e quem já entrou hoje em <escola>." + botão **Abrir a portaria**.
- Sem Lousa; tem mini-calendário. Uma escola só.

### 2.9 Elementos comuns da moldura
- Barra superior: botão ☰ (abre menu no celular), título da seção, selo com o nome do perfil.
- Faixa de aviso de licença (`#avisoLicenca`) logo abaixo da barra.
- **Mini-calendário** no menu lateral (todos menos admin e aluno): mês atual com dias letivos/sem aula/feriados/recesso; "Hoje: dia letivo/sem aula", período (bimestre etc.), "N dias letivos até dd/mm", "Próximo: dd/mm <evento>"; lembretes de hoje/amanhã ("📌 Hoje ..."), link **"＋ Minha agenda"**. Clicar no título abre `/apps/calendario/`; clicar num dia abre `/apps/calendario/?dia=AAAA-MM-DD`; "Minha agenda" abre `/apps/calendario/#agenda`. Sem calendário publicado: "A rede ainda não publicou o calendário letivo de <ano>." Toast ao entrar se houver lembrete hoje.
- **Lousa** (botão flutuante) e **atalho de aula** no menu: para professor, gestor, secretaria e admin (não para aluno, portaria e secretaria escolar). (detalhes na seção 3)
- Itens de menu ainda não implementados mostram: "Esta area esta pronta na estrutura e sera ativada nas proximas etapas."
- Registro de uso: cada acesso grava `acessos_dia` (alimenta os painéis) e "online agora" a cada 3 min.

---

## 3. INÍCIO E CATÁLOGO DE MÓDULOS

### 3.1 Catálogo mestre (`MODULOS`, ids fixos gravados no contrato)
| id | Nome visível | Aluno? | Descrição (professor) | Descrição (aluno) | Destino ao clicar |
|---|---|---|---|---|---|
| videos | Vídeos Educativos | sim | Conteúdos em vídeo para enriquecer suas aulas | Vídeos para aprender e revisar a matéria | tela interna Vídeos (`#videos`) |
| jogos | Jogos Educacionais | sim | Aprender brincando, com jogos para a turma | Aprenda jogando, no seu ritmo | tela interna Jogos (`#jogos`) |
| ia | Dicas de IA | não | IA a favor do professor, com o IA Studio (obs.: inclui o IA Studio) | - | tela interna Dicas de IA (`#ia`) |
| provas | Gerador de Provas | não | Monte avaliações prontas em poucos minutos | - | `/provas/` (`#provas`) |
| portal360 | Portal 360º VR | sim | Experiências imersivas em 3D e realidade virtual | Viaje pelo espaço, pelo corpo humano e muito mais em 3D | https://portal360.portaldoeducador.com.br/ |
| atividades | Atividades | não | Atividades prontas alinhadas à BNCC | - | tela interna Atividades (`#atividades`) |
| relatorios | Central de Relatórios | não | Registros, pareceres e acompanhamento | - | `/relatorios/` |
| datas | Datas Comemorativas | sim | Conteúdos para cada data do calendário | Curiosidades de cada data do calendário | tela interna Datas (`#datas`) |
| colorir | Desenhos para Colorir | sim | Desenhos temáticos para imprimir ou colorir na tela | Pinte na tela ou imprima seus desenhos | `/colorir/` |
| historias | Histórias Educativas | sim | Histórias que ensinam valores e conteúdos | Histórias para ler e aprender | `/biblioteca/#historias` |
| biblioteca | Biblioteca | sim | Livros e materiais para leitura e pesquisa | Livros para aprender brincando e gibis | `/biblioteca/` |
| formacao | Formação Continuada | não | Cursos com certificado para o professor | - | `/formacao/` |
| museus | Museus Virtuais | sim | Visitas a museus do Brasil e do mundo | Passeie por museus do Brasil e do mundo | `/museus/` |
| dicas | Dicas do Professor | não | Ideias e práticas para o dia a dia da sala | - | `/dicas/` |
| dicasaluno | Dica do Aluno | sim, **só aluno** | Compartilhe uma dica de estudo com a galera | - | `/dicas/` (admin: `/dicas/?aluno=1`) |
| apps | Aplicativos Úteis | não | Ferramentas digitais selecionadas | - | `/apps/` |
| gestao | Gestão Escolar | não | Frequência, notas, relatórios, recursos e chamados técnicos da escola | - | `/gestao/` (url padrão `#gestao`) |
| maestro | Portal Maestro | não | Conduza a turma nos dispositivos em tempo real (obs.: gestão da sala de aula) | - | https://sala.portaldoeducador.com.br/ |

Observação: o destino real de cada botão é a URL configurada em **Módulos do Portal** (config/modulos); se a URL for uma das rotas `#...`, abre a tela interna/página acima; se for `https://...` abre o link; se vazia usa a URL padrão. Cada botão tem foto padrão `/assets/cards/<id>.webp`. Cada clique registra uso ("Botões mais abertos" no Painel).
- Situação global de cada módulo (config/modulos): padrão **Em breve** até o admin mudar para **Liberado** (com link) ou **Oculto** (ver 4.13).
- Atenção: "Portal Maestro" e "Portal 360º VR" não estão na lista `ROTAS_MODULO`; vão por URL externa.

### 3.2 Tela Início (`renderInicio`) · professor, gestor, avulso, aluno, admin (prévia)
Estrutura de cima para baixo:
1. **Saudação**: "Olá, <primeiro nome>!" + local (município · escola(s)) ou "Bem-vindo ao Portal do Educador" / "Bem-vindo ao Portal do Aluno". Admin: "Prévia da tela inicial do professor/aluno · Assim o professor vê os botões. Os que estão “Em breve” você libera em Módulos do Portal." + abas **Professor** / **Aluno**.
2. **Faixa "Pronto para a aula?"** (não aparece para aluno; só se o Portal Maestro estiver liberado e no plano): "Abra a turma no Portal Maestro: os alunos entram com um código de 6 dígitos e você conduz as telas." Botões **Iniciar aula** (abre o Maestro) e **Abrir a Lousa**. Para admin com Maestro não liberado: "(prévia: o Maestro ainda não está liberado para os professores)". Quando a faixa aparece, o card do Maestro sai da grade. O mesmo atalho aparece no menu lateral como **Iniciar aula** logo abaixo de Início (não para admin).
3. **Minhas provas** (só aluno, ver 3.6).
4. **Faixa de Notícias** (ver 3.8).
5. **Faixa de Datas comemorativas** (ver 3.10).
6. **Grade de botões (cards)**: um card por módulo do catálogo. Regras (código):
   - Aluno vê só módulos com `aluno:true`; professor não vê os `soAluno` (Dica do Aluno).
   - Se o Gestão Escolar está "liberado", o card **Central de Relatórios** some do Início do professor (a central fica dentro da Gestão Escolar).
   - Status global "oculto": some para todos menos admin (admin vê selo "🔒 Oculto").
   - Card abre só se status = "liberado" e houver URL. Senão: selo **"🔒 Em breve"** (card travado, título "Em breve").
   - **Plano do município** (`modulos_professor` / `modulos_aluno`): só vale se a lista do município tiver ao menos 1 item. Módulo liberado mas fora do plano: selo **"🔒 Fora do plano"** (título "Não incluído no plano do seu município"). Exceção: Gestão Escolar conta como no plano se "relatorios" estiver no plano. Para o **aluno**, módulos fora do plano **nem aparecem**.
   - Admin consegue abrir qualquer card com URL, mesmo "Em breve".
   - Cada card: foto (ou ícone/logo), nome, descrição (versão aluno quando existir).
   - Vazio: "Nenhum módulo disponível ainda."

### 3.3 Módulos do Portal (admin)
Configuração global dos botões (Em breve / Liberado / Oculto, link e imagem): ver 4.13. Recorte por município: ver 4.1.

### 3.4 Vídeos Educativos (tela interna, `#videos`)
- Quem vê: professor, gestor, avulso (vídeos publicados e não marcados "só alunos" — campo `para_professores`), aluno (só vídeos `para_alunos`).
- Filtros: busca "Buscar por título, tema ou habilidade (ex: EF05CI11)"; **Todas as séries e idades** (grupos: Educação Infantil: Bebês (0 a 1 ano e 6 meses), Crianças bem pequenas (1 ano e 7 meses a 3 anos), Crianças pequenas (4 e 5 anos); Anos Iniciais 1º-5º ano; Anos Finais 6º-9º ano; Ensino Médio 1ª-3ª série EM); **Todos os componentes**.
- Atalhos "Minhas turmas: <anos das turmas do professor> · Todas".
- **Em destaque** no topo (admin marca): "⭐ Em destaque · <título> · faixa · componente · duração · Assistir e dar sua opinião →".
- Grade: capa do YouTube, duração, título, selos (faixa, componente, até 2 BNCC). "N vídeo(s)". Vazio: "Os vídeos estão sendo organizados. Volte em breve."
- Ao clicar: janela com player (YouTube sem cookies, autoplay), título, selos completos, descrição, "Canal: ...", reação **"O que achou do vídeo?"** com 4 carinhas (😍 Amei, 🙂 Gostei, 😐 Mais ou menos, 🙁 Não gostei; um voto por pessoa, pode trocar; "Obrigado! Sua reação:"), botões **Tela cheia (lousa)** e **Fechar**.

### 3.5 Jogos Educacionais (tela interna, `#jogos`)
- Quem vê: professor (jogos publicados e "para professores") e aluno (só "para alunos").
- Filtros: busca "Buscar por nome, tema ou habilidade (ex: EF01LP06)", **Todas as séries e idades**, **Todos os componentes**; atalhos "Minhas turmas: ...". Destaques aparecem primeiro.
- Cartão: capa (ou ícone), selo "★ Destaque", nome, descrição curta, selos (faixa, componente, BNCC). "N jogo(s)". Vazio: "Os jogos estão sendo organizados. Volte em breve."
- Ao clicar: o jogo abre em **tela inteira dentro do Portal** ("palco") com barra: nome, **Tela cheia**, **Abrir em nova aba**, **Fechar ✕** (Esc fecha). Jogos marcados "Abrir em nova aba" abrem direto em outra aba.
- Os jogos ficam hospedados em `jogos.portaldoeducador.com.br` (ou sites externos); o Portal guarda só o catálogo.

### 3.6 Prova online · card "Minhas provas" no Início do aluno
- Aparece só para o aluno, quando existe prova online destinada a ele (`provas_online` com o uid do aluno), não cancelada, e que fechou há menos de 7 dias. Até 4 cartões.
- Cada cartão: ✏️ (aberta) / 🔒 (futura) / 📊 (encerrada), título, disciplina e "abre <dia> às hh:mm" / "aberta até hh:mm" / "encerrada · ver nota"; botão **Fazer a prova** quando aberta. Abre `/prova/?id=...` (outra página).
- Liberação: recurso extra "Prova online" no Plano do município (ver 4.1); a prova é criada no Gerador de Provas (`/provas/`, fora deste arquivo).

### 3.7 Atividades (tela interna, `#atividades`) · Banco Curricular
- Quem vê: quem tem o card "Atividades" liberado (só professor no catálogo; `aluno:false`). Admin vê também as ocultas.
- Cabeçalho (hero): selo "Banco Curricular · alinhado à BNCC", título **"Atividades prontas para imprimir e aplicar"**, texto "N atividades organizadas por etapa, componente e ano. Toque para ver, imprimir ou baixar." (ou "As atividades estão sendo organizadas. Em breve aparecem aqui."), número total.
- Busca: "Buscar pelo título ou pelo código BNCC (ex.: EF03MA14)" + **Buscar** (Enter também). Código BNCC busca no acervo inteiro ("Habilidade XXX"); texto busca dentro do componente aberto (sem componente: aviso "Escolha um componente para buscar pelo título, ou digite um código BNCC (ex.: EF03MA14).").
- Botão **⭐ Minhas favoritas** (favoritas ficam guardadas neste navegador; vazio: "Você ainda não marcou favoritas. Abra uma atividade e toque na estrela.").
- Admin: **➕ Adicionar atividade** e **🔄 Buscar novidades no Drive**.
- **Etapas** (botões com contagem): 🍼 Educação Infantil (Creche e pré-escola) · 🔤 Alfabetização (Ciclo de alfabetização) · 📘 Anos Iniciais (1º ao 5º ano) · 🎓 Anos Finais (6º ao 9º ano) · 🏫 Ensino Médio (1ª a 3ª série) · 🤝 Educação Inclusiva (Adaptadas para cada necessidade). Etapa sem atividades não aparece (só admin vê). Começa pela etapa com mais atividades.
- Passo 2: "<etapa> escolha o componente": cartões de componente (ícone, nome, "N atividades", anos disponíveis). Vazio: "Ainda não há atividades nesta etapa."
- Passo 3 (lista do componente): trilha "← <etapa> › <componente>"; abas **📝 Atividades** / **📋 Planos de aula** (se houver planos); filtro **Ano** (Todos, anos, "Sem ano"); filtro **Tipo** (categorias: Atividade, Fixação, Avaliação, Revisão, Diagnóstica, Exercícios, Desafio, Jogo, Leitura, Interpretação, Produção de texto, Projeto, Sequência didática, Simulado, Recuperação, Plano de aula); "N atividades"; grade com miniatura da 1ª página, selo de categoria, ⭐ se favorita, "oculta" (admin); **Mostrar mais (N)** (36 por vez, +48).
- Abrir atividade: visualizador (PDF ou imagem) + painel lateral com etapa · componente, título, etiquetas (anos, tipo, BNCC), botões **🖨️ Abrir para imprimir** (nova aba) e **☆ Favoritar / ⭐ Favorita**, reação "Gostou desta atividade?" (4 carinhas), fechar ✕ (ou Esc).
- **Admin dentro da atividade**: campos Título, Ano(s) (vírgula), Tipo, BNCC (vírgula) → **Salvar**, **Publicar/Ocultar** ("Oculta para os professores."), **Excluir** ("Confirmar exclusão"; "Atividade excluída. Ela não volta na sincronização com o Drive."). Mostra origem ("Veio do Drive: caminho" ou "Enviada pelo painel").
- **Admin · ➕ Nova atividade**: "PDF ou imagem. A miniatura sai da primeira página. Dá para mandar vários arquivos com as mesmas etiquetas: o título de cada um vem do nome do arquivo e você ajusta depois." Campos: Etapa, Componente (com sugestões), Ano(s) (vírgula; vazio = todos), Tipo, Título (só quando for um arquivo), BNCC (vírgula; o código no nome do arquivo também vale), Arquivos (PDF, PNG ou JPG, até 60 MB cada) → **Publicar** / **Fechar**. Progresso "Enviando 1 de N...". Toast "N atividade(s) publicada(s)."
- **Admin · 🔄 Buscar novidades no Drive**: roda a sincronização em rodadas de 40 ("Lendo o Drive · N novas..."); toast "N atividade(s) nova(s) trazida(s) do Drive" ou "Nenhuma novidade no Drive." (Pasta do Drive configurada no servidor; confirmar com agente técnico.)

### 3.8 Notícias / Mural (faixa no Início + página)
- **Tipos** (`NT_TIPOS`): 📰 Notícia · 🎙️ Podcast · 📣 Ação · 🆕 Novidade no Portal · 📊 Pesquisa rápida.
- **Quem vê** (`noticiaVisivel`): só publicadas; dentro do período (início/fim); público **Professores e equipe** e/ou **Alunos**; lista de municípios (vazia = todos; admin vê tudo).
- **Faixa no Início**: mostra até 6, uma por vez, alternando a cada 8 segundos; fixadas primeiro, depois as mais recentes. Elementos: imagem (ou ícone do tipo), selo do tipo (+ "· em destaque" se fixada), título, chamada curta, bolinhas para trocar, botão **Ler mais** (ou **Responder** na pesquisa) e link **Todas**.
- **Página Notícias** (link "Todas"): grade de cartões (imagem, tipo, título, chamada, data). Vazio: "Nenhuma notícia no momento."
- **Matéria**: "← Todas as notícias"; imagem de capa; tipo; título; data por extenso; player embutido se o link for YouTube ou Spotify (outro link vira botão **Abrir o conteúdo ↗**); texto com parágrafos e links clicáveis; reação **"O que achou?"** (4 carinhas).
- **Pesquisa rápida**: o título é a pergunta; 2 a 5 opções em botões; "Uma resposta por pessoa." + aviso "Resposta identificada: a NEWPC vê seu nome e sua escola." ou "Resposta anônima: aparecem só os totais." Depois de responder: "✅ Obrigado! Você respondeu: <opção>" e toast "Resposta registrada. Obrigado!". Erro: "Esta pesquisa já foi respondida ou saiu do ar." Admin vê o **Resultado** (N respostas · identificada/anônima, barras com % ) e, se identificada, **Baixar respostas (planilha)** (CSV com Nome, Escola, Município, Perfil, Resposta, Data).
- **Pop-up ao entrar**: notícias marcadas "🔔 Abrir em pop-up ao entrar" aparecem numa janela quando a pessoa chega ao Início; no máximo **um pop-up por entrada (sessão)**; some para a pessoa quando ela responde ou fecha (lembrado no navegador). Pesquisas já respondidas não abrem. Botões: **Ler a matéria** (ou **Ouvir agora** para podcast) e **Fechar**; na pesquisa, as opções na própria janela e **Agora não** (fecha sozinho 1,6 s após responder).

### 3.9 Dicas de IA · IA Studio (tela interna, `#ia`; título da barra "Dicas de IA · IA Studio")
- Quem vê: professor (módulo `ia`, não aparece para aluno).
- Busca "O que você quer preparar? (ex: prova, cartaz, alfabetização)"; abas por grupo: **Todas** · Planejar e organizar · Atividades e avaliações · Alfabetizar e trabalhar textos · Ensinar por disciplina · Jogos, descobertas e tecnologia · Temas do cotidiano · Imagens e comunicação.
- Seção **Em destaque** (sem filtro) e depois uma seção por grupo; cartão com capa, nome e descrição. Vazio: "As aplicações estão sendo organizadas. Volte em breve."
- Ao clicar: a aplicação abre no mesmo "palco" de tela inteira dos jogos (Tela cheia / Abrir em nova aba / Fechar ✕). As aplicações ficam em `studio.portaldoeducador.com.br/<pasta>/`.
- Rodapé: "Você ensina. A IA prepara. Revise conteúdo, adequação à turma e acessibilidade antes de aplicar."
- Catálogo do código (46 aplicações, `IA_STUDIO`): Planejamento de Aulas; Kit de Materiais da Aula; Slides para Aulas e Reuniões (gera no Gamma); Projetos Escolares; Banco de Atividades; Atividades para Imprimir; Provas e Avaliações; Avaliação Diagnóstica; Preparação para o SAEB; Revisão para o ENEM; Alfabetização: Leitura e Escrita; Fichas de Alfabetização (28 tipos); Interpretação de Texto; Histórias, Poemas e Teatro; Quadrinhos para Completar; Atividades de Português / Matemática / Ciências / História / Geografia / Biologia / Física / Química / Inglês / Espanhol / Arte / Educação Física; Música e Brincadeiras Musicais; Jogos e Brincadeiras para a Aula; Animais: Fichas e Painéis; Fósseis e Vida Pré-histórica; Como as Coisas Funcionam; Feira de Ciências; Computação e Programação; Robótica na Escola; Informática e Celular para Iniciantes; Educação Ambiental; Educação para o Trânsito; Educação Financeira; Saúde e Bem-estar; Imagens Didáticas; Mapas Mentais e Resumos; Imagens por Tema; Cartazes para a Escola; Cartazes e Comunicados; Rotina e Combinados. (Quais estão publicadas depende do banco.)

### 3.10 Datas Comemorativas · faixa no Início
- "📅 **Próximas datas**" + link **Ver o calendário de datas**. Até 4 datas publicadas dentro da antecedência de cada uma (padrão 21 dias). Cada uma: dia + mês abreviado, nome, "Acontecendo agora / Hoje / Amanhã / Em N dias" · "kit com N conteúdos".
- Datas **nacionais** para todos; **estaduais** só para quem é daquele estado (UF do município); admin vê todas.
- Regras de data: dia fixo ("7 de setembro"), ligada à Páscoa ("N dias antes/depois da Páscoa", "Domingo de Páscoa") ou n-ésimo dia da semana ("2º domingo de maio", "último ... de ..."); pode durar vários dias ("(N dias)").
- Temas: 🏛️ História e cidadania · 🤝 Convivência e direitos · 🌈 Diversidade e inclusão · 🌳 Meio ambiente · 🎭 Cultura · 📚 Leitura e escrita · 🍎 Saúde · 👪 Família · 🔬 Ciências.
- Kit da data (referências a conteúdos já existentes): 📝 Atividades prontas · 📄 Arquivos · 🎬 Vídeos · 🎮 Jogos · 📚 Histórias e livros · 🖍️ Para colorir.

### 3.11 Datas Comemorativas · página (tela interna, `#datas`, ou "Ver o calendário de datas")
- Quem vê: professor e aluno (módulo `datas`, `aluno:true`).
- Filtros: busca "Buscar data (ex.: árvore, bandeira, livro)", **Todos os temas** (lista de temas), nível **Nacionais e do estado** / **Só nacionais** / **Só do estado**.
- Seção **"Nas próximas semanas"** (datas em até 45 dias, quando não há busca/tema) e depois o ano inteiro **mês a mês** ("Outubro de 2026"...). Cartão: dia/mês, tema (e UF se estadual; "rascunho" para admin), nome, "Em N dias · N conteúdos no kit" ou "kit em preparação".
- Botão no rodapé **📂 Arquivos antigos de datas comemorativas** → abre o Acervo filtrado no botão "datas".
- **Página da data**: "← Todas as datas"; cabeçalho com dia, tema · "Data nacional" / "Data estadual (UF)", nome, "dia de mês · dia da semana (até ...) · Em N dias", lei/origem. Professor vê o texto "o que trabalhar e como"; caixa **💡 Para conversar com a turma** (professor) ou **💡 Você sabia?** (aluno) com a curiosidade. **🧰 Kit da data** agrupado (Atividades prontas, Arquivos, Vídeos, Jogos, Histórias e livros, Para colorir); cada item abre no lugar certo (atividade no visualizador, vídeo no player, jogo no player, arquivo do acervo, livro em `/biblioteca/?abrir=...`, desenho em `/colorir/?abrir=...`). Vazio: "🧰 O kit desta data está em preparação. Os conteúdos aparecem aqui assim que forem publicados." Conteúdo que a pessoa não pode abrir simplesmente não aparece.
- **Admin na página da data**: cartão **"Montar o kit (só o administrador vê)"**: chips dos itens no kit com ✕ (tirar); seletor de catálogo (Atividades prontas, Arquivos, Vídeos, Jogos, Histórias e livros, Para colorir) + busca "Buscar no catálogo pelo título" → lista (até 40) com **+ Adicionar** ou "no kit"; botão **Editar texto e data**.

---

## 4. TELAS DE ADMINISTRAÇÃO

### 4.1 Municipios (admin)
- Barra: contador "N municipio(s) cadastrado(s)" + botão **+ Novo Municipio**.
- Tabela: **Logo · Municipio · UF · Status · Módulos liberados · Contrato · [Plano e módulos]**.
  - Logo: botão **Enviar** / **Trocar** (brasão/logo da prefeitura; imagem é redimensionada para 400x400 e vai no cabeçalho das provas; toast "Logo salvo. Já aparece nas provas.").
  - Status: piloto / ativo / inativo (pílula).
  - Módulos liberados: "N p/ professor · N p/ aluno" ou "Nenhum ainda".
  - Contrato: nº (ou "sem nº"), "até dd/mm/aaaa", pílula "vencido".
- Modal **Novo Municipio** ("Cadastre um novo cliente da plataforma."): **Nome do municipio**, **Estado (UF)** (padrão MS) → **Salvar municipio**. Nasce com status "piloto".
- Modal **Plano e módulos** (botão por linha):
  - **Nº do contrato / ata** (ex.: 045/2026), **Vigência até** (data).
  - **Situação do município**: Piloto / Ativo (contrato vigente) / Inativo.
  - **Domínios de e-mail dos alunos** (ex.: aluno.ribasdoriopardo.ms.gov.br): "Quem entrar com uma conta Google desses domínios vira aluno deste município. Use só domínios exclusivos de alunos; separe vários com vírgula. Rede sem domínio próprio: importe a lista em Importar cadastros › Alunos."
  - **O que fica liberado** (contador) com atalhos **Liberar tudo**, **Limpar**, **Aluno igual ao professor**; tabela **Módulo · Professor · Aluno** (caixas por módulo do catálogo → `modulos_professor` e `modulos_aluno`).
  - Tabela **Secretaria de Educação**: "Painel da Rede · indicadores de uso, aprendizagem BNCC, calendário letivo, suporte técnico e relatório executivo em PDF" (caixa → `modulos_secretaria: ["painel"]`).
  - Tabela **Recursos extras**: "Prova online · no Gerador de Provas: o professor aplica a prova no Portal do Aluno, com horário, modo protegido e correção automática" (caixa → recurso `prova_online`).
  - Aviso: "A liberação vale para todos os professores e alunos aprovados deste município. Os módulos marcados só para professor não aparecem no Portal do Aluno."
  - Botões **Cancelar** / **Salvar plano**.
  - Licença institucional: a vigência do contrato do município define a validade da licença dos usuários (comentário no código).

### 4.2 Escolas (admin)
- Contador "N escola(s) cadastrada(s)" + **+ Nova Escola**.
- Tabela **Logo · Escola · Municipio · Status · [Dados da escola]**. Sob o nome: "Dados incompletos para os documentos" (falta INEP, endereço, telefone ou diretor) ou "INEP xxx · Diretor".
- Logo da escola: opcional; "se não houver, usa o do município".
- Modal **Nova Escola / Dados da escola** ("Os dados abaixo saem no cabeçalho dos relatórios, declarações e provas."): Nome da escola, Municipio, Código INEP (8 dígitos, validado), Telefone, Endereço, CEP, E-mail, Diretor(a), Coordenador(a) pedagógico(a), Ato de autorização / criação (opcional) → **Salvar escola** / **Salvar dados**.

### 4.3 Turmas (admin)
- **+ Nova Turma**; tabela Turma · Escola · Turno · Ano letivo.
- Modal: Nome da turma, Escola, Ano / Serie (1 a 9), Turno (Matutino, Vespertino, Integral, Noturno), Ano letivo → **Salvar turma**. Município herdado da escola.

### 4.4 Alunos (admin, cadastro simples)
- **+ Novo Aluno**; tabela Aluno · Matricula · Turma · Escola.
- Modal: Nome do aluno, Turma, Matricula (opcional; "Deixe em branco para gerar automatico", gera `ANO-xxxxx`) → **Salvar aluno**.
- Obs.: esta coleção `alunos` é a lista de alunos das turmas (chamada/avaliações); a conta de login do aluno é outra coisa (`usuarios` perfil aluno, via domínio ou importação).

### 4.5 Avaliacoes (admin e professor)
- Contador + **+ Nova Avaliacao**. Professor só vê as próprias.
- Tabela: Avaliacao (disciplina · nº questões · pts) · Turma · Questoes · Codigo · Status · Acao.
- Status: **rascunho** → botão **Liberar** (gera código de acesso curto: 3 letras da disciplina + 2 da turma + 2 dígitos; toast "Avaliacao liberada! Codigo: XXX"); **liberada** → **Resultados** e **Encerrar**; **encerrada** → **Resultados**.
- Modal **Nova Avaliacao** ("Monte a prova com questoes. Salva como rascunho."): Titulo, Turma, Disciplina, Bimestre (1º a 4º), Total de pontos (automático); botões **+ Questao de multipla escolha** (4 alternativas A-D, marcar "correta", pontos) e **+ Questao dissertativa**; "remover" em cada questão → **Salvar rascunho**. Validações: enunciado, todas as alternativas, alternativa correta.
- **Resultados**: "← Voltar para avaliacoes"; resumo (disciplina, turma, pontos, código); lista "N aluno(s) responderam" com "Objetivas: x" e "Nota final" ou "Aguardando correcao"; para dissertativas pendentes: resposta do aluno + campo de nota "de N ponto(s)" + **Salvar correcao** (soma com objetivas; toast "Correcao salva! Nota final: x").
- (confirmar) Onde o aluno responde com o código: não está neste arquivo (provavelmente outra página).

### 4.6 Painel (admin) · abas
Abas: **Pessoas e uso** · **Conteúdo e participação** · **Infraestrutura e custos** · **💾 Backup**. Topo: "Atualizado às hh:mm · últimos 30 dias", caixa **Incluir Rede Modelo** (rede fictícia "Rede Modelo NEWPC", fora dos números por padrão) e botão **Atualizar**.
- **Pessoas e uso**: cartões Professores cadastrados (+hoje), Testes iniciados hoje (7 dias), Online agora (5 min), Acessaram hoje; Institucionais ativos, Assinantes avulsos, Em teste grátis, Conversão do teste, Vencendo em 30 dias (já vencidas), Aguardando aprovação; Alunos com conta, Alunos que acessaram hoje. Gráficos: Novos cadastros por dia (Teste grátis x Rede), Pessoas que acessaram por dia, Professores por estado, Botões mais abertos, Arquivos do acervo mais abertos, Últimos cadastros (Professor, Situação, Origem: Teste grátis/Importação/Rede, Local, Quando).
- **Conteúdo e participação**: Rede atendida (Municípios, Escolas, Turmas, Professores e "aguardando 1º acesso", Alunos, Cursistas da Formação); Conteúdo publicado (Vídeos e "liberados para alunos", Jogos, Desenhos para colorir, Biblioteca e "na triagem", Cursos da Formação, Acervo (R2)); Participação (Certificados emitidos, Relatórios, Avaliações criadas/respostas, Aulas no Maestro, Dicas do Professor publicadas, Dicas do Aluno publicadas); **Pendências** com links "Abrir" (dicas de professor `/dicas/#recebidas`, dicas de aluno `/dicas/?aluno=1#recebidas`, relatórios `/relatorios/`, triagem da Biblioteca `/biblioteca/#triagem`) ou "Nada pendente. 👏".
- **Infraestrutura e custos**: Firestore (leituras, gravações, exclusões: pico/dia e % da cota grátis; tamanho do banco), Storage, funções e erros, Cloudflare R2 ("Ainda não ativado"), atalhos para consoles (Firebase uso/faturamento, Google Cloud, Firestore, Storage, Funções, Cloudflare). Uso interno NEWPC.
- **💾 Backup**: "Fazer backup agora" (opção "Só o banco" ou "Completo: banco + arquivos"), botões **💾 Fazer backup agora** (vai para pasta do Google Drive) e **⬇️ Baixar no computador** (link válido 7 dias); "Onde guardar" (3 passos: Drive compartilhado, adicionar o robô como Gerente de conteúdo, colar link) + caixa "Também toda semana, automático (domingo de madrugada)" + **Salvar e testar**; "Últimos backups" (Quando, Tipo, Por, Situação, Documentos, Tamanho, Abrir no Drive/Baixar). Restauração só via suporte técnico. Backup não leva senhas nem fotos da portaria (somem em 15 dias).

### 4.7 Usuarios (admin)
- Topo: abas com contadores, busca "Buscar por nome ou e-mail", caixa "Incluir Rede Modelo".
- Abas (nomes exatos): **Aguardando aprovação** · **Institucionais** · **Avulsos e teste** · **Vencendo / vencidas** · **Desativados** · **Gestão e equipe** (gestor, secretaria, secretaria escolar, portaria) · **Todos** · **Pré-cadastrados** · **Alunos**. Aguardando e Vencendo ficam destacadas quando têm itens. O item de menu "Usuarios" mostra um contador laranja de aguardando.
- Situações (pílulas): Em análise · Sem vínculo · Institucional · Em teste · Avulso · Expirada · Desativado.
- Tabela: **Usuário** (nome, e-mail, perfil) · **Situação** · **Vínculo** (município · N escola(s), N turma(s); "Município inteiro" para secretaria; "Acesso total (administrador)"; para avulso: escola/município informados + "Até dd/mm · plano" + etiqueta "Município atendido: X") · **Cadastro** (data) · **Ações**: **Aprovar e vincular** (pendente/sem vínculo) ou **Gerenciar**; **Recusar** (pendente; pede "Confirmar recusa").
- **Pré-cadastrados**: Professor · "Aguardando 1º acesso" · Vínculo · **Remover** (Confirmar). Vazio: "Nenhum pré-cadastro pendente. Use “Importar cadastros” para trazer a planilha de professores."
- **Alunos** (carrega até 2.000): "N aluno(s) com conta · N na lista aguardando o 1º acesso." Tabela Aluno · Situação (Ativo/Desativado + origem "E-mail da escola" ou "Lista importada") · Município e escola · Último acesso · **Desativar** / **Reativar**; pré-cadastros de aluno com **Remover**. Vazio: "Nenhum aluno ainda. Cadastre o domínio de e-mail dos alunos no plano do município (Municipios) ou importe a lista em Importar cadastros › Alunos."
- **Modal Gerenciar cadastro / Aprovar e vincular**:
  - **Situação do cadastro**: Aprovado · Em análise · Recusado / desativado.
  - **Perfil**: Professor · Gestor da escola (diretor ou coordenador) · Secretaria de Educação · Administrador (equipe NEWPC). **Município**.
  - **Licença**: Tipo (Institucional (contrato do município) · Avulsa (venda direta) · Teste grátis · Cortesia); Plano (Mensal, Semestral, Anual, Pacote por escola, Personalizado, Teste grátis); Início; Válida até (calculada pelo plano: mensal 1 mês, semestral 6, anual 12, pacote 12, teste 7 dias); Valor (R$); Ref. do pagamento; Escola / cliente do pacote (só plano pacote). Mostra "Informado no cadastro: ..." e a dica "Município atendido pela NEWPC: para vincular à rede, mude o tipo para Institucional."
  - Gestor e secretaria: sempre institucional (tipo travado).
  - **Escolas onde ministra aulas** / "Escolas que ele(a) gere (até 5)" e **Turmas** (agrupadas por escola).
  - Avisos dinâmicos (textos exatos úteis ao manual):
    - Secretaria: "Secretaria de Educação de X: vê todas as escolas do município, o Painel da Rede (se estiver no plano), o calendário letivo, os relatórios e os chamados técnicos da rede. Não vê turmas nem notas individuais."
    - Gestor: "Gestor de N escola(s): vê as turmas, professores, avaliações e relatórios da escola, ajusta o calendário da escola, cuida dos equipamentos e chamados e das TVs. Se também dá aula, marque as turmas abaixo."
    - Avulso: "Licença ... até dd/mm. O professor vê os botões liberados do Portal; turmas e alunos da rede ficam fora."
    - Professor institucional: "Ao salvar, o professor passa a ver N turma(s) em N escola(s). Ele só precisa entrar de novo ou tocar em “Verificar novamente”."
    - Admin: "Administrador vê e altera todos os municípios, escolas, alunos e cadastros. Use só para a equipe NEWPC."
    - Desativar: "O usuário perde o acesso ao Portal na próxima vez que abrir uma tela. Os vínculos ficam guardados, caso você reative depois."
    - Próprio cadastro: perfil e situação travados.
  - Botão **Aprovar e salvar** (quando aprova) ou **Salvar**. Validações: professor institucional precisa município + 1 escola; avulso precisa data fim; gestor município + escolas (máx. 5); secretaria município.

### 4.8 Datas Comemorativas (admin) · menu "Datas Comemorativas"
- Cartão **Nova data / Editar data**: "A data aparece no Início para professores e alunos dentro da antecedência escolhida, e na página Datas Comemorativas o ano todo. O kit você monta abrindo a data."
- Campos: **Nome da data** · **Tema** · **Nível** (Nacional (todos) / Estadual (só um estado)) · **Estado** (só estadual, sigla) · **Como a data cai**: "Todo ano no mesmo dia" (Dia, Mês) / "Um dia da semana do mês (ex.: 2º domingo de maio)" (Qual: 1º-4º/último, Dia da semana, Mês) / "Ligada à Páscoa (ex.: Carnaval)" (Dias em relação à Páscoa; negativo = antes; Carnaval = -47) · **Duração em dias** (semanas temáticas, 1-31) · **Aparece no Início quantos dias antes** (1-60, padrão 21) · **Texto para o professor** (o que trabalhar e como, 600 caracteres) · **Curiosidade** (o aluno vê como "Você sabia?") · **Lei ou origem** (opcional, ex.: Lei 14.759/2023) · caixa **Publicada**.
- Botões **Salvar data** / **Salvar alterações** e **Limpar** / **Cancelar edição**. Erros: "Escreva o nome da data.", "Informe a sigla do estado (ex.: MS).", "Dia inválido para esse mês.", "Já existe uma data com esse nome."
- Cartão **Datas cadastradas**: botões **Importar catálogo base (nacionais e MS)** (traz as datas que faltam do arquivo `/entrar/datas-base.js`; "N datas importadas." ou "O catálogo base já estava completo.") e **Ver como o professor vê**. Resumo "N datas · N com kit montado". Cada linha: nome, regra, nacional/estadual UF, quando/rascunho, "N no kit"/"kit vazio" + **Abrir e montar kit**, **Editar**, **Ocultar/Publicar**, **Excluir** (Confirmar).

### 4.9 Notícias (admin) · menu "Notícias"
- Cartão **Nova notícia / Editar notícia**: "Aparece numa faixa no Início (uma por vez, alternando) e completa na página Notícias. Use para podcast, ações da NEWPC e novidades do Portal."
- Campos: **Tipo** · **Título** (na pesquisa, é a pergunta) · **Chamada curta (aparece na faixa do Início)** (opcional na pesquisa) · [Pesquisa] **Opções de resposta (de 2 a 5)** + caixa "Resposta identificada (vejo nome e escola de quem respondeu). Sem marcar, é anônima." (travadas depois da 1ª resposta: "Já tem N resposta(s): opções e identificação ficaram travadas para não misturar o resultado.") · **Matéria completa** (linha em branco entre parágrafos) · **Link do podcast ou vídeo** (Spotify ou YouTube viram player; deve começar com https://) · **Imagem** (opcional, vira capa; redimensionada a 1200 px) · **Quem vê**: Professores e equipe / Alunos · **Período** (início e fim; sem fim fica até tirar) · **Municípios** (nenhum marcado = todos) · caixas **⭐ Fixar no topo**, **Publicar (sai do rascunho)**, **🔔 Abrir em pop-up ao entrar**.
- Botões **Salvar notícia** / **Salvar alterações** e **Limpar** / **Cancelar edição**. Toasts: "Notícia publicada.", "Pesquisa publicada.", "Salva como rascunho."
- Lista **Notícias publicadas e rascunhos**: situação (Rascunho / Encerrada / Agendada / No ar), público, municípios, data, "🔔 pop-up", reações ou "📊 N resposta(s) · identificada/anônima"; botões **Ver**, **Editar**, **Fixar/Desafixar**, **Publicar/Tirar do ar**, **Excluir** (Confirmar).
- Comentário no código: futuramente a Secretaria de cada rede publicará só para a rede dela (ainda não implementado aqui).

### 4.10 Vídeos (admin) · menu "Vídeos"
- Cartão **Cadastrar vídeo / Editar vídeo**: "Cole o link do YouTube: a capa e o título vêm sozinhos. Depois indique para qual série ou faixa de idade o vídeo serve. Pode salvar como rascunho e publicar quando terminar de revisar."
- Prévia da capa ("A capa aparece aqui") + link "Assistir no YouTube para conferir antes de classificar".
- Campos: **Link do YouTube** + **Buscar** (preenche título e canal; avisos: "Link do YouTube não reconhecido.", "Este vídeo já está cadastrado: ...", "Atenção: o dono deste vídeo não permite exibir fora do YouTube.") · **Título (como o professor vai ver)** · **Serve a partir de** / **Até** (faixas; prévia "O professor verá: 3º ao 5º ano") · **Componente** · **Duração** (mm:ss, ex. 6:30) · **Tema** · **Canal / créditos** · **Habilidades BNCC** (opcional, vírgula; validação de formato) · **Sugestão de uso em aula** (opcional) · **Quem pode ver**: Professores / Alunos · **Publicar (sai do rascunho)**.
- Botões **Salvar vídeo** / **Salvar alterações**, **Limpar** / **Cancelar edição**. Se colar o link de outro vídeo durante a edição, vira cadastro novo (aviso).
- Lista **Vídeos cadastrados**: "N vídeo(s) · N publicado(s) · N rascunho(s)"; filtros **Todos**, **⭐ Em destaque**, **Publicados**, **Rascunhos**, **Para professores**, **Para alunos**; busca "Buscar por título, tema, canal ou BNCC". Tabela Vídeo · Faixa · Componente · Para · Reações · Situação (Publicado/Rascunho, ⭐ Destaque) · **Ver**, **Editar**, **⭐ Destacar / Tirar destaque** (só publicado; "Em destaque no topo de Vídeos."), **Publicar/Ocultar**, **Excluir** ("Vídeo excluído do catálogo (continua no YouTube).").

### 4.11 Jogos (admin) · menu "Jogos"
- Cartão **Cadastrar jogo / Editar jogo**: "Informe o link do jogo (os nossos ficam em jogos.portaldoeducador.com.br). Indique a série ou idade, o componente e, se quiser, a BNCC. Salve como rascunho e publique quando revisar."
- Campos: **Link do jogo** · **Nome do jogo** · **Descrição curta** (aparece no card) · **Serve a partir de** / **Até** (prévia "O professor verá: ...") · **Componente** · **Tema** · **Capa** (link ou **Enviar imagem**, recortada 16:10 800x500; até 15 MB; "Capa enviada. Salve o jogo para gravar.") · **Ícone** (emoji) · **Habilidades BNCC** · **Quem pode ver**: Professores / Alunos · **Opções**: Destaque (aparece primeiro) / Abrir em nova aba · **Publicar (sai do rascunho)**.
- Botões **Salvar jogo** / **Salvar alterações**, **Limpar** / **Cancelar edição**.
- Lista **Jogos cadastrados**: "N jogo(s) · N publicado(s) · N rascunho(s)"; aviso "N jogo(s) do nosso site de jogos ainda não estão no catálogo." + botão **Trazer como rascunho** ("Eles entram com nome, série e componente sugeridos, sem publicar. Você revisa um a um e publica." · lista de 38 jogos sugeridos no código); filtros **Todos**, **Publicados**, **Rascunhos**, **Destaques**, **Externos**; busca "Buscar por nome, tema ou BNCC". Tabela Jogo (Portal/Externo, BNCC) · Faixa · Componente · Situação · **Jogar**, **Editar**, **Publicar/Ocultar**, **Excluir** ("Jogo tirado do catálogo (o jogo continua no site).").

### 4.12 Dicas de IA (admin) · menu "Dicas de IA"
- Cartão **Cadastrar aplicação / Editar aplicação**: "As aplicações do IA Studio ficam em studio.portaldoeducador.com.br. Aqui você organiza o que o professor vê: nome, descrição, grupo, capa e destaque." Campos: **Link da aplicação**, **Nome**, **Descrição curta**, **Grupo**, **Ordem**, **Capa** (link da imagem), **Destaque**, **Publicar** → **Salvar aplicação** / **Salvar alterações**, **Limpar** / **Cancelar edição**.
- Lista **Aplicações cadastradas**: "N aplicação(ões) · N publicada(s)"; aviso "N aplicação(ões) do IA Studio ainda não estão no catálogo." + **Trazer e publicar** ("Entram com nome, descrição, grupo e capa do IA Studio. Depois você pode ocultar ou editar qualquer uma."); busca; tabela Aplicação · Grupo · Situação (Publicada/Oculta) · **Abrir**, **Editar**, **Publicar/Ocultar**, **Excluir** ("Tirada do catálogo (continua no IA Studio).").

### 4.13 Módulos do Portal (admin) · menu "Módulos do Portal"
- Topo: "N de 18 botões liberados" + **Salvar alterações**.
- Aviso (texto exato útil): "Cada botão aparece para os professores como **Em breve** (com cadeado) até você mudar para **Liberado** e informar o link. **Oculto** tira o botão da tela. O link e a imagem podem ser os mesmos usados hoje no site. Para abrir os arquivos do **Acervo** daquele botão dentro do Portal, use o link **#acervo**. Para os catálogos do Portal use **#datas** (Datas Comemorativas), **#videos** (Vídeos), **#jogos** (Jogos) e **#ia** (Dicas de IA / IA Studio). O **Gerador de Provas** integrado ao cadastro do professor usa **#provas** e a **Central de Relatórios** usa **#relatorios**."
- Tabela: **Botão** · **Situação** (Em breve / Liberado / Oculto) · **Link** (https://... ou #acervo, #videos, #jogos, #ia, #provas, #relatorios; aceitos também #formacao, #museus, #dicas, #colorir, #biblioteca, #historias, #datas, #atividades, #apps, #gestao, #dicasaluno e caminhos /assets/...) · **Imagem do card** (URL, opcional; padrão `/assets/cards/<id>.webp`).
- Validação: link/imagem precisam começar com https:// (ou ser rota aceita); para "Liberado" é obrigatório informar link. Toast "Módulos atualizados."
- Esta configuração é **global** (vale para todos os municípios); o recorte por município é feito no **Plano e módulos** (4.1).
- Detalhes do Plano (código `salvarPlano`): domínios inválidos são recusados; e-mails pessoais (gmail.com, hotmail.com, outlook.com, yahoo.com(.br), live.com, icloud.com, bol.com.br, uol.com.br) **não podem** ser domínio de aluno; um domínio não pode pertencer a dois municípios ("X já é domínio de aluno de Y."). No modal, módulos exclusivos do professor ficam com a caixa de Aluno desabilitada ("Exclusivo do professor"). "Liberar tudo" marca também Painel da Rede e Prova online; "Limpar" desmarca tudo; "Aluno igual ao professor" copia para aluno os módulos de professor que aceitam aluno. Toast "Plano salvo."

### 4.14 Acervo (admin) · menu "Acervo"
- Cartão **Serviço do acervo**: "Endereço do Worker da Cloudflare que confere a licença e entrega os arquivos (termina em .workers.dev)." Campo + **Testar** ("Funcionando: o serviço respondeu e reconheceu seu login." / "O serviço respondeu, mas recusou o login (...)" / "Não consegui falar com o serviço. ...") e **Salvar**. Uso técnico NEWPC.
- Cartão **Adicionar arquivos**: "Escolha o botão e as etiquetas que valem para todos os arquivos deste envio. Depois ajuste o título de cada um. Até 100 MB por arquivo." Campos: **Botão do Portal** (Atividades, Desenhos para Colorir, Biblioteca, Datas Comemorativas, Histórias Educativas, Dicas do Professor, Gerador de Provas, Central de Relatórios, Formação Continuada, Aplicativos Úteis), **Disciplina** (ou "Não se aplica"), **Etapas** (caixas), **Habilidades BNCC** (opcional), botão **Escolher arquivos** (PDF, imagens, áudio, Word, PowerPoint, Excel). Fila com título editável, tamanho, ✕ / % / "Enviado" + botões **Enviar N arquivo(s)** e **Limpar lista**.
- Cartão **Arquivos no acervo**: busca; tabela Arquivo · Botão · Etiquetas · Situação (Publicado/Oculto) · **Ocultar/Publicar**, **Excluir** (Confirmar; apaga também do armazenamento).

### 4.15 Importar cadastros (admin) · menu "Importar cadastros"
Fluxo em 3 cartões:
1. **"1. O que você vai importar"** · "Importe primeiro as escolas (o município é criado se ainda não existir) e depois os professores. O professor importado entra no Portal já aprovado e vinculado no primeiro login com a conta Google desse e-mail." Opções:
   - **Escolas** · município, UF, escola e código INEP
   - **Professores** · nome, e-mail, município e escolas onde dá aula
   - **Gestão e equipe** · gestor, secretaria escolar, portaria e Secretaria de Educação
   - **Alunos** · nome, e-mail, município, escola e turma (rede sem domínio próprio de aluno)
2. **"2. Cole a planilha ou envie o arquivo"** · "Selecione as linhas no Excel ou Google Planilhas (com o cabeçalho), copie e cole aqui. Também aceita CSV e XLSX. Mais de uma escola na mesma célula: separe com **|**. O professor também pode aparecer em várias linhas, uma por escola." Mostra "Colunas: ..." do tipo. Área "Cole aqui..." e botões **Conferir antes de gravar**, **Enviar arquivo** (.csv, .txt, .xlsx, .xls; em XLSX usa a aba cujo nome bate com o tipo: escola / gestão-equipe / professor / aluno, senão a 1ª aba), **Baixar modelo** (gera `modelo-<tipo>.csv` com exemplo), **Limpar**.
3. **"3. Confira e grave"** · resumo "N novo(s) · N atualização(ões) · N ignorado(s) · N com erro"; "As linhas com erro não serão gravadas. Corrija na planilha e confira de novo, ou grave as demais agora."; tabela Linha · (Município/Professor/Pessoa/Aluno) · (Escola/E-mail) · (INEP/Vínculo) · Resultado (Novo / Atualiza / Ignorado / Erro + motivo); botão **Gravar N registro(s)** (grava em lotes de 400; "Gravando... x/y"). Ao final: cartão **Importação concluída** com orientação específica por tipo.

**Colunas exigidas por tipo** (cabeçalho; separador `;`, `,` ou tabulação; sem diferença de acento/maiúscula; linhas que começam com "exemplo" são ignoradas):
| Tipo | Colunas do modelo | Obrigatórias | Sinônimos aceitos no cabeçalho |
|---|---|---|---|
| Escolas | `municipio;uf;escola;inep` | municipio, escola | municipio/cidade/municipios; uf/estado; escola/unidade/nome da escola/unidade escolar; inep/codigo inep/cod inep/código inep |
| Professores | `nome;email;municipio;escolas` | nome, email, municipio, escolas | nome/professor/nome do professor/nome completo; email/e mail/e-mail/email institucional; escolas/escola/unidades/unidade/escolas onde atua |
| Gestão e equipe | `nome;email;perfil;municipio;escola` (escola vazia para a Secretaria de Educação) | nome, email, perfil, municipio | perfil/funcao/cargo/papel |
| Alunos | `nome;email;municipio;escola;turma` (escola e turma opcionais) | nome, email, municipio | nome também aluno/nome do aluno/estudante; turma/classe/ano turma |

Exemplos do modelo (código): Escolas "Ribas do Rio Pardo;MS;EM Centro;50012345"; Professores "Maria Souza;maria.souza@rede.ms.gov.br;Ribas do Rio Pardo;EM Centro | EM Vila Nova" (a escola pode ser o nome ou o INEP de 8 dígitos); Equipe "Rita Alves;...;Gestor;...;EM Centro", "Sonia Prado;...;Secretaria escolar;...", "Jose Lima;...;Portaria;...", "Carla Mendes;...;Secretaria de Educação;Ribas do Rio Pardo;"; Alunos "Ana Clara Silva;ana.silva@escola.ms.gov.br;Ribas do Rio Pardo;EM Centro;5º ano A".

**Regras da prévia (mensagens exatas)**:
- Escolas: "Falta município ou escola"; "INEP deve ter 8 números"; "Cria o município X / UF" (município novo nasce como piloto, UF padrão MS); "Repetida na planilha"; "Já existe: completa o INEP"; "Já cadastrada"; "Nova escola".
- Professores (agrupa por e-mail, junta escolas de várias linhas): "Falta o nome"; "E-mail inválido"; "Município “X” não cadastrado. Importe as escolas primeiro."; "Falta a escola"; "Escola não encontrada: ..."; "Mesmo e-mail em outro município (linha N)"; "É administrador, não alterado"; "Cadastro desativado, não alterado"; "Já entrou no Portal: aprova e vincula agora" (soma escolas, aprova, institucional); "Atualiza pré-cadastro"; "Pré-cadastro novo".
- Equipe: perfil reconhecido pelo texto (portaria/porteiro/inspetor → Portaria; SEMED/técnico da secretaria/secretaria de educação/municipal → Secretaria de Educação; secretaria/escriturária/administrativo → Secretaria escolar; gestor/diretor/direção/coordenador/vice → Gestor). Erros: "Perfil “X” não reconhecido: use Gestor, Secretaria escolar, Portaria ou Secretaria de Educação"; "<perfil> fica em uma escola só"; "Gestor com mais de 5 escolas"; "Este e-mail é de aluno"; "Já entrou no Portal: atualiza o vínculo" / "Já entrou como X: passa a Y"; "Repetido na planilha".
- Alunos: "Escola não encontrada: X"; "Já é professor ou da equipe: não alterado"; "Já entrou no Portal: atualiza escola e turma"; "Atualiza pré-cadastro"; "Pré-cadastro novo".
- Mensagens finais: equipe "Cada pessoa entra com a conta Google desse e-mail e já cai na tela da função dela."; alunos "Os alunos entram com a conta Google desse e-mail e aparecem em Usuarios › Alunos."; professores "Os professores pré-cadastrados aparecem em Usuarios › Pré-cadastrados até fazerem o primeiro login."; escolas "Agora você pode importar os professores ou ajustar o plano de cada município em Municipios."
- Erro de gravação: "Erro ao gravar (...). Parte pode ter sido gravada: clique em Conferir de novo antes de repetir." → botão **Tentar de novo**.
- Importante: o pré-cadastro só vale com login **Google** (e-mail verificado) do mesmo e-mail.

### 4.16 O que o gestor e a secretaria administram (neste arquivo)
- **Neste arquivo `/entrar/` não existe tela de administração para gestor nem para secretaria**: ambos são direcionados para outras páginas (`/gestao/`, `/painel/`, `/apps/calendario/`, `/relatorios/`). O que eles fazem lá (convites de equipe, calendário da escola, chamados, TVs etc.) deve vir das notas dos outros agentes.
- O que o código daqui descreve sobre eles (texto do modal de usuário):
  - Secretaria de Educação: "vê todas as escolas do município, o Painel da Rede (se estiver no plano), o calendário letivo, os relatórios e os chamados técnicos da rede. Não vê turmas nem notas individuais."
  - Gestor: "vê as turmas, professores, avaliações e relatórios da escola, ajusta o calendário da escola, cuida dos equipamentos e chamados e das TVs. Se também dá aula, marque as turmas abaixo."
  - Equipe de apoio "convidada pelo gestor" (comentário no menu e pré-cadastro com `convidado_por`).
- O gestor tem Início com os cards do catálogo do professor (usa `modulos_professor` do município) e a Lousa (confirmar se Avaliações/Minhas Turmas aparecem: pelo menu, NÃO aparecem para gestor).

### 4.17 Outros pontos do menu admin
- **Turmas**, **Alunos**, **Avaliacoes**: ver 4.3 a 4.5.
- **Formação Continuada** → `/formacao/admin/` (fora deste arquivo).
- **Dicas recebidas** → `/dicas/#recebidas` (fora deste arquivo; moderação das Dicas do Professor; as Dicas do Aluno ficam em `/dicas/?aluno=1#recebidas`).
- **Painel da Rede (secretarias)** → `/painel/`.
- Não há, neste arquivo, telas admin próprias para Biblioteca, Colorir, Museus, Histórias, Aplicativos, Relatórios ou Frequência (são outras páginas). A triagem da Biblioteca fica em `/biblioteca/#triagem`.
- **Frequência / chamada**: não é implementada aqui; a Portaria usa `/apps/frequencia/#portaria` e a Gestão Escolar `/gestao/` (confirmar com os outros agentes).

---

## 5. MÓDULOS DO PROFESSOR FORA DO INÍCIO

### 5.1 Minhas Turmas (professor institucional)
- Se não tem escolas: "Escolha suas escolas primeiro · Em **Meu cadastro**, marque as escolas onde você dá aula. Depois volte aqui para montar suas turmas."
- Topo: "N turma(s) sob sua responsabilidade" + **+ Nova turma**.
- Tabela: Turma (ano) · Escola · Turno · Ano · Ações: **Alunos**, **Editar** (só quem criou), **Excluir** (quem criou; pede **Confirmar**) ou **Tirar da lista** (turma de outra pessoa).
- Formulário Nova/Editar turma: Nome da turma (ex.: 5º Ano A), Escola (só as suas), Ano / série (1-9), Turno, Ano letivo → **Salvar turma** / **Cancelar**.
- Bloco "Turmas que já existem nas suas escolas · Se a turma já foi cadastrada pela escola ou por outro professor, é só adicionar à sua lista." com botão **Adicionar**.
- **Alunos da turma**: "← Voltar para minhas turmas"; (dono da turma) cartão "Adicionar alunos · Digite um aluno por linha. Se quiser, coloque a matrícula depois de um ponto e vírgula (ex: Ana Souza; 2026-0012)." → **Adicionar à turma** (até 60 por vez). Lista: Aluno · Matrícula · **Corrigir** (edita na linha, **Salvar**/**Cancelar**) · **Remover** (Confirmar).

### 5.2 Plano de Aula IA (professor e avulso)
- "Plano de Aula com IA · Preencha os campos e a IA gera um plano de aula alinhado a BNCC. Voce pode revisar e ajustar depois."
- Campos: **Turma / Ano** (ex.: 5 Ano A), **Disciplina**, **Tema da aula** (disciplina e tema obrigatórios) → **Gerar plano de aula**. Mensagens: "Gerando plano de aula com IA, aguarde...", "Plano gerado! Voce pode copiar e ajustar." Resultado em texto corrido. (Usa um Apps Script do Google.)

### 5.3 Avaliacoes (professor) → ver 4.5.

### 5.4 Acervo (professor/avulso; também aberto por botões do Início com `#acervo` ou módulos de arquivos)
- Filtros: busca "Buscar por título ou habilidade (ex: EF03MA01)", **Todas as etapas** (Educação Infantil, Anos Iniciais, Anos Finais, Ensino Médio, EJA, Educação Especial), **Todas as disciplinas** (Língua Portuguesa, Matemática, Ciências, História, Geografia, Arte, Educação Física, Língua Inglesa, Ensino Religioso, Computação, Educação Infantil, Educação Especial, Interdisciplinar).
- Abas por botão de origem (Tudo, Atividades, Datas Comemorativas, etc.) quando há mais de um.
- Cartões: ícone do tipo de arquivo, título, botão · disciplina · etapas, até 4 códigos BNCC, botão **Abrir** (abre em nova aba com link temporário; "Sua licença não permite abrir este arquivo." se bloqueado).
- Vazio: "O acervo deste botão está sendo preparado. Volte em breve." ou "Nenhum arquivo com esses filtros."
- Observação técnica: depende do serviço do acervo (Cloudflare R2/Worker). O painel admin diz que o R2 "Ainda não ativado" (confirmar estado em produção).

### 5.5 Meus trabalhos (professor/avulso)
- "N trabalho(s) salvo(s)" + **Abrir a Lousa**. Cartões com miniatura, título, "Lousa · N página(s) · data", botão **Abrir na Lousa**.
- Vazio: "Seus trabalhos aparecem aqui · Tudo o que você fizer na Lousa Interativa é salvo sozinho na sua conta. Você pode continuar em qualquer computador, é só entrar no Portal."

### 5.6 Lousa Interativa (botão flutuante)
- Botão flutuante **Lousa** (canto da tela, arrastável; posição lembrada no navegador; teclado Alt+setas move, Alt+0 volta ao canto). Selo **Continuar · N pág.** quando há lousa em andamento.
- Abre por cima do Portal (página `/lousa/` embutida). Barra: "Lousa Interativa" · **Voltar ao Portal (Esc)** (salva e minimiza) · ⛶ tela cheia · **Encerrar**.
- Disponível para professor, gestor, secretaria e admin; não para aluno, portaria, secretaria escolar.

### 5.7 Meu cadastro (professor, avulso, gestor, secretaria escolar, portaria)
- **Meus dados**: Nome completo, WhatsApp, Função, (não institucional) Escola e INEP, Etapas em que atua, E-mail (só leitura) → **Salvar meus dados**.
- **Escolas onde dou aula** (só professor institucional): "Município: X. Marque até 5 escolas. Você passa a ver as turmas dessas escolas." → **Salvar escolas** (turmas de escolas desmarcadas saem da lista; erro "Só é possível marcar escolas do seu município."). A troca aparece para o admin como "Escolas alteradas pelo professor em dd/mm".
- **Minha licença**: Tipo, Plano, Válida até ("Conforme contrato do município" quando institucional sem data), Dias restantes; botão **Assinar** (teste) ou **Renovar ou mudar de plano** (avulsa) → WhatsApp.

---

## 5-B. MENSAGENS DE ERRO DE LOGIN (traduzErro)

- "E-mail invalido." · "Usuario nao encontrado." · "Senha incorreta." · "E-mail ou senha incorretos." · "Muitas tentativas. Aguarde um momento." · "Login do Google cancelado." · "Falha de conexão. Verifique a internet." · "O navegador bloqueou a janela do Google. Tente de novo ou libere pop-ups para este site." · "Este endereço ainda não está autorizado para login. Avise o suporte do Portal." · "Este navegador não permite o login do Google. Abra no Safari ou no Chrome." · "O navegador está bloqueando o armazenamento do site (modo privado?). Abra no Safari ou no Chrome normal." · "Este e-mail já entra por outro método. Use e-mail e senha." · "Esta conta foi desativada. Fale com o suporte."
- Login por e-mail/senha existe na tela, mas o código não tem tela de "criar senha" ou "esqueci a senha" (confirmar como contas com senha são criadas; provavelmente só pelo console do Firebase).

---

## 6. GLOSSÁRIO DE TEXTOS DE INTERFACE (usar exatamente assim no manual)

Observação: alguns rótulos do código estão **sem acento** (herança antiga) e é assim que o usuário vê: "Municipios", "Usuarios", "Avaliacoes", "+ Novo Municipio", "Salvar municipio", "+ Nova Avaliacao", "Salvar rascunho", "Liberar", "Encerrar", "Resultados", "Salvar correcao", "← Voltar para avaliacoes". Sugestão: o manual pode citar entre aspas como aparece, ou recomendar corrigir os acentos antes da publicação do manual.

- Login: "Sou professor", "Sou aluno", "Entrar", "Entrar com Google", "Copiar link", "Conhecer o Portal do Educador".
- Moldura: "Sair", "Início", "Iniciar aula", "Lousa", "Continuar · N pág.", "＋ Minha agenda".
- Primeiro acesso: "Complete seu cadastro", "Liberar meu teste grátis".
- Espera/licença: "Verificar novamente", "Já paguei, verificar", "Assinar agora", "Renovar", "Falar com a equipe e assinar", "Assinar", "Renovar ou mudar de plano".
- Aluno: "Entrar com outra conta", "Na verdade, sou professor", "Minhas provas", "Fazer a prova".
- Início: "Pronto para a aula?", "Iniciar aula", "Abrir a Lousa", "🔒 Em breve", "🔒 Fora do plano", "Próximas datas", "Ver o calendário de datas", "Ler mais", "Responder", "Todas".
- Conteúdos: "Abrir", "Abrir para imprimir", "Favoritar", "Minhas favoritas", "Mostrar mais", "Tela cheia (lousa)", "Fechar", "Tela cheia", "Abrir em nova aba", "Fechar ✕", "← Todas as datas", "← Todas as notícias", "Arquivos antigos de datas comemorativas", "Ler a matéria", "Ouvir agora", "Agora não", "Baixar respostas (planilha)".
- Reações: "Amei", "Gostei", "Mais ou menos", "Não gostei".
- Professor: "Minhas Turmas", "+ Nova turma", "Alunos", "Editar", "Excluir", "Tirar da lista", "Adicionar", "Adicionar à turma", "Corrigir", "Remover", "Plano de Aula IA", "Gerar plano de aula", "Meus trabalhos", "Abrir na Lousa", "Meu cadastro", "Salvar meus dados", "Salvar escolas".
- Admin: "Entrar como...", "Trocar", "Voltar a administrador", "Plano e módulos", "Liberar tudo", "Limpar", "Aluno igual ao professor", "Salvar plano", "Dados da escola", "Aprovar e vincular", "Gerenciar", "Recusar", "Confirmar recusa", "Aprovar e salvar", "Conferir antes de gravar", "Enviar arquivo", "Baixar modelo", "Gravar N registro(s)", "Importar catálogo base (nacionais e MS)", "Ver como o professor vê", "Abrir e montar kit", "+ Adicionar", "Editar texto e data", "Fixar/Desafixar", "Publicar/Tirar do ar", "⭐ Destacar", "Tirar destaque", "Trazer como rascunho", "Trazer e publicar", "Buscar novidades no Drive", "Adicionar atividade", "Salvar alterações", "Incluir Rede Modelo", "Atualizar", "Fazer backup agora", "Baixar no computador", "Salvar e testar".
- Confirmações em dois toques: vários botões de excluir/remover viram **"Confirmar"** (ou "Confirmar recusa", "Confirmar exclusão") por 4 segundos; é preciso tocar de novo.

---

## 7. PONTOS A CONFIRMAR (marcados no texto)

1. Estado real do Acervo (Cloudflare R2/Worker): o painel diz "Ainda não ativado"; os botões com link `#acervo` podem mostrar "O acervo deste botão está sendo preparado".
2. Quais módulos estão "Liberado" hoje em `config/modulos` (dados do banco, não do código).
3. Onde o aluno responde Avaliações com código (avaliações antigas desta tela) x Prova online (`/prova/`).
4. Criação de contas com e-mail/senha e recuperação de senha (não há tela no app).
5. Se o gestor também vê Avaliações/Minhas Turmas (pelo menu, não).
6. Pasta do Drive da sincronização de Atividades (configuração do servidor).
7. Convite da equipe pelo gestor: feito em `/gestao/` (outro arquivo).

---

## 8. SUGESTÕES DE CAPTURAS DE TELA

(O app não muda o endereço ao navegar: a "rota" abaixo indica o caminho no menu. Todas em `/entrar/`.)
| # | Tela | Como chegar / rota | Perfil para capturar |
|---|---|---|---|
| 1 | Login "Sou professor" | `/entrar/` ou `/entrar/?como=professor` | deslogado |
| 2 | Login "Sou aluno" | `/entrar/?como=aluno` | deslogado |
| 3 | Aviso de navegador embutido | abrir o link pelo WhatsApp | deslogado (celular) |
| 4 | Autocadastro "Complete seu cadastro" | 1º login Google de conta sem cadastro | professor novo |
| 5 | Faixa do teste grátis no topo | Início de professor em teste | professor (teste) |
| 6 | Cadastro em análise / Licença expirada / Acesso desativado | estados do cadastro | professor |
| 7 | Aviso do aluno "Ainda não encontramos sua escola" | "Sou aluno" com e-mail não cadastrado | aluno |
| 8 | Início do professor completo (Maestro, notícias, datas, cards) | menu Início | professor (ou admin › Entrar como › Professor) |
| 9 | Início do aluno com "Minhas provas" | menu Início | aluno |
| 10 | Card "🔒 Em breve" e "🔒 Fora do plano" | Início | professor |
| 11 | Pop-up de pesquisa rápida | entrar no Início com pesquisa em pop-up | professor |
| 12 | Vídeos (lista e janela do vídeo com reações) | card Vídeos Educativos (`#videos`) | professor |
| 13 | Jogos (lista e palco de tela inteira) | card Jogos (`#jogos`) | professor/aluno |
| 14 | Atividades: etapas, componentes, lista, visualizador | card Atividades (`#atividades`) | professor |
| 15 | Datas Comemorativas: lista e página da data com kit | card Datas (`#datas`) | professor e aluno ("Você sabia?") |
| 16 | Dicas de IA · IA Studio | card Dicas de IA (`#ia`) | professor |
| 17 | Notícias: página e matéria | link "Todas" na faixa | professor |
| 18 | Minhas Turmas e Alunos da turma | menu Minhas Turmas | professor institucional |
| 19 | Plano de Aula IA com resultado | menu Plano de Aula IA | professor |
| 20 | Avaliações: lista, nova avaliação, resultados/correção | menu Avaliacoes | professor |
| 21 | Meu cadastro (dados, escolas, licença) | menu Meu cadastro | professor |
| 22 | Lousa aberta e Meus trabalhos | botão Lousa / menu Meus trabalhos | professor |
| 23 | Mini-calendário do menu | menu lateral | professor/gestor |
| 24 | "Como você quer entrar?" e faixa de modo de teste | 1º acesso admin / Entrar como... | admin |
| 25 | Painel (4 abas) | menu Painel | admin |
| 26 | Municipios + modal Plano e módulos (com Recursos extras / Prova online e domínios) | menu Municipios › Plano e módulos | admin |
| 27 | Escolas + modal Dados da escola | menu Escolas | admin |
| 28 | Usuarios (abas) + modal Aprovar e vincular | menu Usuarios | admin |
| 29 | Importar cadastros: passos 1, 2 e prévia 3 (com Baixar modelo) | menu Importar cadastros | admin |
| 30 | Módulos do Portal (tabela de status/links) | menu Módulos do Portal | admin |
| 31 | Notícias admin (formulário com pesquisa e pop-up) | menu Notícias | admin |
| 32 | Datas Comemorativas admin + Montar o kit | menu Datas Comemorativas / Abrir e montar kit | admin |
| 33 | Atividades admin (Adicionar atividade, Buscar novidades no Drive, edição dentro da atividade) | card Atividades como admin | admin |
| 34 | Vídeos admin / Jogos admin / Dicas de IA admin / Acervo admin | menus respectivos | admin |
| 35 | Painel da Escola / Painel da Rede (cartão de entrada) | menu Painel da Escola / Painel da Rede | gestor / secretaria |
| 36 | Início da Portaria e da Secretaria escolar | menu Início | portaria / secretaria escolar |

### Redes contratantes (nov/2026)
- No menu do administrador, "Municípios" passou a se chamar **Redes contratantes** (seção Redes e cadastros).
- Cada cadastro tem **Tipo de rede**: Municipal (prefeitura), Estadual, Particular (escola ou grupo) ou Instituição (fundação, ONG, instituto). Os cadastros antigos ficam como Municipal.
- Rede particular e instituição pedem a **Cidade**. Assim, uma prefeitura e escolas particulares da mesma cidade são clientes separados: cada um com contrato, gestores, escolas, alunos, painel e cobrança próprios, sem ver os dados do outro.
- Os rótulos mudam com o tipo: "CNPJ da escola ou mantenedora" na particular, "CNPJ da instituição" na instituição, e o segundo CNPJ vira "Outro CNPJ pagador".
- Na tabela, ao lado do nome aparece o tipo (e a cidade, quando não é municipal).

## Resumo diário da equipe (e-mail das 7h): bloco Backup (05/11/2026)
- Último backup diário no servidor NEWPC: data, documentos, contas, arquivos, tamanho e duração. Fica vermelho se passar de 30 h sem backup.
- Último teste de restauração: data e resultado; amarelo se tiver alerta ou passar de 35 dias.
- Falhas de backup nas últimas 24 h, com o motivo.
- Cópia fora da empresa: mostra se o backup semanal no Drive compartilhado está ligado e quando foi a última cópia.

## Redes contratantes: cadastro conforme o tipo de rede (05/11/2026)
- Municipal: Prefeito(a), Secretário(a) de Educação, gestor e fiscal do contrato (Lei 14.133), IBGE e IDEB da rede municipal.
- Estadual: Governador(a), Secretário(a) de Estado de Educação, TI da Secretaria, gestor e fiscal (Lei 14.133), IDEB da rede estadual.
- Particular: Diretor(a) ou mantenedor(a) (sem mandato), Coordenação pedagógica, Responsável de TI, Responsável pelo contrato e Financeiro; sem IBGE e sem IDEB; contrato com "Proposta ou pedido" e "Pedido de compra".
- Instituição: Presidente ou diretor(a) com gestão, Coordenação de projetos, Responsável pelo contrato ou convênio, Financeiro (prestação de contas).
- Modalidades novas no contrato: Contrato particular e Convênio / termo de parceria. Os dados já gravados não mudam, só os rótulos.

## Rede particular, estadual e instituição em todo o Portal (05/11/2026)
- Regra única de nomes por tipo de rede (assets/js/rede.js nas páginas e functions/rede-tipo.js no servidor).
- Documentos em PDF (boletim, pareceres, frequência, relatórios, provas, Portal IA, colorir): rede municipal sai "Secretaria Municipal de Educação de X/UF"; estadual "Secretaria de Estado de Educação"; particular sai a mantenedora (se o nome for diferente do da escola) e a cidade.
- Carteirinhas de aluno e de servidor: "Prefeitura Municipal de X", "Governo do Estado de ..." ou, na particular, a mantenedora/cidade.
- Painel da Rede, Portal TV, Central de Relatórios e tela inicial: o papel "Secretaria de Educação" aparece como "Direção / Mantenedora" (particular) ou "Coordenação" (instituição).
- E-mail de boas-vindas do professor de rede particular: "Colégio X oferece a você o Portal do Educador" (nunca "Prefeitura Municipal de Colégio X").
- Mensagens do sistema trocaram "rede municipal / seu município / Secretaria de Educação" por "sua rede / gestão da rede".
- Política de Privacidade: parágrafo próprio para escola particular e instituição (a escola ou mantenedora é a controladora; a NEWPC é operadora).

## Escolas: cidade própria (05/11/2026)
- Cadastro da escola ganhou Cidade e UF; o CEP preenche. O campo "Município" virou "Rede contratante" (mostra o tipo da rede).
- Sem CEP: escola de rede municipal fica com a cidade do município; de rede particular ou instituição, com a cidade da rede.
- O aviso "CEP de outro município" só aparece em rede municipal (rede estadual e grupos particulares têm escolas em várias cidades).
- Relatórios e declarações usam a cidade da escola no endereço e na data.

## Backup, importador, contratos e licença Google (05/11/2026, fim do dia)
- Teste de restauração: confere os usuários do pacote com a contagem feita na hora do backup (acabou o falso alarme). Só acusa o Portal de agora se ele tiver menos de 90% do pacote (sinal de exclusão em massa).
- Vigia do backup: todo dia às 11h23 confere se houve backup nas últimas 26 h e se o último backup ou teste falhou; se sim, e-mail imediato para a equipe com o que fazer.
- Importador de inventário: lê CSV em UTF-8 e, se vier do Excel com acento quebrado, em Windows-1252.
- Redes contratantes: nº do contrato preenchido nas redes que estavam "sem nº", a partir dos contratos da planilha de equipamentos.
- Recursos da Escola: Chromebook e tablet têm "Licença Google" e "Licença válida até" na ficha e na planilha exportada.

## Aula IA na lousa (06/11)
- Alternativas do quiz que começam com número ("10 kWh", "1500 pessoas") agora aparecem inteiras.
- Valores que mudam com o tempo (salário mínimo, tarifa, preço) vêm com o ano de referência ou como exemplo redondo.
- Aula com preços ou tarifas avisa na tela que os valores são ilustrativos.
- Aulas de 6 slides ou mais trazem, antes do resumo, uma atividade para investigar na vida real (em casa, no bairro, no trabalho; nos anos iniciais e na Infantil, com a família), para conversar na aula seguinte.
- Texto em negrito (títulos de coluna, problema do cálculo, itens da síntese) não vaza mais da caixa: a Lousa remede o texto quando a fonte dos títulos termina de carregar.

## Aulas prontas na Lousa (06/11)
- Botão "Prontas" na barra lateral da Lousa (professor licenciado): acervo oficial NEWPC com os Temas Contemporâneos Transversais da BNCC, do 1º ao 9º ano.
- Filtros por ano (1º e 2º, 3º ao 5º, 6º e 7º, 8º e 9º), por tema (Economia, Saúde, Meio Ambiente, Cidadania, Ciência e Tecnologia) e busca.
- "Usar esta aula" abre a aula editável na Lousa, com quiz, Modo Apresentação e Guia do professor. Não gasta crédito. Conta o uso no cartão.
- Administrador: abas Publicadas, Em revisão e Ocultas; "Gerar o lote oficial" (12 temas × 4 faixas = 48 aulas, 2 ilustrações cada, 2 por vez; pode rodar de novo para completar o que falhou); "Abrir para revisar", "Aprovar" (gera as imagens leves e a miniatura) e "Ocultar".
- POP de revisão: abrir a aula, conferir contas, dados oficiais e linguagem, olhar o Guia do professor; aprovar ou ocultar.
- Barra de baixo da Lousa (06/11): Meus trabalhos (azul), Aulas prontas (âmbar, selo grátis) e Aula IA ao lado do Apresentar; saíram da lateral direita. Em telas menores ficam só os ícones coloridos.
- Lousa no Portal (06/11): logo da NEWPC na barra de cima (no lugar do texto Lousa Interativa); embaixo só quando a Lousa abre sozinha.
- Alerta de crédito da IA (06/11): se o saldo pré-pago do Gemini acabar, o professor vê 'A IA do Portal está em manutenção, seus créditos não foram descontados' e alan@newpc.com.br recebe e-mail (máx. 1 a cada 6 h) com o passo a passo da recarga (ai.studio/projects, conta newpc.educador@gmail.com, projeto Portal 5 PRODUCAO - NAO APAGAR).

## Sala compartilhada e bater na porta (06/11)
- Ao começar a aula, além do tempo, o professor diz onde ela acontece: "Na sala da turma" (padrão) ou uma sala compartilhada da escola (ex.: Laboratório de informática). O Portal lembra a última escolha por turma.
- Salas compartilhadas: cadastro da escola (admin), campo "Salas compartilhadas", uma por linha. Sem cadastro, aparece "Laboratório de informática".
- Se outra turma ainda está aberta na mesma sala, aparece "Laboratório ocupado" com a turma, o professor e o horário. Confirmando, a aula anterior é encerrada, os alunos dela que entraram pelo cartão saem dos aparelhos sozinhos, o professor dela recebe o aviso "Sua aula foi encerrada" e tudo fica na auditoria.
- Turmas diferentes em salas diferentes nunca interferem. O pedido para assumir ("bater na porta") só existe dentro da mesma turma.
- Bater na porta: o professor que está com a turma sai da tela cheia (Lousa, Apresentar, material) para ver o pedido com bipe.
- POP laboratório: cadastrar as salas compartilhadas de cada escola antes da capacitação.
- Bater na porta (06/11, correção): ao trocar de conta no mesmo navegador sem recarregar (laboratório), o Portal seguia vigiando as aulas do professor anterior; agora recomeça com a conta nova, e o painel da aula também mostra o pedido. Mesmo cuidado no fim da aula do aluno em aparelho compartilhado.

## Aparelhos conectados (06/11)
- Aluno: 1 aparelho por vez. Entrou em outro, o anterior mostra "Você entrou em outro aparelho" e sai da conta sozinho.
- Professor, gestor e equipe: até 3 aparelhos ao mesmo tempo (ex.: Lousa da sala, notebook com o painel, celular). No 4º, sai o parado há mais tempo, com aviso. Administrador: até 5.
- Limites em config/sessoes ({ aluno, professor, padrao, admin }), sem mexer no código.
- Meu cadastro > "Aparelhos conectados": lista (tipo, navegador, desde quando, "este aparelho") e o botão "Sair de todos os outros aparelhos" (ex.: esqueceu a conta aberta no laboratório).
- Abas do mesmo navegador contam como um aparelho só. Tudo que tira alguém da conta fica na auditoria.
- Turma ao Vivo em tela baixa (06/11): lousa digital com zoom do Windows ou notebook pequeno, o painel rola inteiro e a área Na sala mantém a altura.

## IA na Lousa (06/11)
Botão roxo "Ferramentas IA" na barra de baixo da Lousa (ao lado de Aula IA e Apresentar), com o menu:
- Perguntar (💬): pergunta da turma ou do professor; a resposta aparece num cartão no quadro (título, resposta curta, passos, dica). 1 crédito.
- Circular (⭕): o professor circula com a caneta uma conta, palavra ou figura; escolhe Explicar, Resolver passo a passo, Traduzir ou faz uma pergunta; o cartão aparece ao lado do que foi circulado. 1 crédito.
- Pintor IA (🎨): selecione um rabisco (ferramenta Selecionar) e toque em Pintor IA; diga o que é (opcional) e o estilo (Didática, Desenho animado, Realista, Para colorir); a ilustração entra no lugar do rabisco (Desfazer traz o rabisco de volta). Créditos de imagem (Lousa Ultra).
- Mapa IA (🧠): diga o tema e o mapa mental aparece no quadro; tópicos editáveis com toque duplo; as ligações acompanham quando o tópico é arrastado. 1 crédito.
- Legendas (💬): a fala do professor vira legenda grande na parte de baixo do quadro (Chrome/Edge; libere o microfone). Sem crédito, nada é gravado. Toque de novo para desligar.
- A linguagem da resposta segue a turma e a disciplina escolhidas por último na Aula IA.
- Precisam de internet. Funcionam dentro da Lousa (não em outros programas da tela).

## Tabela de créditos com 200% de margem (nov/2026)
- Regra: créditos de cada ferramenta = custo real ajustado × 3, no pior caso de venda (rede no pacote de 20 mil, R$ 0,36 o crédito).
- Preços por ação: Material do Portal IA 2 · Aula IA (Lousa) 6 · Imagem, Ilustração e Pintor 6 · Aula avançada 24 · Questões, parecer, quiz e IA rápida da Lousa (Perguntar, Circular, Mapa) 1 · Ajuste 1 · Aulas prontas e Legendas grátis.
- Aula IA com 3 ilustrações: 6 + 18 = 24 créditos.
- Franquia mensal da rede por educador: Intermediário 60 · Completo 120 · Personalizado 60. Teto padrão por professor: 120.
- Relatório de margem: o custo calculado pelos tokens é multiplicado por 1,6 (fator_custo), para bater com a fatura do Google.
- POP: o administrador muda os números em Créditos > Preços e pacotes (campos novos: Material do Portal IA e Aula IA). Aula avançada e IA rápida são estimativas: rever após 30 dias de uso medido.

## Transparência: o que a IA gera fica no acervo do professor (nov/2026)
- Regra para o professor: o crédito paga a criação. Depois de pronto, o conteúdo fica em Meus trabalhos (ou no aluno, no caso do parecer); abrir, editar, imprimir e apresentar de novo não gasta crédito.
- Aula IA da Lousa: é salva em Meus trabalhos assim que entra no quadro, com o título da aula (antes dependia do salvamento automático de 2 minutos). Se já havia um trabalho aberto, a aula entra nele.
- Avisos nas telas: janela da Aula IA (faixa verde), Portal IA (abaixo do Preparar e no aviso de pronto), Ajustar com a IA (cada ajuste reescreve o material e usa crédito), imagem (trocar gera outra e cobra de novo) e Pareceres (só "Gerar de novo" usa outro crédito).
- O que gasta de novo: Gerar de novo, Ajustar com a IA, imagem nova ou trocada.
- Discurso comercial: "você paga uma vez para criar; a aula vira acervo seu". Não prometer "para sempre": fica enquanto o professor não excluir e a licença estiver ativa.

## Lousa: anotações de aula e versão original (nov/2026)
- Ao abrir uma aula de Meus trabalhos, gerar uma Aula IA ou usar uma Aula pronta, a Lousa guarda a versão original (limpa).
- O salvamento automático continua (nada se perde se o navegador fechar); na 1ª vez que a aula muda, a original vai para uma cópia ao lado ({id}.orig.json.gz) antes de ser sobrescrita.
- Ao encerrar uma aula que mudou, o professor escolhe: Salvar com as anotações · Salvar as anotações como cópia ("Título · anotada dd/mm", a aula volta como estava) · Sair sem salvar (a aula volta como estava). Opcional: baixar PDF como está antes.
- A cópia da original é apagada quando ele decide; excluir o trabalho (na Lousa ou no Portal) apaga a cópia junto.
- Se a aula ficou aberta sem encerrar (fechou o navegador), na próxima vez a original continua sendo a daquela abertura.
- Atenção no POP: "Sair sem salvar" desfaz tudo desde que a aula foi aberta, inclusive correções de texto; para guardar a correção e descartar só os rabiscos, salvar como cópia e depois excluir a cópia, ou corrigir e salvar antes de dar a aula.
- Aula sem origem salva (feita do zero, sem Meus trabalhos) continua com o encerrar de antes.

## Mapa IA: modelos de mapa (nov/2026)
- Na janela do Mapa IA o professor escolhe o modelo em cartões com miniatura: Radial (tema no meio), Árvore (do tema para baixo, em níveis), Bolhas (ideias em bolhas em volta do tema) e Chaves (resumo esquematizado com { }). A Lousa lembra o último escolhido.
- Custo igual em todos: 1 crédito. A IA devolve sempre o mesmo conteúdo (centro, 4 a 6 ramos, 2 a 3 itens); o desenho é feito pela própria Lousa, sem custo a mais.
- Fluxo, espinha de peixe, comparação e mapa conceitual ficaram de fora por exigirem outro formato de resposta da IA (pequeno aumento de tokens).
- Tudo continua editável: toque duplo no tópico para editar; arrastar move o tópico e as linhas acompanham (no modelo Chaves as chaves não acompanham, são desenhos soltos).

## Lousa: recursos sem custo de IA (nov/2026)
- Trocar o modelo do mapa (Ferramentas IA): redesenha o mapa da página (ou o do tópico selecionado) em Radial, Árvore, Bolhas ou Chaves, com os textos como estão no quadro (vale a edição do professor). Sem crédito. Com dois mapas na página, tocar num tópico antes.
- Ler em voz alta: lê o texto selecionado ou a página inteira (de cima para baixo) com a voz pt-BR do navegador. Tocar de novo para parar. Não lê o Guia do professor. Melhor no Chrome/Edge.
- Medidor de barulho: semáforo verde/amarelo/vermelho com o volume da sala pelo microfone da lousa; limite ajustável (fica lembrado). Vermelho só depois de ~1 s acima do limite. Nada é gravado nem enviado.
- "Já existe aula pronta": na janela da Aula IA, ao digitar o tema, a Lousa procura uma Aula pronta aprovada sobre o mesmo assunto (prefere a faixa de ano da turma) e oferece "Usar esta aula", sem crédito.
- Discurso: "sem custo de IA" (não "custo zero": banco e armazenamento custam centavos).

## Meus trabalhos da Lousa: menos lixo e filtros (nov/2026)
- O salvamento automático não cria trabalho novo para quadro com até 2 traços soltos e nada mais (sem texto, imagem, PDF ou 2ª página). Fica só no navegador; o botão Salvar continua salvando qualquer coisa.
- Filtros na janela: Todas · Aulas IA · Aulas prontas · Minhas. Cada cartão mostra o selo "Aula IA" ou "Aula pronta".
- Aulas antigas ganham o selo quando forem abertas e salvas de novo (a Lousa reconhece os slides da IA); até lá aparecem em "Minhas".
- Com muitos trabalhos a grade agora rola e cada cartão mostra nome e botões; tocar na miniatura abre a aula.

## Voz que vira texto e "Estou pensando" nas ferramentas de IA (nov/2026)
- Perguntar, Circular, Mapa e Pintor mostram a tela "Estou pensando" com etapas e os recados de IA responsável (frases fixas do Portal, sem token).
- 🎤 nos campos: ao tocar num campo de texto (Lousa, Portal IA, Pareceres e Portal), aparece um microfone dentro do campo; fala e o texto entra. Não aparece em senha, e-mail, número, data, telefone, CPF, código nem em campos pequenos. Comandos: vírgula, ponto (no fim da fala), ponto final, ponto de interrogação, nova linha (só em caixa de texto), apagar a última frase, parar ditado.
- Ditado no quadro (Ferramentas IA): a fala vira um bloco de texto editável no quadro; Pausar/Retomar e Parar na barra; se um texto estiver selecionado, o ditado continua nele. Selo "ditado" no botão roxo enquanto ligado. Legendas e ditado não ligam juntos (um microfone de cada vez).
- Ditar pelo celular (Ferramentas IA, precisa estar no Portal): a Lousa mostra um QR e o endereço /ditado/; no celular, entrar com a mesma conta e tocar no microfone. O texto aparece no quadro em tempo real; "parar ditado" falado no celular encerra na Lousa. A tela do celular fica acesa enquanto dita.
- Privacidade (LGPD): o Portal não grava áudio. No Chrome a voz vai para o serviço de voz do Google só para virar texto; o microfone só liga quando o professor toca no botão e fica um aviso visível. Pelo celular, só o texto passa pela nuvem do Portal e cada trecho é apagado assim que entra no quadro. Sugerido incluir no Termo de Uso.
- Dica de implantação: o microfone da lousa capta mal a 3-4 m; para andar pela sala, usar o celular (sem custo) ou microfone de lapela sem fio.
- Funciona no Chrome, Edge e Chromebook; no Firefox o 🎤 não aparece.

## Regra única: acabou o crédito de IA, o Portal leva para abastecer (nov/2026)
- Em qualquer recurso de IA (Lousa: Aula IA, Perguntar, Circular, Mapa, Pintor; Portal IA; Provas com IA; Pareceres; Quiz rápido), se o crédito do professor acabou, aparece a janela "Seus créditos de IA acabaram" com o motivo (limite mensal da rede, créditos da rede acabaram, plano sem IA ou sem imagem, demonstração do teste) e o botão "💳 Abastecer créditos".
- O botão leva para a compra de créditos avulsos do Portal IA (/apps/portal-ia/#comprar). Na Lousa dentro do Portal, abre na janela inteira (a aula já está salva); no próprio Portal IA, abre a compra na hora.
- Não aparece quando o problema é outro: IA em manutenção (crédito do Google), recurso fora da licença, internet.
- Técnico: o servidor marca o erro com details.semCredito; o navegador usa assets/pde-credito.js (PDECredito.ver).

## Backup: cofre fora da NEWPC (nov/2026)
- Além do servidor da NEWPC (Nextcloud), o robô do backup manda os MESMOS pacotes cifrados (AES-256, senha BACKUP_SENHA) para um bucket do Google Cloud num projeto separado, com trava de retenção (Bucket Lock): nada é apagado nem trocado antes de 30 dias, nem pelo administrador.
- O robô do cofre (segredo COFRE_CHAVE) só cria e lê: não apaga nem sobrescreve. Nome do bucket no segredo COFRE_BUCKET.
- Conteúdo: diario/AAAA-MM-DD.tar.enc, mensal/AAAA-MM.tar.enc, arquivos/xx/<hash>.enc (espelho dos arquivos), arquivos/_manifesto-AAAA-MM-DD.json.enc. A 1ª execução leva todos os arquivos; depois só o que for novo.
- Limpeza pelo próprio bucket (ciclo de vida): diário 35 dias, mensal 400 dias, manifestos 35 dias. Arquivos do espelho ficam.
- Erro no cofre não derruba o backup do servidor; aparece no log (status cofre) e em stats/backup_servidor. O teste mensal de restauração também abre o último pacote do cofre.
- Restaurar a partir do cofre: baixar o pacote no console do Google Cloud e abrir com: openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_SENHA -in AAAA-MM-DD.tar.enc | tar -x
- POP crítico: a senha BACKUP_SENHA guardada em papel em dois lugares físicos diferentes. Sem ela nenhum backup abre.

## Lousa: PDF para folhear como um livro (nov/2026)
- Ao importar um PDF com mais de uma página, há uma terceira opção: "📖 Folhear como um livro". Cada página do PDF vira uma página da lousa (o professor escreve em cada uma e tudo é salvo), e a troca entre elas é uma folha virando sobre a lombada, com sombra e um som baixinho de papel.
- Para virar: abas ‹ › nas laterais da tela, setas ← → (ou Page Up/Down) do teclado quando nada está selecionado, ou os botões de página de baixo. No alto aparece "📖 3 de 12".
- A Lousa lembra a última forma de importação escolhida.
- No Modo Apresentação as abas somem e a troca de página segue a do Apresentar.

## Lousa: Forma perfeita refeita (nov/2026)
- Com "Forma perfeita" ligada (Formas > chave verde), o traço solto da caneta vira: retângulo, círculo ou elipse, triângulo (com os vértices onde o professor desenhou), losango ou linha reta.
- O reconhecimento olha quanto o traço preenche a própria caixa, se os pontos ficam colados nas bordas (retângulo) ou à mesma distância do centro (círculo), e os cantos de verdade. Antes ele contava cantos de um jeito frágil e o retângulo à mão quase nunca era reconhecido.
- O traço pode fechar com folga (até 35% da diagonal). Se a forma for duvidosa, o traço fica como foi desenhado.

## Forma perfeita sempre ligada (07/11/2026)
- Recurso sem custo de IA (reconhecimento roda no navegador). Agora abre ligado para todo professor.
- Se o professor desligar, a Lousa lembra a escolha naquele navegador (pde_autoforma = "0").
- Traços pequenos (letras, números, escrita à mão) não viram forma: abaixo de 80 px na tela ficam como desenho livre.
- Reconhece retângulo, círculo/elipse, triângulo, losango e linha reta.

## Compartilhar por QR code (07/11/2026)
- Lousa > Compartilhar > aba "📲 QR code" (primeira aba). Sem custo de IA, liberado para todo professor licenciado.
- Gera as páginas como estão no quadro, sem o Guia do professor, e o PDF. Sobe para compartilhadas/{código de 24 caracteres}/.
- QR grande na tela para a turma, botão "Copiar link" (grupo da turma) e "Gerar outro".
- Aluno abre /aula/?c=código no celular, sem login, vê as páginas e baixa o PDF. Nenhum dado do aluno é coletado.
- Vale até 23:59 do dia (mínimo 3 h). Depois a regra do Storage bloqueia e o bucket apaga a pasta em 2 dias (regra de ciclo de vida).
- Aviso obrigatório: professor confirma que não há nome, foto ou dado de aluno no quadro.
- Se precisar de novo: abrir a aula em Meus trabalhos e gerar outro QR.
- Botão Compartilhar da Lousa em destaque (azul do Portal, selo "QR"). Teste ao vivo do QR pelo celular no 4G aprovado pelo Alan em 07/11.

## Simulador de preços: Portal junto da locação, por sala (07/11/2026)
- Modo "Junto da locação NEWPC": Portal pago cobrado por sala equipada (Intermediário R$ 360, Completo R$ 600 de partida).
- Sala só com lousa (1º ao 3º ano) paga uma fração do preço da sala (50% de partida).
- Mostra a mensalidade da locação, o peso do Portal sobre ela (alerta acima de 15%), preço por aluno e o preço sugerido para a margem desejada (40%).
- Regra do preço sugerido: custo ÷ (1 − impostos − comissão − margem). Custo = infraestrutura por aluno + suporte + IA por professor (preencher com a medição).
- Avulso continua por aluno/mês.
- Simulador (locação): escolha do equipamento do aluno (Tablet, Chromebook ou Notebook, cada um com seu valor), licença Google for Education por dispositivo/mês e quadro "Composição do projeto por mês" (lousa, carrinho, dispositivos, licença, Portal e total). A impressão/PDF também traz a composição.
- Simulador (locação): óculos VR e carrinho de recarga VR opcionais, quantidade e valor digitados (começam zerados).
- Simulador (locação) refeito como lista de itens: adiciona linha por linha (item, qtd, valor/mês), remove com ✕, valor digitado fica lembrado por item. Salas calculadas pelas linhas de Lousa e Carrinho com roteador. Resultado com plano em botões, total do projeto em destaque e itens para proposta recolhidos.
- Simulador (avulso) no mesmo formato da locação: rede, preço por aluno, serviços à parte em lista, resultado com total do 1º ano em destaque e preço por aluno para a margem desejada.

## Apresentação da Lousa em painel de toque (07/11/2026)
- Botão fixo "✕ Sair" no canto superior direito durante toda a apresentação (painel de toque não tem tecla Esc).
- No último slide aparece a janela "Fim da aula" com Voltar ao último slide, Recomeçar e Sair da apresentação.
- Qualquer toque mostra a barra de controles; o aviso inicial muda para toque quando o equipamento é de toque.
- 07/11 (tarde): Forma perfeita voltou a vir DESLIGADA por padrão, a pedido do Alan após uso prático (atrapalha a escrita à mão livre). Quem ligar, a Lousa lembra naquele navegador.

## Login com Google pelo domínio do Portal (07/11/2026)
- A janela do Google agora mostra "Prosseguir para portaldoeducador.com.br" (antes: portal-educador-5.firebaseapp.com).
- authDomain oficial = www.portaldoeducador.com.br; arquivos auxiliares em /__/auth/ (handler.html, iframe.html e js), copiados do Firebase toda segunda pela rotina "Sincronizar arquivos do login" (grava no vitrine-ia).
- Google Cloud (cliente OAuth Web): URI de redirecionamento www.../__/auth/handler e origem https://www.portaldoeducador.com.br. O endereço antigo do Firebase continua cadastrado (volta rápida).
- Página de teste isolada: /login-teste/.

## 07/11 · pendências do dia 06
- Privacidade: parágrafo do ditado por voz (navegador; no Chrome, serviço de voz do Google; o Portal não recebe nem grava áudio).
- 7 rabiscos soltos antigos apagados de Meus trabalhos (registro + arquivo), com aprovação do Alan.

## Lara, assistente virtual na página inicial (07/11/2026)
- No lugar do ícone do WhatsApp: foto da Lara em círculo com selo verde do WhatsApp; balão "Olá, sou a Lara! Como posso te ajudar hoje?" com "Assistente virtual · atendimento pelo WhatsApp".
- Computador: balão aparece após 2,5 s. Celular: aparece quando a pessoa rola a página e some em 7 s (não cobre os botões de entrar). Fechado no ✕, não volta na mesma visita.
- Corrigido estouro de largura da página no celular (overflow-x: clip).

## Lara no WhatsApp (07/11/2026)
- O robô se apresenta como Lara, assistente virtual (menu e respostas de dúvidas no feminino), e diz como falar com uma pessoa.
- Mensagem pedindo pessoa/atendimento vai direto para a equipe, sem menu.
- Áudio/imagem: resposta gentil pedindo texto (próximo passo: transcrever áudio).

- 07/11: Lara entende áudio no WhatsApp (transcrição pelo Gemini, áudio não guardado; histórico mostra 🎤 + texto; métricas audios/audios_ok). Privacidade atualizada. Tela Atendimento: faixa de transferir só aparece ao clicar em Transferir.

## App Atendimento PDE (Android) · 07/11/2026
- APK para o celular da equipe de atendimento do WhatsApp. Abre /atendimento/ em tela cheia, com ícone próprio.
- Tecnologia TWA (motor do Chrome): login Google e notificações de cliente esperando funcionam. Precisa do Chrome no celular.
- Assinado com a mesma chave do app do Maestro. Sem barra de endereço graças ao /.well-known/assetlinks.json.
- Gerar versão: GitHub › Actions › "App Atendimento PDE" › Run workflow. O link do .apk aparece no fim.
- Pendente (segunda 09/11): Alan instala e testa o app no tablet de atendimento. Mensagem para o grupo "WhatsApp Portal 5.0" ficou digitada no WhatsApp Web, sem envio. Card de download na tela Atendimento WhatsApp aguarda "pode publicar" (commit 3b70a3f em vitrine-ia).

## Vídeo interativo · 07/11/2026
- O vídeo do YouTube pausa nos momentos certos e a turma responde na lousa (múltipla escolha, V ou F, resposta aberta, nota). Placar da turma no fim.
- Página: www.portaldoeducador.com.br/video/ (lista, criar com link, apresentar, editar). Nos Vídeos Educativos: faixa "Vídeo interativo", selo INTERATIVO e botão "Versão interativa".
- Catálogo: o admin prepara ("✨ Preparar versão interativa"), revisa e marca "Publicado no catálogo". Vale para todas as redes liberadas, sem gastar crédito delas.
- Professor: "Criar com um link" custa 3 créditos (editável no painel de créditos); se a IA falhar, o crédito volta.
- Liberação: Central de IA, recursos "Vídeo interativo · gerar por link" e "Vídeos interativos · do catálogo". Padrão: Intermediário e Completo.
- Custo real medido: ~R$ 0,30 por vídeo, 13 a 25 s para gerar. 8 rascunhos do catálogo gerados para revisar antes da SENACOP.
- Fase 2 (depois de fevereiro): resposta de cada aluno no tablet e relatório.
- (07/11, noite) Botão verde "▶ Interativo" no card de cada vídeo dos Vídeos Educativos: abre uma janela no Portal e o vídeo já começa a tocar com as perguntas. 45 vídeos do catálogo publicados como interativos (gerados por IA, revisão depois pela edição em /video/). Ficaram de fora vídeos com menos de 1min30, com mais de 10 min, sem duração cadastrada e os de bebês e crianças bem pequenas.
- (07/11, noite) Incluídos os vídeos longos (contos de ~50 min, até 10 pausas), os sem duração e os de crianças pequenas: 71 de 74 vídeos com botão Interativo. Fora: O mosquito Vilão (13 s), João e Maria (a IA não conseguiu gerar em 2 tentativas) e Educação Financeira (a IA disse que o vídeo fala de preservação ambiental e amizade, não de educação financeira: conferir o cadastro).
- (07/11) Mensagem nas telas: os vídeos interativos do catálogo do Portal são GRÁTIS (não gastam créditos); criar a partir de outro vídeo do YouTube usa 3 créditos. Argumento comercial: valor incluído na licença.
- (07/11, noite) Interativo AUTOMÁTICO no catálogo: no cadastro do vídeo, interruptor "🎬 Vídeo interativo" (ligado por padrão). Ao publicar, a IA monta as perguntas e publica sozinha (cerca de 30 s a 2 min). Desligado: o botão some (as perguntas ficam guardadas). Lista do painel mostra a situação (🎬 Interativo, ⏳ Gerando, ⚠️ IA não conseguiu, ⛔ Sem interativo) e os botões "Perguntas" (editar) e "Refazer IA". Testado: Refazer IA no vídeo do Andy ficou pronto em 30 s.
- Durações: Os Mistérios do Petróleo corrigido para 12:57 pela medida da IA (conferir no YouTube). Higiene bucal continua sem duração: preencher no cadastro.
- (07/11, noite) Player: "⏳ Pensar" (10 s por padrão; sem, 10, 15, 20 ou 30 s) antes de liberar as alternativas, com botão "Liberar agora". Passador de slides: avançar libera a contagem e depois continua o vídeo; fora da pergunta toca/pausa; voltar recua 10 s.
- TR (doc G6fec36pTSYj3m6B7MwE3v): licença por estudante em dois níveis (1-A Intermediário, 1-B Completo), franquia 10 e 20 UPIA por professor; medição, estimativa, atestado, SLA e Anexo II ajustados. Vídeo interativo como requisito 4.2.5 (acervo, sem UPIA) e 4.2.6 (por link, 1/2 UPIA), e item 21 na prova de conceito.
- (07/11) Produção própria: marcação no cadastro do vídeo; card mostra o logo do Portal no canto de baixo. 32 vídeos do canal Portal do Educador marcados.
- (07/11) Botão '⚑ Avisar problema' na pergunta (vídeos do catálogo): professor escolhe o motivo e envia. Admin vê '⚑ N avisos' na lista de vídeos do painel e os avisos no topo da edição do vídeo, com 'ver' e 'resolvido'.

## Monitoramento · 07/11/2026
- Erros no navegador: páginas do Portal (entrar, vídeo, aula, atendimento, lousa) mandam os erros de JavaScript para a função registrarErro. Resumo por dia em erros_resumo; detalhe em erros_navegador (30 dias).
- Disponibilidade: GitHub Actions "Monitor" a cada 15 min (site, vídeo, funções, banco), placar em stats/disponibilidade_AAAAMM. Se cair, o GitHub manda e-mail.
- Resumo diário às 7h por e-mail para alan@newpc.com.br (só quando houver erro ou queda): erros, disponibilidade do mês e alerta se ficar abaixo de 99,5%.
- Testado no ar: 4 de 4 verificações ok; erro de teste capturado na página /video/.
- (08/11) Alan validou 3 vídeos interativos para a demo da SENACOP (tudo ok). O mosquito Vilão: duração corrigida (3:35) e interativo gerado sozinho pelo cadastro.
- Proposta registrada, aguardando o OK do Alan: "modo aluno" (fase 2, depois da SENACOP): aluno responde sozinho no tablet (Maestro), aberta escrita com a esperada só depois de enviar, sem pular e sem adiantar o vídeo, resultado por aluno para o professor; correção da aberta pelo professor (IA opcional depois).

## Termômetro da turma · 08/11/2026
- No Controle da aula: botão "🌡️ Termômetro da turma". O professor faz uma pergunta aberta (com sugestões prontas); cada aluno escreve no tablet; a barra mostra quantos responderam e o botão "🤖 Ler a turma com IA".
- A IA agrupa a turma (entendeu, entendeu em parte, confundiu, fora do tema), com explicação, exemplo de resposta, alunos de cada grupo, sugestão do que fazer agora e resposta esperada. A IA recebe só os textos, sem nomes.
- Central de IA: recurso "Aula ao vivo · Termômetro da turma", padrão Intermediário e Completo; 1 crédito por leitura.
- Testado no ar com turma simulada de 5º ano (fotossíntese): 12 respostas em 13 s, grupos corretos (confusão com respiração e "planta come terra" identificadas); professor que não conduz a aula é recusado.
- Próximos (a partir de quinta 12/11): diário de classe automático, envio adaptado e dúvidas repetidas.

## 08/11 · Termômetro no Painel da Escola e da Rede (opção B) + medidor de créditos na Turma ao Vivo
- aulaIa (termometro): a cada leitura grava termometro_registros/{turma}_{pergunta} com município, escola, turma, pergunta, contagens (entendeu, parcial, confundiu, fora) e rótulos dos grupos. Sem texto e sem nome de aluno. "Ler de novo" substitui.
- Regras: termometro_registros só leitura do admin; escrita só pelo servidor.
- painelSecretaria: bloco termometro (30 dias) na rede e por escola; o gestor vê só a escola dele e a comparação "rede x%".
- /painel/: seção "Termômetro das aulas" (KPIs entenderam / em parte / confundiram, barra de composição, ranking por escola na rede, lista "Onde as turmas se confundiram"); frase no relatório executivo quando 25% ou mais das respostas mostram confusão.
- Turma ao Vivo: medidor "✨ N créditos" ao lado de "Sair do painel" (verde, laranja abaixo de 20%, vermelho zerado; atualiza depois de cada leitura; admin vê "IA admin").
- Histórico da turma: linha do Termômetro mostra "🌡️ n resp. ✅ 🟡 ❗ ➖" (antes aparecia undefined).
- Aluno: resposta nova da pesquisa apaga a sobra da anterior (texto x cor).
- Teste e2e teste-termometro confere o registro do painel e que não vaza texto de aluno.
- Fora de escopo, de propósito: evolução por aluno (opção C) por LGPD.
- 08/11: Controle da aula com botões compactos numa linha (quebra em 3 colunas abaixo de 1100 px).

## 08/11 · Lousa: Passar a limpo (IA lite, grátis para o professor)
- Menu IA da Lousa: "✍️ Passar a limpo". Seleciona a letra à mão, a IA (gemini-3.1-flash-lite) lê a foto e devolve blocos (título, parágrafo, item, numerado, fórmula); entram textos editáveis no lugar, na mesma cor; Desfazer volta a letra.
- Sem crédito; limite diário por professor em ia_limite_diario/{uid}_{dia} (config/portal_ia.limpo_dia, padrão 100); falha devolve o uso. Custo no painel de IA como lousa_limpo.
- Central de IA: recurso lousa_limpo (Intermediário e Completo; geral ligado, avulso desligado). Redes com lista própria na Central precisam marcar.
- Núcleo functions/lousa-limpo.js; teste consulta limpo-teste com 3 amostras cursivas: 100% certo, 1,4 a 1,8 s, ~R$ 0,001 por uso.
- 08/11: Passar a limpo publicado (portalIa + site); e2e limpo-e2e ok em 2,2 s; regressão do Portal IA ok.

## 08/11 · Créditos: regra de acúmulo (decisão do Alan)
- Rede: a franquia acumula até o fim do contrato (pacote mensal vale até vigencia_fim_ts; sem data, fim do mês como antes) e vence com ele. Teto mensal por professor padrão = 2× franquia (servidor tetoRede e tela crTeto). Texto do admin atualizado.
- Assinante avulso: sobra passa 1 mês, no máximo 2 franquias juntas (acumulo_assinante_meses: 1 na config; programar junto com o pagamento automático).
- Pacotes comprados: 12 meses (sem mudança).
- TR item 3.4: franquia cumulativa na vigência, limite mensal de até 2× por professor, saldo se extingue no fim da vigência.
- Tabela de preços e as duas apresentações atualizadas. Falta publicar as funções que usam creditos.js e o site.
- 08/11: publicado (7 funções + site). Regressão do Portal IA ok; teto do laboratório já aparece 240 (dobro do Completo).

## 08/11 · Financeiro (/financeiro/)
- Página própria, acesso só por e-mail verificado: dono alan@newpc.com.br (fixo nas regras) + lista fin_acesso/lista (até 30), que só o dono edita na aba "Quem tem acesso".
- Abas: Visão geral, Recebimentos, Conciliação, Notas fiscais, Inadimplência, Auditoria. Lê fin_pagamentos, fin_repasses, fin_notas, fin_auditoria (vazias até a cobrança automática).
- Financeiro só marca nota emitida (com número) e repasse conciliado; auditoria só cria. Admin do Portal fora da lista não entra.
- Testes: scripts/teste-regras-financeiro.mjs (rodam no deploy das regras).
- 08/11: Financeiro ganhou a aba Comissões (fin_config/comissoes; só o dono grava; financeiro lê). Lucro = receita − impostos (%) − taxas Asaas (opcional) − outros custos do mês.
- 08/11: Financeiro publicado (regras com 29 testes ok + site).
- 08/11: Comissões por projeto (fin_config/comissoes.projetos: nome, cliente, recebido no mês, custos; equipe.base = 'lucro' ou id do projeto). Lucro do projeto = recebido × (1 − imposto%) − custos.
- 08/11: comissão por projeto publicada (30 testes ok).

## 08/11/2026 · Fábrica de cursos com IA (Formação Continuada)
- Admin da Formação > Cursos > "✨ Gerar com IA": tema, público, carga horária (1 a 40 h), nível, orientações e material base opcional (texto colado até 60 mil caracteres ou PDF até 7 MB).
- Gera em duas etapas: plano (módulos, aulas, 8 a 12 questões com gabarito, competências BNC-Formação) e depois o texto das aulas, um módulo por pedido em paralelo. Leva de 1 a 4 minutos.
- A soma da duração das aulas fecha com a carga horária do certificado. Cada aula termina com atividade prática.
- Nasce como RASCUNHO com campo ia {gerado, revisado:false, pendencias}. Publicação bloqueada até alguém clicar "Revisei este curso" (função revisarCursoIA). Aula que a IA devolveu vazia vem marcada "[Conteúdo a completar]" e também bloqueia.
- Regras: o campo ia só a função grava (teste scripts/teste-regras-cursos-ia.mjs, 8 casos).
- Limite: 10 cursos por pessoa por dia (formacao_ia_uso). Custo registrado em creditos/admin e stats/ia_uso (acao formacao_curso).
- IA proibida de inventar número de lei, pesquisa, estatística ou citação fora do material base.
- Arquivos: functions/curso-ia.js (puro), functions/formacao-ia.js (gerarCursoIA, revisarCursoIA), domain.js (trava), formacao/admin/index.html.
- Commit eddb2af em vitrine-ia. Publicação pendente de aprovação.
- 08/11 15h: PUBLICADO (site main/migracao-www; funções gerarCursoIA, revisarCursoIA, publicarCurso; regras; CURSOS IA 8 ok, FINANCEIRO 30 ok).
- Curso de teste gerado: "Lousa Digital na Prática: da Aula Expositiva à Participação dos Alunos" (id lousa-digital-na-pratica-da-aula-expositiva-a-part-abc86b), 8 h, 4 módulos, 11 aulas (480 min), 9 questões, ~3 min. Em rascunho aguardando revisão.
- Achados da leitura: palavra sem sentido no meio de um texto ("Aguilera", aula m3a1), passos escritos na 3ª pessoa ("Define", "Apresenta") em vez de imperativo, aulas um pouco curtas para a duração (~440 palavras em 45 min, contando a atividade prática).
- 08/11 16h30: ajustes publicados (só gerarCursoIA). Achado: o Gemini degenerava ("frase-salada", ex.: "Aguilera", "unidade de ensino municipal ou estadual de atendimento básico diário regular...") em textos longos dentro de JSON; um módulo inteiro chegou a vir vazio.
  Correção: uma aula por pedido, escrita em texto livre (Markdown) e convertida para HTML no servidor; detector de texto degenerado (frase >40 palavras ou 4 palavras repetidas 4x); revisão de língua por aula com o modelo rápido (aceita só se não encurtar >25%); até 3 tentativas; sobra vira pendência. Passos no imperativo. geminiFluxo ganhou parâmetro limiteCampo (padrão inalterado).
  Teste final (Formulários Google, 4 h): 5 aulas de 550 a 620 palavras, maior frase 18 palavras, zero pendências, ~2 min.
- Rascunhos de teste no admin da Formação: lousa-digital-...-abc86b (o bom, para revisar), chromebook-...-c622c6 (módulo vazio), chromebook-...-b1ce0f (uma frase-salada), avaliacao-formativa-...-9ff70e (2 pendências), avaliacao-formativa-...-7a40d0 (versão final, boa). Perguntar ao Alan se exclui os 3 ruins.
- 08/11 16h40: excluídos os 3 rascunhos de teste com defeito (c622c6, b1ce0f, 9ff70e). Ficam: Lousa Digital na Prática (abc86b, revisar) e Avaliação Formativa com Google Formulários no Chromebook (7a40d0).
- Doc "Roteiros de gravação · Lousa Digital na Prática" (Claude Docs 601ab84e-fe6e-4105-83ba-20adb14c4921): 11 roteiros + tabela de correções da aula 1.1 (frase-salada) e 1.2 (cortina/refletor/lupa não existem na Lousa).

## 08/11/2026 · Relatório da Formação para a Secretaria (IA)
- Painel da Escola/Rede > Formação Continuada > botão "🧠 Relatório da formação (IA)": KPIs (engajamento, concluíram, pararam, horas certificadas), resumo, destaques, pontos de atenção, recomendações com o dado que justifica, próximo passo de 30 dias, tabela por escola, cursos e competências BNC-Formação (lidas da descrição dos cursos da Fábrica). Botão Baixar PDF (jsPDF, cabeçalho da prefeitura).
- Função relatorioFormacaoIA (formacao-ia.js) reaproveita montarAcompanhamento (formacao-uso.js refatorado; formacaoAcompanhamento continua igual). A IA recebe só números por escola e curso, nunca nome (teste confirmou). Limite 10 por pessoa por dia; custo na conta admin (acao formacao_relatorio). Se a IA falhar, mostra os números e avisa.
- Commit ce7287e em vitrine-ia. Publicação pendente de aprovação (funções relatorioFormacaoIA + formacaoAcompanhamento, site painel).
- 08/11 17h: PUBLICADO (relatorioFormacaoIA, formacaoAcompanhamento, painel). Teste real em Campo Grande: funcionou em ~20 s, texto coerente com os números, franco sobre poucos dados.
  Ajuste publicado: escola sem nome aparecia como código interno ("YJ7S53...") ou "-"; agora "Sem escola identificada".
  Atenção: o card do Painel mostra "Adesão 20% / 4 sem começar" e o relatório "17% / 5 de 6": bases diferentes (o card conta professores do Portal; o relatório e a lista contam também perfis da Formação). Alinhar a definição antes de demonstrar.

## 08/11/2026 · Catálogo "Em breve" na Formação (publicado)
- formacao/index.html: lista EM_BREVE com 14 cursos dos recursos do Portal (Lousa Digital na Prática, Portal do Educador do zero, Portal IA na prática, Provas e Avaliações, Turma ao Vivo e Termômetro, Minhas Turmas no dia a dia, Conteúdo pronto na aula, Portal 360º VR e apps 3D, Lousa com IA, Inclusão, Painel da Escola, Gestão Escolar no Portal, Acervo da rede, Formação em serviço no HTPC). ~76 h.
- Aparecem na página inicial (abaixo dos destaques) e no catálogo, com selo EM BREVE, sem link. Somem sozinhos quando um curso publicado tiver no título a "chave" do item (ex.: "portal ia na pratica"). Ao gerar o curso, manter o título com a chave.
- Capas: reaproveitam as 5 fotos dos personagens NEWPC (fc-*.webp); há repetição. Pendente: capas próprias.
- Próximo: gerar os cursos com material base tirado do código (prioridade: Portal do zero, Portal IA, Provas, Turma ao Vivo).

## 08/11/2026 · 4 cursos do Portal gerados com material base (rascunho, aguardando revisão)
- Fábrica: campo "Título (opcional)" (gerarCursoIA aceita titulo e sobrepõe o da IA), para casar com a chave do cartão Em breve.
- Material base = trechos do Manual do Usuário (/tmp/claude-0/manual2/parte1.md, v2.40) + notas do Termômetro; publicados no ramo formacao-material (zero.md, ia.md, provas.md, aovivo.md) e lidos pela página do admin. Foco obrigatório: só recursos/botões do material, nomes em negrito.
- Cursos (ids): portal-do-educador-do-zero-primeiro-acesso-turmas--32b365 (4 h, 5 aulas), portal-ia-na-pratica-planejar-e-criar-materiais-co-e7d99f (8 h, 5 aulas), provas-e-avaliacoes-criar-aplicar-online-corrigir--b3f90c (8 h, 11 aulas), turma-ao-vivo-e-termometro-participacao-e-avaliaca-6fcb0d (4 h, 5 aulas). Zero pendências; aulas de 466 a 676 palavras.
- Conferência automática: termos em negrito comparados com o material; os que não estavam no trecho foram conferidos no manual inteiro e no código (embaralhamento, cronômetro do servidor, Mapa de notas, Boletins, bateria, mão levantada: existem). Nenhum recurso inventado encontrado.
- Ponto de revisão: Portal IA tem 8 h em 5 aulas (~1h36 cada); avaliar baixar para 4 h ou regenerar com mais aulas.

## 08/11/2026 · Revisão dos 2 cursos publicados (novas versões em rascunho)
- Publicados: "Curso de Iniciação - Word 365" (n0tLYU9GqzhGrc48EsSv, 6,3 h, 10 aulas, 10 questões) e "Lousa Digital - NEWPC TECNOLOGIA" (GFOqsabKxm2OpaurvgVY, 4 h, 18 aulas, 10 questões). Curso publicado é protegido; correção via "Criar nova versão".
- Novas versões: Word rfXrroFW3NCorxaO8jyQ; Lousa kjrueIydtDYl0ESCBsZk (títulos sem "(versão 2)").
- Word: tirado o prefixo "Módulo N - Aula N –" dos 10 títulos; removido o cabeçalho repetido no topo de 7 aulas; 1 subtítulo em caixa alta normalizado. Durações mantidas (380 min = 6,3 h; vídeos longos). Gabarito das 10 questões conferido.
- Lousa: removidos títulos repetidos e a faixa "Lousa Digital | NEWPC TECNOLOGIA" no topo das aulas; subtítulos em caixa alta normalizados; durações que eram menores que o tempo de leitura subiram (ex.: Acessibilidade 3→12 min, Aplicações pedagógicas 5→17, Introdução 15→25, Conectividade 10→23): soma 322 min, carga horária 4 h → 5 h. Checklist de publicação todo verde.
- Pendente decisão do Alan: publicar as novas versões e arquivar as antigas (progresso e certificados ficam no curso original).
- 08/11 17h40: PUBLICADAS as versões corrigidas e ARQUIVADAS as antigas (Alan: ninguém concluiu). Na validação do catálogo, os módulos do Word ainda traziam "Módulo N –" no nome (duplicado com o selo MÓDULO N): feita a versão 3 do Word com os 4 módulos renomeados, publicada, e a versão 2 arquivada. No ar: Word 365 (6,3 h) e Lousa Digital NEWPC (5 h), mais os 14 cartões Em breve.

## 08/11/2026 · Formação: curso exclusivo de rede (publicado e testado)
- Admin > curso > Publicação > "Quem pode ver este curso": Todas as redes ou Só as redes escolhidas (lista das 14 redes). Grava pela função definirRedesCurso (só admin; vale para curso publicado). Campos redes[] e exclusivo.
- Professor: catálogo público filtra exclusivo==false (índice status+exclusivo+ordem); os exclusivos da rede dele vêm pela função cursosDaRede após o login, com selo "Formação da sua rede".
- Trava: regras (fVisivel: publicado e aberto, ou municipio_id do cadastro do Portal está em redes; vale para curso, módulos e aulas) e funções (exigirRede em iniciarAula, acompanharAula, sortearProva, emitirCertificado). Busca do Portal não indexa exclusivo.
- Certificado de curso exclusivo: linha "Formação promovida pela Secretaria Municipal de Educação de X/UF, em parceria com o Portal do Educador" (campo promotor, também na consulta pública).
- Preparação: os 30 cursos receberam exclusivo=false (consulta cursos-exclusivo-gravar). Ordem do deploy sem queda: preparo, índice e funções, site, regras.
- Testes: CURSOS IA 18 ok (inclui rede A lê, rede B não lê curso nem aula, visitante não lê exclusivo). Teste no ar: Lousa NEWPC exclusiva de Campo Grande apareceu com o selo para o Alan; leitura sem login deu 403; depois voltou para todas as redes.
- Modelo comercial proposto (opção A): NEWPC produz o curso da rede com o material da Secretaria (Leonardo + Fábrica), cobrado por curso ou pacote anual. Opção B (Secretaria como editora) fica para depois.

## 08/11/2026 · Atividade prática com retorno da IA (publicado e testado)
- Aula (formacao/index.html): painel "Atividade prática: conte como foi" abaixo das anotações (aulas com texto). Relato de 80 a 3.000 caracteres, aviso "Não escreva nomes de alunos", até 3 envios por aula (fica o último).
- Função praticaFormacao (formacao-ia.js): confere cadastro ativo, curso publicado e rede (exclusivo); pega o trecho "Atividade prática" da aula; IA devolve situação (aplicou / planejou / incompleto), o que funcionou, sugestão e pergunta de reflexão. Grava users/{uid}/praticas/{curso}__{aula} (regras: só o dono lê, só a função grava). Limite 20 por dia; custo na conta admin (acao formacao_pratica). Só texto: foto de sala pode ter rosto de aluno, fica para depois com moderação.
- Relatório da Secretaria: KPI "Aplicaram em sala" (professores que relataram ter aplicado) e práticas relatadas por escola; a IA destaca como evidência de aplicação. PDF com 5 indicadores.
- Testes: CURSOS IA 21 ok. Teste no ar (Alan, Lousa NEWPC, aula Introdução): retorno em ~10 s, "Aplicou com a turma", comentário específico ao relato.

## 08/11/2026 · Lembrete para quem parou + "Onde os professores pararam"
- Função agendada lembretesFormacao (formacao-lembretes.js): dias úteis 9h10 (Campo Grande). Curso começado, não concluído, sem acesso há 7+ dias: e-mail "Seu curso está esperando por você" com % feito, aulas que faltam, aula onde parou e botão "Continuar de onde parei" (link direto para a aula). Máx. 3 por curso, 14 dias entre eles, até 150 por rodada; pula quem desmarcou, inativo, sem e-mail ou e-mail técnico de aluno. Controle em formacao_lembretes/{uid}__{curso}; resumo diário em stats/formacao_lembretes.
- Perfil da Formação: caixa "Lembretes por e-mail" (users.lembretes, regra aceita só sim/não). lembretesFormacaoTeste (admin): simula quantos receberiam ou manda um exemplo para o próprio admin.
- Relatório da Secretaria: tabela "Onde os professores pararam" (curso, aula, quantos), na tela e no PDF; a IA aponta aula com muita gente parada para revisão.
- Publicado (CURSOS IA 23 ok). Simulação no ar (consulta lembretes-simular): 2 cursos em andamento na base, nenhum parado há 7+ dias, então a rodada de amanhã não envia nada. Prévia do e-mail: scratchpad/exemplo-lembrete-formacao.png.

## 08/11/2026 · Migração de progresso entre versões (publicado)
- publicarCurso (status publicado) chama migrarProgressoVersao: para curso com origemId, copia o progresso de quem estava no meio da versão anterior para users/{uid}/progresso/{novo}. Aula conta como feita se tem o mesmo id e os mesmos vídeos (texto corrigido não obriga refazer; vídeo trocado, sim). Mantém última aula e data de início; concluídos não migram (já têm certificado); não sobrescreve quem já tem progresso na nova; marca migradoDe; auditoria migrarProgresso. Avaliação não migra (prova pode ter mudado).
- Admin vê no aviso: "O progresso de N professor(es) da versão anterior foi levado para esta versão."
- migrarProgressoCurso (admin) refaz a migração; idempotente. Consulta migracao-simular (só leitura).
- Rodado agora na Lousa NEWPC: 1 professor migrado (estava no início, 0 aulas concluídas, última aula mantida); segunda rodada: 0 (idempotente). Word: ninguém em andamento.

## 08/11/2026 19h30 · 5 cursos do Portal PUBLICADOS (ordem do Alan: "Pode publicar")
- Antes de publicar, corrigido na Lousa Digital na Prática: aula 1.2 reescrita com os recursos reais da Lousa (fundos reais, Ponteiro laser, Post-it no lugar de "cortina", Marca-texto, Zoom, Salvar em PDF/PNG, Meus trabalhos); aula 1.1 sem a frase-salada; aula 3.2 sem "cronômetro na lousa" (não existe; virou celular ou relógio da sala). Varredura das outras aulas: nada mais.
- Revisão IA confirmada (conta do Alan, por ordem dele) e publicados: Lousa Digital na Prática (8 h), Portal do Educador do zero (4 h), Portal IA na prática (8 h, 11 aulas), Provas e Avaliações (8 h), Turma ao Vivo e Termômetro (4 h).
- Catálogo: 7 cursos publicados (+ Word 365 e Lousa NEWPC), 9 "Em breve" (os 5 sumiram sozinhos). Ficou de fora: "Avaliação Formativa com Google Formulários" (teste, fora da linha só-Portal), em rascunho.
- Cursos publicados ainda SEM vídeo: Leonardo grava depois; para incluir vídeo, usar Criar nova versão (o progresso migra; aula com vídeo novo precisa ser refeita).

## 08/11/2026 21h45 · Formação abrindo mais rápido (publicado)
- Medição antes (login do Alan): cartões só em ~15 s. Causa: tudo em fila (token, vincularContaFormacao ~4 s com servidor frio, depois cursosDaRede ~3,3 s, depois leituras do usuário); registrarEntrada ocupando em paralelo.
- Correção: vincularContaFormacao já devolve os cursos exclusivos da rede (cursosDaRedeDe; cursosDaRede mantida); o cliente lê progresso, provas e certificados EM PARALELO com a liberação e só lê o perfil depois dela (criar o perfil antes apagaria os dados da rede); certificado antigo ligado na liberação força nova leitura.
- Depois: 4,0 s na primeira abertura, 1,7 s na seguinte (15 cursos na tela).
- Opção não feita: deixar vincularContaFormacao com 1 instância sempre ligada (tira o ~3 s de servidor frio; custo mensal pequeno, a confirmar).

## 08/11/2026 22h · Rede Municipal de Demonstração (SENACOP) criada e conferida
- Rede demo-rede ("Rede Municipal de Demonstração/MS"), tudo com demo:true e ids "demo-": 4 escolas (Cecília Meireles, Paulo Freire, Anísio Teixeira, Monteiro Lobato), 36 professores + 4 gestores SEM e-mail, 16 turmas, 379 estudantes genéricos, frequência (alerta=false), 32 provas BNCC com 674 respostas, 68 equipamentos, 14 chamados, 4 TVs, 5 busca ativa, 18 relatórios, 22 Termômetros, 304 acessos em 30 dias; Formação com cursos reais: 62 cursos em andamento/concluídos, 19 certificados DEMO-... (não passam na validação: formato AE-), 32 práticas.
- Faixa no Painel: "Ambiente de demonstração · dados simulados... Nenhuma pessoa, escola ou número desta rede é real."
- Travas antes de semear: gatilhos sem e-mail/crédito/auditoria para demo (emailNovoCadastro, emailCertificadoEmitido, emailRelatorioEnviado, emailChamadoTecnico, emailTvConectada, creditosDemoTeste, comunicacaoProfessor, auditarBanco/Sub); uso real e resumo diário descontam demo; lembretes não alcançam (sem e-mail, lembretes=false).
- Consultas: demo-criar-gravar (idempotente), demo-apagar (só conta; checagem de segurança: nada fora da demo), demo-apagar-gravar (remove e confere). Contagem atual: 1.653 documentos + 94 em subcoleções.
- Conferido no ar: Painel da Rede cheio (90% professores ativos, 64% acerto, 94% frequência, Termômetro com confusões, Formação 72% adesão, 112,6 h); relatório da Formação com IA coerente ("Concluíram curso" agora = ao menos 1 curso, igual ao painel).
- Não semeado: calendário letivo (aparece "não publicado") e chamadas do dia.

## 08/11/2026 · Página principal (index.html) atualizada (branch vitrine-ia, aguardando aprovação para main)
- Nova seção "IA embarcada" (#ia): vídeo interativo, Termômetro da turma, Lousa com IA, Portal IA. Prints reais em assets/home/.
- Nova seção "Formação Continuada" (#formacao): estude, aplique com a turma (retorno da IA), a gestão acompanha; faixa de formação exclusiva da instituição.
- Recursos: "Vídeos Interativos" e "Formação Continuada" com texto novo e selo "novo". FAQ (HTML e JSON-LD) com 2 perguntas novas.
- Menu: entram "IA na aula" e "Formação"; saem "Notícias" e "Sua instituição". Corrigido estouro do cabeçalho (botão Teste grátis cortado em 1366 px, problema anterior).
- Legenda nas duas seções: telas com dados da rede de demonstração.
- 09/11: texto reescrito com gatilhos honestos (dor, alívio, controle, prova visual, risco zero, visualização). Novo bloco "Antes/Durante/Depois da aula" e "Nosso compromisso com a IA na educação". Sem escassez falsa nem depoimento inventado. Botão "Teste grátis" do topo não quebra mais linha.
- 09/11 03:10: PUBLICADO (main e migracao-www, commit 6270107). Conferido no ar: seções IA com propósito, compromisso com a IA e Formação.
- 09/11: Formação com capas próprias (assets/formacao/fc-*.webp, 960x540): portal-zero, portal-ia, provas, minhas-turmas, conteudo-pronto, vr-3d, lousa-ia, inclusao, painel-escola, gestao-escolar, acervo, htpc; gerais novas fc-parceria e fc-foco. Mapa por título em capaPadrao (capaURL do curso continua tendo prioridade). Turma ao Vivo segue com fc-google até ter capa própria. PUBLICADO.
- 09/11 05:40: PUBLICADO site (303da61) e função vincularContaFormacao. Perfil sem nome puxa o nome do Portal; "Começar o curso" com cadastro incompleto (nome+sobrenome, município, escola) abre a atualização cadastral e segue para a aula; CPF continua só no certificado. Home: fotos home-lousa-ia e home-portal-ia na seção de IA.
- 09/11 05:55: CORRIGIDO regressão minha (commit c2840c9, abertura em paralelo): um "else" antigo zerava E.perfil, E.progresso, E.tentativas e E.certificados na tela a cada abertura. Banco intacto (progresso só a função grava). Publicado 698e762.
- 09/11 07:30: Créditos · tipo "Cortesia da diretoria" no Lançar créditos (origem 'cortesia', obs prefixada) e bloco "Cortesias da diretoria" (dados, usados, restam, custo real estimado pelo custo médio da conta, valor de tabela). Lançamentos manuais antigos com "cortesia" na observação também entram. Retirar pacote agora zera e guarda "retirado" (não apaga). Publicado site c749748 + creditosAdmin. Pendente: no próximo deploy geral de functions, as que debitam (portal-ia, aula-ia...) pegam o saldoDe novo (total sem retirados, afeta só o % do alerta).
- 09/11 09:30: Termômetro da turma e parecer da turma GRÁTIS (sem crédito), com uso justo diário por professor (usoJustoDiario em creditos.js; ia_limite_diario/{uid}_{dia}; padrões termometro 60/dia, parecer 150/dia, ajustáveis em config/portal_ia termometro_dia/parecer_dia). Custo continua no stats/ia_uso. Telas sem menção a crédito. Publicado adf2cde + aulaIa e pareceres. Passar a limpo já era grátis (100/dia).
- 09/11 12:15: PAGAMENTOS ASAAS no ar em modo TESTE (sandbox, conta PF do Alan). functions/asaas.js: pagamentos (opcoes/criar), asaasWebhook (token no cofre, gerado pela integração), asaasAdmin. fin_pedidos, fin_clientes (CPF só mascarado), fin_pagamentos, fin_notas, fin_auditoria. Licenças à venda: intermediario-mensal 59,90 e completo-mensal 99,90 (LICENCAS em asaas.js); créditos = pacotes_professor. Com chave de teste, compra direta só para admin e config/pagamentos.testadores. Workflow pagamentos-asaas (situacao/segredos/webhook). Assets: pde-pagar.js (Portal IA "Comprar créditos" e botões Assinar/Renovar com data-lic-cta). Pendente: teste de ponta a ponta; ao trocar para a chave oficial (CNPJ), rodar segredos + webhook e republicar as 3 funções.
- 09/11 12:35: TESTE E2E OK (sandbox): prof.ciencias comprou 100 créditos R$ 49,90 → pago (boleto, taxa 0,99, líquido 48,91) → 100 créditos liberados, fin_pagamentos e auditoria gravados. Falta: teste da licença (conta de professor em teste) e ir para produção (CNPJ/conta oficial + chave Pix).
- 09/11 16:00: Teleprompter: editor por blocos (Bloco N, "+ Novo bloco" após cada um, × apaga com confirmação e versão guardada, Ctrl+Enter cria o próximo); texto continua salvo como blocos separados por linha em branco (compatível com roteiros antigos e controle pelo celular). Botão "Foco" virou "Apresentar": só o texto; controles somem em ~3 s mesmo pausado e voltam ao mexer o mouse/tocar. Publicado.
- 09/11/2026: Manuais publicados na Documentação: Usuário v2.41, Completo v2.56, POPs v2.28 (POP-PDE-01 a 41). Ramo manuais commit 9aa7e43.
- 09/11/2026: Lara (WhatsApp): memória curta (2 h, 6 mensagens), lista wa_sem_resposta (nao_sei/nao_resolveu) com Resolvida/Ignorar no admin, bloco 'A Lara em números' (30 dias). Base recarregada com Manual do Usuário v2.41: 122 trechos. Próximos: imagens (política LGPD) e Lara interna com POPs (wa_equipe).
- 09/11/2026: Lara lê imagem (verImagem: tipo tela/equipamento/outro, descrição sem dados pessoais; imagem não guardada), foto de equipamento oferece chamado (foto_desc, 2 h), modo equipe (admin ou wa_equipe ativo) com bases pops (183) e manual-equipe (89) publico=equipe, filtro no servidor. Manuais Usuário v2.42, Completo v2.57 publicados.
- 10/11/2026: POPs v2.29 publicados (POP-PDE-32 com quadro Quem pode). Achado: secretaria_escolar abre aula (podeGerar) mas não conduz (equipeTurma nas regras só tem gestor e secretaria); secretaria municipal conduz pelas regras mas não abre. Aguardando decisão do Alan.
- 10/11/2026: fechado: só professor da turma, gestor e admin abrem/conduzem aula (podeAbrirAula, conduzAula sem secretaria). POPs v2.30.
- 10/11/2026: POPs v2.31 com logotipo NEWPC no cabeçalho e Portal no rodapé (build.py: MARCAS=1, CAB_TXT; imagens em fontes/marcas).
