# App "Atendimento PDE" (Android)

Abre `https://www.portaldoeducador.com.br/atendimento/` em tela cheia. É um TWA (Trusted Web Activity):
roda no motor do Chrome do celular, por isso o login Google e as notificações de cliente esperando funcionam
(dentro de um WebView comum o Google bloqueia o login).

- Precisa do **Google Chrome** instalado e atualizado no celular.
- Sem barra de endereço: depende do arquivo `/.well-known/assetlinks.json` publicado no site, com a impressão
  digital da chave. Se a chave mudar, atualize esse arquivo, senão o app abre com a barra do navegador (funciona igual).

## Gerar uma versão
GitHub › Actions › **App Atendimento PDE** › Run workflow, com a versão (ex.: 1.0.0) e o número
(sempre maior que o do app instalado). No fim aparece o link do `.apk`.

## Chave
Usa a mesma chave do app do Maestro (segredos `MAESTRO_KEYSTORE_B64` e `MAESTRO_SENHA`). Nada novo para criar.
