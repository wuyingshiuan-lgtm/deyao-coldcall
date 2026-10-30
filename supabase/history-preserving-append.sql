-- Append follow-ups under a row lock. Original customer fields are never replaced.
create or replace function public.append_contact_history(
 p_category text, p_record_id text, p_date date, p_result text,
 p_notes text default '', p_entry_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
 staff_name text; parent public.cold_call_records%rowtype;
 payload jsonb; histories jsonb; first_contact jsonb; entry jsonb;
 next_number integer; history_id bigint;
begin
 select name into staff_name from public.staff_profiles
 where id=auth.uid() and active is true and role='admin';
 if not found then raise exception '只有管理員可以新增聯繫紀錄'; end if;
 if p_date is null or nullif(btrim(p_result),'') is null or p_entry_id is null then
  raise exception '請填寫聯繫日期、結果及紀錄編號';
 end if;
 if p_category='domestic' then
  select * into parent from public.cold_call_records where id=p_record_id::bigint for update;
  if not found then raise exception '找不到客戶資料'; end if;
  select id into history_id from public.cold_call_history where record_id=parent.id
   and contact_date=p_date and btrim(contact_result)=btrim(p_result)
   and coalesce(notes,'')=coalesce(p_notes,'') limit 1;
  if found then return jsonb_build_object('status','skip','id',history_id); end if;
  select greatest(1,coalesce(max(contact_number),1))+1 into next_number
   from public.cold_call_history where record_id=parent.id;
  insert into public.cold_call_history(record_id,contact_date,contact_number,contact_result,notes,created_by)
   values(parent.id,p_date,next_number,btrim(p_result),coalesce(p_notes,''),auth.uid()) returning id into history_id;
  return jsonb_build_object('status','saved','id',history_id,'number',next_number);
 end if;
 if p_category not in ('foreignEmail','exhibitions','prospecting') then raise exception '無效的客戶分類'; end if;
 select data into payload from public.outreach_records where id=p_record_id::uuid and category=p_category for update;
 if not found then raise exception '找不到客戶資料'; end if;
 histories=coalesce(payload->'contactHistory','[]'::jsonb);
 if jsonb_typeof(histories)<>'array' then raise exception '聯繫歷史格式不正確，已停止寫入'; end if;
 if exists(select 1 from jsonb_array_elements(histories) h where
   h->>'id'=p_entry_id::text or (h->>'date'=p_date::text and btrim(h->>'result')=btrim(p_result) and coalesce(h->>'notes','')=coalesce(p_notes,''))) then
  return jsonb_build_object('status','skip','id',p_entry_id);
 end if;
 first_contact=payload->'_initialContact';
 if first_contact is null or jsonb_typeof(first_contact)<>'object' then
  first_contact=jsonb_build_object('date',case when p_category='exhibitions' then coalesce(nullif(payload->>'contactDate',''),payload->>'date','') else coalesce(payload->>'date','') end,
   'notes',coalesce(payload->>'notes',''),'recorder',coalesce(payload->>'recorder',''),'result','首次開發（原始開發紀錄）');
 end if;
 next_number=jsonb_array_length(histories)+2;
 entry=jsonb_build_object('id',p_entry_id,'date',p_date,'result',btrim(p_result),'notes',coalesce(p_notes,''),'number',next_number,'recorder',staff_name,'createdAt',clock_timestamp());
 update public.outreach_records set data=jsonb_set(jsonb_set(payload,'{_initialContact}',first_contact),'{contactHistory}',histories||jsonb_build_array(entry))
  where id=p_record_id::uuid and category=p_category;
 return jsonb_build_object('status','saved','id',p_entry_id,'number',next_number);
end;
$$;
revoke all on function public.append_contact_history(text,text,date,text,text,uuid) from public,anon;
grant execute on function public.append_contact_history(text,text,date,text,text,uuid) to authenticated;
