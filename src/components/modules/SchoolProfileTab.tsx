import { useState, useEffect, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { SchoolProfile } from '@/types/settings';
import { Loader2, Save, Upload } from 'lucide-react';
import {
  getLegacySchoolTypeFromManagedClassGroups,
  getManagedClassGroupSummary,
  hasManagedClassGroupConfiguration,
  MANAGED_CLASS_GROUP_OPTIONS,
  normalizeManagedClassGroups,
} from '@/utils/schoolClassGroups';

const schoolProfileSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  type: z.string().optional(),
  managed_class_groups: z.array(z.string()).default([]),
  motto: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  logo: z.string().optional(),
});

type SchoolProfileFormData = z.infer<typeof schoolProfileSchema>;

export function SchoolProfileTab() {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { toast } = useToast();

  const form = useForm<SchoolProfileFormData>({
    resolver: zodResolver(schoolProfileSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
      type: '',
      managed_class_groups: [],
      motto: '',
      website: '',
      logo: '',
    },
  });

  useEffect(() => {
    loadSchoolProfile();
  }, []);

  const syncFormWithProfile = (data: SchoolProfile) => {
    const managedClassGroups = normalizeManagedClassGroups(data.managed_class_groups, data.type);

    setProfile(data);
    setIsCreating(false);
    form.reset({
      name: data.name,
      address: data.address,
      phone: data.phone,
      email: data.email,
      type: getLegacySchoolTypeFromManagedClassGroups(managedClassGroups, data.type),
      managed_class_groups: managedClassGroups,
      motto: data.motto || '',
      website: data.website || '',
      logo: data.logo || '',
    });
  };

  const loadSchoolProfile = async () => {
    try {
      setLoading(true);
      console.log('Loading school profile...');
      const data = await settingsService.getSchoolProfile();
      
      if (data) {
        console.log('Profile loaded:', data);
        syncFormWithProfile(data);
      } else {
        console.log('No profile found, showing create form');
        setProfile(null);
        setIsCreating(true);
      }
    } catch (error: any) {
      console.error('Failed to load school profile:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load school profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file for the school logo.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a logo smaller than 2 MB.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploadingLogo(true);
      const fileDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read the selected file'));
        reader.readAsDataURL(file);
      });

      form.setValue('logo', fileDataUrl, { shouldDirty: true, shouldValidate: true });
      toast({
        title: 'Logo ready',
        description: `${file.name} will be saved as your school logo.`,
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Unable to process the selected logo.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  const onSubmit = async (data: SchoolProfileFormData) => {
    try {
      setLoading(true);
      const managedClassGroups = normalizeManagedClassGroups(data.managed_class_groups, data.type);
      const derivedType = getLegacySchoolTypeFromManagedClassGroups(managedClassGroups, data.type);
      
      if (isCreating) {
        // Create new school - all fields are validated by zod schema
        const savedProfile = await settingsService.createSchoolProfile({
          name: data.name,
          address: data.address,
          phone: data.phone,
          email: data.email,
          type: derivedType,
          managed_class_groups: managedClassGroups,
          motto: data.motto,
          website: data.website,
          logo: data.logo,
        });
        syncFormWithProfile(savedProfile);
        toast({
          title: 'Success',
          description: 'School profile created successfully',
        });
      } else {
        // Update existing school
        const savedProfile = await settingsService.updateSchoolProfile({
          ...data,
          type: derivedType,
          managed_class_groups: managedClassGroups,
        });
        syncFormWithProfile(savedProfile);
        toast({
          title: 'Success',
          description: 'School profile updated successfully',
        });
      }
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
    <div className="space-y-6">
      {!isCreating && profile && (
        <Card>
          <CardHeader>
            <CardTitle>Current School Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">School Name:</span> {profile.name}
              </div>
              <div>
                <span className="font-semibold">School Code:</span> {profile.code}
              </div>
              <div>
                <span className="font-semibold">Email:</span> {profile.email}
              </div>
              <div>
                <span className="font-semibold">Phone:</span> {profile.phone}
              </div>
              {hasManagedClassGroupConfiguration(profile) && (
                <div>
                  <span className="font-semibold">Managed Class Groups:</span> {getManagedClassGroupSummary(profile)}
                </div>
              )}
              {profile.type && (
                <div>
                  <span className="font-semibold">Legacy Type:</span> {profile.type}
                </div>
              )}
              {profile.logo && (
                <div className="md:col-span-2">
                  <span className="font-semibold">Logo:</span>
                  <div className="mt-2">
                    <img src={profile.logo} alt="School logo" className="h-20 w-20 rounded-md border object-contain p-1" />
                  </div>
                </div>
              )}
              {profile.website && (
                <div>
                  <span className="font-semibold">Website:</span>{' '}
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {profile.website}
                  </a>
                </div>
              )}
              <div className="md:col-span-2">
                <span className="font-semibold">Address:</span> {profile.address}
              </div>
              {profile.motto && (
                <div className="md:col-span-2">
                  <span className="font-semibold">Motto:</span> <em>{profile.motto}</em>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>
            {isCreating ? 'Create School Profile' : 'Edit School Profile'}
          </CardTitle>
          {isCreating ? (
            <p className="text-sm text-muted-foreground mt-2">
              Welcome! Please create your school profile to get started.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Your school was created during onboarding. Review the prefilled details below, add the remaining setup information,
              then save to complete your school profile.
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="managed_class_groups"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Managed Class Groups</FormLabel>
                    <FormControl>
                      <div className="space-y-3 rounded-md border p-4">
                        {MANAGED_CLASS_GROUP_OPTIONS.map((option) => {
                          const selectedValues = field.value || [];
                          const isChecked = selectedValues.includes(option.value);

                          return (
                            <label
                              key={option.value}
                              className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40"
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const nextValues = checked
                                    ? [...selectedValues, option.value]
                                    : selectedValues.filter((value) => value !== option.value);

                                  field.onChange(normalizeManagedClassGroups(nextValues));
                                }}
                              />
                              <div className="space-y-1">
                                <p className="text-sm font-medium leading-none">{option.label}</p>
                                <p className="text-sm text-muted-foreground">{option.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      Select every section your school manages together. Existing modules keep using the current grade-based class
                      logic, while setup and defaults now read this safe multi-select configuration first.
                    </p>
                    {(field.value?.length || 0) > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Legacy fallback type: <strong>{getLegacySchoolTypeFromManagedClassGroups(field.value)}</strong>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. https://www.school.ac.ke" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="motto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Motto</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter school motto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Logo</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      {field.value ? (
                        <div className="flex items-center gap-4 rounded-md border p-3">
                          <img src={field.value} alt="Selected school logo" className="h-16 w-16 rounded-md border object-contain p-1" />
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Upload a clear square logo for best results.</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => form.setValue('logo', '', { shouldDirty: true, shouldValidate: true })}
                            >
                              Remove Logo
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/50">
                          {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          <span>{uploadingLogo ? 'Preparing logo...' : 'Choose logo image'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                        </label>
                      )}
                    </div>
                  </FormControl>
                  <p className="text-sm text-muted-foreground">Upload PNG, JPG, or SVG up to 2 MB.</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between">
              <div />
              <div className="flex space-x-4">
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
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
    </div>
  );
}