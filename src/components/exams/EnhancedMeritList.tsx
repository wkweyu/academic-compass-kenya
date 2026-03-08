import { useState } from 'react';
import { escapeHtml } from '@/utils/escapeHtml';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, Printer, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { examSessionService } from '@/services/examSessionService';
import { ExamSessionClass, CBC_GRADES } from '@/types/exam-management';

interface EnhancedMeritListProps {
  sessionId: number;
  classes: ExamSessionClass[];
}

export function EnhancedMeritList({ sessionId, classes }: EnhancedMeritListProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('all');
  const [viewType, setViewType] = useState<'class' | 'stream'>('class');

  // Fetch streams for selected class
  const { data: streams = [] } = useQuery({
    queryKey: ['class-streams', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return [];
      const { data } = await supabase
        .from('streams')
        .select('id, name')
        .eq('class_assigned_id', parseInt(selectedClassId))
        .order('name');
      return data || [];
    },
    enabled: !!selectedClassId,
  });

  // Fetch merit list
  const { data: meritList = [], isLoading } = useQuery({
    queryKey: ['enhanced-merit-list', sessionId, selectedClassId, selectedStreamId, viewType],
    queryFn: async () => {
      if (!selectedClassId) return [];
      
      let query = supabase
        .from('student_exam_results')
        .select(`
          *,
          student:students(admission_number, full_name),
          class:classes(name),
          stream:streams(name)
        `)
        .eq('exam_session_id', sessionId)
        .eq('class_id', parseInt(selectedClassId));

      if (selectedStreamId !== 'all') {
        query = query.eq('stream_id', parseInt(selectedStreamId));
      }

      // Order by stream or class position
      if (viewType === 'stream' && selectedStreamId !== 'all') {
        query = query.order('stream_position');
      } else {
        query = query.order('class_position');
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any) => ({
        position: viewType === 'stream' && selectedStreamId !== 'all' ? r.stream_position : r.class_position,
        student_id: r.student_id,
        admission_number: r.student?.admission_number || '',
        full_name: r.student?.full_name || '',
        class_name: r.class?.name || '',
        stream_name: r.stream?.name || null,
        total_marks: r.total_marks,
        total_possible: r.total_possible,
        percentage: r.average_percentage,
        average_points: r.average_points,
        overall_grade: r.overall_grade,
        subjects_count: r.subjects_count,
        stream_position: r.stream_position,
        class_position: r.class_position,
      }));
    },
    enabled: !!selectedClassId,
  });

  // Calculate class statistics
  const statistics = {
    totalStudents: meritList.length,
    averageScore: meritList.length > 0 
      ? (meritList.reduce((sum, s) => sum + s.percentage, 0) / meritList.length).toFixed(1)
      : 0,
    gradeDistribution: meritList.reduce((acc, s) => {
      acc[s.overall_grade] = (acc[s.overall_grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    topPerformer: meritList[0],
  };

  const handleExport = async () => {
    const headers = ['Position', 'Adm No.', 'Student Name', 'Class', 'Stream', 'Total', 'Percentage', 'Avg Points', 'Grade'];
    const rows = meritList.map(entry => [
      entry.position || '-',
      entry.admission_number,
      entry.full_name,
      entry.class_name,
      entry.stream_name || '',
      `${entry.total_marks}/${entry.total_possible}`,
      `${entry.percentage.toFixed(1)}%`,
      entry.average_points.toFixed(2),
      entry.overall_grade,
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merit-list-${viewType}-${selectedClassId}.csv`;
    a.click();
  };

  const handlePrint = () => {
    const selectedClassName = classes.find(c => c.class_id.toString() === selectedClassId)?.class_name || '';
    const streamName = streams.find(s => s.id.toString() === selectedStreamId)?.name || '';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Merit List - ${escapeHtml(selectedClassName)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 5px; }
            h2 { text-align: center; color: #666; margin-top: 5px; font-weight: normal; }
            .stats { display: flex; gap: 20px; justify-content: center; margin: 20px 0; }
            .stat { text-align: center; padding: 10px 20px; background: #f5f5f5; border-radius: 8px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #333; }
            .stat-label { font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: 600; }
            .position { font-weight: bold; text-align: center; }
            .grade { font-weight: bold; text-align: center; padding: 2px 8px; border-radius: 4px; }
            .grade-ee { background: #d4edda; color: #155724; }
            .grade-me { background: #cce5ff; color: #004085; }
            .grade-ae { background: #fff3cd; color: #856404; }
            .grade-be { background: #f8d7da; color: #721c24; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>${viewType === 'stream' ? 'Stream' : 'Class'} Merit List</h1>
          <h2>${escapeHtml(selectedClassName)}${streamName ? ` - ${escapeHtml(streamName)}` : ''}</h2>
          
          <div class="stats">
            <div class="stat">
              <div class="stat-value">${statistics.totalStudents}</div>
              <div class="stat-label">STUDENTS</div>
            </div>
            <div class="stat">
              <div class="stat-value">${statistics.averageScore}%</div>
              <div class="stat-label">CLASS AVERAGE</div>
            </div>
            <div class="stat">
              <div class="stat-value">${escapeHtml(statistics.topPerformer?.full_name || '-')}</div>
              <div class="stat-label">TOP PERFORMER</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">Pos</th>
                <th>Adm No.</th>
                <th>Student Name</th>
                ${viewType === 'class' ? '<th>Stream</th>' : ''}
                <th style="text-align: right;">Total</th>
                <th style="text-align: right;">%</th>
                <th style="text-align: right;">Points</th>
                <th style="text-align: center;">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${meritList.map(entry => `
                <tr>
                  <td class="position">${entry.position || '-'}</td>
                  <td>${entry.admission_number}</td>
                  <td>${entry.full_name}</td>
                  ${viewType === 'class' ? `<td>${entry.stream_name || '-'}</td>` : ''}
                  <td style="text-align: right;">${entry.total_marks}/${entry.total_possible}</td>
                  <td style="text-align: right;">${entry.percentage.toFixed(1)}%</td>
                  <td style="text-align: right;">${entry.average_points.toFixed(2)}</td>
                  <td style="text-align: center;"><span class="grade grade-${entry.overall_grade.toLowerCase()}">${entry.overall_grade}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <p style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
            Generated on ${new Date().toLocaleDateString()}
          </p>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Class & Stream Merit List
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'class' | 'stream')} className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="class" className="text-xs px-3 h-7">Class View</TabsTrigger>
                  <TabsTrigger value="stream" className="text-xs px-3 h-7">Stream View</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedStreamId('all'); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.class_id} value={c.class_id.toString()}>{c.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {viewType === 'stream' && streams.length > 0 && (
              <Select value={selectedStreamId} onValueChange={setSelectedStreamId}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select stream" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Streams</SelectItem>
                  {streams.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedClassId && (
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {selectedClassId && meritList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{statistics.totalStudents}</p>
              <p className="text-xs text-muted-foreground">Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{statistics.averageScore}%</p>
              <p className="text-xs text-muted-foreground">Class Average</p>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Grade Distribution</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(CBC_GRADES).map(([grade, info]) => (
                  <Badge key={grade} variant="outline" className={info.color}>
                    {grade}: {statistics.gradeDistribution[grade] || 0}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Merit List Table */}
      <Card>
        <CardContent className="p-0">
          {!selectedClassId ? (
            <p className="text-center text-muted-foreground py-12">Select a class to view merit list</p>
          ) : isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : meritList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No results computed yet</p>
              <p className="text-sm">Submit marks and compute results first</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">Pos</TableHead>
                    <TableHead>Student</TableHead>
                    {viewType === 'class' && <TableHead>Stream</TableHead>}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Avg %</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meritList.map((entry, idx) => {
                    const gradeInfo = CBC_GRADES[entry.overall_grade as keyof typeof CBC_GRADES];
                    const isTop3 = entry.position && entry.position <= 3;
                    return (
                      <TableRow key={entry.student_id} className={isTop3 ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                            entry.position === 1 ? 'bg-amber-500 text-white' :
                            entry.position === 2 ? 'bg-slate-400 text-white' :
                            entry.position === 3 ? 'bg-amber-700 text-white' :
                            'bg-muted'
                          }`}>
                            {entry.position || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.full_name}</p>
                            <p className="text-sm text-muted-foreground">{entry.admission_number}</p>
                          </div>
                        </TableCell>
                        {viewType === 'class' && (
                          <TableCell>
                            {entry.stream_name ? (
                              <Badge variant="outline">{entry.stream_name}</Badge>
                            ) : '-'}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-mono">
                          {entry.total_marks}/{entry.total_possible}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {entry.percentage.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.average_points.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${gradeInfo?.bgColor} ${gradeInfo?.color}`}>
                            {entry.overall_grade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
