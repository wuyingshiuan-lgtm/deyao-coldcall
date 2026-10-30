/* Excel 聯繫歷史批次匯入：只新增後續歷史，不建立或覆蓋客戶 */
(function(){
const CATS={domestic:"國內電訪",foreignEmail:"國外 Email",exhibitions:"國內外展覽",prospecting:"陌生開發拜訪"};
const RESULTS=["未接","已聯絡","待回覆","已寄送資料","暫無需求","已寄信","已寄回信","已回覆","可約拜訪","待追蹤","未回覆","無效 Email","有興趣","已報價","持續洽談","無需求","其他"];
const $b=id=>document.getElementById(id), norm=s=>String(s||"").normalize("NFKC").replace(/\s+/g,"").toLowerCase();
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let candidates=[],busy=false;
const style=document.createElement("style");style.textContent='.bulk-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:20px 0}.bulk-choice{background:#f8fbff;border:1px solid #d9e5f4;border-radius:14px;padding:28px 16px;text-align:center;cursor:pointer;min-width:0;color:#172c4c}.bulk-choice:hover,.bulk-choice:focus-visible{border-color:#4383d8;background:#edf5ff}.bulk-choice svg{display:block;margin:auto auto 12px;width:28px;height:28px}.bulk-choice strong{display:block;font-size:19px}.bulk-choice small{display:block;color:#68798b;margin-top:8px}.bulk-table-wrap{max-width:100%;overflow-x:auto}.bulk-table{width:100%;border-collapse:collapse;font-size:13px}.bulk-table td,.bulk-table th{padding:9px;border-bottom:1px solid #e0e7ef;text-align:left}.bulk-table select{min-width:180px}.bulk-note{color:#5c7089;font-size:13px}.bulk-pill{display:inline-block;border-radius:7px;padding:3px 7px;background:#e8f5e9;color:#1c722d}.bulk-warn{background:#fff2d8;color:#8a5310}.bulk-error{background:#ffeded;color:#a42828}@media(max-width:620px){.bulk-choices{grid-template-columns:1fr}}';document.head.appendChild(style);
const responsiveStyle=document.createElement("style");
responsiveStyle.textContent=`
#bulkHistorySection{max-width:100%;min-width:0}
#bulkHistorySection .history-page-head{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
#bulkHistorySection h2{margin:0;font-size:clamp(21px,2.2vw,28px)}
.bulk-choice{min-height:190px;border-radius:20px;box-shadow:0 8px 24px #3153a410;transition:background .2s,box-shadow .2s}
.bulk-choice:first-child{background:linear-gradient(135deg,#eff9f6,#fff);color:#187559;border-color:#bee1d4}
.bulk-choice:last-child{background:linear-gradient(135deg,#edf5ff,#fff);color:#2566af}
.bulk-choice:hover{box-shadow:0 10px 28px #3153a425}
.bulk-choice:disabled{opacity:.6;cursor:wait}
.bulk-table-wrap{overflow:visible;min-width:0}
.bulk-table{table-layout:fixed}
.bulk-table td,.bulk-table th{overflow-wrap:anywhere;white-space:normal;vertical-align:top}
.bulk-table select{min-width:0;max-width:100%;font-size:13px}
#bulkStatus{white-space:pre-wrap;padding:12px 0;overflow-wrap:anywhere}
@media(max-width:1100px){
 .bulk-table,.bulk-table tbody{display:block;width:100%}
 .bulk-table thead{display:none}
 .bulk-table tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px;border:1px solid #d9e5f4;border-radius:14px;margin:12px 0;padding:14px;background:#f8fbff}
 .bulk-table td{display:block;border:0;padding:0;min-width:0}
 .bulk-table td:before{content:attr(data-label);display:block;font-size:12px;font-weight:700;color:#657c9b;margin-bottom:4px}
 .bulk-table td:last-child{grid-column:1/-1}
}
@media(max-width:620px){.bulk-choice{min-height:160px}.bulk-table tr{grid-template-columns:1fr}}
`;
document.head.appendChild(responsiveStyle);
const home=document.querySelector("#homeSection .home-links");
if(home){const a=document.createElement("a");a.href="#bulkHistory";a.setAttribute("aria-label","Excel 批次匯入聯繫紀錄");a.className="home-feature home-feature-4 admin-excel";a.innerHTML='<span class="home-feature-top"><span class="home-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 9h18M9 9v12m6-12v12M3 15h18"/></svg></span><span class="home-feature-category">聯繫管理</span></span><strong>Excel 批次匯入聯繫紀錄</strong><span class="home-feature-description">一次新增多位客戶的後續聯繫歷史</span><span class="home-feature-action">批次匯入<span aria-hidden="true">↗</span></span>';home.appendChild(a);}
const main=document.querySelector("main.wrap");
const section=document.createElement("section");section.id="bulkHistorySection";section.className="box hidden";section.innerHTML='<div class="history-page-head"><button class="btn" type="button" id="bulkBack">← 返回首頁</button><h2>Excel 批次匯入聯繫紀錄</h2></div><p class="bulk-note">支援五欄範本，或含「電子信箱」的 Excel。匯入後可逐筆選擇聯繫日期及聯繫結果，也可整批套用。Email 模式會比對各分頁客戶的所有信箱，預設結果為「已寄回信」，Created Date 只取日期。多位符合時請選擇客戶；找不到及重複紀錄會略過。只新增聯繫歷史，保留原有資料。</p><div class="bulk-choices"><button type="button" class="bulk-choice" id="bulkTemplate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg><strong>下載 Excel 範本</strong><small>含分頁及聯繫結果下拉選單</small></button><button type="button" class="bulk-choice" id="bulkUpload"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21V9m-5 5 5-5 5 5M4 7V4h16v3"/></svg><strong>匯入 Excel 資料</strong><small>自動分配至對應公司</small></button></div><input id="bulkFile" class="hidden" type="file" accept=".xlsx,.xls"><div id="bulkStatus" role="status" aria-live="polite" class="bulk-note"></div><div id="bulkPreview" class="hidden"><h3>匯入前確認</h3><p class="bulk-note">以下日期與結果只會新增到後續聯繫歷史，保留第一次聯繫的日期、結果及原始資料。</p><div class="batch-tools"><div><label for="bulkFallbackDate">整批聯繫日期</label><input id="bulkFallbackDate" type="date"></div><div><label for="bulkBatchResult">整批聯繫結果</label><select id="bulkBatchResult"><option value="">請選擇</option></select></div><button type="button" class="btn" id="bulkApply">套用至全部預覽資料</button></div><p id="bulkSummary"></p><div class="bulk-table-wrap"><table class="bulk-table"><thead><tr><th>列</th><th>分頁</th><th>日期</th><th>公司</th><th>備註</th><th>結果</th><th>檢查結果／處理</th></tr></thead><tbody id="bulkRows"></tbody></table></div><div class="actions"><button type="button" class="btn primary" id="bulkConfirm">確認新增可匯入資料</button><button type="button" class="btn" id="bulkReset">清除預覽</button></div></div>';
const before=document.getElementById("rangeReportSection");main.insertBefore(section,before||main.firstChild);
pages.bulkHistory="bulkHistorySection";
// Register before the first signed-in navigation, including direct links.
showPage();
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
$b("bulkUpload").onclick=()=>{if(!busy)$b("bulkFile").click();};
function formatDate(v){
 if(v instanceof Date && !isNaN(v))return [v.getFullYear(),String(v.getMonth()+1).padStart(2,"0"),String(v.getDate()).padStart(2,"0")].join("-");
 if(typeof v==="number"){const o=XLSX.SSF.parse_date_code(v);if(o)return [o.y,String(o.m).padStart(2,"0"),String(o.d).padStart(2,"0")].join("-");}
 const s=String(v||"").trim().replace(/\//g,"-");if(!/^\d{4}-\d{1,2}-\d{1,2}$/.test(s))return "";
 const [y,m,d]=s.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?[y,String(m).padStart(2,"0"),String(d).padStart(2,"0")].join("-"):"";
}
function emailList(row){
 const values=[row.email,row.mail,...(Array.isArray(row.emails)?row.emails:[])];
 return [...new Set(values.flatMap(v=>String(v&&typeof v==="object"?v.email||v.mail||"":v||"").split(/[;,；，\s]+/)).map(v=>v.trim().toLowerCase()).filter(Boolean))];
}
function createdDate(v){
 if(typeof v!=="string")return formatDate(v);
 const m=v.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})(?:,|$|\s)/);
 if(m){const month=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[1].toLowerCase())+1;return month?formatDate(m[3]+"-"+month+"-"+m[2]):"";}
 return formatDate(v.trim().replace(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})[ T].*$/,"$1"));
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
 c.duplicate=false;c.matches=[];c.target=null;
 if((!c.emailMode&&!c.key)||!c.date||!(c.emailMode?c.email:c.company)||!c.result){c.issue="欄位缺漏或日期／分頁不正確";return;}
 if(!RESULTS.includes(c.result)){c.issue="聯繫結果不在範本選項內";return;}
 const matches=c.emailMode?Object.entries(groups).flatMap(([key,rows])=>rows.filter(x=>emailList(x.row).includes(c.email)).map(x=>({...x,key}))):groups[c.key].map(x=>({...x,key:c.key})).filter(x=>norm(x.row.company_name||x.row.company)===norm(c.company));c.matches=matches;
 if(matches.length===0){c.issue=c.emailMode?"找不到此 Email 的客戶（略過，不會建立新客戶）":"找不到公司（不會建立新客戶）";c.target=null;return;}
 if(matches.length>1&&!matches.some(x=>x.key+":"+x.id===c.chosen)){c.issue=c.emailMode?"Email 對應多位客戶：請選擇正確客戶":"同名公司：請選擇正確客戶";c.target=null;return;}
 c.target=matches.find(x=>x.key+":"+x.id===c.chosen)||matches[0];c.key=c.target.key;if(c.emailMode)c.company=c.target.row.company_name||c.target.row.company||"未命名公司";
 const sig=signature(c.date,c.result,c.notes);
 const existing=signatures(c.target,c.key).includes(sig);
 const another=candidates.some(other=>other!==c&&other.key===c.key&&other.target&&String(other.target.id)===String(c.target.id)&&signature(other.date,other.result,other.notes)===sig&&other.index<c.index);
 c.issue=(existing||another)?"疑似重複聯繫（預設略過）":"";c.duplicate=existing||another;
}
let cloudGroups=null;
function renderPreview(){
 candidates.forEach(c=>checkOne(c,cloudGroups));
 const valid=candidates.filter(c=>c.target&&!c.issue),bad=candidates.length-valid.length;
 $b("bulkSummary").textContent="共 "+candidates.length+" 筆｜可新增 "+valid.length+" 筆｜需處理或略過 "+bad+" 筆。";
 $b("bulkRows").innerHTML=candidates.map(c=>{
 let msg=c.issue||"可新增為後續聯繫紀錄",cls=c.issue?"bulk-warn":"bulk-pill";
 if(!c.matches?.length)cls="bulk-error";
 let controls="";
 if(c.matches?.length>1){controls='<select data-pick="'+c.index+'"><option value="">請選擇正確客戶</option>'+c.matches.map(m=>'<option value="'+escapeHtml(m.key+":"+m.id)+'" '+(c.chosen===m.key+":"+m.id?"selected":"")+'>'+escapeHtml(CATS[m.key])+'｜'+escapeHtml(m.row.company_name||m.row.company||'未命名公司')+'｜'+escapeHtml(m.row.contact_name||m.row.contactName||m.row.address||m.row.company_address||m.id)+'</option>').join("")+"</select>";}
 return '<tr><td data-label="Excel 列">'+escapeHtml(c.sheet)+"／"+c.excelRow+'</td><td data-label="分頁屬性">'+escapeHtml(CATS[c.key]||c.rawCategory)+'</td><td data-label="聯繫日期">'+'<input type="date" data-edit-date="'+c.index+'" value="'+escapeHtml(c.date)+'" '+(busy?'disabled':'')+' aria-label="第 '+c.excelRow+' 列聯繫日期">'+'</td><td data-label="公司名">'+escapeHtml(c.company)+(c.emailMode?"<br><small>"+escapeHtml(c.email)+"</small>":"")+'</td><td data-label="備註">'+escapeHtml(c.notes||"—")+'</td><td data-label="聯繫結果">'+'<select data-edit-result="'+c.index+'" '+(busy?'disabled':'')+' aria-label="第 '+c.excelRow+' 列聯繫結果"><option value="">請選擇</option>'+RESULTS.map(result=>'<option value="'+escapeHtml(result)+'" '+(c.result===result?'selected':'')+'>'+escapeHtml(result)+'</option>').join('')+'</select>'+'</td><td data-label="檢查結果／處理"><span class="'+cls+'">'+escapeHtml(msg)+'</span> '+controls+'</td></tr>';
 }).join("");
 $b("bulkPreview").classList.remove("hidden");
 $b("bulkConfirm").disabled=busy||valid.length===0;
}
$b("bulkRows").addEventListener("change",e=>{
 if(busy)return;
 const dateIndex=e.target.dataset.editDate,resultIndex=e.target.dataset.editResult;
 if(dateIndex!==undefined){const c=candidates.find(c=>c.index===Number(dateIndex));if(c)c.date=formatDate(e.target.value);}
 if(resultIndex!==undefined){const c=candidates.find(c=>c.index===Number(resultIndex));if(c)c.result=RESULTS.includes(e.target.value)?e.target.value:"";}
 const pick=e.target.dataset.pick;
 if(pick!==undefined){const candidate=candidates.find(c=>c.index===Number(pick));if(candidate)candidate.chosen=e.target.value;}
 renderPreview();
});
function readBulkWorkbook(wb){
 const aliases={
  "分頁屬性":["分頁屬性","分頁","分類","category"],
  "聯繫日期":["聯繫日期","聯絡日期","contact date"],
  "公司名":["公司名","公司名稱","company","company name"],
  "備註":["備註","備註說明","notes","remark"],
  "聯繫結果":["聯繫結果","聯絡結果","result"],
  "電子信箱":["電子信箱","電子郵件","電子郵箱","email","e-mail","email address","mail"],
  "Created Date":["Created Date","CreatedDate","created_date","建立日期","建立時間","創建日期"]
 };
 const headerKey=value=>norm(value).replace(/[\u200B-\u200D\uFEFF_-]/g,"");
 const lookup=new Map(Object.entries(aliases).flatMap(([label,names])=>names.map(name=>[headerKey(name),label])));
 const entries=[],found=[];
 for(const sheetName of wb.SheetNames){
  const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:"",blankrows:true});
  let headerIndex=-1,headers=[],emailMode=false;
  for(let i=0;i<matrix.length;i++){
   const labels=matrix[i].map(value=>lookup.get(headerKey(value))||"");
   const email=labels.includes("電子信箱");
   const template=["分頁屬性","聯繫日期","公司名","聯繫結果"].every(label=>labels.includes(label));
   if(email||template){headerIndex=i;headers=labels;emailMode=email;break;}
  }
  if(headerIndex<0){if(matrix.length)found.push(sheetName+"："+matrix.slice(0,3).map(row=>row.filter(Boolean).join("、")).join("／").slice(0,180));continue;}
  matrix.slice(headerIndex+1).forEach((cells,index)=>{
   if(!cells.some((value,j)=>headers[j]&&String(value??"").trim()))return;
   const row={};headers.forEach((label,j)=>{if(label)row[label]=cells[j]??"";});
   entries.push({row,emailMode,sheet:sheetName,excelRow:headerIndex+index+2});
  });
 }
 if(!entries.length)throw Error("未找到可匯入的聯繫紀錄。請提供「電子信箱／Email＋Created Date」，或「分頁屬性、聯繫日期、公司名、聯繫結果」（備註可省略）。這是新增聯繫歷史功能；新增客戶名單請到國外 Email 的匯入頁面。"+(found.length?"\\n讀到的工作表／欄位："+found.join("；"):""));
 return entries;
}
$b("bulkFile").onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
 if(currentProfile?.role!=="admin")throw Error("只有管理員可以匯入。");
 if(!window.XLSX)throw Error("Excel 讀取元件尚未載入，請重新整理。");
 status("正在讀取 Excel 與最新雲端客戶資料…");$b("bulkPreview").classList.add("hidden");
 const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}),entries=readBulkWorkbook(wb);
 if(entries.length>2000)throw Error("單次最多匯入 2,000 筆。");
 candidates=entries.map(({row:r,emailMode,sheet,excelRow},i)=>({...emailMode?({emailMode:true,email:String(r["電子信箱"]||"").trim().toLowerCase(),key:"",rawCategory:"依 Email 配對",date:createdDate(r["Created Date"]),needsDate:!String(r["Created Date"]??"").trim(),company:String(r["公司名"]||"").trim(),notes:"",result:"已寄回信",chosen:""}):({key:categoryOf(r["分頁屬性"]),rawCategory:r["分頁屬性"],date:formatDate(r["聯繫日期"]),company:String(r["公司名"]||"").trim(),notes:String(r["備註"]||"").trim(),result:String(r["聯繫結果"]||"").trim(),chosen:"",allowDuplicate:false,duplicate:false}),index:i,sheet,excelRow}));
 cloudGroups=await allCloudRows();renderPreview();status(candidates.some(c=>c.needsDate&&!c.date)?"已讀取 "+candidates.length+" 筆。此名單缺少 Created Date，請在預覽選擇聯繫日期，或使用整批套用。":"已完成雲端比對；請確認檢查結果，再按新增。");
 }catch(err){status("匯入檢查失敗："+err.message);}finally{e.target.value="";}
};
RESULTS.forEach(result=>{const option=document.createElement("option");option.value=result;option.textContent=result;$b("bulkBatchResult").appendChild(option);});
$b("bulkApply").onclick=()=>{
 if(busy)return;
 const date=formatDate($b("bulkFallbackDate").value),result=$b("bulkBatchResult").value;
 if(!date&&!result){status("請先選擇要整批套用的日期或聯繫結果。");return;}
 candidates.forEach(c=>{if(date)c.date=date;if(result)c.result=result;});
 if(candidates.length&&cloudGroups)renderPreview();
 status("已套用至預覽資料，尚未儲存；請確認後再按新增。");
};
$b("bulkReset").onclick=()=>{if(busy)return;candidates=[];$b("bulkPreview").classList.add("hidden");status("");};
async function saveOne(c){
 c.entryId ||= crypto.randomUUID();
 const saved=await ContactHistoryTools.append(sb,c.key,c.target.id,{id:c.entryId,date:c.date,result:c.result,notes:c.notes});
 return saved.status==="saved"?"saved":"skip";
}
$b("bulkConfirm").onclick=async()=>{
 if(busy||currentProfile?.role!=="admin")return;
 const selected=candidates.filter(c=>c.target&&!c.issue).map(c=>({...c}));
 if(!selected.length)return;
 if(!await appConfirm("確定新增 "+selected.length+" 筆聯繫紀錄至雲端？此操作不會覆蓋原有資料。"))return;
 busy=true;["bulkConfirm","bulkReset","bulkUpload","bulkApply","bulkFallbackDate","bulkBatchResult"].forEach(id=>$b(id).disabled=true);
 renderPreview();
 let saved=0,skipped=0,failed=[];
 for(const c of selected){
 status("正在寫入雲端 "+(saved+skipped+failed.length+1)+" / "+selected.length+"…");
 try{const result=await saveOne(c);if(result==="saved")saved++;else skipped++;}
 catch(err){failed.push("Excel "+c.sheet+" 第 "+c.excelRow+" 列："+err.message);}
 }
 try{cloudGroups=await allCloudRows();data=cloudGroups.domestic.map(x=>x.row);historyData=cloudGroups.domestic.flatMap(x=>x.histories);render();await loadOutreachCloud();}catch(err){failed.push("重新讀取雲端失敗："+err.message);}
 busy=false;["bulkReset","bulkUpload","bulkApply","bulkFallbackDate","bulkBatchResult"].forEach(id=>$b(id).disabled=false);
 const done=new Set(selected.filter(c=>!failed.some(x=>x.startsWith("Excel "+c.sheet+" 第 "+c.excelRow+" 列："))).map(c=>c.index));
 candidates=candidates.filter(c=>!done.has(c.index));
 if(candidates.length)renderPreview();else $b("bulkPreview").classList.add("hidden");
 status("匯入完成：成功 "+saved+" 筆、重複略過 "+skipped+" 筆、失敗 "+failed.length+" 筆。"+(failed.length?"\n"+failed.join("\n"):"")+" 原有客戶及首次聯繫紀錄未修改。");
 if(saved>0)appNotice("✓ 聯繫紀錄匯入成功 "+saved+" 筆；重複略過 "+skipped+" 筆、失敗 "+failed.length+" 筆。");
};
})();
