import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { getFleetDrivers, createFleetDriver, updateFleetDriver, deleteFleetDriver, FleetDriver } from '@/services/fleetService';

const emptyForm = { full_name: '', phone: '', license_number: '', license_expiry: '', id_number: '', is_active: true };

export default function FleetDriversTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FleetDriver | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: drivers = [], isLoading } = useQuery({ queryKey: ['fleet-drivers'], queryFn: getFleetDrivers });

  const createMut = useMutation({
    mutationFn: createFleetDriver,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-drivers'] }); toast.success('Driver added'); close(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FleetDriver> }) => updateFleetDriver(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-drivers'] }); toast.success('Driver updated'); close(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteFleetDriver,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-drivers'] }); toast.success('Driver deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const close = () => { setShowForm(false); setEditing(null); };
  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (d: FleetDriver) => {
    setEditing(d);
    setForm({
      full_name: d.full_name, phone: d.phone, license_number: d.license_number,
      license_expiry: d.license_expiry || '', id_number: d.id_number, is_active: d.is_active,
    });
    setShowForm(true);
  };

  const save = () => {
    if (!form.full_name) { toast.error('Driver name is required'); return; }
    const payload: any = { ...form, license_expiry: form.license_expiry || null };
    editing ? updateMut.mutate({ id: editing.id, data: payload }) : createMut.mutate(payload);
  };

  const isExpired = (d: string | null) => d ? new Date(d) < new Date() : false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fleet Drivers</CardTitle>
        <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Add Driver</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : drivers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No drivers registered.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>ID Number</TableHead>
                <TableHead>License No</TableHead>
                <TableHead>License Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.full_name}</TableCell>
                  <TableCell>{d.phone || '—'}</TableCell>
                  <TableCell>{d.id_number || '—'}</TableCell>
                  <TableCell>{d.license_number || '—'}</TableCell>
                  <TableCell>
                    {d.license_expiry ? (
                      <span className={`flex items-center gap-1 ${isExpired(d.license_expiry) ? 'text-destructive' : ''}`}>
                        {isExpired(d.license_expiry) && <AlertTriangle className="h-3 w-3" />}
                        {d.license_expiry}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? 'default' : 'secondary'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Delete driver?')) deleteMut.mutate(d.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Driver' : 'Add Driver'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>ID Number</Label><Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>License Number</Label><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
              <div><Label>License Expiry</Label><Input type="date" value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
