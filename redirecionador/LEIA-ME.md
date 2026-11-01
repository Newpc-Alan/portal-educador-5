# Redirecionador do endereço antigo

Este pasta vira um repositório próprio no GitHub (ex.: `Newpc-Alan/portal-app-redireciona`) com GitHub Pages
e domínio `app.portaldoeducador.com.br`. Ele leva qualquer endereço antigo para o mesmo caminho em
`www.portaldoeducador.com.br`, mantendo `?parâmetros` e `#âncora` (os cartões de QR usam `/entrar/#q=...`).

- `index.html` e `404.html` são iguais: o GitHub Pages devolve o `404.html` para qualquer caminho que não existe,
  e o script lê o endereço original do navegador e redireciona.
- Só publicar DEPOIS que o repositório principal trocar o CNAME para o www (o GitHub não deixa dois sites com o mesmo domínio).
