/* Address-based updates use optimistic conditions and preserve unrelated fields. */
function planAddressUpdates(domestic,outreach){
 const tasks=[];let unresolved=0;
 for(const row of domestic){const address=String(row.company_address||'').trim();if(!address)continue;const city=detectCity(address);if(!city){unresolved++;continue}if(row.area!==city)tasks.push({table:'cold_call_records',id:row.id,original:row,city,address,patch:{area:city}})}
 for(const row of outreach){const data=row.data||{};const labelled=String(data.notes||'').match(/(?:^|\n)(?:公司地址|地址)[：:]([^\n]+)/);const address=String(data.address||data.company_address||data['公司地址']||data['地址']||labelled?.[1]||'').trim();if(!address)continue;const city=detectCity(address);if(!city){unresolved++;continue}if(data.region!==city||!data.address)tasks.push({table:'outreach_records',id:row.id,original:row,city,address,patch:{data:{...data,address,region:city}}})}
 return{tasks,unresolved};
}
let addressBackfillBusy=false;
async function backfillCloudRegions(){
 if(addressBackfillBusy||cloudPhoneRegionBusy)return;if(currentProfile?.role!=='admin'){appNotice('此操作僅限管理員執行。');return}
 addressBackfillBusy=true;const panels=[...document.querySelectorAll('[data-address-status]')],buttons=[...document.querySelectorAll('[data-address-backfill]')];buttons.forEach(b=>b.disabled=true);
 const status=text=>panels.forEach(p=>p.textContent=text);status('正在讀取完整雲端資料並辨識地址…');
 try{
 const [domestic,outreach]=await Promise.all([fetchAllReportRows('cold_call_records','*'),fetchAllReportRows('outreach_records','id,category,data,created_at',outreachKeys)]);
 const {tasks,unresolved}=planAddressUpdates(domestic,outreach);let next=0,updated=0,conflicts=0;const errors=[];
 async function worker(){while(next<tasks.length){const task=tasks[next++];try{
 let query=sb.from(task.table).update(task.patch).eq('id',task.id);
 if(task.table==='cold_call_records'){query=query.eq('company_address',task.original.company_address);query=task.original.area==null?query.is('area',null):query.eq('area',task.original.area)}
 else query=query.eq('data',JSON.stringify(task.original.data));
 const {data:saved,error}=await query.select('id');if(error)throw error;if(saved?.length===1)updated++;else conflicts++;
 }catch(error){errors.push({id:task.id,message:error.message})}
 status('縣市辨識更新中：已更新 '+updated+'／'+tasks.length+' 筆；暫未更新 '+(conflicts+errors.length)+' 筆。');}}
 await Promise.all(Array.from({length:Math.min(5,tasks.length)},worker));
 const [verifiedDomestic,verifiedOutreach]=await Promise.all([fetchAllReportRows('cold_call_records','*'),fetchAllReportRows('outreach_records','id,category,data,created_at',outreachKeys)]);
 const remaining=planAddressUpdates(verifiedDomestic,verifiedOutreach).tasks.length;
 await Promise.all([load(),loadOutreachCloud()]);
 const message='本次已更新 '+updated+' 筆縣市區域。\n仍待更新 '+remaining+' 筆；地址無法明確辨識 '+unresolved+' 筆。'+(conflicts?'\n有 '+conflicts+' 筆在執行期間被修改，已保留最新資料，請重新檢查。':'')+(errors.length?'\n有 '+errors.length+' 筆寫入失敗，請稍後重試。':'');
 status(message);panels.forEach(p=>{p.dataset.updated=String(updated);p.dataset.remaining=String(remaining);p.dataset.unresolved=String(unresolved)});
 appNotice(message,{title:remaining||errors.length?'縣市區域更新結果':'縣市區域更新完成',type:remaining||errors.length?'warning':'success'});
 }catch(error){status('縣市區域更新未完成：'+error.message);appNotice('縣市區域更新未完成。\n'+error.message+'\n已完成的更新會保留，可重新執行檢查。',{title:'縣市區域更新未完成',type:'danger'})}
 finally{addressBackfillBusy=false;buttons.forEach(b=>b.disabled=false)}
}
(function setupCustomerImportTools(){
 const style=document.createElement('style');style.textContent=`#customerImportPreview::backdrop{background:#172b4270;backdrop-filter:blur(2px)}#customerImportPreview .data-table{min-width:900px}#customerImportPreview textarea{min-height:72px}#customerImportPreview input[type=checkbox]{width:18px!important;height:18px!important;min-height:18px!important;margin:0!important;padding:0!important;accent-color:#315d86}#customerImportPreview .actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:8px;margin:12px 0}#customerImportPreview .actions:last-child{position:sticky;bottom:-24px;background:#fff;padding:14px 0 8px;border-top:1px solid #e1e7ee;z-index:3}#customerImportPreview .data-table th{position:sticky;top:0;background:#eaf1f8;color:#294967;z-index:2}#customerImportPreview .data-table th,#customerImportPreview .data-table td{padding:11px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #edf1f5;font-size:14px;line-height:1.65}#customerImportPreview .data-table th:first-child,#customerImportPreview .data-table td:first-child{text-align:center;width:45px}#customerImportPreview .grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.import-workflow-tools{margin:20px 0;padding:20px;border:1px solid #d5e0eb;border-radius:12px;background:#f7fafc;color:#31485f}.import-workflow-tools h3{margin:0 0 8px;font-size:17px}.import-workflow-tools p{font-size:14px;line-height:1.7}.import-workflow-tools textarea{box-sizing:border-box;width:100%;min-height:110px;margin:10px 0;resize:vertical}.import-workflow-tools [data-address-status]{white-space:pre-wrap;font-size:13px;color:#3e6358}`;document.head.appendChild(style);
 for(const key of ['domestic',...outreachKeys]){
  const section=document.getElementById(key==='domestic'?'excelSection':key+'ExcelSection');if(!section)continue;
  const panel=document.createElement('div');panel.className='import-workflow-tools';
  panel.innerHTML='<h3>匯入資料檢查與修正</h3><p>上傳後會先開啟預覽。可逐列查看未匯入原因，修正後重新檢查，再匯入通過檢查的資料。</p><button type="button" class="btn" data-resume-import>繼續修正未匯入資料</button><details><summary>或貼上從 Excel 複製的表格</summary><textarea aria-label="貼上 Excel 表格" placeholder="請從 Excel 複製包含表頭的資料，再貼到這裡。"></textarea><button type="button" class="btn" data-preview-paste>預覽貼上的資料</button></details><hr><h3>雲端地址與縣市區域</h3><p>依雲端已填寫的台灣地址，辨識並更新四大分類的縣市區域。地址含多個縣市或未含縣市名稱時，會保留待確認。</p><button type="button" class="btn" data-address-backfill>依地址更新雲端縣市區域</button><p role="status" data-address-status></p>';
  panel.querySelector('[data-resume-import]').onclick=()=>openCustomerImport(null,key).catch(e=>appNotice(e.message));
  panel.querySelector('[data-preview-paste]').onclick=()=>{const text=panel.querySelector('textarea').value;if(!text.trim()){appNotice('請先貼上包含表頭的 Excel 資料。');return}try{openCustomerImport(XLSX.read(text,{type:'string',raw:true}),key).catch(e=>appNotice(e.message))}catch(e){appNotice('無法讀取貼上的資料：'+e.message)}};
  panel.querySelector('[data-address-backfill]').onclick=backfillCloudRegions;section.appendChild(panel);
 }
})();

/* Shared with import preview, including grouped labels for 02 and 05. */
function cloudPhoneRegion(row,domestic=false){
 const labelled=String(row.notes||'').match(/(?:^|\n)(?:公司地址|地址)[：:]([^\n]+)/);
 const address=String(row.company_address||row.address||row['公司地址']||row['地址']||labelled?.[1]||'').trim();
 const existing=String(domestic?row.area||'':row.region||'').trim();
 if(detectCity(address)||(existing&&!/待確認|無法辨識|未分類|未知/.test(existing)))return {city:'',label:'',skip:true};
 const phone=String(row.phone||row['電話']||row['聯繫電話']||'').trim();
 const country=String(row.country||row.location||'').trim();
 const explicitTaiwan=/^(?:\+886|00886)/.test(phone.normalize('NFKC').replace(/[\s()\-]/g,''));
 if(!domestic&&country&&!/^(台灣|臺灣|台灣地區|臺灣地區|台澎金馬|中華民國|Taiwan|TW|TWN|Taiwan,?\s*(?:R\.?O\.?C\.?|\(R\.?O\.?C\.?\)))$/i.test(country)&&!explicitTaiwan)return {city:'',label:'',skip:true};
 return detectImportPhoneRegion(phone);
}
function planCloudPhoneUpdates(domestic,outreach){
 const tasks=[],review=[];
 for(const row of domestic){
  const result=cloudPhoneRegion(row,true);
  if(result.city)tasks.push({table:'cold_call_records',id:row.id,original:row,patch:{area:result.city}});
  else if(!result.skip&&row.phone)review.push({category:'國內電訪',company:row.company_name||'未命名公司',phone:row.phone,reason:result.label});
 }
 for(const row of outreach){
  const value=row.data||{},result=cloudPhoneRegion(value);
  if(result.city)tasks.push({table:'outreach_records',id:row.id,original:row,patch:{data:{...value,region:result.city}}});
  else if(!result.skip&&(value.phone||value['電話']||value['聯繫電話']))review.push({category:outreachConfig[row.category]?.title||row.category,company:value.company||'未命名公司',phone:value.phone||value['電話']||value['聯繫電話'],reason:result.label});
 }
 return {tasks,review};
}
let cloudPhoneRegionBusy=false,cloudPhoneAutoUser='',cloudPhoneLastResult=null;
function renderCloudPhoneResult(result){
 document.querySelectorAll('[data-phone-status]').forEach(p=>p.textContent=result.message);
 document.querySelectorAll('[data-phone-review]').forEach(panel=>{
  panel.innerHTML=result.review.length?'<summary>待人工確認 '+result.review.length+' 筆（顯示前 100 筆）</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>分類</th><th>公司</th><th>電話</th><th>原因</th></tr></thead><tbody>'+result.review.slice(0,100).map(r=>'<tr><td>'+esc(r.category)+'</td><td>'+esc(r.company)+'</td><td>'+esc(r.phone)+'</td><td>'+esc(r.reason)+'</td></tr>').join('')+'</tbody></table></div>':'';
 });
}
async function backfillCloudPhoneRegions(){
 if(cloudPhoneRegionBusy||addressBackfillBusy)return;
 if(currentProfile?.role!=='admin')return;
 cloudPhoneRegionBusy=true;
 const buttons=[...document.querySelectorAll('[data-phone-backfill],[data-address-backfill]')];buttons.forEach(b=>b.disabled=true);
 const status=message=>document.querySelectorAll('[data-phone-status]').forEach(p=>p.textContent=message);
 status('正在檢查全部雲端資料的市話區碼…');
 try{
  const [domestic,outreach]=await Promise.all([fetchAllReportRows('cold_call_records','*'),fetchAllReportRows('outreach_records','id,category,data,created_at',outreachKeys)]);
  const {tasks}=planCloudPhoneUpdates(domestic,outreach);let updated=0,conflicts=0,failed=0,next=0;
  async function worker(){while(next<tasks.length){const task=tasks[next++];try{
   let query=sb.from(task.table).update(task.patch).eq('id',task.id);
   if(task.table==='cold_call_records'){
    for(const field of ['area','phone','company_address'])query=task.original[field]==null?query.is(field,null):query.eq(field,task.original[field]);
   }else query=query.eq('data',JSON.stringify(task.original.data));
   const {data:saved,error}=await query.select('id');if(error)throw error;
   if(saved?.length===1)updated++;else conflicts++;
  }catch(error){failed++}
  status('市話縣市辨識：已更新 '+updated+'／'+tasks.length+' 筆。');
  }}
  await Promise.all(Array.from({length:Math.min(4,tasks.length)},worker));
  const [afterDomestic,afterOutreach]=await Promise.all([fetchAllReportRows('cold_call_records','*'),fetchAllReportRows('outreach_records','id,category,data,created_at',outreachKeys)]);
  const after=planCloudPhoneUpdates(afterDomestic,afterOutreach);
  cloudPhoneLastResult={review:after.review,message:'市話區碼檢查完成：本次更新 '+updated+' 筆；仍待更新 '+after.tasks.length+' 筆；需人工確認 '+after.review.length+' 筆。'+(conflicts?' '+conflicts+' 筆資料同時被修改，已保留最新內容。':'')+(failed?' '+failed+' 筆寫入失敗，可按重新辨識重試。':'')};
  renderCloudPhoneResult(cloudPhoneLastResult);
  if(updated)await Promise.all([load(),loadOutreachCloud()]);
  return {updated,remaining:after.tasks.length,conflicts,failed,review:after.review};
 }catch(error){
  cloudPhoneLastResult={review:[],message:'市話區碼檢查未完成：'+error.message+'。已完成的更新會保留，請按重新辨識重試。'};
  renderCloudPhoneResult(cloudPhoneLastResult);
  return {error:error.message};
 }finally{cloudPhoneRegionBusy=false;buttons.forEach(b=>b.disabled=false)}
}
function scheduleCloudPhoneRegions(){
 if(currentProfile?.role!=='admin'||cloudPhoneAutoUser===currentProfile.id)return;
 cloudPhoneAutoUser=currentProfile.id;
 setTimeout(()=>backfillCloudPhoneRegions(),0);
}
(function setupCloudPhoneRegions(){
 for(const panel of document.querySelectorAll('.import-workflow-tools')){
  const box=document.createElement('section');
  box.innerHTML='<hr><h3>既有雲端資料：自動依市話區碼補齊縣市</h3><p>管理員登入後自動檢查。保留地址可辨識或已填縣市的資料，補齊空白縣市及重新處理標示待確認、無法辨識的資料。02 統一辨識為「雙北/基隆」，05 統一辨識為「嘉義/雲林」，03 統一辨識為「新竹」。支援括號、分機、尾碼、國碼及省略開頭 0 的區碼格式；無足夠區碼資訊或跨地區電話保留待確認。國外資料僅辨識台灣地區或明確 +886 電話。</p><button type="button" class="btn" data-phone-backfill>重新辨識雲端市話縣市</button><p role="status" data-phone-status>管理員登入後將自動檢查。</p><details data-phone-review></details>';
  box.querySelector('[data-phone-backfill]').onclick=backfillCloudPhoneRegions;panel.appendChild(box);
 }
 if(cloudPhoneLastResult)renderCloudPhoneResult(cloudPhoneLastResult);
 scheduleCloudPhoneRegions();
})();
