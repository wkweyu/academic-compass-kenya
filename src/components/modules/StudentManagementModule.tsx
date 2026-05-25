import React, { useState, useMemo, useEffect } from 'react';
import { escapeHtml } from '@/utils/escapeHtml';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Upload, 
  Filter,
  Users,
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  Calendar,
  UserCheck,
  FileText,
  Printer,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  LayoutGrid,
  List,
  X,
} from 'lucide-react';
import { 
  getStudents, 
  getStudentById, 
  createStudent, 
  updateStudent, 
  deleteStudent,
  getStudentStats,
  bulkImportStudents,
  exportStudents,
  getImportTemplate
} from '@/services/studentService';
import { transferStudent } from '@/services/promotionService';
import { findExistingGuardian } from '@/services/guardianService';
import { StudentForm } from '@/components/forms/StudentForm';
import { StudentEditDialog } from '@/components/students/StudentEditDialog';
import AdmissionFormPrint from '@/components/AdmissionFormPrint';
import { Student, StudentFilters, STUDENT_STATUS_OPTIONS, GENDER_OPTIONS } from '@/types/student';
import { supabase } from '@/integrations/supabase/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { differenceInYears, parseISO } from 'date-fns';


const StudentManagementModule = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<StudentFilters>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferData, setTransferData] = useState<{
    student: Student | null;
    toClassId: string;
    toStreamId: string;
    notes: string;
  }>({
    student: null,
    toClassId: '',
    toStreamId: '',
    notes: ''
  });
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printStudentData, setPrintStudentData] = useState<Omit<Student, 'id' | 'admission_number' | 'created_at' | 'updated_at'> | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState<StudentFilters>({});
  const [defaultApplied, setDefaultApplied] = useState(false);
  const [collapseAllGroups, setCollapseAllGroups] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters.class_id, filters.stream_id]);

  // Fetch students
  const { data: students = [], isLoading, error } = useQuery({
    queryKey: ['students', filters],
    queryFn: () => getStudents(filters),
  });

  // Fetch student stats
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['student-stats'],
    queryFn: getStudentStats,
  });

  // Fetch classes and streams for transfer
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .order('grade_level', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch streams for selected class in transfer dialog
  const { data: streams } = useQuery({
    queryKey: ['streams', transferData.toClassId],
    queryFn: async () => {
      if (!transferData.toClassId) return [];
      
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return (data || []).filter((stream: any) => {
        const assignedClassId = stream.class_assigned_id ?? stream.class_assigned;
        return String(assignedClassId) === String(transferData.toClassId);
      });
    },
    enabled: !!transferData.toClassId
  });

  // Fetch all streams (for same-class stream transfers)
  const { data: allStreams } = useQuery({
    queryKey: ['all-streams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Streams for the filter bar — derived from students actually in this class/year
  // so the IDs in the dropdown are guaranteed to match students' current_stream_id
  const { data: filterStreams = [] } = useQuery({
    queryKey: ['filter-streams', filters.class_id],
    queryFn: async () => {
      if (!filters.class_id) return [];
      const { data, error } = await supabase
        .from('streams')
        .select('id, name')
        .eq('class_assigned_id', filters.class_id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!filters.class_id
  });

  // Academic year range: 2020 → current year, descending
  const academicYears = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2019 }, (_, i) => current - i);
  }, []);

  // Default to the first (lowest-grade) class on initial load
  useEffect(() => {
    if (!defaultApplied && classes && classes.length > 0 && !filters.class_id && !filters.search) {
      setFilters(prev => ({ ...prev, class_id: classes[0].id.toString() }));
      setDefaultApplied(true);
    }
  }, [classes, defaultApplied, filters.class_id, filters.search]);

  // Create student mutation
  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: (createdStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      setIsCreateDialogOpen(false);
      toast.success('Student created successfully');
      
      // Show print dialog immediately after successful creation
      if (createdStudent) {
        setPrintStudentData(createdStudent);
        // Use a small timeout to ensure dialog state updates properly
        setTimeout(() => {
          setShowPrintDialog(true);
        }, 100);
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to create student';
      toast.error(errorMessage);
      console.error('Create student error:', error);
    },
  });

  // Update student mutation handled by StudentEditDialog

  // Delete student mutation
  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      toast.success('Student deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete student');
      console.error('Delete student error:', error);
    },
  });

  // Import students mutation
  const importMutation = useMutation({
    mutationFn: bulkImportStudents,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      setIsImportDialogOpen(false);
      
      // Show detailed results
      if (result.success > 0 && result.errors === 0 && result.warnings === 0) {
        toast.success(`Successfully imported ${result.success} student${result.success !== 1 ? 's' : ''}`);
      } else if (result.success > 0 && (result.errors > 0 || result.warnings > 0)) {
        toast.warning(
          `Import completed with issues: ${result.success} successful, ${result.errors} failed, ${result.warnings} warnings`,
          { duration: 5000 }
        );
        
        // Show first few errors/warnings
        const issues = result.details.slice(0, 3);
        issues.forEach(detail => {
          if (detail.type === 'error') {
            toast.error(`Row ${detail.row}: ${detail.message}`, { duration: 5000 });
          } else if (detail.type === 'warning') {
            toast.warning(`Row ${detail.row}: ${detail.message}`, { duration: 4000 });
          }
        });
        
        if (result.details.length > 3) {
          toast.info(`...and ${result.details.length - 3} more issues. Check console for full details.`);
          console.table(result.details);
        }
      } else {
        toast.error(`Import failed: ${result.errors} errors. Check the file format and try again.`);
        result.details.slice(0, 5).forEach(detail => {
          toast.error(`Row ${detail.row}: ${detail.message}`, { duration: 5000 });
        });
        console.table(result.details);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to import students. Please check the file format.');
      console.error('Import error:', error);
    },
  });

  // Transfer student mutation
  const transferMutation = useMutation({
    mutationFn: ({ studentId, toClassId, toStreamId, notes }: {
      studentId: number;
      toClassId: number;
      toStreamId: number;
      notes?: string;
    }) => transferStudent(studentId, toClassId, toStreamId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      setIsTransferDialogOpen(false);
      setTransferData({
        student: null,
        toClassId: '',
        toStreamId: '',
        notes: ''
      });
      toast.success('Student transferred successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to transfer student');
      console.error('Transfer error:', error);
    }
  });

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
  };

  const handleFilterChange = (key: keyof StudentFilters, value: string) => {
    if (key === 'class_id') {
      // Changing class resets stream and collapse state
      setFilters(prev => ({
        ...prev,
        class_id: value === 'all' ? undefined : value,
        stream_id: undefined,
      }));
      setCollapseAllGroups(value === 'all');
      setCollapsedClasses(new Set());
      return;
    }
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
    }));
  };

  const handleViewStudent = (studentId: string) => {
    navigate(`/students/${studentId}`);
  };

  const handleEditStudent = async (studentId: string) => {
    try {
      const student = await getStudentById(studentId);
      if (student) {
        setSelectedStudent(student);
        setIsEditDialogOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load student details');
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      deleteMutation.mutate(studentId);
    }
  };

  const handleTransferStudent = (student: Student) => {
    setTransferData({
      student,
      toClassId: '',
      toStreamId: '',
      notes: `Transferred from ${student.current_class_stream}`
    });
    setIsTransferDialogOpen(true);
  };

  const handleTransferSubmit = () => {
    if (!transferData.student) {
      toast.error('Student is required');
      return;
    }

    // Must select at least a new class or a new stream
    if (!transferData.toClassId && !transferData.toStreamId) {
      toast.error('Please select a new class and/or stream');
      return;
    }

    const student = transferData.student;
    
    // If class is changing, stream is required
    const isClassChanging = transferData.toClassId && transferData.toClassId !== student.current_class;
    if (isClassChanging && !transferData.toStreamId) {
      toast.error('Stream is required when changing class');
      return;
    }

    // If only stream is changing (same class), use current class
    const finalClassId = transferData.toClassId ? Number(transferData.toClassId) : Number(student.current_class);
    const finalStreamId = transferData.toStreamId ? Number(transferData.toStreamId) : Number(student.current_stream);

    const toClass = classes?.find(c => c.id === finalClassId);
    const allAvailableStreams = transferData.toClassId ? streams : allStreams;
    const toStream = allAvailableStreams?.find(s => s.id.toString() === transferData.toStreamId);
    
    const confirmMessage = isClassChanging 
      ? `Transfer ${student.full_name} to ${toClass?.name} - ${toStream?.name}?`
      : `Move ${student.full_name} to stream ${toStream?.name} within the same class?`;
    
    if (window.confirm(confirmMessage)) {
      transferMutation.mutate({
        studentId: Number(student.id),
        toClassId: finalClassId,
        toStreamId: finalStreamId,
        notes: transferData.notes
      });
    }
  };

  const handleOpenExportDialog = () => {
    setExportFilters({ ...filters }); // pre-fill from current page filters
    setIsExportDialogOpen(true);
  };

  const handleExportFromDialog = async () => {
    try {
      await exportStudents(exportFilters);
      setIsExportDialogOpen(false);
      toast.success('Student data exported successfully');
    } catch {
      toast.error('Failed to export student data');
    }
  };

  const handlePrintList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    let tableRows = '';
    let rowNum = 1;
    sortedClassNames.forEach(className => {
      const cls = groupedStudents[className];
      tableRows += `<tr class="class-header"><td colspan="7"><strong>${escapeHtml(className)}</strong> &mdash; ${cls.length} student${cls.length !== 1 ? 's' : ''}</td></tr>`;
      cls.forEach(s => {
        const dob = new Date(s.date_of_birth);
        const age = isNaN(dob.getTime()) ? '—' : String(new Date().getFullYear() - dob.getFullYear());
        const stream = escapeHtml(s.current_stream_name || s.current_class_name || '—');
        tableRows += `<tr>
          <td>${rowNum++}</td>
          <td>${escapeHtml(s.full_name)}</td>
          <td>${escapeHtml(s.admission_number)}</td>
          <td>${stream}</td>
          <td>${s.gender === 'M' ? 'Male' : 'Female'}</td>
          <td>${age}</td>
          <td>${escapeHtml(s.guardian_phone || '—')}</td>
        </tr>`;
      });
    });
    const filterDesc = [
      filters.status ? `Status: ${filters.status}` : '',
      filters.gender ? `Gender: ${filters.gender === 'M' ? 'Male' : 'Female'}` : '',
      filters.search ? `Search: "${filters.search}"` : '',
    ].filter(Boolean).join(' · ');
    printWindow.document.write(`<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><title>Student List</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 24px; color: #111; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        .meta { font-size: 10px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f0f0f0; text-align: left; padding: 6px 8px; border: 1px solid #ccc; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
        td { padding: 5px 8px; border: 1px solid #ddd; }
        tr:nth-child(even) td { background: #fafafa; }
        tr.class-header td { background: #e4e4e4; font-size: 10.5px; padding: 4px 8px; border-top: 2px solid #bbb; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      <h1>SkoolTrack Pro &mdash; Student List</h1>
      <p class="meta">Printed ${new Date().toLocaleDateString()} &nbsp;|&nbsp; ${students.length} students${filterDesc ? ' &nbsp;|&nbsp; Filters: ' + escapeHtml(filterDesc) : ''}</p>
      <table>
        <thead><tr><th>#</th><th>Full Name</th><th>Adm. No.</th><th>Stream</th><th>Gender</th><th>Age</th><th>Guardian Phone</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const handleDownloadTemplate = () => {
    getImportTemplate();
    toast.success('Template downloaded successfully');
  };

  const getStatusBadgeColor = (status: string) => {
    const statusOption = STUDENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
  };

  const formatEnrollmentDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  };

  // Client-side stream filter applied on top of server-fetched students
  // (avoids PostgREST FK type-coercion issues with current_stream_id)
  const visibleStudents = useMemo(() => {
    if (!filters.stream_id || filters.stream_id === 'all') return students;
    
    // Find the name of the selected stream for fuzzy/name matching
    const selectedStreamName = filterStreams.find(
      s => String(s.id) === String(filters.stream_id)
    )?.name;

    return students.filter(s => {
      // 1. Direct ID match
      if (String(s.current_stream) === String(filters.stream_id)) return true;
      
      // 2. Name-based match (including inferred streams)
      if (selectedStreamName) {
        const info = getStreamInfo(s);
        return info.displayText.toLowerCase() === selectedStreamName.toLowerCase();
      }
      
      return false;
    });
  }, [students, filters.stream_id, filterStreams]);

  // Group students by class name with stable numeric ordering
  const groupedStudents = useMemo(() => {
    const grouped: Record<string, Student[]> = {};
    for (const student of visibleStudents) {
      const key = student.current_class_name || 'Unassigned';
      (grouped[key] ||= []).push(student);
    }
    return grouped;
  }, [visibleStudents]);

  const sortedClassNames = useMemo(
    () => Object.keys(groupedStudents).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    ),
    [groupedStudents]
  );

  const exportPreviewCount = useMemo(() => {
    return students.filter(s => {
      if (exportFilters.status && s.status !== exportFilters.status) return false;
      if (exportFilters.gender && s.gender !== exportFilters.gender) return false;
      if (exportFilters.class_id && s.current_class !== exportFilters.class_id) return false;
      return true;
    }).length;
  }, [students, exportFilters]);

  // Track collapsed sections (empty = all expanded)
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());
  const toggleClass = (name: string) => {
    setCollapsedClasses(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };
  // When collapseAllGroups is true (all-classes view), groups start collapsed;
  // user can individually expand them. Inverted logic when single class is selected.
  const isExpanded = (name: string) =>
    collapseAllGroups ? collapsedClasses.has(name) : !collapsedClasses.has(name);

  // Helper to calculate age precisely
  const calculateAge = (dobString: string) => {
    try {
      if (!dobString) return '—';
      const birthDate = parseISO(dobString);
      const today = new Date(2026, 4, 25); // May 25, 2026
      return `${differenceInYears(today, birthDate)}y`;
    } catch {
      return '—';
    }
  };

  // Helper to extract stream information from student data
  const getStreamInfo = (student: Student) => {
    const knownStreams = ['Blue', 'Green', 'Red', 'Yellow', 'Purple', 'Orange'];
    
    // Priority 1: Explicit stream name
    const explicitStream = student.current_stream_name || student.stream;
    if (explicitStream && explicitStream.trim()) {
      return { displayText: explicitStream, isInferred: false };
    }

    // Priority 2: Extract from class name using whole-word matching
    const className = student.current_class_name || '';
    for (const streamWord of knownStreams) {
      const regex = new RegExp(`\\b${streamWord}\\b`, 'i');
      if (regex.test(className)) {
        return { displayText: streamWord, isInferred: true };
      }
    }

    // Priority 3: Fallback to class name or placeholder
    if (className.trim()) {
      return { displayText: className, isInferred: true };
    }

    return { displayText: "—", isInferred: true };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading students...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-sm text-destructive">Failed to load students</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted-foreground text-sm">ERP Student Information System</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'table' | 'cards')} className="mr-2">
            <ToggleGroupItem value="table" className="h-9 w-9 p-0" aria-label="Table View">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="cards" className="h-9 w-9 p-0" aria-label="Card View">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Import
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrintList}>
                <Printer className="h-4 w-4 mr-2" /> Print List
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenExportDialog}>
                <Download className="h-4 w-4 mr-2" /> Export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Statistics Bar */}
      {stats && (
        <div className="flex flex-wrap items-center gap-y-2 gap-x-6 p-3 bg-muted/30 rounded-lg border text-xs font-medium">
          <div className="flex items-center gap-2 pr-6 border-r">
            <span className="text-muted-foreground uppercase tracking-wider">Total</span>
            <span className="text-sm font-bold">{stats.total_students}</span>
          </div>
          <div className="flex items-center gap-2 pr-6 border-r">
            <span className="text-muted-foreground uppercase tracking-wider text-green-600">Active</span>
            <span className="text-sm font-bold">{stats.active_students}</span>
          </div>
          <div className="flex items-center gap-2 pr-6 border-r">
            <span className="text-muted-foreground uppercase tracking-wider text-blue-600">M / F</span>
            <span className="text-sm font-bold">{stats.male_students} / {stats.female_students}</span>
          </div>
          <div className="flex items-center gap-2 pr-6 border-r">
            <span className="text-muted-foreground uppercase tracking-wider text-amber-600">Transferred</span>
            <span className="text-sm font-bold">{stats.students_by_status?.transferred ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground uppercase tracking-wider text-purple-600">Alumni</span>
            <span className="text-sm font-bold">{stats.students_by_status?.graduated ?? 0}</span>
          </div>
        </div>
      )}

      {/* Combined Filter Bar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={filters.search || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select
          value={filters.class_id || 'all'}
          onValueChange={(value) => handleFilterChange('class_id', value)}
        >
          <SelectTrigger className="w-[180px] h-10">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {(classes || []).map((cls: any) => (
              <SelectItem key={cls.id} value={cls.id.toString()}>{cls.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.stream_id || 'all'}
          onValueChange={(value) => handleFilterChange('stream_id', value)}
          disabled={!filters.class_id}
        >
          <SelectTrigger className="w-[180px] h-10">
            <SelectValue placeholder="Stream" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Streams</SelectItem>
            {filterStreams.map((s: any) => (
              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10">
              <Filter className="h-4 w-4 mr-2" />
              More
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filters.status || 'all'} onValueChange={(v) => handleFilterChange('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {STUDENT_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={filters.gender || 'all'} onValueChange={(v) => handleFilterChange('gender', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    {GENDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Admission Year</Label>
                <Select value={filters.academic_year?.toString() || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, academic_year: v === 'all' ? undefined : Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {academicYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="link" className="w-full text-xs h-auto p-0" onClick={() => setFilters({})}>Clear All Filters</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Floating Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-bold border-r pr-4">{selectedIds.size} Selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-white hover:bg-white/20">Change Status</Button>
            <Button variant="ghost" size="sm" className="h-8 text-white hover:bg-white/20">Transfer</Button>
            <Button variant="ghost" size="sm" className="h-8 text-white hover:bg-destructive/80" onClick={() => {
              if (confirm(`Delete ${selectedIds.size} students?`)) {
                // Bulk delete logic would go here
              }
            }}>Delete</Button>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Data View */}
      {viewMode === 'table' ? (
        <div className="border rounded-md overflow-hidden bg-card">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="h-10 hover:bg-transparent bg-muted/50 border-b">
                <TableHead className="w-12 h-10 py-0 text-center">
                  <Checkbox 
                    checked={selectedIds.size === visibleStudents.length && visibleStudents.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(visibleStudents.map(s => String(s.id))));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="h-10 py-0 w-[30%] font-semibold">Student</TableHead>
                <TableHead className="h-10 py-0 w-[15%] font-semibold">Stream</TableHead>
                <TableHead className="h-10 py-0 w-[15%] font-semibold">Demographics</TableHead>
                <TableHead className="h-10 py-0 w-[15%] font-semibold">Phone</TableHead>
                <TableHead className="h-10 py-0 w-[12%] font-semibold">Status</TableHead>
                <TableHead className="h-10 py-0 w-[13%] text-right font-semibold pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No students found matching filters.
                  </TableCell>
                </TableRow>
              ) : (
                visibleStudents.map((student) => {
                  const streamInfo = getStreamInfo(student);
                  return (
                    <TableRow key={student.id} className="h-10 hover:bg-muted/50 py-0 border-b last:border-0 relative">
                      <TableCell className="w-12 h-10 py-0 text-center">
                        <Checkbox 
                          checked={selectedIds.has(String(student.id))}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedIds);
                            if (checked) next.add(String(student.id));
                            else next.delete(String(student.id));
                            setSelectedIds(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="h-10 py-0 overflow-hidden">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7 shrink-0 border">
                            <AvatarImage src={student.photo_url || ''} />
                            <AvatarFallback className="text-[10px] bg-muted">{student.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col leading-tight truncate">
                            <span className="text-sm font-medium truncate">{student.full_name}</span>
                            <span className="text-[10px] text-muted-foreground">{student.admission_number}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="h-10 py-0 text-xs">
                        <span className={`block truncate ${streamInfo.isInferred ? "text-muted-foreground/70 italic text-[11px]" : ""}`}>
                          {streamInfo.displayText}
                        </span>
                      </TableCell>
                      <TableCell className="h-10 py-0 text-sm whitespace-nowrap">
                        <span className="font-medium">{student.gender}</span>, {calculateAge(student.date_of_birth)}
                      </TableCell>
                      <TableCell className="h-10 py-0 text-sm text-muted-foreground truncate">
                        {student.guardian_phone || '—'}
                      </TableCell>
                      <TableCell className="h-10 py-0">
                        <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="h-5 px-1.5 text-[9px] uppercase font-bold tracking-wider shrink-0">
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="h-10 py-0 text-right pr-2">
                        <div className="flex justify-end items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDetails(student)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditStudent(student)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => handleOpenTransferDialog(student)}>
                                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Transfer
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteStudent(Number(student.id))}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {visibleStudents.map((student) => {
            const streamInfo = getStreamInfo(student);
            return (
              <Card 
                key={student.id} 
                className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer border ${selectedIds.has(String(student.id)) ? 'ring-1 ring-primary border-primary bg-primary/5' : ''}`}
                onClick={() => {
                  const next = new Set(selectedIds);
                  if (next.has(String(student.id))) next.delete(String(student.id));
                  else next.add(String(student.id));
                  setSelectedIds(next);
                }}
              >
                <div className="p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox 
                        checked={selectedIds.has(String(student.id))}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(String(student.id));
                          else next.delete(String(student.id));
                          setSelectedIds(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Avatar className="h-8 w-8 shrink-0 border">
                        <AvatarImage src={student.photo_url || ''} />
                        <AvatarFallback className="text-[10px] bg-muted">{student.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 leading-tight">
                        <span className="text-sm font-semibold truncate">{student.full_name}</span>
                        <span className="text-[10px] text-muted-foreground">{student.admission_number}</span>
                      </div>
                    </div>
                    <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="h-4 px-1 text-[8px] uppercase shrink-0">
                      {student.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground block">Stream</span>
                      <span className={`font-medium truncate block ${streamInfo.isInferred ? "text-muted-foreground/70 italic text-[10px]" : ""}`}>
                        {streamInfo.displayText}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground block">Demographics</span>
                      <span className="font-medium">{student.gender}, {calculateAge(student.date_of_birth)}y</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{student.guardian_phone || 'No phone'}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleViewDetails(student); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEditStudent(student); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Existing Dialogs (unchanged) */}

      {/* Results summary */}
      {!isLoading && (
        <div className={`flex items-center gap-2 text-sm px-1 ${
          !filters.class_id && students.length > 100
            ? 'text-amber-600'
            : 'text-muted-foreground'
        }`}>
          <span>
            {filters.class_id ? (
              <>
                <span className="font-medium">{visibleStudents.length}</span>
                {' student'}{visibleStudents.length !== 1 ? 's' : ''}
                {filters.stream_id && filterStreams.length > 0 && (() => {
                  const s = filterStreams.find((f: any) => f.id.toString() === filters.stream_id);
                  return s ? <> in <span className="font-medium">{s.name}</span> stream</> : null;
                })()}
              </>
            ) : (
              <>
                <span className="font-medium">{visibleStudents.length}</span>
                {' student'}{visibleStudents.length !== 1 ? 's' : ''}
                {' across '}
                <span className="font-medium">{sortedClassNames.length}</span>
                {' class'}{sortedClassNames.length !== 1 ? 'es' : ''}
                {students.length > 100 && ' · select a class for better performance'}
              </>
            )}
          </span>
        </div>
      )}

      {/* Students by Class */}
      {visibleStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No students found</h3>
          <p className="text-muted-foreground text-center">
            {Object.keys(filters).length > 0
              ? "Try adjusting your search or filters"
              : "Get started by adding your first student"
            }
          </p>
          {Object.keys(filters).length === 0 && (
            <Button
              className="mt-4"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Student
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedClassNames.map(className => (
            <div key={className}>
              <button
                type="button"
                className="flex items-center gap-2 mb-3 hover:opacity-75 transition-opacity w-full text-left"
                onClick={() => toggleClass(className)}
              >
                {isExpanded(className)
                  ? <ChevronDown className="h-4 w-4 shrink-0" />
                  : <ChevronRight className="h-4 w-4 shrink-0" />}
                <span className="font-semibold text-base">{className}</span>
                <Badge variant="secondary">
                  {groupedStudents[className].length} student{groupedStudents[className].length !== 1 ? 's' : ''}
                </Badge>
              </button>
              {isExpanded(className) && (
                <div className="border rounded-lg divide-y overflow-hidden">
                  {groupedStudents[className].map((student) => {
                    const age = new Date().getFullYear() - new Date(student.date_of_birth).getFullYear();
                    const enrolledRaw = formatEnrollmentDate(student.enrollment_date);
                    const enrolledLabel = enrolledRaw !== 'N/A'
                      ? enrolledRaw
                      : student.admission_year ? String(student.admission_year) : 'N/A';
                    return (
                      <div key={student.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={student.photo || undefined} alt={student.full_name} />
                          <AvatarFallback className="text-xs">
                            {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 3).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Name + admission number */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-tight truncate">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.admission_number}</p>
                        </div>

                        {/* Stream / Class badge */}
                        <Badge variant="outline" className="hidden sm:flex text-xs shrink-0">
                          {filters.class_id
                            ? (student.current_stream_name || '—')
                            : (student.current_stream_name || student.current_class_name)}
                        </Badge>

                        {/* Gender · Age */}
                        <span className="hidden md:block text-xs text-muted-foreground w-20 shrink-0">
                          {student.gender === 'M' ? 'Male' : 'Female'} · {age}y
                        </span>

                        {/* Guardian phone */}
                        <span className="hidden lg:block text-xs text-muted-foreground w-28 truncate shrink-0">
                          {student.guardian_phone}
                        </span>

                        {/* Enrolled */}
                        <span className="hidden xl:block text-xs text-muted-foreground w-20 shrink-0">
                          {enrolledLabel}
                        </span>

                        {/* Status */}
                        <Badge className={`${getStatusBadgeColor(student.status)} text-xs shrink-0`}>
                          {student.status || 'active'}
                        </Badge>

                        {/* Actions */}
                        <div className="flex gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewStudent(student.id)}
                            title="View"
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStudent(student.id)}
                            title="Edit"
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" title="More" className="h-7 w-7 p-0">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleTransferStudent(student)}>
                                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
                                Transfer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteStudent(student.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Results summary */}
      {students.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {students.length} student{students.length !== 1 ? 's' : ''}
          {Object.keys(filters).some(key => filters[key as keyof StudentFilters]) && (
            <span> matching your filters</span>
          )}
        </div>
      )}

      {/* Student Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedStudent?.full_name}
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Personal Information</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Full Name</Label>
                    <p className="text-sm">{selectedStudent.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Admission Number</Label>
                    <p className="text-sm">{selectedStudent.admission_number}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Date of Birth</Label>
                    <p className="text-sm">{new Date(selectedStudent.date_of_birth).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Gender</Label>
                    <p className="text-sm">{selectedStudent.gender === 'M' ? 'Male' : 'Female'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge className={getStatusBadgeColor(selectedStudent.status)}>
                      {selectedStudent.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Academic Information</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Class</Label>
                    <p className="text-sm">{selectedStudent.current_class_stream}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Academic Year</Label>
                    <p className="text-sm">{selectedStudent.academic_year}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Enrollment Date</Label>
                    <p className="text-sm">{new Date(selectedStudent.enrollment_date).toLocaleDateString()}</p>
                  </div>
                  {selectedStudent.kcpe_index && (
                    <div>
                      <Label className="text-sm font-medium">KCPE Index</Label>
                      <p className="text-sm">{selectedStudent.kcpe_index}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Guardian Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Guardian Information</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Guardian Name</Label>
                    <p className="text-sm">{selectedStudent.guardian_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <p className="text-sm">{selectedStudent.guardian_phone}</p>
                  </div>
                  {selectedStudent.guardian_email && (
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <p className="text-sm">{selectedStudent.guardian_email}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Relationship</Label>
                    <p className="text-sm">{selectedStudent.guardian_relationship}</p>
                  </div>
                </div>
              </div>

              {/* Transport & Family Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Transport & Family</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Transport</Label>
                    <p className="text-sm">
                      {selectedStudent.is_on_transport 
                        ? `Yes (${selectedStudent.transport_type})` 
                        : 'No'
                      }
                    </p>
                  </div>
                  {selectedStudent.siblings && selectedStudent.siblings.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Siblings in School</Label>
                      <div className="space-y-1">
                        {selectedStudent.siblings.map((sibling) => (
                          <div key={sibling.id} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {sibling.full_name} - {sibling.current_class_stream}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedStudent.special_needs && (
                    <div>
                      <Label className="text-sm font-medium">Special Needs</Label>
                      <p className="text-sm">{selectedStudent.special_needs}</p>
                    </div>
                  )}
                  {selectedStudent.notes && (
                    <div>
                      <Label className="text-sm font-medium">Notes</Label>
                      <p className="text-sm">{selectedStudent.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Student Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter student information to create a new student record
            </DialogDescription>
          </DialogHeader>
          <StudentForm
            onSubmit={(data) => createMutation.mutate(data)}
            isSubmitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <StudentEditDialog
        student={selectedStudent}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedStudent(null);
        }}
      />

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Students</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import student records
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6">
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="text-primary font-medium">Click to upload</span>
                    {' or drag and drop'}
                  </div>
                  <p className="text-xs text-muted-foreground">CSV file only (max 5MB)</p>
                </div>
              </Label>
              <Input 
                id="csv-upload"
                type="file" 
                accept=".csv"
                className="hidden"
                disabled={importMutation.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    importMutation.mutate(file);
                  }
                }}
              />
            </div>
            
            {importMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Processing import... This may take a moment.
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Required Columns:</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-start gap-1">
                  <span className="text-destructive">*</span>
                  <span>full_name</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-destructive">*</span>
                  <span>gender (M/F or Male/Female)</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-destructive">*</span>
                  <span>guardian_name</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-destructive">*</span>
                  <span>guardian_phone</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">date_of_birth</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">guardian_email</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">current_class_name</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">current_stream_name</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic mt-2">
                * Required fields | ○ Optional fields
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsImportDialogOpen(false)}
              disabled={importMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadTemplate}
              disabled={importMutation.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Student Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transfer Student
            </DialogTitle>
            <DialogDescription>
              Move {transferData.student?.full_name} to a different class or stream
            </DialogDescription>
          </DialogHeader>
          
          {transferData.student && (
            <div className="space-y-4">
              {/* Current Placement */}
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-sm font-medium">Current Placement</Label>
                <p className="text-sm mt-1">
                  {transferData.student.current_class_stream || 'Unassigned'}
                </p>
              </div>

              {/* New Class Selection */}
              <div className="space-y-2">
                <Label>New Class (Optional - leave empty to keep current)</Label>
                <Select
                  value={transferData.toClassId}
                  onValueChange={(value) => {
                    setTransferData(prev => ({
                      ...prev,
                      toClassId: value,
                      toStreamId: '' // Reset stream when class changes
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Keep current class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map(cls => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stream Selection */}
              <div className="space-y-2">
                <Label>New Stream (Optional - leave empty to keep current)</Label>
                <Select
                  value={transferData.toStreamId}
                  onValueChange={(value) => 
                    setTransferData(prev => ({ ...prev, toStreamId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Keep current stream" />
                  </SelectTrigger>
                  <SelectContent>
                    {(transferData.toClassId ? streams : allStreams)?.map(stream => (
                      <SelectItem key={stream.id} value={stream.id.toString()}>
                        {stream.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Transfer Notes (Optional)</Label>
                <Textarea
                  placeholder="Add reason for transfer..."
                  value={transferData.notes}
                  onChange={(e) => 
                    setTransferData(prev => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsTransferDialogOpen(false);
                setTransferData({
                  student: null,
                  toClassId: '',
                  toStreamId: '',
                  notes: ''
                });
              }}
              disabled={transferMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferSubmit}
              disabled={(!transferData.toClassId && !transferData.toStreamId) || transferMutation.isPending}
            >
              {transferMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transfer Student
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog (admission form) */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Student Admission Form
            </DialogTitle>
            <div className="text-sm text-muted-foreground">
              Review and print the admission form for this student
            </div>
          </DialogHeader>
          {printStudentData && (
            <div className="space-y-4">
              <div id="admission-form-content">
                <AdmissionFormPrint 
                  student={printStudentData} 
                  admissionNumber={`${new Date().getFullYear()}-${String(students.length + 1).padStart(4, '0')}`}
                  siblings={printStudentData.guardian_phone ? 
                    students.filter(s => 
                      s.guardian_phone === printStudentData.guardian_phone && 
                      s.full_name !== printStudentData.full_name
                    ) : []
                  }
                />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPrintDialog(false)}
                >
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    const printContent = document.getElementById('admission-form-content');
                    if (printContent) {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Admission Form - ${escapeHtml(printStudentData.full_name)}</title>
                              <style>
                                body { 
                                  font-family: Arial, sans-serif; 
                                  margin: 0; 
                                  padding: 20px; 
                                  background: white;
                                  color: black;
                                }
                                .print-container { 
                                  max-width: 800px; 
                                  margin: 0 auto; 
                                }
                                @media print { 
                                  body { 
                                    margin: 0; 
                                    padding: 10px; 
                                  } 
                                  .print-container {
                                    max-width: none;
                                  }
                                }
                                h1, h2, h3 { color: black !important; }
                                .bg-gray-100 { background-color: #f3f4f6 !important; }
                                .border-gray-300 { border-color: #d1d5db !important; }
                                .border-gray-800 { border-color: #1f2937 !important; }
                                .text-gray-600 { color: #4b5563 !important; }
                                .text-gray-500 { color: #6b7280 !important; }
                              </style>
                            </head>
                            <body>
                              <div class="print-container">
                                ${printContent.innerHTML}
                              </div>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => {
                          printWindow.print();
                          printWindow.close();
                        }, 250);
                      }
                    }
                  }}
                  className="gap-2"
                >
                  <Printer size={16} />
                  Print Form
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Students
            </DialogTitle>
            <DialogDescription>
              Apply filters then download a CSV of matching students.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Class filter */}
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select
                value={exportFilters.class_id || 'all'}
                onValueChange={v =>
                  setExportFilters(p => ({ ...p, class_id: v === 'all' ? undefined : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {(classes || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={exportFilters.status || 'all'}
                onValueChange={v =>
                  setExportFilters(p => ({ ...p, status: v === 'all' ? undefined : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STUDENT_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gender filter */}
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select
                value={exportFilters.gender || 'all'}
                onValueChange={v =>
                  setExportFilters(p => ({ ...p, gender: v === 'all' ? undefined : v as 'M' | 'F' }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  {GENDER_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview count */}
            <div className="rounded-md bg-muted px-4 py-3 text-sm flex items-center justify-between">
              <span>
                <span className="font-semibold">{exportPreviewCount}</span>
                <span className="text-muted-foreground">
                  {' '}student{exportPreviewCount !== 1 ? 's' : ''} will be exported
                </span>
              </span>
              {(exportFilters.class_id || exportFilters.status || exportFilters.gender) && (
                <button
                  className="text-xs text-primary underline"
                  onClick={() => setExportFilters({})}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExportFromDialog}
              disabled={exportPreviewCount === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export{exportPreviewCount > 0 ? ` (${exportPreviewCount})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { StudentManagementModule };