'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, AlertCircle, UserPlus, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { encounterApi, patientApi } from '@/lib/api';
import { Patient } from '@/types';

interface NewEncounterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ENCOUNTER_TYPES = [
  { value: 'NEW_PATIENT', label: 'New Patient Visit' },
  { value: 'FOLLOW_UP', label: 'Follow-up Visit' },
  { value: 'SICK_VISIT', label: 'Sick Visit' },
  { value: 'WELLNESS_CHECK', label: 'Wellness Check' },
];

export function NewEncounterDialog({ open, onOpenChange }: NewEncounterDialogProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'mrn'>('name');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientMRN, setNewPatientMRN] = useState('');
  const [newPatientBirthdate, setNewPatientBirthdate] = useState('');
  const [encounterType, setEncounterType] = useState('NEW_PATIENT');
  const [consentObtained, setConsentObtained] = useState(false);
  const [error, setError] = useState('');

  // Search patients
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['patients', 'search', searchQuery, searchType],
    queryFn: () => patientApi.search({ query: searchQuery, searchType }),
    enabled: searchQuery.length >= 2 && !isNewPatient,
  });

  // Create encounter mutation
  const createEncounterMutation = useMutation({
    mutationFn: encounterApi.create,
    onSuccess: (data) => {
      console.log('Create encounter response:', data);
      // Invalidate encounters query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['encounters'] });
      onOpenChange(false);
      // Navigate to the encounter detail page
      if (data?.encounter?.id) {
        router.push(`/encounters/${data.encounter.id}`);
      } else {
        console.error('No encounter ID in response:', data);
      }
    },
    onError: (error: unknown) => {
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { response?: { data?: { message?: string } } };
        setError(apiError.response?.data?.message || 'Failed to create encounter');
      } else {
        setError('Failed to create encounter');
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!consentObtained) {
      setError('Consent must be obtained before creating an encounter');
      return;
    }

    if (!isNewPatient && !selectedPatient) {
      setError('Please select a patient');
      return;
    }

    if (isNewPatient && (!newPatientName || !newPatientMRN || !newPatientBirthdate)) {
      setError('Please enter patient name, MRN, and birthdate');
      return;
    }

    const encounterData = {
      type: encounterType as 'NEW_PATIENT' | 'FOLLOW_UP' | 'SICK_VISIT' | 'WELLNESS_CHECK',
      consentObtained,
      ...(isNewPatient
        ? {
            patientName: newPatientName,
            patientMRN: newPatientMRN,
            patientBirthdate: newPatientBirthdate,
          }
        : {
            patientId: selectedPatient!.id,
          }),
    };

    createEncounterMutation.mutate(encounterData);
  };

  const handleReset = () => {
    setSearchQuery('');
    setSelectedPatient(null);
    setIsNewPatient(false);
    setNewPatientName('');
    setNewPatientMRN('');
    setNewPatientBirthdate('');
    setEncounterType('NEW_PATIENT');
    setConsentObtained(false);
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleReset();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Encounter</DialogTitle>
          <DialogDescription>
            Search for an existing patient or create a new patient record to start documentation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Button
                type="button"
                variant={!isNewPatient ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsNewPatient(false)}
              >
                <Search className="w-4 h-4 mr-2" />
                Search Patient
              </Button>
              <Button
                type="button"
                variant={isNewPatient ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsNewPatient(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                New Patient
              </Button>
            </div>

            {!isNewPatient ? (
              <>
                {/* Patient Search */}
                <div className="space-y-2">
                  <Label>Search by</Label>
                  <div className="flex space-x-2">
                    <Select value={searchType} onValueChange={(value: 'name' | 'mrn') => setSearchType(value)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="mrn">MRN</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={searchType === 'name' ? 'Enter patient name...' : 'Enter MRN...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Search Results */}
                {searchQuery.length >= 2 && (
                  <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-500">Searching...</div>
                    ) : searchResults?.patients.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No patients found</div>
                    ) : (
                      <div className="divide-y">
                        {searchResults?.patients.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                              selectedPatient?.id === patient.id ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => setSelectedPatient(patient)}
                          >
                            <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                            <div className="text-sm text-gray-600">MRN: {patient.mrn}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedPatient && (
                  <Alert>
                    <AlertDescription>
                      Selected: <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong> (MRN: {selectedPatient.mrn})
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <>
                {/* New Patient Form */}
                <div className="space-y-4">
                  <div className="mb-3 p-2 bg-green-50 rounded-md flex items-center justify-between">
                    <div className="text-sm text-green-700">
                      <p className="font-medium">Quick Fill Test Patient</p>
                      <p className="text-xs">John Doe • MRN: TEST123 • DOB: 1990-01-01</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewPatientName('John Doe');
                        setNewPatientMRN('TEST' + Math.floor(Math.random() * 10000));
                        setNewPatientBirthdate('1990-01-01');
                      }}
                    >
                      Auto Fill
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="patientName">Patient Name</Label>
                    <Input
                      id="patientName"
                      placeholder="Enter patient full name"
                      value={newPatientName}
                      onChange={(e) => setNewPatientName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="patientMRN">Medical Record Number (MRN)</Label>
                    <Input
                      id="patientMRN"
                      placeholder="Enter MRN"
                      value={newPatientMRN}
                      onChange={(e) => setNewPatientMRN(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="patientBirthdate">Date of Birth</Label>
                    <div className="relative">
                      <Input
                        id="patientBirthdate"
                        type="date"
                        value={newPatientBirthdate}
                        onChange={(e) => setNewPatientBirthdate(e.target.value)}
                        required
                        className="pl-10"
                      />
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Encounter Type */}
          <div>
            <Label htmlFor="encounterType">Encounter Type</Label>
            <Select value={encounterType} onValueChange={setEncounterType}>
              <SelectTrigger id="encounterType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENCOUNTER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Consent */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg bg-blue-50">
            <Checkbox
              id="consent"
              checked={consentObtained}
              onCheckedChange={(checked) => setConsentObtained(checked as boolean)}
            />
            <div className="space-y-1">
              <Label htmlFor="consent" className="text-sm font-medium cursor-pointer">
                Patient Consent for Recording
              </Label>
              <p className="text-sm text-gray-600">
                I confirm that the patient has been informed about and consents to the audio recording of this encounter
                for documentation purposes.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createEncounterMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!consentObtained || createEncounterMutation.isPending}
            >
              {createEncounterMutation.isPending ? 'Creating...' : 'Start Documentation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}