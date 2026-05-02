import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  timetableId: string;
  schoolId: number;
  term: 1 | 2 | 3;
  year: number;
}

type ReportType = 'teacher_workload' | 'period_utilization' | 'room_utilization' | 'subject_distribution' | 'unscheduled';

const REPORT_LABELS: Record<ReportType, string> = {
  teacher_workload: 'Teacher Workload',
  period_utilization: 'Free / Occupied Periods',
  room_utilization: 'Special Room Utilization',
  subject_distribution: 'Subject Distribution',
  unscheduled: 'Unscheduled Subjects',
};

interface Row {
  [key: string]: string | number;
}

const downloadCsv = (rows: Row[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const TimetableReports = ({ timetableId, schoolId, term, year }: Props) => {
  const [reportType, setReportType] = useState<ReportType>('teacher_workload');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { generateReport(); }, [reportType, timetableId]);

  const generateReport = async () => {
    setLoading(true);
    setRows([]);
    try {
      const { data: slots } = await supabase
        .from('timetable_slots')
        .select(`
          id, day_of_week, is_locked,
          teacher:teacher_id (id, first_name, last_name),
          subject:subject_id (id, name),
          special_room:special_room_id (id, name),
          period:period_id (id, name)
        `)
        .eq('timetable_id', timetableId)
        .eq('is_active', true);

      if (!slots) { setLoading(false); return; }

      if (reportType === 'teacher_workload') {
        const map: Record<string, { name: string; periods: number }> = {};
        slots.forEach((s: any) => {
          if (!s.teacher) return;
          const key = s.teacher.id;
          if (!map[key]) map[key] = { name: `${s.teacher.first_name} ${s.teacher.last_name}`, periods: 0 };
          map[key].periods++;
        });
        setRows(Object.values(map).sort((a, b) => b.periods - a.periods).map((r) => ({ Teacher: r.name, 'Periods/Week': r.periods })));
      } else if (reportType === 'period_utilization') {
        const periodMap: Record<string, { name: string; occupied: number; free: number }> = {};
        const DAYS = 5;
        slots.forEach((s: any) => {
          if (!s.period) return;
          const key = s.period.id;
          if (!periodMap[key]) periodMap[key] = { name: s.period.name, occupied: 0, free: 0 };
          periodMap[key].occupied++;
        });
        // free = DAYS - occupied (per period across days)
        Object.values(periodMap).forEach((r) => { r.free = DAYS - r.occupied; });
        setRows(Object.values(periodMap).map((r) => ({ Period: r.name, Occupied: r.occupied, Free: r.free })));
      } else if (reportType === 'room_utilization') {
        const roomMap: Record<string, { name: string; count: number }> = {};
        slots.forEach((s: any) => {
          if (!s.special_room) return;
          const key = s.special_room.id;
          if (!roomMap[key]) roomMap[key] = { name: s.special_room.name, count: 0 };
          roomMap[key].count++;
        });
        setRows(Object.values(roomMap).sort((a, b) => b.count - a.count).map((r) => ({ Room: r.name, 'Slots Used': r.count })));
      } else if (reportType === 'subject_distribution') {
        const subMap: Record<string, { name: string; count: number }> = {};
        slots.forEach((s: any) => {
          if (!s.subject) return;
          const key = s.subject.id;
          if (!subMap[key]) subMap[key] = { name: s.subject.name, count: 0 };
          subMap[key].count++;
        });
        setRows(Object.values(subMap).sort((a, b) => b.count - a.count).map((r) => ({ Subject: r.name, 'Periods/Week': r.count })));
      } else if (reportType === 'unscheduled') {
        const { data: classSubjects } = await supabase
          .from('class_subjects')
          .select('subject_id, subject:subject_id(name), periods_per_week')
          .eq('school_id', schoolId);
        const scheduledSubjectIds = new Set(slots.map((s: any) => s.subject?.id).filter(Boolean));
        const unscheduled: Row[] = [];
        (classSubjects ?? []).forEach((cs: any) => {
          if (!scheduledSubjectIds.has(cs.subject_id)) {
            unscheduled.push({ Subject: cs.subject?.name ?? cs.subject_id, 'Periods Required': cs.periods_per_week ?? '?' });
          }
        });
        setRows(unscheduled);
      }
    } finally {
      setLoading(false);
    }
  };

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Reports</CardTitle>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(rows, `${reportType}_${term}_${year}.csv`)} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1" />Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 w-56">
          <Label>Report type</Label>
          <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(REPORT_LABELS) as [ReportType, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Generating…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {headers.map((h) => <TableCell key={h} className="text-sm">{row[h]}</TableCell>)}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={headers.length || 2} className="text-center text-muted-foreground py-8">No data.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
