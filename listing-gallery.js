/* Lightbox for pre-rendered listing pages (/p/<slug>). Twin of app.js gallery, per-page images. */
(()=>{'use strict';
const grid=document.getElementById('l-photo-grid');
const mosaic=document.querySelector('.photo-mosaic');
if(!grid&&!mosaic)return;
const box=document.getElementById('lightbox');
if(!box)return;
const imgs=Array.from(grid?grid.querySelectorAll('img'):[]).map(i=>({src:i.getAttribute('src'),cap:i.getAttribute('alt')||''}));
if(!imgs.length)return;
const img=document.getElementById('lightbox-image'),cnt=document.getElementById('lightbox-counter'),cap=document.getElementById('lightbox-caption');
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
let i=0,last=null;
function show(){const p=imgs[i];if(!p)return;img.src=p.src;img.alt=p.cap;cnt.textContent=fa(i+1)+' / '+fa(imgs.length);cap.textContent=p.cap;}
function open(n){i=n;last=document.activeElement;box.classList.add('open');box.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';show();document.getElementById('lightbox-close')?.focus();}
function close(){box.classList.remove('open');box.setAttribute('aria-hidden','true');document.body.style.overflow='';img.removeAttribute('src');last&&last.focus&&last.focus();}
function move(s){i=(i+s+imgs.length)%imgs.length;show();}
document.querySelectorAll('.l-mosaic-photo').forEach(b=>b.addEventListener('click',()=>open(Number(b.dataset.index)||0)));
grid&&grid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>open(Number(b.dataset.index)||0)));
document.getElementById('l-view-all')?.addEventListener('click',()=>document.getElementById('photos')?.scrollIntoView({behavior:'smooth'}));
document.getElementById('lightbox-close')?.addEventListener('click',close);
document.getElementById('lightbox-prev')?.addEventListener('click',()=>move(-1));
document.getElementById('lightbox-next')?.addEventListener('click',()=>move(1));
box.addEventListener('click',e=>{if(e.target===box)close();});
document.addEventListener('keydown',e=>{if(!box.classList.contains('open'))return;
 if(e.key==='Escape'){e.preventDefault();close();}
 if(e.key==='ArrowRight'){e.preventDefault();move(-1);}
 if(e.key==='ArrowLeft'){e.preventDefault();move(1);}});
})();
