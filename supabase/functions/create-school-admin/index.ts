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

    // Create auth user
    const { data: authUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
    });

    if (createError) {
      console.error("create-school-admin: createUser failed:", createError.message);
      return new Response(JSON.stringify({ error: `Failed to create user: ${createError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("create-school-admin: user created:", authUser.user.id);

    const newUserId = authUser.user.id;

    // Wait a moment for the trigger to create the public.users row
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Link user to school
    const { error: linkError } = await serviceClient
      .from("users")
      .update({ school_id: school_id } as any)
      .eq("auth_user_id", newUserId);

    if (linkError) {
      console.error("Failed to link user to school:", linkError);
    }

    // Assign schooladmin role
    const { error: roleError } = await serviceClient
      .from("user_roles")
      .upsert({ user_id: newUserId, role: "schooladmin" } as any, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("Failed to assign role:", roleError);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
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
