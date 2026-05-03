import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { timetableService } from '@/services/timetableService';
import type { SpecialRoom, TimetableSlot, SchoolPeriod, SchoolDay } from '@/types/timetable';

interface Props {
  schoolId: number;
  term: 1 | 2 | 3;
  year: number;
}

export const SpecialRoomScheduleView = ({ schoolId, term, year }: Props) => {
  const [rooms, setRooms] = useState<SpecialRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [days, setDays] = useState<SchoolDay[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);

  useEffect(() => {
    Promise.all([
      timetableService.getSpecialRooms(schoolId),
      timetableService.getSchoolPeriods(schoolId),
      timetableService.getSchoolDays(schoolId),
    ]).then(([r, p, d]) => {
      setRooms(r);
      setPeriods(p);
      setDays(d);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!selectedRoomId) return;
    timetableService.getSpecialRoomTimetable(selectedRoomId, term, year).then(setSlots);
  }, [selectedRoomId, term, year]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Special Room Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 w-56">
          <Label>Room</Label>
          <Select value={selectedRoomId ?? ''} onValueChange={setSelectedRoomId}>
            <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRoomId && (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-2 py-1">Period</th>
                  {days.map((d) => (
                    <th key={d.day_of_week} className="border px-2 py-1">{d.short_name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.filter((p) => !p.is_break).map((p) => (
                  <tr key={p.id}>
                    <td className="border px-2 py-1 font-medium whitespace-nowrap">
                      {p.name}
                      <div className="text-muted-foreground">{p.start_time}</div>
                    </td>
                    {days.map((d) => {
                      const slot = slots.find((s) => s.period_id === p.id && s.day_of_week === d.day_of_week);
                      return (
                        <td key={d.day_of_week} className="border px-2 py-1">
                          {slot ? (
                            <div>
                              <div className="font-medium">{(slot as any).subject?.name ?? '—'}</div>
                              <div className="text-muted-foreground">{(slot as any).class_name} {(slot as any).stream_name}</div>
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
