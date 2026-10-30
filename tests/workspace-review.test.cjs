// Regression coverage for the complete workspace review.
(function(){
const assert=require('node:assert/strict');require('../exhibition-mail-status.js');const {emails,matchRows,saveStatus}=global.ExhibitionMailStatus;
assert.deepEqual(emails('A@EXAMPLE.COM；a@example.com; 名字 <b@example.tw>'),['a@example.com','b@example.tw']);
const cloud=[{id:1,data:{company:'甲',email:'a@example.com',notes:'原備註',contactHistory:[{notes:'保留'}]}},{id:2,data:{company:'乙',emails:[{email:'b@example.com'}]}},{id:3,data:{company:'丙',email:'shared@example.com'}},{id:4,data:{company:'丁',email:'shared@example.com'}}];
const entries=matchRows(['A@example.com','b@example.com','a@example.com','shared@example.com','missing@example.com',''].map(x=>({emails:emails(x)})),cloud);
assert.deepEqual(entries.map(x=>x.selected),[true,true,false,false,false,false]);assert.match(entries[3].issue,/多筆/);assert.match(entries[2].issue,/重複/);
let stored=structuredClone(cloud[0]),writes=0,conflict=false;
const client={from(){let update=null;return {select(){return this},eq(){return this},single:async()=>({data:structuredClone(stored)}),update(payload){update=payload;return this},maybeSingle:async()=>{if(conflict)return{data:null};stored.data=update.data;writes++;return{data:{id:stored.id}}}}}};
(async()=>{await saveStatus(client,1,'取消訂閱',['a@example.com']);assert.equal(stored.data.mailStatus,'取消訂閱');assert.equal(stored.data.notes,'原備註');assert.deepEqual(stored.data.contactHistory,[{notes:'保留'}]);await saveStatus(client,1,'取消訂閱',['a@example.com']);assert.equal(writes,1);await saveStatus(client,1,'退件',['a@example.com']);assert.equal(stored.data.mailStatus,'退件');await assert.rejects(saveStatus(client,1,'bad'),/有效/);await assert.rejects(saveStatus(client,1,'取消訂閱',['other@example.com']),/Email 已變更/);conflict=true;await assert.rejects(saveStatus(client,1,'取消訂閱'),/其他操作更新/);assert.equal(stored.data.mailStatus,'退件');console.log('PASS: mail matching, ambiguity, duplicate rows, repeat imports, state changes, preservation and concurrent-update guard')})().catch(e=>{console.error(e);process.exitCode=1});

})();
(function(){
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const s=fs.readFileSync('index.html','utf8');const context={historyData:[],ContactHistoryTools:require("../contact-history-tools.js")};vm.createContext(context);
vm.runInContext(s.slice(s.indexOf('function normalizeExhibitionMonth'),s.indexOf('async function fetchAllReportRows'))+s.slice(s.indexOf('function sharedEntryList'),s.indexOf('function renderSharedHistory')),context);
for(const value of ['2026-8月','2026/8','2026年8月','２０２６-８月','2026-08-21'])assert.equal(context.normalizeExhibitionMonth(value),'2026-08');
for(const value of ['',null,'2026-0','2026-13','2026-123','unknown'])assert.equal(context.normalizeExhibitionMonth(value),'');
assert.equal(context.sharedEntryList({date:'2026-8月'},'exhibitions')[0].date,'2026-08-01');assert.equal(context.sharedEntryList({date:'2026-8月',contactDate:'2026-09-05'},'exhibitions')[0].date,'2026-09-05');
const rows=[{date:'2026-8月'},{date:'2026-10'},{date:'2026年8月'}];assert.equal(context.filterRangeRows(rows,'exhibitions',{start:'2026-08-15',end:'2026-08-20',basis:'business'}).length,2);
console.log('PASS: legacy exhibition months, full-width input, invalid months, history dates and monthly range filters');

})();
(function(){
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const html=fs.readFileSync('index.html','utf8');
const config=html.slice(html.indexOf('const outreachConfig='),html.indexOf('function renderForeignEmailExcelPreview'));
const exportSource=html.slice(html.indexOf('function outreachExportRows('),html.indexOf('function outreachDownloadCsv('));
const tables={exhibitions:[{company:'甲',mailStatus:'取消訂閱',email:'a@example.com',notes:'保留備註',recorder:'測試員'}],foreignEmail:[{company:'乙',emails:[{name:'Alice',email:'b@example.com',position:'採購'},{name:'Bob',email:'c@example.com',position:'業務'}],mailStatus:'',date:'2026-10-29'}],prospecting:[]};
const context={getOutreachRows:key=>tables[key],$:()=>({value:''})};vm.createContext(context);vm.runInContext(config+exportSource+';this.exportRows=outreachExportRows;',context);
const e=context.exportRows('exhibitions');assert.equal(e[0]['狀態'],'取消訂閱');assert.equal(e[0]['紀錄者'],'測試員');assert.equal(e[0]['備註'],'保留備註');const cols=Object.keys(e[0]);assert.equal(cols.indexOf('狀態')+1,cols.indexOf('紀錄者'));
assert.equal(context.exportRows('foreignEmail')[0]['聯絡人姓名／職位／Email'],'Alice／採購／b@example.com；Bob／業務／c@example.com');assert.equal(context.exportRows('prospecting').length,0);
context.$=()=>({value:'missing'});assert.equal(context.exportRows('foreignEmail').length,0);context.$=()=>({value:'乙'});assert.equal(context.exportRows('foreignEmail').length,1);
console.log('PASS: exhibition status export order, preserved fields, multiple email roles, filtering and empty exports');

})();

(function(){
const assert=require('node:assert/strict');require('../exhibition-mail-status.js');const api=global.ExhibitionMailStatus,xlsx={utils:{sheet_to_json:s=>s}};
for(const header of ['電子信箱','電子\n信箱','\uFEFF電子信箱\u200B','Email','Mail','E-mail Address']){
 for(const prefix of [[],[[],['報表說明']]]){
  const wb={SheetNames:['Sheet1'],Sheets:{Sheet1:[...prefix,[header,'Created Date'],['info@preferredproductsdesign.com','Oct 07 2026,']]}};
  const rows=api.readEmailWorkbook(wb,xlsx);assert.deepEqual(rows[0].emails,['info@preferredproductsdesign.com']);assert.equal(rows[0].line,prefix.length+2);
 }
}
console.log('PASS status workbook email headers, screenshot address, hidden characters, title rows and original line numbers');
})();
