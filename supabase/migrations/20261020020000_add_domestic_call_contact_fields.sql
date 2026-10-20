-- 國內電訪表單欄位同步修正
-- 安全、可重複執行：只新增缺少的欄位，不刪除或覆蓋既有資料。
ALTER TABLE public.cold_call_records
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS fax_phone text,
  ADD COLUMN IF NOT EXISTS extension text;

-- 讓 PostgREST / Supabase API 重新載入資料表結構快取。
NOTIFY pgrst, 'reload schema';
