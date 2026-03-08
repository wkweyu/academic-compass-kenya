import { useState, useMemo, Fragment } from 'react';
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
import { Plus, Pencil, Trash2, Bus, Users, FileText, Search, Receipt } from 'lucide-react';
import { TermManager } from '@/utils/termManager';
import {
  getTransportRoutes,
  createTransportRoute,
  updateTransportRoute,
  deleteTransportRoute,
  getTransportStudents,
  assignStudentToRoute,
  unassignStudentFromRoute,
  postTransportDebit,
  getTransportBillingReport,
  TransportRoute,
} from '@/services/transportService';
import { supabase } from '@/integrations/supabase/client';

export default function TransportModule() {
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
      school_id: 0,
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
  const [showAssign, setShowAssign] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignForm, setAssignForm] = useState({ studentId: 0, routeId: '', transportType: 'two_way' as 'one_way' | 'two_way' });
  const [selectedStudentName, setSelectedStudentName] = useState('');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['transport-students'],
    queryFn: getTransportStudents,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['transport-routes'],
    queryFn: getTransportRoutes,
  });

  // Search for students not yet on transport
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['transport-student-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from('students')
        .select('id, admission_number, full_name, classes:current_class_id(name), streams:current_stream_id(name)')
        .eq('is_active', true)
        .eq('is_on_transport', false)
        .or(`full_name.ilike.%${searchTerm}%,admission_number.ilike.%${searchTerm}%`)
        .order('full_name')
        .limit(10);
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        admission_number: s.admission_number,
        full_name: s.full_name,
        class_name: s.classes?.name || '',
        stream_name: s.streams?.name || '',
      }));
    },
    enabled: searchTerm.length >= 2 && showAssign,
  });

  const unassignMut = useMutation({
    mutationFn: unassignStudentFromRoute,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-students'] }); toast.success('Student removed from transport'); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignMut = useMutation({
    mutationFn: async () => {
      const routeId = parseInt(assignForm.routeId);
      const route = routes.find(r => r.id === routeId);
      if (!route) throw new Error('Route not found');

      // 1. Assign student to route
      await assignStudentToRoute(assignForm.studentId, routeId, assignForm.transportType);

      // 2. Post transport debit (invoice)
      const charge = assignForm.transportType === 'two_way' ? route.two_way_charge : route.one_way_charge;
      const currentTerm = TermManager.getCurrentTerm();
      const currentYear = TermManager.getCurrentYear();
      await postTransportDebit(assignForm.studentId, charge, route.name, currentTerm, currentYear);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transport-students'] });
      qc.invalidateQueries({ queryKey: ['transport-billing'] });
      qc.invalidateQueries({ queryKey: ['student-statement'] });
      qc.invalidateQueries({ queryKey: ['student-ledgers'] });
      qc.invalidateQueries({ queryKey: ['fees-stats'] });
      toast.success('Student assigned to transport and invoiced');
      closeAssign();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAssign = () => {
    setAssignForm({ studentId: 0, routeId: '', transportType: 'two_way' });
    setSearchTerm('');
    setSelectedStudentName('');
    setShowAssign(true);
  };
  const closeAssign = () => { setShowAssign(false); setSearchTerm(''); setSelectedStudentName(''); };

  const selectStudent = (s: any) => {
    setAssignForm({ ...assignForm, studentId: s.id });
    setSelectedStudentName(`${s.full_name} (${s.admission_number}) — ${s.class_name} ${s.stream_name}`);
    setSearchTerm('');
  };

  const selectedRoute = routes.find(r => String(r.id) === assignForm.routeId);
  const estimatedCharge = selectedRoute
    ? (assignForm.transportType === 'two_way' ? selectedRoute.two_way_charge : selectedRoute.one_way_charge)
    : 0;

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
          <Button onClick={openAssign} className="gap-1"><Plus className="h-4 w-4" /> Add Student</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No students assigned to transport. Click "Add Student" to assign one.</p>
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

      {/* Assign Student Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Assign Student to Transport</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Student Search */}
            <div>
              <Label>Student *</Label>
              {selectedStudentName ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 rounded-md border px-3 py-2 text-sm bg-muted">{selectedStudentName}</div>
                  <Button size="sm" variant="ghost" onClick={() => { setAssignForm({ ...assignForm, studentId: 0 }); setSelectedStudentName(''); }}>Change</Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or admission number..."
                    className="pl-9"
                  />
                  {searchTerm.length >= 2 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                      {isSearching ? (
                        <p className="p-3 text-sm text-muted-foreground">Searching...</p>
                      ) : searchResults.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">No students found (or already on transport)</p>
                      ) : (
                        searchResults.map((s: any) => (
                          <button
                            key={s.id}
                            onClick={() => selectStudent(s)}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-b-0"
                          >
                            <span className="font-medium">{s.full_name}</span>
                            <span className="text-muted-foreground ml-2">({s.admission_number})</span>
                            <span className="text-muted-foreground ml-2">— {s.class_name} {s.stream_name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Route */}
            <div>
              <Label>Route *</Label>
              <Select value={assignForm.routeId} onValueChange={(v) => setAssignForm({ ...assignForm, routeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name} (1-way: {r.one_way_charge.toLocaleString()}, 2-way: {r.two_way_charge.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transport Type */}
            <div>
              <Label>Transport Type *</Label>
              <Select value={assignForm.transportType} onValueChange={(v) => setAssignForm({ ...assignForm, transportType: v as 'one_way' | 'two_way' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_way">One Way</SelectItem>
                  <SelectItem value="two_way">Two Way</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Charge Preview */}
            {selectedRoute && (
              <div className="rounded-md border p-3 bg-muted/50">
                <p className="text-sm text-muted-foreground">Charge for current term (Term {TermManager.getCurrentTerm()}, {TermManager.getCurrentYear()})</p>
                <p className="text-lg font-bold">{estimatedCharge.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">This amount will be invoiced to the student's fee account under the Transport votehead.</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeAssign}>Cancel</Button>
              <Button
                onClick={() => assignMut.mutate()}
                disabled={!assignForm.studentId || !assignForm.routeId || assignMut.isPending}
              >
                {assignMut.isPending ? 'Assigning...' : 'Assign & Invoice'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Reports Tab ───

function ReportsTab() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [term, setTerm] = useState(String(TermManager.getCurrentTerm()));
  const [year, setYear] = useState(String(currentYear));

  const { data: report = [], isLoading } = useQuery({
    queryKey: ['transport-billing', term, year],
    queryFn: () => getTransportBillingReport(parseInt(term), parseInt(year)),
    enabled: !!term && !!year,
  });

  const { data: transportStudents = [] } = useQuery({
    queryKey: ['transport-students'],
    queryFn: getTransportStudents,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['transport-routes'],
    queryFn: getTransportRoutes,
  });

  // Bulk invoice mutation
  const bulkInvoiceMut = useMutation({
    mutationFn: async () => {
      const termNum = parseInt(term);
      const yearNum = parseInt(year);

      // Find students who are on transport but not yet invoiced for this term
      const billingMap = new Map<number, any>();
      report.forEach((r: any) => billingMap.set(r.student_id, r));

      const uninvoiced = transportStudents.filter(s => {
        const billing = billingMap.get(s.id);
        return !billing || billing.invoiced === 0;
      });

      if (uninvoiced.length === 0) throw new Error('All transport students are already invoiced for this term.');

      let successCount = 0;
      let errorCount = 0;

      for (const student of uninvoiced) {
        try {
          const charge = student.charge || 0;
          if (charge <= 0) continue;
          await postTransportDebit(student.id, charge, student.route_name || 'Transport', termNum, yearNum);
          successCount++;
        } catch (err) {
          console.error(`Failed to invoice student ${student.id}:`, err);
          errorCount++;
        }
      }

      return { successCount, errorCount };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['transport-billing'] });
      qc.invalidateQueries({ queryKey: ['student-statement'] });
      qc.invalidateQueries({ queryKey: ['student-ledgers'] });
      qc.invalidateQueries({ queryKey: ['fees-stats'] });
      toast.success(`Invoiced ${result.successCount} student(s)${result.errorCount > 0 ? `, ${result.errorCount} failed` : ''}`);
    },
    onError: (e: any) => toast.error(e.message),
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
        balance: billing ? billing.balance : (s.charge || 0),
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

  // Count uninvoiced students
  const uninvoicedCount = useMemo(() => {
    let count = 0;
    routeNames.forEach(rn => mergedByRoute[rn].forEach(s => {
      if (s.invoiced === 0 && s.charge > 0) count++;
    }));
    return count;
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
        .not-invoiced{color:#c00;font-style:italic}
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
          {uninvoicedCount > 0 && (
            <Button
              variant="default"
              onClick={() => {
                if (confirm(`Post transport invoices for ${uninvoicedCount} un-invoiced student(s) for Term ${term}, ${year}?`))
                  bulkInvoiceMut.mutate();
              }}
              disabled={bulkInvoiceMut.isPending}
              className="gap-1"
            >
              <Receipt className="h-4 w-4" />
              {bulkInvoiceMut.isPending ? 'Posting...' : `Invoice ${uninvoicedCount} Student${uninvoicedCount !== 1 ? 's' : ''}`}
            </Button>
          )}
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
                  <p className="text-xl font-bold text-primary">{grandTotals.paid.toLocaleString()}</p>
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
                            <TableCell className={`text-right ${s.invoiced === 0 ? 'text-destructive italic' : ''}`}>
                              {s.invoiced === 0 ? 'Not invoiced' : s.invoiced.toLocaleString()}
                            </TableCell>
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
