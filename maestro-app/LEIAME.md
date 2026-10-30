# App do aluno do Portal Maestro (Android)

O app abre `https://sala.portaldoeducador.com.br/aluno/` em tela cheia, num WebView próprio.
A câmera fica liberada só para páginas do `portaldoeducador.com.br` (entrada do aluno por QR).

## Gerar uma versão
GitHub › Actions › **App do Maestro (aluno)** › Run workflow, com a versão (ex.: 1.1.0) e o número
(sempre maior que o do app instalado). No fim aparece o link do `.apk` para abrir no tablet.

## Chave de assinatura (uma vez só)
Todas as versões precisam da MESMA chave; sem ela, o tablet não aceita atualizar por cima.
Ela fica em dois segredos do repositório: `MAESTRO_KEYSTORE_B64` e `MAESTRO_SENHA`.
Guarde também uma cópia do arquivo `maestro.keystore` e da senha num lugar seguro (cofre de senhas).
