import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { timetableService } from '@/services/timetableService';
import type { TimetableSubstitution } from '@/types/timetable';

const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
type Status = typeof STATUS_OPTIONS[number];

const STATUS_COLORS: Record<Status, string> = {
  pending: 'secondary',
  confirmed: 'default',
  completed: 'outline',
  cancelled: 'destructive',
} as any;

interface Props {
  schoolId: number;
}

export const SubstitutionList = ({ schoolId }: Props) => {
  const { toast } = useToast();
  const [subs, setSubs] = useState<TimetableSubstitution[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSubs(); }, [schoolId, dateFilter, statusFilter]);

  const loadSubs = async () => {
    setLoading(true);
    try {
      const data = await timetableService.getSubstitutions(
        schoolId,
        dateFilter || undefined,
        statusFilter !== 'all' ? statusFilter : undefined
      );
      setSubs(data);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    try {
      await timetableService.updateSubstitutionStatus(id, status);
      toast({ title: 'Status updated' });
      loadSubs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Substitution Records</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1 w-36">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Substitute</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">{s.substitution_date}</TableCell>
                  <TableCell className="text-sm">{(s as any).slot?.subject?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{(s as any).original_teacher ? `${(s as any).original_teacher.first_name} ${(s as any).original_teacher.last_name}` : '—'}</TableCell>
                  <TableCell className="text-sm">{(s as any).substitute_teacher ? `${(s as any).substitute_teacher.first_name} ${(s as any).substitute_teacher.last_name}` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[s.status as Status] ?? 'secondary'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={s.status} onValueChange={(v: any) => updateStatus(s.id, v)}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {subs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No substitutions found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
