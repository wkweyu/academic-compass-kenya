import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const managedRoles = ["platform_admin", "support", "account_manager", "marketer"];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: accessProfile, error: accessError } = await supabase.rpc("get_platform_access_profile");
    if (accessError) {
      return jsonResponse({ error: accessError.message }, 403);
    }

    const profile = accessProfile?.[0];
    if (!profile?.can_manage_portfolios) {
      return jsonResponse({ error: "Forbidden: no permission to manage platform users" }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const role = String(body.role || "").trim();
    const password = String(body.password || "").trim() || "ChangeMe123!";

    if (!email || !role) {
      return jsonResponse({ error: "email and role are required" }, 400);
    }

    if (!managedRoles.includes(role)) {
      return jsonResponse({ error: "Unsupported platform role" }, 400);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const findAuthUserByEmail = async (targetEmail: string) => {
      for (let page = 1; page <= 5; page += 1) {
        const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
        if (error) {
          throw new Error(`Failed to look up existing user: ${error.message}`);
        }

        const matchedUser = data.users.find(
          (user) => user.email?.toLowerCase() === targetEmail.toLowerCase(),
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
        .select("id, auth_user_id, email")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to read platform user profile: ${error.message}`);
      }

      return data;
    };

    let authUserId: string;
    const { data: createdAuthUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      const existingUser = await findAuthUserByEmail(email);
      if (!existingUser) {
        return jsonResponse({ error: `Failed to create user: ${createError.message}` }, 400);
      }

      authUserId = existingUser.id;
      const { error: updateAuthError } = await serviceClient.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });
      if (updateAuthError) {
        throw new Error(`Failed to repair existing platform user: ${updateAuthError.message}`);
      }
    } else {
      authUserId = createdAuthUser.user.id;
    }

    let publicUser = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      publicUser = await getPublicUserRow(authUserId);
      if (publicUser) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const username = email;

    if (!publicUser) {
      const { error: insertPublicUserError } = await serviceClient.from("users").insert({
        auth_user_id: authUserId,
        username,
        email,
        first_name: firstName,
        last_name: lastName,
        school_id: null,
        role,
        is_active: true,
        is_staff: true,
        is_superuser: role === "platform_admin",
        date_joined: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never);

      if (insertPublicUserError) {
        throw new Error(`Failed to create public platform user: ${insertPublicUserError.message}`);
      }
    } else {
      const { error: updatePublicUserError } = await serviceClient
        .from("users")
        .update({
          username,
          email,
          first_name: firstName,
          last_name: lastName,
          school_id: null,
          role,
          is_active: true,
          is_staff: true,
          is_superuser: role === "platform_admin",
          updated_at: new Date().toISOString(),
        } as never)
        .eq("auth_user_id", authUserId);

      if (updatePublicUserError) {
        throw new Error(`Failed to update public platform user: ${updatePublicUserError.message}`);
      }
    }

    const { error: clearRoleError } = await serviceClient
      .from("user_roles")
      .delete()
      .eq("user_id", authUserId)
      .in("role", managedRoles);

    if (clearRoleError) {
      throw new Error(`Failed to clear previous platform roles: ${clearRoleError.message}`);
    }

    const { error: roleError } = await serviceClient
      .from("user_roles")
      .upsert({ user_id: authUserId, role } as never, { onConflict: "user_id,role" });

    if (roleError) {
      throw new Error(`Failed to assign platform role: ${roleError.message}`);
    }

    const createdUser = await serviceClient
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (createdUser.error) {
      throw new Error(`Failed to load created platform user: ${createdUser.error.message}`);
    }

    return jsonResponse({
      success: true,
      user: {
        id: createdUser.data.id,
        username,
        email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim() || email,
        role,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("create-platform-user error:", message);
    return jsonResponse({ error: message }, 500);
  }
});