import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("create-school-admin: request received");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify auth
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

    // Check platform admin role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: claimsData.user.id,
      _role: "platform_admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: platform_admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { school_id, admin_email, admin_password } = body;
    console.log("create-school-admin: creating admin for school", school_id, "email:", admin_email);

    if (!school_id || !admin_email || !admin_password) {
      return new Response(JSON.stringify({ error: "school_id, admin_email, and admin_password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to create user
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const findAuthUserByEmail = async (email: string) => {
      for (let page = 1; page <= 5; page += 1) {
        const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
        if (error) {
          throw new Error(`Failed to look up existing user: ${error.message}`);
        }

        const matchedUser = data.users.find(
          (user) => user.email?.toLowerCase() === email.toLowerCase(),
        );

        if (matchedUser) {
          return matchedUser;
        }

        if (data.users.length < 200) {
          break;
        }
      }

      return null;
    };

    const getPublicUserRow = async (authUserId: string) => {
      const { data, error } = await serviceClient
        .from("users")
        .select("id, auth_user_id, email, school_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to read public user row: ${error.message}`);
      }

      return data;
    };

    let authUserId: string;
    let created = false;

    // Create auth user, or repair an existing one for the same email.
    const { data: createdAuthUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
    });

    if (createError) {
      console.warn("create-school-admin: createUser failed, attempting repair:", createError.message);
      const existingUser = await findAuthUserByEmail(admin_email);

      if (!existingUser) {
        return new Response(JSON.stringify({ error: `Failed to create user: ${createError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      authUserId = existingUser.id;

      const { error: updateAuthError } = await serviceClient.auth.admin.updateUserById(authUserId, {
        password: admin_password,
        email_confirm: true,
      });

      if (updateAuthError) {
        throw new Error(`Failed to repair existing admin user: ${updateAuthError.message}`);
      }

      console.log("create-school-admin: repairing existing user:", authUserId);
    } else {
      authUserId = createdAuthUser.user.id;
      created = true;
      console.log("create-school-admin: user created:", authUserId);
    }

    // Wait for the auth trigger to create public.users, then fall back to manual insert if needed.
    let publicUser = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      publicUser = await getPublicUserRow(authUserId);
      if (publicUser) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!publicUser) {
      const { error: insertPublicUserError } = await serviceClient
        .from("users")
        .insert({
          auth_user_id: authUserId,
          username: admin_email,
          email: admin_email,
          first_name: "",
          last_name: "",
          school_id,
          is_active: true,
          is_staff: false,
          is_superuser: false,
          date_joined: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any);

      if (insertPublicUserError) {
        throw new Error(`Failed to create public user profile: ${insertPublicUserError.message}`);
      }

      publicUser = await getPublicUserRow(authUserId);
    }

    if (!publicUser) {
      throw new Error("User profile could not be created for the new school admin.");
    }

    // Link user to school and require success.
    const { data: linkedRows, error: linkError } = await serviceClient
      .from("users")
      .update({ school_id: school_id, updated_at: new Date().toISOString() } as any)
      .eq("auth_user_id", authUserId)
      .select("id, school_id");

    if (linkError) {
      throw new Error(`Failed to link admin user to school: ${linkError.message}`);
    }

    if (!linkedRows?.length || linkedRows[0].school_id !== school_id) {
      throw new Error("Admin user was created but could not be linked to the school.");
    }

    // Assign schooladmin role and require success.
    const { error: roleError } = await serviceClient
      .from("user_roles")
      .upsert({ user_id: authUserId, role: "schooladmin" } as any, { onConflict: "user_id,role" });

    if (roleError) {
      throw new Error(`Failed to assign schooladmin role: ${roleError.message}`);
    }

    return new Response(JSON.stringify({ success: true, user_id: authUserId, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("create-school-admin error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
