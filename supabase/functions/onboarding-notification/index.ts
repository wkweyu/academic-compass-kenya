import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods":
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    console.log("onboarding-notification: request received");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

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
    const { school_id, school_code, school_name, email, contact_person, admin_email, admin_password } = body;
    console.log("onboarding-notification: body received", JSON.stringify({ school_id, school_code, email }));

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Permission check (403) ---
    const { data: accessProfile, error: accessError } = await supabase.rpc("get_platform_access_profile");
    if (accessError) {
      console.error("onboarding-notification: profile RPC error", {
        operation: "onboarding-notification/get_platform_access_profile",
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
      console.warn("onboarding-notification: forbidden - no resend permission", {
        operation: "onboarding-notification/permission-check",
        school_id,
        auth_user_id: claimsData.user.id,
      });
      return new Response(
        JSON.stringify({ error: "Forbidden: no permission to send onboarding notifications" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (school_id) {
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
          console.log(`onboarding-notification: access check attempt ${i + 1} failed, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        if (!canAccessSchool) {
          console.warn("onboarding-notification: forbidden - no school access after retries", {
            operation: "onboarding-notification/can_access_platform_school",
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
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      Deno.env.get("APP_URL") ||
      "https://academic-compass-web.onrender.com";
    const loginUrl = `${origin.replace(/\/$/, "")}/auth`;
    console.log("onboarding-notification: loginUrl =", loginUrl);

    const subject = "Welcome to SkoolTrack Pro — Your School Login Details";
    const trackedContent = buildTrackedEmailSummary(
      school_name,
      school_code,
      contact_person,
      loginUrl,
      admin_email || email
    );

    // --- Insert communication log (non-fatal) ---
    let communicationId: number | null = null;
    try {
      const { data: commRecord, error: commInsertError } = await serviceClient
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

      if (commInsertError) {
        console.error("onboarding-notification: saas_communications insert failed", {
          operation: "onboarding-notification/comm-insert",
          school_id,
          auth_user_id: claimsData.user.id,
          error: commInsertError.message,
        });
      } else {
        communicationId = commRecord?.id ?? null;
      }
    } catch (e: any) {
      console.error("onboarding-notification: saas_communications insert threw", {
        operation: "onboarding-notification/comm-insert",
        school_id,
        auth_user_id: claimsData.user.id,
        error: e.message,
      });
    }

    // --- Attempt email send (non-fatal) ---
    let emailSent = false;
    let emailError: string | undefined;

    if (!brevoApiKey) {
      emailError = "BREVO_API_KEY not configured";
      console.warn("onboarding-notification: BREVO_API_KEY not set — email skipped", {
        operation: "onboarding-notification/email-send",
        school_id,
      });
    } else {
      try {
        const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "360.hector@gmail.com";
        const senderName = Deno.env.get("BREVO_SENDER_NAME") || "SkoolTrack Pro";
        const htmlBody = buildEmailHtml(
          school_name,
          school_code,
          contact_person,
          loginUrl,
          admin_email,
          admin_password
        );

        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": brevoApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email, name: contact_person || "Administrator" }],
            subject,
            htmlContent: htmlBody,
          }),
        });

        const brevoBody = await brevoRes.text();
        console.log("onboarding-notification: Brevo response", {
          operation: "onboarding-notification/email-send",
          school_id,
          status: brevoRes.status,
          body: brevoBody,
        });

        if (brevoRes.ok) {
          emailSent = true;
        } else {
          emailError = brevoBody;
          console.error("onboarding-notification: Brevo API rejected send", {
            operation: "onboarding-notification/email-send",
            school_id,
            error: brevoBody,
          });
        }
      } catch (e: any) {
        emailError = e.message;
        console.error("onboarding-notification: email send threw", {
          operation: "onboarding-notification/email-send",
          school_id,
          error: e.message,
        });
      }
    }

    // --- Update communication log status (non-fatal) ---
    if (communicationId !== null) {
      try {
        await serviceClient
          .from("saas_communications")
          .update(
            emailSent
              ? { status: "sent", sent_at: new Date().toISOString(), error_message: null }
              : { status: "failed", error_message: emailError ?? null }
          )
          .eq("id", communicationId);
      } catch (e: any) {
        console.error("onboarding-notification: saas_communications update threw", {
          operation: "onboarding-notification/comm-update",
          school_id,
          communication_id: communicationId,
          error: e.message,
        });
      }
    }

    // --- Insert onboarding log (non-fatal) ---
    try {
      await serviceClient.from("onboarding_logs").insert({
        school_id,
        step: "notification_sent",
        status: emailSent ? "completed" : "failed",
        details: {
          email_sent: emailSent,
          ...(emailError ? { email_error: emailError } : {}),
          communication_id: communicationId,
          recipient_email: email,
          subject,
        },
      });
    } catch (e: any) {
      console.error("onboarding-notification: onboarding_logs insert threw", {
        operation: "onboarding-notification/onboarding-log",
        school_id,
        error: e.message,
      });
    }

    // Always 200 — email/logging failures are reported in body, not HTTP status
    return new Response(
      JSON.stringify({
        email_sent: emailSent,
        ...(emailError ? { email_error: emailError } : {}),
        communication_id: communicationId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // Only true unhandled system exceptions reach here
    console.error("onboarding-notification: unhandled error", {
      operation: "onboarding-notification/outer-catch",
      error: err.message,
    });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
