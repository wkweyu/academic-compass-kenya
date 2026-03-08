import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Minus, Trash2, Search, Shirt, Receipt,
  Package, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { uniformService, CartItem, UniformItem } from '@/services/uniformService';
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

  const currentTerm = TermManager.getCurrentTerm();
  const currentYear = TermManager.getCurrentYear();

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-uniform'],
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, admission_number, current_class_id, classes(name)')
        .eq('is_active', true)
        .order('full_name');
      return (data || []).map((s: any) => ({
        id: s.id,
        name: s.full_name,
        admission_number: s.admission_number,
        class_name: s.classes?.name,
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

  const filteredStudents = studentSearch.length >= 2
    ? students.filter(s =>
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.admission_number?.toLowerCase().includes(studentSearch.toLowerCase())
      ).slice(0, 10)
    : [];

  const selectedStudent = students.find(s => s.id.toString() === selectedStudentId);
  const cartTotal = cart.reduce((s, i) => s + i.total, 0);

  const addToCart = (item: UniformItem) => {
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
        unit_price: item.unit_price,
        quantity: 1,
        total: item.unit_price,
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

      toast({
        title: 'Uniform issued & charged',
        description: `${formatCurrency(result.total_amount)} debited to ${selectedStudent?.name}`,
      });

      // Reset
      setCart([]);
      setRemarks('');
      setSelectedStudentId('');
      setStudentSearch('');

      // Invalidate relevant queries
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

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="pos"><ShoppingCart className="mr-1.5 h-4 w-4" />Issue Uniform</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" />Issue History</TabsTrigger>
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
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedStudentId(''); setStudentSearch(''); }}>
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
                              onClick={() => { setSelectedStudentId(s.id.toString()); setStudentSearch(''); }}
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
                  <CardDescription>Click an item to add it to the cart</CardDescription>
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
                        const inCart = cart.find(c => c.item_id === item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => addToCart(item)}
                            className="relative text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                          >
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-primary font-bold mt-1">{formatCurrency(item.unit_price)}</p>
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
              <CardDescription>All uniform items issued to students</CardDescription>
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
                      <TableHead>Date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Term</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issueHistory.map(issue => (
                      <TableRow key={issue.id}>
                        <TableCell className="text-sm">
                          {new Date(issue.created_at).toLocaleDateString('en-KE')}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{issue.student_name}</p>
                          <p className="text-xs text-muted-foreground">{issue.admission_number}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {(issue.items || []).map(i =>
                            `${i.item_name} ×${i.quantity}`
                          ).join(', ') || '—'}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(Number(issue.total_amount))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">T{issue.term}/{issue.year}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
