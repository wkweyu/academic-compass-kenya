import { useState } from 'react';
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
import { Plus, Printer, CheckCircle, XCircle, Fuel } from 'lucide-react';
import {
  getFleetVehicles, getFleetDrivers, getVouchers, issueVoucher, convertVoucher, cancelVoucher,
  FuelVoucher, FleetVehicle,
} from '@/services/fleetService';
import { supabase } from '@/integrations/supabase/client';

export default function FuelVouchersTab() {
  const [subTab, setSubTab] = useState('issue');

  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <TabsList>
        <TabsTrigger value="issue">Issue Voucher</TabsTrigger>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="issue"><IssueVoucherView /></TabsContent>
      <TabsContent value="pending"><PendingVouchersView /></TabsContent>
      <TabsContent value="history"><VoucherHistoryView /></TabsContent>
    </Tabs>
  );
}

// ─── Issue Voucher ───

function IssueVoucherView() {
  const qc = useQueryClient();
  const { data: vehicles = [] } = useQuery({ queryKey: ['fleet-vehicles'], queryFn: getFleetVehicles });
  const { data: drivers = [] } = useQuery({ queryKey: ['fleet-drivers'], queryFn: getFleetDrivers });

  const [form, setForm] = useState({
    vehicle_id: '', driver_id: '', mileage_at_issue: '', authorized_amount: '', authorized_litres: '', remarks: '',
  });
  const [lastVoucher, setLastVoucher] = useState<FuelVoucher | null>(null);

  const selectedVehicle = vehicles.find(v => String(v.id) === form.vehicle_id);

  const issueMut = useMutation({
    mutationFn: () => issueVoucher({
      vehicle_id: parseInt(form.vehicle_id),
      driver_id: form.driver_id ? parseInt(form.driver_id) : null,
      mileage_at_issue: parseInt(form.mileage_at_issue) || 0,
      authorized_amount: parseFloat(form.authorized_amount) || 0,
      authorized_litres: form.authorized_litres ? parseFloat(form.authorized_litres) : null,
      remarks: form.remarks,
    }),
    onSuccess: (voucher) => {
      qc.invalidateQueries({ queryKey: ['fleet-vouchers'] });
      toast.success(`Voucher ${voucher.voucher_number} issued`);
      setLastVoucher(voucher);
      setForm({ vehicle_id: '', driver_id: '', mileage_at_issue: '', authorized_amount: '', authorized_litres: '', remarks: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Auto-fill mileage when vehicle selected
  const onVehicleChange = (v: string) => {
    setForm({ ...form, vehicle_id: v, mileage_at_issue: '' });
    const vehicle = vehicles.find(vh => String(vh.id) === v);
    if (vehicle) {
      setForm(prev => ({
        ...prev,
        vehicle_id: v,
        mileage_at_issue: String(vehicle.current_mileage),
        driver_id: vehicle.assigned_driver_id ? String(vehicle.assigned_driver_id) : prev.driver_id,
      }));
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Issue Fuel Voucher</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <div>
            <Label>Vehicle *</Label>
            <Select value={form.vehicle_id} onValueChange={onVehicleChange}>
              <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
              <SelectContent>
                {vehicles.filter(v => v.status === 'active').map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.registration_number} — {v.make} {v.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Driver</Label>
            <Select value={form.driver_id} onValueChange={(v) => setForm({ ...form, driver_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {drivers.filter(d => d.is_active).map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Odometer Reading (km) *</Label>
            <Input type="number" value={form.mileage_at_issue} onChange={(e) => setForm({ ...form, mileage_at_issue: e.target.value })} />
          </div>
          <div>
            <Label>Authorized Amount (KES) *</Label>
            <Input type="number" value={form.authorized_amount} onChange={(e) => setForm({ ...form, authorized_amount: e.target.value })} />
          </div>
          <div>
            <Label>Authorized Litres</Label>
            <Input type="number" value={form.authorized_litres} onChange={(e) => setForm({ ...form, authorized_litres: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="h-10" />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={() => issueMut.mutate()} disabled={!form.vehicle_id || !form.authorized_amount || issueMut.isPending}>
            {issueMut.isPending ? 'Issuing...' : 'Issue Voucher'}
          </Button>
        </div>

        {lastVoucher && (
          <div className="mt-6 rounded-md border p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">Voucher {lastVoucher.voucher_number} issued successfully</p>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => printVoucher(lastVoucher)}>
                <Printer className="h-4 w-4" /> Print Blank Voucher
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Vehicle: {lastVoucher.vehicle_reg} | Authorized: KES {Number(lastVoucher.authorized_amount).toLocaleString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Pending Vouchers ───

function PendingVouchersView() {
  const qc = useQueryClient();
  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['fleet-vouchers', 'issued'],
    queryFn: () => getVouchers({ status: 'issued' }),
  });

  const [convertId, setConvertId] = useState<number | null>(null);
  const [fillForm, setFillForm] = useState({
    station_name: '', litres_filled: '', price_per_litre: '', actual_amount: '',
    mileage_at_fill: '', fill_date: new Date().toISOString().split('T')[0], receipt_number: '',
  });

  const convertMut = useMutation({
    mutationFn: () => convertVoucher(convertId!, {
      station_name: fillForm.station_name,
      litres_filled: parseFloat(fillForm.litres_filled),
      price_per_litre: parseFloat(fillForm.price_per_litre),
      actual_amount: parseFloat(fillForm.actual_amount),
      mileage_at_fill: parseInt(fillForm.mileage_at_fill),
      fill_date: fillForm.fill_date,
      receipt_number: fillForm.receipt_number,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fleet-vouchers'] });
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      toast.success('Voucher converted to consumption record');
      setConvertId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: cancelVoucher,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-vouchers'] }); toast.success('Voucher cancelled'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openConvert = (v: FuelVoucher) => {
    setConvertId(v.id);
    setFillForm({
      station_name: '', litres_filled: '', price_per_litre: '', actual_amount: '',
      mileage_at_fill: String(v.mileage_at_issue),
      fill_date: new Date().toISOString().split('T')[0], receipt_number: '',
    });
  };

  // Auto-calc actual_amount
  const updateLitresOrPrice = (field: string, value: string) => {
    const updated = { ...fillForm, [field]: value };
    const litres = parseFloat(updated.litres_filled);
    const price = parseFloat(updated.price_per_litre);
    if (litres > 0 && price > 0) updated.actual_amount = (litres * price).toFixed(2);
    setFillForm(updated);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Pending Vouchers (Awaiting Station Return)</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : vouchers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No pending vouchers.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead className="text-right">Auth Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.voucher_number}</TableCell>
                  <TableCell>{v.vehicle_reg}</TableCell>
                  <TableCell>{v.driver_name || '—'}</TableCell>
                  <TableCell>{v.issued_date}</TableCell>
                  <TableCell>{v.mileage_at_issue.toLocaleString()} km</TableCell>
                  <TableCell className="text-right">KES {Number(v.authorized_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => printVoucher(v)} className="gap-1"><Printer className="h-3 w-3" /> Print</Button>
                    <Button size="sm" onClick={() => openConvert(v)} className="gap-1"><CheckCircle className="h-3 w-3" /> Convert</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Cancel this voucher?')) cancelMut.mutate(v.id); }}><XCircle className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={convertId !== null} onOpenChange={() => setConvertId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Convert Voucher — Enter Station Details</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Station Name *</Label><Input value={fillForm.station_name} onChange={(e) => setFillForm({ ...fillForm, station_name: e.target.value })} placeholder="e.g., Shell Westlands" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Litres Filled *</Label><Input type="number" value={fillForm.litres_filled} onChange={(e) => updateLitresOrPrice('litres_filled', e.target.value)} /></div>
              <div><Label>Price per Litre *</Label><Input type="number" value={fillForm.price_per_litre} onChange={(e) => updateLitresOrPrice('price_per_litre', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Actual Amount (KES)</Label><Input type="number" value={fillForm.actual_amount} onChange={(e) => setFillForm({ ...fillForm, actual_amount: e.target.value })} /></div>
              <div><Label>Mileage at Fill (km) *</Label><Input type="number" value={fillForm.mileage_at_fill} onChange={(e) => setFillForm({ ...fillForm, mileage_at_fill: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fill Date *</Label><Input type="date" value={fillForm.fill_date} onChange={(e) => setFillForm({ ...fillForm, fill_date: e.target.value })} /></div>
              <div><Label>Receipt Number</Label><Input value={fillForm.receipt_number} onChange={(e) => setFillForm({ ...fillForm, receipt_number: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConvertId(null)}>Cancel</Button>
              <Button onClick={() => convertMut.mutate()} disabled={!fillForm.station_name || !fillForm.litres_filled || !fillForm.price_per_litre || convertMut.isPending}>
                {convertMut.isPending ? 'Converting...' : 'Convert to Record'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── History ───

function VoucherHistoryView() {
  const { data: vehicles = [] } = useQuery({ queryKey: ['fleet-vehicles'], queryFn: getFleetVehicles });
  const [filters, setFilters] = useState({ status: 'all', vehicleId: '', dateFrom: '', dateTo: '' });

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['fleet-vouchers', 'history', filters],
    queryFn: () => getVouchers({
      status: filters.status !== 'all' ? filters.status : undefined,
      vehicleId: filters.vehicleId ? parseInt(filters.vehicleId) : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
  });

  const statusBadge = (s: string) => {
    if (s === 'issued') return <Badge variant="secondary">Issued</Badge>;
    if (s === 'filled') return <Badge variant="default">Filled</Badge>;
    return <Badge variant="destructive">Cancelled</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voucher History</CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="filled">Filled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.vehicleId} onValueChange={(v) => setFilters({ ...filters, vehicleId: v })}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Vehicles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Vehicles</SelectItem>
              {vehicles.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.registration_number}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="w-[150px]" placeholder="From" />
          <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="w-[150px]" placeholder="To" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : vouchers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No vouchers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead className="text-right">Litres</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Fill Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.voucher_number}</TableCell>
                    <TableCell>{v.vehicle_reg}</TableCell>
                    <TableCell>{v.driver_name || '—'}</TableCell>
                    <TableCell>{v.issued_date}</TableCell>
                    <TableCell>{statusBadge(v.status)}</TableCell>
                    <TableCell>{v.station_name || '—'}</TableCell>
                    <TableCell className="text-right">{v.litres_filled ? Number(v.litres_filled).toFixed(1) : '—'}</TableCell>
                    <TableCell className="text-right">{v.actual_amount ? `KES ${Number(v.actual_amount).toLocaleString()}` : '—'}</TableCell>
                    <TableCell>{v.fill_date || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => printVoucher(v)} className="gap-1"><Printer className="h-3 w-3" /> Print</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Print Voucher ───

async function printVoucher(voucher: FuelVoucher) {
  // Get school info
  const { data: school } = await supabase.rpc('get_or_create_school_profile');
  const schoolName = school?.[0]?.name || 'School';

  const isFilled = voucher.status === 'filled';

  const html = `
    <html><head><title>Fuel Voucher ${voucher.voucher_number}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
      .header h1 { margin: 0; font-size: 20px; }
      .header h2 { margin: 5px 0 0; font-size: 14px; color: #666; }
      .voucher-no { text-align: right; font-size: 18px; font-weight: bold; color: #c00; }
      .section { margin-bottom: 16px; }
      .section h3 { font-size: 13px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
      .field { margin-bottom: 6px; }
      .field .label { font-size: 11px; color: #888; text-transform: uppercase; }
      .field .value { font-size: 14px; font-weight: 500; border-bottom: 1px dotted #aaa; min-height: 20px; padding: 2px 0; }
      .station-section { border: 2px dashed #999; padding: 16px; margin-top: 16px; }
      .station-section h3 { color: #c00; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 40px; }
      .sig-block { text-align: center; }
      .sig-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 4px; font-size: 12px; }
      @media print { body { margin: 15mm; } }
    </style></head><body>
    <div class="header">
      <h1>${schoolName}</h1>
      <h2>FUEL VOUCHER</h2>
    </div>
    <div class="voucher-no">${voucher.voucher_number}</div>

    <div class="section">
      <h3>Vehicle Details</h3>
      <div class="grid">
        <div class="field"><div class="label">Registration</div><div class="value">${voucher.vehicle_reg}</div></div>
        <div class="field"><div class="label">Make / Model</div><div class="value">${voucher.vehicle_make} ${voucher.vehicle_model}</div></div>
        <div class="field"><div class="label">Fuel Type</div><div class="value">${(voucher.vehicle_fuel_type || 'diesel').toUpperCase()}</div></div>
        <div class="field"><div class="label">Odometer at Issue</div><div class="value">${voucher.mileage_at_issue.toLocaleString()} km</div></div>
      </div>
    </div>

    <div class="section">
      <h3>Authorization</h3>
      <div class="grid">
        <div class="field"><div class="label">Driver</div><div class="value">${voucher.driver_name || '______________________'}</div></div>
        <div class="field"><div class="label">License No</div><div class="value">${voucher.driver_license || '______________________'}</div></div>
        <div class="field"><div class="label">Authorized Amount</div><div class="value">KES ${Number(voucher.authorized_amount).toLocaleString()}</div></div>
        <div class="field"><div class="label">Authorized Litres</div><div class="value">${voucher.authorized_litres ? Number(voucher.authorized_litres).toFixed(1) + ' L' : '______________________'}</div></div>
        <div class="field"><div class="label">Issue Date</div><div class="value">${voucher.issued_date}</div></div>
        <div class="field"><div class="label">Remarks</div><div class="value">${voucher.remarks || ''}</div></div>
      </div>
    </div>

    <div class="station-section">
      <h3>To Be Filled at Fuel Station</h3>
      <div class="grid">
        <div class="field"><div class="label">Station Name</div><div class="value">${isFilled ? voucher.station_name : ''}</div></div>
        <div class="field"><div class="label">Fill Date</div><div class="value">${isFilled ? voucher.fill_date : ''}</div></div>
        <div class="field"><div class="label">Litres Filled</div><div class="value">${isFilled ? Number(voucher.litres_filled).toFixed(1) + ' L' : ''}</div></div>
        <div class="field"><div class="label">Price per Litre</div><div class="value">${isFilled ? 'KES ' + Number(voucher.price_per_litre).toFixed(2) : ''}</div></div>
        <div class="field"><div class="label">Total Cost</div><div class="value">${isFilled ? 'KES ' + Number(voucher.actual_amount).toLocaleString() : ''}</div></div>
        <div class="field"><div class="label">Receipt No</div><div class="value">${isFilled ? (voucher.receipt_number || '') : ''}</div></div>
        <div class="field"><div class="label">Odometer at Fill</div><div class="value">${isFilled ? Number(voucher.mileage_at_fill).toLocaleString() + ' km' : ''}</div></div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-block"><div class="sig-line">Authorized By</div></div>
      <div class="sig-block"><div class="sig-line">Driver</div></div>
      <div class="sig-block"><div class="sig-line">Station Attendant</div></div>
    </div>
    </body></html>
  `;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 400);
}
