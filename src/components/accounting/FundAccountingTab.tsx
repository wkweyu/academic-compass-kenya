import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { fundService, AccountingFund } from '@/services/accounting/fundService';

const FUND_TYPES = [
  { value: 'tuition', label: 'Tuition Fund' },
  { value: 'government_grant', label: 'Government Grant' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'feeding', label: 'Feeding Program' },
  { value: 'capitation', label: 'Capitation' },
  { value: 'other', label: 'Other' },
];

export default function FundAccountingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    fund_code: '', fund_name: '', fund_type: 'other',
    description: '', is_restricted: false,
  });

  const { data: funds = [] } = useQuery({ queryKey: ['accounting-funds'], queryFn: () => fundService.getAll() });

  useEffect(() => { fundService.seedDefaults().catch(() => {}); }, []);

  const handleCreate = async () => {
    if (!form.fund_code || !form.fund_name) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      await fundService.create({
        fund_code: form.fund_code,
        fund_name: form.fund_name,
        fund_type: form.fund_type as any,
        description: form.description,
        is_restricted: form.is_restricted,
        is_active: true,
      });
      toast({ title: 'Fund created' });
      setIsOpen(false);
      setForm({ fund_code: '', fund_name: '', fund_type: 'other', description: '', is_restricted: false });
      queryClient.invalidateQueries({ queryKey: ['accounting-funds'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleToggleActive = async (fund: AccountingFund) => {
    try {
      await fundService.update(fund.id, { is_active: !fund.is_active });
      toast({ title: fund.is_active ? 'Fund deactivated' : 'Fund activated' });
      queryClient.invalidateQueries({ queryKey: ['accounting-funds'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Fund Accounting (IPSAS)</CardTitle>
            <CardDescription>Manage funds for public sector accounting standards compliance</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Fund</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Fund</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Fund Code *</Label><Input value={form.fund_code} onChange={e => setForm(p => ({ ...p, fund_code: e.target.value }))} placeholder="e.g., GF" /></div>
                  <div><Label>Fund Type *</Label>
                    <Select value={form.fund_type} onValueChange={v => setForm(p => ({ ...p, fund_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FUND_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Fund Name *</Label><Input value={form.fund_name} onChange={e => setForm(p => ({ ...p, fund_name: e.target.value }))} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_restricted} onCheckedChange={v => setForm(p => ({ ...p, is_restricted: v }))} />
                  <Label>Restricted fund (can only be spent on designated purposes)</Label>
                </div>
                <Button onClick={handleCreate} className="w-full">Create Fund</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Fund Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Restriction</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funds.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-mono">{f.fund_code}</TableCell>
                <TableCell className="font-medium">{f.fund_name}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{f.fund_type.replace('_', ' ')}</Badge></TableCell>
                <TableCell>
                  {f.is_restricted ? (
                    <div className="flex items-center gap-1 text-orange-600"><Shield className="h-4 w-4" /><span className="text-xs">Restricted</span></div>
                  ) : (
                    <div className="flex items-center gap-1 text-green-600"><ShieldCheck className="h-4 w-4" /><span className="text-xs">Unrestricted</span></div>
                  )}
                </TableCell>
                <TableCell><Badge variant={f.is_active ? 'default' : 'outline'}>{f.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleActive(f)}>
                    {f.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {funds.length === 0 && <p className="text-center py-8 text-muted-foreground">No funds. Default IPSAS funds will be created automatically.</p>}

        <div className="mt-6 p-4 rounded-lg bg-muted/50 space-y-2">
          <h4 className="font-semibold text-sm">Government Subsidy Workflow</h4>
          <p className="text-sm text-muted-foreground">
            For public schools receiving government subsidies:
          </p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            <li><strong>Record subsidy promise:</strong> DR Government Grant Receivable, CR Tuition Fees Income (Government Grant Fund)</li>
            <li><strong>When funds received:</strong> DR Bank, CR Government Grant Receivable (Government Grant Fund)</li>
            <li><strong>Capitation grants:</strong> DR Bank, CR Capitation Income (Capitation Fund)</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
