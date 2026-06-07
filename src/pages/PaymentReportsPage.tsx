import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { paymentService } from '@/services/paymentService';

const currency = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
});

export default function PaymentReportsPage() {
  const { toast } = useToast();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [term, setTerm] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [trendStartYear, setTrendStartYear] = useState(String(new Date().getFullYear() - 1));
  const [trendEndYear, setTrendEndYear] = useState(String(new Date().getFullYear()));
  const [scheduledReport, setScheduledReport] = useState<'outstanding' | 'student_aging' | 'collection_effectiveness' | 'activity_log'>('outstanding');
  const [scheduleRunAt, setScheduleRunAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now.toISOString().slice(0, 16);
  });
  const [scheduleNotes, setScheduleNotes] = useState('');

  const previewQuery = useQuery({
    queryKey: ['term-close-preview', year, term],
    queryFn: () => paymentService.getTermClosePreview(Number(year), Number(term)),
    enabled: Boolean(year && term),
    refetchInterval: 45000,
  });

  const conversionQuery = useQuery({
    queryKey: ['term-close-conversion-report', year, term],
    queryFn: () =>
      paymentService.getTermCloseConversionReport({
        year: Number(year),
        term: Number(term),
      }),
    enabled: Boolean(year && term),
    refetchInterval: 45000,
  });

  const rolloverMutation = useMutation({
    mutationFn: () => paymentService.runTermCloseRollover(Number(year), Number(term), false),
    onSuccess: (data) => {
      toast({ title: 'Term close completed', description: data.detail });
      previewQuery.refetch();
      conversionQuery.refetch();
    },
    onError: (error: any) => {
      const detail =
        error?.standardError?.details?.detail ||
        error?.standardError?.message ||
        error?.message ||
        'Could not complete rollover.';
      toast({
        title: 'Term close failed',
        description: detail,
        variant: 'destructive',
      });
    },
  });

  const dailyCollectionsQuery = useQuery({
    queryKey: ['daily-collections-report', startDate, endDate],
    queryFn: () => paymentService.getDailyCollectionsReport({ start_date: startDate || undefined, end_date: endDate || undefined }),
    refetchInterval: 45000,
  });

  const providerCollectionsQuery = useQuery({
    queryKey: ['provider-collections-report', startDate, endDate],
    queryFn: () => paymentService.getProviderCollectionsReport({ start_date: startDate || undefined, end_date: endDate || undefined }),
    refetchInterval: 45000,
  });

  const voteheadCollectionsQuery = useQuery({
    queryKey: ['votehead-collections-report', startDate, endDate],
    queryFn: () => paymentService.getVoteheadCollectionsReport({ start_date: startDate || undefined, end_date: endDate || undefined }),
    refetchInterval: 45000,
  });

  const outstandingQuery = useQuery({
    queryKey: ['outstanding-report', year, term],
    queryFn: () => paymentService.getOutstandingBalancesReport({ year: Number(year), term: Number(term) }),
    enabled: Boolean(year && term),
    refetchInterval: 45000,
  });

  const agingQuery = useQuery({
    queryKey: ['student-aging-report', asOfDate],
    queryFn: () => paymentService.getStudentAgingReport({ as_of_date: asOfDate || undefined }),
    refetchInterval: 45000,
  });

  const effectivenessQuery = useQuery({
    queryKey: ['collection-effectiveness-report', trendStartYear, trendEndYear],
    queryFn: () =>
      paymentService.getCollectionEffectivenessReport({
        start_year: Number(trendStartYear),
        end_year: Number(trendEndYear),
      }),
    enabled: Boolean(trendStartYear && trendEndYear),
    refetchInterval: 45000,
  });

  const debtAnalyticsQuery = useQuery({
    queryKey: ['debt-analytics-report', year, term, asOfDate],
    queryFn: () =>
      paymentService.getDebtAnalyticsReport({
        as_of_date: asOfDate || undefined,
        year: Number(year),
        term: Number(term),
      }),
    enabled: Boolean(year && term),
    refetchInterval: 45000,
  });

  const activityLogQuery = useQuery({
    queryKey: ['finance-activity-log', startDate, endDate],
    queryFn: () => paymentService.getFinanceActivityLog({ start_date: startDate || undefined, end_date: endDate || undefined, limit: 20 }),
    refetchInterval: 45000,
  });

  const scheduledJobsQuery = useQuery({
    queryKey: ['scheduled-export-jobs'],
    queryFn: () => paymentService.getScheduledExportJobs({ limit: 20 }),
    refetchInterval: 45000,
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload: {
      report: 'outstanding' | 'student_aging' | 'collection_effectiveness' | 'activity_log';
      run_at: string;
      filters?: Record<string, unknown>;
      notes?: string;
    }) => paymentService.scheduleExportJob(payload),
    onSuccess: () => {
      toast({ title: 'Export scheduled', description: 'Scheduled export created successfully.' });
      scheduledJobsQuery.refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Could not schedule export',
        description: error?.message || 'Scheduling failed.',
        variant: 'destructive',
      });
    },
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: (jobId: number) => paymentService.cancelScheduledExportJob(jobId),
    onSuccess: () => {
      toast({ title: 'Schedule cancelled', description: 'Scheduled export has been cancelled.' });
      scheduledJobsQuery.refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Cancel failed',
        description: error?.message || 'Could not cancel scheduled export.',
        variant: 'destructive',
      });
    },
  });

  const logExport = (reportType: string) => {
    paymentService
      .logFinanceActivity({
        action: 'FINANCE_REPORT_EXPORT',
        description: `Exported ${reportType} report from Payment Reports page.`,
        metadata: {
          report_type: reportType,
          filters: {
            year,
            term,
            start_date: startDate || null,
            end_date: endDate || null,
            as_of_date: asOfDate || null,
          },
        },
      })
      .catch(() => undefined);
  };

  const exportDailyCollections = () => {
    logExport('daily_collections_csv');
    paymentService
      .downloadPaymentReportCsv('daily', { start_date: startDate || undefined, end_date: endDate || undefined })
      .catch((error: any) => {
        toast({
          title: 'Export failed',
          description: error?.message || 'Could not export daily report.',
          variant: 'destructive',
        });
      });
  };

  const exportProviderTotals = () => {
    logExport('provider_totals_csv');
    paymentService
      .downloadPaymentReportCsv('providers', { start_date: startDate || undefined, end_date: endDate || undefined })
      .catch((error: any) => {
        toast({
          title: 'Export failed',
          description: error?.message || 'Could not export provider report.',
          variant: 'destructive',
        });
      });
  };

  const exportVoteheadCollections = () => {
    logExport('votehead_collections_csv');
    paymentService
      .downloadPaymentReportCsv('voteheads', { start_date: startDate || undefined, end_date: endDate || undefined })
      .catch((error: any) => {
        toast({
          title: 'Export failed',
          description: error?.message || 'Could not export votehead report.',
          variant: 'destructive',
        });
      });
  };

  const exportOutstandingBalances = () => {
    logExport('outstanding_balances_csv');
    paymentService
      .downloadFinanceReportCsv('outstanding', {
        year: Number(year),
        term: Number(term),
      })
      .catch((error: any) => {
        toast({
          title: 'Export failed',
          description: error?.message || 'Could not export outstanding report.',
          variant: 'destructive',
        });
      });
  };

  const exportAging = () => {
    logExport('student_aging_csv');
    paymentService
      .downloadFinanceReportCsv('student_aging', {
        as_of_date: asOfDate || undefined,
      })
      .catch((error: any) => {
        toast({
          title: 'Export failed',
          description: error?.message || 'Could not export aging report.',
          variant: 'destructive',
        });
      });
  };

  const exportCollectionEffectiveness = () => {
    logExport('collection_effectiveness_csv');
    paymentService
      .downloadFinanceReportCsv('collection_effectiveness', {
        start_year: Number(trendStartYear),
        end_year: Number(trendEndYear),
      })
      .catch((error: any) => {
        toast({
          title: 'Export failed',
          description: error?.message || 'Could not export collection effectiveness report.',
          variant: 'destructive',
        });
      });
  };

  const exportActivityLog = () => {
    logExport('activity_log_csv');
    paymentService
      .downloadFinanceReportCsv('activity_log', {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      .catch((error: any) => {
        toast({
          title: 'Export failed',
          description: error?.message || 'Could not export activity log report.',
          variant: 'destructive',
        });
      });
  };

  const scheduleCurrentExport = () => {
    const payload: {
      report: 'outstanding' | 'student_aging' | 'collection_effectiveness' | 'activity_log';
      run_at: string;
      filters: Record<string, unknown>;
      notes?: string;
    } = {
      report: scheduledReport,
      run_at: new Date(scheduleRunAt).toISOString(),
      filters: {},
      notes: scheduleNotes || undefined,
    };

    if (scheduledReport === 'outstanding') {
      payload.filters = { year: Number(year), term: Number(term) };
    } else if (scheduledReport === 'student_aging') {
      payload.filters = { as_of_date: asOfDate || undefined };
    } else if (scheduledReport === 'collection_effectiveness') {
      payload.filters = { start_year: Number(trendStartYear), end_year: Number(trendEndYear) };
    } else {
      payload.filters = { start_date: startDate || undefined, end_date: endDate || undefined };
    }

    scheduleMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payment Reports</h1>
        <p className="text-sm text-muted-foreground">
          Phase 2.5 controls: preview carry-forward, run rollover, and inspect conversion report.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="year">Source Year</Label>
          <Input id="year" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="term">Source Term</Label>
          <Input id="term" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 md:col-span-2">
          <Button variant="outline" onClick={() => previewQuery.refetch()}>
            Refresh Preview
          </Button>
          <Button onClick={() => rolloverMutation.mutate()} disabled={rolloverMutation.isPending}>
            Run Term Close Rollover
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="start-date">Start Date</Label>
          <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="end-date">End Date</Label>
          <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="as-of-date">Aging As Of</Label>
          <Input id="as-of-date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="trend-start-year">Trend Start Year</Label>
          <Input id="trend-start-year" value={trendStartYear} onChange={(e) => setTrendStartYear(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="trend-end-year">Trend End Year</Label>
          <Input id="trend-end-year" value={trendEndYear} onChange={(e) => setTrendEndYear(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportDailyCollections}>
          Export Daily CSV
        </Button>
        <Button variant="outline" onClick={exportProviderTotals}>
          Export Providers CSV
        </Button>
        <Button variant="outline" onClick={exportVoteheadCollections}>
          Export Voteheads CSV
        </Button>
        <Button variant="outline" onClick={exportOutstandingBalances}>
          Export Outstanding CSV
        </Button>
        <Button variant="outline" onClick={exportAging}>
          Export Aging CSV
        </Button>
        <Button variant="outline" onClick={exportCollectionEffectiveness}>
          Export Collection Trend CSV
        </Button>
        <Button variant="outline" onClick={exportActivityLog}>
          Export Activity Log CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Print Current View
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Projected Arrears</p>
          <p className="text-xl font-semibold">{currency.format(previewQuery.data?.totals.arrears ?? 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Projected Prepayment</p>
          <p className="text-xl font-semibold">{currency.format(previewQuery.data?.totals.prepayment ?? 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Students Affected</p>
          <p className="text-xl font-semibold">{previewQuery.data?.totals.students_affected ?? 0}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Conversion Report</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Source Votehead</TableHead>
                <TableHead>Source Closing</TableHead>
                <TableHead>Target Type</TableHead>
                <TableHead>Target Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(conversionQuery.data?.results.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No conversion rows found for selected period.
                  </TableCell>
                </TableRow>
              ) : (
                conversionQuery.data?.results.map((row) => (
                  <TableRow key={`${row.student_id}-${row.source_vote_head}-${row.created_at}`}>
                    <TableCell>{row.student_name}</TableCell>
                    <TableCell>{row.source_vote_head}</TableCell>
                    <TableCell>{currency.format(row.source_closing_balance)}</TableCell>
                    <TableCell>{row.target_type}</TableCell>
                    <TableCell>{currency.format(row.target_amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Daily Collections</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dailyCollectionsQuery.data?.results.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No daily collections found.
                    </TableCell>
                  </TableRow>
                ) : (
                  dailyCollectionsQuery.data?.results.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{currency.format(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Provider Totals</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(providerCollectionsQuery.data?.results.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No provider data found.
                    </TableCell>
                  </TableRow>
                ) : (
                  providerCollectionsQuery.data?.results.map((row) => (
                    <TableRow key={row.provider}>
                      <TableCell>{row.provider}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{currency.format(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Votehead Collections</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Votehead</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(voteheadCollectionsQuery.data?.results.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No votehead allocations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  voteheadCollectionsQuery.data?.results.map((row) => (
                    <TableRow key={row.vote_head}>
                      <TableCell>{row.vote_head}</TableCell>
                      <TableCell>{currency.format(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Outstanding Balances</h2>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-xl font-semibold">{currency.format(outstandingQuery.data?.total_outstanding ?? 0)}</p>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(outstandingQuery.data?.results.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No outstanding rows found.
                    </TableCell>
                  </TableRow>
                ) : (
                  outstandingQuery.data?.results.slice(0, 8).map((row) => (
                    <TableRow key={row.student_id}>
                      <TableCell>{row.student_name}</TableCell>
                      <TableCell>{row.class_name || 'N/A'}</TableCell>
                      <TableCell>{currency.format(row.outstanding_amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Collection Effectiveness and Arrears Trend</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Total Invoiced</p>
            <p className="text-lg font-semibold">{currency.format(effectivenessQuery.data?.summary.total_invoiced ?? 0)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="text-lg font-semibold">{currency.format(effectivenessQuery.data?.summary.total_paid ?? 0)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Overall Collection Rate</p>
            <p className="text-lg font-semibold">{(effectivenessQuery.data?.summary.overall_collection_rate ?? 0).toFixed(2)}%</p>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Invoiced</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Rate (%)</TableHead>
                <TableHead>Arrears Closing</TableHead>
                <TableHead>Prepayment Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(effectivenessQuery.data?.results.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No collection trend rows found for selected year range.
                  </TableCell>
                </TableRow>
              ) : (
                effectivenessQuery.data?.results.map((row) => (
                  <TableRow key={`${row.year}-T${row.term}`}>
                    <TableCell>{row.year}</TableCell>
                    <TableCell>{row.term}</TableCell>
                    <TableCell>{currency.format(row.amount_invoiced)}</TableCell>
                    <TableCell>{currency.format(row.amount_paid)}</TableCell>
                    <TableCell>{row.collection_rate.toFixed(2)}%</TableCell>
                    <TableCell>{currency.format(row.arrears_closing)}</TableCell>
                    <TableCell>{currency.format(row.prepayment_closing)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Student Aging Buckets</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">0-30 Days</p>
            <p className="text-lg font-semibold">{currency.format(agingQuery.data?.totals['0-30'] ?? 0)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">31-60 Days</p>
            <p className="text-lg font-semibold">{currency.format(agingQuery.data?.totals['31-60'] ?? 0)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">61-90 Days</p>
            <p className="text-lg font-semibold">{currency.format(agingQuery.data?.totals['61-90'] ?? 0)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">90+ Days</p>
            <p className="text-lg font-semibold">{currency.format(agingQuery.data?.totals['90+'] ?? 0)}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Aging by Class</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>0-30</TableHead>
                    <TableHead>31-60</TableHead>
                    <TableHead>61-90</TableHead>
                    <TableHead>90+</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(agingQuery.data?.by_class.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No class aging rows found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agingQuery.data?.by_class.map((row) => (
                      <TableRow key={row.class_id ?? row.class_name}>
                        <TableCell>{row.class_name}</TableCell>
                        <TableCell>{currency.format(row.buckets['0-30'])}</TableCell>
                        <TableCell>{currency.format(row.buckets['31-60'])}</TableCell>
                        <TableCell>{currency.format(row.buckets['61-90'])}</TableCell>
                        <TableCell>{currency.format(row.buckets['90+'])}</TableCell>
                        <TableCell>{currency.format(row.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold">Aging by Votehead</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Votehead</TableHead>
                    <TableHead>0-30</TableHead>
                    <TableHead>31-60</TableHead>
                    <TableHead>61-90</TableHead>
                    <TableHead>90+</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(agingQuery.data?.by_votehead.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No votehead aging rows found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agingQuery.data?.by_votehead.map((row) => (
                      <TableRow key={row.vote_head_id}>
                        <TableCell>{row.vote_head_name}</TableCell>
                        <TableCell>{currency.format(row.buckets['0-30'])}</TableCell>
                        <TableCell>{currency.format(row.buckets['31-60'])}</TableCell>
                        <TableCell>{currency.format(row.buckets['61-90'])}</TableCell>
                        <TableCell>{currency.format(row.buckets['90+'])}</TableCell>
                        <TableCell>{currency.format(row.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Advanced Debt Analytics</h2>
        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-lg font-semibold">{currency.format(debtAnalyticsQuery.data?.summary.total_outstanding ?? 0)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Students with Arrears</p>
            <p className="text-lg font-semibold">{debtAnalyticsQuery.data?.summary.students_with_arrears ?? 0}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">High Risk Students</p>
            <p className="text-lg font-semibold">{debtAnalyticsQuery.data?.summary.high_risk_students ?? 0}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Chronic Arrears</p>
            <p className="text-lg font-semibold">{debtAnalyticsQuery.data?.summary.chronic_arrears_students ?? 0}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Top 10 Concentration</p>
            <p className="text-lg font-semibold">{(debtAnalyticsQuery.data?.summary.top10_concentration_pct ?? 0).toFixed(2)}%</p>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Risk Band</TableHead>
                <TableHead>Terms in Arrears</TableHead>
                <TableHead>90+ Days</TableHead>
                <TableHead>Total Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(debtAnalyticsQuery.data?.results.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No debt analytics rows found for selected period.
                  </TableCell>
                </TableRow>
              ) : (
                debtAnalyticsQuery.data?.results.slice(0, 15).map((row) => (
                  <TableRow key={row.student_id}>
                    <TableCell>{row.student_name}</TableCell>
                    <TableCell>{row.class_name || 'N/A'}</TableCell>
                    <TableCell>{row.risk_band}</TableCell>
                    <TableCell>{row.terms_with_arrears}</TableCell>
                    <TableCell>{currency.format(row.buckets['90+'])}</TableCell>
                    <TableCell>{currency.format(row.total_outstanding)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Scheduled Exports</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="scheduled-report">Report</Label>
            <select
              id="scheduled-report"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={scheduledReport}
              onChange={(e) => setScheduledReport(e.target.value as 'outstanding' | 'student_aging' | 'collection_effectiveness' | 'activity_log')}
            >
              <option value="outstanding">Outstanding</option>
              <option value="student_aging">Student Aging</option>
              <option value="collection_effectiveness">Collection Effectiveness</option>
              <option value="activity_log">Activity Log</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="schedule-run-at">Run At</Label>
            <Input id="schedule-run-at" type="datetime-local" value={scheduleRunAt} onChange={(e) => setScheduleRunAt(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="schedule-notes">Notes</Label>
            <Input id="schedule-notes" value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)} placeholder="Optional note for bursar ops" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={scheduleCurrentExport} disabled={scheduleMutation.isPending}>
            Schedule Export
          </Button>
          <Button variant="outline" onClick={() => scheduledJobsQuery.refetch()}>
            Refresh Scheduled Jobs
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run Time</TableHead>
                <TableHead>Report</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(scheduledJobsQuery.data?.results.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No scheduled exports found.
                  </TableCell>
                </TableRow>
              ) : (
                scheduledJobsQuery.data?.results.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{new Date(job.run_at).toLocaleString()}</TableCell>
                    <TableCell>{job.report}</TableCell>
                    <TableCell>{job.status}</TableCell>
                    <TableCell>{job.notes || '-'}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!(job.status === 'READY' || job.status === 'COMPLETED')}
                        onClick={() => paymentService.downloadScheduledExportCsv(job.id)}
                      >
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={job.status === 'COMPLETED' || job.status === 'CANCELLED' || cancelScheduleMutation.isPending}
                        onClick={() => cancelScheduleMutation.mutate(job.id)}
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Recent Finance Activity</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(activityLogQuery.data?.results.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No activity logs found.
                  </TableCell>
                </TableRow>
              ) : (
                activityLogQuery.data?.results.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell>{item.actor_name || 'System'}</TableCell>
                    <TableCell>{item.description}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
