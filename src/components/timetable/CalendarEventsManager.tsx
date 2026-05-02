import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { timetableService } from '@/services/timetableService';
import type { SchoolCalendarEvent, SchoolPeriod } from '@/types/timetable';

const EVENT_TYPES = ['holiday', 'exam_period', 'school_event', 'closure'] as const;

interface FormData {
  title: string;
  event_type: string;
  start_date: string;
  end_date: string;
  affected_period_ids: string[];
}

const EMPTY: FormData = { title: '', event_type: 'holiday', start_date: '', end_date: '', affected_period_ids: [] };

interface Props {
  schoolId: number;
  term: 1 | 2 | 3;
  year: number;
}

export const CalendarEventsManager = ({ schoolId, term, year }: Props) => {
  const { toast } = useToast();
  const [events, setEvents] = useState<SchoolCalendarEvent[]>([]);
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [schoolId, term, year]);

  const loadData = async () => {
    const [evts, pds] = await Promise.all([
      timetableService.getCalendarEvents(schoolId, year, term),
      timetableService.getSchoolPeriods(schoolId),
    ]);
    setEvents(evts);
    setPeriods(pds.filter((p) => !p.is_break));
  };

  const togglePeriod = (pid: string) => {
    setForm((f) => ({
      ...f,
      affected_period_ids: f.affected_period_ids.includes(pid)
        ? f.affected_period_ids.filter((id) => id !== pid)
        : [...f.affected_period_ids, pid],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await timetableService.upsertCalendarEvent({
        school_id: schoolId,
        title: form.title,
        event_type: form.event_type as any,
        start_date: form.start_date,
        end_date: form.end_date,
        academic_year: year,
        term,
        affects_all_classes: true,
        affected_period_ids: form.affected_period_ids.length > 0 ? form.affected_period_ids : null,
      });
      toast({ title: 'Event saved' });
      setDialogOpen(false);
      setForm(EMPTY);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await timetableService.deleteCalendarEvent(id);
      toast({ title: 'Event deleted' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Calendar Events & Blackouts — Term {term} {year}</CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Event</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
            <div>
              <span className="font-medium">{e.title}</span>
              <Badge variant="secondary" className="ml-2 text-xs">{e.event_type}</Badge>
              <span className="ml-2 text-muted-foreground text-xs">
                {e.start_date} – {e.end_date}
              </span>
              {e.affected_period_ids && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({e.affected_period_ids.length} period(s) blocked)
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {events.length === 0 && <p className="text-sm text-muted-foreground">No events for this term.</p>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Calendar Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Half-term break" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.event_type} onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Affected periods <span className="text-muted-foreground text-xs">(leave blank = entire day)</span></Label>
              <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border rounded p-2">
                {periods.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={form.affected_period_ids.includes(p.id)}
                      onCheckedChange={() => togglePeriod(p.id)}
                    />
                    {p.name} ({p.start_time})
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.start_date}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
