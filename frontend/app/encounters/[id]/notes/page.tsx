'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, Code, History, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SOAPNoteEditor } from '@/components/soap-note-editor';
import { MedicalCodesManager } from '@/components/medical-codes-manager';
import { 
  ClinicalNote, 
  getEncounterNotes, 
  generateNote,
  getNoteHistory,
} from '@/lib/notes-api';

export default function NotesPage() {
  const params = useParams();
  const router = useRouter();
  const encounterId = params.id as string;

  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);
  const [noteHistory, setNoteHistory] = useState<ClinicalNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load encounter notes
  useEffect(() => {
    async function loadNotes() {
      try {
        setIsLoading(true);
        const encounterNotes = await getEncounterNotes(encounterId);
        setNotes(encounterNotes);
        
        // Select the most recent note
        if (encounterNotes.length > 0) {
          setSelectedNote(encounterNotes[0]);
        }
      } catch (error) {
        console.error('Failed to load notes:', error);
        toast.error('Failed to load notes');
      } finally {
        setIsLoading(false);
      }
    }

    if (encounterId) {
      loadNotes();
    }
  }, [encounterId]);

  // Load note history when a note is selected
  useEffect(() => {
    async function loadHistory() {
      if (!selectedNote) return;
      
      try {
        setLoadingHistory(true);
        const history = await getNoteHistory(selectedNote.noteId);
        setNoteHistory(history);
      } catch (error) {
        console.error('Failed to load note history:', error);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadHistory();
  }, [selectedNote]);

  // Generate new note
  const handleGenerateNote = async () => {
    try {
      setIsGenerating(true);
      const result = await generateNote(encounterId);
      
      toast.success('Note generation started');
      
      // Refresh notes list
      setTimeout(async () => {
        const updatedNotes = await getEncounterNotes(encounterId);
        setNotes(updatedNotes);
        
        // Select the newly generated note
        const newNote = updatedNotes.find(note => note.noteId === result.noteId);
        if (newNote) {
          setSelectedNote(newNote);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Failed to generate note:', error);
      toast.error('Failed to generate note');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle note updates
  const handleNoteUpdate = (updatedNote: ClinicalNote) => {
    setSelectedNote(updatedNote);
    
    // Update in the notes list
    setNotes(prev => 
      prev.map(note => 
        note.noteId === updatedNote.noteId ? updatedNote : note
      )
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => router.push(`/encounters/${encounterId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Encounter
          </Button>
          <h1 className="text-2xl font-bold">Clinical Notes</h1>
        </div>

        <Button 
          onClick={handleGenerateNote}
          disabled={isGenerating}
        >
          <Plus className="h-4 w-4 mr-2" />
          {isGenerating ? 'Generating...' : 'Generate Note'}
        </Button>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">No notes found</h3>
                <p className="text-sm text-muted-foreground">
                  Generate a note from the encounter transcripts to get started.
                </p>
              </div>
              <Button onClick={handleGenerateNote} disabled={isGenerating}>
                <Plus className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate First Note'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Note Selection */}
          {notes.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Note Version</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {notes.map((note) => (
                    <Button
                      key={note.noteId}
                      variant={selectedNote?.noteId === note.noteId ? 'default' : 'outline'}
                      onClick={() => setSelectedNote(note)}
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Version {note.metadata.version}
                      <Badge variant={
                        note.status === 'SIGNED' ? 'default' :
                        note.status === 'ERROR' ? 'destructive' :
                        note.status === 'PROCESSING' ? 'secondary' : 'outline'
                      }>
                        {note.status}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Note Content */}
          {selectedNote && (
            <Tabs defaultValue="editor" className="space-y-6">
              <TabsList>
                <TabsTrigger value="editor" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Note Editor
                </TabsTrigger>
                <TabsTrigger value="codes" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Medical Codes
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Version History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="editor">
                <SOAPNoteEditor
                  note={selectedNote}
                  onNoteUpdate={handleNoteUpdate}
                />
              </TabsContent>

              <TabsContent value="codes">
                <MedicalCodesManager
                  noteId={selectedNote.noteId}
                  codes={selectedNote.codes}
                  onCodesUpdate={(codes) => handleNoteUpdate({
                    ...selectedNote,
                    codes,
                  })}
                  readonly={selectedNote.status === 'SIGNED'}
                />
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle>Version History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingHistory ? (
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </div>
                    ) : noteHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No version history available</p>
                    ) : (
                      <div className="space-y-4">
                        {noteHistory.map((version) => (
                          <div key={`${version.noteId}-${version.metadata.version}`} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Version {version.metadata.version}</Badge>
                                <Badge variant={
                                  version.status === 'SIGNED' ? 'default' :
                                  version.status === 'ERROR' ? 'destructive' :
                                  'outline'
                                }>
                                  {version.status}
                                </Badge>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {new Date(version.metadata.lastModified).toLocaleString()}
                              </span>
                            </div>
                            
                            {version.audit.signed && (
                              <p className="text-sm text-muted-foreground">
                                Signed by {version.audit.signed.userId} on{' '}
                                {new Date(version.audit.signed.timestamp).toLocaleString()}
                              </p>
                            )}
                            
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedNote(version)}
                              >
                                View This Version
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}