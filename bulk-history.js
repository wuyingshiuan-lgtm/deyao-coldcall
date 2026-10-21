/* Excel 聯繫歷史批次匯入：只新增後續歷史，不建立或覆蓋客戶 */
(function(){
const CATS={domestic:"國內電訪",foreignEmail:"國外 Email",exhibitions:"國內外展覽",prospecting:"陌生開發拜訪"};
const RESULTS=["未接","已聯絡","待回覆","已寄送資料","暫無需求","已寄信","已回覆","可約拜訪","待追蹤","未回覆","無效 Email","有興趣","已報價","持續洽談","無需求","其他"];
const $b=id=>document.getElementById(id), norm=s=>String(s||"").normalize("NFKC").replace(/\s+/g,"").toLowerCase();
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let candidates=[],busy=false;
const style=document.createElement("style");style.textContent='.bulk-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:20px 0}.bulk-choice{background:#f8fbff;border:1px solid #d9e5f4;border-radius:14px;padding:28px 16px;text-align:center;cursor:pointer;min-width:0;color:#172c4c}.bulk-choice:hover,.bulk-choice:focus-visible{border-color:#4383d8;background:#edf5ff}.bulk-choice svg{display:block;margin:auto auto 12px;width:28px;height:28px}.bulk-choice strong{display:block;font-size:19px}.bulk-choice small{display:block;color:#68798b;margin-top:8px}.bulk-table-wrap{max-width:100%;overflow-x:auto}.bulk-table{width:100%;border-collapse:collapse;font-size:13px}.bulk-table td,.bulk-table th{padding:9px;border-bottom:1px solid #e0e7ef;text-align:left}.bulk-table select{min-width:180px}.bulk-note{color:#5c7089;font-size:13px}.bulk-pill{display:inline-block;border-radius:7px;padding:3px 7px;background:#e8f5e9;color:#1c722d}.bulk-warn{background:#fff2d8;color:#8a5310}.bulk-error{background:#ffeded;color:#a42828}@media(max-width:620px){.bulk-choices{grid-template-columns:1fr}}';document.head.appendChild(style);
const home=document.querySelector("#homeSection .home-links");
if(home){const a=document.createElement("a");a.href="#bulkHistory";a.className="home-feature home-feature-4 admin-excel";a.innerHTML='<span class="home-feature-top"><span class="home-feature-icon" aria-hidden="true">▦</span><span class="home-feature-category">聯繫管理</span></span><strong>Excel 批次匯入聯繫紀錄</strong><span class="home-feature-description">一次新增多位客戶的後續聯繫歷史</span><span class="home-feature-action">批次匯入 ↗</span>';home.appendChild(a);}
const main=document.querySelector("main.wrap");
const section=document.createElement("section");section.id="bulkHistorySection";section.className="box hidden";section.innerHTML='<div class="history-page-head"><button class="btn" type="button" id="bulkBack">← 返回首頁</button><h2>Excel 批次匯入聯繫紀錄</h2></div><p class="bulk-note">下載五欄 Excel 範本後填寫，依「分頁屬性＋公司名」自動對應既有客戶。匯入只會新增聯繫歷史，不會更改客戶資料。</p><div class="bulk-choices"><button type="button" class="bulk-choice" id="bulkTemplate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg><strong>下載 Excel 範本</strong><small>含分頁及聯繫結果下拉選單</small></button><button type="button" class="bulk-choice" id="bulkUpload"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21V9m-5 5 5-5 5 5M4 7V4h16v3"/></svg><strong>匯入 Excel 資料</strong><small>自動分配至對應公司</small></button></div><input id="bulkFile" class="hidden" type="file" accept=".xlsx,.xls"><div id="bulkStatus" role="status" aria-live="polite" class="bulk-note"></div><div id="bulkPreview" class="hidden"><h3>匯入前確認</h3><p id="bulkSummary"></p><div class="bulk-table-wrap"><table class="bulk-table"><thead><tr><th>列</th><th>分頁</th><th>日期</th><th>公司</th><th>結果</th><th>檢查結果／處理</th></tr></thead><tbody id="bulkRows"></tbody></table></div><div class="actions"><button type="button" class="btn primary" id="bulkConfirm">確認新增可匯入資料</button><button type="button" class="btn" id="bulkReset">清除預覽</button></div></div>';
const before=document.getElementById("rangeReportSection");main.insertBefore(section,before||main.firstChild);
pages.bulkHistory="bulkHistorySection";
const oldRestricted=["rangeStats","rangeExcel","stats","excel","accounts","exhibitionsStats","exhibitionsExcel","prospectingStats","prospectingExcel"];
window.addEventListener("hashchange",()=>{if(location.hash==="#bulkHistory"&&currentProfile?.role!=="admin"){location.hash="home";showPage();}});
$b("bulkBack").onclick=()=>{location.hash="home";showPage();};
const status=msg=>{$b("bulkStatus").textContent=msg;};
async function ensureExcelJS(){
 if(window.ExcelJS)return window.ExcelJS;
 await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";s.onload=resolve;s.onerror=()=>reject(new Error("Excel 範本元件載入失敗，請確認網路後重試"));document.head.appendChild(s)});
 if(!window.ExcelJS)throw Error("無法啟動 Excel 範本");return window.ExcelJS;
}
$b("bulkTemplate").onclick=async()=>{
 try{
 status("正在建立 Excel 範本…");
 const ExcelJS=await ensureExcelJS(),wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet("聯繫紀錄");
 sheet.columns=[{header:"分頁屬性",key:"category",width:22},{header:"聯繫日期",key:"date",width:20},{header:"公司名",key:"company",width:34},{header:"備註",key:"notes",width:60},{header:"聯繫結果",key:"result",width:22}];
 sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF315CA0"}};sheet.views=[{state:"frozen",ySplit:1}];
 const choices=Object.values(CATS),all=RESULTS;
 for(let i=2;i<=1001;i++){sheet.getCell("A"+i).dataValidation={type:"list",allowBlank:true,formulae:['"'+choices.join(",")+'"']};sheet.getCell("E"+i).dataValidation={type:"list",allowBlank:true,formulae:['"'+all.join(",")+'"']};sheet.getCell("B"+i).numFmt="yyyy/mm/dd";}
 const help=wb.addWorksheet("填寫說明");help.addRow(["一列代表一筆後續聯繫，分頁屬性與聯繫結果請從下拉式選單選擇。"]);help.addRow(["公司名必須與系統內該分頁的名稱一致；同名公司需匯入時確認。"]);help.addRow(["聯繫日期請使用 Excel 日期格式或 YYYY/MM/DD。"]);help.getColumn(1).width=100;
 const buf=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
 const a=document.createElement("a");a.href=url;a.download="德曜_批次聯繫紀錄範本.xlsx";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status("已產生 Excel 範本（五欄、含下拉選單）。");
 }catch(e){status("無法下載："+e.message);}
};
$b("bulkUpload").onclick=()=>$b("bulkFile").click();
function formatDate(v){
 if(v instanceof Date && !isNaN(v))return [v.getFullYear(),String(v.getMonth()+1).padStart(2,"0"),String(v.getDate()).padStart(2,"0")].join("-");
 if(typeof v==="number"){const o=XLSX.SSF.parse_date_code(v);if(o)return [o.y,String(o.m).padStart(2,"0"),String(o.d).padStart(2,"0")].join("-");}
 const s=String(v||"").trim().replace(/\//g,"-");if(!/^\d{4}-\d{1,2}-\d{1,2}$/.test(s))return "";
 const [y,m,d]=s.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?[y,String(m).padStart(2,"0"),String(d).padStart(2,"0")].join("-"):"";
}
function categoryOf(v){return Object.keys(CATS).find(k=>norm(CATS[k])===norm(v)||k===String(v).trim()||(k==="foreignEmail"&&norm(v)==="國外email"))||"";}
async function allCloudRows(){
 const [parents,histories,outreach]=await Promise.all([fetchAllReportRows("cold_call_records","*",null),fetchAllReportRows("cold_call_history","*",null),fetchAllReportRows("outreach_records","id,category,data",Object.keys(CATS).filter(k=>k!=="domestic"))]);
 return {domestic:parents.map(row=>({id:row.id,row,histories:histories.filter(h=>String(h.record_id)===String(row.id))})),foreignEmail:outreach.filter(x=>x.category==="foreignEmail").map(x=>({id:x.id,row:x.data})),exhibitions:outreach.filter(x=>x.category==="exhibitions").map(x=>({id:x.id,row:x.data})),prospecting:outreach.filter(x=>x.category==="prospecting").map(x=>({id:x.id,row:x.data}))};
}
function signatures(target,key){
 const row=target.row,extras=key==="domestic"?target.histories.map(h=>({date:h.contact_date,notes:h.notes,result:h.contact_result})):key==="foreignEmail"?getForeignEmailHistoryParts(row).followups:(row.contactHistory||[]);
 return extras.map(h=>signature(h.date,h.result,h.notes));
}
const signature=(d,r,n)=>[formatDate(d),norm(r),norm(n)].join("|");
function checkOne(c,groups){
 if(!c.key||!c.date||!c.company||!c.result){c.issue="欄位缺漏或日期／分頁不正確";c.target=null;return;}
 const matches=groups[c.key].filter(x=>norm(x.row.company_name||x.row.company)===norm(c.company));c.matches=matches;
 if(matches.length===0){c.issue="找不到公司（不會建立新客戶）";c.target=null;return;}
 if(matches.length>1&&!c.chosen){c.issue="同名公司：請選擇正確客戶";c.target=null;return;}
 c.target=matches.find(x=>String(x.id)===String(c.chosen))||matches[0];
 const sig=signature(c.date,c.result,c.notes);
 const existing=signatures(c.target,c.key).includes(sig);
 const another=candidates.some(other=>other!==c&&other.key===c.key&&other.target&&String(other.target.id)===String(c.target.id)&&signature(other.date,other.result,other.notes)===sig&&other.index<c.index);
 c.issue=(existing||another)?"疑似重複聯繫（預設略過）":"";c.duplicate=existing||another;
}
let cloudGroups=null;
function renderPreview(){
 candidates.forEach(c=>checkOne(c,cloudGroups));
 const valid=candidates.filter(c=>c.target&&(!c.duplicate||c.allowDuplicate)),bad=candidates.length-valid.length;
 $b("bulkSummary").textContent="共 "+candidates.length+" 筆｜可新增 "+valid.length+" 筆｜需處理或略過 "+bad+" 筆。";
 $b("bulkRows").innerHTML=candidates.map(c=>{
 let msg=c.issue||"可新增為後續聯繫紀錄",cls=c.issue?"bulk-warn":"bulk-pill";
 if(!c.matches?.length)cls="bulk-error";
 let controls="";
 if(c.matches?.length>1){controls='<select data-pick="'+c.index+'"><option value="">請選擇同名公司</option>'+c.matches.map(m=>'<option value="'+escapeHtml(m.id)+'" '+(String(c.chosen)===String(m.id)?"selected":"")+'>'+escapeHtml(m.row.company_name||m.row.company)+'｜'+escapeHtml(m.row.contact_name||m.row.contactName||m.row.address||m.row.company_address||m.id)+'</option>').join("")+"</select>";}
 if(c.duplicate)controls+=' <label style="white-space:nowrap"><input type="checkbox" data-allow="'+c.index+'" '+(c.allowDuplicate?"checked":"")+' style="width:auto">仍要新增</label>';
 return '<tr><td>'+(c.index+2)+'</td><td>'+escapeHtml(CATS[c.key]||c.rawCategory)+'</td><td>'+escapeHtml(c.date)+'</td><td>'+escapeHtml(c.company)+'</td><td>'+escapeHtml(c.result)+'</td><td><span class="'+cls+'">'+escapeHtml(msg)+'</span> '+controls+'</td></tr>';
 }).join("");
 $b("bulkPreview").classList.remove("hidden");
 $b("bulkConfirm").disabled=busy||valid.length===0;
}
$b("bulkRows").addEventListener("change",e=>{
 const pick=e.target.dataset.pick,allow=e.target.dataset.allow;
 if(pick!==undefined)candidates[Number(pick)].chosen=e.target.value;
 if(allow!==undefined)candidates[Number(allow)].allowDuplicate=e.target.checked;
 renderPreview();
});
$b("bulkFile").onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
 if(currentProfile?.role!=="admin")throw Error("只有管理員可以匯入。");
 if(!window.XLSX)throw Error("Excel 讀取元件尚未載入，請重新整理。");
 status("正在讀取 Excel 與最新雲端客戶資料…");$b("bulkPreview").classList.add("hidden");
 const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:""});
 if(!rows.length)throw Error("Excel 無可匯入資料。");
 if(rows.length>2000)throw Error("單次最多匯入 2,000 筆。");
 const heads=["分頁屬性","聯繫日期","公司名","備註","聯繫結果"];if(!heads.every(h=>Object.prototype.hasOwnProperty.call(rows[0],h)))throw Error("Excel 必須包含五個指定欄位。");
 candidates=rows.map((r,i)=>({index:i,key:categoryOf(r["分頁屬性"]),rawCategory:r["分頁屬性"],date:formatDate(r["聯繫日期"]),company:String(r["公司名"]||"").trim(),notes:String(r["備註"]||"").trim(),result:String(r["聯繫結果"]||"").trim(),chosen:"",allowDuplicate:false,duplicate:false}));
 cloudGroups=await allCloudRows();renderPreview();status("已完成雲端比對；請確認檢查結果，再按新增。");
 }catch(err){status("匯入檢查失敗："+err.message);}finally{e.target.value="";}
};
$b("bulkReset").onclick=()=>{candidates=[];$b("bulkPreview").classList.add("hidden");status("");};
async function saveOne(c){
 const id=c.target.id;
 if(c.key==="domestic"){
 const {data:parent,error:pe}=await sb.from("cold_call_records").select("id,visit_date").eq("id",id).single();if(pe)throw pe;
 const {data:hist,error:he}=await sb.from("cold_call_history").select("contact_number,contact_date,contact_result,notes").eq("record_id",id);if(he)throw he;
 if(!c.allowDuplicate&&(hist||[]).some(h=>signature(h.contact_date,h.contact_result,h.notes)===signature(c.date,c.result,c.notes)))return "skip";
 const num=Math.max(parent.visit_date?1:0,...(hist||[]).map(h=>Number(h.contact_number)||0))+1;
 const {error}=await sb.from("cold_call_history").insert({record_id:id,contact_date:c.date,contact_number:num,contact_result:c.result,notes:c.notes,created_by:currentProfile.id});
 if(error)throw error;return "saved";
 }
 const {data:current,error:readErr}=await sb.from("outreach_records").select("id,data").eq("id",id).eq("category",c.key).single();if(readErr)throw readErr;
 const row=current.data||{},history=Array.isArray(row.contactHistory)?row.contactHistory.slice():[];
 const prev=c.key==="foreignEmail"?getForeignEmailHistoryParts(row).followups:history;
 if(!c.allowDuplicate&&prev.some(h=>signature(h.date,h.result,h.notes)===signature(c.date,c.result,c.notes)))return "skip";
 history.push({id:crypto.randomUUID(),date:c.date,result:c.result,notes:c.notes,number:(row.date||row.contactDate?1:0)+prev.length+1,recorder:currentProfile.name||"",createdAt:new Date().toISOString()});
 const {data:saved,error}=await sb.from("outreach_records").update({data:{...row,contactHistory:history}}).eq("id",id).eq("category",c.key).eq("data",JSON.stringify(row)).select("id").maybeSingle();
 if(error)throw error;if(!saved)throw Error("資料已被其他人更新，請重新匯入該筆。");
 return "saved";
}
$b("bulkConfirm").onclick=async()=>{
 if(busy||currentProfile?.role!=="admin")return;
 const selected=candidates.filter(c=>c.target&&(!c.duplicate||c.allowDuplicate));
 if(!selected.length)return;
 if(!confirm("確定新增 "+selected.length+" 筆聯繫紀錄至雲端？此操作不會覆蓋原有資料。"))return;
 busy=true;$b("bulkConfirm").disabled=true;
 let saved=0,skipped=0,failed=[];
 for(const c of selected){
 status("正在寫入雲端 "+(saved+skipped+failed.length+1)+" / "+selected.length+"…");
 try{const result=await saveOne(c);if(result==="saved")saved++;else skipped++;}
 catch(err){failed.push("Excel 第 "+(c.index+2)+" 列："+err.message);}
 }
 try{cloudGroups=await allCloudRows();await Promise.all([loadOutreachCloud(),Promise.resolve()]);}catch(err){failed.push("重新讀取雲端失敗："+err.message);}
 busy=false;
 const done=new Set(selected.filter(c=>!failed.some(x=>x.startsWith("Excel 第 "+(c.index+2)+" 列："))).map(c=>c.index));
 candidates=candidates.filter(c=>!done.has(c.index));
 if(candidates.length)renderPreview();else $b("bulkPreview").classList.add("hidden");
 status("匯入完成：成功 "+saved+" 筆、重複略過 "+skipped+" 筆、失敗 "+failed.length+" 筆。"+(failed.length?"\n"+failed.join("\n"):"")+" 原有客戶及首次聯繫紀錄未修改。");
};
})();