import { useState, useEffect } from 'react';
import { staffService, LeaveRequest } from '@/services/teacherService';
import { Staff } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Calendar as CalendarIcon, Check, X, Clock, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

const LEAVE_TYPES = [
  { value: 'Annual', label: 'Annual Leave', days: 21 },
  { value: 'Sick', label: 'Sick Leave', days: 14 },
  { value: 'Maternity', label: 'Maternity Leave', days: 90 },
  { value: 'Paternity', label: 'Paternity Leave', days: 14 },
  { value: 'Study', label: 'Study Leave', days: 30 },
  { value: 'Emergency', label: 'Emergency Leave', days: 5 },
  { value: 'Compassionate', label: 'Compassionate Leave', days: 7 },
];

const LeaveManagementModule = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // New leave request form
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    staff_id: 0,
    leave_type: '',
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    reason: ''
  });

  // Rejection dialog
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, requestsData] = await Promise.all([
        staffService.getStaff({ status: 'Active' }),
        staffService.getLeaveRequests()
      ]);
      setStaff(staffData);
      setLeaveRequests(requestsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!newRequest.staff_id || !newRequest.leave_type || !newRequest.start_date || !newRequest.end_date) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await staffService.createLeaveRequest({
        staff_id: newRequest.staff_id,
        leave_type: newRequest.leave_type,
        start_date: format(newRequest.start_date, 'yyyy-MM-dd'),
        end_date: format(newRequest.end_date, 'yyyy-MM-dd'),
        reason: newRequest.reason
      });
      toast.success('Leave request created');
      setIsNewRequestOpen(false);
      setNewRequest({ staff_id: 0, leave_type: '', start_date: undefined, end_date: undefined, reason: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to create leave request');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await staffService.updateLeaveRequest(id, 'Approved');
      toast.success('Leave request approved');
      loadData();
    } catch (error) {
      toast.error('Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;
    
    try {
      await staffService.updateLeaveRequest(rejectingRequest.id, 'Rejected', rejectionReason);
      toast.success('Leave request rejected');
      setIsRejectDialogOpen(false);
      setRejectingRequest(null);
      setRejectionReason('');
      loadData();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const filteredRequests = leaveRequests.filter(r => 
    selectedStatus === 'all' || r.status === selectedStatus
  );

  const pendingCount = leaveRequests.filter(r => r.status === 'Pending').length;
  const approvedCount = leaveRequests.filter(r => r.status === 'Approved').length;
  const rejectedCount = leaveRequests.filter(r => r.status === 'Rejected').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const daysRequested = newRequest.start_date && newRequest.end_date
    ? differenceInDays(newRequest.end_date, newRequest.start_date) + 1
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={pendingCount > 0 ? 'border-yellow-300 bg-yellow-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className={`h-8 w-8 ${pendingCount > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Check className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{approvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <X className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">{rejectedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{leaveRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>Manage staff leave applications</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Request
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Leave Request</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Staff Member</Label>
                      <Select
                        value={String(newRequest.staff_id)}
                        onValueChange={(v) => setNewRequest(prev => ({ ...prev, staff_id: parseInt(v) }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.full_name || `${s.first_name} ${s.last_name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Leave Type</Label>
                      <Select
                        value={newRequest.leave_type}
                        onValueChange={(v) => setNewRequest(prev => ({ ...prev, leave_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAVE_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label} (max {type.days} days)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {newRequest.start_date ? format(newRequest.start_date, 'PP') : 'Pick date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={newRequest.start_date}
                              onSelect={(date) => setNewRequest(prev => ({ ...prev, start_date: date }))}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {newRequest.end_date ? format(newRequest.end_date, 'PP') : 'Pick date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={newRequest.end_date}
                              onSelect={(date) => setNewRequest(prev => ({ ...prev, end_date: date }))}
                              disabled={(date) => newRequest.start_date ? date < newRequest.start_date : false}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {daysRequested > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Duration: <strong>{daysRequested} day{daysRequested > 1 ? 's' : ''}</strong>
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Textarea
                        value={newRequest.reason}
                        onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="Enter reason for leave..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNewRequestOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateRequest}>
                      Submit Request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leave requests found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.staff_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.leave_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{request.days_requested}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{request.reason || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === 'Pending' && (
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            onClick={() => handleApprove(request.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => {
                              setRejectingRequest(request);
                              setIsRejectDialogOpen(true);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {request.status === 'Rejected' && request.rejection_reason && (
                        <span className="text-sm text-muted-foreground">
                          {request.rejection_reason}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this leave request.
            </p>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagementModule;