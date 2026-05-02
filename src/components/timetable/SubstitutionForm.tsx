import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { timetableService } from '@/services/timetableService';
import type { TimetableSlot } from '@/types/timetable';
import { supabase } from '@/integrations/supabase/client';

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
}

interface QualifiedTeacher {
  teacher_id: number;
  first_name: string;
  last_name: string;
  proficiency: string;
}

interface Props {
  schoolId: number;
  term: 1 | 2 | 3;
  year: number;
}

export const SubstitutionForm = ({ schoolId, term, year }: Props) => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [absentTeacherId, setAbsentTeacherId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [affectedSlots, setAffectedSlots] = useState<TimetableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [qualifiedTeachers, setQualifiedTeachers] = useState<QualifiedTeacher[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    supabase
      .from('teachers')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .then(({ data }) => setTeachers((data as Teacher[]) ?? []));
  }, [schoolId]);

  const loadAffectedSlots = async () => {
    if (!absentTeacherId || !date) return;
    setLoading(true);
    try {
      const slots = await timetableService.getTeacherTimetable(absentTeacherId, term, year, date);
      setAffectedSlots(slots);
      setSelectedSlot(null);
      setQualifiedTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = async (slot: TimetableSlot) => {
    setSelectedSlot(slot);
    const qt = await timetableService.getQualifiedAvailableTeachers(slot.id, date, schoolId);
    setQualifiedTeachers(qt);
    setSelectedSubId(null);
  };

  const handleAssign = async () => {
    if (!selectedSlot || !selectedSubId || !absentTeacherId) return;
    setAssigning(true);
    try {
      await timetableService.createSubstitution({
        slot_id: selectedSlot.id,
        original_teacher_id: absentTeacherId,
        substitute_teacher_id: selectedSubId,
        substitution_date: date,
        reason: 'Teacher absent',
        status: 'pending',
      });
      toast({ title: 'Substitution assigned' });
      setAffectedSlots((prev) => prev.filter((s) => s.id !== selectedSlot.id));
      setSelectedSlot(null);
      setQualifiedTeachers([]);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Assign Substitution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1 w-56">
            <Label>Absent teacher</Label>
            <Select value={absentTeacherId?.toString() ?? ''} onValueChange={(v) => setAbsentTeacherId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.first_name} {t.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          </div>
          <Button onClick={loadAffectedSlots} disabled={!absentTeacherId || !date || loading} size="sm">
            {loading ? 'Loading…' : 'Find Affected Slots'}
          </Button>
        </div>

        {affectedSlots.length === 0 && absentTeacherId && !loading && (
          <Alert>
            <AlertDescription>No timetable slots found for this teacher on {date}.</AlertDescription>
          </Alert>
        )}

        {affectedSlots.length > 0 && (
          <div className="space-y-2">
            <Label>Affected slots — click to assign substitute</Label>
            <div className="flex flex-wrap gap-2">
              {affectedSlots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSlot(s)}
                  className={`rounded border px-3 py-1.5 text-xs text-left transition-colors ${selectedSlot?.id === s.id ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
                >
                  <div className="font-medium">{(s as any).subject?.name ?? 'Period'}</div>
                  <div className="text-xs opacity-75">{['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][s.day_of_week]} · {(s as any).period?.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSlot && (
          <div className="space-y-3 border-t pt-3">
            <Label>Available substitutes for: <span className="font-medium">{(selectedSlot as any).subject?.name}</span></Label>
            {qualifiedTeachers.length === 0 ? (
              <Alert variant="destructive">
                <AlertDescription>No qualified and available substitutes found for this slot.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-1">
                {qualifiedTeachers.map((qt) => (
                  <label key={qt.teacher_id} className={`flex items-center gap-3 rounded border px-3 py-2 cursor-pointer transition-colors ${selectedSubId === qt.teacher_id ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                    <input
                      type="radio"
                      name="sub"
                      checked={selectedSubId === qt.teacher_id}
                      onChange={() => setSelectedSubId(qt.teacher_id)}
                    />
                    <span className="text-sm font-medium">{qt.first_name} {qt.last_name}</span>
                    <Badge variant="secondary" className="text-xs">{qt.proficiency}</Badge>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleAssign} disabled={!selectedSubId || assigning}>
                {assigning ? 'Assigning…' : 'Confirm Substitution'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
