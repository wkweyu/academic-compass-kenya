import { useState, useEffect } from 'react';
import { Search, Download, Trophy, Users, TrendingUp, Medal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { examManagementService, ClassMeritEntry } from '@/services/examManagementService';
import { getGradeColorClasses } from '@/utils/cbcGrading';

export function ClassMeritListModule() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [meritList, setMeritList] = useState<ClassMeritEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    if (selectedClassId && selectedTermId) {
      loadMeritList();
    }
  }, [selectedClassId, selectedStreamId, selectedTermId, academicYear]);

  const loadFormData = async () => {
    try {
      const { data: schoolId } = await supabase.rpc('get_user_school_id');
      if (!schoolId) return;

      const [classesRes, streamsRes, termsRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
        supabase.from('streams').select('id, name').eq('school_id', schoolId).order('name'),
        supabase.from('settings_termsetting').select('id, term, year').eq('school_id', schoolId).order('year', { ascending: false }).order('term'),
      ]);

      setClasses(classesRes.data || []);
      setStreams(streamsRes.data || []);
      setTerms(termsRes.data || []);
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  };

  const loadMeritList = async () => {
    if (!selectedClassId || !selectedTermId) return;
    
    setLoading(true);
    try {
      const data = await examManagementService.getClassMeritList(
        parseInt(selectedClassId),
        parseInt(selectedTermId),
        academicYear,
        selectedStreamId ? parseInt(selectedStreamId) : undefined
      );
      setMeritList(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load merit list',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedClassId || !selectedTermId) return;
    
    try {
      const blob = await examManagementService.exportClassMeritList(
        parseInt(selectedClassId),
        parseInt(selectedTermId),
        academicYear
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merit-list-${selectedClassId}-term-${selectedTermId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: 'Success', description: 'Merit list exported' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export', variant: 'destructive' });
    }
  };

  const filteredList = meritList.filter(entry =>
    entry.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPositionBadge = (position: number) => {
    if (position === 1) return <Badge className="bg-yellow-500 text-white"><Trophy className="w-3 h-3 mr-1" />1st</Badge>;
    if (position === 2) return <Badge className="bg-gray-400 text-white"><Medal className="w-3 h-3 mr-1" />2nd</Badge>;
    if (position === 3) return <Badge className="bg-amber-600 text-white"><Medal className="w-3 h-3 mr-1" />3rd</Badge>;
    return <Badge variant="outline">{position}</Badge>;
  };

  // Statistics
  const totalStudents = meritList.length;
  const avgPercentage = totalStudents > 0
    ? meritList.reduce((sum, e) => sum + e.percentage, 0) / totalStudents
    : 0;
  const avgPoints = totalStudents > 0
    ? meritList.reduce((sum, e) => sum + e.average_points, 0) / totalStudents
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Merit List</h1>
          <p className="text-muted-foreground">
            View student rankings by class and term
          </p>
        </div>
        
        <Button variant="outline" onClick={handleExport} disabled={meritList.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Class & Term</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
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

            <Select value={selectedStreamId} onValueChange={setSelectedStreamId}>
              <SelectTrigger>
                <SelectValue placeholder="All streams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Streams</SelectItem>
                {streams.map((stream) => (
                  <SelectItem key={stream.id} value={stream.id.toString()}>{stream.name}</SelectItem>
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

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {meritList.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" /> Total Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Class Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgPercentage.toFixed(1)}%</div>
              <Progress value={avgPercentage} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgPoints.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">out of 4.00</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Top Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meritList[0] && (
                <div>
                  <div className="font-bold truncate">{meritList[0].full_name}</div>
                  <p className="text-sm text-muted-foreground">{meritList[0].average_points} pts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Merit List Table */}
      {selectedClassId && selectedTermId && (
        <Card>
          <CardHeader>
            <CardTitle>Merit List</CardTitle>
            <CardDescription>
              Students ranked by average points (CBC rubrics: EE=4, ME=3, AE=2, BE=1)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">Loading merit list...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Results Found</h3>
                <p className="text-muted-foreground">
                  No published exam results for this selection.
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[80px]">Position</TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead>Total Marks</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead>Avg Points</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Subjects</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredList.map((entry) => {
                      const gradeColors = getGradeColorClasses(entry.overall_grade);
                      
                      return (
                        <TableRow key={entry.student_id} className={entry.position <= 3 ? 'bg-yellow-50/50' : ''}>
                          <TableCell>{getPositionBadge(entry.position)}</TableCell>
                          <TableCell className="font-medium">{entry.admission_number}</TableCell>
                          <TableCell className="font-medium">{entry.full_name}</TableCell>
                          <TableCell>{entry.stream_name || '-'}</TableCell>
                          <TableCell>{entry.total_marks}/{entry.total_possible}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={entry.percentage} className="w-16 h-2" />
                              <span className="text-sm">{entry.percentage}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold">{entry.average_points}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${gradeColors.bgColor} ${gradeColors.color}`}>
                              {entry.overall_grade}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.subjects_count}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(!selectedClassId || !selectedTermId) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select Class & Term</h3>
            <p className="text-muted-foreground text-center">
              Choose a class and term to view the merit list.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
