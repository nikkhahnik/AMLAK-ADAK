<?php
/**
 * Admin API for amlakadak.ir on Apache/LiteSpeed shared hosting.
 * Port of netlify/functions/admin.mjs — identical request/response contract,
 * so admin/admin.js needs no change at all.
 *
 * Settings live in config.php next to this file (never in git). See config.sample.php.
 */
declare(strict_types=1);

const DATA       = 'properties.json';
const SESSION_H  = 8;
const SLUG_RE    = '/^[a-z0-9][a-z0-9-]{2,63}$/';
const UPLOAD_RE  = '#^/assets/uploads/[a-z0-9-]{3,64}-[a-z0-9]{4,16}-\d{1,3}\.jpg$#';
const IMG_RE     = '#^/assets/[a-z0-9/_.-]+\.(jpe?g|png|webp)$#i';
const CATS       = ['apartment', 'villa', 'commercial', 'land'];
const LOCK_MAX   = 5;
const LOCK_SEC   = 15 * 60;

$CFG = [];
$cfgFile = __DIR__ . '/config.php';
if (is_file($cfgFile)) { $CFG = (array) (require $cfgFile); }
function cfg(string $k, string $d = ''): string {
    global $CFG;
    $v = $CFG[$k] ?? getenv($k);
    return ($v === false || $v === null || $v === '') ? $d : (string) $v;
}

function out(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Byte-for-byte equivalent of JSON.stringify(value, null, 1) in Node. */
function json1(array $value): string {
    $s = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    return preg_replace_callback('/^(?: {4})+/m', static function (array $m): string {
        return str_repeat(' ', (int) (strlen($m[0]) / 4));
    }, $s);
}

function body(): array {
    $raw = file_get_contents('php://input') ?: '';
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

// ---- auth ------------------------------------------------------------------
function secretKey(): string {
    return hash('sha256', 'adak-admin|' . cfg('ADMIN_PASSWORD') . '|' . cfg('GITHUB_TOKEN') . '|' . cfg('ADMIN_USER'), true);
}
function sign(string $exp): string {
    return rtrim(strtr(base64_encode(hash_hmac('sha256', $exp, secretKey(), true)), '+/', '-_'), '=');
}
function makeToken(): string {
    $exp = (string) (int) round(microtime(true) * 1000 + SESSION_H * 3600000);
    return $exp . '.' . sign($exp);
}
/**
 * Read the Authorization header. Apache/LiteSpeed expose it in different places
 * (and sometimes not in $_SERVER at all), so check every one.
 */
function authHeader(): string {
    foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION', 'REDIRECT_REDIRECT_HTTP_AUTHORIZATION'] as $k) {
        if (!empty($_SERVER[$k])) return (string) $_SERVER[$k];
    }
    $all = [];
    if (function_exists('getallheaders')) {
        $all = getallheaders() ?: [];
    } elseif (function_exists('apache_request_headers')) {
        $all = apache_request_headers() ?: [];
    }
    foreach ($all as $name => $value) {
        if (strcasecmp((string) $name, 'Authorization') === 0) return (string) $value;
    }
    return '';
}
function validToken(): bool {
    $t = preg_replace('/^Bearer\s+/i', '', trim(authHeader()));
    $parts = explode('.', $t, 2);
    if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') return false;
    if ((float) $parts[0] < microtime(true) * 1000) return false;
    return hash_equals(sign($parts[0]), $parts[1]);
}
function sameSecret(string $a, string $b): bool {
    return hash_equals(hash('sha256', $a, true), hash('sha256', $b, true));
}

function lockFile(string $ip): string {
    return sys_get_temp_dir() . '/adak-admin-' . hash('sha256', 'lk|' . $ip) . '.json';
}
function failCount(string $ip): int {
    $f = lockFile($ip);
    if (!is_file($f)) return 0;
    $r = json_decode((string) @file_get_contents($f), true);
    if (!is_array($r) || (time() - (int) ($r['t'] ?? 0)) >= LOCK_SEC) return 0;
    return (int) ($r['n'] ?? 0);
}
function noteFail(string $ip): void {
    @file_put_contents(lockFile($ip), json_encode(['n' => failCount($ip) + 1, 't' => time()]), LOCK_EX);
}
function clearFails(string $ip): void { @unlink(lockFile($ip)); }

// ---- GitHub (source of truth; a GitHub Action rebuilds and uploads the site) ----
function gh(string $path, string $method = 'GET', ?array $payload = null): array {
    $repo = cfg('GITHUB_REPO', 'nikkhahnik/AMLAK-ADAK');
    $ch = curl_init('https://api.github.com/repos/' . $repo . $path);
    $headers = [
        'Authorization: Bearer ' . cfg('GITHUB_TOKEN'),
        'Accept: application/vnd.github+json',
        'X-GitHub-Api-Version: 2022-11-28',
        'User-Agent: adak-admin',
    ];
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $res  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($res === false) throw new RuntimeException('ارتباط با گیت‌هاب برقرار نشد: ' . $err, 599);
    $data = json_decode((string) $res, true);
    if ($code < 200 || $code >= 300) {
        throw new RuntimeException('github ' . $code . ' ' . (is_array($data) ? ($data['message'] ?? '') : ''), $code);
    }
    return is_array($data) ? $data : [];
}

function readListings(): array {
    $branch = cfg('GITHUB_BRANCH', 'main');
    $f = gh('/contents/' . DATA . '?ref=' . rawurlencode($branch));
    $list = json_decode((string) base64_decode(str_replace("\n", '', (string) $f['content'])), true);
    if (!is_array($list)) throw new RuntimeException('فایل اطلاعات املاک خوانده نشد.', 500);
    return $list;
}

/** @param array<int,array{path:string,sha?:string,content?:string}> $files */
function commitFiles(array $files, string $message): void {
    $branch = cfg('GITHUB_BRANCH', 'main');
    $ref  = gh('/git/ref/heads/' . rawurlencode($branch));
    $head = gh('/git/commits/' . $ref['object']['sha']);
    $tree = [];
    foreach ($files as $f) {
        $entry = ['path' => ltrim($f['path'], '/'), 'mode' => '100644', 'type' => 'blob'];
        if (!empty($f['sha'])) $entry['sha'] = $f['sha']; else $entry['content'] = $f['content'];
        $tree[] = $entry;
    }
    $newTree = gh('/git/trees', 'POST', ['base_tree' => $head['tree']['sha'], 'tree' => $tree]);
    $commit  = gh('/git/commits', 'POST', [
        'message' => $message,
        'tree'    => $newTree['sha'],
        'parents' => [$head['sha']],
        'author'  => ['name' => 'پنل مدیریت آداک', 'email' => 'admin@amlakadak.ir'],
    ]);
    gh('/git/refs/heads/' . rawurlencode($branch), 'PATCH', ['sha' => $commit['sha']]);
}

// ---- validation (same rules as the Netlify version) ------------------------
function s(mixed $v, int $max): string {
    $t = preg_replace('/[\x00-\x1f<>]/u', ' ', (string) ($v ?? ''));
    return mb_substr(trim((string) $t), 0, $max, 'UTF-8');
}
function i(mixed $v, int $lo, int $hi): ?int {
    if (!is_numeric($v)) return null;
    $n = $v + 0;
    if (!is_int($n) && (float) $n !== floor((float) $n)) return null;
    $n = (int) $n;
    return ($n >= $lo && $n <= $hi) ? $n : null;
}
function cleanListing(array $x, array $prev = []): array {
    if (!preg_match(SLUG_RE, (string) ($x['slug'] ?? ''))) throw new RuntimeException('کد فایل معتبر نیست.', 400);
    $cand = array_merge([$x['cover'] ?? ''], is_array($x['gallery'] ?? null) ? $x['gallery'] : []);
    $imgs = [];
    foreach ($cand as $p) { if (preg_match(IMG_RE, (string) $p)) $imgs[] = (string) $p; }
    $imgs = array_slice($imgs, 0, 40);
    if (!$imgs) throw new RuntimeException('حداقل یک عکس لازم است.', 400);
    $tour = s($x['tour_url'] ?? '', 300);
    return array_merge($prev, [
        'slug'            => (string) $x['slug'],
        'title'           => s($x['title'] ?? '', 40) ?: 'فایل',
        'summary'         => s($x['summary'] ?? '', 1200),
        'category'        => in_array($x['category'] ?? '', CATS, true) ? (string) $x['category'] : 'apartment',
        'area_m2'         => i($x['area_m2'] ?? null, 1, 100000),
        'bedrooms'        => i($x['bedrooms'] ?? null, 0, 20),
        'city'            => s($x['city'] ?? '', 60) ?: 'کرج',
        'public_area'     => s($x['public_area'] ?? '', 80),
        'cover'           => $imgs[0],
        'gallery'         => array_values(array_slice($imgs, 1)),
        'is_published'    => ($x['is_published'] ?? null) === true,
        'seo_title'       => s($x['seo_title'] ?? '', 110),
        'seo_description' => s($x['seo_description'] ?? '', 220),
        'tour_url'        => preg_match('#^(/[a-z0-9/_.-]*|https://[^\s"\'<>]+)$#i', $tour) ? $tour : null,
    ]);
}

// ---- router ----------------------------------------------------------------
$route  = preg_replace('#^/api/admin/?#', '', parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (cfg('ADMIN_USER') === '' || cfg('ADMIN_PASSWORD') === '' || cfg('GITHUB_TOKEN') === '') {
    out(503, ['error' => 'پنل هنوز راه‌اندازی نشده (فایل config.php کامل نیست).']);
}

try {
    if ($route === 'login' && $method === 'POST') {
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'x');
        if (failCount($ip) >= LOCK_MAX) {
            out(429, ['error' => 'به‌خاطر چند تلاش ناموفق، ورود ۱۵ دقیقه قفل شده است.']);
        }
        $b = body();
        $bot = (isset($b['website']) && (string) $b['website'] !== '') || !((float) ($b['elapsed'] ?? 0) >= 1500);
        $ok = !$bot
            && sameSecret((string) ($b['username'] ?? ''), cfg('ADMIN_USER'))
            && sameSecret((string) ($b['password'] ?? ''), cfg('ADMIN_PASSWORD'));
        if (!$ok) {
            noteFail($ip);
            usleep(1200000);
            out(401, ['error' => 'نام کاربری یا رمز عبور درست نیست.']);
        }
        clearFails($ip);
        out(200, ['token' => makeToken()]);
    }

    if (!validToken()) out(401, ['error' => 'لطفاً دوباره وارد شوید.']);

    if ($route === 'listings' && $method === 'GET') {
        out(200, ['listings' => readListings()]);
    }

    if ($route === 'upload' && $method === 'POST') {
        $b = body();
        if (!preg_match(UPLOAD_RE, (string) ($b['path'] ?? ''))) out(400, ['error' => 'نام عکس معتبر نیست.']);
        $buf = base64_decode((string) ($b['data'] ?? ''), true);
        if ($buf === false || strlen($buf) < 100 || strlen($buf) > 4500000
            || ord($buf[0]) !== 0xff || ord($buf[1]) !== 0xd8) {
            out(400, ['error' => 'عکس معتبر نیست یا حجمش زیاد است.']);
        }
        $blob = gh('/git/blobs', 'POST', ['content' => base64_encode($buf), 'encoding' => 'base64']);
        out(200, ['path' => $b['path'], 'sha' => $blob['sha']]);
    }

    if ($route === 'save' && $method === 'POST') {
        $b    = body();
        $list = readListings();
        $in   = is_array($b['listing'] ?? null) ? $b['listing'] : [];
        $idx  = -1;
        foreach ($list as $k => $p) { if (($p['slug'] ?? null) === ($in['slug'] ?? null)) { $idx = $k; break; } }
        $rec  = cleanListing($in, $idx >= 0 ? $list[$idx] : []);
        $files = [];
        foreach ((is_array($b['uploads'] ?? null) ? $b['uploads'] : []) as $u) {
            if (preg_match(UPLOAD_RE, (string) ($u['path'] ?? '')) && preg_match('/^[0-9a-f]{40}$/', (string) ($u['sha'] ?? ''))) {
                $files[] = ['path' => (string) $u['path'], 'sha' => (string) $u['sha']];
            }
        }
        if ($idx >= 0) $list[$idx] = $rec; else $list[] = $rec;
        $files[] = ['path' => DATA, 'content' => json1(array_values($list)) . "\n"];
        commitFiles($files, 'پنل مدیریت: ' . ($idx >= 0 ? 'ویرایش' : 'افزودن') . ' ' . $rec['title'] . ' (' . $rec['slug'] . ')');
        out(200, ['listings' => array_values($list)]);
    }

    if ($route === 'delete' && $method === 'POST') {
        $b    = body();
        $list = readListings();
        $next = array_values(array_filter($list, static fn($p) => ($p['slug'] ?? null) !== ($b['slug'] ?? null)));
        if (count($next) === count($list)) out(404, ['error' => 'فایل پیدا نشد.']);
        commitFiles([['path' => DATA, 'content' => json1($next) . "\n"]], 'پنل مدیریت: حذف ' . (string) ($b['slug'] ?? ''));
        out(200, ['listings' => $next]);
    }

    out(404, ['error' => 'مسیر نامعتبر']);
} catch (Throwable $e) {
    error_log('[adak-admin] ' . $e->getMessage());
    $code = (int) $e->getCode();
    if ($code === 401 || $code === 403) out(502, ['error' => 'دسترسی به گیت‌هاب رد شد؛ کلید GITHUB_TOKEN را بررسی کنید.']);
    if ($code === 409 || $code === 422) out(409, ['error' => 'هم‌زمان تغییر دیگری ثبت شد؛ صفحه را تازه کنید و دوباره ذخیره کنید.']);
    $msg = $e->getMessage();
    out(500, ['error' => preg_match('/[\x{0600}-\x{06FF}]/u', $msg) ? $msg : 'خطای سرور؛ چند لحظه بعد دوباره امتحان کنید.']);
}
