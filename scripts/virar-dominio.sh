#!/usr/bin/env bash
# Virada do Portal 5.0 para o domínio principal (www.portaldoeducador.com.br).
# Roda numa branch, confere e só depois junta na main (main = no ar). Não mexe em DNS: isso é feito no painel da Webnode.
# Uso: bash scripts/virar-dominio.sh
set -euo pipefail
cd "$(dirname "$0")/.."
NOVO="www.portaldoeducador.com.br"; VELHO="app.portaldoeducador.com.br"
echo "$NOVO" > CNAME                                                       # GitHub Pages passa a servir no www
sed -i "s#https://$VELHO#https://$NOVO#g" functions/endereco.js          # links dos e-mails e dos cartões de acesso
sed -i "s#https://$VELHO/#https://$NOVO/#g" noticia/index.html formacao/index.html   # metatags (prévia de link e canonical)
# CORS: o www já está liberado no Storage (cors.json) e no worker do acervo; o arquivo.php do Nextcloud aceita um só endereço
sed -i "s#Access-Control-Allow-Origin: https://$VELHO#Access-Control-Allow-Origin: https://$NOVO#" servidor-nextcloud/arquivo.php
echo "Pronto. Restam com o endereço antigo (de propósito):"; grep -rln "$VELHO" . --exclude-dir=node_modules --exclude-dir=.git || true
