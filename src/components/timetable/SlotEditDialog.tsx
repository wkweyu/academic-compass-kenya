import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { timetableService } from '@/services/timetableService';
import type { TimetableSlot } from '@/types/timetable';

interface Props {
  slot: TimetableSlot;
  timetableId: string;
  classSize: number;
  schoolId: number;
  onUpdated: (slot: TimetableSlot) => void;
  onClose: () => void;
}

export const SlotEditDialog = ({ slot, timetableId, classSize, schoolId, onUpdated, onClose }: Props) => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [qualifiedTeachers, setQualifiedTeachers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);

  const [subjectId, setSubjectId] = useState<string>(String(slot.subject_id ?? ''));
  const [teacherId, setTeacherId] = useState<string>(String(slot.teacher_id ?? ''));
  const [roomId, setRoomId] = useState<string>(slot.special_room_id ?? '');
  const [isLocked, setIsLocked] = useState(slot.is_locked);
  const [notes, setNotes] = useState(slot.notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (subjectId) loadQualifiedTeachers(Number(subjectId));
  }, [subjectId]);

  const loadData = async () => {
    const [subjectsRes, roomsRes] = await Promise.all([
      supabase.from('subjects').select('id, name, code').eq('school_id', schoolId).order('name'),
      supabase.from('special_rooms').select('*').eq('school_id', schoolId).eq('is_active', true),
    ]);
    setSubjects(subjectsRes.data || []);
    // Filter rooms by capacity
    setRooms((roomsRes.data || []).filter((r: any) => r.capacity >= classSize));
  };

  const loadQualifiedTeachers = async (sid: number) => {
    const { data } = await supabase
      .from('teacher_specializations')
      .select('teacher_id, proficiency_level, is_primary, teacher:teachers(id, first_name, last_name)')
      .eq('subject_id', sid);
    setQualifiedTeachers((data || []).map((r: any) => ({
      id: r.teacher_id,
      name: `${r.teacher.first_name} ${r.teacher.last_name}`,
      proficiency_level: r.proficiency_level,
      is_primary: r.is_primary,
    })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await timetableService.updateSlot(
        slot.id,
        {
          subject_id: subjectId ? Number(subjectId) : null,
          teacher_id: teacherId ? Number(teacherId) : null,
          special_room_id: roomId || null,
          is_locked: isLocked,
          notes: notes || null,
        },
        slot.updated_at
      );
      onUpdated(updated);
    } catch (err: any) {
      toast({ title: 'Failed to update slot', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Slot — {slot.period?.name} {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][slot.day_of_week]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Teacher {subjectId ? '(qualified for subject)' : ''}</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {(subjectId ? qualifiedTeachers : teachers).map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name ?? `${t.first_name} ${t.last_name}`}
                    {t.is_primary ? ' ★' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Special Room (capacity ≥ {classSize})</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="No special room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {rooms.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.name} ({r.room_type}, cap {r.capacity})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex items-center gap-3">
            <Switch id="lock" checked={isLocked} onCheckedChange={setIsLocked} />
            <Label htmlFor="lock">Lock slot (prevent auto-overwrite)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
