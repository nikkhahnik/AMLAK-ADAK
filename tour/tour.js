(()=>{'use strict';
const data=window.ADAAK_TOUR||[];
const el=document.getElementById('tour-viewer');
if(!el||!data.length||typeof window.pannellum==='undefined')return;
const links={
  living:[{pitch:0,yaw:-51,type:'scene',text:'بالکن',sceneId:'balcony'}],
  balcony:[{pitch:0,yaw:-85,type:'scene',text:'بازگشت به پذیرایی',sceneId:'living'}]
};
const startYaw={living:-40};
const scenes={};
data.forEach(s=>{
  scenes[s.id]={type:'equirectangular',panorama:s.src,haov:s.haov,vaov:s.vaov,vOffset:0,
    yaw:(startYaw[s.id]||0),pitch:0,hfov:Math.min(100,s.haov*0.8),minHfov:35,maxHfov:Math.min(110,s.haov),
    minPitch:-s.vaov/2,maxPitch:s.vaov/2,minYaw:-s.haov/2,maxYaw:s.haov/2,avoidShowingBackground:true,hotSpots:links[s.id]||[]};
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
const sync=id=>{
  const i=ids.indexOf(id); if(i<0)return;
  if(caption)caption.textContent=data[i].title+'، فضای '+(i+1).toLocaleString('fa-IR')+' از '+ids.length.toLocaleString('fa-IR');
  thumbs.forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.scene===id)));
  history.replaceState(null,'','#'+id);
};
const go=id=>{if(scenes[id]&&viewer.getScene()!==id)viewer.loadScene(id)};
const step=n=>{const i=ids.indexOf(viewer.getScene());go(ids[(i+n+ids.length)%ids.length])};
const byId=Object.fromEntries(data.map(s=>[s.id,s]));
const fit=()=>{
  const s=byId[viewer.getScene()]; if(!s)return;
  const box=viewer.getContainer(); const a=box.clientWidth/Math.max(1,box.clientHeight);
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
