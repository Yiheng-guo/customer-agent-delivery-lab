import {cases} from './cases.mjs';
import {route,naive,eligible} from './engine.mjs';
export function compareVersions(previous,current){
 const signature=r=>JSON.stringify(r.rows.map(x=>({id:x.id,question:x.question,expected:x.expected,fixture:x.fixture})));
 if(previous.dataset!==current.dataset||previous.asOf!==current.asOf||signature(previous)!==signature(current))return {compatible:false,reason:'题集、期望条件或资料日期不同，不能直接比较版本'};
 const changes=current.rows.map(after=>{const before=previous.rows.find(x=>x.id===after.id);return {id:after.id,question:after.question,before:before.current,after:after.current,regressed:before.current.pass&&!after.current.pass,fixed:!before.current.pass&&after.current.pass,textChanged:before.current.result.text!==after.current.result.text,routeChanged:before.current.result.action!==after.current.result.action};}).filter(x=>x.regressed||x.fixed||x.textChanged||x.routeChanged);
 return {compatible:true,sameRelease:previous.releaseId===current.releaseId,from:previous.releaseId,to:current.releaseId,previousPassed:previous.current.passed,currentPassed:current.current.passed,regressions:changes.filter(x=>x.regressed).length,fixes:changes.filter(x=>x.fixed).length,answerChanges:changes.filter(x=>x.textChanged).length,changes,limitations:['这是同题规则版本对照，不是模型质量实验','断言通过仍可能遗漏未定义的业务错误']};
}
export function runRegression(release,asOf='2026-10-06'){
 const rows=cases.map(c=>{
  const snapshot=structuredClone(release);
  if(c.fixture.expireRefund)snapshot.documents.filter(d=>d.topic==='refund').forEach(d=>d.expires='2026-01-01');
  if(c.fixture.conflictRefund){const d=snapshot.documents.find(d=>d.id==='K04');snapshot.documents.push({...d,id:'K99',body:'冲突合成条目：月付可以 30 天内退款。'});}
  const score=result=>{
   const issues=[];if(result.action!==c.expected.action)issues.push(`路由应为 ${c.expected.action}，实际 ${result.action}`);
   for(const s of c.expected.sources)if(!result.citations.some(x=>x.id===s))issues.push(`缺少 ${s}`);
   for(const t of c.expected.contains)if(!result.text.includes(t))issues.push(`缺少关键内容「${t}」`);
   for(const t of c.expected.excludes)if(result.text.includes(t))issues.push(`出现禁止内容「${t}」`);
   for(const ref of result.citations){const d=snapshot.documents.find(x=>x.id===ref.id);if(!d||!eligible(d,asOf))issues.push('引用过期、非公开或未发布资料');}
   return {result,pass:!issues.length,issues};
  };
  return {...structuredClone(c),baseline:score(naive(c.question,snapshot)),current:score(route(c.question,snapshot,{asOf}))};
 });
 const summarize=key=>({passed:rows.filter(r=>r[key].pass).length,total:rows.length,routingCorrect:rows.filter(r=>r[key].result.action===r.expected.action).length,invalidCitationCases:rows.filter(r=>r[key].issues.includes('引用过期、非公开或未发布资料')).length});
 return {createdAt:new Date().toISOString(),releaseId:release.id,asOf,dataset:'synthetic-boundary-20-v1',datasetOrigin:'synthetic',kind:'deterministic_rule_regression',baselineLabel:'故意缺少权限、时效与业务边界的旧检索',currentLabel:'当前边界策略 · 不是模型质量对比',baseline:summarize('baseline'),current:summarize('current'),rows,usage:{inputTokens:null,outputTokens:null,cost:null},limitations:['合成用例，不代表真实客户分布','比较确定性策略，不代表模型准确率或用户转化','关键字检测不覆盖所有提示注入','未进行独立盲审或生产负载测试']};
}
