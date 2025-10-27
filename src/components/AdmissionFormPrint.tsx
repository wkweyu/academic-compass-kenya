// Admission Form Print Component
import React, { useEffect, useState } from 'react';
import { Student } from '@/types/student';
import { settingsService } from '@/services/settingsService';
import { SchoolProfile } from '@/types/settings';

interface AdmissionFormPrintProps {
  student: Omit<Student, 'id' | 'admission_number' | 'created_at' | 'updated_at'>;
  admissionNumber?: string;
  siblings?: Student[];
}

export const AdmissionFormPrint: React.FC<AdmissionFormPrintProps> = ({ 
  student, 
  admissionNumber = 'PENDING',
  siblings = []
}) => {
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile | null>(null);

  useEffect(() => {
    const loadSchoolProfile = async () => {
      try {
        const profile = await settingsService.getSchoolProfile();
        setSchoolProfile(profile);
      } catch (error) {
        console.error('Error loading school profile:', error);
      }
    };
    loadSchoolProfile();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-black print:shadow-none">
      {/* Header with School Details */}
      <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
        {schoolProfile?.logo && (
          <img src={schoolProfile.logo} alt="School Logo" className="h-20 w-20 mx-auto mb-4 object-contain" />
        )}
        <h1 className="text-2xl font-bold mb-2">{schoolProfile?.name || 'SCHOOL NAME'}</h1>
        <h2 className="text-lg font-semibold">STUDENT ADMISSION FORM</h2>
        {schoolProfile?.address && (
          <p className="text-sm text-gray-600">{schoolProfile.address}</p>
        )}
        {(schoolProfile?.phone || schoolProfile?.email) && (
          <p className="text-sm text-gray-600">
            {schoolProfile.phone} {schoolProfile.phone && schoolProfile.email && '|'} {schoolProfile.email}
          </p>
        )}
        {schoolProfile?.motto && (
          <p className="text-sm italic text-gray-700 mt-1">"{schoolProfile.motto}"</p>
        )}
        <p className="text-sm text-gray-600 mt-2">
          Date: {new Date().toLocaleDateString()} | Admission No: {admissionNumber}
        </p>
      </div>

      {/* Student Information */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 bg-gray-100 p-2">STUDENT INFORMATION</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex">
              <label className="font-medium w-32">Full Name:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.full_name}</span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Gender:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">
                {student.gender === 'M' ? 'Male' : 'Female'}
              </span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Date of Birth:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">
                {new Date(student.date_of_birth).toLocaleDateString()}
              </span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Level:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.level}</span>
            </div>
            {student.upi_number && (
              <div className="flex">
                <label className="font-medium w-32">UPI Number:</label>
                <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.upi_number}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex">
              <label className="font-medium w-32">Class:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.current_class_name}</span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Stream:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.current_stream_name}</span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Academic Year:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.academic_year}</span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Term:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">Term {student.term}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Guardian Information */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 bg-gray-100 p-2">GUARDIAN INFORMATION</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex">
              <label className="font-medium w-32">Guardian Name:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.guardian_name}</span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Phone:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.guardian_phone}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex">
              <label className="font-medium w-32">Relationship:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.guardian_relationship}</span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Email:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.guardian_email || 'N/A'}</span>
            </div>
          </div>
        </div>
        {student.guardian_address && (
          <div className="mt-3 flex">
            <label className="font-medium w-32">Address:</label>
            <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.guardian_address}</span>
          </div>
        )}
      </div>

      {/* Sibling Information */}
      {siblings && siblings.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 bg-gray-100 p-2">SIBLING INFORMATION</h3>
          <div className="space-y-2">
            {siblings.map((sibling, index) => (
              <div key={index} className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="font-medium">{sibling.full_name}</span>
                <span className="text-sm text-gray-600">{sibling.current_class_stream} - {sibling.admission_number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Information */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 bg-gray-100 p-2">ADDITIONAL INFORMATION</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex">
              <label className="font-medium w-32">Enrollment Date:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">
                {new Date(student.enrollment_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Transport:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">
                {student.is_on_transport ? 'Yes' : 'No'}
              </span>
            </div>
            {student.is_on_transport && student.transport_route && (
              <div className="flex">
                <label className="font-medium w-32">Transport Route:</label>
                <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.transport_route}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex">
              <label className="font-medium w-32">Status:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px] capitalize">{student.status}</span>
            </div>
            <div className="flex">
              <label className="font-medium w-32">Admission Year:</label>
              <span className="border-b border-gray-300 flex-1 min-h-[24px]">{student.admission_year}</span>
            </div>
            {student.is_on_transport && student.transport_type && (
              <div className="flex">
                <label className="font-medium w-32">Transport Type:</label>
                <span className="border-b border-gray-300 flex-1 min-h-[24px] capitalize">{student.transport_type}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-12 pt-8 border-t border-gray-300">
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="border-b border-gray-800 mb-2 h-12"></div>
            <p className="text-sm font-medium">Parent/Guardian Signature</p>
            <p className="text-xs text-gray-600">Date: ________________</p>
          </div>
          <div className="text-center">
            <div className="border-b border-gray-800 mb-2 h-12"></div>
            <p className="text-sm font-medium">Registrar Signature</p>
            <p className="text-xs text-gray-600">Date: ________________</p>
          </div>
          <div className="text-center">
            <div className="border-b border-gray-800 mb-2 h-12"></div>
            <p className="text-sm font-medium">Principal Signature</p>
            <p className="text-xs text-gray-600">Date: ________________</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-500 border-t pt-4">
        <p>This is a computer-generated admission form from SkoolTrack Pro School Management System</p>
        <p>Generated on: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default AdmissionFormPrint;