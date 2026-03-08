import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, AlertTriangle, Wrench, Clock, Printer, DollarSign } from 'lucide-react';
import {
  getFleetVehicles, getMaintenanceRecords, createMaintenanceRecord, updateMaintenanceRecord,
  deleteMaintenanceRecord, getUpcomingServiceAlerts, getMaintenanceCostReport,
  MaintenanceRecord, FleetVehicle, SERVICE_TYPES,
} from '@/services/fleetService';

export default function FleetMaintenanceTab() {
  const [subTab, setSubTab] = useState('history');

  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <TabsList>
        <TabsTrigger value="history" className="gap-1"><Wrench className="h-4 w-4" /> Service History</TabsTrigger>
        <TabsTrigger value="alerts" className="gap-1"><AlertTriangle className="h-4 w-4" /> Upcoming Alerts</TabsTrigger>
        <TabsTrigger value="costs" className="gap-1"><DollarSign className="h-4 w-4" /> Cost Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="history"><ServiceHistoryView /></TabsContent>
      <TabsContent value="alerts"><ServiceAlertsView /></TabsContent>
      <TabsContent value="costs"><MaintenanceCostView /></TabsContent>
    </Tabs>
  );
}

const emptyForm = {
  vehicle_id: '', service_type: 'general', description: '', service_date: new Date().toISOString().split('T')[0],
  mileage_at_service: '', cost: '', vendor: '', invoice_number: '',
  next_service_date: '', next_service_mileage: '', parts_replaced: '', status: 'completed',
};

// ─── Service History ───

function ServiceHistoryView() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ vehicleId: '', dateFrom: '', dateTo: '' });

  const { data: vehicles = [] } = useQuery({ queryKey: ['fleet-vehicles'], queryFn: getFleetVehicles });
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['fleet-maintenance', filters],
    queryFn: () => getMaintenanceRecords({
      vehicleId: filters.vehicleId ? parseInt(filters.vehicleId) : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
  });

  const createMut = useMutation({
    mutationFn: createMaintenanceRecord,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-maintenance'] }); qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }); toast.success('Record added'); close(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MaintenanceRecord> }) => updateMaintenanceRecord(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-maintenance'] }); toast.success('Record updated'); close(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteMaintenanceRecord,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-maintenance'] }); toast.success('Record deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const close = () => { setShowForm(false); setEditing(null); };
  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (r: MaintenanceRecord) => {
    setEditing(r);
    setForm({
      vehicle_id: String(r.vehicle_id), service_type: r.service_type, description: r.description,
      service_date: r.service_date, mileage_at_service: String(r.mileage_at_service),
      cost: String(r.cost), vendor: r.vendor, invoice_number: r.invoice_number,
      next_service_date: r.next_service_date || '', next_service_mileage: r.next_service_mileage ? String(r.next_service_mileage) : '',
      parts_replaced: r.parts_replaced || '', status: r.status,
    });
    setShowForm(true);
  };

  const onVehicleSelect = (v: string) => {
    setForm(prev => {
      const vehicle = vehicles.find(vh => String(vh.id) === v);
      return { ...prev, vehicle_id: v, mileage_at_service: vehicle ? String(vehicle.current_mileage) : prev.mileage_at_service };
    });
  };

  const save = () => {
    if (!form.vehicle_id || !form.description) { toast.error('Vehicle and description are required'); return; }
    const payload: any = {
      vehicle_id: parseInt(form.vehicle_id), service_type: form.service_type, description: form.description,
      service_date: form.service_date, mileage_at_service: parseInt(form.mileage_at_service) || 0,
      cost: parseFloat(form.cost) || 0, vendor: form.vendor, invoice_number: form.invoice_number,
      next_service_date: form.next_service_date || null,
      next_service_mileage: form.next_service_mileage ? parseInt(form.next_service_mileage) : null,
      parts_replaced: form.parts_replaced || null, status: form.status,
    };
    editing ? updateMut.mutate({ id: editing.id, data: payload }) : createMut.mutate(payload);
  };

  const typeLabel = (v: string) => SERVICE_TYPES.find(t => t.value === v)?.label || v;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Service History</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filters.vehicleId} onValueChange={(v) => setFilters({ ...filters, vehicleId: v })}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Vehicles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Vehicles</SelectItem>
              {vehicles.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.registration_number}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="w-[140px]" />
          <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="w-[140px]" />
          <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Add Record</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : records.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No maintenance records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Cost (KES)</TableHead>
                  <TableHead>Mileage</TableHead>
                  <TableHead>Next Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.service_date}</TableCell>
                    <TableCell className="font-medium">{r.vehicle_reg}</TableCell>
                    <TableCell><Badge variant="outline">{typeLabel(r.service_type)}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
                    <TableCell>{r.vendor || '—'}</TableCell>
                    <TableCell className="text-right">{Number(r.cost).toLocaleString()}</TableCell>
                    <TableCell>{r.mileage_at_service.toLocaleString()} km</TableCell>
                    <TableCell className="text-sm">
                      {r.next_service_date && <div>{r.next_service_date}</div>}
                      {r.next_service_mileage && <div>{r.next_service_mileage.toLocaleString()} km</div>}
                      {!r.next_service_date && !r.next_service_mileage && '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'completed' ? 'default' : r.status === 'in_progress' ? 'secondary' : 'outline'} className="capitalize">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Delete?')) deleteMut.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Maintenance Record' : 'Add Maintenance Record'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vehicle *</Label>
              <Select value={form.vehicle_id} onValueChange={onVehicleSelect}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.registration_number} — {v.make} {v.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the work done..." />
            </div>
            <div><Label>Service Date</Label><Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></div>
            <div><Label>Mileage at Service</Label><Input type="number" value={form.mileage_at_service} onChange={(e) => setForm({ ...form, mileage_at_service: e.target.value })} /></div>
            <div><Label>Cost (KES)</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
            <div><Label>Vendor / Garage</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
            <div><Label>Invoice Number</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Parts Replaced</Label><Input value={form.parts_replaced} onChange={(e) => setForm({ ...form, parts_replaced: e.target.value })} placeholder="e.g., Oil filter, brake pads" /></div>
            <div className="col-span-2 border-t pt-3">
              <p className="text-sm font-medium text-muted-foreground mb-2">Next Service Reminder (optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Next Service Date</Label><Input type="date" value={form.next_service_date} onChange={(e) => setForm({ ...form, next_service_date: e.target.value })} /></div>
                <div><Label>Next Service Mileage (km)</Label><Input type="number" value={form.next_service_mileage} onChange={(e) => setForm({ ...form, next_service_mileage: e.target.value })} /></div>
              </div>
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

// ─── Service Alerts ───

function ServiceAlertsView() {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['fleet-maintenance-alerts'],
    queryFn: getUpcomingServiceAlerts,
  });

  const now = new Date();
  const isOverdue = (date: string | null) => date ? new Date(date) < now : false;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Upcoming Service Alerts</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : alerts.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No upcoming service alerts. All vehicles are up to date!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a: any) => (
              <div key={a.id} className={`rounded-lg border p-4 ${isOverdue(a.next_service_date) ? 'border-destructive bg-destructive/5' : 'border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-900/10'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.vehicle_reg}</span>
                      <span className="text-muted-foreground text-sm">{a.vehicle_make_model}</span>
                      <Badge variant={isOverdue(a.next_service_date) ? 'destructive' : 'secondary'}>
                        {isOverdue(a.next_service_date) ? 'OVERDUE' : 'Due Soon'}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last service: {a.service_date} • Type: {SERVICE_TYPES.find(t => t.value === a.service_type)?.label || a.service_type}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {a.next_service_date && (
                      <div className={isOverdue(a.next_service_date) ? 'text-destructive font-semibold' : 'text-yellow-600'}>
                        Due: {a.next_service_date}
                      </div>
                    )}
                    {a.next_service_mileage && (
                      <div className="text-muted-foreground">
                        At: {a.next_service_mileage.toLocaleString()} km
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Cost Report ───

function MaintenanceCostView() {
  const now = new Date();
  const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(firstOfYear);
  const [dateTo, setDateTo] = useState(today);

  const { data: report = [], isLoading } = useQuery({
    queryKey: ['fleet-maintenance-cost', dateFrom, dateTo],
    queryFn: () => getMaintenanceCostReport(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
  });

  const grandTotal = report.reduce((sum, r) => sum + r.total_cost, 0);
  const totalServices = report.reduce((sum, r) => sum + r.service_count, 0);

  const handlePrint = () => {
    const el = document.getElementById('maintenance-cost-report');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Maintenance Cost Report</title>
      <style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}.text-right{text-align:right}h2{margin-bottom:4px}.total-row{background:#e0e0e0;font-weight:bold}.type-breakdown{font-size:11px;color:#666}</style>
    </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Maintenance Cost Report</CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
          <Button variant="outline" onClick={handlePrint} disabled={report.length === 0} className="gap-1"><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div id="maintenance-cost-report">
          <h2 className="text-lg font-semibold mb-1">Maintenance Costs — {dateFrom} to {dateTo}</h2>

          {isLoading ? <p className="text-muted-foreground">Loading...</p> : report.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No maintenance data for this period.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                  <p className="text-xl font-bold">KES {grandTotal.toLocaleString()}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Services</p>
                  <p className="text-xl font-bold">{totalServices}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Vehicles Serviced</p>
                  <p className="text-xl font-bold">{report.length}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead className="text-right">Services</TableHead>
                    <TableHead className="text-right">Total Cost (KES)</TableHead>
                    <TableHead>Cost Breakdown by Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((r: any) => (
                    <TableRow key={r.vehicle_id}>
                      <TableCell className="font-medium">{r.registration_number}</TableCell>
                      <TableCell>{r.make_model}</TableCell>
                      <TableCell className="text-right">{r.service_count}</TableCell>
                      <TableCell className="text-right font-semibold">{r.total_cost.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(r.by_type).map(([type, cost]) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {SERVICE_TYPES.find(t => t.value === type)?.label || type}: {Number(cost).toLocaleString()}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted">
                    <TableCell colSpan={2}>Grand Total</TableCell>
                    <TableCell className="text-right">{totalServices}</TableCell>
                    <TableCell className="text-right">{grandTotal.toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
