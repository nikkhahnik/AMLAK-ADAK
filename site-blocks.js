(()=>{'use strict';
const config=window.ADAAK_BACKEND_CONFIG||{},base=String(config.url||'').replace(/\/$/,'');
const key=String(config.publishableKey||'');
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)||!key)return;
const safeColor=new Set(['#102a40','#0f2740','#ffffff','#f6f3eb','#b99861','#252525']);
function apply(block,el){
 if(!el||!block||!block.content||typeof block.content.text!=='string')return;
 el.textContent=block.content.text;
 const st=block.styles||{};
 if(['right','center','left'].includes(st.align))el.style.textAlign=st.align;
 if(safeColor.has(st.color))el.style.color=st.color;
 if(Number.isInteger(st.fontSize)&&st.fontSize>=12&&st.fontSize<=58)el.style.fontSize=st.fontSize+'px';
}
fetch(base+'/rest/v1/adak_site_blocks?select=block_key,content,styles,page_key&is_published=eq.true&page_key=eq.home&order=sort_order.asc',
{headers:{apikey:key},cache:'no-store'})
.then(r=>{if(!r.ok)throw Error('site blocks unavailable');return r.json()})
.then(blocks=>{if(!Array.isArray(blocks))return;
 for(const b of blocks){
  const node=document.querySelector('[data-adak-block="'+String(b.block_key).replace(/[^a-z0-9_-]/g,'')+'"]');
  if(node)apply(b,node);
 }
 const mount=document.getElementById('adak-custom-blocks');if(!mount)return;
 for(const b of blocks){if(!/^custom-[a-z0-9_-]+$/.test(b.block_key))continue;const c=b.content||{};
  const section=document.createElement('section');section.className='section-pad';section.setAttribute('data-custom-block',b.block_key);
  const wrap=document.createElement('div');wrap.className='wrap';const h=document.createElement('h2');h.className='section-heading';h.textContent=String(c.text||'');
  const p=document.createElement('p');p.className='body-text';p.textContent=String(c.subtitle||'');wrap.append(h,p);section.append(wrap);mount.append(section);
 }
}).catch(()=>{/* Existing static text remains visible when the backend is unconfigured or unavailable. */});
})();
