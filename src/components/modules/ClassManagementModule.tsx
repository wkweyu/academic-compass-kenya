import { useState, useEffect } from 'react';
import { Plus, Search, Users, BookOpen, Settings, TrendingUp, Filter, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Class, Stream, ClassStats, ClassFilters, StreamFilters, CLASS_GROUPS } from '@/types/class';
import { classService } from '@/services/classService';
import { streamSettingsService } from '@/services/streamSettingsService';
import { StreamNameSetting } from '@/types/stream-settings';
import { api } from '@/api/api';

export const ClassManagementModule = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamNames, setStreamNames] = useState<StreamNameSetting[]>([]);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<ClassFilters>({});
  const [streamFilters, setStreamFilters] = useState<StreamFilters>({});
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [isCreateStreamOpen, setIsCreateStreamOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);

  // Form states
  const [classForm, setClassForm] = useState({
    name: '',
    grade_level: 1,
    description: ''
  });
  
  const [streamForm, setStreamForm] = useState({
    name: '',
    class_assigned: '',
    year: new Date().getFullYear(),
    capacity: 40,
    class_teacher: '',
    status: 'active' as const
  });

  useEffect(() => {
    loadData();
  }, [filters, streamFilters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [classData, streamData, statsData, streamNamesData, teachersData, studentsData] = await Promise.all([
        classService.getClasses(filters),
        classService.getStreams(streamFilters),
        classService.getClassStats(),
        streamSettingsService.getStreamNames(),
        api.get('/teachers/').then((res: any) => res.data.results || []).catch(() => []),
        api.get('/students/').then((res: any) => res.data.results || []).catch(() => [])
      ]);
      
      setClasses(classData);
      setStreams(streamData);
      setStats(statsData);
      setStreamNames(streamNamesData);
      setTeachers(teachersData);
      setStudents(studentsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load class data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!classForm.name.trim()) {
      toast({
        title: "Error",
        description: "Class name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await classService.createClass({
        name: classForm.name.trim(),
        grade_level: classForm.grade_level,
        description: classForm.description
      });
      
      toast({
        title: "Success",
        description: "Class created successfully",
      });
      
      setIsCreateClassOpen(false);
      setClassForm({ name: '', grade_level: 1, description: '' });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create class",
        variant: "destructive",
      });
    }
  };

  const handleCreateStream = async () => {
    if (!streamForm.name.trim() || !streamForm.class_assigned) {
      toast({
        title: "Error",
        description: "Stream name and class are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await classService.createStream({
        name: streamForm.name.trim(),
        class_assigned: streamForm.class_assigned,
        year: streamForm.year,
        capacity: streamForm.capacity,
        status: streamForm.status
      });
      
      toast({
        title: "Success",
        description: "Stream created successfully",
      });
      
      setIsCreateStreamOpen(false);
      setStreamForm({
        name: '',
        class_assigned: '',
        year: new Date().getFullYear(),
        capacity: 40,
        class_teacher: '',
        status: 'active'
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create stream",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm('Are you sure you want to delete this class? This will also delete all associated streams.')) {
      return;
    }

    try {
      await classService.deleteClass(classId);
      toast({
        title: "Success",
        description: "Class deleted successfully",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete class. It may have students assigned to it.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStream = async (streamId: string) => {
    if (!window.confirm('Are you sure you want to delete this stream?')) {
      return;
    }

    try {
      await classService.deleteStream(streamId);
      toast({
        title: "Success",
        description: "Stream deleted successfully",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stream. It may have students assigned to it.",
        variant: "destructive",
      });
    }
  };

  const handleAssignTeacher = async (teacherId: string) => {
    if (!selectedStream) return;

    try {
      await api.patch(`/students/streams/${selectedStream.id}/`, {
        class_teacher: teacherId
      });
      
      toast({
        title: "Success",
        description: "Class teacher assigned successfully",
      });
      
      setIsAssignTeacherOpen(false);
      setSelectedStream(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign teacher",
        variant: "destructive",
      });
    }
  };

  const getClassGroupLabel = (gradeLevel: number) => {
    const group = CLASS_GROUPS.find(g => g.levels.includes(gradeLevel));
    return group?.label || 'Other';
  };

  const getCapacityColor = (enrollment: number, capacity: number) => {
    const ratio = enrollment / capacity;
    if (ratio >= 0.9) return 'bg-red-100 text-red-800';
    if (ratio >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Management</h1>
          <p className="text-muted-foreground">
            Manage classes, streams, and student allocations
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isCreateStreamOpen} onOpenChange={setIsCreateStreamOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Stream
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Stream</DialogTitle>
                <DialogDescription>
                  Add a new stream to an existing class.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="stream-name">Stream Name</Label>
                  <Select
                    value={streamForm.name}
                    onValueChange={(value) => setStreamForm(prev => ({ ...prev, name: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stream name" />
                    </SelectTrigger>
                    <SelectContent>
                      {streamNames.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No stream names configured. Please add stream names in Settings.
                        </div>
                      ) : (
                        streamNames.map((streamName) => (
                          <SelectItem key={streamName.id} value={streamName.name}>
                            {streamName.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stream-class">Class</Label>
                  <Select
                    value={streamForm.class_assigned}
                    onValueChange={(value) => setStreamForm(prev => ({ ...prev, class_assigned: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="stream-year">Academic Year</Label>
                    <Input
                      id="stream-year"
                      type="number"
                      value={streamForm.year}
                      onChange={(e) => setStreamForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="stream-capacity">Capacity</Label>
                    <Input
                      id="stream-capacity"
                      type="number"
                      value={streamForm.capacity}
                      onChange={(e) => setStreamForm(prev => ({ ...prev, capacity: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                <Button onClick={handleCreateStream} className="w-full">
                  Create Stream
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateClassOpen} onOpenChange={setIsCreateClassOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
                <DialogDescription>
                  Add a new class to your school.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="class-name">Class Name</Label>
                  <Input
                    id="class-name"
                    value={classForm.name}
                    onChange={(e) => setClassForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Grade 1, Form 2"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grade-level">Grade Level</Label>
                  <Input
                    id="grade-level"
                    type="number"
                    min="1"
                    max="12"
                    value={classForm.grade_level}
                    onChange={(e) => setClassForm(prev => ({ ...prev, grade_level: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="class-description">Description</Label>
                  <Textarea
                    id="class-description"
                    value={classForm.description}
                    onChange={(e) => setClassForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>
                <Button onClick={handleCreateClass} className="w-full">
                  Create Class
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_classes}</div>
              <p className="text-xs text-muted-foreground">
                Across all grade levels
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_streams}</div>
              <p className="text-xs text-muted-foreground">
                Active streams
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_students_enrolled}</div>
              <p className="text-xs text-muted-foreground">
                Currently enrolled
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity Used</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.capacity_utilization}%</div>
              <p className="text-xs text-muted-foreground">
                Average utilization
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="classes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="streams">Streams</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Classes</CardTitle>
              <CardDescription>Manage your school classes and grade levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search classes..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="max-w-sm"
                  />
                </div>
                <Select
                  value={filters.grade_level?.toString() || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    grade_level: value === 'all' ? undefined : parseInt(value) 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Grade Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grade Levels</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        Grade {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Classes Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class Name</TableHead>
                    <TableHead>Grade Level</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Streams</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((cls) => (
                    <TableRow key={cls.id}>
                      <TableCell className="font-medium">{cls.name}</TableCell>
                      <TableCell>{cls.grade_level}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getClassGroupLabel(cls.grade_level)}
                        </Badge>
                      </TableCell>
                      <TableCell>{cls.total_streams || 0}</TableCell>
                      <TableCell>{cls.total_students || 0}</TableCell>
                      <TableCell>
                        <Badge className={getCapacityColor(cls.total_students || 0, cls.capacity || 0)}>
                          {cls.total_students || 0}/{cls.capacity || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteClass(cls.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="streams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Streams</CardTitle>
              <CardDescription>Manage class streams and their allocations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Input
                  placeholder="Search streams..."
                  value={streamFilters.search || ''}
                  onChange={(e) => setStreamFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="max-w-sm"
                />
                <Select
                  value={streamFilters.class_id?.toString() || 'all'}
                  onValueChange={(value) => setStreamFilters(prev => ({ 
                    ...prev, 
                    class_id: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Streams Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stream</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Class Teacher</TableHead>
                    <TableHead>Enrollment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {streams.map((stream) => (
                    <TableRow key={stream.id}>
                      <TableCell className="font-medium">{stream.name}</TableCell>
                      <TableCell>{stream.class_name}</TableCell>
                      <TableCell>{stream.year}</TableCell>
                      <TableCell>{stream.class_teacher_name || 'Not assigned'}</TableCell>
                      <TableCell>
                        <Badge className={getCapacityColor(stream.current_enrollment, stream.capacity)}>
                          {stream.current_enrollment}/{stream.capacity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stream.status === 'active' ? 'default' : 'secondary'}>
                          {stream.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedStream(stream);
                              setIsAssignTeacherOpen(true);
                            }}
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteStream(stream.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Allocations</CardTitle>
              <CardDescription>View students allocated to each class and stream</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Select
                  value={filters.grade_level?.toString() || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    grade_level: value === 'all' ? undefined : parseInt(value) 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Grade Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grade Levels</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        Grade {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(() => {
                const filteredStudents = students.filter(student => {
                  if (!filters.grade_level) return true;
                  const studentClass = classes.find(c => String(c.id) === String(student.current_class_id));
                  return studentClass?.grade_level === filters.grade_level;
                });

                if (students.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">No Students Found</h3>
                      <p className="text-muted-foreground">
                        No students have been allocated to classes yet.
                      </p>
                    </div>
                  );
                }

                if (filteredStudents.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">No Students Found</h3>
                      <p className="text-muted-foreground">
                        No students found for Grade {filters.grade_level}
                      </p>
                    </div>
                  );
                }

                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admission No.</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Stream</TableHead>
                        <TableHead>Gender</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => {
                        const studentClass = classes.find(c => String(c.id) === String(student.current_class_id));
                        const studentStream = streams.find(s => String(s.id) === String(student.current_stream_id));
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.admission_number}</TableCell>
                            <TableCell>{student.full_name}</TableCell>
                            <TableCell>{studentClass?.name || 'N/A'}</TableCell>
                            <TableCell>{studentStream?.name || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{student.gender}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Teacher Dialog */}
      <Dialog open={isAssignTeacherOpen} onOpenChange={setIsAssignTeacherOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Class Teacher</DialogTitle>
            <DialogDescription>
              Select a teacher to assign to {selectedStream?.name} - {selectedStream?.class_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Select Teacher</Label>
              <Select
                onValueChange={(value) => handleAssignTeacher(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No teachers available. Please add teachers first.
                    </div>
                  ) : (
                    teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.first_name} {teacher.last_name} - TSC: {teacher.tsc_number}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};