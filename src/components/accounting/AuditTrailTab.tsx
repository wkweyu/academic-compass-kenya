import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { reportService } from '@/services/accounting/reportService';

export default function AuditTrailTab() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: logs = [] } = useQuery({
    queryKey: ['audit-log', startDate, endDate],
    queryFn: () => reportService.getAuditLog({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Audit Log</CardTitle>
        <CardDescription>Complete history of all accounting actions — entries cannot be deleted, only reversed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 items-end">
          <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log: any) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-sm font-mono">{log.user_id ? String(log.user_id).substring(0, 8) + '...' : '-'}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{log.action}</Badge></TableCell>
                <TableCell className="text-sm">{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {log.new_values ? JSON.stringify(log.new_values) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {logs.length === 0 && <p className="text-center py-8 text-muted-foreground">No audit log entries for accounting module</p>}

        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground space-y-1">
          <p className="font-semibold">Audit Controls in Effect:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Transactions cannot be deleted — only reversed via mirror entries</li>
            <li>All journal entries receive auto-generated reference numbers (JE-YYYY-NNNNN)</li>
            <li>Locked fiscal years prevent back-dated entries</li>
            <li>Every mutation is logged with user ID, timestamp, and old/new values</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
