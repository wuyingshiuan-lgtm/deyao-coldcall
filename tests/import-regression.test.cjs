const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../customer-import.js');
const html=fs.readFileSync('index.html','utf8');
const config=html.slice(html.indexOf('const outreachConfig='),html.indexOf('};',html.indexOf('const outreachConfig='))+2);
const mapper=html.slice(html.indexOf('function mapOutreachImport'),html.indexOf('document.querySelectorAll("[data-outreach-file]"'));
const domestic=html.slice(html.indexOf('function mapDomesticImport'),html.indexOf('$("importFile").onchange='));
const c={CustomerImport,Map,detectCity:()=>'',today:()=> '2026-10-30',currentProfile:{name:'測試人員'},XLSX:{utils:{sheet_to_json:s=>s,encode_cell:({r,c})=>r+':'+c}}};
vm.createContext(c);vm.runInContext(fs.readFileSync('customer-import-preview.js','utf8'),c);vm.runInContext(config+mapper+domestic,c);
const sheet=[[],['客戶名單'],['公司名稱','電子\u200b信箱','國家','聯絡人姓名／職位／Email'],['回歸測試','amy@example.com, bob@example.com','日本','Amy／採購／amy@example.com；Bob／業務／bob@example.com']];
sheet['3:3']={};
const wb={SheetNames:['資料'],Sheets:{資料:sheet}};
for(const key of ['domestic','foreignEmail','exhibitions','prospecting']){
 const entries=c.customerImportStage(wb);assert.equal(entries.length,1);assert.equal(entries[0].row,4);assert.equal(entries[0].selected,true);
 const ready=c.validateCustomerImport(entries,new Map(),key);assert.equal(ready.length,1);assert.equal(ready[0].values.Email,'amy@example.com, bob@example.com');
 const raw=ready.map(e=>e.values);
 if(key==='foreignEmail')raw[0]['聯絡人姓名／職位／Email']=CustomerImport.foreignContacts(raw[0]);
 const rows=key==='domestic'?c.mapDomesticImport(raw):c.mapOutreachImport(raw,key);
 assert.equal(rows.length,1);assert.equal(rows[0].company_name||rows[0].company,'回歸測試');
 if(key==='foreignEmail'){assert.equal(rows[0].emails.length,2);assert.equal(rows[0].emails[0].name,'Amy');assert.equal(rows[0].emails[0].position,'採購');assert.equal(rows[0].emails[1].email,'bob@example.com');}
}
const contacts=CustomerImport.foreignContacts({'聯絡人姓名／職位／Email':'a@example.com（採購）','Email':'a@example.com；b@example.com'});
assert.equal(contacts.length,2);assert.equal(contacts[0].position,'採購');
const links=[['說明'],['公司','網址'],['連結測試','顯示文字']];links['2:1']={l:{Target:'https://example.com'}};
assert.equal(c.customerImportStage({SheetNames:['S'],Sheets:{S:links}})[0].fields[1].value,'https://example.com');
console.log('PASS four categories: title/blank rows, exact line numbers, hidden header characters, hyperlink offsets, exported contact pairs, comma-separated email and legacy contact formats');
(async()=>{
 for(const key of ['domestic','foreignEmail','exhibitions','prospecting'])for(const fail of [false,true]){
  const nodes=new Map(),events={},writes=[],notices=[];let loaded=false;
  const node=()=>({style:{},value:'',disabled:false,textContent:'',innerHTML:'',scrollIntoView(){},insertAdjacentHTML(){},setAttribute(){}});
  const dialog={...node(),querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},querySelectorAll:()=>[],showModal(){},addEventListener:(n,f)=>events[n]=f,close(){events.close?.()},remove(){}};
  Object.assign(c,{document:{getElementById:()=>null,createElement:()=>dialog,body:{appendChild(){}}},esc:x=>String(x??''),readAllCompanyRows:async()=>[],appNotice:(m,o)=>notices.push(o),appConfirm:async()=>true,customerWrite:async(r,e,f)=>f(),sb:{from:table=>({insert:async payload=>{writes.push({table,payload});return {error:fail?{message:'write rejected'}:null}}})},load:async()=>{loaded=true},loadOutreachCloud:async()=>{loaded=true}});
  const pending=c.openCustomerImport(wb,key);await new Promise(setImmediate);await nodes.get('[data-import-save]').onclick();
  assert.equal(writes.length,1);assert.equal(writes[0].table,key==='domestic'?'cold_call_records':'outreach_records');
  if(key!=='domestic')assert.equal(writes[0].payload[0].category,key);
  if(key==='foreignEmail')assert.equal(writes[0].payload[0].data.emails[0].name,'Amy');
  assert.equal(notices.at(-1).title,fail?'資料匯入未完成':'資料匯入完成');assert.equal(loaded,!fail);
  const entries=vm.runInContext('customerImportSessions.get("'+key+'")',c);assert.equal(entries[0].saved,!fail);
  dialog.close();await pending;vm.runInContext('customerImportSessions.clear()',c);
 }
 console.log('PASS complete preview/save flow for all four categories, including contact merge, correct table/category, rejected writes, retained rows and refresh');
})().catch(e=>{console.error(e);process.exitCode=1});
