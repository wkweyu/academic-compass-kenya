import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const userId = Number(body.user_id);
    if (!Number.isFinite(userId)) {
      return jsonResponse({ error: "user_id is required" }, 400);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: publicUser, error: publicUserError } = await serviceClient
      .from("users")
      .select("id, auth_user_id, school_id")
      .eq("id", userId)
      .maybeSingle();

    if (publicUserError) {
      throw new Error(`Failed to load platform user: ${publicUserError.message}`);
    }

    if (!publicUser) {
      return jsonResponse({ error: "User not found" }, 404);
    }

    if (publicUser.school_id) {
      return jsonResponse({ error: "Only platform users can be deleted here" }, 400);
    }

    if (publicUser.auth_user_id) {
      const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(publicUser.auth_user_id);
      if (deleteAuthError) {
        throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
      }
    } else {
      const { error: deletePublicUserError } = await serviceClient.from("users").delete().eq("id", userId);
      if (deletePublicUserError) {
        throw new Error(`Failed to delete public user: ${deletePublicUserError.message}`);
      }
    }

    return jsonResponse({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("delete-platform-user error:", message);
    return jsonResponse({ error: message }, 500);
  }
});