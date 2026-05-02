import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { timetableService } from '@/services/timetableService';
import type { TimetableSlot, SchoolPeriod } from '@/types/timetable';
import { supabase } from '@/integrations/supabase/client';

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
}

interface Props {
  schoolId: number;
  term: 1 | 2 | 3;
  year: number;
}

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const TeacherScheduleView = ({ schoolId, term, year }: Props) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [date, setDate] = useState<string>('');
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);

  useEffect(() => {
    supabase
      .from('teachers')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .then(({ data }) => setTeachers((data as Teacher[]) ?? []));
    timetableService.getSchoolPeriods(schoolId).then(setPeriods);
  }, [schoolId]);

  useEffect(() => {
    if (!selectedTeacherId) return;
    timetableService
      .getTeacherTimetable(selectedTeacherId, term, year, date || undefined)
      .then((s) => setSlots(s));
  }, [selectedTeacherId, date, term, year]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Teacher Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1 w-56">
            <Label>Teacher</Label>
            <Select value={selectedTeacherId?.toString() ?? ''} onValueChange={(v) => setSelectedTeacherId(Number(v))}>
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
            <Label>Date (optional — for substitutions)</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
        </div>

        {selectedTeacherId && (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-2 py-1">Period</th>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <th key={d} className="border px-2 py-1">{DAY_LABELS[d]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.filter((p) => !p.is_break).map((p) => (
                  <tr key={p.id}>
                    <td className="border px-2 py-1 font-medium whitespace-nowrap">{p.name}<div className="text-muted-foreground">{p.start_time}</div></td>
                    {[1, 2, 3, 4, 5].map((d) => {
                      const slot = slots.find((s) => s.period_id === p.id && s.day_of_week === d);
                      return (
                        <td key={d} className={`border px-2 py-1 ${slot?.isSubstituted ? 'bg-yellow-50' : ''}`}>
                          {slot ? (
                            <div>
                              <div className="font-medium">{(slot as any).subject?.name}</div>
                              <div className="text-muted-foreground">{(slot as any).class_name} {(slot as any).stream_name}</div>
                              {slot.isSubstituted && <Badge variant="outline" className="text-yellow-700 border-yellow-400 text-xs mt-0.5">SUB</Badge>}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
