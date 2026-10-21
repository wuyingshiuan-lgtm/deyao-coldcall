/* Accessible in-page notices and confirmations, shared by all business pages. */
(function(root){
 let queue=[],active=null,lastFocused=null;
 document.addEventListener("focusin",event=>{if(!event.target.closest("#deyaoNotice"))lastFocused=event.target});
 function describeNotice(value,confirming=false){
  const message=String(value??'').replace(/^[\s✓✔✅⚠️!]+/u,'').trim().replace(/！/g,'。').replace(/請截圖錯誤訊息：/g,'請確認以下原因後重試：');
  let type='info',title='系統通知',label='確認';
  if(confirming){type=/刪除|停用/.test(message)?'danger':'confirm';title=type==='danger'?'請確認此操作':'操作確認';label=type==='danger'&&/刪除/.test(message)?'確認刪除':'確認執行'}
  else if(/已存在雲端|不可重複|檔案內公司重複/.test(message)){type='warning';title='公司資料已存在'}
  else if(/失敗|未完成|錯誤|無法|不足|未確認/.test(message)){type='danger';title='操作未完成'}
  else if(/成功|已新增|已儲存|已更新|已刪除|已同步/.test(message)){type='success';title=/匯入/.test(message)?'資料匯入完成':/新增/.test(message)?'資料新增完成':/修改|更新/.test(message)?'資料更新完成':'資料儲存完成'}
  else if(/請先|不可|請填|沒有|找不到/.test(message)){type='warning';title='請確認資料內容'}
  return{message,type,title,label};
 }
 function showNext(){
  if(active||!queue.length)return;
  const item=queue.shift(),info={...describeNotice(item.message,item.confirming),...item.options},previous=document.activeElement===document.body?lastFocused:document.activeElement;
  const dialog=document.createElement('dialog');active=dialog;dialog.id='deyaoNotice';dialog.dataset.tone=info.type;
  dialog.setAttribute('aria-labelledby','deyaoNoticeTitle');dialog.setAttribute('aria-describedby','deyaoNoticeMessage');
  dialog.innerHTML='<div class="notice-brand">DEYAO PRECISION <span>業務管理系統</span></div><div class="notice-content"><div class="notice-symbol" aria-hidden="true"></div><div class="notice-copy"><p class="notice-kicker">'+(item.confirming?'操作確認':'處理結果')+'</p><h2 id="deyaoNoticeTitle"></h2><p id="deyaoNoticeMessage"></p></div></div><div class="notice-footer"><span class="notice-footnote"></span><div class="notice-actions"></div></div>';
  dialog.querySelector('h2').textContent=info.title;dialog.querySelector('#deyaoNoticeMessage').textContent=info.message;
  dialog.querySelector('.notice-symbol').textContent=info.type==='success'?'✓':info.type==='danger'?'!':info.type==='warning'?'!':'i';
  dialog.querySelector('.notice-footnote').textContent=item.confirming?'請確認內容後再執行。':'確認後可繼續操作。';
  const actions=dialog.querySelector('.notice-actions');let result=false;
  const finish=accepted=>{result=accepted;dialog.close()};
  if(item.confirming){const cancel=document.createElement('button');cancel.type='button';cancel.className='notice-button notice-secondary';cancel.textContent='取消';cancel.onclick=()=>finish(false);actions.appendChild(cancel)}
  const ok=document.createElement('button');ok.type='button';ok.className='notice-button notice-primary';ok.textContent=item.confirming?info.label:'我已了解';ok.onclick=()=>finish(true);actions.appendChild(ok);
  dialog.addEventListener('close',()=>{dialog.remove();active=null;item.resolve(result);if(previous?.isConnected&&!previous.disabled)previous.focus();showNext()},{once:true});
  document.body.appendChild(dialog);dialog.showModal();(item.confirming?actions.firstElementChild:ok).focus();
 }
 function enqueue(message,confirming,options={}){return new Promise(resolve=>{queue.push({message,confirming,options,resolve});showNext()})}
 root.appNotice=(message,options={})=>enqueue(message,false,options);root.appConfirm=message=>enqueue(message,true);root.describeNotice=describeNotice;
 const style=document.createElement('style');style.textContent=`
 #deyaoNotice{box-sizing:border-box;width:min(540px,calc(100vw - 32px));max-height:85vh;padding:0;border:1px solid #d7dee8;border-radius:16px;background:#fff;color:#26364a;box-shadow:0 24px 80px #11243b40;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;text-align:left;overflow:auto}
 #deyaoNotice::backdrop{background:#172b4280;backdrop-filter:blur(3px)}
 #deyaoNotice .notice-brand{padding:18px 24px;border-bottom:1px solid #e8edf3;font-size:12px;font-weight:700;letter-spacing:1.4px;color:#233f60;display:flex;justify-content:space-between;gap:12px}
 #deyaoNotice .notice-brand span{font-size:12px;font-weight:400;letter-spacing:.4px;color:#718096}
 #deyaoNotice .notice-content{display:flex;align-items:flex-start;gap:18px;padding:30px 26px}
 #deyaoNotice .notice-symbol{display:flex;align-items:center;justify-content:center;flex:0 0 44px;height:44px;border-radius:50%;font-size:23px;font-weight:600;background:#edf2f8;color:#315a83}
 #deyaoNotice[data-tone=success] .notice-symbol{background:#e7f3ef;color:#226e58}
 #deyaoNotice[data-tone=warning] .notice-symbol{background:#fff4df;color:#906219}
 #deyaoNotice[data-tone=danger] .notice-symbol{background:#fbecee;color:#a03c4b}
 #deyaoNotice .notice-copy{min-width:0}#deyaoNotice .notice-kicker{margin:0 0 5px;color:#738299;font-size:12px;font-weight:500;letter-spacing:1px}
 #deyaoNotice h2{margin:0 0 12px;font-size:22px;line-height:1.4;color:#213a55;font-weight:700;letter-spacing:.3px}
 #deyaoNotice #deyaoNoticeMessage{margin:0;color:#526176;font-size:15px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere}
 #deyaoNotice .notice-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 24px;background:#f8fafc;border-top:1px solid #e8edf3}
 #deyaoNotice .notice-footnote{font-size:12px;color:#7a8696}#deyaoNotice .notice-actions{display:flex;gap:10px;flex-shrink:0}
 #deyaoNotice .notice-button{font:inherit;font-size:14px;font-weight:600;padding:10px 22px;min-height:42px;border-radius:8px;cursor:pointer;box-shadow:none;transform:none;white-space:nowrap}
 #deyaoNotice .notice-primary{color:white;background:#294c70;border:1px solid #294c70}#deyaoNotice .notice-secondary{background:white;color:#465a70;border:1px solid #ccd5e1}
 #deyaoNotice .notice-button:hover{filter:brightness(.95)}#deyaoNotice .notice-button:focus-visible{outline:3px solid #85b4e4;outline-offset:3px}
 #deyaoNotice[data-tone=danger] .notice-primary{background:#934352;border-color:#934352}
 @media(max-width:480px){#deyaoNotice .notice-brand{padding:16px}#deyaoNotice .notice-content{padding:24px 18px;gap:12px}#deyaoNotice .notice-footer{padding:16px;flex-wrap:wrap}#deyaoNotice h2{font-size:20px}#deyaoNotice .notice-symbol{flex-basis:36px;height:36px}#deyaoNotice .notice-actions{margin-left:auto}}
 `;document.head.appendChild(style);
})(window);
