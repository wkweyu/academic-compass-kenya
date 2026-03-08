import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendSmtpEmail(to: string, subject: string, htmlBody: string) {
  const client = new SmtpClient();

  await client.connectTLS({
    hostname: Deno.env.get("SMTP_HOST")!,
    port: Number(Deno.env.get("SMTP_PORT") || "465"),
    username: Deno.env.get("SMTP_USERNAME")!,
    password: Deno.env.get("SMTP_PASSWORD")!,
  });

  await client.send({
    from: Deno.env.get("SMTP_USERNAME")!,
    to,
    subject,
    content: "Please view this email in an HTML-capable client.",
    html: htmlBody,
  });

  await client.close();
}

function buildEmailHtml(
  schoolName: string,
  schoolCode: string,
  contactPerson: string,
  loginUrl: string,
  adminEmail?: string,
  adminPassword?: string
): string {
  const greeting = contactPerson ? `Dear ${contactPerson},` : "Dear Administrator,";

  const credentialsSection = adminEmail
    ? `
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Admin Email</td>
        <td style="padding: 8px 0; font-weight: 600; color: #1a1a2e; text-align: right;">${adminEmail}</td>
      </tr>
      ${adminPassword ? `
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Temporary Password</td>
        <td style="padding: 8px 0; font-weight: 600; font-family: monospace; color: #dc2626; text-align: right;">${adminPassword}</td>
      </tr>` : ""}`
    : "";

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 56px; height: 56px; background: #2563eb; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="color: #ffffff; font-size: 24px; font-weight: 700;">S</span>
        </div>
        <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Welcome to SkoolTrack Pro</h1>
        <p style="color: #6b7280; font-size: 14px; margin-top: 8px;">Your school has been successfully registered</p>
      </div>

      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
        ${greeting}<br/><br/>
        We're excited to have <strong>${schoolName}</strong> on board! Below are your login details to access SkoolTrack Pro.
      </p>

      <div style="background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e40af; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0;">Login Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">School Name</td>
            <td style="padding: 8px 0; font-weight: 600; color: #1a1a2e; text-align: right;">${schoolName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">School Code</td>
            <td style="padding: 8px 0; font-weight: 700; font-family: 'Courier New', monospace; font-size: 20px; color: #2563eb; text-align: right;">${schoolCode}</td>
          </tr>
          ${credentialsSection}
        </table>
      </div>

      <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h3 style="color: #92400e; font-size: 13px; margin: 0 0 8px 0;">📋 How to Log In</h3>
        <ol style="color: #78350f; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 18px;">
          <li>Go to the login page using the button below</li>
          <li>Enter your <strong>School Code: ${schoolCode}</strong></li>
          <li>Enter your email and password to sign in</li>
        </ol>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Log In to SkoolTrack Pro
        </a>
      </div>

      <p style="color: #6b7280; font-size: 13px; text-align: center; line-height: 1.6;">
        Login URL: <a href="${loginUrl}" style="color: #2563eb; text-decoration: none;">${loginUrl}</a>
      </p>

      ${adminPassword ? `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-top: 16px;">
        <p style="color: #991b1b; font-size: 12px; margin: 0;">
          ⚠️ <strong>Security Notice:</strong> Please change your temporary password immediately after your first login.
        </p>
      </div>` : ""}

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
        This email was sent by SkoolTrack Pro. If you did not expect this email, please ignore it.
      </p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { school_id, school_code, school_name, email, contact_person, admin_email, admin_password } = await req.json();

    const results: { email_sent: boolean; email_error?: string } = { email_sent: false };

    // Validate SMTP config
    if (!Deno.env.get("SMTP_HOST") || !Deno.env.get("SMTP_USERNAME") || !Deno.env.get("SMTP_PASSWORD")) {
      results.email_error = "SMTP credentials not configured";
      return new Response(JSON.stringify(results), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email) {
      results.email_error = "No email address provided";
      return new Response(JSON.stringify(results), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loginUrl = `${req.headers.get("origin") || "https://academic-compass-kenya.lovable.app"}/auth`;

    const htmlBody = buildEmailHtml(school_name, school_code, contact_person, loginUrl, admin_email, admin_password);

    try {
      await sendSmtpEmail(email, `Welcome to SkoolTrack Pro — Your School Login Details`, htmlBody);
      results.email_sent = true;
    } catch (e: any) {
      console.error("SMTP send error:", e);
      results.email_error = e.message;
    }

    // Log the onboarding notification
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await serviceClient.from("onboarding_logs").insert({
      school_id,
      step: "notification_sent",
      status: results.email_sent ? "completed" : "failed",
      details: results,
    });

    return new Response(JSON.stringify(results), {
      status: results.email_sent ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
