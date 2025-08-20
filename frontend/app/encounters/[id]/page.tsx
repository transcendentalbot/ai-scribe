'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { 
  ArrowLeft, Clock, User, MapPin, FileText, 
  Play, CheckCircle2, 
  AlertCircle, XCircle, LogOut
} from 'lucide-react';
import { encounterApi } from '@/lib/api';
import { EncounterStatus, ConsentType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConsentDialog } from '@/components/consent-dialog';
import { RealTimeTranscription } from '@/components/real-time-transcription';
import { RecordingsList } from '@/components/recordings-list';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

const statusConfig = {
  [EncounterStatus.SCHEDULED]: {
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    nextAction: 'Check In',
    nextStatus: EncounterStatus.CHECKED_IN,
  },
  [EncounterStatus.CHECKED_IN]: {
    icon: User,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    nextAction: 'Start Encounter',
    nextStatus: EncounterStatus.IN_PROGRESS,
  },
  [EncounterStatus.IN_PROGRESS]: {
    icon: Play,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    nextAction: 'Complete Encounter',
    nextStatus: EncounterStatus.COMPLETED,
  },
  [EncounterStatus.COMPLETED]: {
    icon: CheckCircle2,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    nextAction: null,
    nextStatus: null,
  },
  [EncounterStatus.CANCELLED]: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    nextAction: null,
    nextStatus: null,
  },
  [EncounterStatus.NO_SHOW]: {
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    nextAction: null,
    nextStatus: null,
  },
};

export default function EncounterDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [showConsentDialog, setShowConsentDialog] = useState(false);

  const { data: encounter, isLoading, error } = useQuery({
    queryKey: ['encounter', id],
    queryFn: async () => {
      console.log('[ENCOUNTER_DETAIL] Starting encounter fetch', {
        timestamp: new Date().toISOString(),
        encounterId: id,
        url: `/encounters/${id}`
      });
      const startTime = performance.now();
      
      try {
        const response = await encounterApi.getById(id as string);
        const endTime = performance.now();
        
        console.log('[ENCOUNTER_DETAIL] Encounter fetch completed successfully', {
          timestamp: new Date().toISOString(),
          encounterId: id,
          duration: endTime - startTime,
          hasEncounter: !!response?.encounter,
          encounterStatus: response?.encounter?.status,
          responseSize: JSON.stringify(response).length
        });
        
        return response.encounter;
      } catch (error) {
        const endTime = performance.now();
        
        console.error('[ENCOUNTER_DETAIL] Encounter fetch failed', {
          timestamp: new Date().toISOString(),
          encounterId: id,
          duration: endTime - startTime,
          error: error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        
        throw error;
      }
    },
  });

  // Log loading state changes
  console.log('[ENCOUNTER_DETAIL] Query state update', {
    timestamp: new Date().toISOString(),
    encounterId: id,
    isLoading,
    hasError: !!error,
    hasData: !!encounter,
    queryStatus: isLoading ? 'loading' : error ? 'error' : encounter ? 'success' : 'idle'
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: EncounterStatus; notes?: string }) =>
      encounterApi.updateStatus(id as string, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      toast.success('Encounter status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const captureConsentMutation = useMutation({
    mutationFn: (consents: Array<{type: ConsentType; granted: boolean; notes?: string}>) =>
      Promise.all(
        consents.map(consent =>
          encounterApi.captureConsent(id as string, consent)
        )
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      setShowConsentDialog(false);
      toast.success('Consent captured successfully');
    },
    onError: () => {
      toast.error('Failed to capture consent');
    },
  });

  if (isLoading || !encounter) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentStatus = statusConfig[encounter.status];
  const hasRecordingConsent = encounter.consents?.some(
    c => c.type === 'RECORDING' && c.granted
  );

  const handleStatusChange = () => {
    if (currentStatus.nextStatus === EncounterStatus.IN_PROGRESS && !hasRecordingConsent) {
      setShowConsentDialog(true);
    } else if (currentStatus.nextStatus) {
      updateStatusMutation.mutate({ status: currentStatus.nextStatus });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Encounter Details</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {format(new Date(encounter.scheduledAt), 'EEEE, MMMM d, yyyy • h:mm a')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {currentStatus.nextAction && (
                <Button
                  onClick={handleStatusChange}
                  disabled={updateStatusMutation.isPending}
                >
                  {currentStatus.nextAction}
                </Button>
              )}
              <div className="flex items-center gap-2 ml-4 pl-4 border-l">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-700">{user?.email}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Encounter Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {Object.entries(statusConfig).slice(0, 4).map(([status, config], index) => {
                    const Icon = config.icon;
                    const isActive = status === encounter.status;
                    const isPast = Object.keys(statusConfig).indexOf(status) < 
                      Object.keys(statusConfig).indexOf(encounter.status);

                    return (
                      <div key={status} className="flex items-center">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex flex-col items-center"
                        >
                          <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center
                            ${isActive ? config.bgColor : isPast ? 'bg-green-100' : 'bg-gray-100'}
                          `}>
                            <Icon className={`h-6 w-6 ${
                              isActive ? config.color : isPast ? 'text-green-600' : 'text-gray-400'
                            }`} />
                          </div>
                          <span className={`text-xs mt-2 ${
                            isActive ? 'font-semibold' : ''
                          }`}>
                            {status.replace(/_/g, ' ')}
                          </span>
                        </motion.div>
                        {index < 3 && (
                          <div className={`w-24 h-0.5 mx-2 ${
                            isPast ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Real-time Transcription Interface */}
            {encounter.status === EncounterStatus.IN_PROGRESS && hasRecordingConsent && (
              <RealTimeTranscription encounterId={encounter.id} />
            )}
            
            {/* Recordings List - Show for all statuses if there are recordings */}
            <RecordingsList encounterId={encounter.id} />

            {/* Chief Complaint */}
            {encounter.chiefComplaint && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Chief Complaint
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{encounter.chiefComplaint}</p>
                </CardContent>
              </Card>
            )}

            {/* Consents */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Consents</CardTitle>
                  {encounter.status === EncounterStatus.CHECKED_IN && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowConsentDialog(true)}
                    >
                      Capture Consent
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {encounter.consents && encounter.consents.length > 0 ? (
                  <div className="space-y-3">
                    {encounter.consents.map((consent, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">
                            {consent.type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            Granted on {format(new Date(consent.grantedAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge className={consent.granted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {consent.granted ? 'Granted' : 'Denied'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No consents captured yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Patient Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">
                    {encounter.patient?.firstName} {encounter.patient?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">MRN</p>
                  <p className="font-medium">{encounter.patient?.mrn}</p>
                </div>
                {encounter.patient?.dateOfBirth && (
                  <div>
                    <p className="text-sm text-gray-600">Date of Birth</p>
                    <p className="font-medium">
                      {format(new Date(encounter.patient.dateOfBirth), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
                {encounter.patient?.phone && (
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{encounter.patient.phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location Info */}
            {encounter.location && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">{encounter.location.facilityName}</p>
                  {encounter.location.department && (
                    <p className="text-sm text-gray-600">{encounter.location.department}</p>
                  )}
                  {encounter.location.roomNumber && (
                    <p className="text-sm text-gray-600">Room {encounter.location.roomNumber}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Consent Dialog */}
      <ConsentDialog
        isOpen={showConsentDialog}
        onClose={() => setShowConsentDialog(false)}
        onSubmit={(consents) => captureConsentMutation.mutate(consents)}
        patientName={`${encounter.patient?.firstName} ${encounter.patient?.lastName}`}
      />
    </div>
  );
}