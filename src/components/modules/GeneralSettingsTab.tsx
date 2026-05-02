import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { SystemSettings } from '@/types/settings';
import { Save, Loader2 } from 'lucide-react';

const systemSettingsSchema = z.object({
  default_currency: z.string().min(1, 'Currency is required'),
  late_payment_penalty_rate: z.number().min(0, 'Rate must be 0 or higher').max(100, 'Rate cannot exceed 100%'),
  auto_generate_invoices: z.boolean(),
  mpesa_integration_enabled: z.boolean(),
  backup_frequency: z.enum(['daily', 'weekly', 'monthly']),
  session_timeout_minutes: z.number().min(5, 'Minimum 5 minutes').max(480, 'Maximum 8 hours'),
});

type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;

export function GeneralSettingsTab() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const { toast } = useToast();

  const form = useForm<SystemSettingsFormData>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      default_currency: 'KSH',
      late_payment_penalty_rate: 5,
      auto_generate_invoices: true,
      mpesa_integration_enabled: false,
      backup_frequency: 'daily',
      session_timeout_minutes: 30,
    },
  });

  useEffect(() => {
    loadSystemSettings();
  }, []);

  const loadSystemSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getSystemSettings();
      setSettings(data);
      form.reset(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load system settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SystemSettingsFormData) => {
    try {
      setLoading(true);
      await settingsService.updateSystemSettings(data);
      toast({
        title: 'Success',
        description: 'System settings updated successfully',
      });
      loadSystemSettings();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update system settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General System Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Financial Settings */}
            <div>
              <h3 className="text-lg font-medium mb-4">Financial Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="default_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="KSH">KSH (Kenyan Shilling)</SelectItem>
                          <SelectItem value="USD">USD (US Dollar)</SelectItem>
                          <SelectItem value="EUR">EUR (Euro)</SelectItem>
                          <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="late_payment_penalty_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Late Payment Penalty Rate (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          {...field} 
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Penalty rate applied to overdue fees
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-4">
                <FormField
                  control={form.control}
                  name="auto_generate_invoices"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Auto-Generate Invoices</FormLabel>
                        <FormDescription>
                          Automatically create invoices for each term based on fee structures
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Integration Settings */}
            <div>
              <h3 className="text-lg font-medium mb-4">Integration Settings</h3>
              <FormField
                control={form.control}
                name="mpesa_integration_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">M-PESA Integration</FormLabel>
                      <FormDescription>
                        Enable automatic payment processing via M-PESA
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* System Settings */}
            <div>
              <h3 className="text-lg font-medium mb-4">System Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="backup_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Backup Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="session_timeout_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Timeout (Minutes)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Auto-logout after inactivity
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={loadSystemSettings}
                disabled={loading}
              >
                Reset
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}