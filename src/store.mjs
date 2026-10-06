import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {release,business,checklist} from '../public/seed.mjs';
export const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export class Store {
 constructor(path){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, payload TEXT NOT NULL);');if(!this.db.prepare('SELECT id FROM settings WHERE id=?').get('release'))this.set('release',{...release,hash:hash(release.documents)});}
 get(key){const r=this.db.prepare('SELECT payload FROM settings WHERE id=?').get(key);return r?JSON.parse(r.payload):null;}
 set(key,value){this.db.prepare('INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(key,JSON.stringify(value));return value;}
 list(kind){return this.db.prepare('SELECT payload FROM records WHERE kind=? ORDER BY rowid DESC').all(kind).map(r=>JSON.parse(r.payload));}
 find(id){const r=this.db.prepare('SELECT payload FROM records WHERE id=?').get(id);return r?JSON.parse(r.payload):null;}
 save(kind,record){const value={createdAt:new Date().toISOString(),revision:0,...record,id:record.id||randomUUID(),kind};this.db.prepare('INSERT INTO records(id,kind,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(value.id,kind,JSON.stringify(value));return value;}
 update(id,revision,patch){const old=this.find(id);if(!old)throw Object.assign(new Error('记录不存在'),{status:404});if(old.revision!==revision)throw Object.assign(new Error('另一窗口已修改，请刷新后重试；本次草稿未保存'),{status:409});return this.save(old.kind,{...old,...patch,revision:old.revision+1,updatedAt:new Date().toISOString()});}
 publish(draft,revision){const current=this.get('release');if(revision!==current.revision)throw Object.assign(new Error('知识版本冲突，请重新载入'),{status:409});if(!Array.isArray(draft.documents)||!draft.documents.length||draft.documents.length>100)throw new Error('知识条目数量不合法');const ids=new Set();for(const d of draft.documents){if(!d.id||ids.has(d.id))throw new Error('知识 ID 重复或缺失');ids.add(d.id);for(const key of ['title','body','topic','source','owner','effective','expires'])if(typeof d[key]!=='string'||!d[key].trim()||d[key].length>8000)throw new Error(`知识字段 ${key} 缺失或过长`);if(!/^\d{4}-\d{2}-\d{2}$/.test(d.effective)||!/^\d{4}-\d{2}-\d{2}$/.test(d.expires)||d.effective>d.expires)throw new Error('有效日期不合法');if(!['public','internal'].includes(d.scope)||!['active','draft','retired'].includes(d.status)||!Array.isArray(d.keywords)||d.keywords.some(k=>typeof k!=='string'||!k.trim()))throw new Error('知识范围、状态或关键词不合法');}
  const next={id:`KB-${Date.now()}`,label:draft.label||'人工发布',revision:current.revision+1,createdAt:new Date().toISOString(),documents:draft.documents,hash:hash(draft.documents)};
  this.db.exec('BEGIN IMMEDIATE');try{this.save('release',current);this.set('release',next);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}return next;
 }
 archive(){const data={format:'service-agent-delivery-v1',exportedAt:new Date().toISOString(),business,release:this.get('release'),releaseHistory:this.list('release'),conversations:this.list('conversation'),tickets:this.list('ticket'),regressions:this.list('regression'),checklist,limitations:['本机单用户，无真实订单和 CRM','合成回归不等于模型语义评测','订阅 Tokens 不换算现金账单']};return {...data,manifest:{algorithm:'SHA256',payloadHash:hash(data)}};}
 close(){this.db.close();}
}
