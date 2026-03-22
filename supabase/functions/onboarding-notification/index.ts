import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function buildTrackedEmailSummary(
  schoolName: string,
  schoolCode: string,
  contactPerson: string,
  loginUrl: string,
  adminEmail?: string,
) {
  const recipientName = contactPerson || "Administrator";
  return [
    `Welcome email for ${schoolName}`,
    `School code: ${schoolCode}`,
    `Recipient name: ${recipientName}`,
    `Recipient email: ${adminEmail || "school contact email"}`,
    `Login URL: ${loginUrl}`,
    "Temporary passwords are intentionally excluded from tracking logs.",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("onboarding-notification: request received");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

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

    const body = await req.json();
    console.log("onboarding-notification: body received", JSON.stringify({ school_id: body.school_id, school_code: body.school_code, email: body.email }));
    const { school_id, school_code, school_name, email, contact_person, admin_email, admin_password } = body;

    const { data: accessProfile, error: accessError } = await supabase.rpc("get_platform_access_profile");
    if (accessError) {
      return new Response(JSON.stringify({ error: accessError.message }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = accessProfile?.[0];
    if (!profile?.can_resend_admin_access) {
      return new Response(JSON.stringify({ error: "Forbidden: no permission to send onboarding notifications" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (school_id) {
      const { data: canAccessSchool, error: schoolAccessError } = await supabase.rpc("can_access_platform_school", {
        _user_id: claimsData.user.id,
        p_school_id: school_id,
      });
      if (schoolAccessError || !canAccessSchool) {
        return new Response(JSON.stringify({ error: "Forbidden: you cannot manage this school" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const results: { email_sent: boolean; email_error?: string; communication_id?: number | null } = { email_sent: false };
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://academic-compass-kenya.lovable.app";
    const loginUrl = `${origin.replace(/\/$/, "")}/auth`;
    console.log("onboarding-notification: loginUrl =", loginUrl);
    const subject = "Welcome to SkoolTrack Pro — Your School Login Details";
    const trackedContent = buildTrackedEmailSummary(school_name, school_code, contact_person, loginUrl, admin_email || email);

    const { data: communicationRecord, error: communicationInsertError } = await serviceClient
      .from("saas_communications")
      .insert({
        school_id,
        recipient_email: email,
        subject,
        content: trackedContent,
        category: "update",
        type: "email",
        status: "pending",
      })
      .select("id")
      .single();

    if (communicationInsertError) {
      console.error("Failed to create communication log", communicationInsertError);
    }

    results.communication_id = communicationRecord?.id ?? null;

    if (!brevoApiKey) {
      results.email_error = "BREVO_API_KEY not configured";
    }

    if (!email) {
      results.email_error = results.email_error || "No email address provided";
    }

    if (results.email_error) {
      if (results.communication_id) {
        await serviceClient
          .from("saas_communications")
          .update({ status: "failed", error_message: results.email_error })
          .eq("id", results.communication_id);
      }

      await serviceClient.from("onboarding_logs").insert({
        school_id,
        step: "notification_sent",
        status: "failed",
        details: {
          ...results,
          recipient_email: email,
          subject,
        },
      });

      return new Response(JSON.stringify(results), {
        status: !email ? 400 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlBody = buildEmailHtml(school_name, school_code, contact_person, loginUrl, admin_email, admin_password);

    try {
      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "SkoolTrack Pro", email: "360.hector@gmail.com" },
          to: [{ email, name: contact_person || "Administrator" }],
          subject,
          htmlContent: htmlBody,
        }),
      });

      const brevoStatus = brevoRes.status;
      const brevoBody = await brevoRes.text();
      console.log("onboarding-notification: Brevo response status =", brevoStatus, "body =", brevoBody);
      if (brevoRes.ok) {
        results.email_sent = true;
        if (results.communication_id) {
          await serviceClient
            .from("saas_communications")
            .update({ status: "sent", sent_at: new Date().toISOString(), error_message: null })
            .eq("id", results.communication_id);
        }
      } else {
        console.error("Brevo API error:", brevoBody);
        results.email_error = brevoBody;
        if (results.communication_id) {
          await serviceClient
            .from("saas_communications")
            .update({ status: "failed", error_message: brevoBody })
            .eq("id", results.communication_id);
        }
      }
    } catch (e: any) {
      console.error("Email send error:", e);
      results.email_error = e.message;
      if (results.communication_id) {
        await serviceClient
          .from("saas_communications")
          .update({ status: "failed", error_message: e.message })
          .eq("id", results.communication_id);
      }
    }

    // Log the onboarding notification
    await serviceClient.from("onboarding_logs").insert({
      school_id,
      step: "notification_sent",
      status: results.email_sent ? "completed" : "failed",
      details: {
        ...results,
        recipient_email: email,
        subject,
      },
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
