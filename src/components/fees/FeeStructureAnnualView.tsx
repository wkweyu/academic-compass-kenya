import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { feesService, StructureGroup } from '@/services/feesService';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

export function FeeStructureAnnualView() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const { data: groups = [] } = useQuery({
    queryKey: ['fee-structure-groups'],
    queryFn: () => feesService.getStructureGroups(),
  });

  const year = parseInt(selectedYear);
  const yearGroups = groups.filter(g => g.academic_year === year);

  // Group by student_group
  const categories = [...new Set(yearGroups.map(g => g.student_group))];

  // Collect all unique vote head names across all groups
  const allVoteHeads = [...new Set(yearGroups.flatMap(g => (g.items || []).map(i => i.vote_head_name || '')))].filter(Boolean);

  // Available years from data
  const availableYears = [...new Set(groups.map(g => g.academic_year))].sort((a, b) => b - a);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Annual Fee Structure Summary</CardTitle>
            <CardDescription>Term breakdown with annual totals by student category</CardDescription>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
              {availableYears.length === 0 && (
                <SelectItem value={selectedYear}>{selectedYear}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">
            No fee structures found for {year}. Create structures in the Structures tab.
          </p>
        )}

        {categories.map(category => {
          const catGroups = yearGroups.filter(g => g.student_group === category);
          const term1 = catGroups.find(g => g.term === 1);
          const term2 = catGroups.find(g => g.term === 2);
          const term3 = catGroups.find(g => g.term === 3);

          const getAmount = (group: StructureGroup | undefined, vhName: string): number => {
            if (!group) return 0;
            const item = (group.items || []).find(i => i.vote_head_name === vhName);
            return item ? Number(item.amount) : 0;
          };

          const term1Total = term1?.total || 0;
          const term2Total = term2?.total || 0;
          const term3Total = term3?.total || 0;
          const annualTotal = term1Total + term2Total + term3Total;

          return (
            <div key={category} className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg capitalize">{category === 'all' ? 'All Students' : category}</h3>
                  <Badge variant="secondary">{year}</Badge>
                </div>
                <div className="text-lg font-bold">
                  Annual: {formatCurrency(annualTotal)}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vote Head</TableHead>
                    <TableHead className="text-right">Term 1</TableHead>
                    <TableHead className="text-right">Term 2</TableHead>
                    <TableHead className="text-right">Term 3</TableHead>
                    <TableHead className="text-right font-bold">Annual Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allVoteHeads.map(vh => {
                    const t1 = getAmount(term1, vh);
                    const t2 = getAmount(term2, vh);
                    const t3 = getAmount(term3, vh);
                    const total = t1 + t2 + t3;
                    if (total === 0) return null;
                    return (
                      <TableRow key={vh}>
                        <TableCell className="font-medium">{vh}</TableCell>
                        <TableCell className="text-right">{t1 > 0 ? formatCurrency(t1) : '-'}</TableCell>
                        <TableCell className="text-right">{t2 > 0 ? formatCurrency(t2) : '-'}</TableCell>
                        <TableCell className="text-right">{t3 > 0 ? formatCurrency(t3) : '-'}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold border-t-2 bg-muted/50">
                    <TableCell>TERM TOTALS</TableCell>
                    <TableCell className="text-right">{formatCurrency(term1Total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(term2Total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(term3Total)}</TableCell>
                    <TableCell className="text-right text-primary">{formatCurrency(annualTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
