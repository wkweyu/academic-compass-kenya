import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods":
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    console.log("create-school-admin: request received");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Auth verification (401) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Request payload validation (400) ---
    const body = await req.json();
    const { school_id, admin_email, admin_password } = body;

    if (!school_id || !admin_email || !admin_password) {
      return new Response(
        JSON.stringify({ error: "school_id, admin_email, and admin_password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("create-school-admin: processing for school", school_id, "email:", admin_email);

    // --- Permission check (403) ---
    const { data: accessProfile, error: accessError } = await supabase.rpc("get_platform_access_profile");
    if (accessError) {
      console.error("create-school-admin: profile RPC error", {
        operation: "create-school-admin/get_platform_access_profile",
        school_id,
        error: accessError.message,
      });
      return new Response(JSON.stringify({ error: accessError.message }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = accessProfile?.[0];
    if (!profile?.can_resend_admin_access) {
      console.warn("create-school-admin: forbidden - no resend permission", {
        operation: "create-school-admin/permission-check",
        school_id,
        auth_user_id: claimsData.user.id,
      });
      return new Response(
        JSON.stringify({ error: "Forbidden: no permission to manage school admin access" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasGlobalAccess =
      profile.primary_role === "platform_admin" || profile.primary_role === "support";

    if (!hasGlobalAccess) {
      let canAccessSchool = false;
      let lastError = null;

      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase.rpc("can_access_platform_school", {
          _user_id: claimsData.user.id,
          p_school_id: school_id,
        });

        if (!error && data) {
          canAccessSchool = true;
          break;
        }

        lastError = error;
        console.log(`create-school-admin: access check attempt ${i + 1} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!canAccessSchool) {
        console.warn("create-school-admin: forbidden - no school access after retries", {
          operation: "create-school-admin/can_access_platform_school",
          school_id,
          auth_user_id: claimsData.user.id,
          error: lastError?.message ?? null,
        });
        return new Response(
          JSON.stringify({
            error:
              "Forbidden: you cannot manage this school or portfolio assignment is still propagating",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- Auth user lookup-first (no try-create fallback) ---
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const findAuthUserByEmail = async (email: string) => {
      for (let page = 1; page <= 5; page++) {
        const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
        if (error) {
          throw new Error(`Failed to look up existing user: ${error.message}`);
        }
        const match = data.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (match) return match;
        if (data.users.length < 200) break;
      }
      return null;
    };

    const existingUser = await findAuthUserByEmail(admin_email);
    let authUserId: string;
    let created: boolean;

    if (existingUser) {
      // Repair path: user already exists — update credentials only
      authUserId = existingUser.id;
      created = false;
      console.log("create-school-admin: existing auth user found, updating credentials:", {
        operation: "create-school-admin/update-auth-user",
        school_id,
        auth_user_id: authUserId,
      });

      const { error: updateError } = await serviceClient.auth.admin.updateUserById(authUserId, {
        password: admin_password,
        email_confirm: true,
      });

      if (updateError) {
        throw new Error(`Failed to update existing admin user: ${updateError.message}`);
      }
    } else {
      // Create path: no existing user found
      console.log("create-school-admin: no existing auth user found, creating:", {
        operation: "create-school-admin/create-auth-user",
        school_id,
      });

      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email: admin_email,
        password: admin_password,
        email_confirm: true,
      });

      if (createError) {
        throw new Error(`Failed to create admin user: ${createError.message}`);
      }

      authUserId = newUser.user.id;
      created = true;
      console.log("create-school-admin: auth user created:", {
        operation: "create-school-admin/create-auth-user",
        school_id,
        auth_user_id: authUserId,
      });
    }

    // --- Single upsert for public.users ---
    // date_joined is always included: the NOT NULL constraint requires it on INSERT.
    // For existing rows, the ON CONFLICT DO UPDATE won't overwrite it since the upsert
    // only updates the specified columns. For the email-matched patch path, date_joined
    // is not in the UPDATE SET so existing values are preserved.
    const now = new Date().toISOString();
    const userPayload: Record<string, unknown> = {
      auth_user_id: authUserId,
      username: admin_email,
      email: admin_email,
      first_name: "",
      last_name: "",
      school_id,
      is_active: true,
      is_staff: false,
      is_superuser: false,
      updated_at: now,
      date_joined: now,
    };

    // First try to update an existing row matched by email (handles the case where a
    // Django-provisioned user exists with the same email but a different/null auth_user_id,
    // which would cause the insert below to fail on the email UNIQUE constraint).
    const { data: existingByEmail, error: lookupError } = await serviceClient
      .from("users")
      .select("id, auth_user_id, school_id")
      .eq("email", admin_email)
      .maybeSingle();

    console.log("create-school-admin: public.users lookup by email", {
      operation: "create-school-admin/users-lookup",
      admin_email,
      school_id,
      auth_user_id: authUserId,
      found_row: existingByEmail ? { id: existingByEmail.id, auth_user_id: existingByEmail.auth_user_id, school_id: existingByEmail.school_id } : null,
      lookup_error: lookupError?.message ?? null,
    });

    if (existingByEmail && existingByEmail.auth_user_id !== authUserId) {
      // Patch the existing row to link it to the correct Supabase Auth user.
      const { error: patchError } = await serviceClient
        .from("users")
        .update({
          auth_user_id: authUserId,
          username: admin_email,
          school_id,
          is_active: true,
          updated_at: now,
        })
        .eq("id", existingByEmail.id);

      console.log("create-school-admin: patched existing row by email", {
        operation: "create-school-admin/users-patch",
        row_id: existingByEmail.id,
        set_auth_user_id: authUserId,
        set_school_id: school_id,
        patch_error: patchError?.message ?? null,
      });

      if (patchError) {
        throw new Error(`Failed to link existing user profile: ${patchError.message}`);
      }
    } else if (existingByEmail && existingByEmail.auth_user_id === authUserId && existingByEmail.school_id !== school_id) {
      // Row exists and auth_user_id already matches — just update school_id directly.
      const { error: schoolPatchError } = await serviceClient
        .from("users")
        .update({ school_id, is_active: true, updated_at: now })
        .eq("id", existingByEmail.id);

      console.log("create-school-admin: updated school_id on matched row", {
        operation: "create-school-admin/users-school-patch",
        row_id: existingByEmail.id,
        set_school_id: school_id,
        prev_school_id: existingByEmail.school_id,
        patch_error: schoolPatchError?.message ?? null,
      });

      if (schoolPatchError) {
        throw new Error(`Failed to update school on user profile: ${schoolPatchError.message}`);
      }
    } else {
      const { error: upsertError } = await serviceClient
        .from("users")
        .upsert(userPayload as any, { onConflict: "auth_user_id" });

      console.log("create-school-admin: upserted user by auth_user_id", {
        operation: "create-school-admin/users-upsert",
        auth_user_id: authUserId,
        school_id,
        upsert_error: upsertError?.message ?? null,
      });

      if (upsertError) {
        throw new Error(`Failed to upsert public user profile: ${upsertError.message}`);
      }
    }

    // --- Assign schooladmin role ---
    const { error: roleError } = await serviceClient
      .from("user_roles")
      .upsert({ user_id: authUserId, role: "schooladmin" } as any, {
        onConflict: "user_id,role",
      });

    if (roleError) {
      throw new Error(`Failed to assign schooladmin role: ${roleError.message}`);
    }

    return new Response(JSON.stringify({ success: true, user_id: authUserId, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("create-school-admin: unhandled error", {
      operation: "create-school-admin/outer-catch",
      error: err.message,
    });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
