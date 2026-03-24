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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { TermSetting } from '@/types/settings';
import { Plus, Edit, Trash2, Loader2, Calendar, CalendarDays } from 'lucide-react';
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
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b border-border/70 bg-background/70 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Academic Terms Configuration</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">Manage term windows used across attendance, fees, exams, and student operations.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddTerm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Term
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTerm ? 'Edit Term Setting' : 'Add New Term Setting'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col overflow-hidden">
                <div className="erp-modal-body space-y-6">
                <section className="erp-form-section">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" /> Term Window
                </div>
                <div className="erp-form-grid">
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

                <div className="erp-form-grid">
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

                <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Use real term dates so dashboards, attendance, fees, and exam scheduling reflect the active academic period accurately.
                </div>
                </section>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingTerm ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Configured Terms</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{terms.length}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Latest Year</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{terms[0]?.year || 'None'}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next Action</p>
            <p className="mt-2 text-lg font-bold text-foreground">{terms.length ? 'Review dates' : 'Add first term'}</p>
          </div>
        </div>
        {loading && terms.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : terms.length === 0 ? (
          <div className="erp-muted-panel flex flex-col items-center justify-center px-6 py-12 text-center">
            <CalendarDays className="h-8 w-8 text-primary" />
            <p className="mt-4 text-base font-semibold text-foreground">No academic terms configured</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Add the current term dates first so operational modules can align with the active school calendar.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}