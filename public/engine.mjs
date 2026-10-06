export const labels={answer:'有据回答',clarify:'先澄清',refuse:'边界拒答',handoff:'转人工'};
export function contextualQuestion(question,history){const last=history[0];if(last&&/月付|年付|首次|续费|付费导出|用过导出/.test(question)&&question.length<200&&(last.action==='clarify'||last.citations?.some(c=>c.id==='K04')))return `${last.contextQuestion||last.question}\n用户补充：${question}`;return question;}
export function eligible(d,asOf){return d.scope==='public'&&d.status==='active'&&d.effective<=asOf&&d.expires>=asOf;}
export function sourcesFor(question,release,asOf='2026-10-06'){
 const eligibleDocs=release.documents.filter(d=>eligible(d,asOf));
 return eligibleDocs.map(d=>({d,score:d.keywords.reduce((n,k)=>n+(question.toLowerCase().includes(k.toLowerCase())?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.d.id.localeCompare(b.d.id)).slice(0,3).map(x=>x.d);
}
export function route(question,release,{asOf='2026-10-06'}={}){
 const q=question.trim(),base={question:q,releaseId:release.id,asOf,policyVersion:'boundary-v2',citations:[],reason:'',checks:['仅检索有效公开资料','未连接客户订单系统'],usage:{inputTokens:null,outputTokens:null,cachedTokens:null,cost:null,currency:null},provider:'rules',modelReview:'not_applicable'};
 const finish=(action,text,reason,citations=[])=>({...base,action,text,reason,citations:citations.map(d=>({id:d.id,title:d.title,quote:d.body,source:d.source,version:d.version,owner:d.owner,effective:d.effective,expires:d.expires}))});
 if(/忽略.*(规则|指令)|系统提示|system prompt|绕过|泄露|内部折扣|客户名单|银行卡|身份证|密钥|密码/i.test(q))return finish('refuse','不能披露内部资料、个人敏感信息或系统指令。请只提交公开业务问题。','涉及私有信息或指令绕过；关键词规则不等于完整攻击检测。');
 if(/投诉|赔偿|报警|律师|合同|报价|价格|多少钱|折扣|年付|找人工|转人工|人工客服/.test(q))return finish('handoff','这类问题需要人工核实。可以创建一张本地演示工单，并附上问题、知识版本和已有观察；尚未接通真实客服。','合同、交易承诺或明确要求人工，不自动作出业务决定。');
 if(/退款|退费|退钱/.test(q)&&!/月付/.test(q))return finish('clarify','请先确认：是月付标准套餐还是年付/企业合同？是否首次购买、是否续费、是否使用过付费导出？不要发送订单隐私。','缺少适用套餐，不能把月付规则泛化。');
 if(/我的.*(订单|账户|账号)|查.*订单|订单.*状态|账户.*余额/.test(q))return finish('handoff','我没有身份核验或订单查询能力，无法确认你的实际订单。请由人工在授权系统中核实；本地工单不会发送到真实企业。','无身份与系统连接，不能编造查询结果。');
 let candidates=sourcesFor(q,release,asOf);
 if(/退款|退费|退钱/.test(q))candidates=candidates.filter(d=>d.topic==='refund');
 if(!candidates.length)return finish('handoff','当前有效公开知识库没有足够依据。建议交由人工确认，我不会补写未知业务规则。','未命中有效资料或资料过期。');
 if(candidates.some(d=>release.documents.filter(x=>eligible(x,asOf)&&x.topic===d.topic).length>1))return finish('handoff','这个主题存在同时生效的冲突来源，请知识负责人确认后再答复。','同主题多个有效版本，停止回答。');
 return finish('answer',candidates.map(d=>d.body).join('\n\n'),'引用当前有效的公开知识片段，不承诺办理结果。',candidates);
}
export function naive(question,release){
 const found=release.documents.filter(d=>d.keywords.some(k=>question.toLowerCase().includes(k.toLowerCase())));
 const d=found.find(d=>d.status==='retired')||found.find(d=>d.scope==='internal')||found[0];
 return {question,action:d?'answer':'handoff',text:d?.body||'没有资料，请转人工。',citations:d?[{id:d.id,quote:d.body}]:[],provider:'naive-rules',releaseId:release.id};
}
export function validateModel(candidate,decision){
 if(!candidate||typeof candidate.answer!=='string'||candidate.answer.length>2400||!Array.isArray(candidate.citations)||!candidate.citations.length)throw new Error('模型结果缺少回答或引用');
 for(const c of candidate.citations){const source=decision.citations.find(x=>x.id===c.id);if(!source||typeof c.quote!=='string'||c.quote.length<8||!source.quote.includes(c.quote))throw new Error('模型引用不属于本次有效知识或摘录不匹配');}
 return {...decision,modelDraft:candidate.answer,modelCitations:candidate.citations,modelReview:'pending',checks:[...decision.checks,'引用字面匹配已通过；模型语义仍待人工审阅']};
}
