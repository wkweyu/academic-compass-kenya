import { supabase } from "@/integrations/supabase/client";
import { DashboardData } from "@/types/dashboard";

export const dashboardService = {
  async getDashboardData(): Promise<DashboardData> {
    try {
      console.log('Fetching dashboard data...');
      
      // Get user's school ID using RPC function (bypasses RLS)
      const { data: schoolId, error: schoolError } = await supabase.rpc('get_user_school_id');
      
      if (schoolError) {
        console.error('Error getting school ID:', schoolError);
        throw schoolError;
      }
      
      if (!schoolId) {
        console.warn('No school associated with user');
        throw new Error("No school associated with user");
      }

      console.log('Using school ID:', schoolId);

      // Fetch all statistics in parallel
      const [
        studentsResult,
        examsResult,
        activeExamsResult,
        subjectsResult,
        scoresResult,
        totalScoresResult,
        recentExamsResult,
        performanceResult,
        gradeScalesResult
      ] = await Promise.all([
        // Total students
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("is_active", true),
        
        // Total exams
        supabase
          .from("exams_exam")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),
        
        // Active exams (published)
        supabase
          .from("exams_exam")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("is_published", true),
        
        // Total subjects (unique subjects from exams)
        supabase
          .from("exams_exam")
          .select("subject_id")
          .eq("school_id", schoolId),
        
        // Completed scores (marks not null)
        supabase
          .from("scores")
          .select("id", { count: "exact", head: true })
          .not("marks", "is", null),
        
        // Total scores (including pending)
        supabase
          .from("scores")
          .select("id", { count: "exact", head: true }),
        
        // Recent exams
        supabase
          .from("exams_exam")
          .select(`
            name,
            exam_date,
            is_published,
            classes!exams_exam_class_assigned_id_fkey(name),
            streams(name)
          `)
          .eq("school_id", schoolId)
          .order("exam_date", { ascending: false })
          .limit(5),
        
        // Performance by subject (average scores)
        supabase
          .from("scores")
          .select(`
            marks,
            exams_exam!inner(subject_id, school_id)
          `)
          .eq("exams_exam.school_id", schoolId)
          .not("marks", "is", null),
        
        // Grade scales
        supabase
          .from("grade_scales")
          .select("*")
          .eq("school_id", schoolId)
      ]);

      // Calculate unique subjects
      const uniqueSubjects = new Set(
        subjectsResult.data?.map(e => e.subject_id).filter(Boolean)
      );

      // Calculate score completion percentage
      const totalScores = totalScoresResult.count || 0;
      const completedScores = scoresResult.count || 0;
      const completionPercentage = totalScores > 0 
        ? Math.round((completedScores / totalScores) * 100) 
        : 0;

      // Process recent exams
      const recentExams = (recentExamsResult.data || []).map((exam: any) => ({
        name: exam.name,
        class: Array.isArray(exam.classes) ? exam.classes[0]?.name : exam.classes?.name || "N/A",
        stream: Array.isArray(exam.streams) ? exam.streams[0]?.name : exam.streams?.name || "N/A",
        date: new Date(exam.exam_date).toLocaleDateString(),
        status: exam.is_published ? "Active" : "Completed"
      }));

      // Process performance data - group by subject
      const performanceBySubject = new Map<number, number[]>();
      (performanceResult.data || []).forEach((score: any) => {
        const examData = Array.isArray(score.exams_exam) ? score.exams_exam[0] : score.exams_exam;
        const subjectId = examData?.subject_id;
        if (subjectId && score.marks !== null) {
          if (!performanceBySubject.has(subjectId)) {
            performanceBySubject.set(subjectId, []);
          }
          performanceBySubject.get(subjectId)!.push(Number(score.marks));
        }
      });

      // Calculate averages and assign grades
      const gradeScales = gradeScalesResult.data || [];
      const performanceData = Array.from(performanceBySubject.entries()).map(([subjectId, marks]) => {
        const average = marks.reduce((a, b) => a + b, 0) / marks.length;
        const roundedAverage = Math.round(average * 100) / 100;
        
        // Find matching grade
        const matchingGrade = gradeScales.find(
          scale => roundedAverage >= Number(scale.min_score) && roundedAverage <= Number(scale.max_score)
        );

        return {
          subject: `Subject ${subjectId}`, // You might want to fetch actual subject names
          average: roundedAverage,
          grade: matchingGrade?.grade || "N/A"
        };
      });

      return {
        stats: {
          totalExams: examsResult.count || 0,
          activeExams: activeExamsResult.count || 0,
          totalStudents: studentsResult.count || 0,
          totalSubjects: uniqueSubjects.size,
          completedScores: completionPercentage,
          pendingResults: totalScores - completedScores,
        },
        recentExams,
        performanceData,
      };
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      return {
        stats: {
          totalExams: 0,
          activeExams: 0,
          totalStudents: 0,
          totalSubjects: 0,
          completedScores: 0,
          pendingResults: 0,
        },
        recentExams: [],
        performanceData: [],
      };
    }
  },
};