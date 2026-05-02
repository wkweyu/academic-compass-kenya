import { useState } from 'react';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { subjectService } from '@/services/subjectService';
import { SubjectCategory } from '@/types/subject';

interface SubjectCategoriesTabProps {
  categories: SubjectCategory[];
  onRefresh: () => void;
}

const SubjectCategoriesTab = ({ categories, onRefresh }: SubjectCategoriesTabProps) => {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SubjectCategory | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    is_active: true,
    display_order: 0
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" });
      return;
    }

    try {
      const { data: schoolId } = await (await import('@/integrations/supabase/client')).supabase.rpc('get_user_school_id');
      
      await subjectService.createCategory({
        name: form.name.trim(),
        description: form.description || null,
        is_active: form.is_active,
        display_order: form.display_order,
        school_id: schoolId
      });
      
      toast({ title: "Success", description: "Category created successfully" });
      setIsCreateOpen(false);
      resetForm();
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedCategory || !form.name.trim()) return;

    try {
      await subjectService.updateCategory(selectedCategory.id, {
        name: form.name.trim(),
        description: form.description || null,
        is_active: form.is_active,
        display_order: form.display_order
      });
      
      toast({ title: "Success", description: "Category updated successfully" });
      setIsEditOpen(false);
      setSelectedCategory(null);
      resetForm();
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (category: SubjectCategory) => {
    if (!window.confirm(`Delete category "${category.name}"? Subjects in this category will become uncategorized.`)) {
      return;
    }

    try {
      await subjectService.deleteCategory(category.id);
      toast({ title: "Success", description: "Category deleted successfully" });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (category: SubjectCategory) => {
    setSelectedCategory(category);
    setForm({
      name: category.name,
      description: category.description || '',
      is_active: category.is_active,
      display_order: category.display_order
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      is_active: true,
      display_order: categories.length
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subject Categories</CardTitle>
            <CardDescription>Organize subjects into logical groups</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Category</DialogTitle>
                <DialogDescription>Add a new subject category.</DialogDescription>
              </DialogHeader>
              <CategoryForm form={form} setForm={setForm} onSubmit={handleCreate} onCancel={() => setIsCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No categories found. Create one to organize your subjects.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        {category.display_order}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {category.description || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(category)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(category)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category information.</DialogDescription>
          </DialogHeader>
          <CategoryForm 
            form={form} 
            setForm={setForm} 
            onSubmit={handleEdit} 
            onCancel={() => { setIsEditOpen(false); setSelectedCategory(null); }} 
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

interface CategoryFormProps {
  form: any;
  setForm: (form: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const CategoryForm = ({ form, setForm, onSubmit, onCancel }: CategoryFormProps) => (
  <div className="grid gap-4 py-4">
    <div className="grid gap-2">
      <Label htmlFor="category-name">Name *</Label>
      <Input
        id="category-name"
        value={form.name}
        onChange={(e) => setForm((prev: any) => ({ ...prev, name: e.target.value }))}
        placeholder="e.g., Sciences, Languages"
      />
    </div>
    
    <div className="grid gap-2">
      <Label htmlFor="category-description">Description</Label>
      <Textarea
        id="category-description"
        value={form.description}
        onChange={(e) => setForm((prev: any) => ({ ...prev, description: e.target.value }))}
        placeholder="Optional description"
        rows={2}
      />
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="grid gap-2">
        <Label htmlFor="display-order">Display Order</Label>
        <Input
          id="display-order"
          type="number"
          value={form.display_order}
          onChange={(e) => setForm((prev: any) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
        />
      </div>
      
      <div className="flex items-center space-x-2 pt-6">
        <Switch
          id="category-active"
          checked={form.is_active}
          onCheckedChange={(checked) => setForm((prev: any) => ({ ...prev, is_active: checked }))}
        />
        <Label htmlFor="category-active">Active</Label>
      </div>
    </div>
    
    <div className="flex gap-2 pt-4">
      <Button onClick={onSubmit} className="flex-1">Save Category</Button>
      <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
    </div>
  </div>
);

export default SubjectCategoriesTab;
