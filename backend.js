(function () {
  'use strict';
  const cfg = window.ADAAK_BACKEND_CONFIG || {};
  const url = String(cfg.url || '').replace(/\/$/, '');
  const key = String(cfg.publishableKey || '');
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && /^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+)$/.test(key);
  let token = '', refresh = '', expiry = 0;
  try { const stored = JSON.parse(sessionStorage.getItem('adak_session') || '{}');token=stored.access_token||'';refresh=stored.refresh_token||'';expiry=stored.expires_at||0; } catch{}
  const authHeaders = (isJSON = true) => {
    const headers = { apikey: key };
    if (isJSON) headers['Content-Type']='application/json';
    if (token) headers.Authorization='Bearer '+token;
    return headers;
  };
  const errorMessage = (data,status) => data?.message || data?.error_description || data?.msg || data?.error || `خطای سرور (${status})`;
  async function request(endpoint,options={}) {
    if (!ready) throw Error('اتصال پایگاه داده هنوز تنظیم نشده است.');
    const path = endpoint.startsWith('/')?endpoint:'/'+endpoint;
    const response=await fetch(url+path,{...options,headers:{...authHeaders(options.json!==false),...(options.headers||{})}});
    let data;
    try { data=await response.json(); } catch {data=null;}
    if (!response.ok) throw Error(errorMessage(data,response.status));
    return data;
  }
  async function rest(table,query='',method='GET',body) {
    const options={method,headers:{Prefer:method==='GET'?'':'return=representation'}};
    if(body!==undefined) options.body=JSON.stringify(body);
    return request('/rest/v1/'+table+(query?'?'+query:''),options);
  }
  async function signIn(email,password){
    const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
    setSession(data);
    return data.user;
  }
  function setSession(data){
    token=data.access_token||'';refresh=data.refresh_token||'';expiry=Date.now()+Math.max(0,(data.expires_in||3600)-90)*1000;
    sessionStorage.setItem('adak_session',JSON.stringify({access_token:token,refresh_token:refresh,expires_at:expiry}));
  }
  async function ensureSession(){
    if(!token) return null;
    if(Date.now()>expiry){
      if(!refresh) return null;
      const r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:refresh})});
      setSession(r);
    }
    return request('/auth/v1/user');
  }
  async function isStaff(user){
    if(!user?.id) return false;
    const items=await rest('adak_staff','select=user_id&user_id=eq.'+encodeURIComponent(user.id));
    return Array.isArray(items)&&items.length===1;
  }
  async function logout(){
    if(token) try{await request('/auth/v1/logout',{method:'POST'});}catch{}
    token='';refresh='';expiry=0;sessionStorage.removeItem('adak_session');
  }
  function encodeStoragePath(path){return String(path).split('/').map(encodeURIComponent).join('/');}
  async function signedPhoto(path){
    if (!path) return '';
    if (path.startsWith('assets/')) return path;
    const data=await request('/storage/v1/object/sign/adak-media/'+encodeStoragePath(path),{method:'POST',body:JSON.stringify({expiresIn:1800})});
    const signed=data.signedURL||data.signedUrl;
    if(!signed)throw Error('نشانی عکس در دسترس نیست');
    return signed.startsWith('https://')?signed:url+'/storage/v1'+(signed.startsWith('/')?signed:'/'+signed);
  }
  async function uploadPhoto(path,blob){
    if(!token) throw Error('برای بارگذاری وارد پنل شوید.');
    return request('/storage/v1/object/adak-media/'+encodeStoragePath(path),{method:'POST',json:false,headers:{'Content-Type':'image/webp','x-upsert':'false'},body:blob});
  }
  async function removePhoto(path){
    if(!token)throw Error('دسترسی بارگذاری ندارید');
    return request('/storage/v1/object/adak-media/'+encodeStoragePath(path),{method:'DELETE'});
  }
  window.ADAAK_BACKEND={get ready(){return ready;},get session(){return !!token;},rest,signIn,ensureSession,isStaff,logout,signedPhoto,uploadPhoto,removePhoto};
})();
