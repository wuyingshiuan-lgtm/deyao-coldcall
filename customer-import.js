/* Shared, exact header aliases. Ambiguous columns never silently overwrite data. */
(function(root){
 const groups={
 '公司名稱':['名稱','公司','公司名','廠商','廠商名稱','company','company name','company_name'],
 '聯絡人':['聯絡人姓名','聯繫人姓名','Name','聯繫人','聯絡姓名','採購','contact','contact_name'],
 '職位':['Position/Type','職稱','職位／部門','所屬職位／部門','position','title'],
 '電話':['聯繫電話','聯絡電話','公司電話','phone','tel'],
 '傳真電話':['傳真','fax','fax_phone'],
 '聯絡人姓名／職位／Email':['Mail／所屬職位','Email／職位'],
 'Email':['電子信箱','電子郵箱','Email Address','E-mail Address','Emails','電子郵件','電郵','mail','email','e-mail','Mail（彙整）'],
 '公司地址':['地址','address','company_address'],
 '公司官網':['官網','官方網站','網站','網址','website','web site','url'],
 '產業類別':['產業','產業分類','industry'],
 '分機':['extension','ext'],
 '地區':['區域','縣市','縣市區域','公司地區','region','area'],
 '是否適合拜訪':['適合拜訪','拜訪公司','visitSuitable'],
 '是否已寄送Mail':['是否寄送Email','emailSent'],
 '電訪日期':['visit_date'],
 '開發日期':['開發時間'],
 '備註':['備註說明','notes','remark'],
 '紀錄者':['recorder'],
 '國家／地區':['國家/城市','國家','country'],
 '展覽名稱':['event'],
 '開發信寄出日期':['寄出日期'],
 '開發來源':['source']
 };

 // Match full place names/tokens, never substrings such as "US" inside a company name.
 const placeKey=v=>String(v??'').normalize('NFKC').toLocaleLowerCase().replace(/\./g,'').replace(/\s+/g,' ').trim();
 const countryAliases=new Map(),placeCountries=new Map();
 function addCountry(code,names,places=[]){
  for(const name of names)countryAliases.set(placeKey(name),code);
  for(const place of places){const k=placeKey(place);if(!placeCountries.has(k))placeCountries.set(k,new Set());placeCountries.get(k).add(code)}
 }
 const countryNames={US:'美國',GB:'英國',TW:'台灣',CN:'中國',JP:'日本',KR:'韓國',DE:'德國',FR:'法國',CA:'加拿大',AU:'澳洲',NZ:'紐西蘭',VN:'越南',TH:'泰國',MY:'馬來西亞',SG:'新加坡',IN:'印度',ID:'印尼',PH:'菲律賓',IT:'義大利',ES:'西班牙',NL:'荷蘭',CH:'瑞士',AE:'阿拉伯聯合大公國',TR:'土耳其',ZA:'南非'};
 const displays=['zh-Hant','en'].map(locale=>new Intl.DisplayNames([locale],{type:'region'}));
 // Intl supplies localized country names; codes are accepted only as complete tokens.
 for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const code=String.fromCharCode(a,b),en=displays[1].of(code);
  if(en&&en!==code){const zh=countryNames[code]||displays[0].of(code);countryNames[code]=zh;addCountry(code,[code,en,zh])}
 }
 addCountry('US',['USA','U.S.A.','U.S.','United States of America','美利堅合眾國'],[
 'Ramsey','Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia','Los Angeles','San Francisco','San Diego','San Jose','Chicago','Houston','Dallas','Boston','Seattle','Detroit','Minneapolis','加州','加利福尼亞','明尼蘇達','紐澤西','紐約','德州','新澤西'
 ]);
 addCountry('GB',['UK','U.K.','United Kingdom','Great Britain'],['England','Scotland','Wales','Northern Ireland','London','Manchester','Birmingham','Leeds','Liverpool','Bristol','Sheffield','Edinburgh','Glasgow','倫敦','英格蘭','蘇格蘭']);
 addCountry('JP',[],['Tokyo','Osaka','Nagoya','Kyoto','Yokohama','Fukuoka','Kobe','東京','大阪','名古屋','京都','橫濱','福岡']);
 addCountry('DE',[],['Berlin','Munich','München','Hamburg','Frankfurt','Stuttgart','Düsseldorf','Dusseldorf','Cologne','Köln','Bavaria','Baden-Württemberg','柏林','慕尼黑','漢堡','法蘭克福']);
 addCountry('FR',[],['Paris','Lyon','Marseille','Toulouse','Bordeaux','巴黎','里昂']);
 addCountry('CA',[],['Ontario','Quebec','Québec','British Columbia','Alberta','Toronto','Vancouver','Montreal','Montréal','Ottawa','Calgary','多倫多','溫哥華','安大略']);
 addCountry('AU',[],['New South Wales','Queensland','Western Australia','South Australia','Tasmania','Sydney','Melbourne','Brisbane','Perth','Adelaide','雪梨','悉尼','墨爾本']);
 addCountry('NZ',['New Zealand'],['Auckland','Wellington','Christchurch','奧克蘭']);
 addCountry('KR',['South Korea','Republic of Korea','南韓'],['Seoul','Busan','Incheon','Gyeonggi','首爾','釜山','仁川']);
 addCountry('TW',['Taiwan','臺灣'],['Taipei','New Taipei','Taichung','Tainan','Kaohsiung','Hsinchu','台北','臺北','新北','台中','臺中','台南','臺南','高雄','新竹']);
 addCountry('CN',['PRC','People’s Republic of China','中國大陸'],['Beijing','Shanghai','Shenzhen','Guangzhou','Dongguan','Suzhou','Zhejiang','Jiangsu','Guangdong','北京','上海','深圳','廣州','東莞','蘇州','浙江','江蘇','廣東']);
 addCountry('VN',[],['Hanoi','Ho Chi Minh City','Ho Chi Minh','Haiphong','Binh Duong','河內','胡志明市','平陽']);
 addCountry('TH',[],['Bangkok','Chonburi','Rayong','Samut Prakan','曼谷','春武里','羅勇']);
 addCountry('MY',[],['Kuala Lumpur','Penang','Johor','Selangor','吉隆坡','檳城','柔佛','雪蘭莪']);
 addCountry('IN',[],['Mumbai','Delhi','New Delhi','Bengaluru','Bangalore','Chennai','Pune','Gujarat','Maharashtra','Tamil Nadu','孟買','新德里','班加羅爾']);
 addCountry('ID',[],['Jakarta','Surabaya','Bekasi','Tangerang','雅加達','泗水']);
 addCountry('PH',[],['Manila','Cebu','馬尼拉','宿霧']);
 addCountry('IT',[],['Milan','Milano','Rome','Roma','Turin','Torino','Bologna','Brescia','米蘭','羅馬','都靈']);
 addCountry('ES',[],['Madrid','Barcelona','Valencia','馬德里','巴塞隆納']);
 addCountry('NL',[],['Amsterdam','Rotterdam','Eindhoven','阿姆斯特丹','鹿特丹']);
 addCountry('CH',[],['Zurich','Zürich','Geneva','Basel','蘇黎世','日內瓦']);
 addCountry('AE',['UAE'],['Dubai','Abu Dhabi','杜拜','阿布達比']);
 addCountry('TR',['Türkiye'],['Istanbul','Ankara','Izmir','伊斯坦堡','安卡拉']);
 addCountry('ZA',[],['Johannesburg','Cape Town','Durban','約翰尼斯堡','開普敦']);
 function detectImportCountry(value){
  const text=placeKey(value);if(!text)return '';
  if(countryAliases.has(text))return countryNames[countryAliases.get(text)];
  const parts=text.split(/[,，;；|/()（）\n]+/).map(x=>x.trim()).filter(Boolean);
  // An explicit country takes precedence over cities or states with the same name.
  const explicit=new Set(parts.map(x=>countryAliases.get(x)).filter(Boolean));
  if(explicit.size===1)return countryNames[[...explicit][0]];
  if(explicit.size>1)return '';
  const found=new Set();
  for(const [place,codes] of placeCountries){
   const escaped=place.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
   const match=/[a-z]/i.test(place)?new RegExp('(?:^|[^a-z])'+escaped+'(?:$|[^a-z])','i').test(text):parts.includes(place);
   if(match)for(const code of codes)found.add(code);
  }
  return found.size===1?countryNames[[...found][0]]:'';
 }
 function foreignCountryFor(row){return detectImportCountry(row['國家／地區'])||detectImportCountry(row['地區'])}

 function foreignContacts(row){
  const paired=row['聯絡人姓名／職位／Email'];
  const contacts=Array.isArray(paired)?paired.map(c=>({...c})):String(paired??'').split(/[;；\n]+/).filter(x=>x.trim()).map(item=>{
   const legacy=item.trim().match(/^(.*?)（(.*?)）$/);
   if(legacy)return {name:'',position:legacy[2].trim(),email:legacy[1].trim()};
   const parts=item.split('／').map(x=>x.trim()),email=parts.pop()||'';
   return {name:parts.length>1?parts[0]:'',position:parts.length>1?parts.slice(1).join('／'):parts[0]||'',email};
  });
  const seen=new Set(contacts.map(c=>String(c.email||'').toLowerCase()));
  for(const email of String(row['Email']??'').split(/[,，;；\n]+/).map(x=>x.trim()).filter(Boolean)){
   if(!seen.has(email.toLowerCase())){contacts.push({name:String(row['聯絡人']||''),position:String(row['職位']||''),email});seen.add(email.toLowerCase())}
  }
  return contacts;
 }

 function cleanForeignEmailNotes(value){
  const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n'),kept=[];let pairing=false;
  const metadata=/^(?:From|職位|類型|ID|電話|Domain)\s*[:：]/i;
  for(const line of lines){
   const marker=line.indexOf('聯絡人配對資料');
   if(marker>=0&&/^聯絡人配對資料\s*[:：]/.test(line.slice(marker))){
    const prefix=line.slice(0,marker).trimEnd();if(prefix)kept.push(prefix);pairing=true;continue;
   }
   const text=line.trim();
   if(metadata.test(text))continue;
   if(pairing){
    if(!text)continue;
    if(/^[^｜|\n]*[｜|][^｜|\s]+@[^｜|\s]+[｜|]/.test(text))continue;
    pairing=false;
   }
   kept.push(line);
  }
  return kept.join('\n').trim();
 }

 function normalizeImportDate(value){
  const raw=String(value??'').normalize('NFKC').trim();
  const match=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?=$|[T\s])/);
  if(!match)return raw;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw Error('無效日期：'+raw);
  return match[1]+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
 }

 const headerKey=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/[\s\u200B-\u200D\u2060\uFEFF／/（）()_\-]/g,'');
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
 const companyPages={domestic:'國內電訪-客戶名單',foreignEmail:'國外Email-開發客戶名單',exhibitions:'國內外展覽-客戶名單',prospecting:'陌生開發拜訪-客戶名單'};
 function companyLocations(domestic,outreach,exclude){
  const locations=new Map();
  const add=(table,row,name,category)=>{if(exclude&&exclude.table===table&&String(exclude.id)===String(row.id))return;const key=companyKey(name);if(!key)return;if(!locations.has(key))locations.set(key,new Set());locations.get(key).add(companyPages[category]||'其他客戶分頁')};
  domestic.forEach(r=>add('cold_call_records',r,r.company_name,'domestic'));
  outreach.forEach(r=>add('outreach_records',r,r.data?.company,r.category));
  return locations;
 }
 function duplicateMessage(name,pages){return '公司名稱「'+String(name).trim()+'」已存在雲端資料內，不可重複新增。\n所在分頁：'+[...pages].join('、')+'。\n請至上述分頁，以公司名稱搜尋原有資料。'}
 root.CustomerImport={foreignContacts,normalizeImportDate,cleanForeignEmailNotes,detectImportCountry,foreignCountryFor,companyLocations,duplicateMessage,companyKey,canonical,mapRows,valueFor,preserveExtra,booleanValue};
})(typeof window!=='undefined'?window:globalThis);

