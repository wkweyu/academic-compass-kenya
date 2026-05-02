import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CreateActivityPayload, IGAActivity } from '@/services/igaService';

import { IGAFormField } from './IGAFormField';
import { today } from './igaHelpers';

const defaultActivityForm: CreateActivityPayload = {
  name: '',
  description: '',
  start_date: today,
  status: 'active',
};

export function IGAActivityDialog({
  open,
  onOpenChange,
  activity,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: IGAActivity | null;
  submitting: boolean;
  onSubmit: (payload: CreateActivityPayload, activityId?: number) => void | Promise<unknown>;
}) {
  const [form, setForm] = useState<CreateActivityPayload>(defaultActivityForm);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (activity) {
      setForm({
        name: activity.name,
        description: activity.description || '',
        start_date: activity.start_date,
        status: activity.status,
      });
      return;
    }

    setForm(defaultActivityForm);
  }, [activity, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{activity ? 'Edit activity' : 'Create activity'}</DialogTitle>
          <DialogDescription>
            {activity ? 'Update project details for this IGA activity.' : 'Set up a new income-generating project.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <IGAFormField label="Activity name">
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </IGAFormField>
          <IGAFormField label="Description">
            <Textarea value={form.description || ''} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </IGAFormField>
          <IGAFormField label="Start date">
            <Input type="date" value={form.start_date || today} onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))} />
          </IGAFormField>
        </div>
        <DialogFooter>
          <Button onClick={() => onSubmit(form, activity?.id)} disabled={submitting}>
            {submitting ? 'Saving...' : activity ? 'Update activity' : 'Create activity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
