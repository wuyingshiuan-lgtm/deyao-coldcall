const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const tools=require('../contact-history-tools.js');
assert.equal(tools.date('10/21/26'),'2026-10-21');assert.equal(tools.date('2026/10/8'),'2026-10-08');assert.equal(tools.date('2026-02-30'),'2026-02-30');
const original={date:'10/21/26',notes:'首次備註',recorder:'原紀錄者',contactHistory:[{id:'second',number:1,date:'2026-10-22',notes:'',result:'已寄回信'}]};
assert.equal(tools.initial(original,'foreignEmail').date,'2026-10-21');assert.equal(tools.initial(original,'foreignEmail').notes,'首次備註');assert.equal(tools.parts(original).followups.length,1);
assert.equal(tools.parts({date:'',notes:'',contactHistory:[{date:'2026-10-22',notes:'',result:''}]}).followups.length,1);
const snapshot={...original,date:'',notes:'',_initialContact:{date:'2026-10-21',notes:'首次備註',recorder:'原紀錄者'}};assert.equal(tools.initial(snapshot,'foreignEmail').notes,'首次備註');
const html=fs.readFileSync('index.html','utf8');const context={ContactHistoryTools:tools,historyData:[],getForeignEmailHistoryParts:tools.parts};vm.createContext(context);vm.runInContext(html.slice(html.indexOf('function sharedEntryList('),html.indexOf('function renderSharedHistory(')),context);
for(const key of ['domestic','foreignEmail','exhibitions','prospecting']){const entries=context.sharedEntryList({notes:'首次沒有日期',contactHistory:[{id:'second',date:'2026-10-22',notes:'第二次',result:'未接'}]},key);assert.equal(entries[0].number,1);assert.equal(entries[0].first,true);assert.equal(entries[0].notes,'首次沒有日期');assert.equal(entries[0].date,'');if(key!=='domestic')assert.equal(entries[1].number,2)}
const seen=[];const client={rpc:async(name,body)=>{seen.push({name,body});return {data:{status:'saved',id:'entry'},error:null}}};
(async()=>{const before=JSON.stringify(original);await tools.append(client,'foreignEmail','company-id',{id:'entry',date:'10/30/26',result:'已寄回信',notes:'後續備註'});assert.equal(seen[0].name,'append_contact_history');assert.equal(seen[0].body.p_date,'2026-10-30');assert.ok(!('data' in seen[0].body));assert.equal(JSON.stringify(original),before);
 await assert.rejects(()=>tools.append({rpc:async()=>({error:Error('denied')})},'foreignEmail','id',{}),/denied/);
 const bulk=fs.readFileSync('bulk-history.js','utf8');assert.ok(!bulk.slice(bulk.indexOf('async function saveOne('),bulk.indexOf('$b("bulkConfirm").onclick')).includes('.update('));console.log('PASS first-contact retention, blank original dates, legacy date formats, snapshots, append-only payload and rejected writes');})().catch(e=>{console.error(e);process.exitCode=1});
