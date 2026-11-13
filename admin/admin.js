(function () {
  'use strict';
  const API = '/api/admin';
  const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('demo');
  const $ = (s) => document.querySelector(s);
  const FA = (v) => String(v ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const EN = (v) => String(v ?? '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
  const CAT = { apartment: 'آپارتمان', villa: 'ویلایی', commercial: 'تجاری', land: 'زمین' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let token = sessionStorage.getItem('adak_admin') || '';
  let listings = [];
  let editing = null; // index or -1 for new
  let photos = [];    // [{src, file?(dataURL to upload), name}]

  /* ---------- views ---------- */
  let shownAt = Date.now();
  function show(id) {
    if (id === 'view-login') shownAt = Date.now();
    ['view-login', 'view-dash', 'view-edit'].forEach((v) => { $('#' + v).hidden = v !== id; });
    window.scrollTo(0, 0);
  }
  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, err ? 6000 : 4500);
  }

  /* ---------- api ---------- */
  async function api(path, body) {
    const res = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null; try { data = await res.json(); } catch (e) { /* empty */ }
    if (res.status === 401) { logout(true); throw Error('نشست شما تمام شده؛ دوباره وارد شوید.'); }
    if (!res.ok) throw Error((data && data.error) || 'ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید و دوباره امتحان کنید.');
    return data;
  }

  /* ---------- login ---------- */
  $('#pw-toggle').addEventListener('click', () => {
    const i = $('#pw'); const on = i.type === 'password'; i.type = on ? 'text' : 'password';
    $('#pw-toggle').textContent = on ? 'پنهان' : 'نمایش';
  });
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn'); const errEl = $('#login-error'); errEl.hidden = true;
    btn.disabled = true; btn.textContent = 'در حال ورود…';
    try {
      const cred = { username: $('#user').value.trim(), password: $('#pw').value, website: $('#website').value, elapsed: Date.now() - shownAt };
      if (DEMO) {
        if (cred.username !== 'admin' || cred.password !== 'password') throw Error('نام کاربری یا رمز عبور درست نیست.');
        token = 'demo'; await loadList(); return;
      }
      const r = await api('/login', cred);
      token = r.token; sessionStorage.setItem('adak_admin', token); $('#pw').value = '';
      await loadList();
    } catch (err) { errEl.textContent = err.message; errEl.hidden = false; }
    finally { btn.disabled = false; btn.textContent = 'ورود'; }
  });
  function logout(silent) {
    token = ''; sessionStorage.removeItem('adak_admin'); show('view-login');
    if (!silent) toast('از پنل خارج شدید.');
  }
  $('#logout').addEventListener('click', () => logout(false));

  /* ---------- list ---------- */
  async function loadList() {
    if (DEMO) { listings = await (await fetch('/properties.json', { cache: 'no-store' })).json(); }
    else { listings = (await api('/listings')).listings; }
    renderList(); show('view-dash');
  }
  function sub(p) {
    return [p.area_m2 && FA(p.area_m2) + ' متر', p.bedrooms != null && p.bedrooms !== '' && FA(p.bedrooms) + ' خواب', p.public_area || p.city].filter(Boolean).join(' · ');
  }
  function renderList() {
    const q = EN($('#q').value).toLowerCase();
    const on = listings.filter((p) => p.is_published).length;
    $('#stats').textContent = `${FA(listings.length)} فایل · ${FA(on)} در سایت · ${FA(listings.length - on)} مخفی`;
    const rows = listings.map((p, i) => ({ p, i })).filter(({ p }) => !q || EN([p.title, p.area_m2, p.public_area, p.city, p.summary].join(' ')).toLowerCase().includes(q));
    if (!rows.length) { $('#list').innerHTML = `<div class="empty">${listings.length ? 'فایلی با این جستجو پیدا نشد.' : 'هنوز فایلی ثبت نشده. روی «افزودن فایل جدید» بزنید.'}</div>`; return; }
    $('#list').innerHTML = rows.map(({ p, i }) => `
      <article class="item">
        <img src="${esc(p.cover || (p.gallery || [])[0] || '')}" alt="" loading="lazy">
        <div><h2>${esc(p.title)}<span class="pill ${p.is_published ? 'on' : 'off'}">${p.is_published ? 'در سایت' : 'مخفی'}</span></h2>
        <div class="meta">${esc(CAT[p.category] || 'ملک')} · ${esc(sub(p))}</div></div>
        <div class="item-actions">
          <button class="btn ghost" type="button" data-edit="${i}">ویرایش</button>
          <button class="btn ghost" type="button" data-toggle="${i}">${p.is_published ? 'مخفی کن' : 'نمایش در سایت'}</button>
          <a class="btn ghost" href="/p/${esc(p.slug)}" target="_blank" rel="noopener">دیدن</a>
        </div>
      </article>`).join('');
  }
  $('#q').addEventListener('input', renderList);
  $('#list').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.edit) openEditor(+b.dataset.edit);
    if (b.dataset.toggle) {
      const p = listings[+b.dataset.toggle]; const next = !p.is_published;
      b.disabled = true;
      try { await save(Object.assign({}, p, { is_published: next }), +b.dataset.toggle, []); toast(next ? 'فایل در سایت نمایش داده می‌شود (تا حدود یک دقیقه).' : 'فایل از سایت پنهان شد (تا حدود یک دقیقه).'); }
      catch (err) { toast(err.message, true); } finally { b.disabled = false; }
    }
  });
  $('#add-btn').addEventListener('click', () => openEditor(-1));

  /* ---------- editor ---------- */
  const F = { code: '#f-code', cat: '#f-cat', area: '#f-area', bed: '#f-bed', city: '#f-city', hood: '#f-area-name', sum: '#f-sum', tour: '#f-tour', pub: '#f-pub' };
  function nextCode() {
    const n = listings.map((p) => parseInt(EN((p.title || '').replace(/\D/g, '')) || EN(p.slug).replace(/\D/g, ''), 10)).filter((x) => x > 0 && x < 1000);
    return (n.length ? Math.max(...n) : 0) + 1;
  }
  function openEditor(i) {
    editing = i; const p = i >= 0 ? listings[i] : null;
    $('#edit-title').textContent = p ? 'ویرایش ' + p.title : 'افزودن فایل جدید';
    $('#del-btn').hidden = !p;
    $(F.code).value = p ? FA(EN(p.title).replace(/\D/g, '').replace(/^0+/, '')) : FA(nextCode());
    $(F.cat).value = (p && p.category) || 'apartment';
    $(F.area).value = p && p.area_m2 ? FA(p.area_m2) : '';
    $(F.bed).value = p && p.bedrooms != null ? FA(p.bedrooms) : '';
    $(F.city).value = (p && p.city) || 'کرج';
    $(F.hood).value = (p && p.public_area) || '';
    $(F.sum).value = (p && p.summary) || '';
    $(F.tour).value = (p && p.tour_url) || '';
    $(F.pub).checked = p ? !!p.is_published : true;
    photos = p ? [p.cover, ...(p.gallery || [])].filter(Boolean).map((src) => ({ src })) : [];
    renderThumbs(); updatePreview(); show('view-edit');
  }
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { renderList(); show('view-dash'); }));

  function renderThumbs() {
    $('#thumbs').innerHTML = photos.map((ph, i) => `
      <div class="th ${i === 0 ? 'cover' : ''}">
        ${i === 0 ? '<span class="tag">عکس اصلی</span>' : ''}
        <img src="${esc(ph.src)}" alt="عکس ${FA(i + 1)}">
        <div class="bar">
          <button type="button" data-cover="${i}" title="عکس اصلی شود" aria-label="عکس اصلی شود">★</button>
          <button type="button" data-left="${i}" title="جلوتر" aria-label="جلوتر">→</button>
          <button type="button" data-right="${i}" title="عقب‌تر" aria-label="عقب‌تر">←</button>
          <button type="button" data-rm="${i}" title="حذف" aria-label="حذف عکس">✕</button>
        </div>
      </div>`).join('');
  }
  $('#thumbs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    const mv = (a, c) => { if (c < 0 || c >= photos.length) return; [photos[a], photos[c]] = [photos[c], photos[a]]; };
    if (d.cover) photos.unshift(photos.splice(+d.cover, 1)[0]);
    if (d.left) mv(+d.left, +d.left - 1);
    if (d.right) mv(+d.right, +d.right + 1);
    if (d.rm) photos.splice(+d.rm, 1);
    renderThumbs();
  });
  function shrink(file) {
    return new Promise((ok, bad) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600; const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => bad(Error('این فایل عکس قابل خواندن نیست: ' + file.name));
      img.src = url;
    });
  }
  async function addFiles(list) {
    const files = [...list].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    toast('در حال آماده‌سازی عکس‌ها…');
    for (const f of files) {
      try { const data = await shrink(f); photos.push({ src: data, data }); } catch (err) { toast(err.message, true); }
    }
    renderThumbs(); toast(`${FA(files.length)} عکس اضافه شد.`);
  }
  $('#files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  function collect() {
    const code = parseInt(EN($(F.code).value), 10);
    const area = parseInt(EN($(F.area).value), 10); const bed = parseInt(EN($(F.bed).value), 10);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      code, slug: editing >= 0 ? listings[editing].slug : 'adk-' + pad(code),
      title: 'کد ' + FA(pad(code)), category: $(F.cat).value,
      area_m2: area > 0 ? area : null, bedrooms: bed >= 0 ? bed : null,
      city: $(F.city).value.trim() || 'کرج', public_area: $(F.hood).value.trim(),
      summary: $(F.sum).value.trim(), tour_url: $(F.tour).value.trim() || null, is_published: $(F.pub).checked,
    };
  }
  function seo(p) {
    const kind = CAT[p.category] || 'ملک';
    const parts = [p.area_m2 && `${kind} ${FA(p.area_m2)} متری`, p.bedrooms != null && `${FA(p.bedrooms)}‌خوابه`].filter(Boolean).join(' ');
    const place = [p.public_area, p.city].filter(Boolean).join(' ');
    return {
      seo_title: `${p.title} | ${parts || kind}${place ? ' ' + place : ''} | املاک آداک`,
      seo_description: `${parts || kind}${place ? ' در ' + place : ''}؛ فایل ${p.title} املاک آداک. برای قیمت و بازدید با مشاوران آداک تماس بگیرید.`,
    };
  }
  function updatePreview() {
    const p = collect(); const s = seo(p);
    $('#g-title').textContent = s.seo_title; $('#g-desc').textContent = s.seo_description;
    $('#sum-count').textContent = `${FA($(F.sum).value.length)} / ۱۲۰۰`;
  }
  $('#edit-form').addEventListener('input', updatePreview);

  async function save(rec, index, uploads) {
    if (DEMO) { if (index >= 0) listings[index] = rec; else listings.push(rec); renderList(); return; }
    const done = [];
    for (let k = 0; k < uploads.length; k++) {
      $('#save-btn').textContent = `ارسال عکس ${FA(k + 1)} از ${FA(uploads.length)}…`;
      done.push(await api('/upload', uploads[k]));
    }
    $('#save-btn').textContent = 'در حال انتشار…';
    const r = await api('/save', { listing: rec, uploads: done });
    listings = r.listings; renderList();
  }
  $('#edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = collect();
    if (!(p.code > 0)) { toast('کد فایل را وارد کنید (فقط عدد).', true); $(F.code).focus(); return; }
    if (editing < 0 && listings.some((x) => x.slug === p.slug)) { toast('این کد قبلاً استفاده شده؛ کد دیگری بزنید.', true); $(F.code).focus(); return; }
    if (!photos.length) { toast('حداقل یک عکس اضافه کنید.', true); return; }
    const uploads = []; const paths = photos.map((ph, i) => {
      if (!ph.data) return ph.src;
      const path = `/assets/uploads/${p.slug}-${Date.now().toString(36)}-${i + 1}.jpg`;
      uploads.push({ path, data: ph.data.split(',')[1] }); return path;
    });
    const old = editing >= 0 ? listings[editing] : {};
    const rec = Object.assign({}, old, p, seo(p), { cover: paths[0], gallery: paths.slice(1) });
    delete rec.code;
    const btn = $('#save-btn'); btn.disabled = true; btn.textContent = 'در حال ذخیره…';
    try {
      await save(rec, editing, uploads);
      show('view-dash'); toast(DEMO ? 'دمو: ذخیره شد (در حالت دمو چیزی در سایت تغییر نمی‌کند).' : 'ذخیره شد. تا حدود یک دقیقه دیگر در سایت دیده می‌شود.');
    } catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; btn.textContent = 'ذخیره و انتشار'; }
  });

  $('#del-btn').addEventListener('click', () => {
    const p = listings[editing]; $('#confirm-text').textContent = `فایل «${p.title}» برای همیشه حذف شود؟ اگر فقط می‌خواهید موقتاً دیده نشود، «نمایش در سایت» را خاموش کنید.`;
    $('#confirm').showModal();
  });
  $('#c-no').addEventListener('click', () => $('#confirm').close());
  $('#c-yes').addEventListener('click', async () => {
    $('#confirm').close(); const p = listings[editing];
    try {
      if (DEMO) listings.splice(editing, 1); else listings = (await api('/delete', { slug: p.slug })).listings;
      renderList(); show('view-dash'); toast('فایل حذف شد.');
    } catch (err) { toast(err.message, true); }
  });

  /* ---------- start ---------- */
  if (DEMO && new URLSearchParams(location.search).has('skip')) loadList().catch(() => show('view-login'));
  else if (!DEMO && token) loadList().catch(() => show('view-login')); else show('view-login');
})();
