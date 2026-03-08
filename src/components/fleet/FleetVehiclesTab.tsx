import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import {
  getFleetVehicles, createFleetVehicle, updateFleetVehicle, deleteFleetVehicle,
  FleetVehicle,
} from '@/services/fleetService';
import { getFleetDrivers } from '@/services/fleetService';
import { getTransportRoutes } from '@/services/transportService';

const emptyForm = {
  registration_number: '', make: '', model: '', capacity: '', year_of_manufacture: '',
  engine_number: '', chassis_number: '', insurance_expiry: '', inspection_expiry: '',
  assigned_route_id: '', assigned_driver_id: '', status: 'active', fuel_type: 'diesel', current_mileage: '0',
};

export default function FleetVehiclesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: vehicles = [], isLoading } = useQuery({ queryKey: ['fleet-vehicles'], queryFn: getFleetVehicles });
  const { data: drivers = [] } = useQuery({ queryKey: ['fleet-drivers'], queryFn: getFleetDrivers });
  const { data: routes = [] } = useQuery({ queryKey: ['transport-routes'], queryFn: getTransportRoutes });

  const createMut = useMutation({
    mutationFn: createFleetVehicle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }); toast.success('Vehicle added'); close(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FleetVehicle> }) => updateFleetVehicle(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }); toast.success('Vehicle updated'); close(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteFleetVehicle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }); toast.success('Vehicle deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const close = () => { setShowForm(false); setEditing(null); };
  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (v: FleetVehicle) => {
    setEditing(v);
    setForm({
      registration_number: v.registration_number, make: v.make, model: v.model,
      capacity: String(v.capacity), year_of_manufacture: v.year_of_manufacture ? String(v.year_of_manufacture) : '',
      engine_number: v.engine_number, chassis_number: v.chassis_number,
      insurance_expiry: v.insurance_expiry || '', inspection_expiry: v.inspection_expiry || '',
      assigned_route_id: v.assigned_route_id ? String(v.assigned_route_id) : '',
      assigned_driver_id: v.assigned_driver_id ? String(v.assigned_driver_id) : '',
      status: v.status, fuel_type: v.fuel_type, current_mileage: String(v.current_mileage),
    });
    setShowForm(true);
  };

  const save = () => {
    if (!form.registration_number) { toast.error('Registration number is required'); return; }
    const payload: any = {
      registration_number: form.registration_number,
      make: form.make, model: form.model,
      capacity: parseInt(form.capacity) || 0,
      year_of_manufacture: form.year_of_manufacture ? parseInt(form.year_of_manufacture) : null,
      engine_number: form.engine_number, chassis_number: form.chassis_number,
      insurance_expiry: form.insurance_expiry || null, inspection_expiry: form.inspection_expiry || null,
      assigned_route_id: form.assigned_route_id ? parseInt(form.assigned_route_id) : null,
      assigned_driver_id: form.assigned_driver_id ? parseInt(form.assigned_driver_id) : null,
      status: form.status, fuel_type: form.fuel_type,
      current_mileage: parseInt(form.current_mileage) || 0,
    };
    editing ? updateMut.mutate({ id: editing.id, data: payload }) : createMut.mutate(payload);
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };
  const isExpired = (date: string | null) => date ? new Date(date) < new Date() : false;

  const statusColor = (s: string) => s === 'active' ? 'default' : s === 'maintenance' ? 'secondary' : 'destructive';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fleet Vehicles</CardTitle>
        <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Add Vehicle</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : vehicles.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No vehicles registered. Add your first vehicle.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Make / Model</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Fuel</TableHead>
                  <TableHead>Mileage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>Inspection</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.registration_number}</TableCell>
                    <TableCell>{v.make} {v.model}</TableCell>
                    <TableCell>{v.capacity}</TableCell>
                    <TableCell className="capitalize">{v.fuel_type}</TableCell>
                    <TableCell>{v.current_mileage.toLocaleString()} km</TableCell>
                    <TableCell><Badge variant={statusColor(v.status)} className="capitalize">{v.status}</Badge></TableCell>
                    <TableCell>{v.route_name || '—'}</TableCell>
                    <TableCell>{v.driver_name || '—'}</TableCell>
                    <TableCell>
                      {v.insurance_expiry ? (
                        <span className={`flex items-center gap-1 ${isExpired(v.insurance_expiry) ? 'text-destructive' : isExpiringSoon(v.insurance_expiry) ? 'text-yellow-600' : ''}`}>
                          {isExpired(v.insurance_expiry) && <AlertTriangle className="h-3 w-3" />}
                          {v.insurance_expiry}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {v.inspection_expiry ? (
                        <span className={`flex items-center gap-1 ${isExpired(v.inspection_expiry) ? 'text-destructive' : isExpiringSoon(v.inspection_expiry) ? 'text-yellow-600' : ''}`}>
                          {isExpired(v.inspection_expiry) && <AlertTriangle className="h-3 w-3" />}
                          {v.inspection_expiry}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Delete vehicle?')) deleteMut.mutate(v.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Registration Number *</Label><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value.toUpperCase() })} placeholder="KAA 123A" /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="decommissioned">Decommissioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Isuzu" /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="NQR" /></div>
            <div><Label>Capacity (seats)</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
            <div><Label>Year of Manufacture</Label><Input type="number" value={form.year_of_manufacture} onChange={(e) => setForm({ ...form, year_of_manufacture: e.target.value })} /></div>
            <div><Label>Fuel Type</Label>
              <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="petrol">Petrol</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Current Mileage (km)</Label><Input type="number" value={form.current_mileage} onChange={(e) => setForm({ ...form, current_mileage: e.target.value })} /></div>
            <div><Label>Engine Number</Label><Input value={form.engine_number} onChange={(e) => setForm({ ...form, engine_number: e.target.value })} /></div>
            <div><Label>Chassis Number</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} /></div>
            <div><Label>Insurance Expiry</Label><Input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} /></div>
            <div><Label>Inspection Expiry</Label><Input type="date" value={form.inspection_expiry} onChange={(e) => setForm({ ...form, inspection_expiry: e.target.value })} /></div>
            <div><Label>Assigned Route</Label>
              <Select value={form.assigned_route_id} onValueChange={(v) => setForm({ ...form, assigned_route_id: v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {routes.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Assigned Driver</Label>
              <Select value={form.assigned_driver_id} onValueChange={(v) => setForm({ ...form, assigned_driver_id: v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {drivers.filter(d => d.is_active).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
