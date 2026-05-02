import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { AcademicYearSetting } from '@/types/settings';
import { CheckCircle, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export function AcademicYearTab() {
  const [loading, setLoading] = useState(false);
  const [academicYears, setAcademicYears] = useState<AcademicYearSetting[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadAcademicYears();
  }, []);

  const loadAcademicYears = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getAcademicYears();
      setAcademicYears(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load academic years',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrentYear = async (yearId: number) => {
    try {
      setLoading(true);
      await settingsService.setCurrentAcademicYear(yearId);
      toast({
        title: 'Success',
        description: 'Current academic year updated successfully',
      });
      loadAcademicYears();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update current academic year',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic Year Management</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && academicYears.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Academic Year</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {academicYears.map((year) => (
                <TableRow key={year.id}>
                  <TableCell className="font-medium">{year.year}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      {format(new Date(year.start_date), 'MMM dd, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      {format(new Date(year.end_date), 'MMM dd, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {year.is_current ? (
                      <Badge variant="default" className="flex items-center w-fit">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Current
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!year.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetCurrentYear(year.id!)}
                        disabled={loading}
                      >
                        Set as Current
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Academic Year Information</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• The current academic year is used for all academic operations</li>
            <li>• Only one academic year can be active at a time</li>
            <li>• Term settings are linked to academic years</li>
            <li>• Changing the current year affects fee generation and reporting</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}