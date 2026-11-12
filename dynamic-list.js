(()=>{'use strict';
const wrap=document.querySelector('#more-properties');
const counter=document.querySelector('#public-count');
if(!wrap)return;
const first=document.querySelector('#first-property');
const safeImage=value=>{
  if(!value)return '/assets/adaak-symbol.png';
  try{const u=new URL(value,location.origin);return u.origin===location.origin?u.pathname+u.search:'/assets/adaak-symbol.png'}catch{return '/assets/adaak-symbol.png'}
};
const make=(tag,cls,text)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);
  return el;
};
fetch('/properties.json',{credentials:'omit',cache:'no-store'})
 .then(r=>{if(!r.ok)throw Error('catalog unavailable');return r.text().then(raw=>JSON.parse(raw.trim()||'[]'))})
 .then(rows=>{
  const items=Array.isArray(rows)?rows.filter(x=>x&&x.is_published===true&&x.slug&&/^[a-z0-9][a-z0-9-]{2,63}$/.test(x.slug)): [];
  wrap.replaceChildren();
  items.filter(x=>x.slug!=='adk-019').forEach(p=>{
    const card=make('article','dynamic-property-card');
    card.dataset.category=p.category||'apartment';
    card.dataset.search=[p.title,p.summary,p.category,p.city,p.public_area,p.area_m2,p.bedrooms].filter(Boolean).join(' ').toLowerCase();
    const link=make('a','dynamic-property-image');
    link.href='/p/'+encodeURIComponent(p.slug);
    const img=make('img');
    img.src=safeImage(p.cover);
    img.alt=p.title||'فایل ملکی املاک آداک';
    img.loading='lazy';
    link.append(img);
    const content=make('div','dynamic-property-content');
    const eyebrow=make('span','listing-number',p.slug.toUpperCase());
    const h=make('h3','',p.title||'فایل ملکی آداک');
    const summary=make('p','',p.summary||'برای دریافت اطلاعات تکمیلی و هماهنگی بازدید با مشاوران آداک تماس بگیرید.');
    const meta=make('p','',[
      p.area_m2?String(p.area_m2)+' متر':'',
      p.bedrooms!==null&&p.bedrooms!==undefined?String(p.bedrooms)+' خواب':'',
      p.public_area||p.city||'کرج'
    ].filter(Boolean).join('، '));
    const actions=make('div','feature-actions');
    const view=make('a','btn btn-navy','مشاهده فایل و گالری');
    view.href='/p/'+encodeURIComponent(p.slug);
    const msg='سلام، برای فایل '+(p.title||p.slug)+' درخواست اطلاعات و بازدید دارم.';
    const wa=make('a','btn btn-outline','واتساپ');
    wa.href='https://wa.me/989196589769?text='+encodeURIComponent(msg);
    wa.target='_blank';wa.rel='noopener noreferrer';
    actions.append(view);
    if(p.tour_url&&/^\/[a-z0-9/_-]*$/i.test(p.tour_url)){
      const tour=make('a','btn btn-gold','تور ۳۶۰');
      tour.href=p.tour_url;
      actions.append(tour);
    }
    actions.append(wa);
    content.append(eyebrow,h,summary,meta,actions);
    card.append(link,content);
    wrap.append(card);
  });
  if(counter)counter.textContent=((first?1:0)+items.filter(x=>x.slug!=='adk-019').length).toLocaleString('fa-IR')+' فایل در سایت';
  window.dispatchEvent(new Event('adak-list-ready'));
 })
 .catch(()=>{
   if(counter&&first)counter.textContent='۱ فایل در سایت';
   window.dispatchEvent(new Event('adak-list-ready'));
 });
})();