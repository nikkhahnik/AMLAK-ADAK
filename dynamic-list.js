(()=>{'use strict';
const wrap=document.querySelector('#more-properties'),counter=document.querySelector('#public-count');if(!wrap)return;
fetch('/api/properties',{credentials:'omit'}).then(r=>{if(!r.ok)throw Error('bad response');return r.json()}).then(items=>{
 if(counter)counter.textContent=`${items.length.toLocaleString('fa-IR')} فایل در سایت`;
 items.filter(x=>x.slug!=='adk-019').forEach(p=>{const card=document.createElement('article');card.className='dynamic-property-card';card.dataset.search=[p.title,p.summary,p.category,p.city,p.public_area].join(' ').toLowerCase();card.dataset.category=p.category;
 const img=document.createElement('img');img.src=p.cover||'/assets/adaak-symbol.png';img.loading='lazy';img.alt=p.title;
 const content=document.createElement('div');content.className='dynamic-property-content';const h=document.createElement('h3');h.textContent=p.title;const summary=document.createElement('p');summary.textContent=p.summary.slice(0,180)+(p.summary.length>180?'…':'');const meta=document.createElement('p');meta.textContent=[p.area_m2?`${p.area_m2} متر`:'',p.bedrooms!==null?`${p.bedrooms} خواب`:'',p.city].filter(Boolean).join(' · ');const a=document.createElement('a');a.textContent='مشاهده گالری و درخواست بازدید';a.href='/p/'+encodeURIComponent(p.slug);
 content.append(h,summary,meta,a);card.append(img,content);wrap.append(card)})
 window.dispatchEvent(new Event('adak-list-ready'));
 }).catch(()=>{if(counter)counter.textContent='نمایش فایل‌های ذخیره‌شده'});
})();
