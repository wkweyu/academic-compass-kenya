import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FeeStructure, FEE_ITEMS } from '@/types/fees';
import { feesService } from '@/services/feesService';

export function FeeStructuresTab() {
  const { toast } = useToast();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<FeeStructure | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Mock classes data
  const [classes] = useState([
    { id: 1, name: 'Grade 1' },
    { id: 2, name: 'Grade 2' },
    { id: 3, name: 'Grade 3' },
    { id: 4, name: 'Grade 4' },
    { id: 5, name: 'Grade 5' },
    { id: 6, name: 'Grade 6' },
    { id: 7, name: 'Grade 7' },
    { id: 8, name: 'Grade 8' }
  ]);

  const [structureForm, setStructureForm] = useState({
    academic_year: new Date().getFullYear(),
    term: 2 as 1 | 2 | 3,
    class_id: 0,
    fee_item: '',
    amount: 0,
    is_mandatory: true
  });

  useEffect(() => {
    loadStructures();
  }, []);

  const loadStructures = async () => {
    setLoading(true);
    try {
      const data = await feesService.getFeeStructures();
      setStructures(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load fee structures",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStructure = async () => {
    if (!structureForm.class_id || !structureForm.fee_item || structureForm.amount <= 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await feesService.createFeeStructure({
        ...structureForm,
        school: 1 // Mock school ID
      });
      
      toast({
        title: "Success",
        description: "Fee structure created successfully",
      });
      
      setIsCreateOpen(false);
      resetForm();
      loadStructures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create fee structure",
        variant: "destructive",
      });
    }
  };

  const handleEditStructure = async () => {
    if (!selectedStructure) return;

    try {
      await feesService.updateFeeStructure(selectedStructure.id, {
        ...structureForm
      });
      
      toast({
        title: "Success",
        description: "Fee structure updated successfully",
      });
      
      setIsEditOpen(false);
      setSelectedStructure(null);
      resetForm();
      loadStructures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update fee structure",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStructure = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this fee structure?')) return;

    try {
      await feesService.deleteFeeStructure(id);
      toast({
        title: "Success",
        description: "Fee structure deleted successfully",
      });
      loadStructures();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete fee structure",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (structure: FeeStructure) => {
    setSelectedStructure(structure);
    setStructureForm({
      academic_year: structure.academic_year,
      term: structure.term,
      class_id: structure.class_id,
      fee_item: structure.fee_item,
      amount: structure.amount,
      is_mandatory: structure.is_mandatory
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setStructureForm({
      academic_year: new Date().getFullYear(),
      term: 2,
      class_id: 0,
      fee_item: '',
      amount: 0,
      is_mandatory: true
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredStructures = structures.filter(structure =>
    structure.class_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    structure.fee_item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fee Structures</CardTitle>
            <CardDescription>Define fee amounts for each class and term</CardDescription>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Fee Structure
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Fee Structure</DialogTitle>
                <DialogDescription>
                  Define fee amounts for a specific class and term.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Academic Year</Label>
                    <Input
                      type="number"
                      value={structureForm.academic_year}
                      onChange={(e) => setStructureForm(prev => ({ ...prev, academic_year: parseInt(e.target.value) }))}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>Term</Label>
                    <Select
                      value={structureForm.term.toString()}
                      onValueChange={(value) => setStructureForm(prev => ({ ...prev, term: parseInt(value) as 1 | 2 | 3 }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Term 1</SelectItem>
                        <SelectItem value="2">Term 2</SelectItem>
                        <SelectItem value="3">Term 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label>Class</Label>
                  <Select
                    value={structureForm.class_id.toString()}
                    onValueChange={(value) => setStructureForm(prev => ({ ...prev, class_id: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Fee Item</Label>
                  <Select
                    value={structureForm.fee_item}
                    onValueChange={(value) => setStructureForm(prev => ({ ...prev, fee_item: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fee item" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Amount (KES)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={structureForm.amount}
                    onChange={(e) => setStructureForm(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="mandatory"
                    checked={structureForm.is_mandatory}
                    onCheckedChange={(checked) => setStructureForm(prev => ({ ...prev, is_mandatory: checked }))}
                  />
                  <Label htmlFor="mandatory">Mandatory Fee</Label>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateStructure} className="flex-1">
                    Create Structure
                  </Button>
                  <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Search */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search fee structures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Structures Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Fee Item</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStructures.map((structure) => (
              <TableRow key={structure.id}>
                <TableCell className="font-medium">{structure.class_name}</TableCell>
                <TableCell>
                  <div>
                    <div>{FEE_ITEMS.find(item => item.value === structure.fee_item)?.label}</div>
                    <div className="text-sm text-muted-foreground">{structure.fee_item}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatCurrency(structure.amount)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">Term {structure.term}</Badge>
                </TableCell>
                <TableCell>{structure.academic_year}</TableCell>
                <TableCell>
                  <Badge className={structure.is_mandatory ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                    {structure.is_mandatory ? 'Mandatory' : 'Optional'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(structure)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteStructure(structure.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredStructures.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>No fee structures found.</p>
            <p className="text-sm">Create fee structures to define what each class should pay per term.</p>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fee Structure</DialogTitle>
            <DialogDescription>
              Update fee structure details.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Academic Year</Label>
                <Input
                  type="number"
                  value={structureForm.academic_year}
                  onChange={(e) => setStructureForm(prev => ({ ...prev, academic_year: parseInt(e.target.value) }))}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Term</Label>
                <Select
                  value={structureForm.term.toString()}
                  onValueChange={(value) => setStructureForm(prev => ({ ...prev, term: parseInt(value) as 1 | 2 | 3 }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Term 1</SelectItem>
                    <SelectItem value="2">Term 2</SelectItem>
                    <SelectItem value="3">Term 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select
                value={structureForm.class_id.toString()}
                onValueChange={(value) => setStructureForm(prev => ({ ...prev, class_id: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>Fee Item</Label>
              <Select
                value={structureForm.fee_item}
                onValueChange={(value) => setStructureForm(prev => ({ ...prev, fee_item: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select fee item" />
                </SelectTrigger>
                <SelectContent>
                  {FEE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={structureForm.amount}
                onChange={(e) => setStructureForm(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="mandatory-edit"
                checked={structureForm.is_mandatory}
                onCheckedChange={(checked) => setStructureForm(prev => ({ ...prev, is_mandatory: checked }))}
              />
              <Label htmlFor="mandatory-edit">Mandatory Fee</Label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button onClick={handleEditStructure} className="flex-1">
                Update Structure
              </Button>
              <Button variant="outline" onClick={() => { setIsEditOpen(false); setSelectedStructure(null); resetForm(); }} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}