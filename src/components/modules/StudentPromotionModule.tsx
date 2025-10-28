import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ArrowRight,
  Users,
  TrendingUp,
  History,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { bulkPromoteStudents, getPromotionHistory } from '@/services/promotionService';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/errorHandler';

const StudentPromotionModule = () => {
  const [fromClassId, setFromClassId] = useState<string>('');
  const [toClassId, setToClassId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>(new Date().getFullYear().toString());
  const [notes, setNotes] = useState('');
  const [historyFilters, setHistoryFilters] = useState<{
    academic_year?: number;
    from_class_id?: number;
  }>({});

  const queryClient = useQueryClient();

  // Fetch classes
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .order('grade_level', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch students in selected class
  const { data: studentsToPromote, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-to-promote', fromClassId],
    queryFn: async () => {
      if (!fromClassId) return [];
      
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, admission_number, current_class_id')
        .eq('current_class_id', parseInt(fromClassId))
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!fromClassId
  });

  // Fetch promotion history
  const { data: promotionHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['promotion-history', historyFilters],
    queryFn: () => getPromotionHistory(historyFilters)
  });

  // Bulk promotion mutation
  const promotionMutation = useMutation({
    mutationFn: bulkPromoteStudents,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-to-promote'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-history'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      
      if (result.success > 0 && result.failed === 0) {
        showSuccess(`Successfully promoted ${result.success} student${result.success !== 1 ? 's' : ''}`);
      } else if (result.success > 0 && result.failed > 0) {
        toast.warning(
          `Promoted ${result.success} students, ${result.failed} failed`,
          { duration: 5000 }
        );
        result.errors.forEach(err => {
          toast.error(`Student ID ${err.student_id}: ${err.error}`, { duration: 4000 });
        });
      } else {
        showError('Promotion failed. Please try again.');
        result.errors.forEach(err => {
          toast.error(`Student ID ${err.student_id}: ${err.error}`, { duration: 4000 });
        });
      }
      
      // Reset form
      setFromClassId('');
      setToClassId('');
      setNotes('');
    },
    onError: (error: any) => {
      showError(error.message || 'Failed to promote students');
    }
  });

  const handleBulkPromotion = () => {
    if (!fromClassId || !toClassId) {
      toast.error('Please select both source and destination classes');
      return;
    }

    if (fromClassId === toClassId) {
      toast.error('Source and destination classes must be different');
      return;
    }

    const fromClass = classes?.find(c => c.id.toString() === fromClassId);
    const toClass = classes?.find(c => c.id.toString() === toClassId);

    if (window.confirm(
      `Promote all ${studentsToPromote?.length || 0} students from ${fromClass?.name} to ${toClass?.name}?`
    )) {
      promotionMutation.mutate({
        from_class_id: parseInt(fromClassId),
        to_class_id: parseInt(toClassId),
        academic_year: parseInt(academicYear),
        notes
      });
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Student Promotion & Transfer</h1>
        <p className="text-muted-foreground">Promote students to the next class or transfer between classes</p>
      </div>

      <Tabs defaultValue="bulk-promotion" className="w-full">
        <TabsList>
          <TabsTrigger value="bulk-promotion">
            <TrendingUp className="h-4 w-4 mr-2" />
            Bulk Promotion
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Promotion History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk-promotion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Student Promotion</CardTitle>
              <CardDescription>
                Promote all students from one class to another
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will promote all active students from the selected source class to the destination class.
                  This action will update student records and create promotion history entries.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Select value={academicYear} onValueChange={setAcademicYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Number of Students</Label>
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {loadingStudents ? 'Loading...' : (studentsToPromote?.length || 0)} students
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="space-y-2">
                  <Label>From Class (Current)</Label>
                  <Select value={fromClassId} onValueChange={setFromClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map(cls => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-center pt-6">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <Label>To Class (Next)</Label>
                  <Select value={toClassId} onValueChange={setToClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map(cls => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes about this promotion..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {fromClassId && studentsToPromote && studentsToPromote.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Students to be Promoted</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {studentsToPromote.map(student => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted"
                        >
                          <span className="text-sm">{student.full_name}</span>
                          <Badge variant="outline">{student.admission_number}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFromClassId('');
                    setToClassId('');
                    setNotes('');
                  }}
                  disabled={promotionMutation.isPending}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleBulkPromotion}
                  disabled={!fromClassId || !toClassId || promotionMutation.isPending || !studentsToPromote?.length}
                >
                  {promotionMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Promoting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Promote {studentsToPromote?.length || 0} Students
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Promotion History</CardTitle>
              <CardDescription>View all student promotions and transfers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Filter by Academic Year</Label>
                  <Select
                    value={historyFilters.academic_year?.toString() || 'all'}
                    onValueChange={(value) => 
                      setHistoryFilters(prev => ({
                        ...prev,
                        academic_year: value === 'all' ? undefined : parseInt(value)
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Filter by Class</Label>
                  <Select
                    value={historyFilters.from_class_id?.toString() || 'all'}
                    onValueChange={(value) =>
                      setHistoryFilters(prev => ({
                        ...prev,
                        from_class_id: value === 'all' ? undefined : parseInt(value)
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes?.map(cls => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : promotionHistory && promotionHistory.length > 0 ? (
                <div className="space-y-2">
                  {promotionHistory.map(record => (
                    <Card key={record.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-medium">{record.student_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <span>{record.from_class_name}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span>{record.to_class_name}</span>
                            </div>
                            {record.notes && (
                              <div className="text-xs text-muted-foreground italic">
                                {record.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant="outline">{record.academic_year}</Badge>
                            <div className="text-xs text-muted-foreground">
                              {new Date(record.promotion_date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No promotion history</h3>
                  <p className="text-muted-foreground">
                    No promotions have been recorded yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentPromotionModule;
