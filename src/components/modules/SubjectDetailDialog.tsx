import { useState, useEffect } from 'react';
import { Users, FolderOpen, FileText, BookOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { subjectService } from '@/services/subjectService';
import { Subject, ClassSubject } from '@/types/subject';

interface SubjectDetailDialogProps {
  subject: Subject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TeacherSpecialization {
  id: number;
  proficiency_level: string;
  is_primary: boolean;
  years_experience: number;
  teacher: {
    id: number;
    first_name: string;
    last_name: string;
    employee_no: string;
    email: string;
    phone: string;
    is_active: boolean;
  };
}

const SubjectDetailDialog = ({ subject, open, onOpenChange }: SubjectDetailDialogProps) => {
  const [teachers, setTeachers] = useState<TeacherSpecialization[]>([]);
  const [classAllocations, setClassAllocations] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && subject) {
      loadDetails();
    }
  }, [open, subject]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [teacherData, allocationData] = await Promise.all([
        subjectService.getTeachersForSubject(subject.id),
        subjectService.getClassSubjects(undefined, subject.id)
      ]);
      
      setTeachers(teacherData);
      setClassAllocations(allocationData);
    } catch (error) {
      console.error('Error loading subject details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatGradeLevels = (grades: number[]): string => {
    if (!grades || grades.length === 0) return 'Not specified';
    const sorted = [...grades].sort((a, b) => a - b);
    if (sorted.length === 1) return `Grade ${sorted[0]}`;
    
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `Grade ${start}` : `Grades ${start}-${end}`);
        if (i < sorted.length) {
          start = sorted[i];
          end = sorted[i];
        }
      }
    }
    
    return ranges.join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <BookOpen className="h-6 w-6" />
            <div>
              <span className="text-xl">{subject.name}</span>
              <Badge variant="outline" className="ml-2">{subject.code}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Subject Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Type</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={subject.is_core ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                  {subject.is_core ? 'Core' : 'Elective'}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={subject.is_active ? 'default' : 'secondary'}>
                  {subject.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Classes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xl font-bold">{classAllocations.length}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Teachers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xl font-bold">{teachers.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Description & Grade Levels */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Grade Levels</h4>
              <p className="text-muted-foreground">
                {formatGradeLevels(subject.grade_levels)}
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Category</h4>
              <p className="text-muted-foreground">
                {subject.category ? (subject.category as any).name : 'Uncategorized'}
              </p>
            </div>
          </div>

          {subject.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-muted-foreground">{subject.description}</p>
            </div>
          )}

          {/* Teachers & Classes Tabs */}
          <Tabs defaultValue="teachers" className="w-full">
            <TabsList>
              <TabsTrigger value="teachers">
                <Users className="h-4 w-4 mr-2" />
                Teachers ({teachers.length})
              </TabsTrigger>
              <TabsTrigger value="classes">
                <FolderOpen className="h-4 w-4 mr-2" />
                Classes ({classAllocations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="teachers">
              {loading ? (
                <div className="text-center py-4">Loading...</div>
              ) : teachers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No teachers assigned to this subject.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Employee No</TableHead>
                        <TableHead>Proficiency</TableHead>
                        <TableHead>Experience</TableHead>
                        <TableHead>Primary</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teachers.map((spec) => (
                        <TableRow key={spec.id}>
                          <TableCell className="font-medium">
                            {spec.teacher.first_name} {spec.teacher.last_name}
                          </TableCell>
                          <TableCell>{spec.teacher.employee_no}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{spec.proficiency_level || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>{spec.years_experience || 0} years</TableCell>
                          <TableCell>
                            {spec.is_primary && <Badge>Primary</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={spec.teacher.is_active ? 'default' : 'secondary'}>
                              {spec.teacher.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="classes">
              {loading ? (
                <div className="text-center py-4">Loading...</div>
              ) : classAllocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  This subject is not allocated to any class.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Grade Level</TableHead>
                        <TableHead>Assigned Teacher</TableHead>
                        <TableHead>Periods/Week</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classAllocations.map((alloc) => (
                        <TableRow key={alloc.id}>
                          <TableCell className="font-medium">{alloc.class?.name}</TableCell>
                          <TableCell>Grade {alloc.class?.grade_level}</TableCell>
                          <TableCell>
                            {alloc.teacher ? (
                              `${alloc.teacher.first_name} ${alloc.teacher.last_name}`
                            ) : (
                              <span className="text-muted-foreground">Not assigned</span>
                            )}
                          </TableCell>
                          <TableCell>{alloc.periods_per_week || 3}</TableCell>
                          <TableCell>
                            <Badge variant={alloc.is_active ? 'default' : 'secondary'}>
                              {alloc.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubjectDetailDialog;
