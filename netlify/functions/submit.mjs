// Public form intake for amlakadak.ir — receives «ثبت فایل» and «درخواست ملک» submissions
// and forwards them to the office Telegram. No secrets in this file.
//
// Required environment variables (Netlify → Site configuration → Environment variables):
//   TELEGRAM_BOT_TOKEN   bot token from @BotFather
//   TELEGRAM_CHAT_ID     numeric chat id of the recipient
// Optional (email, added later):
//   RESEND_API_KEY, NOTIFY_EMAIL
//
// Security posture (see security-discipline):
//   - token only from env, never in client/code
//   - field allowlist + length caps; unknown fields dropped
//   - all values HTML-escaped before going into the Telegram message
//   - honeypot + min-elapsed time + per-instance rate limit
//   - outbound call has a timeout; failure never leaks internals to the client

export const config = { path: '/api/submit' };

const env = (k, d = '') => (globalThis.Netlify?.env?.get(k) ?? process.env[k] ?? d);

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

// ---- field allowlist (everything else is ignored) ----
const FIELDS = {
  // meta
  kind: 60,            // 'sabt' | 'darkhast'
  code: 40,            // tracking code shown to the user
  // identity / contact
  family: 80, name: 80, phone: 20, phone2: 20, gender: 20, besttime: 20,
  // deal / property
  deal: 30, category: 30, city: 40, area: 80, areaM2: 10, areas: 160, facing: 120,
  street: 120, alley: 120, no: 20, floor: 10, floors: 10, perfloor: 10,
  year: 10, beds: 6, deed: 30, amenities: 240,
  // price
  price: 40, permeter: 40, deposit: 40, rent: 40, nego: 6, convert: 6,
  // request-side budget / ranges
  amin: 10, amax: 10, bmin: 40, bmax: 40, dmax: 40, rmax: 40, flex: 6,
  // free text
  desc: 1200, matches: 400,
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\r?\n/g, ' ').trim();

// Persian/Arabic digits → ASCII (form input arrives in Persian numerals)
const toAscii = (s) => String(s)
  .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

// per-warm-instance throttle (best-effort; real limit is Netlify's)
const hits = [];
const WINDOW_MS = 60 * 1000, MAX_PER_WINDOW = 20;

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false });

  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'bad request' }); }
  if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'bad request' });

  // bot traps: honeypot filled, or submitted implausibly fast
  if (body.company) return json(400, { ok: false, delivered: false });
  const elapsed = Number(toAscii(body.elapsed)) || 0;
  if (elapsed > 0 && elapsed < 2000) return json(400, { ok: false, delivered: false });

  // rate limit (per warm instance)
  const now = Date.now();
  while (hits.length && now - hits[0] > WINDOW_MS) hits.shift();
  if (hits.length >= MAX_PER_WINDOW) return json(429, { ok: false, error: 'too many requests' });
  hits.push(now);

  // phone is required and must look like an Iranian mobile
  const phone = toAscii(body.phone || '').replace(/[^\d]/g, '');
  if (!/^09\d{9}$/.test(phone)) return json(400, { ok: false, error: 'invalid phone' });

  if (!['sabt','darkhast'].includes(body.kind) || body.consent !== 'yes' || !String(body.kind==='sabt'?body.name:body.family).trim() || !body.deal || !body.category) return json(400,{ok:false,delivered:false});
  // collect allowlisted fields, capped
  const data = {};
  for (const [k, max] of Object.entries(FIELDS)) {
    if (body[k] == null || body[k] === '') continue;
    let v = Array.isArray(body[k]) ? body[k].join('، ') : String(body[k]);
    if (v.length > max) v = v.slice(0, max);
    data[k] = v;
  }

  const token = env('TELEGRAM_BOT_TOKEN');
  const chat = env('TELEGRAM_CHAT_ID');
  if (!token || !chat) {
    // not configured yet — accept so the UX works, but report not-delivered server-side only
    console.warn('submit: telegram env missing');
    return json(503, { ok: false, delivered: false });
  }

  const text = buildMessage(data);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const out = await r.json().catch(() => ({}));
    if (!out.ok) { console.warn('telegram api not ok'); return json(503, { ok: false, delivered: false }); }
  } catch (e) {
    console.warn('telegram send failed'); // never leak details to client
    return json(503, { ok: false, delivered: false });
  }

  return json(200, { ok: true, delivered: true });
};

function buildMessage(d) {
  const isReq = d.kind === 'darkhast';
  const title = isReq ? '🔎 درخواست ملک جدید' : '🏷 فایل جدید برای ثبت';
  const L = [];
  L.push(`<b>${title}</b>`);
  if (d.code) L.push(`کد پیگیری: <code>${esc(d.code)}</code>`);
  L.push('—'.repeat(12));

  // contact block
  const who = [d.family, d.name].filter(Boolean).map(esc).join(' ');
  if (who) L.push(`👤 <b>${who}</b>${d.gender ? ' · ' + esc(d.gender) : ''}`);
  if (d.phone) L.push(`📞 <a href="tel:${esc(d.phone)}">${esc(d.phone)}</a>${d.phone2 ? ' / ' + esc(d.phone2) : ''}`);
  if (d.besttime) L.push(`⏰ بهترین زمان تماس: ${esc(d.besttime)}`);

  const line = (label, v) => { if (v) L.push(`${label}: ${esc(v)}`); };

  if (isReq) {
    L.push('');
    line('نوع درخواست', d.deal);
    line('نوع ملک', d.category);
    line('شهر', d.city);
    line('محله‌های موردنظر', d.areas);
    line('متراژ از', d.amin); line('متراژ تا', d.amax);
    line('حداقل خواب', d.beds);
    line('جهت موردنظر', d.facing);
    line('امکانات مهم', d.amenities);
    if (d.bmin || d.bmax) L.push(`بودجه: ${esc(d.bmin || '۰')} تا ${esc(d.bmax || '—')} تومان`);
    if (d.dmax || d.rmax) L.push(`ودیعه تا ${esc(d.dmax || '—')} / اجاره تا ${esc(d.rmax || '—')} تومان`);
    if (d.flex) L.push('بودجه انعطاف دارد');
    line('فایل‌های منطبق نمایش‌داده‌شده', d.matches);
  } else {
    L.push('');
    line('نوع معامله', d.deal);
    line('نوع ملک', d.category);
    line('شهر', d.city);
    line('محله و محدوده', d.area);
    const addr = [d.street, d.alley, d.no && 'پلاک ' + d.no].filter(Boolean).map(esc).join('، ');
    if (addr) L.push(`نشانی: ${addr}`);
    line('متراژ بنا', d.areaM2);
    line('تعداد خواب', d.beds);
    line('طبقه', d.floor); line('تعداد طبقات', d.floors); line('واحد در طبقه', d.perfloor);
    line('سال ساخت', d.year);
    line('جهت', d.facing);
    line('نوع سند', d.deed);
    line('امکانات', d.amenities);
    if (d.deal === 'رهن و اجاره') {
      if (d.deposit || d.rent) L.push(`رهن: ${esc(d.deposit || '۰')} / اجاره: ${esc(d.rent || '۰')} تومان${d.convert ? ' (قابل تبدیل)' : ''}`);
    } else if (d.nego) {
      L.push('قیمت: توافقی / استعلامی');
    } else if (d.price) {
      L.push(`قیمت: ${esc(d.price)} تومان${d.permeter ? ' (هر متر ' + esc(d.permeter) + ')' : ''}`);
    }
  }

  if (d.desc) { L.push(''); L.push(`📝 ${esc(d.desc)}`); }
  return L.join('\n').slice(0, 3900); // Telegram hard limit 4096
}
