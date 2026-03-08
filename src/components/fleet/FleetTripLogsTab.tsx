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
import { Plus, Pencil, Trash2, Printer, MapPin, Clock, Users } from 'lucide-react';
import {
  getFleetVehicles, getFleetDrivers, getTripLogs, createTripLog, updateTripLog, deleteTripLog,
  getTripSummaryReport, TripLog, TRIP_TYPES,
} from '@/services/fleetService';
import { getTransportRoutes } from '@/services/transportService';

export default function FleetTripLogsTab() {
  const [subTab, setSubTab] = useState('log');

  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <TabsList>
        <TabsTrigger value="log" className="gap-1"><MapPin className="h-4 w-4" /> Trip Log</TabsTrigger>
        <TabsTrigger value="daily" className="gap-1"><Clock className="h-4 w-4" /> Daily View</TabsTrigger>
        <TabsTrigger value="report" className="gap-1"><Users className="h-4 w-4" /> Trip Report</TabsTrigger>
      </TabsList>
      <TabsContent value="log"><TripLogView /></TabsContent>
      <TabsContent value="daily"><DailyTripView /></TabsContent>
      <TabsContent value="report"><TripReportView /></TabsContent>
    </Tabs>
  );
}

const emptyForm = {
  vehicle_id: '', driver_id: '', route_id: '', trip_date: new Date().toISOString().split('T')[0],
  trip_type: 'morning', departure_time: '', arrival_time: '',
  departure_location: '', arrival_location: '', mileage_start: '', mileage_end: '',
  passenger_count: '', notes: '', status: 'completed',
};

// ─── Trip Log (CRUD) ───

function TripLogView() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TripLog | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ vehicleId: '__all__', dateFrom: '', dateTo: '', tripType: 'all' });

  const { data: vehicles = [] } = useQuery({ queryKey: ['fleet-vehicles'], queryFn: getFleetVehicles });
  const { data: drivers = [] } = useQuery({ queryKey: ['fleet-drivers'], queryFn: getFleetDrivers });
  const { data: routes = [] } = useQuery({ queryKey: ['transport-routes'], queryFn: getTransportRoutes });
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['fleet-trips', filters],
    queryFn: () => getTripLogs({
      vehicleId: filters.vehicleId ? parseInt(filters.vehicleId) : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      tripType: filters.tripType !== 'all' ? filters.tripType : undefined,
    }),
  });

  const createMut = useMutation({
    mutationFn: createTripLog,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-trips'] }); qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }); toast.success('Trip logged'); close(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TripLog> }) => updateTripLog(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-trips'] }); toast.success('Trip updated'); close(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteTripLog,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-trips'] }); toast.success('Trip deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const close = () => { setShowForm(false); setEditing(null); };
  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (t: TripLog) => {
    setEditing(t);
    setForm({
      vehicle_id: String(t.vehicle_id), driver_id: t.driver_id ? String(t.driver_id) : '',
      route_id: t.route_id ? String(t.route_id) : '', trip_date: t.trip_date, trip_type: t.trip_type,
      departure_time: t.departure_time || '', arrival_time: t.arrival_time || '',
      departure_location: t.departure_location, arrival_location: t.arrival_location,
      mileage_start: String(t.mileage_start), mileage_end: t.mileage_end ? String(t.mileage_end) : '',
      passenger_count: String(t.passenger_count), notes: t.notes || '', status: t.status,
    });
    setShowForm(true);
  };

  const onVehicleSelect = (v: string) => {
    const vehicle = vehicles.find(vh => String(vh.id) === v);
    setForm(prev => ({
      ...prev, vehicle_id: v,
      mileage_start: vehicle ? String(vehicle.current_mileage) : prev.mileage_start,
      driver_id: vehicle?.assigned_driver_id ? String(vehicle.assigned_driver_id) : prev.driver_id,
      route_id: vehicle?.assigned_route_id ? String(vehicle.assigned_route_id) : prev.route_id,
    }));
  };

  const save = () => {
    if (!form.vehicle_id) { toast.error('Vehicle is required'); return; }
    const payload: any = {
      vehicle_id: parseInt(form.vehicle_id),
      driver_id: form.driver_id ? parseInt(form.driver_id) : null,
      route_id: form.route_id ? parseInt(form.route_id) : null,
      trip_date: form.trip_date, trip_type: form.trip_type,
      departure_time: form.departure_time || null, arrival_time: form.arrival_time || null,
      departure_location: form.departure_location, arrival_location: form.arrival_location,
      mileage_start: parseInt(form.mileage_start) || 0,
      mileage_end: form.mileage_end ? parseInt(form.mileage_end) : null,
      passenger_count: parseInt(form.passenger_count) || 0,
      notes: form.notes || null, status: form.status,
    };
    editing ? updateMut.mutate({ id: editing.id, data: payload }) : createMut.mutate(payload);
  };

  const typeLabel = (v: string) => TRIP_TYPES.find(t => t.value === v)?.label || v;
  const kmDriven = (t: TripLog) => t.mileage_end && t.mileage_start ? Math.max(0, t.mileage_end - t.mileage_start) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Trip Log</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.vehicleId} onValueChange={(v) => setFilters({ ...filters, vehicleId: v })}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Vehicles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Vehicles</SelectItem>
              {vehicles.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.registration_number}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.tripType} onValueChange={(v) => setFilters({ ...filters, tripType: v })}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TRIP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="w-[140px]" />
          <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="w-[140px]" />
          <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Log Trip</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : trips.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No trip logs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead className="text-right">Passengers</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.trip_date}</TableCell>
                    <TableCell className="font-medium">{t.vehicle_reg}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{typeLabel(t.trip_type)}</Badge></TableCell>
                    <TableCell>{t.route_name || '—'}</TableCell>
                    <TableCell>{t.driver_name || '—'}</TableCell>
                    <TableCell>
                      {t.departure_time && <span className="text-sm">{t.departure_time.slice(0, 5)}</span>}
                      {t.departure_location && <span className="text-xs text-muted-foreground ml-1">({t.departure_location})</span>}
                      {!t.departure_time && !t.departure_location && '—'}
                    </TableCell>
                    <TableCell>
                      {t.arrival_time && <span className="text-sm">{t.arrival_time.slice(0, 5)}</span>}
                      {t.arrival_location && <span className="text-xs text-muted-foreground ml-1">({t.arrival_location})</span>}
                      {!t.arrival_time && !t.arrival_location && '—'}
                    </TableCell>
                    <TableCell className="text-right">{t.passenger_count}</TableCell>
                    <TableCell className="text-right">{kmDriven(t) !== null ? kmDriven(t)!.toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Delete?')) deleteMut.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Trip' : 'Log New Trip'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vehicle *</Label>
              <Select value={form.vehicle_id} onValueChange={onVehicleSelect}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  {vehicles.filter(v => v.status === 'active').map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.registration_number} — {v.make} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trip Type</Label>
              <Select value={form.trip_type} onValueChange={(v) => setForm({ ...form, trip_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Driver</Label>
              <Select value={form.driver_id} onValueChange={(v) => setForm({ ...form, driver_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {drivers.filter(d => d.is_active).map(d => <SelectItem key={d.id} value={String(d.id)}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Route</Label>
              <Select value={form.route_id} onValueChange={(v) => setForm({ ...form, route_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {routes.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Trip Date</Label><Input type="date" value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} /></div>
            <div><Label>Passenger Count</Label><Input type="number" value={form.passenger_count} onChange={(e) => setForm({ ...form, passenger_count: e.target.value })} /></div>
            <div><Label>Departure Time</Label><Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} /></div>
            <div><Label>Arrival Time</Label><Input type="time" value={form.arrival_time} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} /></div>
            <div><Label>Departure Location</Label><Input value={form.departure_location} onChange={(e) => setForm({ ...form, departure_location: e.target.value })} placeholder="e.g., School Gate" /></div>
            <div><Label>Arrival Location</Label><Input value={form.arrival_location} onChange={(e) => setForm({ ...form, arrival_location: e.target.value })} placeholder="e.g., Town Centre" /></div>
            <div><Label>Odometer Start (km)</Label><Input type="number" value={form.mileage_start} onChange={(e) => setForm({ ...form, mileage_start: e.target.value })} /></div>
            <div><Label>Odometer End (km)</Label><Input type="number" value={form.mileage_end} onChange={(e) => setForm({ ...form, mileage_end: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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

// ─── Daily View ───

function DailyTripView() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['fleet-trips-daily', date],
    queryFn: () => getTripLogs({ dateFrom: date, dateTo: date }),
  });

  const totalPassengers = trips.reduce((sum, t) => sum + t.passenger_count, 0);
  const totalKm = trips.reduce((sum, t) => {
    const km = t.mileage_end && t.mileage_start ? Math.max(0, t.mileage_end - t.mileage_start) : 0;
    return sum + km;
  }, 0);

  // Group by vehicle
  const byVehicle: Record<string, TripLog[]> = {};
  trips.forEach(t => {
    const key = t.vehicle_reg || `Vehicle ${t.vehicle_id}`;
    if (!byVehicle[key]) byVehicle[key] = [];
    byVehicle[key].push(t);
  });

  const typeLabel = (v: string) => TRIP_TYPES.find(t => t.value === v)?.label || v;

  const handlePrint = () => {
    const el = document.getElementById('daily-trip-report');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Daily Trip Report — ${date}</title>
      <style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #ccc;padding:5px 8px;font-size:12px;text-align:left}.text-right{text-align:right}h2{margin-bottom:4px}.vehicle-header{background:#f0f0f0;font-weight:bold}</style>
    </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daily Trip View</CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" />
          <Button variant="outline" onClick={handlePrint} disabled={trips.length === 0} className="gap-1"><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div id="daily-trip-report">
          <h2 className="text-lg font-semibold mb-1">Trip Log — {date}</h2>

          {isLoading ? <p className="text-muted-foreground">Loading...</p> : trips.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No trips logged for this date.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Trips</p>
                  <p className="text-xl font-bold">{trips.length}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Passengers</p>
                  <p className="text-xl font-bold">{totalPassengers}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total KM</p>
                  <p className="text-xl font-bold">{totalKm.toLocaleString()}</p>
                </div>
              </div>

              {Object.entries(byVehicle).map(([vehicleReg, vehicleTrips]) => (
                <div key={vehicleReg} className="mb-4">
                  <h3 className="text-sm font-semibold mb-1 text-muted-foreground">{vehicleReg} — {vehicleTrips.length} trip(s)</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Departure</TableHead>
                        <TableHead>Arrival</TableHead>
                        <TableHead className="text-right">Passengers</TableHead>
                        <TableHead className="text-right">KM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicleTrips.map(t => {
                        const km = t.mileage_end && t.mileage_start ? Math.max(0, t.mileage_end - t.mileage_start) : null;
                        return (
                          <TableRow key={t.id}>
                            <TableCell><Badge variant="outline" className="text-xs">{typeLabel(t.trip_type)}</Badge></TableCell>
                            <TableCell>{t.route_name || '—'}</TableCell>
                            <TableCell>{t.driver_name || '—'}</TableCell>
                            <TableCell>{t.departure_time ? t.departure_time.slice(0, 5) : '—'} {t.departure_location && `(${t.departure_location})`}</TableCell>
                            <TableCell>{t.arrival_time ? t.arrival_time.slice(0, 5) : '—'} {t.arrival_location && `(${t.arrival_location})`}</TableCell>
                            <TableCell className="text-right">{t.passenger_count}</TableCell>
                            <TableCell className="text-right">{km !== null ? km.toLocaleString() : '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Trip Report ───

function TripReportView() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  const { data: report = [], isLoading } = useQuery({
    queryKey: ['fleet-trip-report', dateFrom, dateTo],
    queryFn: () => getTripSummaryReport(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
  });

  const totals = report.reduce((acc, r) => ({
    trips: acc.trips + r.trip_count,
    passengers: acc.passengers + r.total_passengers,
    km: acc.km + r.total_km,
  }), { trips: 0, passengers: 0, km: 0 });

  const handlePrint = () => {
    const el = document.getElementById('trip-summary-report');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Trip Summary Report</title>
      <style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}.text-right{text-align:right}h2{margin-bottom:4px}</style>
    </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Trip Summary Report</CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
          <Button variant="outline" onClick={handlePrint} disabled={report.length === 0} className="gap-1"><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div id="trip-summary-report">
          <h2 className="text-lg font-semibold mb-1">Trip Summary — {dateFrom} to {dateTo}</h2>

          {isLoading ? <p className="text-muted-foreground">Loading...</p> : report.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No trip data for this period.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Trips</p>
                  <p className="text-xl font-bold">{totals.trips}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Passengers</p>
                  <p className="text-xl font-bold">{totals.passengers.toLocaleString()}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total KM</p>
                  <p className="text-xl font-bold">{totals.km.toLocaleString()}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead className="text-right">Trips</TableHead>
                    <TableHead className="text-right">Passengers</TableHead>
                    <TableHead className="text-right">KM Covered</TableHead>
                    <TableHead>Trip Breakdown</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((r: any) => (
                    <TableRow key={r.vehicle_id}>
                      <TableCell className="font-medium">{r.registration_number}</TableCell>
                      <TableCell>{r.make_model}</TableCell>
                      <TableCell className="text-right">{r.trip_count}</TableCell>
                      <TableCell className="text-right">{r.total_passengers.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.total_km.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(r.by_type).map(([type, count]) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {TRIP_TYPES.find(t => t.value === type)?.label || type}: {String(count)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted">
                    <TableCell colSpan={2}>Grand Total</TableCell>
                    <TableCell className="text-right">{totals.trips}</TableCell>
                    <TableCell className="text-right">{totals.passengers.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{totals.km.toLocaleString()}</TableCell>
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
