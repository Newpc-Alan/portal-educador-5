#!/usr/bin/env bash
# Gera o APK do aluno do Portal Maestro (app Android que abre https://sala.portaldoeducador.com.br/aluno/ em tela cheia).
# Roda no Cloud Shell. Uso:  bash scripts/maestro-apk.sh 1.0.0 1        (versão visível e número da versão)
# Tudo fica em ~/maestro-apk. A chave de assinatura (maestro.keystore) e a senha (.senha) são criadas na 1ª vez
# e PRECISAM ser guardadas: sem elas não dá para publicar atualização do mesmo app. A senha nunca é mostrada na tela.
set -euo pipefail
VER="${1:-1.0.0}"; COD="${2:-1}"
BASE="$HOME/maestro-apk"; mkdir -p "$BASE"; cd "$BASE"
HOST="sala.portaldoeducador.com.br"; PACOTE="br.com.portaldoeducador.maestro"
echo "== Portal Maestro APK $VER ($COD) =="

# 1) JDK 17 (o Bubblewrap pede essa versão)
if [ ! -x "$BASE/jdk/bin/java" ]; then
  echo "Baixando JDK 17..."
  curl -sSL -o jdk.tgz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
  mkdir -p jdk && tar -xzf jdk.tgz -C jdk --strip-components=1 && rm jdk.tgz
fi
export JAVA_HOME="$BASE/jdk"; export PATH="$JAVA_HOME/bin:$PATH"

# 2) Android SDK (ferramentas de linha de comando, plataforma e build-tools)
if [ ! -d "$BASE/android-sdk/build-tools/34.0.0" ]; then
  echo "Baixando Android SDK..."
  mkdir -p android-sdk/cmdline-tools
  curl -sSL -o cmd.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q -o cmd.zip -d android-sdk/cmdline-tools && rm cmd.zip
  rm -rf android-sdk/cmdline-tools/latest && mv android-sdk/cmdline-tools/cmdline-tools android-sdk/cmdline-tools/latest
  set +o pipefail; yes | android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root="$BASE/android-sdk" --licenses >/dev/null; set -o pipefail
  android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root="$BASE/android-sdk" "platforms;android-34" "build-tools;34.0.0" "platform-tools" | tail -2
fi
export ANDROID_HOME="$BASE/android-sdk"
# o Bubblewrap ainda procura o SDK no formato antigo (pasta "tools")
[ -e "$BASE/android-sdk/tools" ] || ln -s "$BASE/android-sdk/cmdline-tools/latest" "$BASE/android-sdk/tools"

# 3) Bubblewrap (ferramenta do Google que empacota a página como app)
if [ ! -x "$BASE/node_modules/.bin/bubblewrap" ]; then echo "Instalando Bubblewrap..."; npm i --silent --prefix "$BASE" @bubblewrap/cli@1.23.0 >/dev/null; fi
mkdir -p "$HOME/.bubblewrap"
printf '{"jdkPath":"%s","androidSdkPath":"%s"}\n' "$BASE/jdk" "$BASE/android-sdk" > "$HOME/.bubblewrap/config.json"

# 4) chave de assinatura: criada uma única vez, com senha aleatória guardada em .senha (só leitura do dono)
if [ ! -f "$BASE/maestro.keystore" ]; then
  echo "Criando a chave de assinatura (uma vez só)..."
  umask 077; openssl rand -hex 20 > "$BASE/.senha"
  keytool -genkeypair -keystore "$BASE/maestro.keystore" -alias maestro -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$(cat "$BASE/.senha")" -keypass "$(cat "$BASE/.senha")" -dname "CN=NEWPC Tecnologia, O=NEWPC Tecnologia, L=Campo Grande, ST=MS, C=BR" >/dev/null 2>&1
fi
export BUBBLEWRAP_KEYSTORE_PASSWORD="$(cat "$BASE/.senha")"; export BUBBLEWRAP_KEY_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD"

# 5) projeto Android gerado a partir da página do aluno
mkdir -p "$BASE/projeto"; cd "$BASE/projeto"
cat > twa-manifest.json <<JSON
{
  "packageId": "$PACOTE",
  "host": "$HOST",
  "name": "Portal Maestro · Aluno",
  "launcherName": "Maestro",
  "display": "fullscreen",
  "orientation": "default",
  "themeColor": "#0F2C4A",
  "themeColorDark": "#0F2C4A",
  "navigationColor": "#0F2C4A",
  "navigationColorDark": "#0F2C4A",
  "navigationDividerColor": "#0F2C4A",
  "navigationDividerColorDark": "#0F2C4A",
  "backgroundColor": "#0F2C4A",
  "enableNotifications": false,
  "startUrl": "/aluno/",
  "iconUrl": "https://$HOST/aluno/icons/aluno-512.png",
  "maskableIconUrl": "https://$HOST/aluno/icons/aluno-maskable-512.png",
  "splashScreenFadeOutDuration": 300,
  "signingKey": { "path": "$BASE/maestro.keystore", "alias": "maestro" },
  "appVersionName": "$VER",
  "appVersion": "$VER",
  "appVersionCode": $COD,
  "shortcuts": [],
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "https://$HOST/aluno/manifest.webmanifest",
  "fallbackType": "webview",
  "features": {},
  "alphaDependencies": { "enabled": false },
  "enableSiteSettingsShortcut": false,
  "isChromeOSOnly": false,
  "isMetaQuest": false,
  "fullScopeUrl": "https://$HOST/aluno/",
  "minSdkVersion": 24
}
JSON
echo "Gerando o projeto Android..."
"$BASE/node_modules/.bin/bubblewrap" update --skipVersionUpgrade
echo "Compilando e assinando..."
"$BASE/node_modules/.bin/bubblewrap" build --skipPwaValidation
cp -f app-release-signed.apk "$BASE/maestro-$VER.apk"

# 6) arquivo de verificação do site (vai para sala.portaldoeducador.com.br/.well-known/assetlinks.json)
SHA=$(keytool -list -v -keystore "$BASE/maestro.keystore" -alias maestro -storepass "$BUBBLEWRAP_KEYSTORE_PASSWORD" 2>/dev/null | grep -m1 "SHA256:" | sed 's/.*SHA256: //')
cat > "$BASE/assetlinks.json" <<JSON
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": { "namespace": "android_app", "package_name": "$PACOTE", "sha256_cert_fingerprints": ["$SHA"] }
}]
JSON
unset BUBBLEWRAP_KEYSTORE_PASSWORD BUBBLEWRAP_KEY_PASSWORD
ls -la "$BASE/maestro-$VER.apk"
echo "PRONTO: $BASE/maestro-$VER.apk e $BASE/assetlinks.json"
