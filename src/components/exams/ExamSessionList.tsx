import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Calendar, BookOpen, Users, MoreVertical, Play, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { examSessionService } from '@/services/examSessionService';
import { ExamSession, ExamSessionStatus } from '@/types/exam-management';
import { CreateExamSessionForm } from './CreateExamSessionForm';

const statusConfig: Record<ExamSessionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  upcoming: { label: 'Upcoming', variant: 'outline', icon: <Calendar className="h-3 w-3" /> },
  active: { label: 'Active', variant: 'default', icon: <Play className="h-3 w-3" /> },
  completed: { label: 'Completed', variant: 'secondary', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
};

interface ExamSessionListProps {
  onSelectSession: (session: ExamSession) => void;
}

export function ExamSessionList({ onSelectSession }: ExamSessionListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['exam-sessions'],
    queryFn: () => examSessionService.getExamSessions(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ExamSessionStatus }) =>
      examSessionService.updateExamSession(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      toast({ title: 'Session status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => examSessionService.deleteExamSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      toast({ title: 'Session deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Exam Sessions</h2>
          <p className="text-sm text-muted-foreground">Manage examination sessions and track progress</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Exam Session</DialogTitle>
            </DialogHeader>
            <CreateExamSessionForm onSuccess={() => {
              setIsCreateOpen(false);
              queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
            }} />
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No exam sessions</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first exam session to start managing exams
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const config = statusConfig[session.status];
            return (
              <Card 
                key={session.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onSelectSession(session)}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate">{session.name}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Term {session.term_number} • {session.academic_year}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={config.variant} className="flex items-center gap-1">
                        {config.icon}
                        {config.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {session.status === 'upcoming' && (
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: session.id, status: 'active' })}>
                              <Play className="mr-2 h-4 w-4" />
                              Start Session
                            </DropdownMenuItem>
                          )}
                          {session.status === 'active' && (
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: session.id, status: 'completed' })}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Complete Session
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => deleteMutation.mutate(session.id)}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="truncate">
                          {format(new Date(session.start_date), 'MMM d')} - {format(new Date(session.end_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        {session.classes_count} classes
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        {session.papers_count} papers
                      </div>
                    </div>

                    {session.status !== 'upcoming' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Completion</span>
                          <span className="font-medium">{session.completion_percentage}%</span>
                        </div>
                        <Progress value={session.completion_percentage} className="h-2" />
                      </div>
                    )}

                    {session.is_locked && (
                      <div className="flex items-center gap-1 text-sm text-yellow-600">
                        <Lock className="h-4 w-4" />
                        Session locked
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
