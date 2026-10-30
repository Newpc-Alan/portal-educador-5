<?php
// Portal do Educador · entrega de arquivos do servidor NEWPC (Nextcloud)
// O Portal (Firebase) confere quem pode abrir e gera um link assinado que vale poucos minutos.
// Este script só confere a assinatura e entrega o arquivo. Não guarda nada e não acessa o banco.
// Configuração fora da pasta pública: /etc/pde/entrega.php (chave e pasta raiz).

declare(strict_types=1);

function sair(int $codigo, string $msg): void {
    http_response_code($codigo);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo $msg;
    exit;
}

function b64url(string $bin): string {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function caminhoValido(string $c): bool {
    if ($c === '' || strlen($c) > 500 || $c[0] === '/' || preg_match('/[\\\\\x00\r\n]/', $c)) return false;
    foreach (explode('/', $c) as $p) { if ($p === '' || $p === '.' || $p === '..') return false; }
    return true;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'HEAD') sair(405, 'Método não permitido.');

$cfg = @include (getenv('PDE_ENTREGA_CFG') ?: '/etc/pde/entrega.php');
if (!is_array($cfg) || empty($cfg['chave']) || strlen((string)$cfg['chave']) < 32 || empty($cfg['raiz'])) sair(500, 'Serviço não configurado.');

$c = (string)($_GET['c'] ?? '');
$e = (string)($_GET['e'] ?? '');
$n = (string)($_GET['n'] ?? '');
$s = (string)($_GET['s'] ?? '');

if (!caminhoValido($c) || !ctype_digit($e) || $s === '' || strlen($n) > 150) sair(400, 'Link inválido.');
$exp = (int)$e;
$agora = time();
if ($exp < $agora) sair(410, 'Este link expirou. Volte ao Portal e abra o arquivo de novo.');
if ($exp > $agora + 3600) sair(400, 'Link inválido.');

$esperada = b64url(hash_hmac('sha256', "v1\n$c\n$e\n$n", (string)$cfg['chave'], true));
if (!hash_equals($esperada, $s)) sair(403, 'Link inválido.');

// o arquivo precisa estar DENTRO da pasta raiz, mesmo seguindo atalhos (symlinks)
$raiz = realpath((string)$cfg['raiz']);
$arq = realpath($raiz . '/' . $c);
if ($raiz === false || $arq === false || strpos($arq, $raiz . DIRECTORY_SEPARATOR) !== 0 || !is_file($arq) || !is_readable($arq)) sair(404, 'Arquivo não encontrado.');

// Tipos que o navegador pode exibir sem risco. Todo o resto (inclusive HTML e SVG) vai como download.
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($arq) ?: 'application/octet-stream';
$seguro = (bool)preg_match('#^(application/pdf|image/(png|jpeg|gif|webp)|audio/(mpeg|mp4|ogg|wav|x-wav|webm)|video/(mp4|webm|ogg))$#', $mime);
if (!$seguro) $mime = 'application/octet-stream';

$nome = preg_replace('/[\x00-\x1f"\\\\\/]/', ' ', $n !== '' ? $n : basename($arq));
$tam = filesize($arq);
$ini = 0;
$fim = $tam - 1;

header('X-Content-Type-Options: nosniff');
// o leitor de PDF do Chrome não abre em página com "sandbox"; para os demais tipos, a página fica isolada
if ($mime !== 'application/pdf') header("Content-Security-Policy: sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'");
header('Referrer-Policy: no-referrer');
header('Access-Control-Allow-Origin: https://app.portaldoeducador.com.br');
header('Cache-Control: private, max-age=300');
header('Accept-Ranges: bytes');
header('Content-Type: ' . $mime);
header('Content-Disposition: ' . ($seguro ? 'inline' : 'attachment') . '; filename="' . $nome . '"; filename*=UTF-8\'\'' . rawurlencode($nome));

// Pedaços do arquivo (Range): o vídeo pode ser adiantado sem baixar tudo
if (isset($_SERVER['HTTP_RANGE']) && preg_match('/^bytes=(\d*)-(\d*)$/', $_SERVER['HTTP_RANGE'], $r) && $tam > 0) {
    if ($r[1] === '' && $r[2] === '') sair(416, 'Intervalo inválido.');
    if ($r[1] === '') { $ini = max(0, $tam - (int)$r[2]); }
    else { $ini = (int)$r[1]; if ($r[2] !== '') $fim = min((int)$r[2], $tam - 1); }
    if ($ini > $fim || $ini >= $tam) { header("Content-Range: bytes */$tam"); sair(416, 'Intervalo inválido.'); }
    http_response_code(206);
    header("Content-Range: bytes $ini-$fim/$tam");
}
header('Content-Length: ' . ($fim - $ini + 1));
if ($_SERVER['REQUEST_METHOD'] === 'HEAD' || $tam === 0) exit;

@set_time_limit(0);
while (ob_get_level()) ob_end_clean();
$fp = fopen($arq, 'rb');
if ($fp === false) sair(500, 'Não foi possível ler o arquivo.');
fseek($fp, $ini);
$resta = $fim - $ini + 1;
while ($resta > 0 && !feof($fp) && !connection_aborted()) {
    $bloco = fread($fp, (int)min(1048576, $resta));
    if ($bloco === false) break;
    echo $bloco;
    flush();
    $resta -= strlen($bloco);
}
fclose($fp);
