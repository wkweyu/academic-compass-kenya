import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendResultsRequest {
  studentIds: number[];
  examSessionId: number;
  examSessionName: string;
  schoolName: string;
  schoolEmail?: string;
  termInfo: string;
  academicYear: number;
}

interface StudentResult {
  student_id: number;
  full_name: string;
  admission_number: string;
  guardian_email: string | null;
  average_percentage: number;
  overall_grade: string;
  class_position: number;
  subjects_count: number;
}

const getGradeDescription = (grade: string): string => {
  const descriptions: Record<string, string> = {
    EE: "Exceeding Expectations",
    ME: "Meeting Expectations",
    AE: "Approaching Expectations",
    BE: "Below Expectations",
  };
  return descriptions[grade] || grade;
};

const generateEmailHTML = (
  student: StudentResult,
  examSessionName: string,
  schoolName: string,
  termInfo: string,
  academicYear: number
): string => {
  const gradeColor = {
    EE: "#10b981",
    ME: "#3b82f6",
    AE: "#f59e0b",
    BE: "#ef4444",
  }[student.overall_grade] || "#6b7280";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Exam Results - ${student.full_name}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${schoolName}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Exam Results Notification</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
            Dear Parent/Guardian,
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 25px;">
            We are pleased to share the exam results for your child. Below is a summary of their performance in the <strong>${examSessionName}</strong> examination.
          </p>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 16px;">Student Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Name:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${student.full_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Admission No:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${student.admission_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Term:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${termInfo} - ${academicYear}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 8px; padding: 25px; margin-bottom: 25px; text-align: center; border: 1px solid #bfdbfe;">
            <h3 style="color: #1e40af; margin: 0 0 20px 0; font-size: 16px;">Performance Summary</h3>
            <div style="display: inline-block; margin: 0 15px;">
              <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0;">Average</p>
              <p style="color: #1e40af; font-size: 28px; font-weight: 700; margin: 5px 0;">${student.average_percentage.toFixed(1)}%</p>
            </div>
            <div style="display: inline-block; margin: 0 15px;">
              <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0;">Grade</p>
              <p style="background: ${gradeColor}; color: white; font-size: 18px; font-weight: 700; margin: 5px 0; padding: 8px 15px; border-radius: 4px; display: inline-block;">${student.overall_grade}</p>
            </div>
            <div style="display: inline-block; margin: 0 15px;">
              <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0;">Position</p>
              <p style="color: #1e40af; font-size: 28px; font-weight: 700; margin: 5px 0;">${student.class_position}</p>
            </div>
          </div>
          
          <div style="background: #f9fafb; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
            <h4 style="color: #4b5563; margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase;">Grade Interpretation</h4>
            <p style="color: #374151; font-size: 14px; margin: 0;">
              <strong>${student.overall_grade}</strong> - ${getGradeDescription(student.overall_grade)}
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
              Your child completed ${student.subjects_count} subject(s) in this examination.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 5px;">
            For a detailed report card, please visit the school or contact us.
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
            Best regards,<br>
            <strong>${schoolName}</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            This is an automated message. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-results-email function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      studentIds,
      examSessionId,
      examSessionName,
      schoolName,
      schoolEmail,
      termInfo,
      academicYear,
    }: SendResultsRequest = await req.json();

    console.log(`Processing ${studentIds.length} students for exam session ${examSessionId}`);

    // Get student results with guardian emails
    const { data: results, error: resultsError } = await supabase
      .from("student_exam_results")
      .select(`
        student_id,
        average_percentage,
        overall_grade,
        class_position,
        subjects_count,
        students:student_id (
          full_name,
          admission_number,
          guardian_email
        )
      `)
      .eq("exam_session_id", examSessionId)
      .in("student_id", studentIds);

    if (resultsError) {
      console.error("Error fetching results:", resultsError);
      throw new Error(`Failed to fetch student results: ${resultsError.message}`);
    }

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No results found for selected students" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailResults: { studentId: number; success: boolean; email?: string; error?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const result of results) {
      const student = result.students as any;
      
      if (!student?.guardian_email) {
        console.log(`No guardian email for student ${result.student_id}`);
        emailResults.push({
          studentId: result.student_id,
          success: false,
          error: "No guardian email configured",
        });
        failCount++;
        continue;
      }

      const studentData: StudentResult = {
        student_id: result.student_id,
        full_name: student.full_name,
        admission_number: student.admission_number,
        guardian_email: student.guardian_email,
        average_percentage: result.average_percentage,
        overall_grade: result.overall_grade,
        class_position: result.class_position || 0,
        subjects_count: result.subjects_count,
      };

      const html = generateEmailHTML(
        studentData,
        examSessionName,
        schoolName,
        termInfo,
        academicYear
      );

      try {
        const fromEmail = schoolEmail 
          ? `${schoolName} <${schoolEmail}>` 
          : `${schoolName} <onboarding@resend.dev>`;

        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: [student.guardian_email],
          subject: `Exam Results: ${student.full_name} - ${examSessionName}`,
          html,
        });

        console.log(`Email sent to ${student.guardian_email}:`, emailResponse);
        emailResults.push({
          studentId: result.student_id,
          success: true,
          email: student.guardian_email,
        });
        successCount++;
      } catch (emailError: any) {
        console.error(`Failed to send email to ${student.guardian_email}:`, emailError);
        emailResults.push({
          studentId: result.student_id,
          success: false,
          email: student.guardian_email,
          error: emailError.message,
        });
        failCount++;
      }
    }

    console.log(`Email sending complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalSent: successCount,
        totalFailed: failCount,
        results: emailResults,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-results-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
