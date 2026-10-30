/* Original contact data is independent from subsequent contact entries. */
(function(root){
 function date(value){
  const raw=String(value??'').normalize('NFKC').trim();let y,m,d,match;
  if((match=raw.match(/^(\d{4})[-/年](\d{1,2})月?$/))&&+match[2]>=1&&+match[2]<=12)return match[1]+'-'+match[2].padStart(2,'0');
  if((match=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[ T])/)))[,y,m,d]=match;
  else if((match=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))){m=match[1];d=match[2];y=match[3].length===2?'20'+match[3]:match[3]}
  else return raw;
  const check=new Date(Date.UTC(+y,+m-1,+d));
  return check.getUTCFullYear()===+y&&check.getUTCMonth()===+m-1&&check.getUTCDate()===+d?y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0'):raw;
 }
 function initial(row,key){
  const saved=row._initialContact&&typeof row._initialContact==='object'?row._initialContact:null;
  const legacy=(Array.isArray(row.contactHistory)?row.contactHistory:[]).find(h=>h.initial===true||h.first===true);
  const original=saved||legacy;
  const originalDate=key==='domestic'?row.visit_date:key==='exhibitions'?(row.contactDate||row.date):row.date;
  return {date:date(original?.date??originalDate??''),notes:original?.notes??row.notes??'',recorder:original?.recorder??row.recorder??'',result:original?.result||'首次開發（原始開發紀錄）'};
 }
 function parts(row){
  const history=Array.isArray(row?.contactHistory)?row.contactHistory:[];
  const firstDate=date(row?._initialContact?.date??row?.date??'');
  const initialIndex=history.findIndex(h=>h.initial===true||h.first===true||(!String(h.result||'').trim()&&firstDate&&date(h.date)===firstDate&&String(h.notes??'')===String(row?.notes??'')));
  return {initial:initialIndex>=0?history[initialIndex]:null,followups:history.filter((h,i)=>i!==initialIndex)};
 }
 async function append(client,key,id,values){
  const {data,error}=await client.rpc('append_contact_history',{p_category:key,p_record_id:String(id),p_date:date(values.date),p_result:values.result,p_notes:values.notes??'',p_entry_id:values.id});
  if(error)throw error;if(!data||!['saved','skip'].includes(data.status))throw Error('雲端未確認新增成功');return data;
 }
 root.ContactHistoryTools={date,initial,parts,append};
 if(typeof module!=='undefined')module.exports=root.ContactHistoryTools;
})(typeof window==='undefined'?globalThis:window);
