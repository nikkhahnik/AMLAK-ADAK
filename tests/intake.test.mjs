import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/submit.mjs';
const payload={kind:'darkhast',family:'TEST',phone:'09120000000',deal:'خرید',category:'آپارتمان',consent:'yes',elapsed:5000};
const req=(d)=>new Request('https://example.invalid/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
test('intake validates and never claims false success',async()=>{
  const originalFetch=globalThis.fetch;
  const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
  try{
    delete process.env.TELEGRAM_BOT_TOKEN;delete process.env.TELEGRAM_CHAT_ID;
    let response=await handler(req(payload));assert.equal(response.status,503);assert.equal((await response.json()).delivered,false);
    response=await handler(req({...payload,phone:'1'}));assert.equal(response.status,400);
    response=await handler(req({...payload,consent:'no'}));assert.equal(response.status,400);
    response=await handler(req({...payload,family:''}));assert.equal(response.status,400);
    process.env.TELEGRAM_BOT_TOKEN='123:mock';process.env.TELEGRAM_CHAT_ID='123';
    globalThis.fetch=async()=>new Response(JSON.stringify({ok:false}),{status:400});
    response=await handler(req(payload));assert.equal(response.status,503);assert.equal((await response.json()).delivered,false);
    globalThis.fetch=async()=>new Response(JSON.stringify({ok:true}),{status:200});
    response=await handler(req(payload));assert.equal(response.status,200);assert.equal((await response.json()).delivered,true);
  }finally{
    globalThis.fetch=originalFetch;
    if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=token;
    if(chat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=chat;
  }
});
