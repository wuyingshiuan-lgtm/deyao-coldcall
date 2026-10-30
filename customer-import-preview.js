/* Shared calling areas use the customer directory's grouped region labels. */
function detectImportPhoneRegion(value){
 const rules=[
 ['0826','金門縣'],['0836','連江縣'],['037','苗栗縣'],['049','南投縣'],
 ['082','金門縣'],['089','台東縣'],['02','雙北/基隆'],['03','新竹'],
 ['04','台中市'],['05','嘉義/雲林'],['06','台南市'],['07','高雄市'],['08','屏東縣']
 ];
 const parts=String(value||'').normalize('NFKC').replace(/[‐‑‒–—−﹣]/g,'-').replace(/[˜⁓〜～∼]/g,'~').split(/[;,；、/\n]+/).map(x=>x.trim()).filter(Boolean);
 const found=[];let unresolved=false;
 for(let part of parts){
  part=part.replace(/^(?:(?:聯絡|聯繫|公司)?電話|市話|tel(?:ephone)?|phone|fax|傳真)\s*[:：]?\s*/i,'');
  part=part.replace(/^[\s\-–—.:：]+/, '');
  // A range suffix denotes additional lines at the same area code.
  part=part.replace(/\s*[~～∼〜至]\s*\d+(?:\s*[-~～∼〜至]\s*\d+)*\s*$/, '');
  part=part.replace(/(?:分機|轉|ext(?:ension)?\.?|#|\*|x)\s*[:：]?\s*\d+.*$/i,'').trim();
  part=part.replace(/(\d)\s*\+\s*\d+.*$/, '$1');
  part=part.replace(/^\(?(826|836|37|49|82|89|[2-8])\)?(?=[\s\-–—.:：])/, '0$1');
  if(!/^[+\d\s()\-–—.:：]+$/.test(part)){unresolved=true;continue}
  let number=part.replace(/[\s()\-–—.:：]/g,'');
  if(number.startsWith('+886'))number='0'+number.slice(4).replace(/^0/,'');
  else if(number.startsWith('00886'))number='0'+number.slice(5).replace(/^0/,'');
  else if(number.startsWith('886'))number='0'+number.slice(3).replace(/^0/,'');
  if(/^09\d{8}$/.test(number))continue;
  const rule=rules.find(([code])=>number.startsWith(code));
  if(!rule||!/^\d{4,16}$/.test(number.slice(rule[0].length))){unresolved=true;continue}
  let city=rule[1];
  if(rule[0]==='04'&&/^[78]/.test(number.slice(2)))city='彰化縣';
  if(rule[0]==='06'&&number[2]==='9')city='澎湖縣';
  found.push({code:rule[0],city});
 }
 if(!found.length)return {city:'',label:value?'無法辨識市話區碼':'未填電話'};
 const cities=[...new Set(found.map(x=>x.city))],codes=[...new Set(found.map(x=>x.code))];
 // Use the first recognizable landline when several phone numbers share a field.
 return {city:cities[0],label:codes[0]+' → '+cities[0]+'（依市話區碼自動辨識）'};
}
function resolveCustomerImportRegion(values,phoneEnabled){
 const address=detectCity(values['公司地址']);
 if(address)return {city:address,label:address+'（依地址）'};
 const existing=String(values['縣市']||values['地區']||values['縣市區域']||values['公司地區']||'').trim();
 if(existing&&!/待確認|無法辨識|未分類|未知|未填|尚未填寫|空白|^(?:[-—–]|N\/?A|null|none)$/i.test(existing))return {city:detectCity(existing)||existing,label:(detectCity(existing)||existing)+'（原有縣市）'};
 if(!phoneEnabled)return {city:'',label:'未啟用市話區碼辨識'};
 return detectImportPhoneRegion(values['電話']);
}
const customerImportSessions=new Map();
/* Import staging: original rows remain editable until individually accepted. */
function customerImportStage(wb,key){
 const entries=[];
 for(const sheet of wb.SheetNames){
  const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:'',raw:false,blankrows:true,range:0,dateNF:'yyyy-mm-dd'});
  if(!matrix.length)continue;
  const foundHeader=matrix.findIndex(row=>row.some(h=>CustomerImport.canonical(h)==='公司名稱'));
  const headerIndex=foundHeader>=0?foundHeader:matrix.findIndex(row=>row.some(v=>String(v??'').trim()));
  if(headerIndex<0)continue;
  const headers=matrix[headerIndex].map((h,i)=>String(h||'未命名欄 '+(i+1)));
  const hasCompany=headers.some(h=>CustomerImport.canonical(h)==='公司名稱');
  matrix.slice(headerIndex+1).forEach((cells,i)=>{if(!cells.some((v,j)=>!['是否適合拜訪','是否已寄送Mail'].includes(CustomerImport.canonical(headers[j]))&&String(v??'').trim()))return;
   const fields=cells.map((v,j)=>{
    const header=headers[j]||'未命名欄 '+(j+1);
    const cell=XLSX.utils.encode_cell?wb.Sheets[sheet][XLSX.utils.encode_cell({r:headerIndex+i+1,c:j})]:null;
    const link=CustomerImport.canonical(header)==='公司官網'?cell?.l?.Target:null;
    return {header,value:String(link&&/^https?:\/\//i.test(link)?link:v??'')};
   });
   headers.forEach((h,j)=>{if(!fields[j])fields[j]={header:h,value:''}});
   if(key==='foreignEmail'){
    for(let j=fields.length-1;j>=0;j--)if(CustomerImport.canonical(fields[j].header)==='開發來源')fields.splice(j,1);
    if(!fields.some(f=>String(f.value??'').trim()))return;
   }
   if(!hasCompany)fields.unshift({header:'公司名稱',value:''});
   entries.push({sheet,row:headerIndex+i+2,fields,selected:hasCompany,saved:false,issue:'',error:'',values:{}});
  });
 }
 return entries;
}
function validateCustomerImport(entries,cloudNames,key){
 const groups=new Map();
 for(const entry of entries){
  if(entry.saved)continue;
  const values={},conflicts=[];
  for(const f of entry.fields){const key=CustomerImport.canonical(f.header),value=f.value.trim();if(!value)continue;if(values[key]!==undefined&&values[key]!==value)conflicts.push(key);else values[key]=value}
  entry.values=values;entry.issue='';
  if(conflicts.length)entry.issue='欄位內容衝突：'+[...new Set(conflicts)].join('、')+'；請修改或清空其中一欄';
  const name=CustomerImport.companyKey(values['公司名稱']);
  try{CustomerImport.visitValue(values['是否適合拜訪'])}catch(err){entry.issue=[entry.issue,err.message].filter(Boolean).join('；')}
  if(!name)entry.issue=[entry.issue,'缺少公司名稱'].filter(Boolean).join('；');
  else if(cloudNames.has(name))entry.issue=[entry.issue,(cloudNames instanceof Map?CustomerImport.duplicateMessage(values['公司名稱'],cloudNames.get(name)):'公司名稱已存在雲端資料內，不可重複新增')].filter(Boolean).join('；');
  if(entry.selected&&name){if(!groups.has(name))groups.set(name,[]);groups.get(name).push(entry)}
 }
 for(const group of groups.values())if(group.length>1){
  if(key!=='foreignEmail'){for(const entry of group)entry.issue=[entry.issue,'檔案內公司重複：請修正或取消勾選重複列'].filter(Boolean).join('；');continue}
  const ids=new Set(group.map(e=>String(e.values['ID']??'').trim()).filter(Boolean));
  const domains=new Set(group.map(e=>String(e.values['Domain']??'').toLowerCase().trim()).filter(Boolean));
  if(ids.size>1||domains.size>1)for(const entry of group)entry.issue=[entry.issue,'同公司 ID 或 Domain 不一致，請先確認資料'].filter(Boolean).join('；');
 }
 if(key==='foreignEmail'){
  const ids=new Map();
  for(const entry of entries.filter(e=>e.selected&&!e.saved)){
   const id=String(entry.values['ID']??'').trim(),name=CustomerImport.companyKey(entry.values['公司名稱']);
   if(!id||!name)continue;
   if(ids.has(id)&&ids.get(id)!==name)entry.issue=[entry.issue,'同一 ID 對應不同公司名稱，請人工確認'].filter(Boolean).join('；');
   else ids.set(id,name);
  }
 }
 return entries.filter(e=>e.selected&&!e.saved&&!e.issue&&!e.error);
}
async function openCustomerImport(wb,key){
 if(document.getElementById('customerImportPreview')){appNotice('請先完成或關閉目前的匯入預覽。');return}
 if(!wb&&!customerImportSessions.has(key)){appNotice('目前沒有待修正的匯入資料，請先上傳 Excel 或貼上資料。');return}
 if(wb&&customerImportSessions.get(key)?.some(e=>!e.saved)&&!await appConfirm('目前仍有未匯入的資料。載入新檔會取代本頁暫存的預覽，是否繼續？'))return;
 const entries=wb?customerImportStage(wb,key):customerImportSessions.get(key);if(!entries.length)throw Error('檔案內沒有資料');customerImportSessions.set(key,entries);
 let phoneEnabled=key!=='foreignEmail';
 let importSource='馬太平台';
 let cloudNames=new Set(),cloudReady=false,busy=false,page=0,filter='pending',editingEntry=null;
 const dialog=document.createElement('dialog');dialog.id='customerImportPreview';dialog.setAttribute('aria-labelledby','customerImportTitle');
 dialog.style.cssText='width:min(1200px,94vw);max-height:90vh;border:1px solid #d5e0eb;border-radius:16px;padding:24px;color:#31485f;background:#ffffff;box-shadow:0 20px 80px #30203544;';
 dialog.innerHTML='<h2 id="customerImportTitle">匯入資料預覽與修正</h2><p>匯入至：'+esc(key==='domestic'?'國內電訪':outreachConfig[key].title)+'。未通過檢查的資料會留在此處，不會寫入雲端。可修改後重新檢查，或取消勾選暫不匯入的列。</p><p>公司同名時請先確認是否為同一家；既有客戶應使用新增聯繫紀錄。沒有公司表頭的工作表預設不勾選。預覽可於本頁繼續修正；重新整理網頁前請先完成匯入。</p><fieldset style="border:1px solid #cbddeb;border-radius:10px;padding:12px;margin:12px 0"><legend>縣市辨識設定</legend><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-import-phone-region>依台灣市話區碼補齊縣市</label><p>優先順序：地址 → 原有縣市 → 市話區碼。例如 07-6173055 → 高雄市。02 統一為雙北/基隆，05 統一為嘉義/雲林，03 統一為新竹；同欄有多個電話時採用第一個可辨識的市話區碼；無市話區碼的資料歸為未分類。</p></fieldset><p data-import-summary role="status"></p><p data-import-message role="status" style="white-space:pre-wrap;color:#97365b"></p><div class="actions"><button type="button" class="btn" data-import-check>重新檢查雲端</button><select aria-label="預覽資料篩選" data-import-filter><option value="pending">未匯入資料</option><option value="issues">僅顯示問題資料</option><option value="all">全部資料</option><option value="ready">可匯入</option><option value="saved">已匯入</option></select><button type="button" class="btn" data-import-select>全選未匯入</button><button type="button" class="btn" data-import-deselect>取消全選</button></div><div data-import-editor></div><div class="table-wrap" style="max-height:42vh;overflow:auto"><table class="data-table"><thead><tr><th>匯入</th><th>來源工作表／列</th><th>公司名稱</th><th>公司地址</th><th>電話</th><th>'+ (key==='foreignEmail'?'國家／地區（自動辨識）':'辨識縣市／依據') +'</th><th>狀態／未匯入原因</th><th>修正</th></tr></thead><tbody data-import-rows></tbody></table></div><div class="actions"><button type="button" class="btn" data-import-prev>上一頁</button><span data-import-page></span><button type="button" class="btn" data-import-next>下一頁</button></div><div class="actions"><button type="button" class="btn primary" data-import-save>匯入已勾選且通過檢查的資料</button><button type="button" class="btn" data-import-close>關閉預覽</button></div>';
 if(key==='foreignEmail'){dialog.querySelector('fieldset').hidden=true;dialog.querySelector('#customerImportTitle').insertAdjacentHTML('afterend','<p>檔案中的 Source／開發來源欄位會略過，改用下方選擇的來源。「網站」會帶入官方網站；「地區」會自動轉成國家，例如 Ramsey → 美國。無法確定時保留原始地區，不猜填國家。</p>')}
 if(key==='foreignEmail'){
  const sourceField=document.createElement('fieldset');
  sourceField.style.cssText='border:1px solid #cbddeb;border-radius:10px;padding:12px;margin:12px 0';
  sourceField.innerHTML='<legend>本批匯入資料的開發來源</legend><div style="display:flex;gap:10px;flex-wrap:wrap">'+['馬太平台','自行開發','展覽'].map(source=>'<button type="button" class="btn" data-import-source="'+source+'" aria-pressed="'+String(source===importSource)+'">'+source+'</button>').join('')+'</div><p data-import-source-summary></p>';
  dialog.querySelector('[data-import-summary]').before(sourceField);
  sourceField.addEventListener('click',event=>{
   const button=event.target.closest('[data-import-source]');
   if(!button||busy)return;
   importSource=button.dataset.importSource;render();
  });
 }
 document.body.appendChild(dialog);dialog.showModal();
 const q=selector=>dialog.querySelector(selector),msg=q('[data-import-message]');
 function render(){
  dialog.querySelectorAll('[data-import-source]').forEach(button=>{const selected=button.dataset.importSource===importSource;button.classList.toggle('primary',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=busy;});
  const sourceSummary=dialog.querySelector('[data-import-source-summary]');if(sourceSummary)sourceSummary.textContent='本次勾選匯入的資料將統一設為：'+importSource+'。';
  const ready=validateCustomerImport(entries,cloudNames,key),saved=entries.filter(e=>e.saved).length;
  q('[data-import-summary]').textContent='總共 '+entries.length+' 筆｜已匯入 '+saved+' 筆｜已勾選可匯入 '+ready.length+' 筆｜未匯入 '+(entries.length-saved)+' 筆｜問題資料 '+entries.filter(e=>!e.saved&&(e.issue||e.error)).length+' 筆';
  const visible=entries.filter(e=>filter==='all'||(filter==='issues'&&!e.saved&&!!(e.issue||e.error))||(filter==='saved'?e.saved:filter==='ready'?!e.saved&&e.selected&&!e.issue&&!e.error:filter==='pending'&&!e.saved));
  page=Math.max(0,Math.min(page,Math.ceil(visible.length/30)-1));
  q('[data-import-rows]').innerHTML=visible.slice(page*30,page*30+30).map(e=>{const i=entries.indexOf(e);return '<tr><td><input type="checkbox" aria-label="選取 '+esc(e.sheet)+' 第 '+e.row+' 列" data-import-row="'+i+'" '+(e.selected?'checked ':'')+(e.saved||busy?'disabled':'')+'></td><td>'+esc(e.sheet)+'／'+e.row+'</td><td>'+esc(e.values['公司名稱']||'（未填）')+'</td><td>'+esc(e.values['公司地址']||'—')+'</td><td>'+esc(e.values['電話']||'—')+'</td><td>'+esc(key==='foreignEmail'?(CustomerImport.foreignCountryFor(e.values)||'無法確定國家（保留原始地區）'):resolveCustomerImportRegion(e.values,phoneEnabled).label)+'</td><td style="white-space:pre-wrap;color:'+(e.issue||e.error?'#9a4350':e.saved?'#2c7059':'#425d78')+'">'+esc(e.saved?'✓ 已匯入':e.error||e.issue||(!cloudReady?'等待雲端檢查':!e.selected?'未勾選，暫不匯入':'✓ 可匯入'))+'</td><td><button type="button" class="btn small" data-import-edit="'+i+'" '+(e.saved||busy?'disabled':'')+'>查看／修改</button></td></tr>'}).join('');
  q('[data-import-page]').textContent=(page+1)+'／'+Math.max(1,Math.ceil(visible.length/30))+' 頁';
  q('[data-import-save]').disabled=busy||!cloudReady||!ready.length||!!editingEntry;
  q('[data-import-check]').disabled=busy;
  q('[data-import-phone-region]').disabled=busy||!!editingEntry;
  q('[data-import-close]').disabled=busy;
  q('[data-import-prev]').disabled=busy||page===0;q('[data-import-next]').disabled=busy||(page+1)*30>=visible.length;
 }
 async function check(notify=false){cloudReady=false;render();msg.textContent='正在讀取全部分類的雲端公司名稱…';try{const [a,b]=await Promise.all([readAllCompanyRows('cold_call_records','id,company_name'),readAllCompanyRows('outreach_records','id,category,data')]);cloudNames=CustomerImport.companyLocations(a,b);cloudReady=true;entries.forEach(e=>e.error='');msg.textContent='雲端檢查完成。修正問題列後，可與其他通過檢查的資料一起匯入。'}catch(err){entries.filter(e=>!e.saved).forEach(e=>e.error='雲端讀取失敗，尚未匯入：'+err.message);msg.textContent=err.message+'\n所有資料保留，可稍後按「重新檢查雲端」。';if(notify)appNotice('本次未寫入任何資料。\n'+err.message+'\n未匯入資料已保留在預覽中，可稍後重新檢查。',{title:'匯入檢查未完成',type:'danger'})}render()}
 q('[data-import-phone-region]').checked=phoneEnabled;
 q('[data-import-phone-region]').onchange=e=>{phoneEnabled=e.target.checked;render()};
 q('[data-import-check]').onclick=()=>check(true);
 q('[data-import-filter]').onchange=e=>{filter=e.target.value;page=0;render()};
 q('[data-import-select]').onclick=()=>{if(busy)return;entries.forEach(e=>{if(!e.saved)e.selected=true});render()};
 q('[data-import-deselect]').onclick=()=>{if(busy)return;entries.forEach(e=>{if(!e.saved)e.selected=false});render()};
 q('[data-import-prev]').onclick=()=>{page--;render()};q('[data-import-next]').onclick=()=>{page++;render()};
 q('[data-import-rows]').onchange=e=>{const n=e.target.dataset.importRow;if(n===undefined||busy)return;entries[n].selected=e.target.checked;render()};
 q('[data-import-rows]').onclick=e=>{
  const button=e.target.closest('[data-import-edit]');if(!button||busy)return;
  if(editingEntry){msg.textContent='請先儲存或取消目前的修改。';return}
  editingEntry=entries[Number(button.dataset.importEdit)];
  q('[data-import-editor]').innerHTML='<section class="box"><h3>修改 '+esc(editingEntry.sheet)+' 第 '+editingEntry.row+' 列</h3><p>原始表頭 → 對應欄位；遇到衝突時可清空錯誤的欄位，或修正成一致值。</p><div class="grid">'+editingEntry.fields.map((f,i)=>'<label>'+esc(f.header)+' → '+esc(CustomerImport.canonical(f.header))+'<textarea data-import-field="'+i+'">'+esc(f.value)+'</textarea></label>').join('')+'</div><button class="btn primary" type="button" data-import-apply>儲存修正並檢查</button> <button class="btn" type="button" data-import-cancel-edit>取消修改</button></section>';
  q('[data-import-apply]').onclick=()=>{dialog.querySelectorAll('[data-import-field]').forEach(el=>editingEntry.fields[Number(el.dataset.importField)].value=el.value);editingEntry.error='';editingEntry=null;q('[data-import-editor]').innerHTML='';render();dialog.scrollTop=0};
  q('[data-import-cancel-edit]').onclick=()=>{editingEntry=null;q('[data-import-editor]').innerHTML='';render();dialog.scrollTop=0};render();q('[data-import-editor]').scrollIntoView({block:'nearest'});
 };
 q('[data-import-save]').onclick=async()=>{
  if(busy||editingEntry)return;busy=true;render();
  try{
   await check(true);if(!cloudReady)return;
   const selected=validateCustomerImport(entries,cloudNames,key);if(!selected.length){msg.textContent='沒有通過檢查且已勾選的資料，請修正或取消勾選重複列。';return}
   let raw=selected.map(e=>e.values);
   if(key==='foreignEmail'){
    const byCompany=new Map();
    for(const entry of selected){
     const v=entry.values,companyKey=CustomerImport.companyKey(v['公司名稱']);
     if(!byCompany.has(companyKey))byCompany.set(companyKey,[]);
     byCompany.get(companyKey).push(v);
    }
    raw=[...byCompany.values()].map(group=>{
     const merged={...group[0]},contacts=[],seen=new Set(),names=[];
     for(const field of ['公司官網','國家／地區','地區'])if(!String(merged[field]||'').trim()){const source=group.find(item=>String(item[field]||'').trim());if(source)merged[field]=source[field]};
     for(const item of group){
      for(const contact of CustomerImport.foreignContacts(item)){
       const mail=String(contact.email||'').trim(),position=String(contact.position||'').trim(),person=String(contact.name||'').trim();
       const ident=mail.toLowerCase();
       if(!seen.has(ident)){seen.add(ident);contacts.push({name:person,email:mail,position});}
       else {const prior=contacts.find(c=>c.email.toLowerCase()===ident);if(prior&&position&&prior.position&&prior.position!==position)throw Error('同一 Email 的職位資料衝突：'+mail+'，請先修正。');if(prior&&person&&prior.name&&prior.name!==person)throw Error('同一 Email 的聯絡人姓名衝突：'+mail+'，請先修正。');if(prior&&!prior.position)prior.position=position;if(prior&&!prior.name)prior.name=person;}
       
      }
     }
     if(contacts.some(c=>!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))))throw Error('公司「'+merged['公司名稱']+'」存在格式錯誤的 Email，請先修正。');
     merged['聯絡人姓名／職位／Email']=contacts;
     merged['Email']=contacts.map(x=>x.email).join(', ');
     merged['備註']=CustomerImport.cleanForeignEmailNotes(merged['備註']);
     return merged;
    });
   }
   const mapped=key==='domestic'?mapDomesticImport(raw):mapOutreachImport(raw,key);
   if(key==='foreignEmail')mapped.forEach(row=>row.source=importSource);
   mapped.forEach((row,i)=>{const region=resolveCustomerImportRegion(raw[i],phoneEnabled).city;if(region)row[key==='domestic'?'area':'region']=region;});
   if(mapped.length!==raw.length)throw Error('資料筆數不一致，已停止寫入。');
   // Only atomic bulk insert errors are retried; completed rows are never resubmitted.
   await customerWrite(mapped,null,async()=>{const payload=key==='domestic'?mapped:mapped.map(row=>({category:key,data:row,created_by:currentProfile.id}));const {error}=await sb.from(key==='domestic'?'cold_call_records':'outreach_records').insert(payload);if(error)throw error});
   selected.forEach(e=>{e.saved=true;e.selected=false;e.error=''});render();
   filter='pending';page=0;q('[data-import-filter]').value=filter;render();appNotice('本次成功匯入 '+mapped.length+' 家公司（共 '+selected.length+' 筆來源資料），已儲存至雲端。\n尚有 '+entries.filter(e=>!e.saved).length+' 筆未匯入，可在預覽中查看原因並繼續修正。',{title:'資料匯入完成',type:'success'});
   msg.textContent='✓ 已成功匯入 '+mapped.length+' 家公司（'+selected.length+' 筆來源資料）。其餘 '+entries.filter(e=>!e.saved).length+' 筆仍保留，可繼續修正。';
   try{if(key==='domestic')await load();else await loadOutreachCloud()}catch(err){msg.textContent+='\n寫入成功，但列表重新讀取未完成：'+err.message}
  }catch(err){cloudReady=false;entries.filter(e=>e.selected&&!e.saved&&!e.issue).forEach(e=>e.error='未確認匯入：'+err.message);filter='pending';q('[data-import-filter]').value=filter;msg.textContent='匯入未完成：'+err.message+'\n資料保留。請重新檢查雲端，確認是否已存在後再試。';appNotice('本次匯入未能確認完成。\n'+err.message+'\n未匯入資料與修正內容已保留，可重新檢查後再匯入。',{title:'資料匯入未完成',type:'danger'})}finally{busy=false;render()}
 };
 const closed=new Promise(resolve=>{q('[data-import-close]').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});dialog.addEventListener('close',()=>{dialog.remove();resolve()},{once:true})});
 q('[data-import-filter]').value='pending';await check(true);return closed;
}
