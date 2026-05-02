// @ts-nocheck
import { useState, useEffect } from 'react';
import { Search, Download, TrendingUp, BarChart3, Users, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { resultsService } from '@/services/resultsService';

interface StudentResult {
  id: number;
  student_id: number;
  admission_number: string;
  full_name: string;
  class_name: string;
  stream: string;
  total_marks: number;
  total_possible: number;
  percentage: number;
  overall_grade: string;
  position: number;
  subject_results: SubjectResult[];
}

interface SubjectResult {
  subject_name: string;
  subject_code: string;
  marks: number;
  max_marks: number;
  grade: string;
  percentage: number;
}

interface ResultStats {
  total_students: number;
  class_average: number;
  highest_score: number;
  lowest_score: number;
  grade_distribution: { [key: string]: number };
}

export const StudentResultsModule = () => {
  const { toast } = useToast();
  const [results, setResults] = useState<StudentResult[]>([]);
  const [stats, setStats] = useState<ResultStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<number>(2);
  const [selectedYear, setSelectedYear] = useState<number>(2024);

  const classes = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 
    'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'
  ];

  useEffect(() => {
    if (selectedClass) {
      loadResults();
    }
  }, [selectedClass, selectedTerm, selectedYear]);

  const loadResults = async () => {
    if (!selectedClass) return;
    
    setLoading(true);
    try {
      const [resultsData, statsData] = await Promise.all([
        resultsService.getClassResults(selectedClass, selectedTerm, selectedYear),
        resultsService.getResultsStats(selectedClass, selectedTerm, selectedYear)
      ]);
      
      setResults(resultsData);
      setStats(statsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load results",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportResults = async () => {
    if (!selectedClass) return;
    
    try {
      const blob = await resultsService.exportResults(selectedClass, selectedTerm, selectedYear);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `results-${selectedClass.replace(' ', '-')}-T${selectedTerm}-${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Results exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export results",
        variant: "destructive",
      });
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'E': return 'bg-green-100 text-green-800';
      case 'M': return 'bg-blue-100 text-blue-800';
      case 'A': return 'bg-yellow-100 text-yellow-800';
      case 'B': return 'bg-orange-100 text-orange-800';
      case 'P': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredResults = results.filter(result =>
    result.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Results</h1>
          <p className="text-muted-foreground">
            View and analyze student academic performance
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportResults} disabled={!selectedClass}>
            <Download className="mr-2 h-4 w-4" />
            Export Results
          </Button>
          <Button variant="outline" disabled={!selectedClass}>
            <FileText className="mr-2 h-4 w-4" />
            Generate Report Cards
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Class & Term</CardTitle>
          <CardDescription>Choose a class and term to view results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-2">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Select value={selectedTerm.toString()} onValueChange={(value) => setSelectedTerm(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Term 1</SelectItem>
                  <SelectItem value="2">Term 2</SelectItem>
                  <SelectItem value="3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && selectedClass && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_students}</div>
              <p className="text-xs text-muted-foreground">
                {selectedClass} - Term {selectedTerm}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Class Average</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPerformanceColor(stats.class_average)}`}>
                {stats.class_average}%
              </div>
              <Progress value={stats.class_average} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.highest_score}%</div>
              <p className="text-xs text-muted-foreground">
                Best performance
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grade Distribution</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.grade_distribution).map(([grade, count]) => (
                  <div key={grade} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{grade}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {selectedClass && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedClass} Results - Term {selectedTerm}, {selectedYear}
            </CardTitle>
            <CardDescription>
              Academic performance summary for all students
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading results...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Total Marks</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Overall Grade</TableHead>
                    <TableHead>Subject Breakdown</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">
                        <Badge 
                          className={
                            result.position <= 3 ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'
                          }
                        >
                          {result.position}
                        </Badge>
                      </TableCell>
                      <TableCell>{result.admission_number}</TableCell>
                      <TableCell className="font-medium">{result.full_name}</TableCell>
                      <TableCell>
                        {result.total_marks}/{result.total_possible}
                      </TableCell>
                      <TableCell>
                        <div className={`font-bold ${getPerformanceColor(result.percentage)}`}>
                          {result.percentage}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getGradeColor(result.overall_grade)}>
                          {result.overall_grade}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {result.subject_results.slice(0, 4).map((subject, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {subject.subject_code}: {subject.grade}
                            </Badge>
                          ))}
                          {result.subject_results.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{result.subject_results.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedClass && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Class</h3>
            <p className="text-muted-foreground text-center">
              Choose a class from the dropdown above to view student results.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};