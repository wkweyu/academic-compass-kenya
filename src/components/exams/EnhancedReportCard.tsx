import { forwardRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { CBC_GRADES } from '@/types/exam-management';
import { Award, GraduationCap, Trophy, Star, TrendingUp, TrendingDown, Minus, School } from 'lucide-react';

interface SubjectMark {
  subject_name: string;
  subject_code: string;
  marks: number;
  max_marks: number;
  grade: string;
  points: number;
  previous_marks?: number;
  class_average?: number;
}

interface StudentData {
  admission_number: string;
  full_name: string;
  class_name: string;
  stream_name: string | null;
  total_marks: number;
  total_possible: number;
  average_percentage: number;
  total_points: number;
  average_points: number;
  overall_grade: string;
  subjects_count: number;
  class_position: number | null;
  stream_position: number | null;
  previous_position?: number | null;
  previous_average?: number;
}

interface SchoolData {
  name: string;
  motto?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  website?: string;
}

interface EnhancedReportCardProps {
  student: StudentData;
  subjectMarks: SubjectMark[];
  school: SchoolData;
  session: {
    name: string;
    academic_year: number;
    term_number?: number;
  };
  showPrintStyles?: boolean;
}

export const EnhancedReportCard = forwardRef<HTMLDivElement, EnhancedReportCardProps>(
  ({ student, subjectMarks, school, session, showPrintStyles = true }, ref) => {
    const gradeInfo = CBC_GRADES[student.overall_grade as keyof typeof CBC_GRADES];

    const getPositionSuffix = (pos: number) => {
      if (pos === 1) return 'st';
      if (pos === 2) return 'nd';
      if (pos === 3) return 'rd';
      return 'th';
    };

    const getDeviation = (current: number, previous?: number) => {
      if (previous === undefined) return null;
      return current - previous;
    };

    const positionDeviation = getDeviation(
      student.class_position || 0, 
      student.previous_position || undefined
    );

    const averageDeviation = getDeviation(
      student.average_percentage,
      student.previous_average
    );

    const DeviationIndicator = ({ value, inverse = false }: { value: number | null; inverse?: boolean }) => {
      if (value === null) return <span className="text-muted-foreground text-xs">-</span>;
      const isPositive = inverse ? value < 0 : value > 0;
      const isNegative = inverse ? value > 0 : value < 0;
      
      if (value === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
      
      return (
        <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : ''}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(value).toFixed(value % 1 === 0 ? 0 : 1)}
        </span>
      );
    };

    return (
      <div 
        ref={ref} 
        className={`bg-background ${showPrintStyles ? 'print:bg-white print:text-black' : ''}`}
      >
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Enhanced School Header */}
          <div className="text-center border-b-4 border-primary pb-6">
            <div className="flex items-center justify-center gap-4 mb-3">
              {school.logo ? (
                <img src={school.logo} alt="School Logo" className="h-20 w-20 object-contain" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <School className="h-10 w-10 text-primary" />
                </div>
              )}
              <div className="text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-wide uppercase">
                  {school.name}
                </h1>
                {school.motto && (
                  <p className="text-muted-foreground italic text-sm mt-1">"{school.motto}"</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {school.address && (
                <p className="text-sm text-muted-foreground">{school.address}</p>
              )}
              <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                {school.phone && (
                  <span>Tel: {school.phone}</span>
                )}
                {school.email && (
                  <span>Email: {school.email}</span>
                )}
                {school.website && (
                  <span>Web: {school.website}</span>
                )}
              </div>
            </div>
          </div>

          {/* Report Title */}
          <div className="text-center py-4 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-lg">
            <h2 className="text-xl font-bold uppercase tracking-widest">Academic Report Card</h2>
            <p className="text-muted-foreground mt-1">
              {session.name} • {session.term_number && `Term ${session.term_number} • `}{session.academic_year}
            </p>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Adm No.</p>
              <p className="font-bold text-lg">{student.admission_number}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Student Name</p>
              <p className="font-bold text-lg">{student.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Class</p>
              <p className="font-bold text-lg">
                {student.class_name}
                {student.stream_name && ` (${student.stream_name})`}
              </p>
            </div>
          </div>

          {/* Performance Summary Cards with Deviation */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 p-4 rounded-xl text-center border border-amber-200 dark:border-amber-800">
              <Trophy className="h-6 w-6 mx-auto text-amber-600 mb-1" />
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {student.class_position || '-'}{student.class_position && getPositionSuffix(student.class_position)}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">Class Rank</p>
              {positionDeviation !== null && (
                <div className="mt-1">
                  <DeviationIndicator value={positionDeviation} inverse />
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 p-4 rounded-xl text-center border border-blue-200 dark:border-blue-800">
              <Star className="h-6 w-6 mx-auto text-blue-600 mb-1" />
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {student.stream_position || '-'}{student.stream_position && getPositionSuffix(student.stream_position)}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500">Stream Rank</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 p-4 rounded-xl text-center border border-green-200 dark:border-green-800">
              <Award className="h-6 w-6 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {student.average_percentage.toFixed(1)}%
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">Average</p>
              {averageDeviation !== null && (
                <div className="mt-1">
                  <DeviationIndicator value={averageDeviation} />
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 p-4 rounded-xl text-center border border-purple-200 dark:border-purple-800">
              <GraduationCap className="h-6 w-6 mx-auto text-purple-600 mb-1" />
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {student.average_points.toFixed(2)}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-500">Mean Points</p>
            </div>
            <div className={`p-4 rounded-xl text-center border ${gradeInfo?.bgColor || 'bg-muted'}`}>
              <div className={`text-3xl font-black ${gradeInfo?.color || ''}`}>
                {student.overall_grade}
              </div>
              <p className="text-xs mt-1 font-medium">{gradeInfo?.label}</p>
            </div>
          </div>

          {/* Subject Marks Table with Progress Indicators */}
          <div className="border rounded-xl overflow-hidden">
            <div className="bg-primary/10 px-4 py-3">
              <h3 className="font-bold uppercase tracking-wide text-sm">Subject Performance</h3>
            </div>
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-sm">
                  <th className="text-left p-3 font-semibold">Subject</th>
                  <th className="text-center p-3 font-semibold w-16">Marks</th>
                  <th className="text-center p-3 font-semibold w-16">%</th>
                  <th className="text-center p-3 font-semibold w-16">Grade</th>
                  <th className="text-center p-3 font-semibold w-16">Dev</th>
                  <th className="text-center p-3 font-semibold w-16">Class Avg</th>
                </tr>
              </thead>
              <tbody>
                {subjectMarks.map((subject, idx) => {
                  const subjectGrade = CBC_GRADES[subject.grade as keyof typeof CBC_GRADES];
                  const percentage = (subject.marks / subject.max_marks) * 100;
                  const deviation = subject.previous_marks !== undefined 
                    ? subject.marks - subject.previous_marks 
                    : null;
                  const classAvgDiff = subject.class_average !== undefined
                    ? percentage - subject.class_average
                    : null;
                  
                  return (
                    <tr 
                      key={idx} 
                      className={`border-t ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    >
                      <td className="p-3">
                        <span className="font-medium">{subject.subject_name}</span>
                        <span className="text-muted-foreground text-xs ml-2">({subject.subject_code})</span>
                      </td>
                      <td className="text-center p-3 font-bold">{subject.marks}/{subject.max_marks}</td>
                      <td className="text-center p-3">{percentage.toFixed(0)}%</td>
                      <td className="text-center p-3">
                        <Badge variant="outline" className={`${subjectGrade?.color} font-bold`}>
                          {subject.grade}
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        <DeviationIndicator value={deviation} />
                      </td>
                      <td className="text-center p-3">
                        {subject.class_average !== undefined && (
                          <span className={`text-xs ${classAvgDiff && classAvgDiff > 0 ? 'text-green-600' : classAvgDiff && classAvgDiff < 0 ? 'text-red-600' : ''}`}>
                            {subject.class_average.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-primary/10 font-bold">
                <tr className="border-t-2 border-primary/20">
                  <td className="p-3">TOTAL ({student.subjects_count} subjects)</td>
                  <td className="text-center p-3">{student.total_marks}/{student.total_possible}</td>
                  <td className="text-center p-3">{student.average_percentage.toFixed(1)}%</td>
                  <td className="text-center p-3">
                    <Badge className={`${gradeInfo?.bgColor} ${gradeInfo?.color} font-bold`}>
                      {student.overall_grade}
                    </Badge>
                  </td>
                  <td className="text-center p-3">
                    {averageDeviation !== null && <DeviationIndicator value={averageDeviation} />}
                  </td>
                  <td className="text-center p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Grading Scale */}
          <div className="p-4 bg-muted/30 rounded-xl border">
            <h4 className="font-semibold text-sm mb-3 uppercase tracking-wide">CBC Grading Scale</h4>
            <div className="flex flex-wrap gap-4 justify-center">
              {Object.entries(CBC_GRADES).map(([grade, info]) => (
                <div key={grade} className="flex items-center gap-2 text-sm">
                  <Badge className={`${info.bgColor} ${info.color} font-bold`}>{grade}</Badge>
                  <span className="text-muted-foreground">{info.label} ({info.points} pts)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comments Section */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border rounded-xl p-4">
              <p className="font-semibold text-sm mb-2">Class Teacher's Remarks:</p>
              <div className="h-16 border-b border-dashed border-muted-foreground/30"></div>
              <div className="flex justify-between mt-3 text-sm text-muted-foreground">
                <span>Signature: ________________</span>
                <span>Date: __________</span>
              </div>
            </div>
            <div className="border rounded-xl p-4">
              <p className="font-semibold text-sm mb-2">Head Teacher's Remarks:</p>
              <div className="h-16 border-b border-dashed border-muted-foreground/30"></div>
              <div className="flex justify-between mt-3 text-sm text-muted-foreground">
                <span>Signature: ________________</span>
                <span>Date: __________</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>This is a computer-generated report card. For any queries, please contact the school administration.</p>
            <p className="mt-1">Generated on {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    );
  }
);

EnhancedReportCard.displayName = 'EnhancedReportCard';
