# Portal do Educador 5.0 · Inventário das páginas (exceto /entrar/)

Material de apoio para o Manual do Usuário. Levantado direto do código em `/home/claude/portal-educador-5` (out/2026).
Tudo o que está aqui foi lido no HTML/JS das páginas, nas Cloud Functions (`functions/`) e nas regras (`firestore.rules`, `storage*.rules`).
Quando algo não ficou 100% claro no código, está marcado **(confirmar)**.

Convenções deste documento:
- Nomes de botões e menus aparecem entre aspas, exatamente como estão na tela (com o emoji, quando houver).
- "Perfis" segue o campo `usuarios/{uid}.perfil`: `professor`, `gestor` (direção/coordenação da escola), `secretaria` (Secretaria Municipal de Educação), `secretaria_escolar` (secretaria da escola), `portaria`, `aluno`, `admin` (equipe NEWPC).
- Quase todas as páginas exigem login (redirecionam para `/entrar/` sem conta ou com cadastro inativo). Exceções: `/chamado/`, `/validar/`, `/tv/` (player), `/lousa/` (funciona sem login, mas sem nuvem), `/aluno.html` (legado), `/` e `/vitrine/`.
- **Modo de teste do administrador ("Entrar como")**: em várias páginas o admin vê a tela como outro perfil (lido de `sessionStorage.pde_ver_como`). Aparece o aviso "Modo de teste: você vê esta tela como ...". O que for salvo nesse modo é gravado de verdade.
- **Plano do município**: cards da Gestão Escolar e alguns recursos podem aparecer com o selo "🔒 Fora do plano" (campos `municipios.modulos_professor`, `modulos_secretaria`, `recursos`).

---

## Ordem de relevância (professor e gestão)

1. Gerador de Provas · `/provas/`
2. Prova online · `/prova/` (aluno e painel ao vivo do professor)
3. Frequência · `/apps/frequencia/`
4. Notas e Médias · `/apps/notas/`
5. Corretor de Gabarito · `/apps/corretor/`
6. Central de Relatórios · `/relatorios/`
7. Lousa Interativa Premium · `/lousa/`
8. Gestão Escolar (hub) · `/gestao/`
9. Aplicativos Úteis (hub) · `/apps/`
10. Turma na Lousa · `/apps/turma/`
11. Calendário e Dias Letivos · `/apps/calendario/`
12. Recursos da Escola · `/apps/recursos/` e Chamado do equipamento · `/chamado/`
13. Famílias · `/apps/familias/`
14. Equipe da escola · `/apps/equipe/`
15. Painel da Rede / Painel da Escola · `/painel/`
16. Portal do Educador TV · painel `/apps/tv/` e player `/tv/`, `/tv/leve/`, `/tv/teste/`
17. Folha Mágica · `/apps/folha/`
18. Teleprompter · `/apps/teleprompter/` e `/apps/teleprompter/controle/`
19. Biblioteca e Histórias Educativas · `/biblioteca/`
20. Desenhos para Colorir · `/colorir/`
21. Dicas do Professor · `/dicas/`
22. Museus Virtuais · `/museus/`
23. Formação Continuada · `/formacao/` e Validar certificado · `/validar/`
24. Painel da Formação (equipe NEWPC) · `/formacao/admin/`
25. Página inicial `/`, `/vitrine/` e `/aluno.html` (legado)
26. Anexos: perfis × páginas, limites consolidados, pontos a confirmar

---

## 1. Gerador de Provas e Avaliações · `/provas/`

**Título da página:** "Gerador de Provas · Portal do Educador". Cabeçalho: "Gerador de Provas e Avaliações".

**Para que serve:** montar provas (objetivas, dissertativas, mistas, simulados etc.), imprimir com várias versões embaralhadas e gabarito por versão, gerar Plano de Aula com BNCC, Versão adaptada (acessibilidade) e, se o município tiver o recurso, **aplicar a prova online** para a turma.

**Quem usa:** qualquer usuário com cadastro ativo (exige login). Na prática, professor, gestor e admin.
- O botão "📡 Aplicar online" só aparece se o município do usuário tiver `"prova_online"` em `municipios.recursos` (o admin vê sempre). Código: `P.provaOnline = P.admin || muni.recursos.includes("prova_online")`.
- A função `publicarProvaOnline` repete a checagem no servidor: perfil `professor`, `gestor` ou `admin`, a turma tem que ser do professor (em `turmas_ids`, ou criada por ele, ou gestor da escola da turma) e o município precisa ter o recurso. Mensagem quando não tem: "A Prova online não está incluída no plano da sua rede. Fale com a NEWPC."
- Admin sem município: aparece um seletor de município para ver a prova "como o professor daquela rede".

**Barra superior:** "📋 N questões", "⭐ N pts", "☰ Resumo", "📁 Minhas provas", "📡 Aplicar online" (condicional), "❔ Guia", "☁ Salvar" (vira "☁ Salvo na nuvem" quando a prova está guardada), "← Voltar ao Portal". Indicador "Salva sozinho neste aparelho".

**Faixa do cadastro:** mostra professor, escola e "Secretaria Municipal de Educação de X/UF" (ou "logo ainda não cadastrado"). Botão "Usar no cabeçalho" preenche escola, professor e logo do município/escola. Se o professor tem mais de uma escola, aparece um seletor.

### Passo a passo

**Etapa 1 · "Dados da prova" (Cabeçalho e instruções)**
1. Opcional: "Ver modelos →" ("Comece com um modelo pronto · 12 modelos por disciplina e série"). Abre "⚡ Escolha um modelo pronto".
2. Preencher "Cabeçalho da prova": Nome da escola, "Logotipo (opcional)" ("Enviar logo PNG ou JPG · até 2 MB"), Professor(a), Disciplina (lista longa do Fundamental ao Superior, ou "Digitar manualmente..."), Turma / Série, Data da avaliação.
3. "Instruções para o aluno (opcional)": modelos rápidos "✅ Objetiva", "✍️ Dissertativa", "📝 Mista", "🎯 Simulado", "📋 Diagnóstica", "🔄 Recuperação", "🧒 Anos Iniciais", "📚 Com Consulta".
4. Utilitários: "🗑️ Recomeçar", "💾 Backup" (exporta arquivo JSON), "📥 Restaurar".
5. "Continuar para as questões →".

**Etapa 2 · "Questões" (Monte a avaliação)**
1. "+ Adicionar questão" (campo de quantidade de 1 a 100 por clique), ou botão flutuante "＋ Questão".
2. Tipos de questão: Múltipla escolha, Múltipla escolha (várias), Verdadeiro / Falso, Resposta curta, Dissertativa, Grade (resposta única), Grade (várias respostas).
3. Em cada questão: "🖼️" (imagem, até 2 MB), "💾" (salvar no banco), "⧉" (duplicar), "✕" (remover), "+ Adicionar alternativa", "+ Linha" / "+ Coluna" (grades). Marcar a alternativa correta define o gabarito. Há campo de habilidade BNCC (o gerador sugere código por palavras-chave) **(confirmar o rótulo exato do campo)**.
4. "📚 Banco de questões": abas "📚 Minhas questões" e "📦 Pacotes do Portal". Filtros "⭐ Favoritas", "🔥 Mais usadas", "🆕 Recentes", "🔤 A-Z", "🧹 Limpar filtros"; em cada questão "+ Usar", estrela favorita, "🗑️"; "🗑️ Esvaziar tudo". Pacotes: "BNCC Anos Iniciais" (200 questões), "Simulado SAEB · 5º Ano" (50), "Recuperação" (100), "Avaliação Diagnóstica" (80); botão "📥 Importar pacote" (duplicadas são ignoradas). O texto da tela diz que são "amostras iniciais".
5. "🤖 Trazer da IA" ("Trazer questões da IA"): 1) Tema, Quantas questões (1 a 40), Tipos ("Só múltipla escolha", "Mista...", "Só verdadeiro ou falso", "Só abertas"), Nível (fácil, médio, difícil, misturado); 2) "📋 Copiar comando", "Copiar e abrir o ChatGPT", "Copiar e abrir o Gemini"; 3) colar a resposta e "Adicionar questões". A IA roda fora do Portal: o Portal só gera o comando e lê a resposta colada.
6. "👁️ Visualizar" (pré-visualização), "🗑️ Limpar todas", "← Dados da prova", "Ir para impressão →".

**Etapa 3 · "Gerar e imprimir" (Cópias, gabarito, plano)**
1. "Configurações de impressão": "Número de cópias" (1 a 200) e "Embaralhar": "Não embaralhar", "Questões e alternativas (versões diferentes)", "Só as alternativas". Dica da tela: "Com embaralhar ativo, cada cópia vira uma versão diferente".
2. "O que deseja gerar?": "Somente a prova", "Somente o gabarito", "Prova + gabarito único" (exige "Não embaralhar"), "Prova + gabarito por versão" (exige embaralhar ativo). Se a combinação estiver errada, aparece aviso ("Este modo requer...").
3. "Conferência final" e "🖨️ Gerar e imprimir" (abre a janela de impressão do navegador: papel ou PDF). Cada cópia embaralhada recebe o rótulo "Versão 1", "Versão 2"...; no modo por versão cada uma sai com o próprio "🔑 GABARITO · Versão N".
4. "📋 Plano de aula (BNCC)": documento separado com as habilidades BNCC das questões (exige questões).
5. "♿ Versão adaptada": mesma prova, sem embaralhar, letra grande e mais espaço ("baixa visão, TEA, TDAH e dislexia").

**Dica anticola que a própria tela ensina:** em "Número de cópias" colocar o número de alunos, escolher "Embaralhar" e o modo "Prova + gabarito por versão".

**"📁 Minhas provas" (nuvem e pastas)**
- Pastas: "Todas as provas", pastas criadas, "Sem pasta". "＋ Nova pasta", "Renomear pasta", "Excluir pasta" (confirmação: "as provas vão para Sem pasta").
- Busca, ordem "Mais recentes" / "Nome (A a Z)", "＋ Nova prova".
- Em cada prova: "Abrir", "Duplicar" (cria "Cópia de ..."), "Renomear", seletor "Mover para a pasta", "Excluir" (toque duplo: "Confirmar").
- "☁ Salvar": na primeira vez pede "Nome da prova" e "Pasta" (com "＋ Criar nova pasta..."). Dica da tela: pasta "2026 · 5º ano A".
- Salvamento automático na nuvem a cada 20 s quando a prova já está guardada; o banco de questões sobe a cada 60 s.
- Se a prova foi alterada em outro aparelho, aparece "Esta prova foi alterada em outro aparelho" com "Abrir a versão da nuvem" (recomendado) ou "Continuar com a deste aparelho".
- Aparelho compartilhado: ao trocar de professor, a prova e o banco do anterior são limpos do navegador.

**"📡 Aplicar online" (modal)**
1. Texto da tela: os alunos da turma veem a prova no Início do Portal do Aluno no horário marcado; tela cheia; 1 aviso e bloqueio na segunda saída; objetivas corrigidas sozinhas; nota aparece quando o horário termina.
2. Campos: "Turma" (as turmas do professor; se não tiver: "Cadastre a turma em Minhas Turmas"), "Dia", "Abre às", "Fecha às", "Tempo de prova (minutos)" (5 a 300, padrão 50), "Embaralhar questões e alternativas" (marcado por padrão).
3. Resumo: questões, pontos, "✍️ N para você corrigir depois" e alerta "⚠ N questão(ões) objetiva(s) sem gabarito marcado".
4. "Aplicar para a turma" → tela "Prova aplicada" com "Abrir o painel ao vivo ↗". Link "Ver provas online já aplicadas ↗" abre `/prova/`.

### Regras e limites
- Logo e imagem de questão: até 2 MB no editor. No envio online, cada imagem vira arquivo no Storage (máx. 3 MB cada, até 4 imagens por questão); prova total acima de ~900 KB de dados é recusada ("A prova ficou grande demais (imagens)").
- Online: máximo 100 questões; até 8 alternativas; grades até 12 linhas × 8 colunas; valor da questão de 0 a 100.
- O tempo de prova maior que a janela gera aviso: "quem começar tarde terá menos tempo".
- Alunos alcançados: contas de aluno ativas da mesma escola cujo `turma_nome` bate com o nome da turma (ignora acento, espaço, "º", "ano"). Se ninguém tiver conta: "Nenhum aluno da turma ... tem conta no Portal ainda".
- O UI sempre envia `avisos:1` (1 aviso antes do bloqueio). O servidor aceita de 0 a 3, mas não há campo na tela **(confirmar se haverá)**.

**Dados gravados:** rascunho em `localStorage` (`pe_provas_v3_state`); banco de questões em IndexedDB do aparelho + Storage `professores/{uid}/provas/_banco.json.gz`; provas em Storage `professores/{uid}/provas/{id}.json.gz` + Firestore `usuarios/{uid}/provas/{id}` e `usuarios/{uid}/pastas_provas`; online em `provas_online/{id}` e `provas_online_gab/{id}` (via função).

**Capturas sugeridas:** (a) Etapa 1 com cabeçalho preenchido e logo; (b) Etapa 2 com uma múltipla escolha e o banco aberto na aba Pacotes; (c) modal "Trazer questões da IA" nos 3 passos; (d) Etapa 3 com "Embaralhar" + "Prova + gabarito por versão" e a pré-visualização de "Versão 2"; (e) modal "Aplicar online" preenchido; (f) tela "Prova aplicada"; (g) "Minhas provas" com pastas.

---

## 2. Prova online · `/prova/`

**Título:** "Prova online · Portal do Educador". Topo com "← Portal".

**Para que serve:** o aluno faz a prova aplicada pelo Gerador em **modo protegido**; o professor acompanha ao vivo, libera alunos bloqueados, dá mais tempo, encerra e libera notas.

**Quem usa / checagens:**
- Exige login e cadastro ativo.
- `/prova/` sem parâmetro: lista. Perfis `professor`, `gestor` e `admin` veem "📡 Provas online" (as que ele aplicou, por `professor_uid`) com o botão "📝 Abrir o Gerador de Provas" e o texto "Para aplicar uma prova nova, abra o Gerador de Provas e use o botão 'Aplicar online'". Os demais (aluno) veem "📝 Minhas provas" (provas onde está em `alunos_uids`).
- `/prova/?id=ID`: tela do aluno. `/prova/?painel=ID`: painel do professor. Ações do painel só funcionam para o professor dono da prova ou admin (função `acaoProvaOnline`).
- Situações na lista: "Agendada", "Aberta agora", "Encerrada". Provas canceladas não aparecem.

### Passo a passo do aluno
1. Abrir a prova (pelo Início do Portal do Aluno ou pela lista). Tela de apresentação: disciplina, turma, professor, dia e horário, duração, nº de questões e pontos, e as regras:
   - "A prova abre em tela cheia. Não saia dela até entregar."
   - "Faça a prova em um aparelho só. Se abrir em outro, o primeiro sai da prova e a troca fica registrada para o professor."
   - Avisos: "Se sair da prova (trocar de aba, minimizar ou sair da tela cheia), você recebe 1 aviso. Na próxima saída, a prova é bloqueada e só o professor libera." (no tablet o texto diz "trocar de aplicativo, de aba ou ir para a tela inicial"). Com 0 avisos: bloqueia na hora.
   - "Cada resposta é salva na hora. Se a internet cair, entre de novo: você continua de onde parou."
   - "Quando o tempo acabar, a prova é entregue sozinha."
   - "A nota aparece depois das HH:MM, quando a prova terminar para todos."
2. "Começar a prova" (só aparece dentro da janela; antes: "🔒 A prova abre ... às ..."; depois: "O horário desta prova terminou").
3. Tela da prova: título, cronômetro "⏱ mm:ss" (fica destacado nos últimos 5 min), paleta numerada das questões (verde = respondida) e botão "Entregar"; rodapé "← Anterior", status "Salvando..." / "✓ Salvo" / "⚠ Sem conexão: tentando de novo...", "Próxima →" (na última vira "Revisar e entregar").
4. Tipos na tela: alternativas com letras A, B, C...; várias respostas ("Pode marcar mais de uma."); "✅ Verdadeiro" / "❌ Falso"; resposta curta (até 300 caracteres); dissertativa (até 5.000); grade (tabela de rádio ou caixas).
5. Entregar: "Entregar a prova?" lista as questões em branco ("Ficaram sem resposta: questões ..."), botões "Voltar à prova" e "Entregar agora".
6. Tela "Prova entregue": antes do fim da janela mostra "A nota aparece depois das ..."; depois, a nota "X de Y" e chips por questão (✓, ✗, … pendente). Se houver questões para o professor corrigir: "Parcial: X de Y pontos" + "N questão(ões) aguardando a correção do professor".

### Modo protegido (regras exatas do código)
- **Saídas contadas:** trocar de aba/minimizar (`visibilitychange`), perder o foco da janela (`blur`) e, no computador, sair da tela cheia. Eventos com menos de 2,5 s entre si contam uma vez só.
- **Aviso:** capa "⚠️ Atenção: você saiu da prova · Aviso N de M. Se sair de novo, a prova será bloqueada e só o professor poderá liberar." com "Voltar à prova".
- **Bloqueio:** ultrapassado o limite, a tentativa vira `bloqueada` e aparece "🔒 Prova bloqueada · Você saiu da prova. Chame o professor: só ele pode liberar. Esta tela atualiza sozinha quando ele liberar." Quando o professor libera: "🔓 O professor liberou" → "Voltar à prova".
- **Tablet e tela cheia:** em aparelho de toque, sair da tela cheia (teclado virtual, gesto) **não conta como saída**; aparece "🖥️ Volte para a tela cheia · Isso não conta como saída, mas trocar de aplicativo ou de aba conta." com "Voltar para a tela cheia". Se o teclado estiver aberto num campo de texto, o pedido espera.
- **Um aparelho por vez:** cada aba é uma sessão. Abrindo em outro aparelho/aba, o anterior mostra "📱 A prova foi aberta em outro aparelho · ... Agora ela está em: [Chromebook/iPad/Tablet Android/...]" com "Fazer neste aparelho". Cada troca entre aparelhos diferentes soma 1 em "trocas" e registra o evento para o professor.
- **Recarregar a página:** mostra "▶️ Continuar a prova" (precisa de um toque para voltar à tela cheia).
- **Bloqueios de teclado e mouse durante a prova:** copiar, recortar, colar, menu do botão direito, arrastar e atalhos Ctrl/Cmd + C, V, X, P, S, U, A ficam desativados. Ao tentar fechar a aba, o navegador pede confirmação.
- **Tempo:** o prazo é o menor entre (início + duração) e o horário de fechamento. Ao zerar, entrega sozinha ("⏱️ O tempo acabou · Entregando suas respostas..."). Uma rotina no servidor, a cada 5 minutos, entrega tentativas vencidas e encerra provas que passaram do horário (bloqueados no fim também são entregues).
- **Embaralhamento:** se ligado, a ordem das questões e das alternativas é sorteada por aluno (sempre a mesma para o mesmo aluno).
- **Gabarito:** o aluno nunca recebe o gabarito; a correção é no servidor.
- **Correção automática:** múltipla escolha e V/F com gabarito; resposta curta quando o professor informou respostas aceitas no campo de expectativa (separadas por `;`, `|` ou linha; sem diferenciar acento e maiúsculas; até 10). Curta que não bate fica pendente. Em branco vale 0. Dissertativa, "várias respostas" e grades ficam pendentes para o professor.
- **Notas após o horário:** o aluno só lê o resultado depois do `fecha_em` ou se o professor clicar "Mostrar notas já" (regra do Firestore).

### Passo a passo do professor (painel ao vivo, `?painel=ID`)
1. Cabeçalho: situação, título, disciplina, turma, horário, minutos, questões ("N corrigidas sozinhas"), pontos.
2. Botões: "Encerrar agora" (toque duplo: "Confirmar: entregar todas"; entrega quem está fazendo ou bloqueado) e "Mostrar notas já" (libera as notas antes do horário).
3. Indicadores: Alunos, Não entraram, Fazendo, Bloqueados, Entregaram.
4. Tabela: Aluno (com ícone e nome do aparelho, "trocou de aparelho Nx"), Situação ("Não entrou", "Fazendo", "Bloqueado", "Entregou"; "liberado Nx"), Respondidas (x / total), Saídas (com horário e motivo), Tempo restante (contagem ao vivo), Nota ("N para corrigir").
5. "+10 min" (aluno fazendo): soma 10 minutos ao prazo do aluno (o servidor aceita de 1 a 60).
6. "Dar nova chance" (aluno bloqueado): mostra o motivo do bloqueio e oferece:
   - "Continuar de onde parou": volta para "Fazendo", zera os avisos e devolve o tempo que faltava no momento do bloqueio (mínimo de 5 minutos).
   - "Recomeçar do zero (apaga as respostas)": apaga as respostas e devolve a duração inteira.
   - "Cancelar".
7. Rodapé: "Os alunos da turma veem a prova no Início do Portal. As notas aparecem para eles depois das HH:MM."

**Pontos a confirmar:** não há na `/prova/` tela para o professor lançar nota das questões pendentes (dissertativas); o painel só mostra "N para corrigir" **(confirmar onde a correção manual será feita)**. A função aceita a ação "cancelar" prova, mas não há botão na tela **(confirmar)**.

**Dados gravados:** `provas_online/{id}` (prova sem gabarito), `provas_online/{id}/po_tentativas/{uid}` (respostas, prazo, desvios, eventos, aparelho, trocas, liberações), `provas_online/{id}/po_resultados/{uid}` (nota), `provas_online_gab/{id}` (gabarito); imagens em Storage `provas_online/{id}/`. `localStorage.pe5_disp` identifica o aparelho.

**Capturas sugeridas:** (a) apresentação do aluno com as regras; (b) questão de múltipla escolha com paleta e cronômetro; (c) capa de aviso "Aviso 1 de 1"; (d) capa "Prova bloqueada"; (e) capa "aberta em outro aparelho"; (f) tela "Prova entregue" com nota e chips; (g) painel do professor com um aluno bloqueado e o modal "Dar nova chance"; (h) lista "📡 Provas online" do professor.

---

## 3. Frequência · `/apps/frequencia/`

**Título:** "Frequência · Portal do Educador". Abas: "✅ Chamada", "🗂️ Histórico", "🔎 Busca ativa", "📺 Mural de chegada", "🚪 Portaria", "🪪 Carteirinhas", "🧾 Auditoria". Link "← Gestão".

**Quem usa (checagens no código):**
- Bloqueado para `aluno` (volta ao Portal).
- **Professor:** Chamada, Histórico e Busca ativa (turmas das escolas dele). Para gravar chamada, as regras exigem professor "vinculado" (licença institucional, com escola e contrato em dia); outros recebem "Sem permissão para lançar chamada nesta turma".
- **Gestor e secretaria escolar** ("gestão da escola"): não veem Chamada nem Histórico; entram em Busca ativa (com ficha), Mural, Portaria, Carteirinhas e Auditoria.
- **Fotos da entrada:** só gestor e admin (secretaria escolar não vê).
- **Portaria:** só a aba "🚪 Portaria" (entra direto nela).
- **Secretaria municipal:** recebe a mensagem "A frequência da rede fica no Painel da Rede · Por escola, com a frequência média e o número de alunos que precisam de busca ativa, sem nomes de alunos." com link.

### Chamada (professor)
1. Escolher "Turma" (as turmas do professor aparecem primeiro, com ★), "Disciplina" (sugestões: Língua Portuguesa, Matemática, ..., "Polivalente (anos iniciais)"), "Dia" e "Aulas" (1 a 6).
2. Avisos automáticos do calendário: dia futuro ("Esse dia ainda não chegou..."), dia não letivo pelo calendário da rede ("... não é dia letivo (motivo). Se houve aula (reposição), a chamada pode ser lançada assim mesmo."), dia letivo com eventos. Polivalente: "uma chamada vale para o dia todo. Use o número de aulas do dia (normalmente 4 ou 5)."
3. Todos começam presentes ("Todos começam presentes: marque só quem faltou."). Em cada aluno: "P", "F"; se mais de uma aula, seletor de quantas aulas faltou ("1 de 3", ..., "todas"); "Justificada" (atestado ou motivo informado pela família). Tocar no nome alterna. "Todos presentes" limpa as faltas.
4. "📝 Registro da aula (opcional)": o que foi trabalhado (até 600 caracteres), como no diário de classe.
5. "💾 Salvar chamada". Mensagem "Chamada salva: N faltas." Se já existia: "Esta chamada já foi lançada. As mudanças substituem a anterior quando você salvar." "Excluir chamada" aparece para chamada existente.
- Rascunho fica no aparelho até salvar ("Alterações ainda não salvas · rascunho guardado neste aparelho").
- Limite: até 80 alunos por chamada ("Fale com a secretaria para dividir esta turma").
- Uma chamada por professor + turma + dia + disciplina.

### Histórico (professor)
- Por aluno: Aulas, Faltas (e justificadas), Frequência (nas aulas dele) e "Turma toda" (todas as disciplinas e professores), Situação ("Abaixo de 75%", "N dias seguidos", "Em dia"). Mínimo da rede vem da regra de Notas e Médias (padrão 75%).
- "Chamadas lançadas · Toque numa chamada para abrir e corrigir." "⬇️ Planilha (CSV)".

### Busca ativa
- Indicadores: Frequência média, "Abaixo de 75%" (alunos com 10 aulas ou mais), "Faltas seguidas" (3 dias ou mais, sem justificativa), "Turmas com chamada" nos últimos 7 dias.
- Filtro "Precisam de acompanhamento" / "Todos os alunos", busca por nome, "⬇️ Planilha (CSV)", "🖨️ Imprimir".
- Quadro "⏰ Turmas sem chamada nos últimos 7 dias".
- Regra exibida: abaixo do mínimo conta depois de 10 aulas; faltas seguidas = 3 ou mais dias letivos inteiros sem justificativa; falta justificada continua contando na frequência.
- **Ficha de busca ativa** (gestão da escola e admin; toque no aluno): Situação ("Aberto", "Em contato com a família", "Encaminhado à rede", "Resolvido"); "Novo registro" com Contato ("📞 Ligação", "💬 WhatsApp", "✉️ Bilhete ou recado", "🏠 Visita domiciliar", "🤝 Reunião na escola", "❌ Tentativa sem sucesso"), "Motivo informado" (Doença, Problema familiar, Transporte, Trabalho, Mudança de endereço, Desinteresse, Conflito ou violência, Gravidez, Outro, Ainda não se sabe), "Encaminhar para" (CRAS, CREAS, Conselho Tutelar, Unidade de Saúde, Secretaria de Educação, Ministério Público), "Retorno combinado"; "Salvar registro"; Histórico; "🧾 Entrada × chamada"; "🖨️ Imprimir ficha". Aviso LGPD: "uso restrito à gestão da escola e à rede de proteção".
- E-mail de busca ativa para a gestão toda segunda-feira às 6h40 (função `emailBuscaAtiva`).

### Mural de chegada (gestão)
- Filtros "Por ano", "Quem faltou", "Todos"; "👁 Modo público" (para TV em área comum: só a visão por ano, sem a lista por aluno **(confirmar o que mais esconde)**); "⛶ Tela cheia"; seletor de turno quando a escola tem turnos.
- Legenda: Chegou; Ainda sem chamada hoje; Faltou hoje; 2 dias seguidos; 3 dias ou mais · 📋 em acompanhamento; Entrou na escola e está como falta na chamada.
- Painel geral com curva "Chegada pela portaria" de 5 em 5 minutos.

### Portaria (gestão e perfil portaria)
- "📷 Ligar câmera" (lê o QR da carteirinha) ou leitor de código USB ("funciona direto, sem clicar em nada"), "⛶ Tela cheia".
- Retornos na tela com som: "✅ Bom dia, Ana!", "👍 Ana, você já entrou", "⚠️ Carteirinha não reconhecida · Não é desta escola ou o aluno não está cadastrado. Procure a secretaria."
- Contadores: entraram hoje, ainda não chegaram, aguardando internet. Sem internet as leituras ficam no aparelho e sobem depois.
- Rodapé: "A entrada só marca a chegada: a frequência oficial continua sendo a chamada do professor."
- Fotos da entrada (totem com câmera, ligado no Portal TV): só gestor/admin abre. Cada foto aberta é registrada (quem e quando) antes de aparecer. Fotos apagadas depois de 15 dias.

### Carteirinhas (gestão)
- "Dez por folha A4, no tamanho de cartão de crédito, com o brasão do município, o nome e a turma." O QR "não tem dados pessoais, só um código interno". Escolher Escola e Turma; "📄 PDF da turma" ou "📚 Todas as turmas".

### Auditoria (gestão)
- "Entrada pela carteirinha × chamada do professor, aluno por aluno." Escola, Dia, Turma, "Só divergências" / "Todos", "⬇️ Planilha (CSV)", "🖨️ Imprimir". Situações: "Entrou e está com falta", "Entrou, faltou parte das aulas", "Na sala sem passar a carteirinha", "Entrou e está na sala", "Faltou", "Entrou · turma sem chamada ainda", "Sem entrada e sem chamada". Tocar no aluno: últimos 30 dias, "⬇️ CSV do aluno".
- Quadro "👁️ Quem abriu fotos da entrada" (por mês): "Ninguém consegue apagar este registro, nem o administrador."

**Dados gravados:** `freq_chamadas/{uid_turma_dia_disc}`; `freq_resumo` (gerado pela função `freqResumo`); `freq_entradas/{turma_dia}`; `busca_ativa/{escola_aluno_ano}`; `portaria_vistas`; fotos em bucket `portal-educador-5-portaria` (`portaria/{escola}/{dia}/...`); rascunhos e fila da portaria em `localStorage`.

**Capturas sugeridas:** (a) chamada com 2 faltas, uma justificada, e aviso de dia letivo; (b) histórico por aluno; (c) busca ativa com indicadores e a ficha aberta; (d) mural em tela cheia; (e) portaria com a mensagem "Bom dia"; (f) folha de carteirinhas em PDF; (g) auditoria com "Só divergências".

---

## 4. Notas e Médias · `/apps/notas/`

**Título:** "Notas e Médias · Portal do Educador". Abas "✏️ Notas", "📊 Resultado da turma", "⚖️ Regra da rede". Link "← Gestão Escolar".

**Quem usa:** todos os perfis exceto aluno. A regra da rede só pode ser alterada pela `secretaria` (do próprio município) ou admin; os demais veem os campos travados ("Definida pela secretaria de educação. Só a secretaria pode alterar."). Card aparece na Gestão Escolar condicionado ao módulo `gestao` do plano.

### Passo a passo
1. Escolher turma e disciplina e "Abrir" (ou "🗂️ Minhas planilhas"). "Os alunos vêm do cadastro da turma. As notas ficam salvas na sua conta e o cálculo segue a regra da sua rede."
2. Escolher o período (1º bimestre, ...). Informar "Aulas dadas no período".
3. "＋ Avaliação": Nome, Peso, "Vale quantos pontos"; editar a coluna pelo nome (✎); "Excluir coluna" pede segundo toque.
4. "＋ Recuperação" cria a coluna de recuperação do período.
5. Digitar notas ("com vírgula ou ponto. Enter desce para o próximo aluno. Tudo é salvo sozinho."). Nota negativa é recusada; nota acima do valor gera alerta.
6. "⬇ Puxar das Avaliações do Portal": lista as avaliações do professor para a turma; a nota entra numa coluna nova, convertida para a escala da rede.
7. Frequência digital: com chamadas lançadas, aparece "📋 Frequência digital: N chamada(s), N aulas..." e o botão "Usar os números da Frequência" (aulas e faltas do período). Se o calendário da rede não tiver as datas dos períodos, aparece aviso.
8. "📊 Resultado da turma": médias por período, média anual, frequência, exame, situação ("Aprovado", "Aprovado no exame", "Cursando · acima/abaixo da média", "Frequência abaixo de X%", "Reprovado", "Aprovado pelo conselho") e "quanto falta" para cada aluno ("Precisa de ...", "Já garantiu a média...", "vai depender da recuperação").
9. "Conselho": "Aprovado pelo conselho de classe" exige "Justificativa (registrada na ata)"; vale só para reprovação por nota ("A frequência mínima continua obrigatória").
10. "⬇ Planilha para o sistema da rede" (CSV com períodos, média anual, frequência, exame, média final, situação, justificativa do conselho).

### Regra da rede (secretaria)
- 1 Ano letivo: "Divisão do ano" (4 bimestres, 3 trimestres, 2 semestres), "Peso de cada período".
- 2 Notas: Escala (0 a 10 ou 0 a 100), "Média para aprovação", "Nota do período" (Média das avaliações ou Soma dos pontos), Arredondamento (1 casa decimal, Sobe para meio ponto, Número inteiro).
- 3 Recuperação: por período ("Fica a maior nota", "Média com a recuperação", "Não tem"); "Exame final" com Peso da média anual, Peso do exame, Média final para aprovação.
- 4 Frequência: mínima em % ("A LDB exige 75%").
- Padrão quando a secretaria não configurou: 4 bimestres peso 1, média 6, escala 10, recuperação "fica a maior", exame final com média final 5, frequência 75%. A tela mostra "(padrão, a secretaria ainda não configurou)".
- "Salvar regra da rede" vale para todos os professores do município.

**Dados gravados:** `notas_planilhas/{id}` (por professor, turma, disciplina e ano); `notas_regras/{municipio}`; lê `freq_chamadas`, `cal_rede`, `avaliacoes`, `respostas`.

**Capturas sugeridas:** (a) planilha do 1º bimestre com 3 colunas e médias coloridas; (b) Resultado da turma com "quanto falta"; (c) modal do conselho; (d) Regra da rede preenchida (visão da secretaria); (e) modal "Puxar notas das Avaliações do Portal".

---

## 5. Corretor de Gabarito · `/apps/corretor/`

**Título:** "Corretor de Gabarito · Portal do Educador". Passos: "1 Gabarito", "2 Imprimir cartões", "3 Corrigir", "4 Resultados", "📈 Habilidades BNCC", "📠 Lote do scanner". Link "← Gestão Escolar".

**Quem usa:** todos exceto aluno. Gestor e secretaria abrem direto em "Habilidades BNCC"; para a secretaria os outros passos ficam escondidos. Escopo da análise: professor (as provas dele), gestor (escolas dele), secretaria (município), admin (escolhe o município).

### Passo a passo
1. Escolher a turma. Escolher uma prova com questões objetivas (as do Portal) ou "＋ Gabarito de prova impressa" ("Para provas feitas fora do Portal"): Nome da prova, Disciplina, Bimestre (1 a 4), Questões (1 a 50), Alternativas (A a E ou A a D), "Vale quantos pontos" → "Continuar".
2. Gabarito: tocar na letra certa de cada questão; código BNCC por questão (valida o formato, ex.: EF05MA08). "Próximo: imprimir cartões →".
3. "🖨️ Cartões-resposta": "Cartões com nome" (um por aluno ou nenhum), "Cartões em branco a mais" (0 a 60), "📄 Gerar cartões em PDF". Instrução: imprimir em A4 em tamanho real (100%); "Os 4 quadrados pretos dos cantos precisam aparecer inteiros."
4. Corrigir: "📷 Abrir a câmera", "🖼️ Ler de uma foto" ou "⌨️ Digitar as respostas". O Portal lê o QR (prova e aluno), as marcas dos cantos e as bolinhas. "Toque numa letra para corrigir a leitura. Em laranja: marcação fraca, dupla ou em branco." "Ler de novo" / "✓ Salvar e próximo". Cartão de outra prova: "Este cartão é de outra prova ou de outra turma."
5. "📠 Lote do scanner": arrastar PDF de várias páginas ou imagens. Pode misturar provas e turmas. Cartões limpos são salvos na hora; duvidosos ficam para "Conferir". Opções "Substituir os N já corrigidos", "Limpar a lista do lote". Orientação: 200 a 300 dpi, tons de cinza, A4 sem ajustar à página, PDF multipágina; páginas em branco e cartões de cabeça para baixo são tratados.
6. Resultados: acertos/total, nota, origem ("Cartão lido"). "⬇ Planilha".
7. "📈 Habilidades BNCC": filtros por bimestre, disciplina e escola; "Atualizar", "⬇ Planilha" (CSV `habilidades-bncc-ANO.csv`).

**Regras:** só questões de múltipla escolha entram no cartão; dissertativas ficam pendentes para nota do professor **(confirmar onde lança)**.

**Dados gravados:** `avaliacoes` (prova impressa com `formato:"cartao"`), `respostas` (`origem:"cartao"`).

**Capturas sugeridas:** (a) gabarito marcado com BNCC; (b) PDF de cartões; (c) câmera lendo um cartão com uma marca em laranja; (d) resultados da turma; (e) painel de habilidades BNCC; (f) lote do scanner com itens a conferir.

---

## 6. Central de Relatórios · `/relatorios/`

**Título:** "Central de Relatórios · Portal do Educador". Abas "🗂️ Modelos", "📁 Meus relatórios", "📊 Painel" (só gestor, secretaria e admin).

**Quem usa:** professor, gestor, secretaria, admin. Regras: criar exige licença válida (ou perfil gestor/secretaria); leitura: autor, gestor da escola, secretaria do município, admin. A secretaria abre direto no Painel. Card na Gestão Escolar depende do módulo `relatorios` do plano; não aparece para secretaria escolar.

**Modelos (21):**
- Professor: Plano de Aula; Diário de Classe (registro da aula); Parecer / Relatório Bimestral (também em lote); Relatório Semestral; Acompanhamento Mensal; Relatório de Desenvolvimento Individual; Registro de Ocorrência; Encaminhamento do Estudante.
- AEE e Coordenação: PEI; Plano de AEE; PDI; Avaliação Pedagógica Individual; Relatório do Estudante com TEA; Registro de Atendimento AEE; Ata de Conselho de Classe.
- Direção e Secretaria escolar (não aparece para professor): Declaração Escolar; Comunicado às Famílias; Plano de Ação da Escola; Projeto Político-Pedagógico (roteiro); Histórico Escolar (auxiliar · "O oficial é o do sistema da rede").

### Passo a passo
1. Escolher o modelo. Identificação: Escola (se mais de uma), Turma, Estudante, Período (1º a 4º bimestre, trimestres, semestres, Anual).
2. Preencher os campos. "💾 Salvar" (exige estudante e período quando o modelo pede e ao menos um campo preenchido), "🖨️ PDF".
3. "Enviar para a coordenação" (professor com escola) → status "Enviado".
4. Coordenação (gestor) abre o relatório enviado e escolhe "✓ Aprovar" ou "↩️ Devolver" (exige "O que precisa ser ajustado?"). Devolvido aparece com "Devolvido pela coordenação: ...". Aprovado não pode mais ser editado.
5. Status: Rascunho, Enviado, Aprovado, Devolvido.
6. Em "Meus relatórios": "Abrir", "PDF", "Duplicar" (cria cópia em rascunho sem estudante), "Excluir"; filtros por status, busca e turma; "Ver devolvidos".
7. **Parecer da turma em lote** ("Fazer parecer em lote"): escolher Turma e Período; marcar por aluno os eixos Leitura, Escrita, Matemática, Participação, Convivência, Autonomia com C (Consolidado), D (Em desenvolvimento) ou A (Precisa de apoio); "Marcar todos como C"; "🤖 Escrever com a IA" (gera comando para ChatGPT/Gemini: "📋 Copiar comando", "Copiar e abrir..."; colar a resposta e "Conferir"); "🖨️ Imprimir todos"; "💾 Salvar os pareceres" (vão como rascunho para Meus relatórios).
8. Painel (gestão/secretaria): entregas dos professores da escola ou de todas as escolas da rede.

**Dados gravados:** `relatorios/{id}` (autor, escola, município, turma, aluno, período, dados, status, comentário, revisão). E-mail ao enviar (função `emailRelatorioEnviado`).

**Capturas sugeridas:** (a) grade de modelos; (b) editor de Parecer Bimestral; (c) tela de lote com C/D/A marcados; (d) visão do gestor com "Aprovar/Devolver"; (e) Painel de entregas.

---

## 7. Lousa Interativa Premium · `/lousa/`

**Título:** "Lousa Interativa Premium | Portal do Educador".

**Para que serve:** quadro digital para a lousa/TV: caneta, marca-texto, formas, texto, post-it, laser, imagens e PDF, várias páginas, exportar PNG/PDF.

**Quem usa:** abre sem login. Os botões de nuvem ("Salvar", "Trabalhos") só aparecem logado; salvar na nuvem exige licença válida (institucional com escola, ou licença avulsa dentro da validade; admin sempre). Sem licença: "Sem permissão para salvar: confira sua licença".

**Ferramentas:** "Selecionar", "Caneta", "Marca-texto", "Borracha" (Borracha que apaga por onde passa, ou "Apagar objeto"), "Formas" (Linha, Seta, Retângulo, Círculo, Triângulo, Tri. retângulo, Losango, Pentágono, Hexágono, Estrela, Cubo, Paralelepípedo, Cilindro, Cone, Pirâmide, Esfera; "Forma perfeita": desenha solto e vira forma), "Laser", "Texto", "Post-it", "Imagem", "PDF"; espessuras P, M, G; zoom ("100%", mais, menos, ajustar); "Desfazer", "Refazer", "Frente", "Trás", "Duplicar", "Excluir", "Limpar", "PNG", "PDF"; páginas (anterior, próxima, nova, excluir).

**Passo a passo (nuvem):** "Salvar" → "Nome da aula" (padrão "Aula de dd/mm às HHhMM") → salvo em "Meus trabalhos". Salva sozinho a cada 2 minutos e ao sair da aba. "Trabalhos" abre "Meus trabalhos" (busca, "Abrir", "Renomear", excluir, "Nova aula").

**Limites:** importar PDF até 60 MB e até 30 páginas por vez ("Importando só 30 páginas (limite por vez)"). Arquivo da aula na nuvem até 50 MB (regra do Storage).

**Dados gravados:** Storage `professores/{uid}/lousa/{id}.json.gz` + Firestore `usuarios/{uid}/trabalhos/{id}` (título, páginas, miniatura). Sem login, fica só no navegador.

**Capturas sugeridas:** (a) lousa com formas 3D e texto; (b) menu de Formas; (c) PDF importado com anotações; (d) "Meus trabalhos".

---

## 8. Gestão Escolar (hub) · `/gestao/`

**Título:** "Gestão Escolar · Portal do Educador". Subtítulo "Frequência, notas, comunicação, relatórios, recursos e suporte técnico da escola, em um só lugar".

**Cards e quem vê:**
| Card | Destino | Quem vê |
|---|---|---|
| Painel da Rede / Painel da Escola | `/painel/` | secretaria, gestor, admin; "🔒 Fora do plano" se o município não tem `painel` em `modulos_secretaria` |
| Equipe da escola | `/apps/equipe/` | gestor, admin |
| Notas e Médias | `/apps/notas/` | todos exceto secretaria escolar; módulo `gestao` |
| Frequência | `/apps/frequencia/` | todos; para gestor e secretaria escolar abre em `#busca`; para secretaria abre `/painel/`; módulo `gestao` |
| Famílias | `/apps/familias/` | gestor, secretaria escolar, admin |
| Portal do Educador TV | `/apps/tv/` | secretaria (abre em Comunicados), gestor, admin |
| Central de Relatórios | `/relatorios/` | todos exceto secretaria escolar; módulo `relatorios` |
| Recursos da Escola | `/apps/recursos/` | todos exceto secretaria escolar; módulo `gestao` |
| Corretor de Gabarito | `/apps/corretor/` | todos exceto secretaria escolar; módulo `gestao` |
| Calendário e Dias Letivos | `/apps/calendario/` | todos; módulo `gestao` |

- Perfil `portaria` é redirecionado para `/apps/frequencia/#portaria`.
- Cards fora do plano (`municipios.modulos_professor` sem o módulo) ficam com "🔒 Fora do plano" e sem link.

**Capturas sugeridas:** hub visto como gestor; hub visto como secretaria escolar (cards reduzidos); card "Fora do plano".

---

## 9. Aplicativos Úteis (hub) · `/apps/`

**Título:** "Aplicativos Úteis · Portal do Educador" · "Ferramentas do dia a dia, salvas na sua conta". Exige login.

Cards: "Turma na Lousa" (`/apps/turma/`), "Folha Mágica" (`/apps/folha/`), "Teleprompter" (`/apps/teleprompter/`), "Enviar para a TV da escola" (`/apps/tv/#playlists`; "As telas são da escola: a gestão organiza a programação").

**Captura sugerida:** hub com os 4 cards.

---

## 10. Turma na Lousa · `/apps/turma/`

**Título:** "Turma na Lousa · Portal do Educador". Topo: seletor de turma, "🙋 Quem faltou? N", "✏️ Editar lista", "⛶ Tela cheia". Abas: "🎲 Sortear", "👥 Grupos", "⏱️ Tempo e barulho", "🪑 Mapa da sala", "🏆 Placar".

**Quem usa:** todos exceto aluno. Alunos vêm do cadastro da turma; sem turma, "✏️ Digitar uma lista de nomes" ("Um nome por linha. Fica salva na sua conta").

**Passo a passo:**
- "Quem faltou hoje?": marcar ausentes (ficam fora do sorteio e dos grupos só hoje), "Todos vieram", "Pronto".
- Sortear: "Quantos" (− / +), "Não repetir até todos saírem", "🎲 Sortear", "↺ Recomeçar a rodada", lista "Já sorteados nesta rodada".
- Grupos: "Número de grupos" ou "Alunos por grupo", "👥 Formar grupos"; trocar alunos tocando em dois nomes ou no título de outro grupo.
- Tempo e barulho: "⏳ Contagem regressiva" / "⏱️ Cronômetro", atalhos 1, 3, 5, 10, 15, 30 min, "+1 min", "▶ Iniciar", "↺ Zerar", "Som no final". "Semáforo do barulho" com "Tolerância" e "🎤 Ligar o microfone" ("O som é medido só neste aparelho. Nada é gravado nem enviado."), "Turma em silêncio há mm:ss".
- Mapa da sala: Fileiras e Carteiras por fileira, "🔤 Ordem alfabética", "🔀 Aleatório", "🧹 Limpar", "Ver do fundo da sala", "🖨️ Imprimir", "Tirar da carteira". Tocar num nome e depois numa carteira; duas carteiras trocam.
- Placar: "Equipes" ou "Cada aluno", número de equipes, "👥 Usar os grupos formados", −1, +1, +5, "↺ Zerar placar" (toque duplo).

**Dados gravados:** `usuarios/{uid}/turma_lousa/{chave}` (lista digitada até 80 nomes, sorteados, ausentes do dia, grupos, mapa, placar) + cópia em `localStorage`.

**Capturas sugeridas:** sorteio em tela cheia; grupos formados; semáforo do barulho; mapa da sala impresso; placar por equipes.

---

## 11. Calendário e Dias Letivos · `/apps/calendario/`

**Título:** "Calendário e Dias Letivos · Portal do Educador". Abas: "📅 Calendário", "⚙️ Configurar o ano", "🏫 Escolas da rede", "🔗 Google Agenda e PDF", "📌 Minha agenda". Seletores de visão ("🏛️ Rede municipal (base)" ou cada escola) e ano (anterior, atual, próximo).

**Quem pode o quê:**
- Editar a base da rede e "Configurar o ano": secretaria do próprio município e admin.
- Registrar datas da escola: gestor da escola (e quem edita a rede).
- "🏫 Escolas da rede": secretaria e admin.
- Ver: todos exceto aluno. "Minha agenda": cada usuário, só ele vê.

**Passo a passo (secretaria):**
1. "＋ Criar calendário de ANO" (quando ainda não existe).
2. "Configurar o ano": Primeiro e Último dia letivo, Horas de aula por dia (até 12), Mínimo de dias letivos, Mínimo de horas, Dias de aula na semana; Bimestres com "✨ Dividir automaticamente"; feriados nacionais e pontos facultativos calculados sozinhos (inclusive Carnaval, Paixão de Cristo e Corpus Christi). Lembrete da LDB art. 24 (800 h em 200 dias). "✓ Salvar configuração".
3. "＋ Adicionar data": "O que é" (Feriado, Recesso escolar, Férias, Planejamento sem alunos, Paralisação ou suspensão, Reposição de aula, Sábado letivo, Evento), De, Até, Descrição, "Salvar data". Limite de 200 datas na rede e 200 por escola.
4. Clicar num dia mostra o que há e permite "Sem aula"/"Com aula" e "📌 Lembrete neste dia" **(confirmar rótulos do painel do dia)**.

**Google Agenda e PDF:** "Link do calendário" com "Copiar", "Abrir no Google Agenda", "iPhone / Outlook"; cada escola tem o seu link (base da rede + datas próprias); "Gerar link novo (desliga os antigos)"; "📄 Calendário oficial em PDF" (para homologação no Conselho de Educação e mural) e "⬇ Arquivo .ics".

**Minha agenda:** "＋ Novo lembrete": O que é, Tipo ("🏫 Escola" / "🏠 Pessoal"), Dia, Hora (opcional), Repetir (Não repete, Toda semana, Todo mês), Até, "Aviso por e-mail" (No resumo do dia às 6h30; No resumo e também no horário; Não avisar), "Quando avisar" (Na hora, 15 min, 1 h, 1 dia antes), Anotações. Filtros Todos/Escola/Pessoal; marcar feito, "Editar", "Excluir".

**Dados gravados:** `cal_rede/{municipio_ano}`, `cal_escola/{escola_ano}`, `usuarios/{uid}/lembretes`; link público servido pela função `calendarioIcs`.

**Capturas sugeridas:** mês com feriados e reposição; tela de configuração do ano; aba Google Agenda; PDF oficial; novo lembrete.

---

## 12. Recursos da Escola · `/apps/recursos/` e Chamado do equipamento · `/chamado/`

### 12.1 Recursos da Escola
**Título:** "Recursos da Escola · Portal do Educador". Abas: "📅 Reservar", "🗂️ Minhas reservas", "🛠️ Chamados", "🏷️ Equipamentos" (gestor), "🕒 Horários" (gestor), "📊 Rede e SLA" (secretaria e admin), "📦 Estoque e entregas" e "📑 Contratos" (só admin/NEWPC).

**Quem usa:** todos exceto aluno. Reservar: professor com licença nas escolas dele, e gestor. Gerir equipamentos e horários: gestor da escola ou admin. Mudar status de chamado: gestor da escola ou admin (regra `recGestor`). Sem escola vinculada: "Seu cadastro ainda não tem escola".

**Passo a passo:**
- Reservar: navegar por dia ("◀", "▶", "Hoje"); "Toque numa aula livre para reservar. Ninguém consegue reservar a mesma aula ao mesmo tempo: quem gravar primeiro fica com ela." Modal: Turma, "Atividade (opcional)", Repetir (Só neste dia; Toda semana por 2, 4, 8 ou 12 semanas) → "Reservar". Cancelar pelo "✕" (dono ou gestor, só no futuro).
- Horários (gestor): turnos e número de aulas por turno (1 a 12), horários opcionais, "Salvar horários".
- Equipamentos (gestor): "＋ Novo equipamento" (Tipo, Situação, Quantidade, Nome, Onde fica, Patrimônio, Nº de série, Marca, Modelo, Origem e garantia, Contrato, Entregue em, Garantia até, Observações, "Pode ser reservado pelos professores"); "＋ Em lote" (2 a 60 iguais); "⬆ Importar planilha" (admin); "🪧 Cartaz da escola" (QR geral da escola); "⬇ Planilha"; "🖨️ Etiquetas QR". Na ficha: "🔗 Página da etiqueta", "🖨️ Etiqueta", "Editar", "🔁 Transferir" (admin).
- Tipos: Carrinho de Chromebooks, Laboratório de informática, Lousa digital, Sala de realidade virtual, Projetor ou TV móvel (reserváveis por padrão), Chromebook ou notebook, Tablet, Computador, TV ou totem, Impressora, Rede ou Wi-Fi, Outro. Situações: Em uso, Em manutenção, Em estoque, Baixado.
- Chamados: filtros "Em aberto", "Resolvidos", "Todos"; "＋ Abrir chamado" (escolhe o equipamento e abre a mesma página da etiqueta); status "🛠️ Em atendimento" e "✅ Resolvido" ("Encerrar chamado · O que foi feito (aparece para a escola)").
- Rede e SLA (secretaria): períodos 30 dias / 90 dias / 12 meses, "⬇ Inventário da rede", "⬇ Chamados e SLA".
- Contratos (admin): Número, Tipo (Locação, Ata de registro de preços, Comodato, Manutenção, Outro), Processo/pregão, Objeto, vigência, SLA (atendimento até 720 h, solução até 2.160 h), renovações.

**Dados gravados:** `rec_itens` (+ `mov`), `rec_qr`, `rec_pub`, `rec_busca`, `rec_config`, `rec_reservas/{item_data_turno_aula}`, `rec_chamados`, `rec_contratos`. E-mail de chamado: função `emailChamadoTecnico`.

### 12.2 Chamado do equipamento · `/chamado/?k=CHAVE` (ou `?e=ESCOLA`)
**Sem login.** Aberto pela etiqueta QR do equipamento ou pelo cartaz da escola.
1. Mostra o equipamento (nome, local, patrimônio). Pelo cartaz: lista os equipamentos da escola por local, com busca.
2. "O que está acontecendo?" (Não liga, Tela ou imagem, Internet ou Wi-Fi, Teclado mouse ou toque, Som, Bateria ou carregador, Lento ou travando, Programa ou conta, Quebrado...), "Conte um pouco mais (opcional)" (até 1.000), "Seu nome", "Você é" (Professor(a), Direção ou coordenação, Secretaria da escola, Funcionário(a), Aluno(a)), "WhatsApp para retorno (opcional)" → "Abrir chamado".
3. Confirmação "Chamado aberto! A equipe técnica foi avisada." com "Protocolo XXXXXX".
4. Se já existe chamado aberto: "Este equipamento já tem um chamado aberto" (ou "A equipe técnica já está cuidando") e "🙋 Aconteceu comigo também" (conta quantas pessoas relataram).
5. Etiqueta não encontrada: busca por patrimônio ou número de série ("Procurar equipamento").
- Regra: um chamado aberto por equipamento.

**Capturas sugeridas:** grade de reservas; modal de reserva com repetição; ficha do equipamento com QR; etiquetas impressas; tela do celular abrindo chamado; tela "já tem chamado aberto"; aba Rede e SLA.

---

## 13. Famílias · `/apps/familias/`

**Título:** "Famílias · Portal do Educador". Abas "👨‍👩‍👧 Responsáveis", "📥 Importar planilha", "📣 Avisos às famílias". Link "← Gestão".

**Quem usa:** gestor, secretaria escolar e admin. Professor e outros: "Os contatos das famílias ficam com a gestão da escola". Aviso LGPD na tela: "O professor não vê estes dados".

**Passo a passo:**
- Responsáveis: Escola, Turma, filtros "Todos" / "Sem contato" / "Com contato"; indicadores (com WhatsApp, com e-mail...); "⬇️ Planilha (CSV)". Ficha do aluno: até 4 responsáveis ("+ Adicionar responsável"), Nome, Parentesco, WhatsApp, E-mail, principal; "A família aceita receber avisos da escola"; Observação; "Salvar"; "Apagar contatos". WhatsApp vira link `wa.me`.
- Importar: colar linhas do Excel/Google Planilhas com cabeçalho ou enviar CSV/XLSX; "Baixar modelo"; aluno encontrado pela matrícula ou por nome + turma; até 2 responsáveis por linha; "Substituir os responsáveis já cadastrados desses alunos"; "Conferir antes de gravar" → "Gravar N aluno(s)".
- Avisos automáticos por e-mail (liga e desliga: só gestor; secretaria escolar vê travado): "Faltou o dia inteiro" (ao fim do turno: matutino 12h40, vespertino 18h10, noturno 22h40; justificada não gera aviso), "3 dias seguidos faltando", "Entrou na escola, mas está com falta", "Chegada na escola" (na leitura da carteirinha; limite da conta de envio: 1.500 avisos por dia somando todas as escolas). Mostra a cobertura ("N de M alunos têm e-mail de família").
- "✉️ Novo comunicado às famílias": Assunto, Mensagem, "Para as famílias de" (turmas), "Enviar comunicado" (confirma o número de e-mails). Lista de comunicados com situação.
- "🗒️ Mural de avisos": por dia, filtros Todos, Falta, 3 dias, Fora da sala, Chegada, Comunicado; situações Enviado, Enviando, Sem contato, Sem e-mail, Família não aceita, Limite do dia, Erro no envio.

**Dados gravados:** `alunos_familia/{aluno}`, `avisos_config/{escola}`, `comunicados_familia`, `avisos_familia`.

**Capturas sugeridas:** lista com "Sem cadastro"; ficha do responsável; prévia da importação; tela de avisos com chaves; mural de avisos do dia.

---

## 14. Equipe da escola · `/apps/equipe/`

**Título:** "Equipe da escola · Portal do Educador".

**Quem usa:** só gestor e admin. Outros: "A equipe da escola é cadastrada pelo gestor".

**Passo a passo:**
1. "➕ Convidar alguém da equipe": Nome completo, E-mail (conta Google), função:
   - "🚪 Portaria": só a tela de entrada (lê carteirinhas e vê quem chegou). Não vê fotos, telefones, notas nem faltas.
   - "🗂️ Secretaria escolar": famílias, busca ativa, portaria, mural, carteirinhas, auditoria e comunicados. Não vê fotos da entrada, não liga avisos automáticos nem apaga dados.
2. "Convidar" → mensagem pronta para mandar ("Copiar mensagem"). A pessoa entra com a conta Google desse e-mail e cai direto na tela da função.
3. "👥 Equipe com acesso": "Pausar acesso" / "Reativar".
4. "✉️ Convites que ainda não foram usados": "Copiar mensagem", "Cancelar convite".
- Professores e gestores continuam sendo cadastrados pela secretaria ou pela NEWPC.
- Recusas: e-mail já cadastrado em outra função/escola, ou convidado por outra escola.

**Dados gravados:** `pre_cadastros/{email}`; `usuarios/{uid}.status`.

**Capturas sugeridas:** formulário de convite com a mensagem gerada; lista da equipe.

---

## 15. Painel da Rede / Painel da Escola · `/painel/`

**Título:** "Painel da Rede · Portal do Educador" ("Painel da Escola" para gestor). Botões "↻ Atualizar", "📄 Relatório executivo", "Portal →".

**Quem usa:** secretaria (rede), gestor (escola, comparada com a média da rede), admin (escolhe o município). Exige `painel` em `municipios.modulos_secretaria` ("O painel ainda não faz parte do plano do seu município"). Gestor sem escola: "Seu cadastro de gestor ainda não está ligado a uma escola".

**Seções:** Indicadores (Escolas e alunos; Professores ativos em 30 dias; Usando agora; Acerto nas provas; Frequência; Calendário (escolas que cumprem os dias); Chamados abertos (há +48 h); TVs online). Uso do Portal ("Professores que usaram o Portal por dia", "Módulos mais abertos"). Aprendizagem ("Acerto nas provas por escola", "Habilidades BNCC que pedem reforço"). Frequência (por escola; Busca ativa sem nomes: abaixo do mínimo, faltando seguido, fichas abertas e encaminhadas). Calendário e infraestrutura (Dias letivos, Suporte técnico e equipamentos). "Escola por escola". Atalhos (Gestão Escolar, Calendário, Habilidades BNCC, Rede e SLA, Central de Relatórios, Notas e Médias, Busca ativa).
- Os números ficam guardados por 20 minutos; "Atualizar" soma de novo. "Nenhum dado pessoal de aluno aparece" no painel.
- "📄 Relatório executivo": PDF com brasão, indicadores, tabela escola por escola e "Prioridades".

**Dados:** função `painelSecretaria` (somente leitura agregada).

**Capturas sugeridas:** indicadores do topo; habilidades BNCC; PDF executivo; visão do gestor com "vs. rede".

---

## 16. Portal do Educador TV

### 16.1 Painel · `/apps/tv/`
**Título:** "Portal do Educador TV · Painel". Abas "📺 Telas", "🎞️ Playlists", "📢 Comunicados", "🎗️ Campanhas" (só admin).

**Quem usa:** todos exceto aluno. Professor chega pelo atalho "Enviar para a TV da escola" e edita playlists das escolas dele (regra `tvEquipeEscola`: licenciado na escola, gestor, secretaria do município, admin). Comunicados: só secretaria e admin publicam. Totem da portaria e foto na entrada: só gestor e admin ligam. Secretaria abre em Comunicados.

**Passo a passo:**
- Conectar TV: na TV abrir `app.portaldoeducador.com.br/tv/`; aparece um código de 6 caracteres (muda a cada 10 min; aceito até 30 min). No painel: "＋ Conectar TV" → "Código que aparece na TV", "Nome desta TV", "Formato da tela" (Automática, Horizontal, Vertical (totem)), "Playlist que vai passar", opções de portaria → "Conectar".
- Cada TV: status "No ar" / "Desligada há ..." / "Nunca ligou"; "Configurar" (nome, formato, playlist padrão, "Trocar a playlist por turno", "Totem da portaria", "Foto na entrada", "Exibir as campanhas educativas", "Letreiro", "Cidade exibida", "📍 Usar a localização deste aparelho" para a temperatura), "🔗 Link", "Desconectar". "⛶ Tela cheia e quiosque" explica como deixar a TV fixa.
- Playlists: "＋ Nova", renomear, excluir (bloqueado se estiver tocando em alguma TV); itens Foto (JPG/PNG/WebP), Vídeo (MP4 até 50 MB), YouTube, Página web (https), Só texto; duração, layout; "↑ ↓", pausar, editar, "🗑️". Máximo 80 itens por playlist.
- Comunicados (secretaria): Título, Texto (até 500), Começa em, Termina em, Tempo na tela (5 a 120 s), Escolas (nenhuma = todas), imagem opcional, "Repetir o título no letreiro" → "Publicar nas TVs"; "Retirar". Aviso: "Não coloque dados pessoais de alunos: as TVs ficam em áreas públicas." Até 30 comunicados no canal. Entram um a cada 3 itens da escola.
- Campanhas (admin): passam em todas as TVs, uma a cada 4 itens, nos meses marcados; a escola pode desligar por TV.

**Dados gravados:** `tv_pareamentos`, `tv_telas`, `tv_playlists`, `tv_canais`, `tv_campanhas`; arquivos em Storage `tv/escolas/{escola}/`, `tv/municipios/{m}/`, `tv/campanhas/`. E-mails: `emailTvConectada`, `emailComunicadoTv`.

### 16.2 Player · `/tv/`
- Sem login. Tela "Conecte esta tela à sua escola" com o código e os 3 passos. Dica: instalar como app para abrir em tela cheia.
- Mostra a programação, relógio, temperatura, letreiro; "Sem internet · exibindo a última programação"; controle remoto: setas trocam, espaço pausa, F/OK tela cheia; reinicia sozinho às 3h30.
- Totem da portaria: leitor USB registra entrada; foto opcional (câmera frontal, 320 px, no máximo 1,5 s de espera).
- Navegador antigo sem módulos JS: redireciona para `/tv/leve/`.

### 16.3 Versão leve · `/tv/leve/`
- Player simplificado para TVs antigas (mesma chave da tela), relê a programação periodicamente, funciona offline com a última programação.

### 16.4 Teste da TV · `/tv/teste/`
- Diagnóstico: lista recursos (módulos JS, async/await, ?. e ??, Promise/fetch, CSS grid, MP4 H.264, WebM, tela cheia, armazenamento, Wake Lock), versão do Chrome (ideal 80+), marca (Tizen, webOS, Android TV...), conexão com o Portal, "Código do teste". Veredito: roda o player; usa a versão leve; ou "Use um TV box ou Chromecast". Orientação: "Tire uma foto desta tela e mande para o suporte NEWPC."

**Capturas sugeridas:** tela de código na TV; modal "Conectar uma TV"; lista de telas com status; playlist com itens; formulário de comunicado; TV vertical exibindo; página de teste.

---

## 17. Folha Mágica · `/apps/folha/`

**Título:** "Folha Mágica · Portal do Educador". Abas "📐 Criar folha", "🗂️ Minhas folhas". Todos exceto aluno.

**Modelos (14):** "Substituem caderno especializado": Pauta musical, Tablatura, Caligrafia 4 linhas, Milimetrado, Isométrico, Perspectiva, Plano cartesiano. "Folhas de apoio": Pautado, Quadriculado, Pontilhado, Coordenação motora, Mapa mental, Cornell, Semanal.

**Passo a passo:** escolher o tipo; "Página" (A4, A5, Carta; Retrato/Paisagem; margem), "Linhas" (espaçamento, espessura, cor; "Letra ou palavra para cobrir" em cinza; "Desenhar clave de sol"; "Numerar os eixos"), "Cabeçalho" (logo do município, Escola, Disciplina, Turma, linha para nome e data); "👁️ Prévia"; "🖨️ Imprimir": "Quantidade" (1 a 200) ou "Uma por aluno" (escolhe a turma; cada folha sai com o nome do aluno); "📄 Gerar PDF"; "💾 Salvar em Minhas folhas" (nome). Em Minhas folhas: "Abrir", "📄 PDF", "Excluir".

**Dados gravados:** `usuarios/{uid}/folhas`.

**Capturas sugeridas:** prévia de caligrafia com letra para cobrir; plano cartesiano; PDF "uma por aluno".

---

## 18. Teleprompter · `/apps/teleprompter/` e Controle · `/apps/teleprompter/controle/`

**Título:** "Teleprompter · Portal do Educador" ("Teleprompter PRO"). Todos exceto aluno.

**Passo a passo:**
1. "Escrever meu roteiro" ou "Importar .txt" (até 1 MB); "Nome do roteiro"; "Texto da apresentação" (linha em branco cria bloco; limite 200 mil caracteres); "Travar"; "Baixar .txt"; "Guardar versão", "Restaurar", "Limpar".
2. "Ajustes": Ritmo (ppm; "Tranquilo · 90", "Natural · 130", "Ágil · 180"), Tamanho do texto, Espaço entre linhas, Largura (Estreita, Normal, Ampla), Modo (Rolagem contínua ou Um bloco por vez), Preparação (imediato, 3 s, 5 s), "Espelhar horizontalmente", "Inverter verticalmente", Guia de leitura, Destacar o bloco atual.
3. "Marcadores": "Marcar ponto da leitura".
4. "Iniciar" (atalhos: Espaço inicia/pausa, ↑/↓ ritmo, ←/→ blocos, F tela cheia). "Foco", "Sair". A aplicação não grava áudio nem vídeo.
5. "Meus roteiros": "Novo roteiro", abrir, excluir (salvos na conta).
6. "Celular" → "Controle pelo celular": QR code; o celular abre `/apps/teleprompter/controle/` **sem login**; botões "▶ Iniciar", "◀ Bloco anterior", "▶ Próximo bloco", ritmo − / +, "A−" / "A+", "↺ Voltar ao início". "Desligar controle". O código vale só enquanto o controle estiver ligado.

**Dados gravados:** `usuarios/{uid}/roteiros`; `tele_sessoes/{token}` e `tele_sessoes/{token}/cmd`.

**Capturas sugeridas:** editor com blocos; leitura em tela cheia; QR do controle; celular com o controle.

---

## 19. Biblioteca e Histórias Educativas · `/biblioteca/`

**Título:** "Biblioteca · Portal do Educador". Abas "📚 Acervo", "🔖 Continuar", "➕ Adicionar" (admin), "🗂️ Triagem" (admin). Com `#historias`, abre como "Histórias Educativas" só com essa estante.

**Estantes:** Livros, Audiolivros, Aprender brincando, Gibiteca, Histórias Educativas.
**Quem vê:** professor e demais perfis não-aluno: estantes publicadas. Aluno: só "Aprender brincando" e "Gibiteca" (se o plano do aluno liberar `biblioteca`) e Histórias (se liberar `historias`).

**Passo a passo:** escolher a estante, busca, "⭐ Favoritos", "Mostrar mais"; abrir o livro no leitor ("📖" duas páginas, "🔍" zoom, "⛶" tela cheia, "‹ ›"); audiolivro com "−15s", "▶", "+30s", velocidade, capítulos "⏮ ⏭"; reações (Amei, Gostei, Mais ou menos, Não gostei); "🔖 Continuar" retoma de onde parou (guardado no aparelho).
**Admin:** "➕ Adicionar" título por estante (PDF; Gibiteca PDF ou CBZ; audiolivro MP3/M4A), limites na tela de 150 MB (PDF/CBZ) e 300 MB (áudio), licença obrigatória (10+ letras); "Publicar/Ocultar", "Excluir". "Triagem": aprovar/recusar em lote importações, com tipo de licença, comprovação e declaração de direito de distribuição.

**Dados:** `biblioteca`, `biblioteca_reacoes`, `biblioteca_triagem`; Storage `biblioteca/`. Importação via função `importarBiblioteca`.

**Ponto a confirmar:** a tela aceita PDF de até 150 MB, mas a regra do Storage para `biblioteca/historias/` é 100 MB **(confirmar)**.

**Capturas sugeridas:** estantes; leitor em duas páginas; player de audiolivro; tela "Continuar".

---

## 20. Desenhos para Colorir · `/colorir/`

**Título:** "Desenhos para Colorir · Portal do Educador". Abas "🖍️ Desenhos", "🖼️ Minhas pinturas", "⚙️ Gerenciar" (admin).

**Quem vê:** perfis não-aluno; aluno se o plano liberar `colorir`. Temas: Personagens, Contos e fábulas, Animais e natureza, Aventuras e profissões, Esportes, Bíblico, Outros. Desenhos bíblicos só aparecem se o município liberar (`colorir_religioso`), se o professor for de rede particular ou para admin.

**Passo a passo:** escolher o tema, "⭐ Favoritos"; em cada desenho "🖍️ Colorir" ou "🖨️ Imprimir" (em branco). Editor: "🪣 Balde", "🖌️ Pincel", "🖍️ Giz", "🧽 Borracha", "💧 Pegar cor", "📏 Linha", paleta, "↶" / "↷", "🗑️ Recomeçar", "🔍 Ajustar", zoom, "⛶", "🖨️ Imprimir" (colorido), "⬇️ Baixar" (PNG). "Minhas pinturas": "Continuar", "Apagar" (ficam guardadas **neste aparelho**). Atalho `?abrir=ID` vindo das Datas Comemorativas.

**Dados:** pinturas em IndexedDB do aparelho; favoritos em `localStorage`; acervo em `colorir` (Firestore) e Storage `colorir/`.

**Capturas sugeridas:** galeria por tema; editor com balde; "Minhas pinturas".

---

## 21. Dicas do Professor · `/dicas/`

**Título:** "Dicas do Professor · Portal do Educador". Abas "💡 Dicas da rede", "✉️ Enviar minha dica", "📁 Meus envios", "📥 Recebidas" (admin).

**Professor:** tipos "💡 Dica de aula", "📱 Aplicativo ou site", "📎 Material", "✏️ Atividade"; Título (mín. 4), texto (mín. 20), Disciplina, Etapa, até 5 links, até 5 arquivos (PDF, imagem, Office) de até 10 MB cada e 20 MB no total, opção de publicar com nome → "✉️ Enviar dica". A equipe NEWPC revisa e publica ("Publicar", "Despublicar", "Não publicar", com retorno que aparece em Meus envios). Publicadas aparecem para toda a rede. "Ler tudo", "Baixar".
**Modo aluno** ("Dicas da galera"): tipos Dica de estudo, Site ou app, Curiosidade, Desafio; sem arquivo, até 2 links, texto até 1.500; ao publicar aparece só o primeiro nome e a escola.

**Dados:** `dicas_envios` (professor), `dicas_alunos` e `dicas_alunos_pub` (aluno); Storage `dicas/{uid}/{envio}/`. E-mails `emailDicaProfessor`, `emailDicaAluno`.

**Capturas sugeridas:** mural de dicas; formulário de envio com arquivo; Meus envios com status.

---

## 22. Museus Virtuais · `/museus/`

**Título:** "Museus Virtuais · Portal do Educador" · "Brasil em 360° · um país, vários séculos." Exige login ativo.

**Conteúdo:** 5 museus: MASP, Museu do Amanhã, Museu Imperial, Museu de Zoologia da USP, Google Arts and Culture Brasil. Cada ficha ("Ver ficha"): sugestão pedagógica, disciplinas, habilidades BNCC sugeridas, "Iniciar visita virtual"/"Abrir tour". "Modo exposição" (carrossel para lousa/TV, com pausa e navegação), "Tela cheia", "Voltar ao Portal". Roteiro para professores: Provocação inicial, Exploração guiada, Produção dos alunos.

**Dados:** nenhum (conteúdo fixo no HTML).

**Capturas sugeridas:** capa; ficha de um museu; modo exposição.

---

## 23. Formação Continuada · `/formacao/` e Validar certificado · `/validar/`

### 23.1 Formação Continuada ("Academia do Educador")
**Título:** "Formação Continuada · Portal do Educador". Menu: Início, Cursos, Trilhas, Meu progresso, Certificados, Sobre, Privacidade, Termos. Botões "A+", "Entrar".

**Quem usa:** professores com licença válida: institucional (escola e município vinculados, contrato em dia e `formacao` no plano do município, se houver plano) ou avulsa dentro da validade. Sem isso aparece "Acesso indisponível" com o motivo (ex.: "A Formação Continuada não faz parte do plano do seu município", "Sua licença do Portal do Educador expirou").
- Login "Entrar com Google" ou "Receber link de acesso" por e-mail. No primeiro acesso, o perfil é criado a partir do cadastro do Portal e certificados antigos com o mesmo e-mail são trazidos.

**Passo a passo:**
1. "Meus dados": Nome completo e CPF (obrigatórios para o certificado; o CPF aparece parcialmente oculto na validação), Município, Escola, Função → "Salvar dados".
2. Escolher curso (catálogo ou trilha). Módulos liberados em ordem ("Conclua o módulo anterior primeiro"; "Esta aula ainda não foi liberada").
3. Aula: vídeos do YouTube, texto, "Materiais desta aula", "Salvar anotações", botão de concluir ("Concluir e continuar →"). A aula só conta quando o tempo mínimo e os vídeos foram cumpridos: tempo mínimo = 40% da duração da aula (entre 1 minuto e 2 horas) e cada vídeo assistido em pelo menos 90%. Uma aba por vez ("A aula foi aberta em outra aba...").
4. "Avaliação final": só depois de concluir todas as aulas. Questões sorteadas do banco (padrão 10), alternativas embaralhadas; nota mínima padrão 70%; tentativas padrão 3; prazo de 90 min por prova aberta; espera de 30 s entre aberturas. Resultado "Aprovado" (mostra explicações) ou "Não atingiu a nota mínima" com "Tentar novamente".
5. "Emitir meu certificado": exige aprovação (se houver avaliação), nome completo e CPF válido; um CPF por conta. Código no formato `AE-ANO-XXXXXX`. "Baixar / imprimir PDF", "Copiar link de validação". Reemitir devolve o mesmo certificado.
6. "Meu progresso": cursos em andamento e certificados.

**Dados:** `cursos` (+ módulos, aulas, questões), `trilhas`, `users/{uid}` (perfil, progresso, sessões, provas, tentativas, emissões), `certificados`, `cpfs`.

### 23.2 Validar certificado · `/validar/`
**Sem login.** "Validação de certificado": digitar o "Código de autenticidade" (formato `AE-2026-XXXXXX`, no rodapé ao lado do QR) → "Validar". Também abre direto pelo QR (`?c=CÓDIGO`). Mostra dados públicos do certificado, módulos e emissor (NEWPC TECNOLOGIA LTDA). Certificado revogado aparece como inválido **(confirmar texto exato)**.

**Capturas sugeridas:** catálogo; aula com barra de progresso; avaliação final; certificado em PDF; página de validação com resultado válido.

---

## 24. Painel da Formação (equipe NEWPC) · `/formacao/admin/`

**Título:** "Painel da Formação Continuada · Portal do Educador". **Uso interno NEWPC** (papéis `admin` e `editor` da Academia, definidos por "Equipe editorial · Conceder acesso"). Sugestão: citar no manual só como referência, sem passo a passo para o cliente.

Fluxo da própria tela "Como publicar um curso": 1 Criar o rascunho ("+ Novo curso": título, resumo, nível, carga horária impressa no certificado); 2 Montar a estrutura (módulos e aulas); 3 Preencher cada aula (texto, vídeos do YouTube não listados, materiais); 4 Montar a avaliação (nota mínima, tentativas; 4 alternativas, 1 correta, explicação; mínimo recomendado 3 questões, ao menos 1 por módulo); 5 Revisar ("Enviar para revisão"); 6 Publicar (admin, lista de verificação); 7 Vincular à trilha; 8 Aposentar versão antiga ("Criar nova versão", "Arquivar"). Outras telas: Trilhas formativas, Certificados emitidos ("Revogar" com motivo de 5 a 1.000 caracteres), "Relatório de adesão" (por município; "Carregar mais 100 professores", "Exportar CSV").

---

## 25. Página inicial, vitrine e legado

### 25.1 Página inicial · `/`
**Título:** "Portal do Educador · Recursos digitais e IA para o professor". Pública.
- Topo: "O próximo capítulo da educação começa com você." Seletor "👩‍🏫 Sou professor" / "🎒 Sou aluno" e "Entrar com Google" (vai para `/entrar/?como=professor` ou `?como=aluno`). Texto da página: "Primeira vez? Professores ganham 7 dias grátis, sem cartão." (é o que a página promete; a regra de licença de teste fica no `/entrar/` **(confirmar com o outro agente)**).
- Seções: recursos (Vídeos Educativos, Jogos, Dicas de IA, Gerador de Provas, Portal 360º VR, Atividades, Central de Relatórios, Datas Comemorativas, Desenhos para Colorir, Histórias Educativas, Biblioteca, Formação Continuada, Museus Virtuais, Dicas do Professor, Aplicativos Úteis, Portal Maestro), públicos (Professor, Redes municipais, Escolas particulares, Instituições), atendimento. Botões de WhatsApp com mensagem pronta ("Falar com um consultor", "Pedir uma proposta", "Conversar", "Tirar dúvidas no WhatsApp").

### 25.2 `/vitrine/`
- Só redireciona para `/`.

### 25.3 `/aluno.html` · "Portal do Educador - Avaliacao" (legado)
- Sem login: "Entrar na avaliacao" com código de acesso → "Quem e voce?" (lista de alunos da turma) → prova (múltipla escolha e dissertativa) → "Enviar respostas" → "Prova enviada!". Só abre avaliações com `status:"liberada"`.
- **Ponto de atenção (para o agente técnico):** as regras atuais exigem login para ler `alunos`, então a lista de nomes pode não carregar sem conta; e a coleção `avaliacoes` tem leitura pública com o gabarito no documento. Parece substituída pela Prova online. **(confirmar se ainda é usada e se deve entrar no manual)**.

---

## 26. Anexos

### 26.1 Perfis × páginas (resumo do código)
| Página | professor | gestor | secretaria | sec. escolar | portaria | aluno | admin |
|---|---|---|---|---|---|---|---|
| Gerador de Provas | sim | sim | sim* | sim* | sim* | (confirmar) | sim |
| Aplicar online | se plano | se plano | não (função recusa) | não | não | não | sim |
| Prova online (fazer) | | | | | | sim | |
| Prova online (painel) | dono | dono | | | | | sim |
| Frequência · chamada | sim (licença institucional) | não | não | não | não | não | sim |
| Frequência · busca/mural/carteirinhas/auditoria | busca (sem ficha) | sim | painel | sim (sem fotos) | só portaria | não | sim |
| Notas e Médias | sim | sim | sim + regra | (card oculto) | | não | sim |
| Corretor | sim | análise e demais | só análise | (card oculto) | | não | sim |
| Relatórios | sim | sim + aprovar | painel | (card oculto) | | não | sim |
| Calendário | ver + agenda | datas da escola | rede | ver | | não | sim |
| Recursos | reservar | gerir escola | rede e SLA | (card oculto) | | não | tudo |
| Famílias | não | sim | não | sim (sem ligar avisos) | | não | sim |
| Equipe | não | sim | não | não | | | sim |
| Painel | não | escola | rede | não | | | sim |
| TV | playlists | telas, portaria | comunicados | (confirmar) | | não | tudo |
| Folha, Teleprompter, Turma na Lousa | sim | sim | sim | sim | sim | não | sim |

\* O Gerador só exige login; a página não filtra perfil (só o "Aplicar online").

### 26.2 Limites consolidados
- Gerador: logo/imagem 2 MB; até 200 cópias; IA 1 a 40 questões; adicionar até 100 por vez.
- Prova online: 100 questões, 8 alternativas, grade 12×8, imagem 3 MB e 4 por questão, duração 5 a 300 min, +tempo 1 a 60 min, avisos 0 a 3 (tela usa 1), entrega automática a cada 5 min pelo servidor.
- Frequência: 1 a 6 aulas por chamada, 80 alunos, registro 600 caracteres; risco após 10 aulas; 3 dias seguidos; fotos da portaria guardadas 15 dias.
- Corretor: 1 a 50 questões, A a D ou A a E, até 60 cartões em branco.
- Calendário: 200 datas por rede e por escola; horas por dia até 12.
- Recursos: lote 2 a 60; aulas por turno 1 a 12; SLA atendimento até 720 h, solução até 2.160 h.
- TV: 80 itens por playlist; vídeo 50 MB; comunicados até 30, texto 500, 5 a 120 s; código da TV renova a cada 10 min e vale 30 min.
- Famílias: até 4 responsáveis na ficha, 2 na importação; avisos de chegada limitados a 1.500 e-mails por dia no total.
- Folha Mágica: 1 a 200 cópias. Teleprompter: 200 mil caracteres, .txt até 1 MB. Lousa: PDF 60 MB e 30 páginas por vez.
- Dicas: 5 arquivos, 10 MB cada, 20 MB total, 5 links (aluno: 2 links, sem arquivo).
- Biblioteca (admin): PDF/CBZ 150 MB e áudio 300 MB na tela.
- Formação: tempo mínimo 40% da aula (1 min a 2 h), vídeos 90%, nota 70% e 3 tentativas por padrão, prova de 90 min, 30 s entre aberturas.

### 26.3 Pontos a confirmar antes de fechar o manual
1. Onde o professor corrige as questões pendentes da Prova online (dissertativas, grades, curtas não reconhecidas).
2. Se haverá campo para escolher o número de avisos (0 a 3) e botão "Cancelar prova" no painel.
3. Rótulo exato do campo BNCC por questão no Gerador.
4. O que o "Modo público" do Mural esconde além da legenda e da lista por aluno.
5. Limite de upload da estante Histórias (tela 150 MB × regra 100 MB).
6. Se `/aluno.html` ainda é usado (e o risco do gabarito público em `avaliacoes`).
7. Se a secretaria escolar acessa o painel da TV.
8. Texto da validação de certificado revogado.
9. "7 dias grátis" da página inicial: conferir a regra real de licença de teste no `/entrar/`.
