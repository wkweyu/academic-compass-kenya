import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { TermSetting } from '@/types/settings';
import { Plus, Edit, Trash2, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const termSettingSchema = z.object({
  year: z.number().min(2024, 'Year must be 2024 or later'),
  term: z.enum(['1', '2', '3']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
});

type TermSettingFormData = z.infer<typeof termSettingSchema>;

export function TermSettingsTab() {
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState<TermSetting[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermSetting | null>(null);
  const { toast } = useToast();

  const form = useForm<TermSettingFormData>({
    resolver: zodResolver(termSettingSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      term: '1',
      start_date: '',
      end_date: '',
    },
  });

  useEffect(() => {
    loadTermSettings();
  }, []);

  const loadTermSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getTermSettings();
      setTerms(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load term settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTerm = () => {
    setEditingTerm(null);
    form.reset({
      year: new Date().getFullYear(),
      term: '1',
      start_date: '',
      end_date: '',
    });
    setDialogOpen(true);
  };

  const handleEditTerm = (term: TermSetting) => {
    setEditingTerm(term);
    form.reset({
      year: term.year,
      term: term.term.toString() as '1' | '2' | '3',
      start_date: term.start_date,
      end_date: term.end_date,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: TermSettingFormData) => {
    try {
      setLoading(true);
      const termData = {
        year: data.year,
        term: parseInt(data.term) as 1 | 2 | 3,
        start_date: data.start_date,
        end_date: data.end_date,
      };

      if (editingTerm) {
        await settingsService.updateTermSetting(editingTerm.id!, termData);
        toast({
          title: 'Success',
          description: 'Term setting updated successfully',
        });
      } else {
        await settingsService.createTermSetting(termData);
        toast({
          title: 'Success',
          description: 'Term setting created successfully',
        });
      }

      setDialogOpen(false);
      loadTermSettings();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save term setting',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTerm = async (term: TermSetting) => {
    if (!term.id) return;
    
    try {
      setLoading(true);
      await settingsService.deleteTermSetting(term.id);
      toast({
        title: 'Success',
        description: 'Term setting deleted successfully',
      });
      loadTermSettings();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete term setting',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Academic Terms Configuration</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddTerm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Term
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTerm ? 'Edit Term Setting' : 'Add New Term Setting'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Academic Year</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="term"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">Term 1</SelectItem>
                            <SelectItem value="2">Term 2</SelectItem>
                            <SelectItem value="3">Term 3</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingTerm ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading && terms.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={`${term.year}-${term.term}`}>
                  <TableCell className="font-medium">{term.year}</TableCell>
                  <TableCell>Term {term.term}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      {format(new Date(term.start_date), 'MMM dd, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      {format(new Date(term.end_date), 'MMM dd, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {Math.ceil((new Date(term.end_date).getTime() - new Date(term.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7))} weeks
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTerm(term)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTerm(term)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}