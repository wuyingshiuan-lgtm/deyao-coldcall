-- Apply in Supabase to enforce the same rule for every browser and API writer.
-- Existing records are preserved. Unchanged names may still receive history updates.
BEGIN;
CREATE OR REPLACE FUNCTION public.deyao_company_key(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
 SELECT lower(regexp_replace(normalize(value, NFKC), '[[:space:]　]+', '', 'g'));
$$;
CREATE OR REPLACE FUNCTION public.deyao_guard_company_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE company text; company_key text; previous_key text;
BEGIN
 IF TG_TABLE_NAME = 'cold_call_records' THEN
  company := NEW.company_name;
  IF TG_OP = 'UPDATE' THEN previous_key := public.deyao_company_key(OLD.company_name); END IF;
 ELSE
  company := NEW.data->>'company';
  IF TG_OP = 'UPDATE' THEN previous_key := public.deyao_company_key(OLD.data->>'company'); END IF;
 END IF;
 company_key := public.deyao_company_key(company);
 IF company_key IS NULL OR company_key = '' THEN RAISE EXCEPTION '公司名稱不可空白'; END IF;
 IF TG_OP = 'UPDATE' AND company_key = previous_key THEN RETURN NEW; END IF;
 -- One transaction lock shared across both customer tables and all users.
 PERFORM pg_advisory_xact_lock(61021060000);
 IF EXISTS(SELECT 1 FROM public.cold_call_records r WHERE public.deyao_company_key(r.company_name)=company_key AND NOT(TG_TABLE_NAME='cold_call_records' AND TG_OP='UPDATE' AND r.id::text=NEW.id::text))
 OR EXISTS(SELECT 1 FROM public.outreach_records r WHERE public.deyao_company_key(r.data->>'company')=company_key AND NOT(TG_TABLE_NAME='outreach_records' AND TG_OP='UPDATE' AND r.id::text=NEW.id::text)) THEN
  RAISE EXCEPTION '公司名稱「%」已存在雲端資料內，不可重複新增。', company USING ERRCODE='23505';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.deyao_guard_company_name() FROM PUBLIC;
DROP TRIGGER IF EXISTS deyao_unique_company ON public.cold_call_records;
CREATE TRIGGER deyao_unique_company BEFORE INSERT OR UPDATE OF company_name ON public.cold_call_records FOR EACH ROW EXECUTE FUNCTION public.deyao_guard_company_name();
DROP TRIGGER IF EXISTS deyao_unique_company ON public.outreach_records;
CREATE TRIGGER deyao_unique_company BEFORE INSERT OR UPDATE OF data ON public.outreach_records FOR EACH ROW EXECUTE FUNCTION public.deyao_guard_company_name();
COMMIT;
