'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, User, Calendar, Phone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { patientApi } from '@/lib/api';
import { Patient } from '@/types';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import debounce from 'lodash.debounce';

interface PatientSearchProps {
  onSelectPatient: (patient: Patient) => void;
}

export function PatientSearch({ onSelectPatient }: PatientSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      const debounced = debounce(() => {
        setQuery(searchQuery);
      }, 300);
      debounced();
    },
    []
  );

  const { data, isLoading } = useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: () => patientApi.search(query),
    enabled: query.length >= 2,
  });

  const patients = data?.patients || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPatient = (patient: Patient) => {
    onSelectPatient(patient);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={searchRef} className="relative w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search patients by name or MRN..."
          className="pl-10"
          onChange={(e) => {
            debouncedSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
        />
      </div>

      <AnimatePresence>
        {isOpen && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-auto z-50"
          >
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : patients.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No patients found
              </div>
            ) : (
              <ul className="py-2">
                {patients.map((patient) => (
                  <li key={patient.id}>
                    <button
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span>MRN: {patient.mrn}</span>
                            {patient.dateOfBirth && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(patient.dateOfBirth), 'MM/dd/yyyy')}
                              </span>
                            )}
                            {patient.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {patient.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}