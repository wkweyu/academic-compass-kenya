import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { timetableService } from '@/services/timetableService';
import type { SpecialRoom } from '@/types/timetable';

const ROOM_TYPES = ['lab', 'computer', 'hall', 'library', 'other'] as const;

interface FormData {
  name: string;
  capacity: number;
  room_type: string;
  is_shared: boolean;
}
const EMPTY: FormData = { name: '', capacity: 40, room_type: 'lab', is_shared: true };

export const SpecialRoomForm = ({ schoolId }: { schoolId: number }) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<SpecialRoom[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SpecialRoom | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadRooms(); }, [schoolId]);

  const loadRooms = async () => {
    const data = await timetableService.getSpecialRooms(schoolId);
    setRooms(data);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (r: SpecialRoom) => {
    setEditing(r);
    setForm({ name: r.name, capacity: r.capacity, room_type: r.room_type, is_shared: r.is_shared });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await timetableService.upsertSpecialRoom({
        ...(editing ? { id: editing.id } : {}),
        school_id: schoolId,
        name: form.name,
        capacity: form.capacity,
        room_type: form.room_type as any,
        is_shared: form.is_shared,
        is_active: true,
      });
      toast({ title: editing ? 'Room updated' : 'Room created' });
      setDialogOpen(false);
      loadRooms();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await timetableService.deleteSpecialRoom(id);
      toast({ title: 'Room deactivated' });
      loadRooms();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Special Rooms</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Room</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rooms.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded border bg-card px-3 py-2">
            <div className="text-sm">
              <span className="font-medium">{r.name}</span>
              <Badge variant="secondary" className="ml-2 text-xs">{r.room_type}</Badge>
              <span className="ml-2 text-muted-foreground text-xs">cap {r.capacity}</span>
              {r.is_shared && <span className="ml-2 text-xs text-muted-foreground">shared</span>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {rooms.length === 0 && <p className="text-sm text-muted-foreground">No special rooms yet.</p>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Room' : 'New Special Room'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Science Lab 1" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.room_type} onValueChange={(v) => setForm((f) => ({ ...f, room_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Capacity</Label>
              <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="shared" checked={form.is_shared} onCheckedChange={(v) => setForm((f) => ({ ...f, is_shared: v }))} />
              <Label htmlFor="shared">Shared (multiple classes can book)</Label>
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
