#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inline each form into its page index.html WITHOUT an <iframe>.

Why: some ad/privacy blockers block the framed form.html element, so the
visitor sees "This content is blocked". The iframe originally existed to
ISOLATE the form's generic class names (.hero .card .step .wrap .btn ...)
from the site's styles.css, which defines those same classes for its own
components. Loading styles.css onto the form would clobber it (blank page).

Fix: serve the form as first-party inline markup, do NOT load styles.css
on these pages (the form is fully self-contained with its own CSS/fonts),
and add a dedicated, self-styled site header/footer whose classes are
namespaced (sh-/sf-) so they never collide with the form's .wrap/.brand.
Theme stays consistent with the rest of the site via theme.js (data-theme
+ localStorage 'adak-theme'); a tiny bridge mirrors data-theme -> the
form's own .theme-dark hook.
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- Self-styled site header/footer (namespaced classes: no collision with form) ---
CHROME_CSS = '''<style id="site-chrome">
/* site header/footer — namespaced, independent of /styles.css */
.site-header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:saturate(1.4) blur(8px)}
.sh-wrap{width:min(1180px,100% - 40px);margin-inline:auto;display:flex;align-items:center;justify-content:space-between;gap:20px;height:72px}
.sh-brand{display:flex;align-items:center;gap:11px;text-decoration:none}
.sh-brand img{width:44px;height:36px;object-fit:contain}
.sh-brand .fa{display:block;font-family:var(--display);font-weight:800;font-size:20px;color:var(--ink);line-height:1.25}
.sh-brand .en{display:block;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--soft);line-height:1.4;direction:ltr}
.main-nav{display:flex;gap:28px;font-size:15px;font-weight:600;color:#3E4D5A}
.main-nav a{color:inherit;text-decoration:none;padding:6px 0;border-bottom:2px solid transparent;transition:.18s}
.main-nav a:hover,.main-nav a.active{color:var(--ink);border-bottom-color:var(--ember)}
.header-actions{display:flex;align-items:center;gap:10px}
.theme-toggle{width:40px;height:40px;border:1.5px solid var(--line);background:transparent;border-radius:999px;display:grid;place-items:center;color:var(--ink);cursor:pointer;padding:0}
.theme-toggle svg{width:19px;height:19px}
.theme-toggle .i-sun{display:none}
.head-call{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:14px;color:var(--ink);text-decoration:none;border:1.5px solid var(--line);padding:9px 16px;border-radius:999px;transition:.18s}
.head-call:hover{border-color:var(--ink)}
.head-call .icon{width:17px;height:17px;color:var(--ember)}
.menu-toggle{display:none;border:0;background:transparent;color:var(--ink);padding:8px;cursor:pointer}
.menu-toggle .icon{width:26px;height:26px}
.skip{position:absolute;right:16px;top:-60px;z-index:100;background:var(--ink);color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none}
.skip:focus{top:12px}
/* footer */
.site-footer{background:#0A1C2E;color:#B9C6D1;font-size:15px;position:relative;margin-top:40px}
.site-footer:before{content:'';position:absolute;top:0;inset-inline:0;height:6px;background:linear-gradient(to bottom,var(--sky) 0 2px,var(--leaf) 2px 4px,var(--ember) 4px 6px)}
.sf-wrap{width:min(1180px,100% - 40px);margin-inline:auto}
.sf-main{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:44px;padding:56px 0 40px}
.sf-brand{display:flex;align-items:center;gap:11px;text-decoration:none}
.sf-brand img{width:44px;height:36px;object-fit:contain}
.sf-brand .fa{display:block;font-family:var(--display);font-weight:800;font-size:20px;color:#fff;line-height:1.25}
.sf-brand .en{display:block;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#8597A6;direction:ltr}
.sf-about{margin:16px 0 0;line-height:2;color:#B9C6D1}
.sf-col h2{color:#fff;font-size:16px;margin:0 0 10px;font-weight:700}
.sf-col a{display:block;color:#B9C6D1;text-decoration:none;line-height:2;font-size:14px}
.sf-col a:hover{color:#fff}
.sf-col .manager-line{display:flex;justify-content:space-between;gap:16px;max-width:240px}
.sf-col .manager-line span:first-child{color:#fff;font-weight:500}
.sf-col .manager-line span:last-child{direction:ltr}
.sf-bottom{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-top:1px solid #1F354B;padding:20px 0;font-size:13px;color:#8597A6}
@media(max-width:860px){
  .sf-main{grid-template-columns:1fr 1fr;gap:28px}
  .sf-main>div:first-child{grid-column:span 2}
}
@media(max-width:720px){
  .main-nav{display:none;position:absolute;top:72px;inset-inline:0;flex-direction:column;gap:0;background:#fff;border-bottom:1px solid var(--line);padding:6px 16px 14px;box-shadow:0 12px 24px rgba(13,35,58,.1)}
  .main-nav.open{display:flex}
  .main-nav a{padding:12px 4px;border-bottom:1px solid var(--line)}
  .menu-toggle{display:inline-flex}
  .head-call span{display:none}
  .head-call{padding:10px}
  .sf-main{grid-template-columns:1fr}
  .sf-main>div:first-child{grid-column:auto}
}
/* dark (mirrors the form's .theme-dark hook) */
html.theme-dark .site-header{background:rgba(10,24,38,.96);border-bottom-color:rgba(255,255,255,.1)}
html.theme-dark .sh-brand .fa{color:#EEF3F8}
html.theme-dark .main-nav{color:#C3D0DB}
html.theme-dark .main-nav a:hover{color:#fff}
html.theme-dark .theme-toggle{border-color:rgba(255,255,255,.18);color:#EEF3F8}
html.theme-dark .theme-toggle .i-moon{display:none}
html.theme-dark .theme-toggle .i-sun{display:block}
html.theme-dark .head-call{color:#EEF3F8;border-color:rgba(255,255,255,.18)}
html.theme-dark .menu-toggle{color:#EEF3F8}
html.theme-dark .main-nav{background:#0B1B2A}
</style>'''

HEADER = '''<header class="site-header"><div class="sh-wrap">
<a class="sh-brand" href="/" aria-label="املاک آداک، صفحه اصلی"><img src="/assets/adaak-symbol-96.png" alt="" width="44" height="36"><span><span class="fa">املاک آداک</span><span class="en" lang="en">ADAAK Real Estate</span></span></a>
<nav class="main-nav" id="main-nav" aria-label="منوی اصلی"><a href="/files/">فایل املاک</a><a href="/darkhast-melk/">درخواست ملک</a><a href="/sabt-file/">ثبت فایل</a><a href="/bazdid-360/">بازدید آنلاین</a><a href="/daftar-amlak-karaj/">دفتر املاک</a></nav>
<div class="header-actions"><button class="theme-toggle" type="button" aria-label="تغییر حالت روز و شب" title="روز / شب"><svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg></button><a class="head-call" href="tel:09126895443" aria-label="تماس با دفتر املاک آداک"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg><span>تماس با ما</span></a><button class="menu-toggle" id="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="باز کردن منو"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button></div>
</div></header>'''

FOOTER = '''<footer class="site-footer"><div class="sf-wrap sf-main">
<div><a class="sf-brand" href="/"><img src="/assets/adaak-symbol-96.png" alt="" width="44" height="36"><span><span class="fa">املاک آداک</span><span class="en" lang="en">ADAAK Real Estate</span></span></a><p class="sf-about">دفتر املاک آداک؛ مشاور خرید و فروش ملک در رجایی‌شهر کرج، با بازدید آنلاین و ۳۶۰ درجه.<br>اطلاعات تکمیلی هر فایل فقط از طریق مشاوران آداک ارائه می‌شود.</p></div>
<nav class="sf-col" aria-label="دسترسی سریع"><h2>دسترسی سریع</h2><a href="/">خانه</a><a href="/files/">فایل املاک</a><a href="/bazdid-360/">بازدید ۳۶۰ درجه</a><a href="/tour/">تور مجازی</a><a href="/daftar-amlak-karaj/">دفتر املاک کرج</a><a href="/kharid-apartman-rajaei-shahr/">خرید آپارتمان رجایی‌شهر</a><a href="/forosh-melk-karaj/">فروش ملک در کرج</a><a href="/rahnama-bazdid-apartman/">چک‌لیست بازدید آپارتمان</a><a href="/privacy.html">حریم خصوصی</a></nav>
<div class="sf-col"><h2>ارتباط با ما</h2><a class="manager-line" href="tel:09126895443"><span>انامی</span><span>0912 689 5443</span></a><a class="manager-line" href="tel:09123619831"><span>فلاحت‌پور</span><span>0912 361 9831</span></a><a href="https://wa.me/989196589769" target="_blank" rel="noopener noreferrer">واتساپ</a><a href="https://www.instagram.com/Adaak.realestate/" target="_blank" rel="noopener noreferrer">اینستاگرام</a></div>
</div><div class="sf-wrap sf-bottom"><span>© <span id="year"></span> املاک آداک. تمامی حقوق محفوظ است.</span><span>کرج، رجایی‌شهر، بلوار اشتراکی جنوبی، بین گلستان ۱۳ و ۱۴ · ساعت کاری ۹ تا ۲۰</span></div></footer>'''

# theme bridge + mobile menu + year (no dependency on /styles.css or /app.js)
TAIL_SCRIPT = '''<script>
(function(){var r=document.documentElement;
function sync(){r.classList.toggle('theme-dark',r.getAttribute('data-theme')==='dark');}
sync();new MutationObserver(sync).observe(r,{attributes:true,attributeFilter:['data-theme']});
var mt=document.getElementById('menu-toggle'),nv=document.getElementById('main-nav');
if(mt&&nv)mt.addEventListener('click',function(){var o=nv.classList.toggle('open');mt.setAttribute('aria-expanded',String(o));});
var y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();
})();
</script>'''


def extract(txt, start, end):
    i = txt.index(start); j = txt.index(end, i)
    return txt[i:j+len(end)]


def build(page):
    pdir = ROOT / page
    form = (pdir / 'form.html').read_text(encoding='utf-8')
    idx = (pdir / 'index.html').read_text(encoding='utf-8')
    seo = extract(idx, '<!--seo:start-->', '<!--seo:end-->')

    # form <head> inner: keep fonts + the two <style> blocks; drop <title> and the iframe theme <script>
    head_inner = form[form.index('<head>')+6:form.index('</head>')]
    head_inner = re.sub(r'<title>.*?</title>', '', head_inner, flags=re.S)
    head_inner = re.sub(r'<script>.*?</script>', '', head_inner, flags=re.S).strip()

    # form <body> inner -> markup + the single trailing form <script>
    body_inner = form[form.index('<body>')+6:form.rindex('</body>')]
    si = body_inner.index('<script')
    markup = body_inner[:si].strip()
    form_script = body_inner[si:].strip()

    out = f'''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><script src="/theme.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{seo}
<meta name="theme-color" content="#07131F">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
{head_inner}
{CHROME_CSS}
</head>
<body><a class="skip" href="#main">رفتن به محتوای اصلی</a>
{HEADER}
<main id="main">
{markup}
</main>
{FOOTER}
{form_script}
{TAIL_SCRIPT}
</body></html>'''

    (pdir / 'index.html').write_text(out, encoding='utf-8')
    print(f'[ok] {page}/index.html  ({len(out):,} bytes, no iframe, no styles.css)')


if __name__ == '__main__':
    build('darkhast-melk')
    build('sabt-file')
    print('done')
