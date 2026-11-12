(()=>{'use strict';
const params=new URLSearchParams(location.search);
const slug=params.get('slug')||'';
if(!slug||slug==='adk-019')return;
const valid=/^[a-z0-9][a-z0-9-]{2,63}$/.test(slug);
const main=document.querySelector('main');
if(!valid||!main)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeImage=value=>{
 try{const u=new URL(String(value||''),location.origin);return u.origin===location.origin?u.pathname+u.search:'/assets/adaak-symbol.png'}catch{return '/assets/adaak-symbol.png'}
};
const phone='09126895443',phone2='09388936259',wa='https://wa.me/989196589769';
fetch('/properties.json',{credentials:'omit',cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.text().then(raw=>JSON.parse(raw.trim()||'[]'))}).then(rows=>{
 const p=Array.isArray(rows)?rows.find(x=>x&&x.slug===slug&&x.is_published===true):null;
 if(!p){main.innerHTML='<div class="wrap" style="padding:90px 0;text-align:center"><h1>این فایل در حال حاضر در دسترس نیست.</h1><p>برای مشاهده فایل‌های منتشرشده به صفحه اصلی آداک بازگردید.</p><a class="btn btn-navy" href="/">بازگشت به صفحه اصلی</a></div>';return;}
 const title=p.title||'فایل ملکی آداک';
 const summary=p.summary||'برای دریافت اطلاعات تکمیلی و هماهنگی بازدید با مشاوران آداک تماس بگیرید.';
 const images=[p.cover,...(Array.isArray(p.gallery)?p.gallery:[])].filter(Boolean).map(safeImage);
 const unique=[...new Set(images)];
 const meta=[p.area_m2?esc(p.area_m2)+' متر':'',p.bedrooms!==undefined&&p.bedrooms!==null?esc(p.bedrooms)+' اتاق خواب':'',esc(p.public_area||p.city||'کرج')].filter(Boolean);
 const imgCards=unique.map((src,i)=>'<figure class="adak-dynamic-photo"><img src="'+esc(src)+'" alt="'+esc(title)+' · تصویر '+(i+1)+'" loading="'+(i?'lazy':'eager')+'"></figure>').join('');
 const msg='سلام، برای '+title+' درخواست هماهنگی بازدید دارم.';
 main.innerHTML='<div class="wrap adak-dynamic-detail"><nav class="breadcrumb"><a href="/">خانه</a> / <a href="/#listings">فایل‌های ملکی</a> / '+esc(title)+'</nav><header class="property-page-title"><div><h1>'+esc(title)+'</h1><div class="property-location">کرج · '+esc(p.public_area||p.city||'موقعیت دقیق پس از هماهنگی بازدید')+'</div></div><div class="property-actions"><a class="icon-button" href="/qr.html?url='+encodeURIComponent(location.origin+'/p/'+slug)+'">دریافت QR</a><button class="icon-button" type="button" id="adak-share">اشتراک‌گذاری</button></div></header><section class="adak-dynamic-gallery">'+(imgCards||'<p>تصاویر این فایل به‌زودی اضافه می‌شود.</p>')+'</section><section class="property-info-layout"><article class="property-narrative"><h2>'+esc(title)+'</h2><p>'+esc(summary)+'</p><div class="feature-chips">'+meta.map(x=>'<span class="feature-chip">'+x+'</span>').join('')+'</div><p class="privacy-hint">برای رعایت حریم خصوصی مالکان، نشانی دقیق، اطلاعات مالک و شرایط محرمانه معامله در این صفحه درج نشده است.</p></article><aside class="contact-card"><div class="aside-header"><img src="/assets/adaak-symbol.png" alt="آداک"><strong>مشاوران املاک آداک</strong></div><h3>درخواست بازدید</h3><p>برای هماهنگی بازدید و دریافت اطلاعات تکمیلی با دفتر آداک تماس بگیرید.</p><p class="card-hours"><svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#clock"/></svg>ساعت کاری: ۹ تا ۲۰</p><a class="btn btn-navy" href="tel:'+phone+'">تماس با دفتر</a><a class="btn btn-outline" href="tel:'+phone2+'">تماس با مشاور</a><a class="btn btn-gold" target="_blank" rel="noopener noreferrer" href="'+wa+'?text='+encodeURIComponent(msg)+'">درخواست بازدید در واتساپ</a></aside></section></div>';
 document.title=(p.seo_title||title+' | املاک آداک');
 const canon=document.querySelector('link[rel="canonical"]');if(canon)canon.href=location.origin+'/p/'+slug;
 const ogu=document.querySelector('meta[property="og:url"]');if(ogu)ogu.content=location.origin+'/p/'+slug;
 const desc=document.querySelector('meta[name="description"]');if(desc)desc.content=p.seo_description||summary.slice(0,155);
 const og=document.querySelector('meta[property="og:title"]');if(og)og.content=document.title;
 const ogd=document.querySelector('meta[property="og:description"]');if(ogd)ogd.content=p.seo_description||summary.slice(0,155);
 const share=document.querySelector('#adak-share');share?.addEventListener('click',async()=>{try{await navigator.share({title, text:summary,url:location.href})}catch{}});
}).catch(()=>{main.innerHTML='<div class="wrap" style="padding:90px 0;text-align:center"><h1>نمایش این فایل ممکن نشد.</h1><a class="btn btn-navy" href="/">بازگشت به آداک</a></div>'});
})();