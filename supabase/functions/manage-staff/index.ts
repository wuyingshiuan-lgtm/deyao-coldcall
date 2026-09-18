import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const loginEmailFor = (employeeNo: string) =>
  employeeNo.toLowerCase() + "@staff.de-yao.local";

// This user-facing check complements the database unique indexes in
// staff_profiles_unique.sql, which also guard concurrent requests.
async function ensureUniqueStaff(adminClient: any, name: string, employeeNo: string, excludeId?: string) {
  const { data, error } = await adminClient
    .from("staff_profiles")
    .select("id, name, employee_no");
  if (error) throw error;
  const others = (data || []).filter((row: any) => row.id !== excludeId);
  if (others.some((row: any) => String(row.employee_no || "").trim().toUpperCase() === employeeNo)) {
    throw new Error("工號已存在，請使用其他工號");
  }
  if (others.some((row: any) => String(row.name || "").trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error("姓名已存在，請使用其他姓名");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("尚未登入");

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 確認目前登入者
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("登入驗證失敗");
    }

    // 確認目前登入者是不是管理員
    const { data: profile, error: profileError } =
      await adminClient
        .from("staff_profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      !profile.active
    ) {
      return new Response(
        JSON.stringify({ error: "只有管理員可以管理人員" }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();
    const action = body.action;

    // 新增編輯人員
    if (action === "create") {
      const employeeNo = String(body.employee_no || "")
        .trim()
        .toUpperCase();

      const name = String(body.name || "").trim();
      const password = String(body.password || "");

      if (!employeeNo || !name || password.length < 6) {
        throw new Error("請填寫工號、姓名，密碼至少 6 個字元");
      }
      if (!/^[A-Z0-9_-]{1,32}$/.test(employeeNo) || employeeNo === "ADMIN" || employeeNo === "DEYAO") {
        throw new Error("工號請使用 1 至 32 個英數字、底線或連字號，且不可使用保留工號");
      }
      await ensureUniqueStaff(adminClient, name, employeeNo);

      // 工號轉成系統內部登入 Email
      // 員工不需要知道這個 Email
      const loginEmail = loginEmailFor(employeeNo);

      const { data: created, error: createError } =
        await adminClient.auth.admin.createUser({
          email: loginEmail,
          password,
          email_confirm: true,
        });

      if (createError) throw createError;

      const { error: insertError } =
        await adminClient
          .from("staff_profiles")
          .insert({
            id: created.user.id,
            employee_no: employeeNo,
            name,
            role: "editor",
            active: true,
          });

      if (insertError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw insertError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "編輯人員建立成功",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 修改人員姓名及工號；工號同時對應登入用的內部 Email。
    if (action === "update_identity") {
      const userId = String(body.user_id || "");
      const employeeNo = String(body.employee_no || "").trim().toUpperCase();
      const name = String(body.name || "").trim();
      if (!userId || !name || !employeeNo) throw new Error("請填寫姓名與工號");
      if (!/^[A-Z0-9_-]{1,32}$/.test(employeeNo)) {
        throw new Error("工號請使用 1 至 32 個英數字、底線或連字號");
      }
      const { data: target, error: targetError } = await adminClient
        .from("staff_profiles")
        .select("id, employee_no, name")
        .eq("id", userId)
        .single();
      if (targetError || !target) throw new Error("找不到人員帳號");
      const isMaster = String(target.employee_no).toUpperCase() === "ADMIN";
      if (isMaster && employeeNo !== "ADMIN") {
        throw new Error("主帳號工號不可變更；可以修改姓名");
      }
      if (!isMaster && ["ADMIN", "DEYAO"].includes(employeeNo)) {
        throw new Error("此工號為系統保留工號");
      }
      await ensureUniqueStaff(adminClient, name, employeeNo, userId);

      const changedNo = employeeNo !== String(target.employee_no).toUpperCase();
      if (changedNo) {
        const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
          email: loginEmailFor(employeeNo),
          email_confirm: true,
        });
        if (authError) throw new Error("更新登入工號失敗：" + authError.message);
      }
      const { error: updateError } = await adminClient
        .from("staff_profiles")
        .update({ name, employee_no: employeeNo })
        .eq("id", userId);
      if (updateError) {
        if (changedNo) {
          const { error: rollbackError } = await adminClient.auth.admin.updateUserById(userId, {
            email: loginEmailFor(String(target.employee_no).toUpperCase()),
            email_confirm: true,
          });
          if (rollbackError) throw new Error("更新失敗且登入工號還原失敗，請聯絡管理員：" + rollbackError.message);
        }
        if (updateError.code === "23505") throw new Error("姓名或工號已存在，請更換後再試");
        throw updateError;
      }
      return new Response(JSON.stringify({ success: true, message: "姓名與工號已更新；若工號變更，下次請使用新工號登入" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

        // 將編輯人員升級為管理員
    if (action === "make_admin") {
      const userId = String(body.user_id || "");

      if (!userId) {
        throw new Error("找不到人員帳號");
      }

      const { error } = await adminClient
        .from("staff_profiles")
        .update({
          role: "admin",
          active: true
        })
        .eq("id", userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          message: "已設定為管理員",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 將其他管理員改回編輯人員
    if (action === "make_editor") {
      const userId = String(body.user_id || "");

      if (!userId) {
        throw new Error("找不到人員帳號");
      }

      // 不允許目前登入的管理員降低自己的權限
      if (userId === user.id) {
        throw new Error("不能將自己的管理員權限取消");
      }

      const { error } = await adminClient
        .from("staff_profiles")
        .update({
          role: "editor"
        })
        .eq("id", userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          message: "已改為編輯人員",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // 停用人員
    if (action === "disable") {
      const userId = String(body.user_id || "");

      if (!userId || userId === user.id) {
        throw new Error("無法停用此帳號");
      }

      const { error } = await adminClient
        .from("staff_profiles")
        .update({ active: false })
        .eq("id", userId)
        .eq("role", "editor");

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          message: "人員已停用",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 重新啟用人員
    if (action === "enable") {
      const userId = String(body.user_id || "");

      const { error } = await adminClient
        .from("staff_profiles")
        .update({ active: true })
        .eq("id", userId)
        .eq("role", "editor");

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          message: "人員已啟用",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 刪除編輯人員
    if (action === "delete") {
      const userId = String(body.user_id || "");

      if (!userId || userId === user.id) {
        throw new Error("無法刪除自己的管理員帳號");
      }

      // 先確認只能刪 editor
      const { data: target } = await adminClient
        .from("staff_profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (!target || target.role !== "editor") {
        throw new Error("只能刪除編輯人員");
      }

      /*
        保留歷史電訪紀錄。
        created_by 外鍵目前沒有 ON DELETE SET NULL，
        因此先將歷史紀錄 created_by 清空，
        recorder 文字欄位仍會保留原紀錄者姓名。
      */
      const { error: recordError } = await adminClient
        .from("cold_call_records")
        .update({ created_by: null })
        .eq("created_by", userId);

      if (recordError) throw recordError;

      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(userId);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({
          success: true,
          message: "人員已刪除，歷史電訪資料已保留",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    throw new Error("不支援的操作");
  } catch (err) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error ? err.message : String(err),
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
