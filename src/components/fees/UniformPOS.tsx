import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Minus, Trash2, Search, Shirt, Receipt,
  Package, History, ChevronDown, ChevronRight, Printer, Settings,
  FileText, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { uniformService, CartItem, UniformItem, UniformIssue, ClassGroup } from '@/services/uniformService';
import { TermManager } from '@/utils/termManager';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export function UniformPOS() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('pos');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [remarks, setRemarks] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [expandedIssueId, setExpandedIssueId] = useState<number | null>(null);
  const [lastIssue, setLastIssue] = useState<UniformIssue | null>(null);
  const [showIssuanceForm, setShowIssuanceForm] = useState(false);
  // Pricing config
  const [showPricingConfig, setShowPricingConfig] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMin, setNewGroupMin] = useState('');
  const [newGroupMax, setNewGroupMax] = useState('');
  const [pricingItemId, setPricingItemId] = useState<number | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});

  const printRef = useRef<HTMLDivElement>(null);

  const currentTerm = TermManager.getCurrentTerm();
  const currentYear = TermManager.getCurrentYear();

  // Students with grade level info
  const { data: students = [] } = useQuery({
    queryKey: ['students-for-uniform'],
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, admission_number, current_class_id, classes(name, grade_level)')
        .eq('is_active', true)
        .order('full_name');
      return (data || []).map((s: any) => ({
        id: s.id,
        name: s.full_name,
        admission_number: s.admission_number,
        class_name: s.classes?.name,
        grade_level: s.classes?.grade_level ?? 0,
      }));
    },
  });

  const { data: uniformItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['uniform-items'],
    queryFn: () => uniformService.getUniformItems(),
  });

  const { data: issueHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['uniform-issue-history'],
    queryFn: () => uniformService.getIssueHistory(),
    enabled: activeSubTab === 'history',
  });

  const { data: classGroups = [] } = useQuery({
    queryKey: ['uniform-class-groups'],
    queryFn: () => uniformService.getClassGroups(),
  });

  const { data: allItemPrices = [] } = useQuery({
    queryKey: ['uniform-item-prices'],
    queryFn: () => uniformService.getItemPrices(),
  });

  const filteredStudents = studentSearch.length >= 2
    ? students.filter(s =>
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.admission_number?.toLowerCase().includes(studentSearch.toLowerCase())
      ).slice(0, 10)
    : [];

  const selectedStudent = students.find(s => s.id.toString() === selectedStudentId);
  const cartTotal = cart.reduce((s, i) => s + i.total, 0);

  // Resolve price for item based on selected student's grade level
  const getResolvedPrice = (item: UniformItem): { price: number; groupName: string } => {
    if (!selectedStudent) return { price: item.unit_price, groupName: 'Default' };
    const gradeLevel = selectedStudent.grade_level;
    const itemPrices = allItemPrices.filter(p => p.item_id === item.id);
    if (itemPrices.length > 0) {
      const matchGroup = classGroups.find(g =>
        gradeLevel >= g.min_grade_level && gradeLevel <= g.max_grade_level &&
        itemPrices.some(p => p.class_group_id === g.id)
      );
      if (matchGroup) {
        const matched = itemPrices.find(p => p.class_group_id === matchGroup.id);
        if (matched) return { price: matched.price, groupName: matchGroup.name };
      }
    }
    return { price: item.unit_price, groupName: 'Default' };
  };

  const addToCart = (item: UniformItem) => {
    const { price, groupName } = getResolvedPrice(item);
    setCart(prev => {
      const existing = prev.find(c => c.item_id === item.id);
      if (existing) {
        return prev.map(c =>
          c.item_id === item.id
            ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.unit_price }
            : c
        );
      }
      return [...prev, {
        item_id: item.id,
        item_name: item.name,
        unit_price: price,
        quantity: 1,
        total: price,
        class_group_name: groupName,
      }];
    });
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(prev =>
      prev.map(c => {
        if (c.item_id !== itemId) return c;
        const newQty = Math.max(1, c.quantity + delta);
        return { ...c, quantity: newQty, total: newQty * c.unit_price };
      })
    );
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => prev.filter(c => c.item_id !== itemId));
  };

  const handleIssueAndCharge = async () => {
    if (!selectedStudentId) {
      toast({ title: 'Select a student', variant: 'destructive' });
      return;
    }
    if (cart.length === 0) {
      toast({ title: 'Add items to cart', variant: 'destructive' });
      return;
    }

    setIsPosting(true);
    try {
      const result = await uniformService.issueUniform({
        student_id: parseInt(selectedStudentId),
        items: cart,
        term: currentTerm,
        year: currentYear,
        remarks,
      });

      // Attach student info for the issuance form
      result.student_name = selectedStudent?.name;
      result.admission_number = selectedStudent?.admission_number;
      result.class_name = selectedStudent?.class_name;
      setLastIssue(result);
      setShowIssuanceForm(true);

      toast({
        title: 'Uniform issued & charged',
        description: `${formatCurrency(result.total_amount)} debited to ${selectedStudent?.name}`,
      });

      setCart([]);
      setRemarks('');
      setSelectedStudentId('');
      setStudentSearch('');

      queryClient.invalidateQueries({ queryKey: ['fees-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-ledgers'] });
      queryClient.invalidateQueries({ queryKey: ['student-statement'] });
      queryClient.invalidateQueries({ queryKey: ['uniform-issue-history'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsPosting(false);
    }
  };

  // Print stores issuance form
  const handlePrintIssuance = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Stores Issuance Form</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
        h2 { text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #555; margin-bottom: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #f0f0f0; font-weight: bold; }
        .total-row td { font-weight: bold; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px; }
        .signature { margin-top: 40px; display: flex; justify-content: space-between; }
        .sig-line { width: 200px; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  // Mark as issued by stores
  const markStoreMutation = useMutation({
    mutationFn: (issueId: number) => uniformService.markStoreIssued(issueId),
    onSuccess: () => {
      toast({ title: 'Marked as issued by stores' });
      queryClient.invalidateQueries({ queryKey: ['uniform-issue-history'] });
    },
  });

  // Pricing config handlers
  const handleAddGroup = async () => {
    if (!newGroupName || !newGroupMin || !newGroupMax) return;
    try {
      await uniformService.createClassGroup({
        school_id: 0,
        name: newGroupName,
        min_grade_level: parseInt(newGroupMin),
        max_grade_level: parseInt(newGroupMax),
      });
      setNewGroupName(''); setNewGroupMin(''); setNewGroupMax('');
      queryClient.invalidateQueries({ queryKey: ['uniform-class-groups'] });
      toast({ title: 'Class group added' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleSavePrice = async (classGroupId: number) => {
    if (!pricingItemId) return;
    const val = parseFloat(priceInputs[classGroupId] || '0');
    if (val <= 0) return;
    try {
      await uniformService.upsertItemPrice({ item_id: pricingItemId, class_group_id: classGroupId, price: val });
      queryClient.invalidateQueries({ queryKey: ['uniform-item-prices'] });
      toast({ title: 'Price saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="pos"><ShoppingCart className="mr-1.5 h-4 w-4" />Issue Uniform</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" />Issue History</TabsTrigger>
          <TabsTrigger value="pricing"><Settings className="mr-1.5 h-4 w-4" />Pricing</TabsTrigger>
        </TabsList>

        {/* ===== POS TAB ===== */}
        <TabsContent value="pos" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left: Student + Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Student Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Select Student</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedStudent ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-semibold">{selectedStudent.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedStudent.admission_number} • {selectedStudent.class_name}
                          <span className="ml-2 text-xs">(Grade Level: {selectedStudent.grade_level})</span>
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedStudentId(''); setStudentSearch(''); setCart([]); }}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or admission number..."
                          value={studentSearch}
                          onChange={e => setStudentSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {filteredStudents.length > 0 && (
                        <div className="border rounded-md max-h-48 overflow-y-auto">
                          {filteredStudents.map(s => (
                            <button
                              key={s.id}
                              className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-0"
                              onClick={() => { setSelectedStudentId(s.id.toString()); setStudentSearch(''); setCart([]); }}
                            >
                              <span className="font-medium">{s.name}</span>
                              <span className="text-muted-foreground ml-2">{s.admission_number} • {s.class_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Uniform Items Grid */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shirt className="h-4 w-4" /> Uniform Items
                  </CardTitle>
                  <CardDescription>
                    {selectedStudent
                      ? `Prices shown for ${selectedStudent.class_name} (Grade ${selectedStudent.grade_level})`
                      : 'Select a student first to see class-specific prices'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {itemsLoading ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">Loading items...</p>
                  ) : uniformItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No uniform items found</p>
                      <p className="text-sm mt-1">
                        Add items under Procurement → Items with category "Uniform"
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {uniformItems.map(item => {
                        const { price, groupName } = getResolvedPrice(item);
                        const inCart = cart.find(c => c.item_id === item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => addToCart(item)}
                            disabled={!selectedStudent}
                            className="relative text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-primary font-bold mt-1">{formatCurrency(price)}</p>
                            {groupName !== 'Default' && (
                              <p className="text-xs text-muted-foreground">{groupName}</p>
                            )}
                            {inCart && (
                              <Badge className="absolute top-2 right-2" variant="default">
                                {inCart.quantity}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Cart */}
            <div>
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Cart
                    {cart.length > 0 && (
                      <Badge variant="secondary">{cart.length} item{cart.length > 1 ? 's' : ''}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cart.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-6">
                      No items in cart
                    </p>
                  ) : (
                    <>
                      {cart.map(item => (
                        <div key={item.item_id} className="flex items-center gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.item_name}</p>
                            <p className="text-muted-foreground text-xs">
                              {formatCurrency(item.unit_price)} × {item.quantity}
                              {item.class_group_name && item.class_group_name !== 'Default' && (
                                <span className="ml-1">({item.class_group_name})</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-6 w-6"
                              onClick={() => updateQuantity(item.item_id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center font-medium">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6"
                              onClick={() => updateQuantity(item.item_id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                              onClick={() => removeFromCart(item.item_id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-semibold w-20 text-right">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>Total</span>
                        <span className="text-primary">{formatCurrency(cartTotal)}</span>
                      </div>
                    </>
                  )}

                  <div>
                    <Label className="text-xs">Remarks (optional)</Label>
                    <Textarea
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="e.g. Term 1 uniform set"
                      className="mt-1 h-16"
                    />
                  </div>

                  <div className="p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                    <p><strong>Term:</strong> {currentTerm} | <strong>Year:</strong> {currentYear}</p>
                    <p className="mt-1">Charges auto-debit the student's Uniform votehead</p>
                  </div>

                  <Button
                    onClick={handleIssueAndCharge}
                    disabled={isPosting || cart.length === 0 || !selectedStudentId}
                    className="w-full"
                    size="lg"
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    {isPosting ? 'Processing...' : `Issue & Charge ${formatCurrency(cartTotal)}`}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Uniform Issue History</CardTitle>
              <CardDescription>Click a row to see individual items billed</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
              ) : issueHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No uniform issues recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Store Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issueHistory.map(issue => (
                      <>
                        <TableRow
                          key={issue.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id)}
                        >
                          <TableCell>
                            {expandedIssueId === issue.id
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />
                            }
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(issue.created_at).toLocaleDateString('en-KE')}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{issue.student_name}</p>
                            <p className="text-xs text-muted-foreground">{issue.admission_number}</p>
                          </TableCell>
                          <TableCell className="text-sm">
                            {(issue.items || []).length} item{(issue.items || []).length !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(Number(issue.total_amount))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">T{issue.term}/{issue.year}</Badge>
                          </TableCell>
                          <TableCell>
                            {issue.store_issued ? (
                              <Badge variant="default" className="bg-green-600 text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Issued
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => { setLastIssue(issue); setShowIssuanceForm(true); }}
                              >
                                <Printer className="h-3 w-3 mr-1" /> Form
                              </Button>
                              {!issue.store_issued && (
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => markStoreMutation.mutate(issue.id)}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Issued
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedIssueId === issue.id && (
                          <TableRow key={`${issue.id}-detail`}>
                            <TableCell colSpan={8} className="bg-muted/30 p-0">
                              <div className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Items Billed</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Item</TableHead>
                                      <TableHead>Price Tier</TableHead>
                                      <TableHead className="text-right">Unit Price</TableHead>
                                      <TableHead className="text-right">Qty</TableHead>
                                      <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(issue.items || []).map((item, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell className="font-medium">{item.item_name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                          {item.class_group_name || '—'}
                                        </TableCell>
                                        <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(Number(item.total))}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                                {issue.remarks && (
                                  <p className="text-xs text-muted-foreground mt-2"><strong>Remarks:</strong> {issue.remarks}</p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PRICING TAB ===== */}
        <TabsContent value="pricing" className="space-y-4">
          {/* Class Groups */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Class Groups (Price Tiers)</CardTitle>
              <CardDescription>
                Define grade-level ranges for pricing tiers, e.g. "PG-PP2" = grade 0–2
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap items-end">
                <div>
                  <Label className="text-xs">Group Name</Label>
                  <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                    placeholder="e.g. PG-PP2" className="w-40 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Min Grade</Label>
                  <Input type="number" value={newGroupMin} onChange={e => setNewGroupMin(e.target.value)}
                    placeholder="0" className="w-24 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Max Grade</Label>
                  <Input type="number" value={newGroupMax} onChange={e => setNewGroupMax(e.target.value)}
                    placeholder="2" className="w-24 mt-1" />
                </div>
                <Button onClick={handleAddGroup} size="sm">
                  <Plus className="h-3 w-3 mr-1" /> Add Group
                </Button>
              </div>
              {classGroups.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {classGroups.map(g => (
                    <Badge key={g.id} variant="outline" className="text-sm py-1 px-3">
                      {g.name} (Grade {g.min_grade_level}–{g.max_grade_level})
                      <button
                        className="ml-2 text-destructive hover:text-destructive/80"
                        onClick={async () => {
                          await uniformService.deleteClassGroup(g.id);
                          queryClient.invalidateQueries({ queryKey: ['uniform-class-groups'] });
                        }}
                      >×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Item-level Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Item Prices per Class Group</CardTitle>
              <CardDescription>Set different prices for each uniform item per class group</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {uniformItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">No uniform items found. Add them under Procurement first.</p>
              ) : (
                <div className="space-y-4">
                  {uniformItems.map(item => {
                    const isOpen = pricingItemId === item.id;
                    const itemPrices = allItemPrices.filter(p => p.item_id === item.id);
                    return (
                      <div key={item.id} className="border rounded-lg">
                        <button
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30"
                          onClick={() => {
                            setPricingItemId(isOpen ? null : item.id);
                            // Pre-fill existing prices
                            const inputs: Record<number, string> = {};
                            for (const ip of itemPrices) {
                              inputs[ip.class_group_id] = ip.price.toString();
                            }
                            setPriceInputs(inputs);
                          }}
                        >
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">Default: {formatCurrency(item.unit_price)}</p>
                          </div>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 space-y-2">
                            {classGroups.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Add class groups above first.</p>
                            ) : (
                              classGroups.map(g => (
                                <div key={g.id} className="flex items-center gap-2">
                                  <span className="text-sm w-36">{g.name}</span>
                                  <Input
                                    type="number"
                                    className="w-28"
                                    placeholder={item.unit_price.toString()}
                                    value={priceInputs[g.id] || ''}
                                    onChange={e => setPriceInputs(prev => ({ ...prev, [g.id]: e.target.value }))}
                                  />
                                  <Button variant="outline" size="sm" onClick={() => handleSavePrice(g.id)}>
                                    Save
                                  </Button>
                                  {itemPrices.find(p => p.class_group_id === g.id) && (
                                    <Badge variant="secondary" className="text-xs">
                                      {formatCurrency(itemPrices.find(p => p.class_group_id === g.id)!.price)}
                                    </Badge>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== STORES ISSUANCE FORM DIALOG ===== */}
      <Dialog open={showIssuanceForm} onOpenChange={setShowIssuanceForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Stores Issuance Form
            </DialogTitle>
          </DialogHeader>

          <div ref={printRef}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold' }}>UNIFORM STORES ISSUANCE FORM</h2>
            <p className="subtitle" style={{ textAlign: 'center', color: '#666', marginBottom: 16, fontSize: 13 }}>
              Date: {lastIssue ? new Date(lastIssue.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
              <div>
                <p><strong>Student:</strong> {lastIssue?.student_name}</p>
                <p><strong>Adm No:</strong> {lastIssue?.admission_number}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p><strong>Class:</strong> {lastIssue?.class_name}</p>
                <p><strong>Term:</strong> {lastIssue?.term} / {lastIssue?.year}</p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #333', padding: '6px 10px', background: '#f0f0f0', textAlign: 'left', fontSize: 12 }}>#</th>
                  <th style={{ border: '1px solid #333', padding: '6px 10px', background: '#f0f0f0', textAlign: 'left', fontSize: 12 }}>Item</th>
                  <th style={{ border: '1px solid #333', padding: '6px 10px', background: '#f0f0f0', textAlign: 'right', fontSize: 12 }}>Qty</th>
                  <th style={{ border: '1px solid #333', padding: '6px 10px', background: '#f0f0f0', textAlign: 'right', fontSize: 12 }}>Unit Price</th>
                  <th style={{ border: '1px solid #333', padding: '6px 10px', background: '#f0f0f0', textAlign: 'right', fontSize: 12 }}>Total</th>
                  <th style={{ border: '1px solid #333', padding: '6px 10px', background: '#f0f0f0', textAlign: 'center', fontSize: 12 }}>Issued ✓</th>
                </tr>
              </thead>
              <tbody>
                {(lastIssue?.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #333', padding: '6px 10px', fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #333', padding: '6px 10px', fontSize: 12 }}>{item.item_name}</td>
                    <td style={{ border: '1px solid #333', padding: '6px 10px', textAlign: 'right', fontSize: 12 }}>{item.quantity}</td>
                    <td style={{ border: '1px solid #333', padding: '6px 10px', textAlign: 'right', fontSize: 12 }}>{formatCurrency(Number(item.unit_price))}</td>
                    <td style={{ border: '1px solid #333', padding: '6px 10px', textAlign: 'right', fontSize: 12 }}>{formatCurrency(Number(item.total))}</td>
                    <td style={{ border: '1px solid #333', padding: '6px 10px', textAlign: 'center', fontSize: 12 }}>☐</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #333', padding: '6px 10px', fontWeight: 'bold', textAlign: 'right', fontSize: 12 }}>TOTAL</td>
                  <td style={{ border: '1px solid #333', padding: '6px 10px', fontWeight: 'bold', textAlign: 'right', fontSize: 12 }}>
                    {formatCurrency(Number(lastIssue?.total_amount || 0))}
                  </td>
                  <td style={{ border: '1px solid #333', padding: '6px 10px', fontSize: 12 }}></td>
                </tr>
              </tbody>
            </table>

            {lastIssue?.remarks && (
              <p style={{ fontSize: 12, marginTop: 8 }}><strong>Remarks:</strong> {lastIssue.remarks}</p>
            )}

            <div style={{ marginTop: 50, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: 180, borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center', fontSize: 11 }}>
                Accounts Officer
              </div>
              <div style={{ width: 180, borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center', fontSize: 11 }}>
                Stores Officer
              </div>
              <div style={{ width: 180, borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center', fontSize: 11 }}>
                Student/Parent
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssuanceForm(false)}>Close</Button>
            <Button onClick={handlePrintIssuance}>
              <Printer className="h-4 w-4 mr-2" /> Print Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
