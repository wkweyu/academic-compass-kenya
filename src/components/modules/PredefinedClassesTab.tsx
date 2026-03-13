import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { settingsService } from '@/services/settingsService';
import { classService } from '@/services/classService';
import { SchoolProfile } from '@/types/settings';
import { CheckCircle, Plus } from 'lucide-react';
import {
  getManagedClassGroupSummary,
  getPredefinedClassTemplatesForManagedGroups,
  hasManagedClassGroupConfiguration,
  hasOnlyPrePrimaryManagedClassGroups,
} from '@/utils/schoolClassGroups';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export function PredefinedClassesTab() {
  const [loading, setLoading] = useState(false);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile | null>(null);
  const [existingClasses, setExistingClasses] = useState<number[]>([]);
  const [classesCreated, setClassesCreated] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profile, classes] = await Promise.all([
        settingsService.getSchoolProfile(),
        classService.getClasses(),
      ]);

      setSchoolProfile(profile);
      setExistingClasses(classes.map((item) => item.grade_level));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to load school profile'));
    }
  };

  const predefinedClasses = getPredefinedClassTemplatesForManagedGroups(
    schoolProfile?.managed_class_groups,
    schoolProfile?.type,
  );
  const pendingClasses = predefinedClasses.filter((classTemplate) => !existingClasses.includes(classTemplate.grade_level));
  const existingPredefinedCount = predefinedClasses.length - pendingClasses.length;

  const handleCreatePredefinedClasses = async () => {
    if (!hasManagedClassGroupConfiguration(schoolProfile)) {
      toast.error('Managed class groups are not configured in the school profile');
      return;
    }
    
    if (pendingClasses.length === 0) {
      toast.error('No predefined classes are available for the configured class groups');
      return;
    }

    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const classData of pendingClasses) {
        try {
          await classService.createClass(classData);
          successCount++;
        } catch (error: unknown) {
          console.error(`Failed to create class ${classData.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Created ${successCount} predefined class(es)`);
        setClassesCreated(true);
        await loadData();
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to create ${errorCount} class(es). They may already exist.`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to create predefined classes'));
    } finally {
      setLoading(false);
    }
  };

  const managedClassGroupsLabel = getManagedClassGroupSummary(schoolProfile);
  const prePrimaryOnly = hasOnlyPrePrimaryManagedClassGroups(
    schoolProfile?.managed_class_groups,
    schoolProfile?.type,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Predefined Classes</CardTitle>
          <CardDescription>
            Based on your managed class groups, automatically create the standard classes for your institution.
            You can always create additional custom classes as needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasManagedClassGroupConfiguration(schoolProfile) ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Please configure the <strong>managed class groups</strong> in the <strong>School Profile</strong> tab first to see predefined class options.
              </p>
            </div>
          ) : prePrimaryOnly ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Pre-Primary</strong> should be implemented separately from the grade-based class groups already used by the system.
                To avoid breaking existing modules, predefined class auto-generation is intentionally disabled here until a dedicated
                pre-primary class structure is introduced.
              </p>
            </div>
          ) : predefinedClasses.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                No predefined classes are available for <strong>{managedClassGroupsLabel || 'the current class group setup'}</strong>.
                You can manually create classes using the "Add Class" button in the Class Management page.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">
                  Managed Class Groups: <strong>{managedClassGroupsLabel}</strong>
                </h3>
                <p className="text-sm text-blue-800 mb-3">
                  {pendingClasses.length === 0
                    ? 'All predefined classes for the selected class groups already exist.'
                    : `The following ${pendingClasses.length} missing class(es) will be created:`}
                </p>
                {existingPredefinedCount > 0 && (
                  <p className="text-sm text-blue-800 mb-3">
                    Already available: <strong>{existingPredefinedCount}</strong> of <strong>{predefinedClasses.length}</strong> predefined classes.
                  </p>
                )}
                <ul className="space-y-2">
                  {pendingClasses.map((cls, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-blue-900">
                      <CheckCircle className="h-4 w-4" />
                      <strong>{cls.name}</strong> - Grade Level {cls.grade_level}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={handleCreatePredefinedClasses}
                disabled={loading || pendingClasses.length === 0 || classesCreated}
                className="w-full"
              >
                {loading ? (
                  'Creating Classes...'
                ) : pendingClasses.length === 0 || classesCreated ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Predefined Classes Ready
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Missing Predefined Classes
                  </>
                )}
              </Button>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> After creating these predefined classes, you can still:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                  <li>Add custom classes manually</li>
                  <li>Create streams for each class</li>
                  <li>Modify class details as needed</li>
                  <li>Keep pre-primary setup separate until its dedicated class structure is introduced</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
