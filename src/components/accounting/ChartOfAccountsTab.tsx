import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { accountingService, ChartOfAccount } from '@/services/accountingService';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];
const typeColors: Record<string, string> = { asset: 'default', liability: 'destructive', equity: 'secondary', income: 'default', expense: 'outline' };

interface TreeNode extends ChartOfAccount {
  children: TreeNode[];
  depth: number;
}

function buildTree(accounts: ChartOfAccount[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  accounts.forEach(a => map.set(a.id, { ...a, children: [], depth: 0 }));
  accounts.forEach(a => {
    const node = map.get(a.id)!;
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const flat: TreeNode[] = [];
  const flatten = (nodes: TreeNode[], depth: number) => {
    nodes.forEach(n => {
      flat.push({ ...n, depth });
      if (n.children.length > 0) flatten(n.children, depth + 1);
    });
  };
  flatten(roots, 0);
  return flat;
}

export default function ChartOfAccountsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    account_code: '', account_name: '', account_type: 'asset',
    description: '', parent_id: '', is_header: false,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => accountingService.getAccounts(),
  });

  const treeAccounts = buildTree(accounts);

  const handleCreate = async () => {
    if (!form.account_code || !form.account_name) {
      toast({ title: 'Fill required fields', variant: 'destructive' }); return;
    }
    try {
      await accountingService.createAccount({
        account_code: form.account_code,
        account_name: form.account_name,
        account_type: form.account_type as any,
        description: form.description,
        parent_id: form.parent_id && form.parent_id !== '__none__' ? parseInt(form.parent_id) : undefined,
        is_header: form.is_header,
        is_active: true,
        school_id: 0,
      });
      toast({ title: 'Account created' });
      setIsOpen(false);
      setForm({ account_code: '', account_name: '', account_type: 'asset', description: '', parent_id: '', is_header: false });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this account? It will not be deleted.')) return;
    try {
      await accountingService.deactivateAccount(id);
      toast({ title: 'Account deactivated' });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Chart of Accounts</CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code *</Label><Input value={form.account_code} onChange={e => setForm(p => ({ ...p, account_code: e.target.value }))} placeholder="e.g., 1010" /></div>
                  <div><Label>Type *</Label>
                    <Select value={form.account_type} onValueChange={v => setForm(p => ({ ...p, account_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Name *</Label><Input value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} /></div>
                <div><Label>Parent Account (optional)</Label>
                  <Select value={form.parent_id} onValueChange={v => setForm(p => ({ ...p, parent_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {accounts.filter(a => a.is_active).map(a => (
                        <SelectItem key={a.id} value={a.id.toString()}>{a.account_code} - {a.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_header} onCheckedChange={v => setForm(p => ({ ...p, is_header: v }))} />
                  <Label>Header account (grouping only, no postings)</Label>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                <Button onClick={handleCreate} className="w-full">Create Account</Button>
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
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {treeAccounts.map(a => (
              <TableRow key={a.id} className={a.is_header ? 'bg-muted/30 font-semibold' : ''}>
                <TableCell className="font-mono" style={{ paddingLeft: `${a.depth * 24 + 16}px` }}>
                  {a.children.length > 0 && <ChevronDown className="inline h-3 w-3 mr-1" />}
                  {a.account_code}
                </TableCell>
                <TableCell>{a.account_name}{a.is_header && <Badge variant="outline" className="ml-2 text-xs">Header</Badge>}</TableCell>
                <TableCell><Badge variant={(typeColors[a.account_type] || 'outline') as any} className="capitalize">{a.account_type}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.description || '-'}</TableCell>
                <TableCell>{a.is_active ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                <TableCell>
                  {a.is_active && !a.is_header && (
                    <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => handleDeactivate(a.id)}>
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {accounts.length === 0 && <p className="text-center py-8 text-muted-foreground">No accounts. Default accounts will be created automatically.</p>}
      </CardContent>
    </Card>
  );
}
