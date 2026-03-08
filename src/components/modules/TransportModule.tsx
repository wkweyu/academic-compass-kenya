import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Bus, Users, FileText } from 'lucide-react';
import {
  getTransportRoutes,
  createTransportRoute,
  updateTransportRoute,
  deleteTransportRoute,
  getTransportStudents,
  unassignStudentFromRoute,
  getTransportBillingReport,
  TransportRoute,
} from '@/services/transportService';

export default function TransportModule() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('routes');

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="routes" className="gap-1"><Bus className="h-4 w-4" /> Routes</TabsTrigger>
          <TabsTrigger value="students" className="gap-1"><Users className="h-4 w-4" /> Students</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1"><FileText className="h-4 w-4" /> Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="routes"><RoutesTab /></TabsContent>
        <TabsContent value="students"><StudentsTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Routes Tab ───

function RoutesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TransportRoute | null>(null);
  const [form, setForm] = useState({ name: '', one_way_charge: '', two_way_charge: '', description: '' });

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['transport-routes'],
    queryFn: getTransportRoutes,
  });

  const createMut = useMutation({
    mutationFn: createTransportRoute,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success('Route created'); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TransportRoute> }) => updateTransportRoute(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success('Route updated'); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTransportRoute,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success('Route deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setForm({ name: '', one_way_charge: '', two_way_charge: '', description: '' }); setShowForm(true); };
  const openEdit = (r: TransportRoute) => {
    setEditing(r);
    setForm({ name: r.name, one_way_charge: String(r.one_way_charge), two_way_charge: String(r.two_way_charge), description: r.description || '' });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = () => {
    const payload = {
      name: form.name,
      one_way_charge: parseFloat(form.one_way_charge),
      two_way_charge: parseFloat(form.two_way_charge),
      description: form.description || null,
      school_id: 0, // will be overridden
    };
    if (!form.name || !form.one_way_charge || !form.two_way_charge) { toast.error('Fill all required fields'); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Transport Routes</CardTitle>
        <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Add Route</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : routes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No transport routes yet. Create your first route.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route Name</TableHead>
                <TableHead className="text-right">One-Way Charge</TableHead>
                <TableHead className="text-right">Two-Way Charge</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{Number(r.one_way_charge).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{Number(r.two_way_charge).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{r.description || '—'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Delete this route?')) deleteMut.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Route' : 'New Route'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Route Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Kisumu - CBD" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>One-Way Charge *</Label><Input type="number" value={form.one_way_charge} onChange={(e) => setForm({ ...form, one_way_charge: e.target.value })} /></div>
              <div><Label>Two-Way Charge *</Label><Input type="number" value={form.two_way_charge} onChange={(e) => setForm({ ...form, two_way_charge: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Students Tab ───

function StudentsTab() {
  const qc = useQueryClient();
  const [filterRoute, setFilterRoute] = useState('all');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['transport-students'],
    queryFn: getTransportStudents,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['transport-routes'],
    queryFn: getTransportRoutes,
  });

  const unassignMut = useMutation({
    mutationFn: unassignStudentFromRoute,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-students'] }); toast.success('Student removed from transport'); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = filterRoute === 'all'
    ? students
    : students.filter((s) => String(s.transport_route_id) === filterRoute);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Students on Transport</CardTitle>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Route:</Label>
          <Select value={filterRoute} onValueChange={setFilterRoute}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Routes</SelectItem>
              {routes.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No students assigned to transport. Assign students via the Student Management module.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adm No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Charge</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.admission_number}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>{s.current_class_name} {s.current_stream_name}</TableCell>
                  <TableCell>{s.route_name}</TableCell>
                  <TableCell>
                    <Badge variant={s.transport_type === 'two_way' ? 'default' : 'secondary'}>
                      {s.transport_type === 'two_way' ? 'Two Way' : 'One Way'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{s.charge?.toLocaleString() || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Remove from transport?')) unassignMut.mutate(s.id); }}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Reports Tab ───

function ReportsTab() {
  const currentYear = new Date().getFullYear();
  const [term, setTerm] = useState('1');
  const [year, setYear] = useState(String(currentYear));

  const { data: report = [], isLoading } = useQuery({
    queryKey: ['transport-billing', term, year],
    queryFn: () => getTransportBillingReport(parseInt(term), parseInt(year)),
    enabled: !!term && !!year,
  });

  // Also fetch all transport students (even those without billing yet)
  const { data: transportStudents = [] } = useQuery({
    queryKey: ['transport-students'],
    queryFn: getTransportStudents,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['transport-routes'],
    queryFn: getTransportRoutes,
  });

  // Merge: for each transport student, overlay billing data if it exists
  const mergedByRoute = useMemo(() => {
    const billingMap = new Map<number, any>();
    report.forEach((r: any) => billingMap.set(r.student_id, r));

    const allStudents = transportStudents.map((s) => {
      const billing = billingMap.get(s.id);
      return {
        student_id: s.id,
        admission_number: s.admission_number,
        full_name: s.full_name,
        class_name: s.current_class_name,
        stream_name: s.current_stream_name,
        route_name: s.route_name || 'Unassigned',
        route_id: s.transport_route_id || 0,
        transport_type: s.transport_type || '',
        charge: s.charge || 0,
        invoiced: billing?.invoiced || 0,
        paid: billing?.paid || 0,
        balance: billing?.balance || (s.charge || 0),
      };
    });

    // Also include billing-only students not in transport list
    report.forEach((r: any) => {
      if (!transportStudents.find((s) => s.id === r.student_id)) {
        allStudents.push({
          student_id: r.student_id,
          admission_number: r.admission_number,
          full_name: r.full_name,
          class_name: r.class_name,
          stream_name: r.stream_name,
          route_name: r.route_name || 'Unknown',
          route_id: 0,
          transport_type: r.transport_type,
          charge: r.invoiced,
          invoiced: r.invoiced,
          paid: r.paid,
          balance: r.balance,
        });
      }
    });

    // Group by route
    const grouped: Record<string, typeof allStudents> = {};
    allStudents.forEach((s) => {
      const key = s.route_name || 'Unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    // Sort students within each route
    Object.values(grouped).forEach((list) => list.sort((a, b) => a.full_name.localeCompare(b.full_name)));

    return grouped;
  }, [report, transportStudents]);

  const routeNames = Object.keys(mergedByRoute).sort();
  const grandTotals = useMemo(() => {
    let invoiced = 0, paid = 0, balance = 0, charge = 0;
    routeNames.forEach((rn) => mergedByRoute[rn].forEach((s) => {
      charge += s.charge; invoiced += s.invoiced; paid += s.paid; balance += s.balance;
    }));
    return { charge, invoiced, paid, balance };
  }, [mergedByRoute, routeNames]);

  const handlePrint = () => {
    const el = document.getElementById('transport-billing-report');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Transport Billing Report</title>
      <style>
        body{font-family:Arial;margin:20px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:12px}
        .text-right{text-align:right}
        .route-header{background:#f0f0f0;font-weight:bold;font-size:13px}
        .subtotal-row{background:#f8f8f8;font-weight:600}
        .grand-total{background:#e0e0e0;font-weight:bold;font-size:13px}
        h2{margin-bottom:4px}
        .summary{display:flex;gap:24px;margin-bottom:12px}
        .summary-card{border:1px solid #ccc;padding:8px 16px;border-radius:4px;text-align:center}
        .summary-card .label{font-size:11px;color:#666}
        .summary-card .value{font-size:18px;font-weight:bold}
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const hasData = routeNames.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Transport Billing Report</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Term 1</SelectItem>
              <SelectItem value="2">Term 2</SelectItem>
              <SelectItem value="3">Term 3</SelectItem>
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handlePrint} disabled={!hasData}>Print</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div id="transport-billing-report">
          <h2 className="text-lg font-semibold mb-1">Transport Billing — Term {term}, {year}</h2>

          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !hasData ? (
            <p className="text-muted-foreground text-center py-8">No transport students or billing data for this period.</p>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Routes</p>
                  <p className="text-xl font-bold">{routeNames.length}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Charges</p>
                  <p className="text-xl font-bold">{grandTotals.charge.toLocaleString()}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-xl font-bold text-green-600">{grandTotals.paid.toLocaleString()}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="text-xl font-bold text-destructive">{grandTotals.balance.toLocaleString()}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">#</TableHead>
                    <TableHead>Adm No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Charge</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routeNames.map((routeName) => {
                    const students = mergedByRoute[routeName];
                    const routeCharge = students.reduce((s, r) => s + r.charge, 0);
                    const routeInvoiced = students.reduce((s, r) => s + r.invoiced, 0);
                    const routePaid = students.reduce((s, r) => s + r.paid, 0);
                    const routeBalance = students.reduce((s, r) => s + r.balance, 0);

                    return (
                      <Fragment key={routeName}>
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={9} className="font-semibold text-sm">
                            <Bus className="h-4 w-4 inline mr-2" />
                            {routeName} ({students.length} student{students.length !== 1 ? 's' : ''})
                          </TableCell>
                        </TableRow>
                        {students.map((s, idx) => (
                          <TableRow key={s.student_id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>{s.admission_number}</TableCell>
                            <TableCell className="font-medium">{s.full_name}</TableCell>
                            <TableCell>{s.class_name} {s.stream_name}</TableCell>
                            <TableCell>
                              <Badge variant={s.transport_type === 'two_way' ? 'default' : 'secondary'} className="text-xs">
                                {s.transport_type === 'two_way' ? '2-Way' : '1-Way'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{s.charge.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{s.invoiced.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{s.paid.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-medium">{s.balance.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 border-b-2">
                          <TableCell colSpan={5} className="text-right font-semibold text-sm">Subtotal — {routeName}</TableCell>
                          <TableCell className="text-right font-semibold">{routeCharge.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">{routeInvoiced.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">{routePaid.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">{routeBalance.toLocaleString()}</TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                  <TableRow className="font-bold border-t-2 bg-muted">
                    <TableCell colSpan={5} className="text-right">Grand Total</TableCell>
                    <TableCell className="text-right">{grandTotals.charge.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{grandTotals.invoiced.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{grandTotals.paid.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{grandTotals.balance.toLocaleString()}</TableCell>
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
