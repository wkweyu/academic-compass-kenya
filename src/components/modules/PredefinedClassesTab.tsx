import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { settingsService } from '@/services/settingsService';
import { classService } from '@/services/classService';
import { SchoolProfile } from '@/types/settings';
import { CheckCircle, Plus } from 'lucide-react';

export function PredefinedClassesTab() {
  const [loading, setLoading] = useState(false);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile | null>(null);
  const [classesCreated, setClassesCreated] = useState(false);

  useEffect(() => {
    loadSchoolProfile();
  }, []);

  const loadSchoolProfile = async () => {
    try {
      const profile = await settingsService.getSchoolProfile();
      setSchoolProfile(profile);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load school profile');
    }
  };

  const getPredefinedClasses = (schoolType: string) => {
    const type = schoolType?.toLowerCase();
    
    if (type === 'pre-primary' || type === 'preprimary') {
      return [
        { name: 'Pre-Primary 1', grade_level: 1, description: 'Pre-Primary Year 1' },
        { name: 'Pre-Primary 2', grade_level: 2, description: 'Pre-Primary Year 2' },
      ];
    } else if (
      type === 'mixed' ||
      type === 'primary-secondary' ||
      type === 'mixed (primary & secondary)' ||
      type === 'mixed primary & secondary'
    ) {
      return [
        { name: 'Primary Grade 1', grade_level: 1, description: 'Primary School Grade 1' },
        { name: 'Primary Grade 2', grade_level: 2, description: 'Primary School Grade 2' },
        { name: 'Primary Grade 3', grade_level: 3, description: 'Primary School Grade 3' },
        { name: 'Primary Grade 4', grade_level: 4, description: 'Primary School Grade 4' },
        { name: 'Primary Grade 5', grade_level: 5, description: 'Primary School Grade 5' },
        { name: 'Primary Grade 6', grade_level: 6, description: 'Primary School Grade 6' },
        { name: 'Junior Secondary Grade 7', grade_level: 7, description: 'Junior Secondary School Grade 7' },
        { name: 'Junior Secondary Grade 8', grade_level: 8, description: 'Junior Secondary School Grade 8' },
        { name: 'Junior Secondary Grade 9', grade_level: 9, description: 'Junior Secondary School Grade 9' },
      ];
    }
    
    return [];
  };

  const handleCreatePredefinedClasses = async () => {
    if (!schoolProfile?.type) {
      toast.error('School type not configured in school profile');
      return;
    }

    const predefinedClasses = getPredefinedClasses(schoolProfile.type);
    
    if (predefinedClasses.length === 0) {
      toast.error('No predefined classes available for this school type');
      return;
    }

    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const classData of predefinedClasses) {
        try {
          await classService.createClass(classData);
          successCount++;
        } catch (error: any) {
          console.error(`Failed to create class ${classData.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Created ${successCount} predefined class(es)`);
        setClassesCreated(true);
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to create ${errorCount} class(es). They may already exist.`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create predefined classes');
    } finally {
      setLoading(false);
    }
  };

  const predefinedClasses = schoolProfile?.type ? getPredefinedClasses(schoolProfile.type) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Predefined Classes</CardTitle>
          <CardDescription>
            Based on your school type, automatically create the standard classes for your institution.
            You can always create additional custom classes as needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!schoolProfile?.type ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Please configure your school type in the <strong>School Profile</strong> tab first to see predefined class options.
              </p>
            </div>
          ) : predefinedClasses.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                No predefined classes are available for school type <strong>{schoolProfile.type}</strong>.
                You can manually create classes using the "Add Class" button in the Class Management page.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">
                  School Type: <strong>{schoolProfile.type}</strong>
                </h3>
                <p className="text-sm text-blue-800 mb-3">
                  The following {predefinedClasses.length} classes will be created:
                </p>
                <ul className="space-y-2">
                  {predefinedClasses.map((cls, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-blue-900">
                      <CheckCircle className="h-4 w-4" />
                      <strong>{cls.name}</strong> - Grade Level {cls.grade_level}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={handleCreatePredefinedClasses}
                disabled={loading || classesCreated}
                className="w-full"
              >
                {loading ? (
                  'Creating Classes...'
                ) : classesCreated ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Classes Created
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Predefined Classes
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
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
