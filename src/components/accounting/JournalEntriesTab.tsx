import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, RotateCcw, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { accountingService, JournalEntry } from '@/services/accountingService';
import { fiscalYearService } from '@/services/accounting/fiscalYearService';
import { fundService } from '@/services/accounting/fundService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

interface JournalLine {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  description: string;
  fund_id: string;
}

const emptyLine = (): JournalLine => ({ account_id: '', debit_amount: '', credit_amount: '', description: '', fund_id: '' });

export default function JournalEntriesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [journalForm, setJournalForm] = useState({
    description: '', entry_date: new Date().toISOString().split('T')[0],
    fiscal_year_id: '', fund_id: '',
  });
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);

  const { data: accounts = [] } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: () => accountingService.getAccounts() });
  const { data: entries = [], refetch } = useQuery({
    queryKey: ['journal-entries', statusFilter],
    queryFn: () => accountingService.getJournalEntries(statusFilter !== 'all' ? { status: statusFilter } : undefined),
  });
  const { data: fiscalYears = [] } = useQuery({ queryKey: ['fiscal-years'], queryFn: () => fiscalYearService.getAll() });
  const { data: funds = [] } = useQuery({ queryKey: ['accounting-funds'], queryFn: () => fundService.getAll() });

  const postingAccounts = accounts.filter(a => a.is_active && !a.is_header);

  const updateLine = (i: number, field: keyof JournalLine, value: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit_amount) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit_amount) || 0), 0);

  const handleCreate = async () => {
    if (!journalForm.description) { toast({ title: 'Description required', variant: 'destructive' }); return; }
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0));
    if (validLines.length < 2) { toast({ title: 'Need at least 2 lines', variant: 'destructive' }); return; }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({ title: 'Debits must equal credits', variant: 'destructive' }); return;
    }

    try {
      await accountingService.createJournalEntry(
        {
          reference_number: '',
          description: journalForm.description,
          entry_date: journalForm.entry_date,
          status: 'draft',
          total_debit: totalDebit,
          total_credit: totalCredit,
          school_id: 0,
          fiscal_year_id: journalForm.fiscal_year_id && journalForm.fiscal_year_id !== '__none__' ? parseInt(journalForm.fiscal_year_id) : undefined,
          fund_id: journalForm.fund_id && journalForm.fund_id !== '__none__' ? parseInt(journalForm.fund_id) : undefined,
        },
        validLines.map(l => ({
          account_id: parseInt(l.account_id),
          debit_amount: parseFloat(l.debit_amount) || 0,
          credit_amount: parseFloat(l.credit_amount) || 0,
          description: l.description,
          fund_id: l.fund_id ? parseInt(l.fund_id) : undefined,
        }))
      );
      toast({ title: 'Journal entry created (auto-ref generated)' });
      setIsOpen(false);
      setJournalForm({ description: '', entry_date: new Date().toISOString().split('T')[0], fiscal_year_id: '', fund_id: '' });
      setLines([emptyLine(), emptyLine()]);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handlePost = async (id: number) => {
    try {
      await accountingService.postJournalEntry(id);
      toast({ title: 'Entry posted' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleReverse = async (id: number) => {
    if (!confirm('Create a reversal entry for this journal entry?')) return;
    try {
      await accountingService.reverseJournalEntry(id);
      toast({ title: 'Reversal entry created and posted' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleView = async (id: number) => {
    try {
      const entry = await accountingService.getJournalEntry(id);
      setSelectedEntry(entry);
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <CardTitle>Journal Entries</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Entry</Button></DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Create Journal Entry</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Date *</Label><Input type="date" value={journalForm.entry_date} onChange={e => setJournalForm(p => ({ ...p, entry_date: e.target.value }))} /></div>
                      <div><Label>Description *</Label><Input value={journalForm.description} onChange={e => setJournalForm(p => ({ ...p, description: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Fiscal Year</Label>
                        <Select value={journalForm.fiscal_year_id} onValueChange={v => setJournalForm(p => ({ ...p, fiscal_year_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Auto</SelectItem>
                            {fiscalYears.map(fy => <SelectItem key={fy.id} value={fy.id.toString()}>{fy.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Fund</Label>
                        <Select value={journalForm.fund_id} onValueChange={v => setJournalForm(p => ({ ...p, fund_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {funds.filter(f => f.is_active).map(f => <SelectItem key={f.id} value={f.id.toString()}>{f.fund_code} - {f.fund_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-base font-semibold">Lines</Label>
                        <Button variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyLine()])}><Plus className="h-3 w-3 mr-1" />Add Line</Button>
                      </div>
                      <div className="border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[30%]">Account</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Debit</TableHead>
                              <TableHead className="text-right">Credit</TableHead>
                              <TableHead className="w-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lines.map((line, i) => (
                              <TableRow key={i}>
                                <TableCell>
                                  <Select value={line.account_id} onValueChange={v => updateLine(i, 'account_id', v)}>
                                    <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>{postingAccounts.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.account_code} - {a.account_name}</SelectItem>)}</SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell><Input className="h-8" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></TableCell>
                                <TableCell><Input className="h-8 text-right" type="number" min="0" value={line.debit_amount} onChange={e => updateLine(i, 'debit_amount', e.target.value)} /></TableCell>
                                <TableCell><Input className="h-8 text-right" type="number" min="0" value={line.credit_amount} onChange={e => updateLine(i, 'credit_amount', e.target.value)} /></TableCell>
                                <TableCell>{lines.length > 2 && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}>×</Button>}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell colSpan={2} className="text-right">Totals</TableCell>
                              <TableCell className="text-right">{formatCurrency(totalDebit)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(totalCredit)}</TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                      {Math.abs(totalDebit - totalCredit) > 0.01 && totalDebit > 0 && (
                        <p className="text-sm text-destructive">Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}</p>
                      )}
                    </div>
                    <Button onClick={handleCreate} className="w-full">Create Journal Entry (Draft)</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id} className={`cursor-pointer ${e.is_reversal ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`} onClick={() => handleView(e.id)}>
                  <TableCell>{new Date(e.entry_date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-sm">{e.reference_number}</TableCell>
                  <TableCell>
                    {e.is_reversal && <Badge variant="outline" className="mr-1 text-xs">REV</Badge>}
                    {e.description}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(e.total_debit))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(e.total_credit))}</TableCell>
                  <TableCell><Badge variant={e.status === 'posted' ? 'default' : e.status === 'voided' ? 'destructive' : 'outline'}>{e.status}</Badge></TableCell>
                  <TableCell onClick={ev => ev.stopPropagation()}>
                    <div className="flex gap-1">
                      {e.status === 'draft' && <Button size="sm" variant="outline" onClick={() => handlePost(e.id)}><Send className="h-3 w-3 mr-1" />Post</Button>}
                      {e.status === 'posted' && !e.is_reversal && (
                        <Button size="sm" variant="outline" className="text-orange-600" onClick={() => handleReverse(e.id)}>
                          <RotateCcw className="h-3 w-3 mr-1" />Reverse
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {entries.length === 0 && <p className="text-center py-8 text-muted-foreground">No journal entries</p>}
        </CardContent>
      </Card>

      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={open => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Journal Entry: {selectedEntry?.reference_number}</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{new Date(selectedEntry.entry_date).toLocaleDateString()}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={selectedEntry.status === 'posted' ? 'default' : 'outline'}>{selectedEntry.status}</Badge></div>
                <div><span className="text-muted-foreground">Description:</span> <span className="font-medium">{selectedEntry.description}</span></div>
              </div>
              {selectedEntry.is_reversal && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">This is a reversal entry</Badge>
              )}
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(selectedEntry.lines || []).map(l => (
                    <TableRow key={l.id}>
                      <TableCell><span className="font-mono text-sm">{l.account_code}</span> - {l.account_name}</TableCell>
                      <TableCell className="text-sm">{l.description || '-'}</TableCell>
                      <TableCell className="text-right">{Number(l.debit_amount) > 0 ? formatCurrency(Number(l.debit_amount)) : '-'}</TableCell>
                      <TableCell className="text-right">{Number(l.credit_amount) > 0 ? formatCurrency(Number(l.credit_amount)) : '-'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2}>Totals</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(selectedEntry.total_debit))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(selectedEntry.total_credit))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
