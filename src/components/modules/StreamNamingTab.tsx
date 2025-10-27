import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { streamSettingsService } from '@/services/streamSettingsService';
import { StreamNameSetting } from '@/types/stream-settings';
import { Switch } from '@/components/ui/switch';

export function StreamNamingTab() {
  const [streamNames, setStreamNames] = useState<StreamNameSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [newStreamName, setNewStreamName] = useState('');
  const [newStreamDescription, setNewStreamDescription] = useState('');

  useEffect(() => {
    loadStreamNames();
  }, []);

  const loadStreamNames = async () => {
    setLoading(true);
    try {
      const names = await streamSettingsService.getStreamNames();
      setStreamNames(names);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load stream names');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStreamName = async () => {
    if (!newStreamName.trim()) {
      toast.error('Stream name is required');
      return;
    }

    try {
      await streamSettingsService.createStreamName({
        name: newStreamName.trim(),
        description: newStreamDescription.trim(),
        is_active: true,
        display_order: streamNames.length + 1,
      });

      toast.success('Stream name added successfully');
      setNewStreamName('');
      setNewStreamDescription('');
      loadStreamNames();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add stream name');
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      await streamSettingsService.updateStreamName(id, { is_active: isActive });
      toast.success(isActive ? 'Stream name activated' : 'Stream name deactivated');
      loadStreamNames();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update stream name');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this stream name?')) return;

    try {
      await streamSettingsService.deleteStreamName(id);
      toast.success('Stream name deleted successfully');
      loadStreamNames();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete stream name');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stream Naming Configuration</CardTitle>
          <CardDescription>
            Define uniform stream names (e.g., East, West, North, South) that will be available across all classes.
            These names will appear as options when creating streams for any class.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New Stream Name */}
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stream-name">Stream Name</Label>
                <Input
                  id="stream-name"
                  placeholder="e.g., East, West, A, B"
                  value={newStreamName}
                  onChange={(e) => setNewStreamName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stream-description">Description (Optional)</Label>
                <Input
                  id="stream-description"
                  placeholder="Brief description"
                  value={newStreamDescription}
                  onChange={(e) => setNewStreamDescription(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleAddStreamName} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Stream Name
            </Button>
          </div>

          {/* Existing Stream Names */}
          <div>
            <h3 className="text-sm font-medium mb-3">Configured Stream Names</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : streamNames.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No stream names configured yet. Add your first stream name above.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24">Active</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {streamNames.map((streamName) => (
                    <TableRow key={streamName.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      </TableCell>
                      <TableCell className="font-medium">{streamName.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {streamName.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={streamName.is_active}
                          onCheckedChange={(checked) => handleToggleActive(streamName.id!, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(streamName.id!)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> When creating a stream for any class, you'll be able to select from these
              predefined names. This ensures consistency across your school's stream naming convention.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
