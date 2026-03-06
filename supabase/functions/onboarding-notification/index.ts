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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

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

    const { school_id, school_code, school_name, email, contact_person } = await req.json();

    const results: { email_sent: boolean; email_error?: string } = {
      email_sent: false,
    };

    // Send onboarding email via Resend
    if (resendApiKey && email) {
      try {
        const loginUrl = `${req.headers.get("origin") || "https://academic-compass-kenya.lovable.app"}/auth`;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "SkoolTrack Pro <onboarding@resend.dev>",
            to: [email],
            subject: `Welcome to SkoolTrack Pro - ${school_name}`,
            html: `
              <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Welcome to SkoolTrack Pro</h1>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 8px;">Your school has been successfully onboarded</p>
                </div>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">School Name</td>
                      <td style="padding: 8px 0; font-weight: 600; color: #1a1a2e; text-align: right;">${school_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">School Code</td>
                      <td style="padding: 8px 0; font-weight: 700; font-family: monospace; font-size: 18px; color: #2563eb; text-align: right;">${school_code}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Login URL</td>
                      <td style="padding: 8px 0; text-align: right;"><a href="${loginUrl}" style="color: #2563eb; text-decoration: none;">${loginUrl}</a></td>
                    </tr>
                  </table>
                </div>
                <div style="text-align: center;">
                  <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                    Get Started
                  </a>
                </div>
                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
                  Use the school code above when logging in. Your administrator will create user accounts for your staff.
                </p>
              </div>
            `,
          }),
        });

        if (emailRes.ok) {
          results.email_sent = true;
        } else {
          const errBody = await emailRes.text();
          results.email_error = errBody;
        }
      } catch (e: any) {
        results.email_error = e.message;
      }
    } else {
      results.email_error = "RESEND_API_KEY not configured or no email provided";
    }

    // Log the onboarding notification
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await serviceClient.from("onboarding_logs").insert({
      school_id,
      step: "notification_sent",
      status: results.email_sent ? "completed" : "failed",
      details: results,
    });

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
