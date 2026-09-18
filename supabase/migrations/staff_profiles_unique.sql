-- 先在 Supabase SQL Editor 執行。若已有重複姓名或工號，會明確報錯；
-- 請先修正既有資料，再重新執行，不要略過唯一索引。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.staff_profiles
    GROUP BY lower(btrim(name)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '既有員工姓名重複，請先處理後再建立索引';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.staff_profiles
    GROUP BY upper(btrim(employee_no)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '既有工號重複，請先處理後再建立索引';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_name_unique_normalized
  ON public.staff_profiles (lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_employee_no_unique_normalized
  ON public.staff_profiles (upper(btrim(employee_no)));
