(()=>{'use strict';
const gal=document.getElementById('gal-list'),codes=document.getElementById('gal-codes'),tours=document.getElementById('tour-list');
if(!tours||tours.querySelector('.x-tour-card'))return; /* pre-rendered by scripts/build_seo.py */
const safe=v=>{try{const u=new URL(v,location.origin);return u.origin===location.origin?u.pathname:null}catch{return null}};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=String(x);return e};
const fa=n=>Number(n).toLocaleString('fa-IR');
const icon=id=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('class','icon');s.setAttribute('aria-hidden','true');const u=document.createElementNS('http://www.w3.org/2000/svg','use');u.setAttribute('href','/assets/icons.svg#'+id);s.append(u);return s};
fetch('/properties.json',{credentials:'omit',cache:'no-store'}).then(r=>r.ok?r.json():[]).then(rows=>{
 const items=(Array.isArray(rows)?rows:[]).filter(x=>x&&x.is_published===true&&/^[a-z0-9][a-z0-9-]{2,63}$/.test(x.slug||''));
 items.sort((a,b)=>a.slug.localeCompare(b.slug));
 let nTour=0;
 items.forEach(p=>{
  const pics=[p.cover,...(p.gallery||[])].map(safe).filter(Boolean);
  const href='/p/'+encodeURIComponent(p.slug);
  const id='gal-'+p.slug;
  if(false){const c=el('a','',p.title||p.slug);c.href='#'+id;codes.append(c)}
  if(gal&&pics.length){
   const f=el('article','x-gal-folder');f.id=id;
   const h=el('header','x-gal-folder-head'),d=el('div');
   d.append(el('span','listing-number',p.code||p.slug.toUpperCase()),el('h3','',[p.title,p.area_m2?'آپارتمان '+fa(p.area_m2)+' متری':''].filter(Boolean).join(' · ')),el('p','',fa(pics.length)+' تصویر'+(p.tour_url?' · تور ۳۶۰':'')));
   const all=el('a','btn-text','همهٔ تصاویر '+(p.title||''));all.href=href;all.append(icon('arrow-left'));
   h.append(d,all);
   const row=el('div','x-gal-row');
   pics.slice(0,5).forEach((src,i)=>{const a=el('a','x-gal-tile');a.href=href;const im=el('img');im.src=src;im.alt=(p.title||'')+'، تصویر '+fa(i+1);im.loading='lazy';a.append(im);row.append(a)});
   f.append(h,row);gal.append(f);
  }
  if(p.tour_url&&/^\/[a-z0-9/_-]*$/i.test(p.tour_url)){
   if(!nTour++)tours.replaceChildren();
   const card=el('article','x-tour-card');
   const pic=el('a','x-tour-pic');pic.href=p.tour_url;const im=el('img');im.src='/assets/tour/150/living-360-thumb.jpg';im.alt='تور ۳۶۰ '+(p.title||'');im.loading='lazy';
   const bd=el('span','x-tour-badge');bd.append(icon('eye'),'۳۶۰°');pic.append(im,bd);
   const body=el('div','x-tour-body');
   const facts=el('p','x-facts');[[p.area_m2,' متر'],[p.bedrooms,' خواب'],[5,' فضا']].filter(x=>x[0]!=null).forEach((x,i)=>{if(i)facts.append(el('i'));facts.append(el('b','',fa(x[0])),x[1])});
   const ul=el('ul','x-tour-scenes');
   [['living','پذیرایی و آشپزخانه'],['yard','محوطهٔ ساختمان'],['lobby','لابی ساختمان'],['balcony','بالکن'],['bedroom','اتاق خواب']].forEach(([k,t])=>{const li=el('li');const m=el('img');m.src='/assets/tour/150/'+k+'-360-thumb.jpg';m.alt='';m.loading='lazy';li.append(m,el('span','',t));ul.append(li)});
   const act=el('div','feature-actions');const go=el('a','btn btn-gold');go.href=p.tour_url;go.append(icon('eye'),'شروع تور ۳۶۰');const pg=el('a','btn btn-outline','صفحهٔ فایل');pg.href=href;act.append(go,pg);
   body.append(el('span','listing-number',p.code||p.slug.toUpperCase()),el('h3','','تور مجازی '+(p.title||'')),facts,ul,act);
   card.append(pic,body);tours.append(card);
  }
 });
}).catch(()=>{});
codes&&codes.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;codes.querySelectorAll('a').forEach(x=>x.classList.toggle('is-on',x===a))});
})();
