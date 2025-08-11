'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar, Clock, Users, Activity, Plus, LogOut, User } from 'lucide-react';
import { encounterApi } from '@/lib/api';
import { EncounterCard } from '@/components/encounter-card';
import { PatientSearch } from '@/components/patient-search';
import { StatusSummary } from '@/components/status-summary';
import { NewEncounterDialog } from '@/components/new-encounter-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/contexts/auth-context';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const [selectedDate] = useState(new Date());
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const { user, logout } = useAuth();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['encounters', 'daily', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: () => encounterApi.getDailyList(format(selectedDate, 'yyyy-MM-dd')),
  });

  const encounters = data?.encounters || [];
  const summary = data?.summary || { total: 0, byStatus: {} };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Scribe Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <PatientSearch onSelectPatient={(patient) => {
                // Navigate to patient detail or create new encounter
                console.log('Selected patient:', patient);
              }} />
              <Button onClick={() => setShowNewEncounter(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Encounter
              </Button>
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
        {/* Status Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatusSummary
            title="Total Encounters"
            value={summary.total}
            icon={<Calendar className="h-5 w-5" />}
            color="blue"
          />
          <StatusSummary
            title="Checked In"
            value={summary.byStatus?.CHECKED_IN || 0}
            icon={<Users className="h-5 w-5" />}
            color="green"
          />
          <StatusSummary
            title="In Progress"
            value={summary.byStatus?.IN_PROGRESS || 0}
            icon={<Activity className="h-5 w-5" />}
            color="yellow"
          />
          <StatusSummary
            title="Completed"
            value={summary.byStatus?.COMPLETED || 0}
            icon={<Clock className="h-5 w-5" />}
            color="gray"
          />
        </div>

        {/* Encounter List */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Today&apos;s Encounters</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              Error loading encounters. Please try again.
            </div>
          ) : encounters.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No encounters scheduled for today.
            </div>
          ) : (
            <div className="space-y-4">
              {encounters.map((encounter) => (
                <EncounterCard key={encounter.id} encounter={encounter} />
              ))}
            </div>
          )}
        </Card>
      </main>

      {/* New Encounter Dialog */}
      <NewEncounterDialog
        open={showNewEncounter}
        onOpenChange={setShowNewEncounter}
      />
    </div>
  );
}