import { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { timetableService } from '@/services/timetableService';
import { supabase } from '@/integrations/supabase/client';
import type { SubjectConstraint } from '@/types/timetable';

interface SubjectOption {
  id: number;
  name: string;
  code: string;
}

interface SubjectConstraintsManagerProps {
  schoolId: number;
}

const CONSTRAINT_TYPE_LABELS: Record<SubjectConstraint['constraint_type'], string> = {
  no_consecutive: 'No Consecutive',
  no_same_day:    'Not Same Day',
  preferred_gap:  'Preferred Gap',
};

export const SubjectConstraintsManager = ({ schoolId }: SubjectConstraintsManagerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [constraints, setConstraints] = useState<SubjectConstraint[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);

  // Form state
  const [subjectAId, setSubjectAId] = useState<number | null>(null);
  const [subjectBId, setSubjectBId] = useState<number | null>(null);
  const [constraintType, setConstraintType] = useState<SubjectConstraint['constraint_type']>('no_consecutive');
  const [minGap, setMinGap] = useState<number>(1);
  const [isHard, setIsHard] = useState(false);
  const [priority, setPriority] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, [schoolId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [constraintData, { data: subjectData }] = await Promise.all([
        timetableService.getSubjectConstraints(schoolId),
        supabase
          .from('subjects')
          .select('id, name, code')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);
      setConstraints(constraintData);
      setSubjects((subjectData ?? []) as SubjectOption[]);
    } catch (err: any) {
      toast({ title: 'Error loading constraints', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubjectAId(null);
    setSubjectBId(null);
    setConstraintType('no_consecutive');
    setMinGap(1);
    setIsHard(false);
    setPriority(5);
    setShowAdvanced(false);
  };

  const handleAdd = async () => {
    if (!subjectAId || !subjectBId) return;
    if (subjectAId === subjectBId) {
      toast({ title: 'Invalid', description: 'Select two different subjects.', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const created = await timetableService.createSubjectConstraint({
        school_id: schoolId,
        subject_a_id: subjectAId,
        subject_b_id: subjectBId,
        constraint_type: constraintType,
        min_gap: constraintType === 'preferred_gap' ? minGap : null,
        is_hard: isHard,
        priority,
      });
      setConstraints(prev => [...prev, created]);
      resetForm();
      toast({ title: 'Constraint added' });
    } catch (err: any) {
      // Detect unique violation (Postgres code 23505)
      const isDuplicate = err.code === '23505' || err.message?.includes('uq_constraint');
      toast({
        title: isDuplicate ? 'Already exists' : 'Error',
        description: isDuplicate
          ? 'This constraint already exists for that pair and type.'
          : err.message,
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await timetableService.deleteSubjectConstraint(id);
      setConstraints(prev => prev.filter(c => c.id !== id));
      toast({ title: 'Constraint removed' });
    } catch (err: any) {
      toast({ title: 'Error removing constraint', description: err.message, variant: 'destructive' });
    }
  };

  const subjectsForB = subjects.filter(s => s.id !== subjectAId);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Subject Scheduling Constraints</CardTitle>
        <p className="text-sm text-muted-foreground">
          Define rules that control how pairs of subjects are scheduled relative to each other.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Existing constraints table */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : constraints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No constraints defined yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject A</TableHead>
                <TableHead>Subject B</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Min Gap</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {constraints.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.subject_a?.name ?? c.subject_a_id}</TableCell>
                  <TableCell className="font-medium">{c.subject_b?.name ?? c.subject_b_id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{CONSTRAINT_TYPE_LABELS[c.constraint_type]}</Badge>
                  </TableCell>
                  <TableCell>
                    {c.is_hard
                      ? <Badge variant="destructive">Hard</Badge>
                      : <Badge variant="secondary">Soft</Badge>}
                  </TableCell>
                  <TableCell>{c.priority}</TableCell>
                  <TableCell>{c.min_gap ?? '—'}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Add form */}
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Add Constraint</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Subject A</Label>
              <Select
                value={subjectAId?.toString() ?? ''}
                onValueChange={(v) => { setSubjectAId(Number(v)); setSubjectBId(null); }}
              >
                <SelectTrigger><SelectValue placeholder="Select subject…" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Subject B</Label>
              <Select
                value={subjectBId?.toString() ?? ''}
                onValueChange={(v) => setSubjectBId(Number(v))}
                disabled={!subjectAId}
              >
                <SelectTrigger><SelectValue placeholder="Select subject…" /></SelectTrigger>
                <SelectContent>
                  {subjectsForB.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Constraint Type</Label>
            <Select
              value={constraintType}
              onValueChange={(v) => setConstraintType(v as SubjectConstraint['constraint_type'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_consecutive">No Consecutive — never placed in back-to-back periods</SelectItem>
                <SelectItem value="no_same_day">Not Same Day — never on the same day</SelectItem>
                <SelectItem value="preferred_gap">Preferred Gap — prefer a minimum number of periods apart</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {constraintType === 'preferred_gap' && (
            <div className="grid gap-1">
              <Label className="text-xs">Minimum Gap (periods)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={minGap}
                onChange={(e) => setMinGap(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-32"
              />
            </div>
          )}

          {/* Advanced settings */}
          <details open={showAdvanced} onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-xs text-muted-foreground select-none">
              Advanced Settings
            </summary>
            <div className="mt-2 pl-3 border-l space-y-3">
              <p className="text-xs text-muted-foreground">
                Hard constraints with priority ≥ 7 block generation entirely for that slot.
                Hard constraints with priority &lt; 7 apply a heavy score penalty instead.
                Soft constraints penalise the score proportionally.
              </p>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Hard Constraint</Label>
                  <p className="text-xs text-muted-foreground">Treat as a blocking rule (default: soft)</p>
                </div>
                <Switch checked={isHard} onCheckedChange={setIsHard} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Priority (1–10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={priority}
                  onChange={(e) => setPriority(Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                  className="w-24"
                />
              </div>
            </div>
          </details>

          <Button
            onClick={handleAdd}
            disabled={!subjectAId || !subjectBId || adding}
            size="sm"
            className="gap-1"
          >
            <Plus size={14} />
            {adding ? 'Adding…' : 'Add Constraint'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
