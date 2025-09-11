import { useState, useEffect } from 'react';
import { 
  Plus, Search, DollarSign, Receipt, CreditCard, AlertCircle, 
  TrendingUp, Users, Calendar, Download, Filter, FileText,
  Banknote, PiggyBank, Clock, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Invoice, 
  Payment, 
  FeeBalance, 
  FeesStats, 
  FeesFilters,
  PAYMENT_METHODS,
  INVOICE_STATUS_OPTIONS 
} from '@/types/fees';
import { feesService } from '@/services/feesService';
import { FeeStructuresTab } from '@/components/modules/FeeStructuresTab';
import { PaymentEntryDialog } from '@/components/modules/PaymentEntryDialog';

export const FeesManagementModule = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balances, setBalances] = useState<FeeBalance[]>([]);
  const [stats, setStats] = useState<FeesStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FeesFilters>({});
  const [activeTab, setActiveTab] = useState('overview');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadData();
  }, [filters, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData] = await Promise.all([
        feesService.getFeesStats()
      ]);
      
      setStats(statsData);
      
      // Load tab-specific data
      if (activeTab === 'invoices') {
        const invoicesData = await feesService.getInvoices(filters);
        setInvoices(invoicesData);
      } else if (activeTab === 'payments') {
        const paymentsData = await feesService.getPayments(filters);
        setPayments(paymentsData);
      } else if (activeTab === 'balances') {
        const balancesData = await feesService.getFeeBalances(filters);
        setBalances(balancesData);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load fees data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoices = async () => {
    if (!window.confirm('Generate invoices for the selected term? This will create invoices for all students in the class.')) return;
    
    try {
      const result = await feesService.generateInvoices(5, 2, 2024); // Mock values
      toast({
        title: "Success",
        description: `Generated ${result.generated} invoices successfully`,
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate invoices",
        variant: "destructive",
      });
    }
  };

  const handleExportData = async (type: 'invoices' | 'payments') => {
    try {
      const blob = type === 'invoices' 
        ? await feesService.exportInvoices(filters)
        : await feesService.exportPayments(filters);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: `${type} exported successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to export ${type}`,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    const statusOption = INVOICE_STATUS_OPTIONS.find(s => s.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
  };

  const getPaymentMethodColor = (method: string) => {
    const methodOption = PAYMENT_METHODS.find(m => m.value === method);
    return methodOption?.color || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getBalanceStatusColor = (status: string) => {
    switch (status) {
      case 'clear': return 'bg-green-100 text-green-800';
      case 'owing': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'overpaid': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees Management</h1>
          <p className="text-muted-foreground">
            Manage school fees, invoices, payments, and financial reporting
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExportData('invoices')}>
            <Download className="mr-2 h-4 w-4" />
            Export Invoices
          </Button>
          
          <Button variant="outline" onClick={handleGenerateInvoices}>
            <FileText className="mr-2 h-4 w-4" />
            Generate Invoices
          </Button>
          
          <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </DialogTrigger>
            <PaymentEntryDialog
              isOpen={isPaymentDialogOpen}
              onOpenChange={setIsPaymentDialogOpen}
              selectedInvoice={selectedInvoice}
              onPaymentRecorded={() => {
                loadData();
                setSelectedInvoice(null);
              }}
            />
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.total_invoiced)}</div>
              <p className="text-xs text-muted-foreground">
                This academic year
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_collected)}</div>
              <Progress value={stats.collection_rate} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {stats.collection_rate}% collection rate
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.total_outstanding)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.students_owing} students owing
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.overdue_amount)}</div>
              <p className="text-xs text-muted-foreground">
                Requires follow-up
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="balances">Student Balances</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue by Term */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Term</CardTitle>
                <CardDescription>Income distribution across terms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.revenue_by_term.map((term) => (
                    <div key={term.term} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Term {term.term}</span>
                        <span className="text-sm">{formatCurrency(term.amount)}</span>
                      </div>
                      <Progress value={(term.amount / (stats.total_invoiced || 1)) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Collection by payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.collection_by_method.map((method) => (
                    <div key={method.method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getPaymentMethodColor(method.method.toLowerCase().replace(' ', '_'))}>
                          {method.method}
                        </Badge>
                      </div>
                      <span className="font-medium">{formatCurrency(method.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Class Collection Rates */}
          <Card>
            <CardHeader>
              <CardTitle>Collection Rates by Class</CardTitle>
              <CardDescription>Payment performance across different classes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.class_collection_rates.map((classRate) => (
                  <div key={classRate.class_name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{classRate.class_name}</span>
                      <span className="text-sm">{classRate.rate}%</span>
                    </div>
                    <Progress value={classRate.rate} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structures" className="space-y-4">
          <FeeStructuresTab />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Invoices</CardTitle>
              <CardDescription>Manage billing and invoice generation</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6 flex-wrap">
                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search invoices..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="max-w-sm"
                  />
                </div>
                
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    status: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {INVOICE_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => handleExportData('invoices')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>

              {/* Invoices Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Paid Amount</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.student_name}</div>
                          <div className="text-sm text-muted-foreground">{invoice.admission_number}</div>
                        </div>
                      </TableCell>
                      <TableCell>{invoice.class_name}</TableCell>
                      <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(invoice.paid_amount)}</TableCell>
                      <TableCell>
                        <span className={invoice.balance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                          {formatCurrency(invoice.balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setIsPaymentDialogOpen(true);
                            }}
                          >
                            <CreditCard className="h-4 w-4" />
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

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Records</CardTitle>
              <CardDescription>Track all fee payments and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6 flex-wrap">
                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search payments..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="max-w-sm"
                  />
                </div>
                
                <Select
                  value={filters.payment_method || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    payment_method: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => handleExportData('payments')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>

              {/* Payments Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Posted By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.student_name}</div>
                          <div className="text-sm text-muted-foreground">{payment.admission_number}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge className={getPaymentMethodColor(payment.payment_method)}>
                          {PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-mono text-sm">{payment.reference_no}</div>
                          {payment.mpesa_code && (
                            <div className="text-xs text-muted-foreground">{payment.mpesa_code}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(payment.received_on).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.posted_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Fee Balances</CardTitle>
              <CardDescription>Current fee balances and payment status for all students</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats?.students_clear}</div>
                    <div className="text-sm text-muted-foreground">Students Clear</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats?.students_owing}</div>
                    <div className="text-sm text-muted-foreground">Students Owing</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <Clock className="h-8 w-8 text-red-500" />
                  <div>
                    <div className="text-2xl font-bold">{formatCurrency(stats?.overdue_amount || 0)}</div>
                    <div className="text-sm text-muted-foreground">Overdue</div>
                  </div>
                </div>
              </div>

              {/* Balances Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Total Invoiced</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Current Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance) => (
                    <TableRow key={balance.student_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{balance.student_name}</div>
                          <div className="text-sm text-muted-foreground">{balance.admission_number}</div>
                        </div>
                      </TableCell>
                      <TableCell>{balance.class_name}</TableCell>
                      <TableCell>{formatCurrency(balance.total_invoiced)}</TableCell>
                      <TableCell>{formatCurrency(balance.total_paid)}</TableCell>
                      <TableCell>
                        <span className={balance.current_balance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                          {formatCurrency(balance.current_balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getBalanceStatusColor(balance.status)}>
                          {balance.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {balance.last_payment_date 
                          ? new Date(balance.last_payment_date).toLocaleDateString() 
                          : 'No payments'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Reports</CardTitle>
                <CardDescription>Generate common financial reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Outstanding Balances Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Collection Performance Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="mr-2 h-4 w-4" />
                  Monthly Revenue Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Class-wise Fee Analysis
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
                <CardDescription>Download data for external analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start" onClick={() => handleExportData('invoices')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export All Invoices
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => handleExportData('payments')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export All Payments
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Export Fee Balances
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Export for Accounting
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};