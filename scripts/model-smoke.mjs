import {createApp} from '../src/server.mjs';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
process.env.LAB_ENABLE_MODEL='1';
const {server,store}=createApp();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const results=[];for(const question of ['试用多久，需要绑定付款吗？','月付标准套餐首次购买后可以退款吗？']){console.log(`Calling actual model: ${question}`);const response=await fetch(`${origin}/api/chat`,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({id:randomUUID(),session:randomUUID(),question,provider:'codex'})});const result=await response.json();results.push(result);console.log(JSON.stringify({status:response.status,id:result.id,runStatus:result.status,usage:result.usage,modelError:result.modelError}));}
await mkdir('data',{recursive:true});await writeFile('data/model-smoke.json',JSON.stringify({createdAt:new Date().toISOString(),origin:'synthetic_questions_actual_model_calls',results},null,2),{mode:0o600});server.close();store.close();if(results.some(r=>r.status!=='completed'))process.exitCode=1;
