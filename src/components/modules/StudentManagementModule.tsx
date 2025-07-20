import { useState } from 'react';
import { Plus, Search, Filter, Users, GraduationCap, Phone, MapPin, Edit3, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_assigned: string;
  stream: string;
  date_of_birth: string;
  gender: 'M' | 'F';
  phone_number?: string;
  address?: string;
  parent_name: string;
  parent_phone: string;
  enrollment_date: string;
  status: 'active' | 'inactive' | 'transferred';
  photo?: string;
}

export function StudentManagementModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Mock student data
  const mockStudents: Student[] = [
    {
      id: '1',
      admission_number: '2025-0001',
      first_name: 'John',
      last_name: 'Doe',
      class_assigned: 'Grade 5',
      stream: 'EAST',
      date_of_birth: '2014-03-15',
      gender: 'M',
      phone_number: '+254712345678',
      address: '123 Main St, Nairobi',
      parent_name: 'Jane Doe',
      parent_phone: '+254787654321',
      enrollment_date: '2025-01-15',
      status: 'active'
    },
    {
      id: '2',
      admission_number: '2025-0002',
      first_name: 'Sarah',
      last_name: 'Smith',
      class_assigned: 'Grade 4',
      stream: 'WEST',
      date_of_birth: '2015-08-22',
      gender: 'F',
      phone_number: '+254723456789',
      address: '456 Oak Ave, Nairobi',
      parent_name: 'Michael Smith',
      parent_phone: '+254798765432',
      enrollment_date: '2025-01-10',
      status: 'active'
    },
    {
      id: '3',
      admission_number: '2024-0156',
      first_name: 'Peter',
      last_name: 'Kiprotich',
      class_assigned: 'Grade 6',
      stream: 'NORTH',
      date_of_birth: '2013-11-05',
      gender: 'M',
      phone_number: '+254734567890',
      address: '789 Pine Rd, Nairobi',
      parent_name: 'Mary Kiprotich',
      parent_phone: '+254709876543',
      enrollment_date: '2024-09-01',
      status: 'active'
    }
  ];

  const classes = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 
    'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'
  ];

  const filteredStudents = mockStudents.filter(student => {
    const matchesSearch = 
      student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admission_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.class_assigned === selectedClass;
    const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;
    
    return matchesSearch && matchesClass && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'transferred': return 'outline';
      default: return 'secondary';
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Student Management</h2>
          <p className="text-muted-foreground">
            Manage student records, enrollment, and information
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Register a new student in the system
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 text-center text-muted-foreground">
              Student registration form will be implemented here
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students by name or admission number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Student Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStudents.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockStudents.filter(s => s.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Term</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockStudents.filter(s => s.enrollment_date.startsWith('2025')).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(mockStudents.map(s => s.class_assigned)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      <div className="grid gap-4">
        {filteredStudents.map((student) => (
          <Card key={student.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={student.photo} alt={`${student.first_name} ${student.last_name}`} />
                  <AvatarFallback>
                    {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {student.first_name} {student.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {student.admission_number}
                      </p>
                    </div>
                    <Badge variant={getStatusColor(student.status)}>
                      {student.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>{student.class_assigned} {student.stream}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{student.gender === 'M' ? 'Male' : 'Female'}, {calculateAge(student.date_of_birth)} years</span>
                    </div>
                    
                    {student.phone_number && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{student.phone_number}</span>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Parent:</span> {student.parent_name} • {student.parent_phone}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit3 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No students found</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {searchTerm || selectedClass !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your filters to see more results.'
                : 'Get started by adding your first student.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedStudent?.first_name} {selectedStudent?.last_name}
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedStudent.photo} />
                  <AvatarFallback className="text-lg">
                    {selectedStudent.first_name.charAt(0)}{selectedStudent.last_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </h3>
                  <p className="text-muted-foreground">{selectedStudent.admission_number}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Class:</span>
                  <p>{selectedStudent.class_assigned} {selectedStudent.stream}</p>
                </div>
                <div>
                  <span className="font-medium">Gender:</span>
                  <p>{selectedStudent.gender === 'M' ? 'Male' : 'Female'}</p>
                </div>
                <div>
                  <span className="font-medium">Date of Birth:</span>
                  <p>{new Date(selectedStudent.date_of_birth).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium">Age:</span>
                  <p>{calculateAge(selectedStudent.date_of_birth)} years</p>
                </div>
                <div>
                  <span className="font-medium">Phone:</span>
                  <p>{selectedStudent.phone_number || 'Not provided'}</p>
                </div>
                <div>
                  <span className="font-medium">Enrollment Date:</span>
                  <p>{new Date(selectedStudent.enrollment_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              {selectedStudent.address && (
                <div>
                  <span className="font-medium">Address:</span>
                  <p className="text-sm text-muted-foreground">{selectedStudent.address}</p>
                </div>
              )}
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-2">Parent/Guardian Information</h4>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Name:</span> {selectedStudent.parent_name}</p>
                  <p><span className="font-medium">Phone:</span> {selectedStudent.parent_phone}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}