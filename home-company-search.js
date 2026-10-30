/* Home company lookup uses authenticated cloud reads and never changes records. */
(function(){
 'use strict';
 const categories=[['domestic','國內電訪'],['foreignEmail','國外 Email'],['exhibitions','國內外展覽'],['prospecting','陌生開發拜訪']];
 function normalize(value){return String(value??'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'').trim()}
 function findCompanies(domestic,outreach,query){
  const term=normalize(query);if(!term)return [];
  const rows=domestic.map(row=>({key:'domestic',row}));
  outreach.forEach(record=>{if(categories.some(([key])=>key===record.category)&&record.category!=='domestic')rows.push({key:record.category,row:{...record.data,_cloudId:record.id,_createdAt:record.created_at}})});
  return rows.filter(({key,row})=>normalize(key==='domestic'?row.company_name:row.company).includes(term)).sort((a,b)=>String(a.row.company_name||a.row.company||'').localeCompare(String(b.row.company_name||b.row.company||''),'zh-Hant'));
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={normalize,findCompanies};
 if(typeof document==='undefined')return;
 const home=document.getElementById('homeSection');if(!home)return;
 const panel=document.createElement('section');panel.className='home-company-search';panel.setAttribute('aria-labelledby','homeCompanySearchTitle');
 panel.innerHTML='<h3 id="homeCompanySearchTitle">搜尋公司資料</h3><p class="meta">輸入公司名稱，搜尋國內電訪、國外 Email、國內外展覽及陌生開發拜訪的全部資料，不限日期。</p><form role="search" aria-label="公司名稱搜尋"><label for="homeCompanyQuery">公司名稱</label><div class="home-company-search-bar"><input id="homeCompanyQuery" type="search" placeholder="輸入完整或部分公司名稱…" autocomplete="off" required><button class="btn primary" type="submit">搜尋公司</button><button class="btn" type="button" data-search-clear>清除</button></div></form><p class="home-company-search-status" role="status" aria-live="polite">輸入公司名稱後，按搜尋或 Enter 即可查詢。</p><div class="home-company-search-results"></div><nav class="home-company-search-pages" aria-label="公司搜尋結果分頁"></nav>';
 home.querySelector('.home-workspace-label').before(panel);
 const form=panel.querySelector('form'),input=panel.querySelector('input'),submit=form.querySelector('[type="submit"]'),status=panel.querySelector('[role="status"]'),results=panel.querySelector('.home-company-search-results'),pagination=panel.querySelector('nav');
 let matches=[],page=0,request=0,searchedTerm='';const pageSize=20;
 function detailMarkup({key,row}){
  const known=reportFields(key),extra=Object.keys(row).filter(field=>!field.startsWith('_')&&!['id','created_at','createdAt','updated_at','updatedAt','created_by','updated_by','contactHistory'].includes(field)&&!known.some(([name])=>name===field)).map(field=>[field,field]);
  return '<div class="home-company-fields">'+[...known,...extra].map(([field,label])=>{
   let value=row[field];if(field==='emails'&&Array.isArray(value))value=value.map(contact=>[contact.name,contact.position,contact.email].filter(Boolean).join('／')).join('\n');
   const text=['visit_suitable','visitSuitable'].includes(field)?CustomerImport.visitLabel(value):reportValue(value)||'—';let link='';
   if(field==='website'&&value){const raw=String(value).trim();try{const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(raw)?raw:'https://'+raw);if(['http:','https:'].includes(url.protocol))link='<a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">開啟官網 ↗</a>'}catch{}}
   return '<div><span>'+esc(label)+'</span><strong>'+esc(text)+'</strong>'+link+'</div>';
  }).join('')+'</div>';
 }
 function renderResults(){
  status.textContent='「'+searchedTerm+'」共找到 '+matches.length+' 筆資料'+(matches.length?'；點擊公司名稱查看詳細資料。':'，請嘗試其他公司名稱。');
  results.innerHTML=matches.slice(page*pageSize,(page+1)*pageSize).map(item=>'<details class="home-company-result"><summary><span class="home-company-name">'+esc(item.row.company_name||item.row.company||'未命名公司')+'</span><span class="home-company-category">'+esc(categories.find(([key])=>key===item.key)[1])+'</span><span class="home-company-open">查看詳細資料</span></summary>'+detailMarkup(item)+'</details>').join('');
  const total=Math.ceil(matches.length/pageSize);pagination.innerHTML=total>1?'<button class="btn" type="button" data-search-page="-1" '+(page===0?'disabled':'')+'>上一頁</button><span>第 '+(page+1)+'／'+total+' 頁</span><button class="btn" type="button" data-search-page="1" '+(page===total-1?'disabled':'')+'>下一頁</button>':'';
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();const query=input.value.trim();if(!normalize(query)){status.textContent='請輸入公司名稱。';input.focus();return}
  if(!currentProfile||!sb){status.textContent='請先登入後再搜尋公司資料。';return}
  const generation=++request,profile=currentProfile;submit.disabled=true;panel.setAttribute('aria-busy','true');status.textContent='正在搜尋各分類的最新雲端資料…';results.innerHTML='';pagination.innerHTML='';
  try{
   const [domestic,outreach]=await Promise.all([fetchAllReportRows('cold_call_records','*'),fetchAllReportRows('outreach_records','id,category,data,created_at',['foreignEmail','exhibitions','prospecting'])]);
   if(generation!==request||currentProfile!==profile)return;
   matches=findCompanies(domestic,outreach,query);searchedTerm=query;page=0;renderResults();
  }catch(error){if(generation===request){matches=[];status.textContent='搜尋失敗：'+(error.message||'請稍後再試')+'。請重新按搜尋重試。'}}
  finally{if(generation===request){submit.disabled=false;panel.removeAttribute('aria-busy')}}
 });
 panel.querySelector('[data-search-clear]').addEventListener('click',()=>{request++;input.value='';matches=[];page=0;submit.disabled=false;panel.removeAttribute('aria-busy');results.innerHTML='';pagination.innerHTML='';status.textContent='輸入公司名稱後，按搜尋或 Enter 即可查詢。';input.focus()});
 pagination.addEventListener('click',event=>{const button=event.target.closest('[data-search-page]');if(!button||button.disabled)return;page+=Number(button.dataset.searchPage);renderResults();panel.scrollIntoView({block:'start',behavior:'smooth'})});
 if(sb?.auth?.onAuthStateChange)sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){request++;matches=[];results.innerHTML='';pagination.innerHTML='';input.value='';submit.disabled=false;panel.removeAttribute('aria-busy');status.textContent='輸入公司名稱後，按搜尋或 Enter 即可查詢。'}});
})();
