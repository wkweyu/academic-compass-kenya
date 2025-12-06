import { useState, useEffect } from 'react';
import { staffService } from '@/services/teacherService';
import { Staff } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search, TrendingUp, Users, BookOpen, Calendar, 
  AlertTriangle, Award, BarChart3, RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';

interface PerformanceData {
  teacher_id: number;
  academic_year: number;
  workload_summary: {
    total_lessons: number;
    weekly_limit: number;
    workload_efficiency: number;
    is_overloaded: boolean;
    classes_count: number;
    subjects_count: number;
  };
  attendance_summary: {
    attendance_rate: number;
    days_present: number;
    days_absent: number;
    days_on_leave: number;
  };
  class_performance: Array<{
    class_id: number;
    class_name: string;
    average_score: number;
    total_students: number;
  }>;
  subject_performance: Array<{
    subject_id: number;
    subject_name: string;
    average_score: number;
    total_exams: number;
  }>;
  overall_rating: string;
}

const TeacherPerformanceModule = () => {
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Staff | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [overloadedTeachers, setOverloadedTeachers] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTeachers();
    loadOverloadedTeachers();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      loadPerformance(selectedTeacher.id);
    }
  }, [selectedTeacher, selectedYear]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const data = await staffService.getStaff({ staff_category: 'Teaching Staff', status: 'Active' });
      setTeachers(data);
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverloadedTeachers = async () => {
    try {
      const data = await staffService.getOverloadedTeachers();
      setOverloadedTeachers(data);
    } catch (error) {
      console.error('Error loading overloaded teachers:', error);
    }
  };

  const loadPerformance = async (teacherId: number) => {
    try {
      const data = await staffService.getTeacherPerformanceAnalytics(teacherId, selectedYear);
      setPerformance(data);
    } catch (error) {
      console.error('Error loading performance:', error);
      toast.error('Failed to load performance data');
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.employee_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'bg-green-100 text-green-800';
      case 'Good': return 'bg-blue-100 text-blue-800';
      case 'Satisfactory': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const getWorkloadColor = (percentage: number) => {
    if (percentage <= 80) return 'text-green-600';
    if (percentage <= 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Workload Alerts */}
      {overloadedTeachers.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Workload Alerts ({overloadedTeachers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {overloadedTeachers.map(teacher => (
                <Badge 
                  key={teacher.id} 
                  variant="outline" 
                  className="border-yellow-400 bg-yellow-100 cursor-pointer"
                  onClick={() => setSelectedTeacher(teacher)}
                >
                  {teacher.full_name} - {(teacher as any).current_workload}/{(teacher as any).weekly_workload_limit || 28} lessons
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teacher List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teaching Staff
            </CardTitle>
            <CardDescription>Select to view performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTeacher?.id === teacher.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{teacher.full_name}</p>
                        <p className="text-sm text-muted-foreground">{teacher.department}</p>
                      </div>
                      {overloadedTeachers.find(t => t.id === teacher.id) && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Details */}
        <Card className="lg:col-span-2">
          {selectedTeacher && performance ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedTeacher.full_name}
                      <Badge className={getRatingColor(performance.overall_rating)}>
                        {performance.overall_rating}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{selectedTeacher.department} • {selectedTeacher.job_title}</CardDescription>
                  </div>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2023, 2024, 2025].map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="summary" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="workload">Workload</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="performance">Class Performance</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <BookOpen className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <p className="text-2xl font-bold">{performance.workload_summary.subjects_count}</p>
                          <p className="text-sm text-muted-foreground">Subjects</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                          <p className="text-2xl font-bold">{performance.workload_summary.classes_count}</p>
                          <p className="text-sm text-muted-foreground">Classes</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Calendar className="h-8 w-8 mx-auto mb-2 text-green-600" />
                          <p className="text-2xl font-bold">{performance.attendance_summary.attendance_rate}%</p>
                          <p className="text-sm text-muted-foreground">Attendance</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <BarChart3 className={`h-8 w-8 mx-auto mb-2 ${getWorkloadColor(performance.workload_summary.workload_efficiency)}`} />
                          <p className="text-2xl font-bold">{performance.workload_summary.total_lessons}</p>
                          <p className="text-sm text-muted-foreground">Weekly Lessons</p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="workload" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Workload Utilization</span>
                        <span className={getWorkloadColor(performance.workload_summary.workload_efficiency)}>
                          {performance.workload_summary.total_lessons} / {performance.workload_summary.weekly_limit} lessons
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(performance.workload_summary.workload_efficiency, 100)} 
                        className={performance.workload_summary.is_overloaded ? 'bg-red-100' : ''}
                      />
                      {performance.workload_summary.is_overloaded && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          <span className="text-red-800">
                            This teacher is overloaded by {performance.workload_summary.total_lessons - performance.workload_summary.weekly_limit} lessons per week
                          </span>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="attendance" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-700">{performance.attendance_summary.days_present}</p>
                        <p className="text-sm text-green-600">Days Present</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-700">{performance.attendance_summary.days_absent}</p>
                        <p className="text-sm text-red-600">Days Absent</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-700">{performance.attendance_summary.days_on_leave}</p>
                        <p className="text-sm text-blue-600">Days on Leave</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-700">{performance.attendance_summary.attendance_rate}%</p>
                        <p className="text-sm text-purple-600">Attendance Rate</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="performance" className="space-y-4">
                    {performance.class_performance.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Class</TableHead>
                            <TableHead className="text-right">Avg Score</TableHead>
                            <TableHead className="text-right">Students</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {performance.class_performance.map((cp) => (
                            <TableRow key={cp.class_id}>
                              <TableCell>{cp.class_name}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={cp.average_score >= 70 ? 'default' : 'secondary'}>
                                  {cp.average_score}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{cp.total_students}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No exam performance data available yet</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[400px]">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a teacher to view performance analytics</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TeacherPerformanceModule;
