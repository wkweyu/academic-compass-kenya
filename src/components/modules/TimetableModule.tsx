import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronDown, Download, Printer, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { timetableService, ConcurrencyConflictError } from '@/services/timetableService';
import type {
  Timetable,
  TimetableSlot,
  TimetableConflict,
  SchedulingConstraints,
  GenerationResult,
  SchoolGenerationResult,
  SchoolPeriod,
  SchoolDay,
} from '@/types/timetable';
import { makeTeacherDisplayMap, subjectDisplay } from '@/utils/timetableFormatters';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { ConflictBanner } from '@/components/timetable/ConflictBanner';
import { GenerateTimetableDialog } from '@/components/timetable/GenerateTimetableDialog';
import { VersionPickerDialog } from '@/components/timetable/VersionPickerDialog';
import { ConcurrencyConflictDialog } from '@/components/timetable/ConcurrencyConflictDialog';
import { UndoRedoToolbar } from '@/components/timetable/UndoRedoToolbar';
import { TeacherScheduleView } from '@/components/timetable/TeacherScheduleView';
import { SpecialRoomScheduleView } from '@/components/timetable/SpecialRoomScheduleView';
import { PeriodSetupForm } from '@/components/timetable/PeriodSetupForm';
import { SpecialRoomForm } from '@/components/timetable/SpecialRoomForm';
import { CalendarEventsManager } from '@/components/timetable/CalendarEventsManager';
import { SubstitutionForm } from '@/components/timetable/SubstitutionForm';
import { SubstitutionList } from '@/components/timetable/SubstitutionList';
import { TimetableAuditLog } from '@/components/timetable/TimetableAuditLog';
import { TimetableReports } from '@/components/timetable/TimetableReports';
import { TermManager } from '@/utils/termManager';

const MAX_UNDO = 30;

const TAB_ROUTES: Record<string, string> = {
  '/timetable': 'class',
  '/timetable/teacher': 'teacher',
  '/timetable/room': 'room',
  '/timetable/periods': 'periods',
  '/timetable/substitutions': 'substitutions',
};

const TeacherKey = ({ slots }: { slots: TimetableSlot[] }) => {
  if (!slots.length) return null;
  const displayMap = makeTeacherDisplayMap(slots);
  const entries: { code: string; fullName: string }[] = [];
  const seen = new Set<number>();
  for (const s of slots) {
    if (s.teacher && !seen.has(s.teacher.id)) {
      seen.add(s.teacher.id);
      entries.push({
        code: displayMap.get(s.teacher.id) ?? '??',
        fullName: `${s.teacher.first_name} ${s.teacher.last_name}`,
      });
    }
  }
  entries.sort((a, b) => a.code.localeCompare(b.code));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-2 mt-1 print:mt-2">
      <span className="font-semibold text-foreground">Teacher Key:</span>
      {entries.map((e) => (
        <span key={e.code + e.fullName}><strong>{e.code}</strong> — {e.fullName}</span>
      ))}
    </div>
  );
};

export const TimetableModule = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const activeTab = TAB_ROUTES[location.pathname] ?? 'class';

  // Selectors
  const [classes, setClasses] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<1 | 2 | 3>(TermManager.getCurrentTerm() as 1 | 2 | 3);
  const [selectedYear, setSelectedYear] = useState<number>(TermManager.getCurrentYear());
  const [schoolId, setSchoolId] = useState<number | null>(null);

  // Periods & days — authoritative lists from API
  const [schoolPeriods, setSchoolPeriods] = useState<SchoolPeriod[]>([]);
  const [schoolDays, setSchoolDays] = useState<SchoolDay[]>([]);

  // Timetable state
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  // Undo/redo
  const [undoStack, setUndoStack] = useState<TimetableSlot[][]>([]);
  const [redoStack, setRedoStack] = useState<TimetableSlot[][]>([]);

  // Dialogs
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [showConcurrencyDialog, setShowConcurrencyDialog] = useState(false);

  // ============================================================
  // Bootstrap
  // ============================================================

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClassId) loadTimetable();
  }, [selectedClassId, selectedStreamId, selectedTerm, selectedYear]);

  const loadInitialData = async () => {
    const { data: sid } = await supabase.rpc('get_user_school_id');
    if (sid) {
      setSchoolId(sid);
      const [periods, days] = await Promise.all([
        timetableService.getSchoolPeriods(sid),
        timetableService.getSchoolDays(sid),
      ]);
      setSchoolPeriods(periods);
      setSchoolDays(days);
    }

    const { data: classData } = await supabase
      .from('classes')
      .select('id, name, grade_level')
      .eq('school_id', sid)
      .order('name');
    setClasses(classData || []);
  };

  useEffect(() => {
    if (!selectedClassId || !schoolId) return;
    supabase
      .from('streams')
      .select('id, name, current_enrollment')
      .eq('class_id', selectedClassId)
      .eq('school_id', schoolId)
      .order('name')
      .then(({ data }) => setStreams(data || []));
  }, [selectedClassId, schoolId]);

  const loadTimetable = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingTimetable(true);
    try {
      const tt = await timetableService.getTimetable(
        selectedClassId, selectedStreamId, selectedTerm, selectedYear
      );
      setTimetable(tt);
      if (tt) {
        const fetchedSlots = await timetableService.getTimetableSlots(tt.id);
        setSlots(fetchedSlots);
      } else {
        setSlots([]);
      }
      setConflicts([]);
      setUndoStack([]);
      setRedoStack([]);
    } catch (err: any) {
      toast({ title: 'Error loading timetable', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingTimetable(false);
    }
  }, [selectedClassId, selectedStreamId, selectedTerm, selectedYear]);

  // ============================================================
  // Slot editing
  // ============================================================

  const handleSlotUpdate = useCallback((updatedSlot: TimetableSlot) => {
    setSlots((prev) => {
      setUndoStack((u) => [...u.slice(-MAX_UNDO + 1), prev]);
      setRedoStack([]);
      return prev.map((s) => (s.id === updatedSlot.id ? updatedSlot : s));
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack((r) => [...r, slots]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setSlots(prev);
  }, [undoStack, slots]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack((u) => [...u, slots]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setSlots(next);
  }, [redoStack, slots]);

  // ============================================================
  // Save
  // ============================================================

  const handleSave = useCallback(async () => {
    if (!timetable) return;
    try {
      await timetableService.saveTimetableSlots(timetable.id, slots, timetable.updated_at);
      toast({ title: 'Timetable saved' });
      loadTimetable();
    } catch (err: any) {
      if (err instanceof ConcurrencyConflictError) {
        setShowConcurrencyDialog(true);
      } else {
        toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
      }
    }
  }, [timetable, slots, loadTimetable]);

  // ============================================================
  // Generation result handler
  // ============================================================

  const handleGenerationResult = useCallback(async (result: GenerationResult) => {
    if (!selectedClassId || !schoolId) return;

    // Ensure a draft timetable exists
    let tt = timetable;
    if (!tt) {
      const { data: newTt } = await supabase
        .from('timetables')
        .insert({
          school_id: schoolId,
          class_id: selectedClassId,
          stream_id: selectedStreamId,
          academic_year: selectedYear,
          term: selectedTerm,
          status: 'draft',
          version: 1,
          generated_at: new Date().toISOString(),
        })
        .select()
        .single();
      tt = newTt as Timetable;
      setTimetable(tt);
    }

    // Assign timetable_id to all result slots
    const withTtId = result.slots.map((s) => ({ ...s, timetable_id: tt!.id }));
    setSlots(withTtId);
    setConflicts(result.conflicts);
    setUndoStack([]);
    setRedoStack([]);
    setShowGenerateDialog(false);

    if (result.unassigned.length > 0) {
      toast({
        title: `${result.unassigned.length} subject(s) could not be scheduled`,
        description: result.unassigned.map((u) => `${u.subject.name}: ${u.reason}`).join(', '),
        variant: 'destructive',
      });
    }
  }, [selectedClassId, selectedStreamId, selectedTerm, selectedYear, schoolId, timetable]);

  // ============================================================
  // School generation result handler
  // ============================================================

  const handleSchoolGenerationResult = useCallback((result: SchoolGenerationResult) => {
    const filled = result.results.reduce((sum, r) => sum + r.slotsFilled, 0);
    const total = result.results.reduce((sum, r) => sum + r.slotsRequired, 0);
    const classCount = result.results.filter((r) => r.slotsFilled > 0).length;
    toast({
      title: `School-wide generation complete`,
      description: `${classCount}/${result.results.length} classes generated — ${filled}/${total} slots filled.`,
    });
    // Reload current class if one is selected
    if (selectedClassId) loadTimetable();
  }, [selectedClassId, loadTimetable, toast]);

  // ============================================================
  // Print & Export CSV
  // ============================================================

  const handlePrint = () => window.print();

  const handleExportCSV = useCallback(() => {
    if (!slots.length || !schoolPeriods.length) return;
    const displayMap = makeTeacherDisplayMap(slots);
    const header = ['Period', 'Time', ...schoolDays.map((d) => d.name)];
    const rows = schoolPeriods.map((p) => {
      const time = `${p.start_time}–${p.end_time}`;
      if (p.is_break) {
        return [p.name, time, ...schoolDays.map(() => 'Break')];
      }
      return [
        p.name,
        time,
        ...schoolDays.map((d) => {
          const s = slots.find((sl) => sl.period_id === p.id && sl.day_of_week === d.day_of_week);
          if (!s) return '';
          const code = subjectDisplay(s.subject);
          const teacherCode = s.teacher_id != null ? (displayMap.get(s.teacher_id) ?? '') : '';
          return teacherCode ? `${code} (${teacherCode})` : code;
        }),
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const className = classes.find((c) => c.id === selectedClassId)?.name ?? 'class';
    a.download = `timetable-${className}-term${selectedTerm}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [slots, schoolPeriods, schoolDays, classes, selectedClassId, selectedTerm, selectedYear]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Timetable Management</h1>
          {timetable && (
            <Badge variant={timetable.status === 'published' ? 'default' : 'secondary'}>
              {timetable.status} v{timetable.version}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          {slots.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Selector row */}
      <div className="flex flex-wrap gap-3 print:hidden">
        <Select
          value={String(selectedClassId ?? '')}
          onValueChange={(v) => { setSelectedClassId(Number(v)); setSelectedStreamId(null); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {streams.length > 0 && (
          <Select
            value={String(selectedStreamId ?? '')}
            onValueChange={(v) => setSelectedStreamId(v ? Number(v) : null)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Stream (all)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All streams</SelectItem>
              {streams.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={String(selectedTerm)} onValueChange={(v) => setSelectedTerm(Number(v) as 1 | 2 | 3)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Term 1</SelectItem>
            <SelectItem value="2">Term 2</SelectItem>
            <SelectItem value="3">Term 3</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={(v) => navigate(v === 'class' ? '/timetable' : `/timetable/${v}`)}>
        <TabsList className="print:hidden">
          <TabsTrigger value="class">Class Timetable</TabsTrigger>
          <TabsTrigger value="teacher">Teacher Schedule</TabsTrigger>
          <TabsTrigger value="room">Special Rooms</TabsTrigger>
          <TabsTrigger value="periods">Periods & Calendar</TabsTrigger>
          <TabsTrigger value="substitutions">Substitutions</TabsTrigger>
        </TabsList>

        {/* ── CLASS TIMETABLE ── */}
        <TabsContent value="class" className="space-y-4">
          {conflicts.length > 0 && <ConflictBanner conflicts={conflicts} onDismissSoft={() => setConflicts((c) => c.filter((x) => x.severity === 'hard'))} />}

          <div className="flex items-center justify-between print:hidden">
            <UndoRedoToolbar
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
            <div className="flex gap-2">
              {timetable && (
                <Button variant="outline" size="sm" onClick={() => setShowVersionPicker(true)}>
                  Versions <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              )}
              {selectedClassId && (
                <Button variant="outline" size="sm" onClick={() => setShowGenerateDialog(true)}>
                  Generate
                </Button>
              )}
              {timetable && (
                <>
                  <Button variant="outline" size="sm" onClick={handleSave}>Save Draft</Button>
                  {timetable.status === 'draft' && (
                    <Button size="sm" onClick={async () => { await timetableService.publishTimetable(timetable.id); loadTimetable(); }}>
                      Publish
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {loadingTimetable ? (
            <div className="text-center py-12 text-muted-foreground">Loading timetable…</div>
          ) : !selectedClassId ? (
            <div className="text-center py-12 text-muted-foreground">Select a class to view its timetable.</div>
          ) : !timetable ? (
            <div className="text-center py-12 text-muted-foreground">
              No timetable yet.{' '}
              <button className="text-primary underline" onClick={() => setShowGenerateDialog(true)}>
                Generate one
              </button>
            </div>
          ) : (
            <>
              <TimetableGrid
                slots={slots}
                timetableId={timetable.id}
                onSlotUpdated={handleSlotUpdate}
                conflicts={conflicts}
                classSize={streams.find((s) => s.id === selectedStreamId)?.current_enrollment ?? 40}
                schoolId={schoolId!}
                periods={schoolPeriods}
                days={schoolDays}
                printMeta={{
                  className: classes.find((c) => c.id === selectedClassId)?.name ?? '',
                  streamName: streams.find((s) => s.id === selectedStreamId)?.name,
                  term: selectedTerm,
                  year: selectedYear,
                  generatedAt: timetable.generated_at,
                }}
              />
              <TeacherKey slots={slots} />
            </>
          )}

          {/* Reports section below grid */}
          {timetable && <TimetableReports timetableId={timetable.id} schoolId={schoolId!} term={selectedTerm} year={selectedYear} />}
          {timetable && <TimetableAuditLog timetableId={timetable.id} />}
        </TabsContent>

        {/* ── TEACHER SCHEDULE ── */}
        <TabsContent value="teacher">
          <TeacherScheduleView term={selectedTerm} year={selectedYear} schoolId={schoolId} />
        </TabsContent>

        {/* ── SPECIAL ROOMS ── */}
        <TabsContent value="room">
          <SpecialRoomScheduleView term={selectedTerm} year={selectedYear} schoolId={schoolId} />
        </TabsContent>

        {/* ── PERIODS & CALENDAR ── */}
        <TabsContent value="periods" className="space-y-6">
          {schoolId && (
            <>
              <PeriodSetupForm schoolId={schoolId} />
              <SpecialRoomForm schoolId={schoolId} />
              <CalendarEventsManager schoolId={schoolId} term={selectedTerm} year={selectedYear} />
            </>
          )}
        </TabsContent>

        {/* ── SUBSTITUTIONS ── */}
        <TabsContent value="substitutions" className="space-y-6">
          {schoolId && timetable && (
            <SubstitutionForm
              timetable={timetable}
              schoolId={schoolId}
              onCreated={() => toast({ title: 'Substitution assigned' })}
            />
          )}
          {schoolId && <SubstitutionList schoolId={schoolId} />}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showGenerateDialog && selectedClassId && (
        <GenerateTimetableDialog
          classId={selectedClassId}
          streamId={selectedStreamId}
          term={selectedTerm}
          year={selectedYear}
          onResult={handleGenerationResult}
          onClose={() => setShowGenerateDialog(false)}
          schoolId={schoolId}
          onSchoolResult={handleSchoolGenerationResult}
        />
      )}

      {showVersionPicker && timetable && (
        <VersionPickerDialog
          classId={timetable.class_id}
          streamId={timetable.stream_id}
          term={selectedTerm}
          year={selectedYear}
          currentVersion={timetable.version}
          onSelect={async (tt) => { setTimetable(tt); const s = await timetableService.getTimetableSlots(tt.id); setSlots(s); setShowVersionPicker(false); }}
          onClose={() => setShowVersionPicker(false)}
        />
      )}

      <ConcurrencyConflictDialog
        open={showConcurrencyDialog}
        onReload={() => { setShowConcurrencyDialog(false); loadTimetable(); }}
      />
    </div>
  );
};
