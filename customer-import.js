/* Shared, exact header aliases. Ambiguous columns never silently overwrite data. */
(function(root){
 const groups={
 '公司名稱':['公司','公司名','廠商','廠商名稱','company','company name','company_name'],
 '聯絡人':['聯繫人','聯絡姓名','採購','contact','contact_name'],
 '職位':['職稱','職位／部門','所屬職位／部門','position','title'],
 '電話':['聯繫電話','聯絡電話','公司電話','phone','tel'],
 '傳真電話':['傳真','fax','fax_phone'],
 'Email':['電子郵件','電郵','mail','email','e-mail','Mail（彙整）'],
 '公司地址':['地址','address','company_address'],
 '公司官網':['官網','網站','網址','website'],
 '產業類別':['產業','產業分類','industry'],
 '分機':['extension','ext'],
 '地區':['區域','縣市','縣市區域','公司地區','region','area'],
 '是否適合拜訪':['適合拜訪','拜訪公司','visitSuitable'],
 '是否已寄送Mail':['是否寄送Email','emailSent'],
 '電訪日期':['visit_date'],
 '開發日期':['開發時間'],
 '備註':['備註說明','notes','remark'],
 '紀錄者':['recorder'],
 '國家／地區':['國家','country'],
 '展覽名稱':['event'],
 '開發信寄出日期':['寄出日期'],
 '開發來源':['source']
 };
 const headerKey=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/[\s／/（）()_\-]/g,'');
 const companyKey=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,'');
 const lookup=new Map();for(const [label,aliases] of Object.entries(groups))for(const a of [label,...aliases])lookup.set(headerKey(a),label);
 const canonical=v=>lookup.get(headerKey(v))||String(v).trim();
 function mapRows(raw){
  const headers=[...new Set(raw.flatMap(r=>Object.keys(r)))],hasCompany=headers.some(h=>canonical(h)==='公司名稱');
  const errors=[],rows=[],mapping=headers.map(h=>h+' → '+canonical(h));
  raw.forEach((row,i)=>{const out={};for(const [h,v] of Object.entries(row)){const k=canonical(h);if(String(v??'').trim()==='')continue;if(out[k]!=null&&String(out[k]).trim()!==String(v).trim()){errors.push('第 '+(i+2)+' 列「'+k+'」有多個不同值，請先整理欄位');continue}out[k]=v}if(!Object.keys(out).length)return;if(!String(out['公司名稱']??'').trim()){errors.push('第 '+(i+2)+' 列缺少公司名稱');return}rows.push(out)});
  return{hasCompany,rows,mapping,errors:errors.slice(0,10)};
 }
 function valueFor(row,label,field){const k=canonical(label);return row[k]??row[field]??(field==='date'?(row['電訪日期']??row['開發日期']??row['開發信寄出日期']):undefined)??(field==='location'?row['國家／地區']:undefined)??''}
 function preserveExtra(row,labels,notes){const supported=new Set(labels.map(canonical));const extra=Object.entries(row).filter(([k,v])=>!supported.has(k)&&String(v??'').trim()).map(([k,v])=>k+'：'+v);return [String(notes??'').trim(),...extra].filter(Boolean).join('\n')}
 function booleanValue(value){const text=String(value??'').normalize('NFKC').trim().toLowerCase();return ['是','true','1','yes','y','v','✓','✔','適合','適合拜訪','已寄送'].includes(text)?'true':'false'}
 root.CustomerImport={companyKey,canonical,mapRows,valueFor,preserveExtra,booleanValue};
})(typeof window!=='undefined'?window:globalThis);
