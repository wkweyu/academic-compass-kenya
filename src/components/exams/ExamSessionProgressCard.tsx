import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Lock, Unlock, Users, BookOpen, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ExamSession } from '@/types/exam-management';

interface ExamSessionProgressCardProps {
  session: ExamSession;
  onLockStatusChange?: () => void;
}

interface ClassProgress {
  exam_session_id: number;
  class_id: number;
  class_name: string;
  total_papers: number;
  completed_papers: number;
  completion_percentage: number;
  total_students: number;
}

export function ExamSessionProgressCard({ session, onLockStatusChange }: ExamSessionProgressCardProps) {
  const queryClient = useQueryClient();
  const [isLocking, setIsLocking] = useState(false);

  const { data: classProgress = [], isLoading } = useQuery({
    queryKey: ['exam-session-class-progress', session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_session_class_progress')
        .select('*')
        .eq('exam_session_id', session.id);
      
      if (error) throw error;
      return data as ClassProgress[];
    },
  });

  const lockSessionMutation = useMutation({
    mutationFn: async (lock: boolean) => {
      setIsLocking(true);
      const { error } = await supabase
        .from('exam_sessions')
        .update({ is_locked: lock })
        .eq('id', session.id);
      
      if (error) throw error;
    },
    onSuccess: (_, lock) => {
      toast.success(lock ? 'Session locked successfully' : 'Session unlocked successfully');
      queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      onLockStatusChange?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update session lock status');
    },
    onSettled: () => {
      setIsLocking(false);
    },
  });

  const totalClasses = classProgress.length;
  const completedClasses = classProgress.filter(c => c.completion_percentage === 100).length;
  const overallCompletion = totalClasses > 0 
    ? Math.round(classProgress.reduce((sum, c) => sum + c.completion_percentage, 0) / totalClasses)
    : 0;

  const canLock = overallCompletion === 100 && !session.is_locked;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Class Progress Overview
            </CardTitle>
            <CardDescription>
              {completedClasses} of {totalClasses} classes completed
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {session.is_locked ? (
              <Badge variant="destructive" className="gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Unlock className="h-3 w-3" />
                Editable
              </Badge>
            )}
            {!session.is_locked && (
              <Button
                size="sm"
                variant={canLock ? 'default' : 'outline'}
                disabled={!canLock || isLocking}
                onClick={() => lockSessionMutation.mutate(true)}
              >
                {isLocking ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Lock className="h-4 w-4 mr-1" />
                )}
                Lock Session
              </Button>
            )}
            {session.is_locked && (
              <Button
                size="sm"
                variant="outline"
                disabled={isLocking}
                onClick={() => lockSessionMutation.mutate(false)}
              >
                {isLocking ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Unlock className="h-4 w-4 mr-1" />
                )}
                Unlock (Admin)
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Overall Completion</span>
            <span className="font-medium">{overallCompletion}%</span>
          </div>
          <Progress value={overallCompletion} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {classProgress.map((cls) => (
            <div 
              key={cls.class_id}
              className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">{cls.class_name}</span>
                  <div className="flex items-center gap-2">
                    {cls.completion_percentage === 100 ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : cls.completion_percentage > 0 ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : null}
                    <span className="text-sm font-medium">{cls.completion_percentage}%</span>
                  </div>
                </div>
                <Progress value={cls.completion_percentage} className="h-1.5" />
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {cls.completed_papers}/{cls.total_papers} papers
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {cls.total_students} students
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {!canLock && !session.is_locked && totalClasses > 0 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 inline-block mr-2" />
            Complete all class marks entry to lock this session
          </div>
        )}
      </CardContent>
    </Card>
  );
}
