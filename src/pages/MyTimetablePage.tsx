import { useQuery } from '@tanstack/react-query';
import { Printer, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { timetableService } from '@/services/timetableService';
import { supabase } from '@/integrations/supabase/client';
import { TermManager } from '@/utils/termManager';

export default function MyTimetablePage() {
  const currentTerm = TermManager.getCurrentTerm() as 1 | 2 | 3;
  const currentYear = TermManager.getCurrentYear();

  // Step 1: authenticated user's email and school
  const { data: authUser } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: schoolId } = useQuery({
    queryKey: ['my-school-id'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_school_id');
      return data as number | null;
    },
  });

  // Step 2: find the student record by email match
  const { data: studentProfile, isLoading: loadingStudent } = useQuery({
    queryKey: ['my-student-profile', authUser?.email],
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, current_class_id, current_stream_id, current_class_name:classes(name), current_stream_name:streams(name)')
        .eq('email', authUser!.email!)
        .maybeSingle();
      return data as {
        id: number;
        full_name: string;
        current_class_id: number | null;
        current_stream_id: number | null;
        current_class_name: { name: string } | null;
        current_stream_name: { name: string } | null;
      } | null;
    },
    enabled: !!authUser?.email,
  });

  const classId = studentProfile?.current_class_id ?? null;
  const streamId = studentProfile?.current_stream_id ?? null;
  const className = studentProfile?.current_class_name?.name ?? '';
  const streamName = studentProfile?.current_stream_name?.name ?? null;

  // Step 3: published timetable for the student's class (RLS enforces published-only for student role)
  const { data: timetable, isLoading: loadingTimetable } = useQuery({
    queryKey: ['my-timetable', classId, streamId, currentTerm, currentYear],
    queryFn: () => timetableService.getTimetable(classId!, streamId, currentTerm, currentYear),
    enabled: !!classId,
  });

  // Step 4: slots, periods, days (parallel once we have timetable + school)
  const { data: slots = [] } = useQuery({
    queryKey: ['my-timetable-slots', timetable?.id],
    queryFn: () => timetableService.getTimetableSlots(timetable!.id),
    enabled: !!timetable?.id,
  });

  const { data: periods = [] } = useQuery({
    queryKey: ['my-school-periods', schoolId],
    queryFn: () => timetableService.getSchoolPeriods(schoolId!),
    enabled: !!schoolId,
  });

  const { data: days = [] } = useQuery({
    queryKey: ['my-school-days', schoolId],
    queryFn: () => timetableService.getSchoolDays(schoolId!),
    enabled: !!schoolId,
  });

  const isLoading = loadingStudent || loadingTimetable;

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // ── No student record linked ──
  if (!studentProfile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <CalendarDays size={48} className="mx-auto text-muted-foreground opacity-50" />
            <p className="font-medium">No student record linked to your account.</p>
            <p className="text-sm text-muted-foreground">
              Contact your school administrator to link your account to a student profile.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Student has no class ──
  if (!classId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <CalendarDays size={48} className="mx-auto text-muted-foreground opacity-50" />
            <p className="font-medium">No class assigned to your account.</p>
            <p className="text-sm text-muted-foreground">Contact your school administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── No published timetable ──
  if (!timetable) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">My Timetable</h1>
          <p className="text-muted-foreground">{className}{streamName ? ` · ${streamName}` : ''}</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <CalendarDays size={48} className="mx-auto text-muted-foreground opacity-50" />
            <p className="font-medium">No published timetable for Term {currentTerm}, {currentYear}.</p>
            <p className="text-sm text-muted-foreground">Check back once the school administrator publishes the timetable.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Full timetable view ──
  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Timetable</h1>
          <p className="text-muted-foreground">
            {className}{streamName ? ` · ${streamName}` : ''} &mdash; Term {currentTerm}, {currentYear}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="gap-2">
          <Printer size={16} />
          Print
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays size={18} />
            Week Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <TimetableGrid
            slots={slots}
            timetableId={timetable.id}
            onSlotUpdated={() => { /* read-only */ }}
            conflicts={[]}
            classSize={0}
            schoolId={schoolId ?? 0}
            periods={periods}
            days={days}
            printMeta={{
              className,
              streamName,
              term: currentTerm,
              year: currentYear,
              generatedAt: timetable.generated_at,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
