const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {normalize,findCompanies}=require('../home-company-search.js');
assert.equal(normalize(' ＡＢＣ 有限公司 '),'abc有限公司');
const domestic=[{id:1,company_name:'ABC 有限公司'},{id:2,company_name:'其他公司'}];
const outreach=['foreignEmail','exhibitions','prospecting'].map((category,id)=>({id,category,data:{company:'Abc Co',contact:'Alice'}}));
assert.equal(findCompanies(domestic,outreach,' ａｂｃ ').length,4);
assert.equal(findCompanies(domestic,outreach,'其他').length,1);
assert.equal(findCompanies(domestic,outreach,'Alice').length,0);
assert.deepEqual(findCompanies(domestic,outreach,'   '),[]);
assert.equal(findCompanies(domestic,[{category:'unknown',data:{company:'ABC'}}],'ABC').length,1);
const nodes={};function node(id){return nodes[id]??=({innerHTML:'',textContent:'',value:'',disabled:false,handlers:{},attrs:{},querySelector(selector){return node(selector)},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(k,fn){this.handlers[k]=fn},focus(){},scrollIntoView(){}})}
let read=async table=>table==='cold_call_records'?domestic:outreach;
const context={document:{getElementById:()=>({querySelector:()=>({before(){}})}),createElement:()=>node('panel')},currentProfile:{role:'admin'},sb:{auth:{onAuthStateChange(fn){context.authChanged=fn}}},fetchAllReportRows:(...args)=>read(...args),reportFields:key=>key==='domestic'?[['company_name','公司名稱']]:[['company','公司名稱'],['emails','聯絡人姓名／職位／Email']],reportValue:v=>v==null?'':String(v),esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),URL};
vm.createContext(context);vm.runInContext(fs.readFileSync('home-company-search.js','utf8'),context);
(async()=>{
 const input=node('input'),form=node('form'),status=node('[role="status"]'),results=node('.home-company-search-results'),pages=node('nav');
 input.value='ABC';await form.handlers.submit({preventDefault(){}});assert.match(status.textContent,/4 筆/);assert.match(results.innerHTML,/<summary>/);assert.match(results.innerHTML,/國內電訪/);
 read=async table=>table==='cold_call_records'?Array.from({length:25},(_,id)=>({id,company_name:'ABC <script>alert(1)</script>',notes:'<img onerror=attack>'})):[];
 await form.handlers.submit({preventDefault(){}});assert.equal((results.innerHTML.match(/<details/g)||[]).length,20);assert.match(pages.innerHTML,/第 1／2/);assert.ok(!results.innerHTML.includes('<script>'));assert.match(results.innerHTML,/&lt;script&gt;/);
 pages.handlers.click({target:{closest:()=>({dataset:{searchPage:'1'}})}});assert.equal((results.innerHTML.match(/<details/g)||[]).length,5);
 read=async()=>{throw new Error('offline')};await form.handlers.submit({preventDefault(){}});assert.match(status.textContent,/搜尋失敗/);assert.equal(results.innerHTML,'');assert.equal(node('[type="submit"]').disabled,false);
 const resolvers=[];read=()=>new Promise(r=>resolvers.push(r));const pending=form.handlers.submit({preventDefault(){}});node('[data-search-clear]').handlers.click();resolvers.forEach(r=>r([]));await pending;
 assert.equal(results.innerHTML,'');assert.equal(input.value,'');
 context.authChanged('SIGNED_OUT');assert.equal(results.innerHTML,'');
 console.log('PASS company matching, four categories, full-width input, escaped detail markup, pagination, failure, clear and sign-out');
})().catch(error=>{console.error(error);process.exitCode=1});
