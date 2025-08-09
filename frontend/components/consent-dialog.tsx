'use client';

import { useState } from 'react';
import { Mic, Shield, FileText, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConsentType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (consents: ConsentData[]) => void;
  patientName: string;
}

interface ConsentData {
  type: ConsentType;
  granted: boolean;
  notes?: string;
}

const consentTypes = [
  {
    type: ConsentType.RECORDING,
    title: 'Audio Recording',
    description: 'Allow recording of this encounter for documentation purposes',
    icon: Mic,
    required: true,
  },
  {
    type: ConsentType.DATA_SHARING,
    title: 'Data Sharing',
    description: 'Share anonymized data for quality improvement',
    icon: Shield,
    required: false,
  },
  {
    type: ConsentType.TREATMENT,
    title: 'Treatment Consent',
    description: 'Consent for proposed treatment plan',
    icon: FileText,
    required: false,
  },
];

export function ConsentDialog({ isOpen, onClose, onSubmit, patientName }: ConsentDialogProps) {
  const [consents, setConsents] = useState<Map<ConsentType, boolean>>(
    new Map(consentTypes.map(ct => [ct.type, false]))
  );
  const [notes, setNotes] = useState('');

  const handleToggleConsent = (type: ConsentType) => {
    const newConsents = new Map(consents);
    newConsents.set(type, !consents.get(type));
    setConsents(newConsents);
  };

  const handleSubmit = () => {
    const consentData: ConsentData[] = Array.from(consents.entries()).map(([type, granted]) => ({
      type,
      granted,
      notes: notes || undefined,
    }));
    onSubmit(consentData);
  };

  const canSubmit = consentTypes
    .filter(ct => ct.required)
    .every(ct => consents.get(ct.type));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-1/2 -translate-y-1/2 max-w-2xl mx-auto z-50 px-4"
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Capture Consent</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Patient: <span className="font-medium">{patientName}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4 mb-6">
                {consentTypes.map((consentType) => {
                  const IconComponent = consentType.icon;
                  const isGranted = consents.get(consentType.type);

                  return (
                    <motion.div
                      key={consentType.type}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <button
                        onClick={() => handleToggleConsent(consentType.type)}
                        className={cn(
                          'w-full p-4 rounded-lg border-2 transition-all text-left',
                          isGranted
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            'p-2 rounded-full',
                            isGranted ? 'bg-green-100' : 'bg-gray-100'
                          )}>
                            <IconComponent className={cn(
                              'h-5 w-5',
                              isGranted ? 'text-green-600' : 'text-gray-600'
                            )} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium text-gray-900">
                                {consentType.title}
                                {consentType.required && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                              </h3>
                              <div className={cn(
                                'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                                isGranted
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-gray-300'
                              )}>
                                {isGranted && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {consentType.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mb-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Any additional information about the consent..."
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  * Required consents must be obtained to proceed
                </p>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                  >
                    Capture Consent
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}