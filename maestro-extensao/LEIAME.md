# Portal Maestro · extensão do aluno (Chromebook)

Fonte oficial da extensão desde nov/2026 (antes ficava no repositório newpc-sala, pasta extensao-aluno).

## v0.9.0 · entra pela conta do Portal
- O aluno entra no Portal do Educador com a conta dele (cartão QR, código + PIN ou conta Google da escola).
- Quando o professor abre a aula pelo "Dar aula agora", o Portal avisa a extensão (portal.js) e o Chromebook entra sozinho na aula do Maestro: sem digitar número nem nome.
- A tela de entrada da extensão ganhou o botão "Entrar com a minha conta do Portal". O número da aula continua funcionando.
- Com "entrada obrigatória" (política da escola), o aluno pode usar o Portal para entrar; o bloqueio do professor continua valendo.
- Aula aberta pelo Portal tem hora para acabar (controle/ate): 1 minuto depois do fim o aparelho sai da aula sozinho.

## Instalar para teste
chrome://extensions → Modo do desenvolvedor → Carregar sem compactação → esta pasta.
Em escola, publicar pelo Google Admin (Apps e extensões) para atualizar todos os Chromebooks sozinho.
