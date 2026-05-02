import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { timetableService } from '@/services/timetableService';
import type { Timetable } from '@/types/timetable';

interface Props {
  classId: number;
  streamId: number | null;
  term: 1 | 2 | 3;
  year: number;
  currentVersion: number;
  onSelect: (timetable: Timetable) => void;
  onClose: () => void;
}

export const VersionPickerDialog = ({ classId, streamId, term, year, currentVersion, onSelect, onClose }: Props) => {
  const [versions, setVersions] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    timetableService.getTimetableVersions(classId, streamId, term, year).then((v) => {
      setVersions(v);
      setLoading(false);
    });
  }, []);

  const handleDuplicate = async (timetableId: string) => {
    setDuplicating(true);
    try {
      const newTt = await timetableService.duplicateTimetable(timetableId);
      const updated = await timetableService.getTimetableVersions(classId, streamId, term, year);
      setVersions(updated);
      onSelect(newTt);
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Timetable Versions</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {versions.map((v) => (
              <div
                key={v.id}
                className={`flex items-center justify-between rounded border px-3 py-2 ${v.version === currentVersion ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-sm">Version {v.version}</div>
                  <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={v.status === 'published' ? 'default' : 'secondary'}>{v.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => onSelect(v)}>Load</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDuplicate(v.id)} disabled={duplicating}>
                    Duplicate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
