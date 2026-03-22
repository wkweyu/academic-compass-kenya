import { BarChart3, FlaskConical, Package, Wallet, type LucideIcon } from 'lucide-react';

import type { IGAOverviewReport } from '@/services/igaService';

export const today = new Date().toISOString().slice(0, 10);

export const expenseCategoryOptions = [
  { value: 'feed', label: 'Feed' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'seeds', label: 'Seeds' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'labour', label: 'Labour' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
] as const;

export const formatCurrency = (value?: string | number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(Number(value || 0));

export const formatNumber = (value?: string | number) =>
  new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

export const humanizeLabel = (value?: string | null) => (value || '').replace(/_/g, ' ');

export interface SummaryCardItem {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
}

const expenseApprovalRoles = new Set(['superadmin', 'schooladmin', 'admin', 'principal', 'headteacher']);

export function canApproveExpenses(role?: string | null) {
  return expenseApprovalRoles.has(String(role || '').trim().toLowerCase());
}

export function buildSummaryCards(overview?: IGAOverviewReport): SummaryCardItem[] {
  if (!overview) {
    return [];
  }

  return [
    {
      title: 'Active Activities',
      value: overview.summary.active_activity_count,
      description: `${overview.summary.activity_count} total activities`,
      icon: FlaskConical,
    },
    {
      title: 'Inventory Value',
      value: formatCurrency(overview.summary.stock_value),
      description: `${overview.summary.product_count} tracked products`,
      icon: Package,
    },
    {
      title: 'Net Income',
      value: formatCurrency(overview.summary.net_income),
      description: `${formatCurrency(overview.summary.total_income)} income vs ${formatCurrency(overview.summary.total_expenses)} expenses`,
      icon: BarChart3,
    },
    {
      title: 'Pending Expenses',
      value: overview.summary.pending_expense_count,
      description: 'Awaiting admin approval',
      icon: Wallet,
    },
  ];
}
