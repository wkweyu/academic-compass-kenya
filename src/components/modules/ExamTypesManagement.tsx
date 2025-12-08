import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { examManagementService, ExamType } from '@/services/examManagementService';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';

export function ExamTypesManagement() {
  const { toast } = useToast();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExamType | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    loadExamTypes();
  }, []);

  const loadExamTypes = async () => {
    setLoading(true);
    try {
      const data = await examManagementService.getExamTypes();
      setExamTypes(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load exam types',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormIsActive(true);
    setEditingType(null);
  };

  const handleOpenDialog = (type?: ExamType) => {
    if (type) {
      setEditingType(type);
      setFormName(type.name);
      setFormDescription(type.description || '');
      setFormIsActive(type.is_active);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast({
        title: 'Error',
        description: 'Exam type name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingType) {
        await examManagementService.updateExamType(editingType.id, {
          name: formName,
          description: formDescription,
          is_active: formIsActive,
        });
        toast({ title: 'Success', description: 'Exam type updated' });
      } else {
        await examManagementService.createExamType({
          name: formName,
          description: formDescription,
          is_active: formIsActive,
        });
        toast({ title: 'Success', description: 'Exam type created' });
      }
      
      setIsDialogOpen(false);
      resetForm();
      loadExamTypes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save exam type',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await examManagementService.deleteExamType(deleteId);
      toast({ title: 'Success', description: 'Exam type deleted' });
      setDeleteId(null);
      loadExamTypes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete exam type',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (type: ExamType) => {
    try {
      await examManagementService.updateExamType(type.id, {
        is_active: !type.is_active,
      });
      loadExamTypes();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update exam type',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Exam Types
            </CardTitle>
            <CardDescription>
              Configure the types of exams used in your school (CAT, Mid-term, End-term, etc.)
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingType ? 'Edit Exam Type' : 'Add Exam Type'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Continuous Assessment Test (CAT)"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this exam type..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingType ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          </div>
        ) : examTypes.length === 0 ? (
          <div className="text-center py-8">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No exam types configured yet.</p>
            <p className="text-sm text-muted-foreground">Add exam types like CAT, Mid-term, End-term to get started.</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {type.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={type.is_active}
                        onCheckedChange={() => handleToggleActive(type)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(type)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(type.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <DeleteConfirmationDialog
        isOpen={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Exam Type"
        description="Are you sure you want to delete this exam type? This action cannot be undone."
      />
    </Card>
  );
}
