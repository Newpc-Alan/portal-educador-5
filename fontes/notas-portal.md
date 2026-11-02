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
