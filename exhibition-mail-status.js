/* Exhibition mailing status: update existing customers by email, never insert duplicates. */
(function(root){
 const statuses=['','取消訂閱','退件'];
 const emails=value=>[...new Set((String(value??'').match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}/gi)||[]).map(x=>x.toLowerCase()))];
 const rowEmails=row=>emails([row.email,...(Array.isArray(row.emails)?row.emails.map(x=>typeof x==='string'?x:x.email):[])].join(';'));
 function matchRows(raw,cloud){
  const index=new Map();for(const r of cloud)for(const email of rowEmails(r.data||{})){if(!index.has(email))index.set(email,[]);index.get(email).push(r)}
  const seen=new Set();return raw.map(source=>{const found=new Map();for(const email of source.emails)for(const r of index.get(email)||[])found.set(String(r.id),r);const matches=[...found.values()];let issue=!source.emails.length?'缺少有效 Email':!matches.length?'找不到客戶':matches.length>1?'符合多筆客戶，請先確認 Email 歸屬':'';const target=matches.length===1?matches[0]:null;if(!issue&&seen.has(String(target.id)))issue='本檔案重複客戶，已略過';if(target&&!issue)seen.add(String(target.id));return {...source,target,issue,selected:!issue,saved:false}});
 }
 async function saveStatus(client,id,status,expectedEmails,category='exhibitions'){
  if(!['exhibitions','foreignEmail'].includes(category))throw Error('無效客戶分類');
  if(!statuses.includes(status))throw Error('請選擇有效狀態');
  const {data:row,error}=await client.from('outreach_records').select('id,data').eq('category',category).eq('id',id).single();if(error)throw error;if(!row?.data)throw Error('找不到客戶');
  if(expectedEmails&&!rowEmails(row.data).some(x=>expectedEmails.includes(x)))throw Error('客戶 Email 已變更，請重新匯入比對');
  if((row.data.mailStatus||'')!==status){const {data:saved,error:writeError}=await client.from('outreach_records').update({data:{...row.data,mailStatus:status}}).eq('category',category).eq('id',id).eq('data',JSON.stringify(row.data)).select('id').maybeSingle();if(writeError)throw writeError;if(!saved)throw Error('資料已由其他操作更新，請重試');}
  const {data:verified,error:verifyError}=await client.from('outreach_records').select('id,data').eq('category',category).eq('id',id).single();if(verifyError)throw verifyError;if((verified?.data?.mailStatus||'')!==status)throw Error('雲端狀態驗證未完成，請重新檢查');
 }
 root.ExhibitionMailStatus={emails,rowEmails,matchRows,saveStatus};
 if(typeof document==='undefined')return;
 for(const category of ['exhibitions','foreignEmail']){
 const label=category==='foreignEmail'?'國外 Email':'展覽';
 const section=document.getElementById(category==='foreignEmail'?'foreignEmailCustomerSection':'exhibitionsCustomerSection'),form=document.getElementById(category==='foreignEmail'?'foreignEmailForm':'exhibitionsForm');if(!section||!form)continue;
 const recorder=form.querySelector('[name="recorder"]')?.closest('div');if(recorder){const field=document.createElement('div');field.innerHTML='<label for="'+category+'MailStatus">狀態</label><select id="'+category+'MailStatus" name="mailStatus"><option value="">未標記</option><option>取消訂閱</option><option>退件</option></select>';recorder.before(field)}
 const actions=document.createElement('div');actions.className='actions';actions.innerHTML='<button type="button" class="btn" data-mail-status-import>匯入 Mail 更新狀態</button><input type="file" accept=".xlsx,.xls,.csv" hidden data-mail-status-file><label>狀態篩選 <select data-mail-status-filter><option value="all">全部狀態</option><option value="">未標記</option><option>取消訂閱</option><option>退件</option></select></label>';
 section.querySelector('h2').after(actions);const file=actions.querySelector('input');
 actions.querySelector('button').onclick=()=>{if(currentProfile?.role!=='admin'){appNotice('只有管理員可以匯入更新狀態。');return}file.click()};
 actions.querySelector('select').onchange=()=>renderOutreachRecords(category,outreachTarget(category));
 if(category==='foreignEmail'){
  const excel=document.getElementById('foreignEmailExcelSection')?.querySelector('.excel-actions');
  if(excel){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='匯入 Email 更新狀態';button.onclick=()=>actions.querySelector('[data-mail-status-import]').click();excel.append(button)}
 }

 file.onchange=async()=>{const selectedFile=file.files[0];file.value='';if(!selectedFile)return;try{if(!root.XLSX)throw Error('Excel 元件未載入，請重新整理');const wb=XLSX.read(await selectedFile.arrayBuffer(),{type:'array'}),raw=[];for(const sheet of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:'',raw:false});const cols=(rows[0]||[]).map((h,i)=>({h:CustomerImport.canonical(h),i})).filter(c=>c.h==='Email'||/^(電子信箱|emailaddress|e-mailaddress|recipient|收件人)$/i.test(String(rows[0][c.i]).replace(/\s/g,'')));if(!cols.length)continue;rows.slice(1).forEach((r,i)=>{if(r.some(x=>String(x).trim()))raw.push({sheet,line:i+2,emails:emails(cols.map(c=>r[c.i]).join(';'))})})}if(!raw.length)throw Error('找不到 Email 資料，請使用「Email」、「Mail」或「電子信箱」欄位');const cloud=(await readAllCompanyRows('outreach_records','id,category,data')).filter(r=>r.category===category);openPreview(matchRows(raw,cloud));}catch(err){appNotice('匯入狀態未完成：'+err.message)}};
 function openPreview(entries){
  const dialog=document.createElement('dialog');dialog.style.cssText='width:min(1100px,94vw);max-height:90vh;overflow:auto;border:1px solid #cedbea;border-radius:16px;padding:24px';dialog.setAttribute('aria-labelledby','mailStatusTitle');dialog.innerHTML='<h2 id="mailStatusTitle">匯入 Mail 更新'+label+'客戶狀態</h2><p>依 Email 比對既有'+label+'客戶，可重複匯入。只更新狀態，保留客戶資料與聯繫紀錄。找不到、多筆符合及重複客戶不會自動更新。</p><label>本次統一更新為 <select data-status><option value="">請選擇狀態</option><option>取消訂閱</option><option>退件</option></select></label><div class="actions"><button class="btn" data-all>全選可更新</button><button class="btn" data-none>取消全選</button></div><p data-summary role="status" style="white-space:pre-wrap"></p><div class="table-wrap" style="max-height:45vh;overflow:auto"><table class="data-table"><thead><tr><th>勾選</th><th>來源列</th><th>Email</th><th>公司名稱</th><th>目前狀態</th><th>檢查結果</th></tr></thead><tbody></tbody></table></div><div class="actions"><button class="btn primary" data-save>更新已勾選客戶狀態</button><button class="btn" data-close>關閉</button></div>';
  const q=s=>dialog.querySelector(s);let busy=false;
  function render(){q('tbody').innerHTML=entries.map((e,i)=>'<tr><td><input type="checkbox" data-entry="'+i+'" aria-label="選取第 '+e.line+' 列" '+(e.selected?'checked ':'')+(e.saved||e.issue||busy?'disabled':'')+'></td><td>'+esc(e.sheet)+' / '+e.line+'</td><td>'+esc(e.emails.join('; '))+'</td><td>'+esc(e.target?.data?.company||'—')+'</td><td>'+esc(e.target?.data?.mailStatus||'未標記')+'</td><td>'+esc(e.saved?'已更新':e.error||e.issue||'可更新')+'</td></tr>').join('');q('[data-save]').disabled=busy||!q('[data-status]').value||!entries.some(e=>e.selected&&!e.saved&&!e.issue);q('[data-summary]').textContent='共 '+entries.length+' 列｜已勾選 '+entries.filter(e=>e.selected&&!e.saved&&!e.issue).length+' 家｜已更新 '+entries.filter(e=>e.saved).length+' 家';dialog.querySelectorAll('button,select').forEach(b=>{if(!b.matches('[data-save]'))b.disabled=busy})}
  q('tbody').onchange=e=>{if(e.target.matches('[data-entry]')){entries[Number(e.target.dataset.entry)].selected=e.target.checked;render()}};q('[data-status]').onchange=render;
  q('[data-all]').onclick=()=>{entries.forEach(e=>e.selected=!e.saved&&!e.issue);render()};q('[data-none]').onclick=()=>{entries.forEach(e=>e.selected=false);render()};q('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});dialog.addEventListener('close',()=>dialog.remove());
  q('[data-save]').onclick=async()=>{if(busy||currentProfile?.role!=='admin')return;const status=q('[data-status]').value;if(!statuses.includes(status)||!status)return;const pending=entries.filter(e=>e.selected&&!e.saved&&!e.issue);if(!pending.length)return;busy=true;render();for(const entry of pending){try{await saveStatus(sb,entry.target.id,status,entry.emails,category);entry.saved=true;entry.selected=false;entry.error='';entry.target.data.mailStatus=status;}catch(err){entry.error='更新未完成：'+err.message}}let refreshError='';try{await loadOutreachCloud()}catch(err){refreshError='\n列表重新載入未完成：'+err.message}busy=false;render();q('[data-summary]').textContent+='\n本次成功 '+pending.filter(e=>e.saved).length+' 家、未完成 '+pending.filter(e=>!e.saved).length+' 家。'+refreshError;};
  document.body.append(dialog);dialog.showModal();render();
 }
 }
})(typeof window!=='undefined'?window:globalThis);
