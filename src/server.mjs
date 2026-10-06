import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {compose} from './model.mjs';
import {route,validateModel,contextualQuestion} from '../public/engine.mjs';
import {runRegression} from '../public/evaluate.mjs';
import {business,checklist} from '../public/seed.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const str=(x,max=4000)=>{if(typeof x!=='string'||!x.trim()||x.length>max)throw error('文本为空或超出长度限制');return x.trim();};
const uuid=x=>{if(typeof x!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x))throw error('请求 ID 不合法');return x;};
export function createApp({dataDir=process.env.LAB_DATA_DIR||join(root,'data'),model=compose}={}){
 const store=new Store(join(dataDir,'lab.sqlite')),busy=new Set();
 const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json;charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
 const server=createServer(async(req,res)=>{try{
  const host=req.headers.host;if(!host||!/^127\.0\.0\.1:\d+$/.test(host))throw error('仅允许本机访问',403);
  if(req.headers.origin&&req.headers.origin!==`http://${host}`)throw error('拒绝跨来源访问',403);
  if(req.headers['sec-fetch-site']==='cross-site')throw error('拒绝跨站访问',403);
  const url=new URL(req.url,`http://${host}`),path=url.pathname;
  if(path.startsWith('/api/')){
   if(req.method==='GET'){
    if(path==='/api/state')return json(res,200,{business,checklist,release:store.get('release'),conversations:store.list('conversation'),tickets:store.list('ticket'),regressions:store.list('regression'),releaseHistory:store.list('release'),mode:'local',modelAvailable:process.env.LAB_ENABLE_MODEL==='1'});
    if(path==='/api/export'){res.writeHead(200,{'content-type':'application/json;charset=utf-8','content-disposition':'attachment; filename="service-agent-delivery.json"','cache-control':'no-store'});return res.end(JSON.stringify(store.archive(),null,2));}
    throw error('接口不存在',404);
   }
   if(req.method!=='POST')throw error('不支持的方法',405);
   if(!req.headers['content-type']?.startsWith('application/json'))throw error('需要 JSON 请求');
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>65536)throw error('请求过大',413);}let body;try{body=JSON.parse(raw);}catch{throw error('JSON 格式错误');}
   if(path==='/api/chat'){
    const id=uuid(body.id),question=str(body.question,2000),session=uuid(body.session),provider=body.provider||'rules';if(!['rules','codex'].includes(provider))throw error('未知运行模式');
    const old=store.find(id);if(old){if(old.kind!=='conversation'||old.question!==question||old.session!==session||old.requestProvider!==provider)throw error('相同请求 ID 的输入发生变化',409);return json(res,200,old);}
    if(busy.has(id))throw error('该请求正在处理中，请稍后刷新',409);
    if(provider==='codex'&&process.env.LAB_ENABLE_MODEL!=='1')throw error('真实模型未启用；请按启动说明配置，不会伪装调用');
    if(provider==='codex'&&busy.size>=1)throw error('当前已有模型调用，请稍后再试',429);
    const snapshot=store.get('release'),contextQuestion=contextualQuestion(question,store.list('conversation').filter(c=>c.session===session)),decision=route(contextQuestion,snapshot);decision.question=question;decision.contextQuestion=contextQuestion;
    const record=store.save('conversation',{...decision,id,session,requestProvider:provider,releaseHash:snapshot.hash,sourceSnapshot:structuredClone(decision.citations),runtimePid:process.pid,status:provider==='codex'&&decision.action==='answer'?'running':'completed'});
    if(record.status!=='running')return json(res,201,record);
    busy.add(id);try{const result=await model(decision);await mkdir(join(dataDir,'model-runs'),{recursive:true});await writeFile(join(dataDir,'model-runs',`${id}.json`),JSON.stringify({...result,recordId:id,releaseHash:snapshot.hash},null,2),{mode:0o600});let updated={...record,provider:'codex',status:result.ok?'completed':'failed',elapsedMs:result.elapsedMs,modelError:result.error,requestCount:result.requestCount,usage:{inputTokens:result.usage?.input_tokens??null,outputTokens:result.usage?.output_tokens??null,cachedTokens:result.usage?.cached_input_tokens??null,cost:null,currency:null}};
      if(result.ok){updated.rawCandidate=result.candidate;try{updated=validateModel(result.candidate,updated);}catch(e){updated.status='validation_failed';updated.modelError=e.message;}}
      return json(res,201,store.update(id,record.revision,updated));
    }finally{busy.delete(id);}
   }
   if(path==='/api/review'){const record=store.find(uuid(body.id));if(!record?.modelDraft)throw error('没有可审阅的模型草稿');if(!['accepted','rejected'].includes(body.status))throw error('审阅状态不合法');return json(res,200,store.update(record.id,body.revision,{modelReview:body.status,reviewNote:str(body.note,1200),reviewedAt:new Date().toISOString(),reviewer:'本机操作者'}));}
   if(path==='/api/tickets'){
    const source=store.find(uuid(body.conversationId));if(!source||source.kind!=='conversation')throw error('找不到原始对话');const old=store.list('ticket').find(t=>t.conversationId===source.id);if(old)return json(res,200,old);
    if(!['handoff','clarify'].includes(source.action))throw error('该记录无需业务转人工');return json(res,201,store.save('ticket',{conversationId:source.id,question:source.question,reason:source.reason,releaseId:source.releaseId,sourceSnapshot:source.sourceSnapshot,status:'queued',owner:null,resolution:null,history:[{at:new Date().toISOString(),status:'queued',note:'仅本地演示工单，没有通知外部企业'}]}));
   }
   if(path==='/api/tickets/update'){const old=store.find(uuid(body.id));if(old?.kind!=='ticket')throw error('工单不存在',404);const allowed={queued:['accepted'],accepted:['resolved'],resolved:[]};if(!allowed[old.status].includes(body.status))throw error('工单状态转换不合法');const note=str(body.note,1200);return json(res,200,store.update(old.id,body.revision,{status:body.status,owner:'本机操作者',resolution:body.status==='resolved'?note:null,history:[...old.history,{at:new Date().toISOString(),status:body.status,note}]}));}
   if(path==='/api/knowledge/publish'){
    if(!body.release||!Array.isArray(body.release.documents))throw error('知识草稿格式错误');
    const preview=runRegression(body.release);if(preview.current.passed!==preview.current.total)throw error(`发布被回归门禁阻止：${preview.current.passed}/${preview.current.total}。先修复失败用例或明确更新评测协议。`,422);
    const published=store.publish(body.release,body.revision);store.save('regression',runRegression(published));return json(res,201,published);
   }
   if(path==='/api/regression')return json(res,201,store.save('regression',runRegression(store.get('release'))));
   throw error('接口不存在',404);
  }
  if(req.method!=='GET')throw error('不支持的方法',405);
  const file=resolve(root,'public',path==='/'?'index.html':`.${decodeURIComponent(path)}`);if(!file.startsWith(join(root,'public')+'/'))throw error('路径不合法',403);let content;try{content=await readFile(file);}catch{throw error('文件不存在',404);}const type={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'}[extname(file)]||'application/octet-stream';res.writeHead(200,{'content-type':`${type};charset=utf-8`,'x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(content);
 }catch(e){json(res,e.status||400,{error:e.message});}});
 for(const r of store.list('conversation'))if(r.status==='running'){let alive=false;try{if(r.runtimePid){process.kill(r.runtimePid,0);alive=true;}}catch{}if(!alive)store.update(r.id,r.revision,{status:'interrupted',modelError:'执行进程已结束；已冻结的来源保留，未自动重试'});}
 return {server,store};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {server}=createApp();const port=Number(process.env.PORT||4340);server.listen(port,'127.0.0.1',()=>console.log(`Service Agent Lab: http://127.0.0.1:${port} · ${process.env.LAB_ENABLE_MODEL==='1'?'real model available':'rules mode'}`));}
