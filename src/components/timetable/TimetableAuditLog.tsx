import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { timetableService } from '@/services/timetableService';
import type { TimetableAuditLog as AuditLogEntry } from '@/types/timetable';

const ACTION_COLORS: Record<string, string> = {
  created: 'default',
  updated: 'secondary',
  published: 'default',
  unpublished: 'secondary',
  archived: 'outline',
  slot_updated: 'secondary',
  slot_moved: 'secondary',
  generated: 'default',
  substitution_created: 'outline',
};

interface Props {
  timetableId: string;
}

export const TimetableAuditLog = ({ timetableId }: Props) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    timetableService.getAuditLog(timetableId).then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, [timetableId]);

  const formatChanges = (changes: any) => {
    if (!changes) return null;
    return JSON.stringify(changes, null, 2);
  };

  if (loading) return <div className="py-6 text-center text-sm text-muted-foreground">Loading audit log…</div>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Audit Log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 max-h-96 overflow-y-auto">
        {logs.map((log) => (
          <Collapsible key={log.id} open={openId === log.id} onOpenChange={(open) => setOpenId(open ? log.id : null)}>
            <CollapsibleTrigger className="w-full text-left">
              <div className="flex items-center justify-between rounded hover:bg-muted px-2 py-1.5 text-sm cursor-pointer">
                <div className="flex items-center gap-2">
                  <Badge variant={ACTION_COLORS[log.action] as any ?? 'secondary'} className="text-xs">{log.action}</Badge>
                  <span className="text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString()}</span>
                  {log.user_id && <span className="text-xs text-muted-foreground">· {log.user_id.slice(0, 8)}…</span>}
                </div>
                {log.changes && <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openId === log.id ? 'rotate-180' : ''}`} />}
              </div>
            </CollapsibleTrigger>
            {log.changes && (
              <CollapsibleContent>
                <pre className="ml-4 mt-1 mb-2 rounded bg-muted p-2 text-xs overflow-x-auto">{formatChanges(log.changes)}</pre>
              </CollapsibleContent>
            )}
          </Collapsible>
        ))}
        {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No audit entries yet.</p>}
      </CardContent>
    </Card>
  );
};
