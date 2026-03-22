import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BillingNotificationPayload {
  school_id: number;
  school_name: string;
  invoice_number?: string;
  amount?: number;
  due_date?: string;
  type: "invoice_sent" | "payment_received" | "subscription_expiring" | "subscription_expired";
  recipient_email: string;
}

function buildInvoiceEmailHtml(payload: BillingNotificationPayload): string {
  const { school_name, invoice_number, amount, due_date } = payload;
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #1e40af;">New Invoice from SkoolTrack Pro</h2>
      <p>Dear Administrator at ${school_name},</p>
      <p>A new invoice has been generated for your subscription.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr><td><strong>Invoice #:</strong></td><td style="text-align: right;">${invoice_number}</td></tr>
          <tr><td><strong>Amount:</strong></td><td style="text-align: right;">KES ${amount?.toLocaleString()}</td></tr>
          <tr><td><strong>Due Date:</strong></td><td style="text-align: right;">${due_date}</td></tr>
        </table>
      </div>
      <p>Please log in to your school dashboard to view and pay this invoice.</p>
      <a href="https://skooltrack.pro/login" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Dashboard</a>
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">Sent by SkoolTrack Pro Billing System</p>
    </div>
  `;
}

function buildExpiryEmailHtml(payload: BillingNotificationPayload): string {
  const { school_name, due_date, type } = payload;
  const isExpired = type === "subscription_expired";
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fecaca; border-radius: 8px;">
      <h2 style="color: #b91c1c;">${isExpired ? "Subscription Expired" : "Subscription Expiring Soon"}</h2>
      <p>Dear Administrator at ${school_name},</p>
      <p>${isExpired 
        ? "Your SkoolTrack Pro subscription has expired. Access to some features may be restricted." 
        : `Your subscription is set to expire on <strong>${due_date}</strong>.`}</p>
      <p>To avoid any service interruption, please ensure your account is renewed.</p>
      <a href="https://skooltrack.pro/login" style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Renew Now</a>
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">Sent by SkoolTrack Pro System</p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: BillingNotificationPayload = await req.json();
    let html = "";
    let subject = "";

    switch (payload.type) {
      case "invoice_sent":
        subject = `Invoice ${payload.invoice_number} from SkoolTrack Pro`;
        html = buildInvoiceEmailHtml(payload);
        break;
      case "subscription_expiring":
        subject = "Action Required: Your SkoolTrack Pro subscription is expiring";
        html = buildExpiryEmailHtml(payload);
        break;
      case "subscription_expired":
        subject = "Urgent: Your SkoolTrack Pro subscription has expired";
        html = buildExpiryEmailHtml(payload);
        break;
      default:
        throw new Error("Invalid notification type");
    }

    // In a real implementation, you would use an email provider like Resend, SendGrid, etc.
    // For now, we log the communication in the database.
    
    const { error: logError } = await supabaseClient.rpc("log_saas_communication", {
      p_school_id: payload.school_id,
      p_recipient: payload.recipient_email,
      p_subject: subject,
      p_content: "Email sent automatically by system",
      p_category: "billing",
      p_type: "email"
    });

    if (logError) throw logError;

    return new Response(
      JSON.stringify({ message: "Notification processed", subject }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
