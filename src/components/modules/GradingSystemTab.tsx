import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { GradingSystemSettings } from '@/types/settings';
import { Save, Loader2 } from 'lucide-react';

const gradingSettingsSchema = z.object({
  grading_system: z.enum(['CBC', 'Legacy']),
  pass_mark: z.number().min(1, 'Pass mark must be at least 1').max(100, 'Pass mark cannot exceed 100'),
  grade_boundaries: z.object({
    A: z.number().min(1).max(100),
    B: z.number().min(1).max(100),
    C: z.number().min(1).max(100),
    D: z.number().min(1).max(100),
    E: z.number().min(1).max(100),
  }),
});

type GradingSettingsFormData = z.infer<typeof gradingSettingsSchema>;

export function GradingSystemTab() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<GradingSystemSettings | null>(null);
  const { toast } = useToast();

  const form = useForm<GradingSettingsFormData>({
    resolver: zodResolver(gradingSettingsSchema),
    defaultValues: {
      grading_system: 'CBC',
      pass_mark: 50,
      grade_boundaries: {
        A: 80,
        B: 70,
        C: 60,
        D: 50,
        E: 40,
      },
    },
  });

  useEffect(() => {
    loadGradingSettings();
  }, []);

  const loadGradingSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getGradingSettings();
      setSettings(data);
      form.reset(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load grading settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: GradingSettingsFormData) => {
    try {
      setLoading(true);
      const settingsData: GradingSystemSettings = {
        grading_system: data.grading_system,
        pass_mark: data.pass_mark,
        grade_boundaries: {
          A: data.grade_boundaries.A,
          B: data.grade_boundaries.B,
          C: data.grade_boundaries.C,
          D: data.grade_boundaries.D,
          E: data.grade_boundaries.E,
        },
      };
      await settingsService.updateGradingSettings(settingsData);
      toast({
        title: 'Success',
        description: 'Grading system settings updated successfully',
      });
      loadGradingSettings();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update grading settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (preset: string) => {
    if (preset === 'CBC') {
      form.setValue('grade_boundaries', {
        A: 80,
        B: 70,
        C: 60,
        D: 50,
        E: 40,
      });
      form.setValue('pass_mark', 50);
    } else if (preset === 'Legacy') {
      form.setValue('grade_boundaries', {
        A: 80,
        B: 70,
        C: 60,
        D: 50,
        E: 40,
      });
      form.setValue('pass_mark', 50);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grading System Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="grading_system"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grading System</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        handlePresetChange(value);
                      }} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grading system" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CBC">Competency-Based Curriculum (CBC)</SelectItem>
                        <SelectItem value="Legacy">Legacy System (8-4-4)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the grading system used by your school
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pass_mark"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pass Mark (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum score required to pass
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Grade Boundaries</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                {(['A', 'B', 'C', 'D', 'E'] as const).map((grade) => (
                  <FormField
                    key={grade}
                    control={form.control}
                    name={`grade_boundaries.${grade}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade {grade} (%)</FormLabel>
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
                ))}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grade</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Performance Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">A</TableCell>
                    <TableCell>{form.watch('grade_boundaries.A')}% - 100%</TableCell>
                    <TableCell>Exceeds Expectations</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">B</TableCell>
                    <TableCell>{form.watch('grade_boundaries.B')}% - {form.watch('grade_boundaries.A') - 1}%</TableCell>
                    <TableCell>Meets Expectations</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">C</TableCell>
                    <TableCell>{form.watch('grade_boundaries.C')}% - {form.watch('grade_boundaries.B') - 1}%</TableCell>
                    <TableCell>Approaching Expectations</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">D</TableCell>
                    <TableCell>{form.watch('grade_boundaries.D')}% - {form.watch('grade_boundaries.C') - 1}%</TableCell>
                    <TableCell>Below Expectations</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">E</TableCell>
                    <TableCell>0% - {form.watch('grade_boundaries.D') - 1}%</TableCell>
                    <TableCell>Well Below Expectations</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={loadGradingSettings}
                disabled={loading}
              >
                Reset
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}