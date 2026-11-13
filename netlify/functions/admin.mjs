// Admin API for amlakadak.ir — login + listing edits committed to GitHub (Netlify rebuilds the site).
// Required environment variables (set in Netlify → Site configuration → Environment variables):
//   ADMIN_USER       admin username
//   ADMIN_PASSWORD   admin password
//   GITHUB_TOKEN     fine-grained token, "Contents: Read and write" on this repository only
// Optional: GITHUB_REPO (default nikkhahnik/AMLAK-ADAK), GITHUB_BRANCH (default main)
import crypto from 'node:crypto';

export const config = { path: '/api/admin/*' };

const env = (k, d = '') => (globalThis.Netlify?.env?.get(k) ?? process.env[k] ?? d);
const REPO = () => env('GITHUB_REPO', 'nikkhahnik/AMLAK-ADAK');
const BRANCH = () => env('GITHUB_BRANCH', 'main');
const DATA = 'properties.json';
const SESSION_H = 8;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const UPLOAD_RE = /^\/assets\/uploads\/[a-z0-9-]{3,64}-[a-z0-9]{4,16}-\d{1,3}\.jpg$/;
const CATS = new Set(['apartment', 'villa', 'commercial', 'land']);

// brute-force brake (per warm instance) — plus a fixed delay on every failed login
const fails = new Map();
const LOCK_MAX = 5, LOCK_MS = 15 * 60 * 1000;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const secret = () => sha('adak-admin|' + env('ADMIN_PASSWORD') + '|' + env('GITHUB_TOKEN') + '|' + env('ADMIN_USER'));

function sign(exp) { return crypto.createHmac('sha256', secret()).update(String(exp)).digest('base64url'); }
function makeToken() { const exp = Date.now() + SESSION_H * 3600e3; return exp + '.' + sign(exp); }
function validToken(req) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(exp))); } catch { return false; }
}

async function gh(path, opts = {}) {
  const res = await fetch('https://api.github.com/repos/' + REPO() + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + env('GITHUB_TOKEN'), Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'adak-admin', ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(Error('github ' + res.status + ' ' + (data?.message || '')), { status: res.status });
  return data;
}
async function readListings() {
  const f = await gh(`/contents/${DATA}?ref=${BRANCH()}`);
  return JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
}
async function commit(files, message) { // files: [{path, sha}] or [{path, content}]
  const ref = await gh(`/git/ref/heads/${BRANCH()}`);
  const head = await gh(`/git/commits/${ref.object.sha}`);
  const tree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({
    base_tree: head.tree.sha,
    tree: files.map((f) => ({ path: f.path.replace(/^\//, ''), mode: '100644', type: 'blob', ...(f.sha ? { sha: f.sha } : { content: f.content }) })),
  }) });
  const c = await gh('/git/commits', { method: 'POST', body: JSON.stringify({
    message, tree: tree.sha, parents: [head.sha], author: { name: 'پنل مدیریت آداک', email: 'admin@amlakadak.ir' },
  }) });
  await gh(`/git/refs/heads/${BRANCH()}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
}

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
const int = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
function cleanListing(x, prev = {}) {
  if (!x || !SLUG_RE.test(String(x.slug))) throw Error('کد فایل معتبر نیست.');
  const imgs = [x.cover, ...(Array.isArray(x.gallery) ? x.gallery : [])].map(String)
    .filter((p) => /^\/assets\/[a-z0-9/_.-]+\.(jpe?g|png|webp)$/i.test(p)).slice(0, 40);
  if (!imgs.length) throw Error('حداقل یک عکس لازم است.');
  const tour = str(x.tour_url, 300);
  return {
    ...prev,
    slug: x.slug, title: str(x.title, 40) || 'فایل', summary: str(x.summary, 1200),
    category: CATS.has(x.category) ? x.category : 'apartment',
    area_m2: int(x.area_m2, 1, 100000), bedrooms: int(x.bedrooms, 0, 20),
    city: str(x.city, 60) || 'کرج', public_area: str(x.public_area, 80),
    cover: imgs[0], gallery: imgs.slice(1), is_published: x.is_published === true,
    seo_title: str(x.seo_title, 110), seo_description: str(x.seo_description, 220),
    tour_url: /^(\/[a-z0-9/_.-]*|https:\/\/[^\s"'<>]+)$/i.test(tour) ? tour : null,
  };
}

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, '');
  if (!env('ADMIN_USER') || !env('ADMIN_PASSWORD') || !env('GITHUB_TOKEN')) {
    return json(503, { error: 'پنل هنوز راه‌اندازی نشده (تنظیمات Netlify کامل نیست).' });
  }
  try {
    if (route === 'login' && req.method === 'POST') {
      const ip = req.headers.get('x-nf-client-connection-ip') || 'x';
      const rec = fails.get(ip);
      if (rec && rec.n >= LOCK_MAX && Date.now() - rec.t < LOCK_MS) {
        return json(429, { error: 'به‌خاطر چند تلاش ناموفق، ورود ۱۵ دقیقه قفل شده است.' });
      }
      const b = await req.json().catch(() => ({}));
      const bot = (b.website && String(b.website).length) || !(Number(b.elapsed) >= 1500);
      const ok = !bot && same(String(b.username || ''), env('ADMIN_USER')) & same(String(b.password || ''), env('ADMIN_PASSWORD'));
      if (!ok) {
        fails.set(ip, { n: (rec && Date.now() - rec.t < LOCK_MS ? rec.n : 0) + 1, t: Date.now() });
        await sleep(1200);
        return json(401, { error: 'نام کاربری یا رمز عبور درست نیست.' });
      }
      fails.delete(ip);
      return json(200, { token: makeToken() });
    }
    if (!validToken(req)) return json(401, { error: 'لطفاً دوباره وارد شوید.' });

    if (route === 'listings' && req.method === 'GET') return json(200, { listings: await readListings() });

    if (route === 'upload' && req.method === 'POST') { // one photo per request → git blob (committed later by /save)
      const b = await req.json();
      if (!UPLOAD_RE.test(String(b.path))) return json(400, { error: 'نام عکس معتبر نیست.' });
      const buf = Buffer.from(String(b.data || ''), 'base64');
      if (buf.length < 100 || buf.length > 4.5e6 || buf[0] !== 0xff || buf[1] !== 0xd8) return json(400, { error: 'عکس معتبر نیست یا حجمش زیاد است.' });
      const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }) });
      return json(200, { path: b.path, sha: blob.sha });
    }

    if (route === 'save' && req.method === 'POST') {
      const b = await req.json();
      const list = await readListings();
      const i = list.findIndex((p) => p.slug === b.listing?.slug);
      const rec = cleanListing(b.listing, i >= 0 ? list[i] : {});
      const ups = (Array.isArray(b.uploads) ? b.uploads : []).filter((u) => UPLOAD_RE.test(String(u.path)) && /^[0-9a-f]{40}$/.test(String(u.sha)));
      if (i >= 0) list[i] = rec; else list.push(rec);
      await commit([...ups.map((u) => ({ path: u.path, sha: u.sha })), { path: DATA, content: JSON.stringify(list, null, 1) + '\n' }],
        `پنل مدیریت: ${i >= 0 ? 'ویرایش' : 'افزودن'} ${rec.title} (${rec.slug})`);
      return json(200, { listings: list });
    }

    if (route === 'delete' && req.method === 'POST') {
      const b = await req.json();
      const list = await readListings();
      const next = list.filter((p) => p.slug !== b.slug);
      if (next.length === list.length) return json(404, { error: 'فایل پیدا نشد.' });
      await commit([{ path: DATA, content: JSON.stringify(next, null, 1) + '\n' }], `پنل مدیریت: حذف ${b.slug}`);
      return json(200, { listings: next });
    }
    return json(404, { error: 'مسیر نامعتبر' });
  } catch (e) {
    console.error(e);
    if (e.status === 401 || e.status === 403) return json(502, { error: 'دسترسی به گیت‌هاب رد شد؛ کلید GITHUB_TOKEN را بررسی کنید.' });
    if (e.status === 409 || e.status === 422) return json(409, { error: 'هم‌زمان تغییر دیگری ثبت شد؛ صفحه را تازه کنید و دوباره ذخیره کنید.' });
    return json(500, { error: e.message && /[؀-ۿ]/.test(e.message) ? e.message : 'خطای سرور؛ چند لحظه بعد دوباره امتحان کنید.' });
  }
};
