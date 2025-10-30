import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export function AttendanceModule() {
  const [selectedDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>('');

  // Fetch classes
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('grade_level');
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Attendance Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Date and Class</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'PPP')}
                </Button>
              </div>

              <div>
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {selectedClass && (
            <div className="mt-6 p-6 bg-muted rounded-lg text-center">
              <p className="text-lg">
                Attendance marking for <strong>{classes.find((c: any) => c.id.toString() === selectedClass)?.name}</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                on {format(selectedDate, 'MMMM d, yyyy')}
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Full attendance functionality will be added next.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
