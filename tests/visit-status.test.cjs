const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');require('../customer-import.js');
for(const [input,expected] of [[undefined,null],['',null],['待評估',null],['pending',null],['適合',true],['不適合',false],[true,true],[false,false],['TRUE',true],['FALSE',false],['是',true],['否',false]])assert.equal(CustomerImport.visitValue(input),expected);
assert.equal(CustomerImport.visitLabel(null),'待評估');assert.equal(CustomerImport.visitKey(null),'pending');assert.throws(()=>CustomerImport.visitValue('錯誤值'),/請選擇/);
const html=fs.readFileSync('index.html','utf8'),config=html.slice(html.indexOf('const outreachConfig='),html.indexOf('};',html.indexOf('const outreachConfig='))+2),mapper=html.slice(html.indexOf('function mapOutreachImport'),html.indexOf('document.querySelectorAll("[data-outreach-file]"')),domestic=html.slice(html.indexOf('function mapDomesticImport'),html.indexOf('$("importFile").onchange='));
const c={CustomerImport,detectCity:()=>'',today:()=> '2026-10-30',currentProfile:{name:'測試'},XLSX:{utils:{sheet_to_json:s=>s}}};vm.createContext(c);vm.runInContext(config+mapper+domestic+fs.readFileSync('customer-import-preview.js','utf8'),c);
for(const [value,expected] of [['',null],['待評估',null],['適合',true],['不適合',false]]){
 const row={'公司名稱':'測試','是否適合拜訪':value};assert.equal(c.mapDomesticImport([row])[0].visit_suitable,expected);assert.equal(c.mapOutreachImport([row],'exhibitions')[0].visitSuitable,expected===null?'pending':String(expected));
}
assert.equal(c.mapDomesticImport([{'公司名稱':'測試','Email':'a@example.com','是否已寄送Mail':'FALSE'}])[0].mail_sent,false);
assert.equal(c.mapDomesticImport([{'公司名稱':'測試','是否已寄送Mail':'TRUE'}])[0].mail_sent,true);
const entries=c.customerImportStage({SheetNames:['範本'],Sheets:{範本:[['公司名稱','是否已寄送Mail','是否適合拜訪'],['','FALSE','待評估'],['填寫公司','TRUE',''],['','FALSE','待評估']]}});assert.equal(entries.length,1);assert.equal(entries[0].row,3);assert.equal(c.validateCustomerImport(entries,new Map(),'domestic').length,1);
entries[0].fields[2].value='無效';assert.equal(c.validateCustomerImport(entries,new Map(),'domestic').length,0);
assert.match(html,/data-visit="pending"/);assert.match(html,/data-exhibition-visit="pending"/);assert.ok(!html.includes('r.visit_suitable?'));
console.log('PASS tri-state parsing, blank default, domestic nullable boolean, exhibition pending, real checkbox strings, blank template row skipping and invalid-status rejection');
