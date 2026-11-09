# Apresentação

Este manual reúne tudo o que foi construído no Portal do Educador 5.0 até 1º de novembro de 2026. Ele foi escrito a partir do próprio sistema, tela por tela, e usa os mesmos nomes de botões e menus que aparecem para quem usa.

## Como usar este manual

O conteúdo está dividido em três partes, cada uma para um leitor diferente:

| Parte | Para quem | O que encontra |
|---|---|---|
| **Parte 1 · Usuários** | Professores, alunos, gestores, secretarias escolares, portaria e Secretaria de Educação | Como entrar, o que cada perfil vê e o passo a passo de cada módulo |
| **Parte 2 · Equipe NEWPC** | Administradores, implantação e suporte da NEWPC | Como cadastrar uma rede, liberar módulos, importar pessoas, publicar conteúdo e atender chamados |
| **Parte 3 · Técnico** | Quem mantém e evolui o código | Arquitetura, banco de dados, regras de acesso, funções do servidor, testes e publicação |

Ao longo do texto aparecem quatro tipos de destaque:

:::dica
Atalhos e boas práticas que poupam tempo.
:::

:::atencao
Pontos em que um engano gera retrabalho, perda de dados ou exposição de informação.
:::

:::regra
Como o sistema decide alguma coisa (quem vê, quando bloqueia, o que conta).
:::

:::nota
Informação de contexto ou algo ainda em evolução.
:::

## O Portal em uma página

O Portal do Educador é uma plataforma de apoio ao professor usada pelas redes municipais de ensino. Uma única conta Google dá acesso a conteúdos prontos, ferramentas de sala de aula, avaliações e gestão escolar. O que cada pessoa vê depende de três coisas:

1. **O perfil** dela (professor, aluno, gestor, Secretaria de Educação, secretaria escolar, portaria ou administrador NEWPC).
2. **O plano do município** (Básico, Intermediário ou Completo), que define quais módulos estão contratados para professores e para alunos e quais recursos extras valem para a rede (Prova online, Portal IA, Educador em Rede, Sala Conectada, Turma ao Vivo). A NEWPC também pode liberar recursos exclusivos para um professor específico.
3. **A situação de cada módulo** no catálogo geral: Liberado, Em breve ou Oculto.

### Perfis

| Perfil | Quem é | Entra por |
|---|---|---|
| Professor | Docente da rede (institucional) ou assinante avulso | Conta Google pré-cadastrada pela rede, ou autocadastro com 7 dias de teste |
| Aluno | Estudante da rede | Conta Google da escola, lista importada ou cartão com QR (quando o professor abre a entrada da turma) |
| Gestor da escola | Diretor ou coordenador (até 5 escolas) | Importação da equipe |
| Secretaria de Educação | Técnicos da Secretaria Municipal | Importação da equipe |
| Secretaria escolar | Equipe administrativa da escola | Convite do gestor ou importação |
| Portaria | Responsável pela entrada da escola | Convite do gestor ou importação |
| Administrador | Equipe NEWPC | Definido internamente |

### Os módulos do Início

<div class="cards">
<div><img src="{{C:videos}}"><b>Vídeos Educativos</b><span>Professor e aluno</span></div>
<div><img src="{{C:jogos}}"><b>Jogos Educacionais</b><span>Professor e aluno</span></div>
<div><img src="{{C:portalia}}"><b>Portal IA</b><span>Prova, plano, atividade e parecer com IA</span></div>
<div><img src="{{C:provas}}"><b>Provas e Avaliações</b><span>Impressa, online e cartão-resposta</span></div>
<div><img src="{{C:portal360}}"><b>Portal 360º VR</b><span>Professor e aluno</span></div>
<div><img src="{{C:atividades}}"><b>Atividades</b><span>Prontas para imprimir (BNCC)</span></div>
<div><img src="{{C:relatorios}}"><b>Central de Relatórios</b><span>Registros e pareceres</span></div>
<div><img src="{{C:datas}}"><b>Datas Comemorativas</b><span>Kits por data</span></div>
<div><img src="{{C:colorir}}"><b>Desenhos para Colorir</b><span>Na tela ou impresso</span></div>
<div><img src="{{C:historias}}"><b>Histórias Educativas</b><span>Material próprio NEWPC</span></div>
<div><img src="{{C:biblioteca}}"><b>Biblioteca</b><span>Livros, gibis e audiolivros</span></div>
<div><img src="{{C:formacao}}"><b>Formação Continuada</b><span>Cursos com certificado</span></div>
<div><img src="{{C:museus}}"><b>Museus Virtuais</b><span>Visitas em 360º</span></div>
<div><img src="{{C:dicas}}"><b>Dicas do Professor</b><span>Práticas compartilhadas</span></div>
<div><img src="{{C:dicasaluno}}"><b>Dica do Aluno</b><span>Só para alunos</span></div>
<div><img src="{{C:apps}}"><b>Aplicativos Úteis</b><span>Folha Mágica, Teleprompter, TV</span></div>
<div><img src="{{C:gestao}}"><b>Gestão Escolar</b><span>Frequência, notas, chamados</span></div>
<div><img src="{{C:maestro}}"><b>Portal Maestro</b><span>Condução da aula nos dispositivos</span></div>
</div>

### Endereços

| Endereço | O que é |
|---|---|
| `www.portaldoeducador.com.br` | Página de apresentação do Portal 5.0 |
| `www.portaldoeducador.com.br/entrar/` | Entrada e ambiente principal de todos os perfis |
| `www.portaldoeducador.com.br/entrar/?como=aluno` | Entrada já no modo aluno (útil para divulgar às escolas) |
| `www.portaldoeducador.com.br/bncc/` | Buscador público da BNCC (habilidades por etapa, ano e componente) |
| `www.portaldoeducador.com.br/maestro/` | Apresentação do Portal Maestro |
| `jogos.portaldoeducador.com.br` | Jogos educacionais |
| `sala.portaldoeducador.com.br` | Portal Maestro |
| `portal360.portaldoeducador.com.br` | Portal 360º VR |

## O que mudou nesta versão

Versão 2.0, de 1º de novembro de 2026. Principais novidades em relação à versão de outubro:

| Novidade | Onde aparece |
|---|---|
| **Portal IA**: prova, simulado, diagnóstica, plano, atividade, parecer, rubrica, projeto e outros materiais com IA, gabarito em página separada, BNCC em cada questão, PDF e Word | Início do professor |
| **Aula com IA** na Lousa (Básica e Ultra, com ilustrações) | Lousa |
| **Corretor de gabarito** ligado ao Portal IA (botão e QR "Corrigir no celular") | Portal IA e Provas |
| **Sala Conectada e Turma ao Vivo**: enviar material para a turma, presença dos alunos e quem abriu | Início do professor |
| **Entrada do aluno por cartão QR**, com tempo de aula | Turma ao Vivo e Portal do Aluno |
| **Educador em Rede**: compartilhar trabalhos com a rede, com moderação da Secretaria | Meus trabalhos e Materiais da rede |
| **Acervo por município**, organizado em pastas, com botão **Baixar** | Acervo |
| **Notícias** com destaque, link público e imagem para redes sociais | Início |
| **Famílias**: envio de material e recados às famílias | Gestão Escolar |
| **Buscador da BNCC** público | `www.portaldoeducador.com.br/bncc/` |
| **Auditoria**: tudo o que é criado, alterado ou excluído fica registrado, com as entradas no Portal | Sistema (administrador NEWPC) |

Atualização de 4 de novembro de 2026:

| Novidade | Onde aparece |
|---|---|
| **Teste grátis de 7 dias** com tudo à vista: recursos da escola com cadeado e **Quero isso na minha escola**, 5 provas grátis, Formação liberada e 10 créditos de IA de demonstração | Início do professor em teste |
| **Minhas TVs**: o professor avulso ou em teste monta a própria TV, sem misturar com a da escola | Portal TV |
| **Franquia mensal de IA** por educador ativo (20 ou 40 créditos), créditos por educador, retirar pacote e professores fora de rede | Central de IA |
| **Excluir ou juntar escola** duplicada, **Reenviar falhas** e máximo por dia nos comunicados | Escolas e Comunicados |
| **Painel da TV** da recepção com vitrine para visitantes e gestão por PIN | TV da recepção |

Atualização de 9 de novembro de 2026:

| Novidade | Onde aparece |
|---|---|
| **Lousa** com Apresentar (revelação item a item, quiz com confete, sorteio e cronômetro), **Aulas prontas** grátis, **Ferramentas IA** (Perguntar, Circular, Passar a limpo, Pintor, Mapa mental, Legendas), livro em PDF, Forma perfeita e **QR code** para o aluno | Lousa |
| **Vídeo interativo**: o vídeo pausa e a turma responde; grátis nos vídeos do catálogo | Vídeos Educativos |
| **Termômetro da turma**: pergunta aberta, a IA agrupa as respostas da turma (grátis) | Controle da aula e Turma ao Vivo |
| **Troca de professor** com a aula em andamento (bater na porta) e **Onde vai ser a aula** | Turma ao Vivo |
| **Voz vira texto**: microfone nos campos, Ditado no quadro e Ditar pelo celular | Lousa, Portal IA, Pareceres |
| **Formação Continuada**: atividade prática com retorno da IA, cursos da sua rede, lembretes e atualização cadastral ao começar | Formação Continuada |
| **Créditos**: tabela nova, franquia que acumula até o fim do contrato, Termômetro e Pareceres grátis e compra direta (Pix, boleto ou cartão) quando o pagamento online estiver ligado | Portal IA e Meu cadastro |
| **Aparelhos conectados** (aluno em 1, professor em até 3) e **Teleprompter** por blocos com apresentação só com o texto | Meu cadastro e Aplicativos Úteis |
| **Lara no WhatsApp** entende print de tela e foto de equipamento (abre chamado com a descrição) e lembra da conversa das últimas 2 horas | Suporte pelo WhatsApp |
| **Redes contratantes** (municipal, estadual, particular, instituição), **inventário de equipamentos** por planilha e licença Google por Chromebook | Administrador |
| **Financeiro** (recebimentos, notas a emitir, comissões), **pagamento online pelo Asaas** e **cortesia da diretoria** nos créditos | Administrador |
| **Fábrica de cursos com IA**, cursos exclusivos de rede e **Relatório da formação** para a Secretaria | Formação (admin) e Painel da Rede |
| **Selo Rede Verde**, monitoramento com resumo diário e cofre de backup fora da NEWPC | Painel da Rede e Sistema |
| **Lara da equipe** (responde pelos POPs no WhatsApp), **A Lara em números** e lista **O que a Lara não soube** | Atendimento WhatsApp |

