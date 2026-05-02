import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { examSessionService } from '@/services/examSessionService';
import { ExamSessionClass, CBC_GRADES } from '@/types/exam-management';

interface SubjectAnalysisViewProps {
  sessionId: number;
  classes: ExamSessionClass[];
}

export function SubjectAnalysisView({ sessionId, classes }: SubjectAnalysisViewProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const { data: analysis = [], isLoading } = useQuery({
    queryKey: ['subject-analysis', sessionId, selectedClassId],
    queryFn: () => examSessionService.getSubjectAnalysis(sessionId, parseInt(selectedClassId)),
    enabled: !!selectedClassId,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subject Performance Analysis</CardTitle>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.class_id} value={c.class_id.toString()}>{c.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedClassId ? (
          <p className="text-center text-muted-foreground py-8">Select a class to view analysis</p>
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : analysis.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No exam papers found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead className="text-right">High</TableHead>
                <TableHead className="text-right">Low</TableHead>
                <TableHead>Grade Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.map((item) => (
                <TableRow key={item.subject_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.subject_name}</p>
                      <p className="text-sm text-muted-foreground">{item.paper_name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{item.class_average}</TableCell>
                  <TableCell className="text-right text-green-600">{item.highest_score}</TableCell>
                  <TableCell className="text-right text-red-600">{item.lowest_score}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {Object.entries(item.grade_distribution).map(([grade, count]) => {
                        const info = CBC_GRADES[grade as keyof typeof CBC_GRADES];
                        return count > 0 ? (
                          <Badge key={grade} variant="outline" className={info?.color}>
                            {grade}: {count}
                          </Badge>
                        ) : null;
                      })}
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
