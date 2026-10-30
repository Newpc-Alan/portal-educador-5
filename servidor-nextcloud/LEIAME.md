# Entrega de arquivos do Portal pelo servidor NEWPC

O Portal do Educador confere quem pode abrir cada arquivo do acervo. Depois gera um link assinado que vale poucos minutos.

O script `arquivo.php`, instalado no servidor do Nextcloud, faz só duas coisas:

1. confere a assinatura do link;
2. entrega o arquivo direto da pasta **Drive Portal do Educador**.

Ele não acessa o banco do Portal e não guarda dados de ninguém. O único segredo no servidor é a chave de assinatura.

Tempo estimado: 20 minutos. Todos os comandos rodam no servidor Ubuntu.

## 1. Conferências antes de começar

```bash
# A criptografia do lado do servidor precisa estar DESLIGADA.
# Se estiver ligada, os arquivos no disco ficam cifrados e o script não consegue entregar.
sudo -u www-data php /var/www/nextcloud/occ encryption:status

# Pasta de dados do Nextcloud
sudo -u www-data php /var/www/nextcloud/occ config:system:get datadirectory
```

A pasta raiz do Portal segue este formato:

```
<pasta de dados>/<usuário dono da pasta>/files/Drive Portal do Educador
```

Por exemplo: `/var/www/nextcloud/data/admin/files/Drive Portal do Educador`.

Confira que ela existe:

```bash
sudo -u www-data ls "/CAMINHO/DA/PASTA/Drive Portal do Educador"
```

Deve listar 01-Acervo-NEWPC, 02-Formacao-Continuada e as demais pastas.

> Enquanto a pasta não for renomeada, o nome dela ainda é "Banco Curricular". Use esse nome no caminho e ajuste depois da renomeação.

## 2. Instalar o script

```bash
sudo mkdir -p /var/www/pde
sudo cp arquivo.php /var/www/pde/arquivo.php
sudo chown root:root /var/www/pde/arquivo.php
sudo chmod 644 /var/www/pde/arquivo.php
```

## 3. Criar a chave e o arquivo de configuração

```bash
sudo mkdir -p /etc/pde
CHAVE=$(openssl rand -hex 32)
sudo tee /etc/pde/entrega.php >/dev/null <<EOF
<?php
return [
  'chave' => '$CHAVE',
  'raiz'  => '/CAMINHO/DA/PASTA/Drive Portal do Educador',
];
EOF
sudo chown root:www-data /etc/pde/entrega.php
sudo chmod 640 /etc/pde/entrega.php
echo "$CHAVE"     # mostra a chave UMA vez, para o passo 5
unset CHAVE
```

Troque `/CAMINHO/DA/PASTA` pelo caminho do passo 1.

## 4. Publicar no Apache

Edite o site com HTTPS (`/etc/apache2/sites-enabled/cloud-le-ssl.conf`). Dentro do bloco `<VirtualHost *:443>`, acrescente:

```apache
Alias /pde /var/www/pde
<Directory /var/www/pde>
    Options -Indexes
    AllowOverride None
    Require all granted
</Directory>
```

Depois teste e recarregue:

```bash
sudo apachectl configtest && sudo systemctl reload apache2
curl -s https://cloud.portaldoeducador.com.br/pde/arquivo.php
```

O curl deve responder **Link inválido.** Isso é o correto: o script está no ar e recusando links sem assinatura.

Se aparecer **Serviço não configurado.**, revise o passo 3. Se der erro 500, veja o log do Apache:

```bash
sudo tail -20 /var/log/apache2/error.log
```

## 5. Guardar a mesma chave no Google (Secret Manager)

A chave precisa ser **a mesma** nos dois lados. Escolha uma das duas formas.

**Forma 1 · Pelo navegador**

1. Entre em https://console.cloud.google.com/security/secret-manager?project=portal-educador-5
2. Clique em **Criar secret**.
3. Em nome, use exatamente `NC_ENTREGA_CHAVE`.
4. Em valor, cole a chave do passo 3.

**Forma 2 · Pela linha de comando** (com acesso ao projeto)

```bash
firebase functions:secrets:set NC_ENTREGA_CHAVE --project portal-educador-5
```

Cuidados com a chave:

- não envie a chave por WhatsApp, e-mail ou chat;
- depois de gravada nos dois lugares, ninguém precisa mais dela;
- se ela vazar, gere outra (passo 3) e atualize o secret (passo 5).

Por último, avise o Alan. Com o secret criado, a função `linkArquivoNc` pode ser publicada no Portal.

## Como testar depois da publicação

1. No Portal, como administrador, abra **Acervo**.
2. No card **Vincular arquivos do servidor NEWPC**, cole o caminho de um PDF que esteja no Nextcloud. Exemplo: `01-Acervo-NEWPC/Atividades/Anos-Iniciais/teste.pdf`.
3. Na lista, clique em **Abrir**. O PDF deve abrir numa aba nova, servido por `cloud.portaldoeducador.com.br/pde/...`.

## Segurança: o que o script garante

- **Link adulterado:** mudar o arquivo, o prazo ou o nome invalida a assinatura (erro 403).
- **Link vencido:** expira em 5 a 15 minutos (erro 410).
- **Fora da pasta:** caminhos com `..` e atalhos (symlinks) que apontam para fora do Drive Portal do Educador são recusados.
- **Download forçado:** HTML, SVG e outros tipos que poderiam rodar código no domínio vão sempre como download.
- **Exibido no navegador:** só PDF, imagem, áudio e vídeo.
- **Vídeo:** suporta adiantar e voltar (Range), sem baixar o arquivo inteiro.

## Próximo passo recomendado

Criar um subdomínio só para os arquivos, por exemplo `arquivos.portaldoeducador.com.br`. Assim o login do Nextcloud fica separado dos arquivos entregues. Depois disso, é só trocar o parâmetro `NC_ENTREGA_URL` da função.
