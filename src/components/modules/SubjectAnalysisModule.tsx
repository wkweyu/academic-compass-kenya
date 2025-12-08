import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Users, BookOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { examManagementService, SubjectAnalysis } from '@/services/examManagementService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const GRADE_COLORS = {
  EE: '#22c55e',
  ME: '#3b82f6',
  AE: '#eab308',
  BE: '#ef4444',
};

export function SubjectAnalysisModule() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [analyses, setAnalyses] = useState<SubjectAnalysis[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    if (selectedClassId && selectedTermId) {
      loadAnalysis();
    }
  }, [selectedClassId, selectedTermId, academicYear]);

  const loadFormData = async () => {
    try {
      const [classesRes, termsRes] = await Promise.all([
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('settings_termsetting').select('id, term, year').order('year', { ascending: false }).order('term'),
      ]);

      setClasses(classesRes.data || []);
      setTerms(termsRes.data || []);
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  };

  const loadAnalysis = async () => {
    if (!selectedClassId || !selectedTermId) return;
    
    setLoading(true);
    try {
      const data = await examManagementService.getSubjectAnalysis(
        parseInt(selectedClassId),
        parseInt(selectedTermId),
        academicYear
      );
      setAnalyses(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load subject analysis',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = analyses.map(a => ({
    name: a.subject_code,
    average: a.class_average,
    highest: a.highest_score,
    lowest: a.lowest_score,
  }));

  // Overall statistics
  const overallAverage = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.class_average, 0) / analyses.length
    : 0;
  
  const bestSubject = analyses.length > 0
    ? analyses.reduce((best, curr) => curr.class_average > best.class_average ? curr : best)
    : null;
  
  const worstSubject = analyses.length > 0
    ? analyses.reduce((worst, curr) => curr.class_average < worst.class_average ? curr : worst)
    : null;

  // Aggregate grade distribution
  const totalGradeDistribution = analyses.reduce((acc, a) => {
    Object.entries(a.grade_distribution).forEach(([grade, count]) => {
      acc[grade] = (acc[grade] || 0) + count;
    });
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(totalGradeDistribution).map(([grade, value]) => ({
    name: grade,
    value,
    color: GRADE_COLORS[grade as keyof typeof GRADE_COLORS] || '#gray',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subject Analysis</h1>
        <p className="text-muted-foreground">
          Analyze performance by subject across the class
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Class & Term</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id.toString()}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id.toString()}>
                    Term {term.term} ({term.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Year"
              value={academicYear}
              onChange={(e) => setAcademicYear(parseInt(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {analyses.length > 0 && (
        <>
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Subjects Analyzed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyses.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Overall Average
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallAverage.toFixed(1)}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700">
                  <TrendingUp className="h-4 w-4" /> Best Subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bestSubject && (
                  <div>
                    <div className="font-bold text-green-700">{bestSubject.subject_name}</div>
                    <p className="text-sm text-green-600">Avg: {bestSubject.class_average}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-red-50 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
                  <TrendingDown className="h-4 w-4" /> Needs Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {worstSubject && (
                  <div>
                    <div className="font-bold text-red-700">{worstSubject.subject_name}</div>
                    <p className="text-sm text-red-600">Avg: {worstSubject.class_average}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Subject Performance Comparison</CardTitle>
                <CardDescription>Average, highest, and lowest scores by subject</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="average" fill="#3b82f6" name="Average" />
                      <Bar dataKey="highest" fill="#22c55e" name="Highest" />
                      <Bar dataKey="lowest" fill="#ef4444" name="Lowest" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overall Grade Distribution</CardTitle>
                <CardDescription>CBC grades across all subjects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  {Object.entries(GRADE_COLORS).map(([grade, color]) => (
                    <div key={grade} className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                      <span className="text-sm">{grade}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle>Subject Details</CardTitle>
              <CardDescription>Detailed performance metrics for each subject</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Subject</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Scores Entered</TableHead>
                      <TableHead>Class Average</TableHead>
                      <TableHead>Highest</TableHead>
                      <TableHead>Lowest</TableHead>
                      <TableHead>Grade Distribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyses.map((analysis, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-medium">{analysis.subject_name}</div>
                          <div className="text-sm text-muted-foreground">{analysis.subject_code}</div>
                        </TableCell>
                        <TableCell>{analysis.exam_name}</TableCell>
                        <TableCell>{analysis.total_students}</TableCell>
                        <TableCell>
                          {analysis.scores_entered}
                          <Progress 
                            value={(analysis.scores_entered / analysis.total_students) * 100} 
                            className="w-16 h-2 mt-1" 
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-lg">{analysis.class_average}</span>
                        </TableCell>
                        <TableCell className="text-green-600 font-medium">{analysis.highest_score}</TableCell>
                        <TableCell className="text-red-600 font-medium">{analysis.lowest_score}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {Object.entries(analysis.grade_distribution).map(([grade, count]) => (
                              <Badge 
                                key={grade} 
                                style={{ backgroundColor: GRADE_COLORS[grade as keyof typeof GRADE_COLORS] }}
                                className="text-white text-xs"
                              >
                                {grade}: {count}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading analysis...</p>
        </div>
      )}

      {(!selectedClassId || !selectedTermId) && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select Class & Term</h3>
            <p className="text-muted-foreground text-center">
              Choose a class and term to view subject analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedClassId && selectedTermId && analyses.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data Available</h3>
            <p className="text-muted-foreground text-center">
              No published exams found for this class and term.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
