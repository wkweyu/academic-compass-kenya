import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, AlertTriangle, Loader2 } from 'lucide-react';
import { timetableService } from '@/services/timetableService';
import type { SchedulingConstraints, GenerationResult, SchoolGenerationResult, ClassGenerationResult } from '@/types/timetable';
import { TimetableGrid } from './TimetableGrid';

interface Props {
  classId: number;
  streamId: number | null;
  term: 1 | 2 | 3;
  year: number;
  onResult: (result: GenerationResult) => void;
  onClose: () => void;
  /** Required for school-wide generation */
  schoolId?: number;
  onSchoolResult?: (result: SchoolGenerationResult) => void;
}

type Step = 'config' | 'loading' | 'preview';

const DEFAULT_CONSTRAINTS: SchedulingConstraints = {
  avoidBackToBack: true,
  evenDistribution: true,
  maxPeriodsPerDay: 6,
  maxPeriodsPerWeek: null,
  regenerateScope: 'full',
  maxBacktrackSteps: 1000,
  constraintWeights: { idle_gap: 15, teacher_overload: 8, subject_spread: 10 },
};

export const GenerateTimetableDialog = ({ classId, streamId, term, year, onResult, onClose, schoolId, onSchoolResult }: Props) => {
  const [step, setStep] = useState<Step>('config');
  const [scope, setScope] = useState<'class' | 'school'>('class');
  const [constraints, setConstraints] = useState<SchedulingConstraints>({ ...DEFAULT_CONSTRAINTS });
  const [preserveLocked, setPreserveLocked] = useState(true);
  const [seed, setSeed] = useState<string>('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [schoolResult, setSchoolResult] = useState<SchoolGenerationResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setWeight = (key: keyof NonNullable<SchedulingConstraints['constraintWeights']>, value: number) => {
    setConstraints((c) => ({
      ...c,
      constraintWeights: { ...c.constraintWeights!, [key]: value },
    }));
  };

  const handleGenerate = async () => {
    setStep('loading');
    setError(null);
    try {
      const res = await timetableService.generateTimetable(
        classId, streamId, term, year, constraints, preserveLocked
      );
      setResult(res);
      setStep('preview');
    } catch (err: any) {
      const body = err?.context?.data ?? {};
      if (body.feasibilityError) {
        setResult({ slots: [], conflicts: [], unassigned: [], feasibilityError: body.feasibilityError });
        setStep('preview');
      } else {
        setError(err.message ?? 'Generation failed');
        setStep('config');
      }
    }
  };

  const handleSchoolGenerate = async () => {
    if (!schoolId) return;
    setStep('loading');
    setError(null);
    try {
      const parsedSeed = seed.trim() !== '' ? parseInt(seed, 10) : undefined;
      const res = await timetableService.generateSchoolTimetable(
        schoolId, term, year, constraints, preserveLocked, parsedSeed
      );
      setSchoolResult(res);
      setStep('preview');
    } catch (err: any) {
      setError(err.message ?? 'Generation failed');
      setStep('config');
    }
  };

  const handleSaveAll = async () => {
    if (!schoolId || !schoolResult) return;
    setSaving(true);
    setSaveError(null);
    try {
      const generationId = crypto.randomUUID();
      const saved = await timetableService.saveSchoolGeneratedTimetables(
        schoolId, term, year, schoolResult.results, generationId
      );
      onSchoolResult?.(schoolResult);
      onClose();
    } catch (err: any) {
      setSaveError(err.message ?? 'Save failed — all staging rows have been rolled back.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Timetable</DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Config ── */}
        {step === 'config' && (
          <div className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Scope toggle */}
            {schoolId !== undefined && (
              <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/40">
                <Label className="text-sm font-medium">Generation scope</Label>
                <div className="flex gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant={scope === 'class' ? 'default' : 'outline'}
                    onClick={() => setScope('class')}
                  >
                    Single class
                  </Button>
                  <Button
                    size="sm"
                    variant={scope === 'school' ? 'default' : 'outline'}
                    onClick={() => setScope('school')}
                  >
                    Whole school
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="backtoback"
                  checked={constraints.avoidBackToBack}
                  onCheckedChange={(v) => setConstraints((c) => ({ ...c, avoidBackToBack: v }))}
                />
                <Label htmlFor="backtoback">Avoid back-to-back same subject</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="even"
                  checked={constraints.evenDistribution}
                  onCheckedChange={(v) => setConstraints((c) => ({ ...c, evenDistribution: v }))}
                />
                <Label htmlFor="even">Even distribution across days</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Max periods per day</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={constraints.maxPeriodsPerDay}
                  onChange={(e) => setConstraints((c) => ({ ...c, maxPeriodsPerDay: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Regenerate scope</Label>
                <Select
                  value={constraints.regenerateScope}
                  onValueChange={(v: any) => setConstraints((c) => ({ ...c, regenerateScope: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full timetable</SelectItem>
                    <SelectItem value="day">Single day</SelectItem>
                    <SelectItem value="subject">Single subject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="locked" checked={preserveLocked} onCheckedChange={setPreserveLocked} />
              <Label htmlFor="locked">Preserve locked slots</Label>
            </div>

            {/* Advanced */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 text-muted-foreground">
                  Advanced settings <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                <div className="space-y-1">
                  <Label>Max backtrack steps: {constraints.maxBacktrackSteps}</Label>
                  <Input
                    type="number"
                    min={100}
                    max={10000}
                    value={constraints.maxBacktrackSteps}
                    onChange={(e) => setConstraints((c) => ({ ...c, maxBacktrackSteps: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Seed (leave blank for random)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="auto"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Idle gap penalty: {constraints.constraintWeights?.idle_gap}</Label>
                  <Slider
                    min={0} max={50} step={1}
                    value={[constraints.constraintWeights?.idle_gap ?? 15]}
                    onValueChange={([v]) => setWeight('idle_gap', v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Teacher overload penalty: {constraints.constraintWeights?.teacher_overload}</Label>
                  <Slider
                    min={0} max={50} step={1}
                    value={[constraints.constraintWeights?.teacher_overload ?? 8]}
                    onValueChange={([v]) => setWeight('teacher_overload', v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Subject spread penalty: {constraints.constraintWeights?.subject_spread}</Label>
                  <Slider
                    min={0} max={50} step={1}
                    value={[constraints.constraintWeights?.subject_spread ?? 10]}
                    onValueChange={([v]) => setWeight('subject_spread', v)}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={scope === 'school' ? handleSchoolGenerate : handleGenerate}>
                {scope === 'school' ? 'Generate school-wide' : 'Generate'}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Loading ── */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating timetable…</p>
          </div>
        )}

        {/* ── STEP 3: School preview ── */}
        {step === 'preview' && scope === 'school' && schoolResult && (
          <div className="space-y-4">
            {schoolResult.timedOut && (
              <Alert className="border-amber-400 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Generation timed out ({schoolResult.timedOutReason === 'predicted' ? 'predicted overflow' : '50 s elapsed'}).
                  Results shown are partial — some classes may be incomplete.
                </AlertDescription>
              </Alert>
            )}

            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">
              Seed: <code>{schoolResult.seed}</code> &nbsp;·&nbsp; {schoolResult.executionTime} ms
            </p>

            <div className="border rounded overflow-auto max-h-[400px]">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted sticky top-0">
                    <th className="border px-2 py-1 text-left">Class</th>
                    <th className="border px-2 py-1">Feasibility</th>
                    <th className="border px-2 py-1">Filled</th>
                    <th className="border px-2 py-1">Progress</th>
                    <th className="border px-2 py-1">Unassigned</th>
                    <th className="border px-2 py-1">Hard conflicts</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolResult.results.map((r: ClassGenerationResult) => {
                    const pct = r.slotsRequired > 0
                      ? Math.round((r.slotsFilled / r.slotsRequired) * 100)
                      : 0;
                    const hardConflicts = r.conflicts.filter((c) => c.severity === 'hard').length;
                    return (
                      <tr key={`${r.classId}-${r.streamId ?? 'null'}`}>
                        <td className="border px-2 py-1 font-medium">
                          {r.className}{r.streamName ? ` / ${r.streamName}` : ''}
                        </td>
                        <td className="border px-2 py-1 text-center">
                          <Badge
                            variant={r.feasibility === 'ok' ? 'default' : r.feasibility === 'tight' ? 'secondary' : 'destructive'}
                            className={r.feasibility === 'ok' ? 'bg-green-100 text-green-800 border-green-300' : r.feasibility === 'tight' ? 'bg-amber-100 text-amber-800 border-amber-300' : ''}
                          >
                            {r.feasibility}
                          </Badge>
                        </td>
                        <td className="border px-2 py-1 text-center">{r.slotsFilled}/{r.slotsRequired}</td>
                        <td className="border px-2 py-1 w-28">
                          <div className="flex items-center gap-1">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="border px-2 py-1 text-center">
                          {r.unassigned.length > 0
                            ? <span className="text-destructive font-semibold">{r.unassigned.length}</span>
                            : <span className="text-green-600">0</span>}
                        </td>
                        <td className="border px-2 py-1 text-center">
                          {hardConflicts > 0
                            ? <span className="text-destructive font-semibold">{hardConflicts}</span>
                            : <span className="text-green-600">0</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('config')}>Regenerate</Button>
              <Button onClick={handleSaveAll} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save all as Draft'}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Class preview ── */}
        {step === 'preview' && scope === 'class' && result && (
          <div className="space-y-4">
            {result.feasibilityError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Schedule is impossible.</strong> {result.feasibilityError.required} periods required but only {result.feasibilityError.available} slots available.
                  Reduce subjects/periods_per_week or add more periods.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {result.conflicts.length > 0 && (
                  <Alert className="border-amber-300 bg-amber-50">
                    <AlertDescription>
                      {result.conflicts.filter((c) => c.severity === 'hard').length} hard + {result.conflicts.filter((c) => c.severity === 'soft').length} soft conflict(s) detected.
                    </AlertDescription>
                  </Alert>
                )}

                {result.unassigned.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <strong>{result.unassigned.length} subject(s) could not be scheduled:</strong>{' '}
                      {result.unassigned.map((u) => `${u.subject.name} (${u.reason})`).join(', ')}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="border rounded overflow-auto max-h-96">
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border px-2 py-1">Day</th>
                        <th className="border px-2 py-1">Period</th>
                        <th className="border px-2 py-1">Subject</th>
                        <th className="border px-2 py-1">Teacher</th>
                        <th className="border px-2 py-1">Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.slots.map((s) => (
                        <tr key={s.id}>
                          <td className="border px-2 py-1">{['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][s.day_of_week]}</td>
                          <td className="border px-2 py-1">{(s as any).period?.name ?? s.period_id.slice(0, 8)}</td>
                          <td className="border px-2 py-1">{(s as any).subject?.name ?? s.subject_id}</td>
                          <td className="border px-2 py-1">{(s as any).teacher ? `${(s as any).teacher.first_name} ${(s as any).teacher.last_name}` : '—'}</td>
                          <td className="border px-2 py-1">{(s as any).special_room?.name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStep('config')}>Regenerate</Button>
                  <Button onClick={() => onResult(result)}>Save as Draft</Button>
                </div>
              </>
            )}

            {result.feasibilityError && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setStep('config')}>Back to settings</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
