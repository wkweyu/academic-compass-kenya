import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { timetableService } from '@/services/timetableService';
import type { SchoolPeriod } from '@/types/timetable';

function SortablePeriodRow({ period, onEdit, onDelete }: { period: SchoolPeriod; onEdit: (p: SchoolPeriod) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: period.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded border bg-card px-3 py-2">
      <span {...listeners} {...attributes} className="cursor-grab text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </span>
      <div className="flex-1 text-sm">
        <span className="font-medium">{period.name}</span>
        {period.is_break && <span className="ml-2 text-xs text-muted-foreground">(break)</span>}
        <span className="ml-3 text-xs text-muted-foreground">{period.start_time}–{period.end_time}</span>
        {period.days_of_week.length < 5 && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({period.days_of_week.map((d) => ['M','T','W','Th','F'][d - 1]).join(',')})
          </span>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(period)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(period.id)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

const DAY_LABELS: { key: number; label: string }[] = [
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
];

interface PeriodFormData {
  name: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  days_of_week: number[];
}

const EMPTY_FORM: PeriodFormData = {
  name: '',
  start_time: '08:00',
  end_time: '08:45',
  is_break: false,
  days_of_week: [1, 2, 3, 4, 5],
};

export const PeriodSetupForm = ({ schoolId }: { schoolId: number }) => {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolPeriod | null>(null);
  const [form, setForm] = useState<PeriodFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { loadPeriods(); }, [schoolId]);

  const loadPeriods = async () => {
    const data = await timetableService.getSchoolPeriods(schoolId);
    setPeriods(data);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (p: SchoolPeriod) => {
    setEditing(p);
    setForm({
      name: p.name,
      start_time: p.start_time,
      end_time: p.end_time,
      is_break: p.is_break,
      days_of_week: p.days_of_week,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await timetableService.upsertSchoolPeriod({
        ...(editing ? { id: editing.id } : {}),
        school_id: schoolId,
        name: form.name,
        start_time: form.start_time,
        end_time: form.end_time,
        is_break: form.is_break,
        order_index: editing ? editing.order_index : periods.length,
        days_of_week: form.days_of_week.length > 0 ? form.days_of_week : [1, 2, 3, 4, 5],
      });
      toast({ title: editing ? 'Period updated' : 'Period created' });
      setDialogOpen(false);
      loadPeriods();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await timetableService.deleteSchoolPeriod(id);
      toast({ title: 'Period deleted' });
      loadPeriods();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = periods.findIndex((p) => p.id === active.id);
    const newIdx = periods.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(periods, oldIdx, newIdx);
    setPeriods(reordered);
    await timetableService.reorderPeriods(schoolId, reordered.map((p) => p.id));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">School Periods</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Period</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={periods.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {periods.map((p) => (
              <SortablePeriodRow key={p.id} period={p} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </SortableContext>
        </DndContext>
        {periods.length === 0 && <p className="text-sm text-muted-foreground">No periods defined yet.</p>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Period' : 'New Period'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Period 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start time</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End time</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="isbreak" checked={form.is_break} onCheckedChange={(v) => setForm((f) => ({ ...f, is_break: v }))} />
              <Label htmlFor="isbreak">Is break (recess / lunch)</Label>
            </div>
            <div className="space-y-1">
              <Label>Runs on days</Label>
              <div className="flex gap-2">
                {DAY_LABELS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        days_of_week: f.days_of_week.includes(key)
                          ? f.days_of_week.filter((d) => d !== key)
                          : [...f.days_of_week, key].sort(),
                      }))
                    }
                    className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                      form.days_of_week.includes(key)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
