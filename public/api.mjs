import {release,business,checklist} from './seed.mjs';
import {route,contextualQuestion} from './engine.mjs';
import {runRegression} from './evaluate.mjs';
export const demo=document.documentElement.dataset.mode==='demo';
const key='service-agent-lab-v1';
export async function api(path,body){
 if(!demo){const response=await fetch(`./api/${path}`,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw new Error(value.error||'请求失败');return value;}
 const request=async()=>{const stored=localStorage.getItem(key);let s=stored?JSON.parse(stored):{business,release:structuredClone(release),checklist,conversations:[],tickets:[],regressions:[],releaseHistory:[],mode:'browser',modelAvailable:false};let result;
 const record=(kind,data)=>({...data,id:data.id||crypto.randomUUID(),kind,revision:0,createdAt:new Date().toISOString()});
 if(path==='state')return s;
 if(path==='export')return {...s,format:'service-agent-browser-export-v1',exportedAt:new Date().toISOString(),limitations:['浏览器档案，不含服务端私有模型记录']};
 if(path==='chat'){if(body.provider!=='rules')throw new Error('公开演示不调用模型；请运行完整本机版');const old=s.conversations.find(r=>r.id===body.id);if(old){if(old.question!==body.question||old.session!==body.session)throw new Error('请求 ID 冲突');return old;}const contextQuestion=contextualQuestion(body.question,s.conversations.filter(c=>c.session===body.session)),d=route(contextQuestion,s.release);d.question=body.question;d.contextQuestion=contextQuestion;result=record('conversation',{...d,id:body.id,session:body.session,status:'completed',sourceSnapshot:structuredClone(d.citations)});s.conversations.unshift(result);}
 else if(path==='tickets'){const old=s.tickets.find(t=>t.conversationId===body.conversationId);if(old)return old;const c=s.conversations.find(c=>c.id===body.conversationId);if(!c||!['handoff','clarify'].includes(c.action))throw new Error('记录不支持转人工');result=record('ticket',{conversationId:c.id,question:c.question,reason:c.reason,releaseId:c.releaseId,sourceSnapshot:c.sourceSnapshot,status:'queued',owner:null,resolution:null,history:[{at:new Date().toISOString(),status:'queued',note:'浏览器本地模拟'}]});s.tickets.unshift(result);}
 else if(path==='tickets/update'){const old=s.tickets.find(t=>t.id===body.id);if(!old||old.revision!==body.revision)throw new Error('工单版本冲突，请刷新');if(!({queued:['accepted'],accepted:['resolved'],resolved:[]})[old.status].includes(body.status)||!body.note?.trim())throw new Error('需要合法状态与处理说明');result={...old,status:body.status,revision:old.revision+1,owner:'当前浏览器操作者',resolution:body.status==='resolved'?body.note:null,history:[...old.history,{at:new Date().toISOString(),status:body.status,note:body.note}]};s.tickets=s.tickets.map(t=>t.id===old.id?result:t);}
 else if(path==='knowledge/publish'){throw new Error('公开演示只读知识库；知识编辑、发布与完整版本回归请运行本机版');}
 else if(path==='regression'){result=record('regression',runRegression(s.release));s.regressions.unshift(result);}
 else throw new Error('接口未支持');
 try{localStorage.setItem(key,JSON.stringify(s));}catch{throw new Error('浏览器存储失败，本次修改未保存；请导出备份');}return result;};
 return navigator.locks?navigator.locks.request(key,request):request();
}
export async function downloadArchive(){const data=await api('export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='service-agent-delivery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
