import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { examSessionService } from '@/services/examSessionService';
import { ExamSessionClass, CBC_GRADES } from '@/types/exam-management';

interface ClassMeritListProps {
  sessionId: number;
  classes: ExamSessionClass[];
}

export function ClassMeritList({ sessionId, classes }: ClassMeritListProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const { data: meritList = [], isLoading } = useQuery({
    queryKey: ['class-merit-list', sessionId, selectedClassId],
    queryFn: () => examSessionService.getClassMeritList(sessionId, parseInt(selectedClassId)),
    enabled: !!selectedClassId,
  });

  const handleExport = async () => {
    const blob = await examSessionService.exportMeritList(sessionId, parseInt(selectedClassId));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merit-list-${selectedClassId}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Class Merit List</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.class_id} value={c.class_id.toString()}>{c.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClassId && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />Export
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedClassId ? (
          <p className="text-center text-muted-foreground py-8">Select a class to view merit list</p>
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : meritList.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No results computed yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Pos</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Avg %</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meritList.map((entry) => {
                const gradeInfo = CBC_GRADES[entry.overall_grade as keyof typeof CBC_GRADES];
                return (
                  <TableRow key={entry.student_id}>
                    <TableCell className="font-bold">{entry.position}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{entry.full_name}</p>
                        <p className="text-sm text-muted-foreground">{entry.admission_number}</p>
                      </div>
                    </TableCell>
                    <TableCell>{entry.stream_name || '-'}</TableCell>
                    <TableCell className="text-right">{entry.total_marks}/{entry.total_possible}</TableCell>
                    <TableCell className="text-right">{entry.percentage.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{entry.average_points.toFixed(2)}</TableCell>
                    <TableCell>
                      {gradeInfo && <Badge className={gradeInfo.bgColor + ' ' + gradeInfo.color}>{entry.overall_grade}</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
