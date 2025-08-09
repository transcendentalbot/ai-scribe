'use client';

import { format } from 'date-fns';
import { Clock, User, MapPin, FileText, Mic, MicOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Encounter, EncounterStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface EncounterCardProps {
  encounter: Encounter;
}

const statusConfig = {
  [EncounterStatus.SCHEDULED]: {
    label: 'Scheduled',
    color: 'bg-gray-100 text-gray-800',
    borderColor: 'border-gray-300',
  },
  [EncounterStatus.CHECKED_IN]: {
    label: 'Checked In',
    color: 'bg-green-100 text-green-800',
    borderColor: 'border-green-300',
  },
  [EncounterStatus.IN_PROGRESS]: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-800',
    borderColor: 'border-blue-300',
  },
  [EncounterStatus.COMPLETED]: {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-600',
    borderColor: 'border-gray-200',
  },
  [EncounterStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800',
    borderColor: 'border-red-300',
  },
  [EncounterStatus.NO_SHOW]: {
    label: 'No Show',
    color: 'bg-orange-100 text-orange-800',
    borderColor: 'border-orange-300',
  },
};

export function EncounterCard({ encounter }: EncounterCardProps) {
  const router = useRouter();
  const config = statusConfig[encounter.status];
  const hasRecordingConsent = encounter.consents?.some(
    (c) => c.type === 'RECORDING' && c.granted
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'bg-white rounded-lg border-2 p-6 hover:shadow-md transition-shadow',
        config.borderColor
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {encounter.patient?.firstName} {encounter.patient?.lastName}
            </h3>
            <Badge className={config.color}>{config.label}</Badge>
            {encounter.type === 'TELEHEALTH' && (
              <Badge variant="outline">Telehealth</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {format(new Date(encounter.scheduledAt), 'h:mm a')}
            </span>
            {encounter.patient?.mrn && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                MRN: {encounter.patient.mrn}
              </span>
            )}
            {encounter.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {encounter.location.roomNumber || encounter.location.department}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {encounter.status === EncounterStatus.IN_PROGRESS && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 rounded-full">
              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-700">Recording</span>
            </div>
          )}
          {hasRecordingConsent ? (
            <Mic className="h-5 w-5 text-green-600" />
          ) : (
            <MicOff className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {encounter.chiefComplaint && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <span className="font-medium">Chief Complaint:</span> {encounter.chiefComplaint}
            </span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {encounter.patient?.dateOfBirth && (
            <span>
              DOB: {format(new Date(encounter.patient.dateOfBirth), 'MM/dd/yyyy')} • 
              {' '}Age: {new Date().getFullYear() - new Date(encounter.patient.dateOfBirth).getFullYear()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {encounter.status === EncounterStatus.SCHEDULED && (
            <Button size="sm" variant="outline">Check In</Button>
          )}
          {encounter.status === EncounterStatus.CHECKED_IN && (
            <Button size="sm">Start Encounter</Button>
          )}
          {encounter.status === EncounterStatus.IN_PROGRESS && (
            <Button size="sm" variant="destructive">End Recording</Button>
          )}
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => router.push(`/encounters/${encounter.id}`)}
          >
            View Details
          </Button>
        </div>
      </div>
    </motion.div>
  );
}