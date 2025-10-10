import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { SchoolProfile } from '@/types/settings';
import { Loader2, Save } from 'lucide-react';

const schoolProfileSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

type SchoolProfileFormData = z.infer<typeof schoolProfileSchema>;

export function SchoolProfileTab() {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const form = useForm<SchoolProfileFormData>({
    resolver: zodResolver(schoolProfileSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
    },
  });

  useEffect(() => {
    loadSchoolProfile();
  }, []);

  const loadSchoolProfile = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getSchoolProfile();
      
      if (data === null) {
        // User doesn't have a school yet
        setIsCreating(true);
        setProfile(null);
      } else {
        setIsCreating(false);
        setProfile(data);
        form.reset({
          name: data.name,
          address: data.address,
          phone: data.phone,
          email: data.email,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load school profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SchoolProfileFormData) => {
    try {
      setLoading(true);
      
      if (isCreating) {
        // Create new school - all fields are validated by zod schema
        await settingsService.createSchoolProfile({
          name: data.name,
          address: data.address,
          phone: data.phone,
          email: data.email,
        });
        toast({
          title: 'Success',
          description: 'School profile created successfully',
        });
      } else {
        // Update existing school
        await settingsService.updateSchoolProfile(data);
        toast({
          title: 'Success',
          description: 'School profile updated successfully',
        });
      }
      
      loadSchoolProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${isCreating ? 'create' : 'update'} school profile`,
        variant: 'destructive',
      });
      console.error(`${isCreating ? 'Create' : 'Update'} error:`, error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isCreating ? 'Create School Profile' : 'School Profile Information'}
        </CardTitle>
        {isCreating && (
          <p className="text-sm text-muted-foreground mt-2">
            Welcome! Please create your school profile to get started.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter school name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isCreating && (
                <div className="flex items-center space-x-2">
                  <FormLabel>School Code:</FormLabel>
                  <span className="font-medium text-muted-foreground">
                    {profile?.code || 'N/A'}
                  </span>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter school address" 
                      className="resize-none"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. +254 700 123 456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. info@school.ac.ke" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-4">
              {!isCreating && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadSchoolProfile}
                  disabled={loading}
                >
                  Reset
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isCreating ? 'Create School' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}