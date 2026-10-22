/* Official IDA production-factory snapshot: 2026-09, retrieved 2026-10-22.
 * Source: https://data.gov.tw/dataset/6569 ; Government Open Data License v1.
 * Only public factory name/address/registration/business ID are retained.
 * Lookup runs locally; company names are not sent to third-party search services.
 */
const factoryAddressSnapshotCache=new Map();
function factoryAddressNameKey(value){
 return String(value||'').normalize('NFKC').replace(/臺/g,'台').toLowerCase()
  .replace(/\(股\)公司/g,'股份有限公司').replace(/\(有\)公司/g,'有限公司')
  .replace(/股份有限公司|有限公司|股份公司/g,'').replace(/[\s()（）·‧,，.\-]/g,'');
}
function factoryAddressLegalNameKey(value){
 return String(value||'').normalize('NFKC').replace(/臺/g,'台').toLowerCase()
 .replace(/\(股\)公司/g,'股份有限公司').replace(/\(有\)公司/g,'有限公司').replace(/[\s()（）·‧,，.\-]/g,'');
}
function findFactoryAddressCandidates(rows,company){
 const query=factoryAddressNameKey(company);if(query.length<2)return [];
 const found=[],seen=new Set();
 for(const row of rows){
  if(!Array.isArray(row)||row.length<4)continue;
  const key=factoryAddressNameKey(row[0]),exact=factoryAddressLegalNameKey(row[0])===factoryAddressLegalNameKey(company);
  if(!exact&&key!==query&&!(query.length>=3&&key.startsWith(query)))continue;
  const ident=String(row[0])+'\n'+String(row[1]);if(seen.has(ident))continue;seen.add(ident);
  found.push({name:row[0],address:row[1],registration:row[2],businessId:row[3],exact,
   source:'https://data.gov.tw/dataset/6569#factory='+encodeURIComponent(row[2])});
 }
 return found.sort((a,b)=>Number(b.exact)-Number(a.exact)||a.name.localeCompare(b.name,'zh-Hant')).slice(0,50);
}
async function fetchFactoryAddressSnapshot(company){
 const key=factoryAddressNameKey(company);if(key.length<2)throw Error('請輸入至少兩個字的公司名稱。');
 const shard=(key.codePointAt(0)%16).toString(16);
 if(!factoryAddressSnapshotCache.has(shard)){
  const promise=(async()=>{
   if(typeof DecompressionStream==='undefined')throw Error('此瀏覽器不支援地址索引解壓縮，請使用新版 Chrome 或 Edge。');
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
   try{
    const response=await fetch(new URL('factory-address-data/'+shard+'.txt?v=202609',location.href),{signal:controller.signal});
    if(!response.ok)throw Error('工廠地址索引讀取失敗（'+response.status+'）');
    const encoded=(await response.text()).trim(),bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const snapshot=await new Response(stream).json();
    if(snapshot.period!=='2026-09'||!Array.isArray(snapshot.rows))throw Error('工廠地址索引格式不正確');
    return snapshot;
   }finally{clearTimeout(timeout)}
  })();
  factoryAddressSnapshotCache.set(shard,promise);
  promise.catch(()=>factoryAddressSnapshotCache.delete(shard));
 }
 return factoryAddressSnapshotCache.get(shard);
}
/* User-reviewed operating/factory address lookup; no guessed addresses are written. */
function businessAddressLinks(company,website){
 const name=String(company||'').trim();
 let official='';try{const url=new URL(website);if(/^https?:$/.test(url.protocol))official=url.href}catch(_){}
 return {maps:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(name+' 工廠 營業地址'),search:'https://www.google.com/search?q='+encodeURIComponent('"'+name+'" 工廠 聯絡我們 地址'),official};
}
function businessAddressPatch(row,domestic,address,kind,source){
 const city=detectCity(address);
 const note='【營業／工廠地址核對】'+kind+'｜'+source;
 const notes=[String(row.notes||'').replace(/(?:^|\n)【營業／工廠地址核對】[^\n]*/g,'').trim(),note].filter(Boolean).join('\n');
 return domestic?{company_address:address,area:city||'',notes}:{...row,address,region:city||'',notes};
}
async function saveReviewedBusinessAddress(context,address,kind,source){
 if(currentProfile?.role!=='admin')throw Error('僅限管理員修改公司地址。');
 address=String(address||'').trim();if(address.length<6)throw Error('請貼上完整的營業／工廠地址。');
 if(!['實際營業地址','工廠地址'].includes(kind))throw Error('請選擇地址類型。');
 let sourceUrl;try{sourceUrl=new URL(source)}catch(_){throw Error('請填寫查證來源網址。')}
 if(!/^https?:$/.test(sourceUrl.protocol))throw Error('來源必須是 http 或 https 網址。');
 const domestic=context.key==='domestic',table=domestic?'cold_call_records':'outreach_records';
 let read=sb.from(table).select('*').eq('id',context.id);if(!domestic)read=read.eq('category',context.key);
 const {data:fresh,error}=await read.single();if(error)throw error;if(!fresh)throw Error('公司資料已不存在，請重新整理。');
 const row=domestic?fresh:fresh.data||{},name=domestic?row.company_name:row.company,oldAddress=String(domestic?row.company_address||'':row.address||'').trim();
 if(name!==context.company||oldAddress!==context.address)throw Error('公司名稱或地址已被其他人修改，請關閉後重新查詢。');
 const patch=businessAddressPatch(row,domestic,address,kind,sourceUrl.href);
 let update=sb.from(table).update(domestic?patch:{data:patch}).eq('id',context.id);
 if(domestic){
  for(const field of ['company_address','area','notes','company_name'])update=row[field]==null?update.is(field,null):update.eq(field,row[field]);
 }else update=update.eq('category',context.key).eq('data',JSON.stringify(fresh.data));
 const {data:saved,error:writeError}=await update.select('id');if(writeError)throw writeError;
 if(saved?.length!==1)throw Error('資料同時被修改或沒有更新權限，未覆蓋最新內容，請重試。');
 return patch;
}
function openBusinessAddressLookup(key,id){
 if(currentProfile?.role!=='admin'){appNotice('僅限管理員查證並儲存地址。');return}
 if(document.getElementById('businessAddressLookup'))return;
 const domestic=key==='domestic',row=domestic?data.find(r=>String(r.id)===String(id)):getOutreachRows(key).find(r=>String(r._cloudId)===String(id));
 if(!row){appNotice('找不到公司，請重新整理名單。');return}
 const context={key,id,company:String(domestic?row.company_name||'':row.company||''),address:String(domestic?row.company_address||'':row.address||'').trim()};
 const links=businessAddressLinks(context.company,row.website),dialog=document.createElement('dialog');
 dialog.id='businessAddressLookup';dialog.setAttribute('aria-labelledby','businessAddressTitle');
 dialog.style.cssText='width:min(720px,94vw);max-height:90vh;overflow:auto;border:1px solid #c5dcf5;border-radius:16px;padding:24px;color:#204b85';
 dialog.innerHTML='<h2 id="businessAddressTitle">查詢實際營業／工廠地址</h2><p><strong>'+esc(context.company)+'</strong></p><p>開啟後會自動比對經濟部生產中工廠名錄。單一完全符合的工廠地址會自動帶入；多個或近似結果請選擇據點。請核對後再儲存。</p><div class="tools"><a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(links.maps)+'">Google 地圖搜尋 ↗</a><a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(links.search)+'">搜尋官網／工廠地址 ↗</a>'+(links.official?'<a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(links.official)+'">開啟公司官網 ↗</a>':'')+'</div><section style="margin:16px 0;padding:14px;border:1px solid #c5dcf5;border-radius:12px;background:#f4f9ff"><label>搜尋公司／工廠名稱<input data-factory-query></label><button type="button" class="btn" data-factory-search>自動查詢並帶入地址</button><p role="status" data-factory-status></p><div data-factory-results></div><small>來源：<a href="https://data.gov.tw/dataset/6569" target="_blank" rel="noopener noreferrer">經濟部產業發展署登記工廠名錄</a>｜資料期別：2026 年 9 月｜政府資料開放授權條款第 1 版。一般辦公室、國外或未列入名錄的工廠可能查無資料。</small></section><p>目前公司地址：<strong>'+esc(context.address||'尚未填寫')+'</strong></p><form><label>地址類型<select name="kind"><option>實際營業地址</option><option>工廠地址</option></select></label><label>核對後的完整地址<textarea name="address" required minlength="6" placeholder="查詢結果會自動帶入；也可手動修正地址"></textarea></label><p data-address-city>縣市區域：等待輸入地址</p><label>查證來源網址<input name="source" type="url" required placeholder="https://…（官網聯絡頁或該據點地圖連結）"></label><label class="business-address-check"><input name="confirmed" type="checkbox" required>我已核對這是同一家公司的實際營業／工廠據點</label>'+(context.address?'<label class="business-address-check"><input name="overwrite" type="checkbox" required>我確認以此地址取代目前地址</label>':'')+'<p role="status" data-business-address-status></p><div class="actions"><button class="btn primary" type="submit" disabled>確認地址並儲存至雲端</button><button class="btn" type="button" data-address-close>取消</button></div></form>';
 const style=document.createElement('style');style.textContent='#businessAddressLookup::backdrop{background:#173c7870}#businessAddressLookup label{margin-top:14px}#businessAddressLookup .business-address-check{display:flex;gap:8px;align-items:flex-start}#businessAddressLookup input[type=checkbox]{width:18px;min-height:18px;height:18px;flex:none}.business-address-lookup{display:block!important;margin:6px auto 0;font-size:12px!important;padding:4px 8px!important}';dialog.appendChild(style);
 document.body.appendChild(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),submit=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-address-close]'),status=form.querySelector('[data-business-address-status]');let busy=false;
 function sync(){const city=detectCity(form.elements.address.value);form.querySelector('[data-address-city]').textContent='縣市區域：'+(city||'未能明確辨識；儲存時將清空舊縣市，待人工確認');submit.disabled=busy||!form.checkValidity()}

 const query=dialog.querySelector('[data-factory-query]'),searchButton=dialog.querySelector('[data-factory-search]'),searchStatus=dialog.querySelector('[data-factory-status]'),results=dialog.querySelector('[data-factory-results]');
 query.value=context.company;
 let searching=false,candidates=[];
 function applyFactoryCandidate(candidate){
  form.elements.address.value=candidate.address;
  form.elements.source.value=candidate.source;form.elements.kind.value='工廠地址';
  form.elements.confirmed.checked=false;if(form.elements.overwrite)form.elements.overwrite.checked=false;
  sync();
 }
 async function lookupFactories(){
  if(searching||busy)return;searching=true;searchButton.disabled=true;results.innerHTML='';
  const requested=query.value.trim(),draft=form.elements.address.value;searchStatus.textContent='正在自動比對官方工廠名稱與地址…';
  try{
   const snapshot=await fetchFactoryAddressSnapshot(requested);
   if(!dialog.isConnected)return;
   candidates=findFactoryAddressCandidates(snapshot.rows,requested);
   if(!candidates.length){searchStatus.textContent='官方名錄未找到符合的工廠地址。可改用較短的公司名稱再查詢，或使用上方官網／地圖核對。未帶入或儲存任何地址。';return}
   results.innerHTML=candidates.map((candidate,i)=>'<article style="margin:10px 0;padding:10px;border:1px solid #d5e4f6;border-radius:8px"><strong>'+esc(candidate.name)+'</strong><p>'+esc(candidate.address)+'</p><small>工廠登記編號：'+esc(candidate.registration)+'｜統編：'+esc(candidate.businessId)+'｜'+(candidate.exact?'名稱符合':'相近名稱，請確認')+'</small><br><button type="button" class="btn" data-factory-use="'+i+'">帶入此工廠地址</button></article>').join('');
   const unique=candidates.length===1&&candidates[0].exact;
   if(unique&&!draft&&form.elements.address.value===draft){
    applyFactoryCandidate(candidates[0]);searchStatus.textContent='✓ 已找到名稱符合的工廠，地址、來源及縣市已自動帶入。請核對據點並勾選確認後儲存。';
   }else searchStatus.textContent='找到 '+candidates.length+' 個工廠結果'+(candidates.length===50?'（最多顯示 50 個）':'')+'。請選擇正確據點，按「帶入此工廠地址」。原有輸入尚未被覆蓋。';
  }catch(error){if(dialog.isConnected)searchStatus.textContent='自動查詢未完成：'+(error.name==='AbortError'?'連線逾時，請重試。':error.message)+' 可重新查詢；原有資料未變更。'}
  finally{searching=false;searchButton.disabled=busy}
 }
 results.addEventListener('click',event=>{
  const button=event.target.closest('[data-factory-use]');if(!button||busy)return;
  const candidate=candidates[Number(button.dataset.factoryUse)];if(!candidate)return;
  applyFactoryCandidate(candidate);searchStatus.textContent='✓ 工廠地址、來源及縣市已自動帶入，請核對後儲存。';
 });
 searchButton.onclick=lookupFactories;
 query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookupFactories()}});
 lookupFactories();

 form.addEventListener('input',sync);form.addEventListener('change',sync);
 cancel.onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault()});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  busy=true;sync();cancel.disabled=true;status.textContent='正在儲存並核對雲端結果…';
  try{
   const address=form.elements.address.value.trim(),kind=form.elements.kind.value,source=form.elements.source.value.trim();
   await saveReviewedBusinessAddress(context,address,kind,source);
   const {data:verified,error}=await sb.from(domestic?'cold_call_records':'outreach_records').select(domestic?'company_address':'data').eq('id',id).single();
   if(error)throw Error('寫入已送出，但回讀未完成，請檢查公司詳細資料後再試。');
   if((domestic?verified?.company_address:verified?.data?.address)!==address)throw Error('儲存後地址與預期不同，請重新讀取公司資料。');
   status.textContent='✓ 地址已寫入公司詳細資料，並核對雲端儲存成功。';
   try{await Promise.all([load(),loadOutreachCloud()])}catch(_){status.textContent+=' 列表更新未完成，請重新開啟名單。'}
   form.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=true);query.disabled=true;searchButton.disabled=true;results.querySelectorAll('button').forEach(el=>el.disabled=true);submit.hidden=true;cancel.textContent='完成';busy=false;cancel.disabled=false;
  }catch(error){status.textContent='未能確認儲存完成：'+error.message;busy=false;cancel.disabled=false;sync()}
 };
}
(function setupBusinessAddressLookup(){
 const selectors=[
 ['domestic','#records [data-action="details"][data-record-id]','recordId'],
 ['prospecting','#prospectingRecords [data-prospecting-detail]','prospectingDetail'],
 ['exhibitions','#exhibitionsRecords [data-exhibition-company-link]','cloudId'],
 ['foreignEmail','#foreignEmailRecords [data-foreign-email-detail]','foreignEmailDetail']
 ];
 let pending=false;
 function attach(){
  pending=false;if(currentProfile?.role!=='admin')return;
  for(const [key,selector,attribute] of selectors)document.querySelectorAll(selector).forEach(company=>{
   const parent=company.parentElement;if(company.closest('.company-detail-row')||parent.querySelector('[data-business-address-id]'))return;
   const button=document.createElement('button');button.type='button';button.className='btn business-address-lookup';button.textContent='查詢營業／工廠地址';button.dataset.businessAddressId=company.dataset[attribute];button.dataset.businessAddressKey=key;parent.appendChild(button);
  });
 }
 new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(attach)}}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('click',event=>{const button=event.target.closest('[data-business-address-id]');if(button){event.preventDefault();event.stopPropagation();openBusinessAddressLookup(button.dataset.businessAddressKey,button.dataset.businessAddressId)}});
 attach();
})();

/* Bulk address completion: only empty addresses with one legally matching factory. */
let bulkFactoryAddressBusy=false,bulkFactoryAddressResult=null;
function classifyBulkFactoryAddress(item,candidates){
 if(item.address.trim())return {status:'保留原地址'};
 const legal=factoryAddressLegalNameKey(item.company);
 if(!candidates.length)return {status:'查無工廠資料'};
 const legalMatches=candidates.filter(c=>factoryAddressLegalNameKey(c.name).startsWith(legal));
 if(candidates.length!==1||legalMatches.length!==1)return {status:'同名或多據點，待確認'};
 return {status:'可補齊',candidate:legalMatches[0]};
}
function collectBulkFactoryCompanies(domestic,outreach){
 return [...domestic.map(row=>({key:'domestic',id:row.id,company:String(row.company_name||''),address:String(row.company_address||'').trim(),country:'台灣'})),
 ...outreach.map(record=>{const row=record.data||{};return {key:record.category,id:record.id,company:String(row.company||''),address:String(row.address||row.company_address||row['公司地址']||'').trim(),country:String(row.country||row.location||'').trim()}})];
}
function renderBulkFactoryAddressResult(){
 if(!bulkFactoryAddressResult)return;
 const result=bulkFactoryAddressResult;
 document.querySelectorAll('[data-bulk-factory-status]').forEach(el=>el.textContent=result.message);
 document.querySelectorAll('[data-bulk-factory-report]').forEach(el=>{
  const pending=result.rows.filter(r=>!['保留原地址','已補齊'].includes(r.status));
  el.innerHTML=pending.length?'<summary>查看未補齊原因：'+pending.length+' 筆（顯示前 100 筆）</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>分類</th><th>公司</th><th>結果</th></tr></thead><tbody>'+pending.slice(0,100).map(r=>'<tr><td>'+esc(r.key==='domestic'?'國內電訪':outreachConfig[r.key]?.title||r.key)+'</td><td>'+esc(r.company)+'</td><td>'+esc(r.status+(r.error?'：'+r.error:''))+'</td></tr>').join('')+'</tbody></table></div>':'';
 });
 document.querySelectorAll('[data-bulk-factory-export]').forEach(button=>button.disabled=!result.rows.length||bulkFactoryAddressBusy);
}
async function completeCloudFactoryAddresses(){
 if(bulkFactoryAddressBusy)return;
 if(currentProfile?.role!=='admin'){appNotice('僅限管理員執行雲端地址補齊。');return}
 if((typeof addressBackfillBusy!=='undefined'&&addressBackfillBusy)||(typeof cloudPhoneRegionBusy!=='undefined'&&cloudPhoneRegionBusy)){appNotice('縣市辨識仍在執行，請完成後再補齊地址。');return}
 bulkFactoryAddressBusy=true;const buttons=[...document.querySelectorAll('[data-bulk-factory-run]')];buttons.forEach(b=>b.disabled=true);
 const status=message=>document.querySelectorAll('[data-bulk-factory-status]').forEach(el=>el.textContent=message);
 let rows=[];
 try{
  status('正在讀取全部分類的雲端公司與現有地址…');
  const [domestic,outreach]=await Promise.all([fetchAllReportRows('cold_call_records','*'),fetchAllReportRows('outreach_records','id,category,data,created_at',outreachKeys)]);
  rows=collectBulkFactoryCompanies(domestic,outreach);
  let next=0,checked=0,updated=0;
  async function worker(){
   while(next<rows.length){
    const item=rows[next++];
    try{
     if(item.address){item.status='保留原地址';continue}
     if(!item.company.trim()){item.status='缺少公司名稱';continue}
     if(item.key!=='domestic'&&item.country&&!detectCity(item.country)&&!/^(台灣|臺灣|中華民國|台灣地區|臺灣地區|Taiwan|TW|TWN)$/i.test(item.country)){item.status='非台灣資料，需其他地址來源';continue}
     const snapshot=await fetchFactoryAddressSnapshot(item.company);
     const candidates=findFactoryAddressCandidates(snapshot.rows,item.company);
     const decision=classifyBulkFactoryAddress(item,candidates);item.status=decision.status;
     if(!decision.candidate)continue;
     const candidate=decision.candidate;
     await saveReviewedBusinessAddress(item,candidate.address,'工廠地址',candidate.source);
     item.status='已送出，等待回讀';item.proposedAddress=candidate.address;item.source=candidate.source;updated++;
    }catch(error){item.status='未完成，請重試／確認';item.error=error.message}
    finally{checked++;status('地址補齊進度：已檢查 '+checked+'／'+rows.length+' 筆；已送出 '+updated+' 筆，完成後會逐筆回讀確認。')}
   }
  }
  await Promise.all(Array.from({length:Math.min(3,rows.length)},worker));
  status('正在重新讀取雲端，核對所有補齊結果…');
  const [afterDomestic,afterOutreach]=await Promise.all([fetchAllReportRows('cold_call_records','*'),fetchAllReportRows('outreach_records','id,category,data,created_at',outreachKeys)]);
  const actual=new Map(collectBulkFactoryCompanies(afterDomestic,afterOutreach).map(item=>[item.key+':'+item.id,item.address]));
  for(const item of rows)if(item.status==='已送出，等待回讀')item.status=actual.get(item.key+':'+item.id)===item.proposedAddress?'已補齊':'回讀不一致，需確認';
  const count=label=>rows.filter(item=>item.status===label).length;
  const saved=count('已補齊'),retained=count('保留原地址'),remaining=rows.length-saved-retained;
  bulkFactoryAddressResult={rows,message:'已檢查全部 '+rows.length+' 筆雲端紀錄；已補齊並核對 '+saved+' 筆；保留原地址 '+retained+' 筆；仍需確認 '+remaining+' 筆。查無工廠資料 '+count('查無工廠資料')+' 筆；同名或多據點 '+count('同名或多據點，待確認')+' 筆；非台灣資料 '+count('非台灣資料，需其他地址來源')+' 筆；其他未完成 '+(remaining-count('查無工廠資料')-count('同名或多據點，待確認')-count('非台灣資料，需其他地址來源'))+' 筆。'};
  renderBulkFactoryAddressResult();
  try{await Promise.all([load(),loadOutreachCloud()])}catch(error){bulkFactoryAddressResult.message+=' 列表更新未完成：'+error.message;renderBulkFactoryAddressResult()}
  return bulkFactoryAddressResult;
 }catch(error){
  bulkFactoryAddressResult={rows,message:'批次補齊未完成：'+error.message+'。已成功寫入的資料會保留，請重新執行檢查。'};renderBulkFactoryAddressResult();
  return bulkFactoryAddressResult;
 }finally{bulkFactoryAddressBusy=false;buttons.forEach(b=>b.disabled=false);renderBulkFactoryAddressResult()}
}
function exportBulkFactoryAddressResult(){
 if(!bulkFactoryAddressResult)return;
 const output=bulkFactoryAddressResult.rows.map(row=>({'分類':row.key==='domestic'?'國內電訪':outreachConfig[row.key]?.title||row.key,'公司名稱':row.company,'原有地址':row.address,'補齊地址':row.proposedAddress||'','結果':row.status,'來源':row.source||'','錯誤原因':row.error||''}));
 const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(output),'地址補齊結果');XLSX.writeFile(workbook,'雲端公司地址補齊結果.xlsx');
}
(function setupBulkFactoryAddresses(){
 for(const panel of document.querySelectorAll('.import-workflow-tools')){
  const section=document.createElement('section');
  section.innerHTML='<hr><h3>批次補齊所有雲端公司地址</h3><p>一次檢查四大分類，只補齊空白地址。依官方工廠名錄比對完整公司名稱；單一符合工廠才寫入地址、縣市及來源。既有地址保留，同名、多據點、國外及查無資料均列出原因。</p><button type="button" class="btn primary" data-bulk-factory-run>自動補齊全部雲端公司地址</button> <button type="button" class="btn" data-bulk-factory-export disabled>匯出全部補齊結果</button><p role="status" data-bulk-factory-status>尚未執行批次補齊。</p><details data-bulk-factory-report></details>';
  section.querySelector('[data-bulk-factory-run]').onclick=completeCloudFactoryAddresses;
  section.querySelector('[data-bulk-factory-export]').onclick=exportBulkFactoryAddressResult;panel.appendChild(section);
 }
 renderBulkFactoryAddressResult();
})();
