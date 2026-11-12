(()=>{'use strict';
const data=window.ADAAK_TOUR||[];
const el=document.getElementById('tour-viewer');
if(!el||!data.length||typeof window.pannellum==='undefined')return;
const links={
  yard:[{pitch:-2,yaw:39,type:'scene',text:'ورود به لابی',sceneId:'lobby'}],
  lobby:[{pitch:-4,yaw:-150,type:'scene',text:'محوطهٔ ساختمان',sceneId:'yard'}],
  living:[{pitch:-8,yaw:-95,type:'scene',text:'بالکن',sceneId:'balcony'},{pitch:-3,yaw:110,type:'scene',text:'اتاق خواب',sceneId:'bedroom'}],
  balcony:[{pitch:-6,yaw:-150,type:'scene',text:'بازگشت به پذیرایی',sceneId:'living'}],
  bedroom:[{pitch:-4,yaw:-37,type:'scene',text:'پذیرایی',sceneId:'living'}]
};
const startYaw={yard:30,living:35};
const scenes={};
data.forEach(s=>{
  const base={type:'equirectangular',panorama:s.src,yaw:(startYaw[s.id]||0),pitch:0,avoidShowingBackground:true,hotSpots:links[s.id]||[]};
  if(s.full){s.haov=360;s.vaov=180;scenes[s.id]={...base,hfov:100,minHfov:50,maxHfov:110,minPitch:-90,maxPitch:90};return;}
  scenes[s.id]={...base,haov:s.haov,vaov:s.vaov,vOffset:0,hfov:Math.min(100,s.haov*0.8),minHfov:35,maxHfov:Math.min(110,s.haov),
    minPitch:-s.vaov/2,maxPitch:s.vaov/2,minYaw:-s.haov/2,maxYaw:s.haov/2};
});
const fromHash=decodeURIComponent(location.hash.slice(1));
const first=scenes[fromHash]?fromHash:data[0].id;
const viewer=window.pannellum.viewer(el,{
  default:{firstScene:first,autoLoad:true,sceneFadeDuration:500,showZoomCtrl:true,showFullscreenCtrl:true,compass:false,mouseZoom:true,
    strings:{loadButtonLabel:'نمایش تور',loadingLabel:'در حال بارگذاری…',bylineLabel:'%s',noPanoramaError:'تصویری برای نمایش پیدا نشد.',
      fileAccessError:'تصویر %s بارگذاری نشد.',malformedURLError:'نشانی تصویر نادرست است.',iOS8WebGLError:'مرورگر این دستگاه از نمایش تور پشتیبانی نمی‌کند.',
      genericWebGLError:'مرورگر شما از WebGL پشتیبانی نمی‌کند. لطفاً مرورگر دیگری را امتحان کنید.',textureSizeError:'این تصویر برای پردازنده گرافیکی دستگاه شما بزرگ است.',unknownError:'خطای ناشناخته رخ داد.'}},
  scenes
});
const ids=data.map(s=>s.id);
const caption=document.getElementById('tour-caption');
const thumbs=[...document.querySelectorAll('.tour-thumb')];
const groupOf=s=>s.group||s.id;
const stops=[...new Set(data.map(groupOf))];
const anglesBox=document.getElementById('tour-angles');
const sync=id=>{
  const i=ids.indexOf(id); if(i<0)return;
  const s=data[i], g=groupOf(s), stop=stops.indexOf(g);
  if(caption)caption.textContent=s.title+'، فضای '+(stop+1).toLocaleString('fa-IR')+' از '+stops.length.toLocaleString('fa-IR');
  thumbs.forEach(t=>{const ts=data[ids.indexOf(t.dataset.scene)];t.setAttribute('aria-pressed',String(!!ts&&groupOf(ts)===g));});
  if(anglesBox){
    const members=data.filter(x=>groupOf(x)===g);
    anglesBox.querySelectorAll('button').forEach(b=>b.remove());
    anglesBox.hidden=members.length<2;
    members.forEach(m=>{const b=document.createElement('button');b.type='button';b.textContent=m.angle||m.title;b.setAttribute('aria-pressed',String(m.id===id));b.addEventListener('click',()=>go(m.id));anglesBox.append(b);});
  }
  history.replaceState(null,'','#'+id);
};
const go=id=>{if(scenes[id]&&viewer.getScene()!==id)viewer.loadScene(id)};
const step=n=>{const cur=data[ids.indexOf(viewer.getScene())];const k=stops.indexOf(groupOf(cur));const g=stops[(k+n+stops.length)%stops.length];go(data.find(x=>groupOf(x)===g).id)};
const byId=Object.fromEntries(data.map(s=>[s.id,s]));
const fit=()=>{
  const s=byId[viewer.getScene()]; if(!s)return;
  const box=viewer.getContainer(); const a=box.clientWidth/Math.max(1,box.clientHeight);
  if(s.full){viewer.setHfovBounds([50,a<1?120:110]);return;}
  const r=Math.PI/180, maxH=Math.min(s.haov,110,2*Math.atan(Math.tan(s.vaov/2*r)*a)/r*0.97);
  viewer.setHfovBounds([Math.min(25,maxH),maxH]);
  if(viewer.getHfov()>maxH||isNaN(viewer.getHfov()))viewer.setHfov(maxH,false);
};
viewer.on('load',fit);
viewer.on('fullscreenchange',()=>setTimeout(fit,120));
window.addEventListener('resize',()=>{clearTimeout(fit.t);fit.t=setTimeout(fit,150)});
viewer.on('scenechange',sync);
thumbs.forEach(t=>t.addEventListener('click',()=>{go(t.dataset.scene);el.parentElement.scrollIntoView({behavior:'smooth',block:'start'})}));
document.getElementById('tour-prev')?.addEventListener('click',()=>step(-1));
document.getElementById('tour-next')?.addEventListener('click',()=>step(1));
sync(first);
})();
