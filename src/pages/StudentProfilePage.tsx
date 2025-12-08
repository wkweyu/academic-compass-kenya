import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStudents, getStudentById } from '@/services/studentService';
import { getSiblings } from '@/services/guardianService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Edit, Phone, Mail, MapPin, Calendar, User, GraduationCap, Users, FileText } from 'lucide-react';
import { StudentExamProgress } from '@/components/exams/StudentExamProgress';

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: student, isLoading, error } = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudentById(id!),
    enabled: !!id,
  });

  // Fetch siblings for the student
  const { data: siblings = [] } = useQuery({
    queryKey: ['siblings', student?.id],
    queryFn: () => student ? getSiblings(student.id) : [],
    enabled: !!student,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading student profile...</div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-destructive">Student not found</div>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'graduated': return 'outline';
      case 'transferred': return 'secondary';
      case 'suspended': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft size={16} />
          Back
        </Button>
        <Button className="gap-2" onClick={() => navigate(`/students/${student.id}/edit`)}>
          <Edit size={16} />
          Edit Student
        </Button>
      </div>

      {/* Student Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={student.photo || undefined} alt={student.full_name} />
              <AvatarFallback className="text-xl">
                {student.full_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{student.full_name}</h1>
                <Badge variant={getStatusBadgeVariant(student.status)}>
                  {student.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User size={16} />
                  <span>Admission: {student.admission_number}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} />
                  <span>{student.current_class_stream}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>Year {student.academic_year}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exams">Exam Progress</TabsTrigger>
          <TabsTrigger value="academic">Academic History</TabsTrigger>
          <TabsTrigger value="guardian">Guardian Info</TabsTrigger>
          <TabsTrigger value="siblings">Siblings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Gender</label>
                  <p className="text-sm">{student.gender === 'M' ? 'Male' : 'Female'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p className="text-sm">{new Date(student.date_of_birth).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Level</label>
                  <p className="text-sm">{student.level}</p>
                </div>
                {student.upi_number && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">UPI Number</label>
                    <p className="text-sm">{student.upi_number}</p>
                  </div>
                )}
                {student.kcpe_index && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">KCPE Index</label>
                    <p className="text-sm">{student.kcpe_index}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Academic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Academic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Current Class</label>
                  <p className="text-sm">{student.current_class_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Current Stream</label>
                  <p className="text-sm">{student.current_stream_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Admission Year</label>
                  <p className="text-sm">{student.admission_year}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Current Term</label>
                  <p className="text-sm">Term {student.term}</p>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {student.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-muted-foreground" />
                    <span className="text-sm">{student.phone}</span>
                  </div>
                )}
                {student.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-muted-foreground" />
                    <span className="text-sm">{student.email}</span>
                  </div>
                )}
                {student.address && (
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-muted-foreground" />
                    <span className="text-sm">{student.address}</span>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transport</label>
                  <p className="text-sm">{student.is_on_transport ? 'Yes' : 'No'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={20} />
                Exam Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StudentExamProgress studentId={typeof student.id === 'string' ? parseInt(student.id) : student.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Academic History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
                <p>Academic history will be displayed here</p>
                <p className="text-sm">Including grades, transfers, and promotions</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardian" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Guardian Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Guardian Name</label>
                    <p className="text-sm">{student.guardian_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Relationship</label>
                    <p className="text-sm">{student.guardian_relationship}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-muted-foreground" />
                    <span className="text-sm">{student.guardian_phone}</span>
                  </div>
                  {student.guardian_email && (
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-muted-foreground" />
                      <span className="text-sm">{student.guardian_email}</span>
                    </div>
                  )}
                  {student.guardian_address && (
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-muted-foreground" />
                      <span className="text-sm">{student.guardian_address}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="siblings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                Siblings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {siblings && siblings.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Students sharing the same guardian: <strong>{student.guardian_name}</strong>
                  </p>
                  {siblings.map((sibling) => (
                    <div key={sibling.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={sibling.photo || undefined} alt={sibling.full_name} />
                        <AvatarFallback>
                          {sibling.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium">{sibling.full_name}</h4>
                        <p className="text-sm text-muted-foreground">{sibling.current_class_stream}</p>
                        <p className="text-xs text-muted-foreground">Admission: {sibling.admission_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {sibling.gender === 'M' ? 'Male' : 'Female'} • 
                          Age: {new Date().getFullYear() - new Date(sibling.date_of_birth).getFullYear()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={getStatusBadgeVariant(sibling.status)}>
                          {sibling.status}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/students/${sibling.id}`)}>
                          View Profile
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No siblings found</p>
                  <p className="text-sm">Students with the same guardian will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}