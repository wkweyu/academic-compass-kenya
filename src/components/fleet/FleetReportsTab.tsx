import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, AlertTriangle, Fuel, Truck } from 'lucide-react';
import { getFleetVehicles, getFuelConsumptionReport } from '@/services/fleetService';

export default function FleetReportsTab() {
  const [subTab, setSubTab] = useState('consumption');

  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <TabsList>
        <TabsTrigger value="consumption" className="gap-1"><Fuel className="h-4 w-4" /> Fuel Consumption</TabsTrigger>
        <TabsTrigger value="fleet-summary" className="gap-1"><Truck className="h-4 w-4" /> Fleet Summary</TabsTrigger>
      </TabsList>
      <TabsContent value="consumption"><FuelConsumptionReport /></TabsContent>
      <TabsContent value="fleet-summary"><FleetSummaryReport /></TabsContent>
    </Tabs>
  );
}

function FuelConsumptionReport() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  const { data: report = [], isLoading } = useQuery({
    queryKey: ['fleet-fuel-report', dateFrom, dateTo],
    queryFn: () => getFuelConsumptionReport(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
  });

  const totals = report.reduce((acc, r) => ({
    litres: acc.litres + r.total_litres,
    cost: acc.cost + r.total_cost,
    vouchers: acc.vouchers + r.voucher_count,
  }), { litres: 0, cost: 0, vouchers: 0 });

  const handlePrint = () => {
    const el = document.getElementById('fuel-consumption-report');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Fuel Consumption Report</title>
      <style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}.text-right{text-align:right}h2{margin-bottom:4px}.total-row{background:#e0e0e0;font-weight:bold}</style>
    </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fuel Consumption Report</CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
          <Button variant="outline" onClick={handlePrint} disabled={report.length === 0} className="gap-1"><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div id="fuel-consumption-report">
          <h2 className="text-lg font-semibold mb-1">Fuel Consumption — {dateFrom} to {dateTo}</h2>
          {isLoading ? <p className="text-muted-foreground">Loading...</p> : report.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No fuel data for this period.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Litres</p>
                  <p className="text-xl font-bold">{totals.litres.toFixed(1)} L</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                  <p className="text-xl font-bold">KES {totals.cost.toLocaleString()}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Vouchers Processed</p>
                  <p className="text-xl font-bold">{totals.vouchers}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead className="text-right">Vouchers</TableHead>
                    <TableHead className="text-right">Litres</TableHead>
                    <TableHead className="text-right">Cost (KES)</TableHead>
                    <TableHead className="text-right">KM Covered</TableHead>
                    <TableHead className="text-right">KM/Litre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((r: any) => (
                    <TableRow key={r.vehicle_id}>
                      <TableCell className="font-medium">{r.registration_number}</TableCell>
                      <TableCell>{r.make_model}</TableCell>
                      <TableCell className="text-right">{r.voucher_count}</TableCell>
                      <TableCell className="text-right">{r.total_litres.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{r.total_cost.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.km_covered.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.km_per_litre}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{totals.vouchers}</TableCell>
                    <TableCell className="text-right">{totals.litres.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{totals.cost.toLocaleString()}</TableCell>
                    <TableCell colSpan={2}></TableCell>
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

function FleetSummaryReport() {
  const { data: vehicles = [], isLoading } = useQuery({ queryKey: ['fleet-vehicles'], queryFn: getFleetVehicles });

  const now = new Date();
  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - now.getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };
  const isExpired = (date: string | null) => date ? new Date(date) < now : false;

  const alerts = vehicles.filter(v =>
    isExpired(v.insurance_expiry) || isExpiringSoon(v.insurance_expiry) ||
    isExpired(v.inspection_expiry) || isExpiringSoon(v.inspection_expiry)
  );

  const statusCounts = vehicles.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader><CardTitle>Fleet Summary</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Vehicles</p>
                <p className="text-xl font-bold">{vehicles.length}</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl font-bold text-primary">{statusCounts['active'] || 0}</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Maintenance</p>
                <p className="text-xl font-bold">{statusCounts['maintenance'] || 0}</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Alerts</p>
                <p className="text-xl font-bold text-destructive">{alerts.length}</p>
              </div>
            </div>

            {alerts.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-destructive" /> Expiry Alerts</h3>
                <div className="space-y-2">
                  {alerts.map(v => (
                    <div key={v.id} className="rounded-md border border-destructive/30 p-3 text-sm">
                      <span className="font-medium">{v.registration_number}</span>
                      {(isExpired(v.insurance_expiry) || isExpiringSoon(v.insurance_expiry)) && (
                        <span className={`ml-3 ${isExpired(v.insurance_expiry) ? 'text-destructive font-semibold' : 'text-yellow-600'}`}>
                          Insurance: {v.insurance_expiry} {isExpired(v.insurance_expiry) ? '(EXPIRED)' : '(expiring soon)'}
                        </span>
                      )}
                      {(isExpired(v.inspection_expiry) || isExpiringSoon(v.inspection_expiry)) && (
                        <span className={`ml-3 ${isExpired(v.inspection_expiry) ? 'text-destructive font-semibold' : 'text-yellow-600'}`}>
                          Inspection: {v.inspection_expiry} {isExpired(v.inspection_expiry) ? '(EXPIRED)' : '(expiring soon)'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.registration_number}</TableCell>
                    <TableCell>{v.make} {v.model}</TableCell>
                    <TableCell>{v.capacity}</TableCell>
                    <TableCell className="capitalize">{v.fuel_type}</TableCell>
                    <TableCell>{v.current_mileage.toLocaleString()} km</TableCell>
                    <TableCell><Badge variant={v.status === 'active' ? 'default' : v.status === 'maintenance' ? 'secondary' : 'destructive'} className="capitalize">{v.status}</Badge></TableCell>
                    <TableCell>{v.route_name || '—'}</TableCell>
                    <TableCell>{v.driver_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
