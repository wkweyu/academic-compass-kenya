import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CreateActivityPayload, IGAActivity } from '@/services/igaService';

import { IGAActivityDialog } from './IGAActivityDialog';
import { IGATableCard } from './IGATableCard';
import { humanizeLabel } from './igaHelpers';

export function IGAActivitiesTab({
  activities,
  loading,
  submitting,
  onUpdateActivity,
}: {
  activities: IGAActivity[];
  loading: boolean;
  submitting: boolean;
  onUpdateActivity: (activityId: number, payload: CreateActivityPayload) => void | Promise<unknown>;
}) {
  const [search, setSearch] = useState('');
  const [editingActivity, setEditingActivity] = useState<IGAActivity | null>(null);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return activities;
    }
    return activities.filter((item) =>
      [item.name, item.description, item.manager_name, item.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [activities, search]);

  return (
    <>
      <IGATableCard
        title="Activities"
        description="Revenue-generating projects for the school."
        headers={['Name', 'Manager', 'Status', 'Start date', 'Actions']}
        rows={filteredActivities.map((item) => [
          item.name,
          item.manager_name || '—',
          humanizeLabel(item.status),
          item.start_date,
          <Button size="sm" variant="outline" onClick={() => setEditingActivity(item)}>
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>,
        ])}
        emptyText={loading ? 'Loading activities...' : 'No activities created yet.'}
        action={<Input placeholder="Search activities" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full sm:w-64" />}
      />

      <IGAActivityDialog
        open={Boolean(editingActivity)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingActivity(null);
          }
        }}
        activity={editingActivity}
        submitting={submitting}
        onSubmit={async (payload, activityId) => {
          if (!activityId) {
            return;
          }
          await onUpdateActivity(activityId, payload);
          setEditingActivity(null);
        }}
      />
    </>
  );
}
