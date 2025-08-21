'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  ClinicalNote, 
  SOAPSections, 
  updateNote, 
  signNote, 
  VALIDATION_RULES,
  validateSection,
  getCharacterCount,
  hasUnsavedChanges 
} from '@/lib/notes-api';
import { formatDistanceToNow } from 'date-fns';

interface SOAPNoteEditorProps {
  note: ClinicalNote;
  onNoteUpdate: (note: ClinicalNote) => void;
  readonly?: boolean;
}

interface SectionErrors {
  [key: string]: string[];
}

const AUTOSAVE_DELAY = 10000; // 10 seconds as specified in PRP

export function SOAPNoteEditor({ note, onNoteUpdate, readonly = false }: SOAPNoteEditorProps) {
  const [sections, setSections] = useState<SOAPSections>(note.sections);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [errors, setErrors] = useState<SectionErrors>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSigningNote, setIsSigningNote] = useState(false);
  const [showUnsignedWarning, setShowUnsignedWarning] = useState(false);
  
  const autosaveTimerRef = useRef<NodeJS.Timeout>();
  const lastSavedSectionsRef = useRef<SOAPSections>(note.sections);

  // Check for 24-hour unsigned warning
  useEffect(() => {
    if (note.status !== 'SIGNED') {
      const createdTime = new Date(note.metadata.generatedAt);
      const now = new Date();
      const hoursSinceCreated = (now.getTime() - createdTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCreated >= 24) {
        setShowUnsignedWarning(true);
      }
    }
  }, [note]);

  // Auto-save functionality with 10-second delay
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    if (note.status === 'SIGNED' || readonly) {
      return; // Don't auto-save signed notes
    }

    autosaveTimerRef.current = setTimeout(async () => {
      if (hasUnsavedChanges(lastSavedSectionsRef.current, sections)) {
        await saveNote();
      }
    }, AUTOSAVE_DELAY);
  }, [sections, note.status, readonly]);

  // Save note function
  const saveNote = useCallback(async () => {
    if (note.status === 'SIGNED' || readonly) {
      return;
    }

    try {
      setSaveStatus('saving');
      
      const updatedNote = await updateNote(note.noteId, {
        sections,
        status: 'EDITED',
      });
      
      onNoteUpdate(updatedNote);
      lastSavedSectionsRef.current = sections;
      setHasChanges(false);
      setSaveStatus('saved');
      
      toast.success('Note saved successfully');
    } catch (error) {
      console.error('Failed to save note:', error);
      setSaveStatus('error');
      toast.error('Failed to save note');
    }
  }, [note.noteId, note.status, sections, onNoteUpdate, readonly]);

  // Handle section updates
  const updateSection = useCallback((path: string, value: string | string[]) => {
    if (note.status === 'SIGNED' || readonly) {
      return;
    }

    setSections(prev => {
      const newSections = { ...prev };
      const keys = path.split('.');
      let current: any = newSections;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSections;
    });

    setHasChanges(true);
    scheduleAutosave();
  }, [note.status, readonly, scheduleAutosave]);

  // Validate all sections
  const validateAllSections = useCallback(() => {
    const newErrors: SectionErrors = {};
    
    // Validate each section according to PRP rules
    Object.entries(VALIDATION_RULES).forEach(([section, rule]) => {
      let content = '';
      
      if (section === 'chiefComplaint') {
        content = sections.chiefComplaint;
      } else if (section === 'subjective.hpi') {
        content = sections.subjective.hpi;
      } else if (section === 'objective.physicalExam') {
        content = sections.objective.physicalExam;
      } else if (section === 'assessment') {
        content = sections.assessment;
      } else if (section === 'plan') {
        content = sections.plan.join('\\n');
      }
      
      const sectionErrors = validateSection(section, content);
      if (sectionErrors.length > 0) {
        newErrors[section] = sectionErrors;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [sections]);

  // Sign note functionality
  const handleSignNote = async () => {
    if (!validateAllSections()) {
      toast.error('Please fix validation errors before signing');
      return;
    }

    try {
      setIsSigningNote(true);
      
      // Save any pending changes first
      if (hasChanges) {
        await saveNote();
      }
      
      const signedNote = await signNote(note.noteId);
      onNoteUpdate(signedNote);
      setShowUnsignedWarning(false);
      
      toast.success('Note signed and locked successfully');
    } catch (error) {
      console.error('Failed to sign note:', error);
      toast.error('Failed to sign note');
    } finally {
      setIsSigningNote(false);
    }
  };

  // Cleanup autosave timer
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Track changes
  useEffect(() => {
    const hasCurrentChanges = hasUnsavedChanges(lastSavedSectionsRef.current, sections);
    setHasChanges(hasCurrentChanges);
  }, [sections]);

  // Status indicator component
  const StatusIndicator = () => (
    <div className="flex items-center gap-2">
      <Badge variant={
        note.status === 'SIGNED' ? 'default' :
        note.status === 'ERROR' ? 'destructive' :
        note.status === 'PROCESSING' ? 'secondary' : 'outline'
      }>
        {note.status}
      </Badge>
      
      <span className="text-sm text-muted-foreground">
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && !hasChanges && 'All changes saved'}
        {saveStatus === 'error' && 'Save failed'}
        {hasChanges && saveStatus !== 'saving' && 'Unsaved changes'}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>SOAP Note</CardTitle>
            <StatusIndicator />
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Version {note.metadata.version}</span>
            <span>Generated {formatDistanceToNow(new Date(note.metadata.generatedAt))} ago</span>
            {note.metadata.lastModified !== note.metadata.generatedAt && (
              <span>Modified {formatDistanceToNow(new Date(note.metadata.lastModified))} ago</span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Unsigned warning */}
      {showUnsignedWarning && (
        <Alert>
          <AlertDescription>
            This note has been unsigned for more than 24 hours. Please review and sign to complete documentation.
          </AlertDescription>
        </Alert>
      )}

      {/* Chief Complaint */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chief Complaint</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Textarea
              value={sections.chiefComplaint}
              onChange={(e) => updateSection('chiefComplaint', e.target.value)}
              placeholder="Patient's primary concern..."
              disabled={note.status === 'SIGNED' || readonly}
              className={errors.chiefComplaint ? 'border-red-500' : ''}
              rows={3}
            />
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{getCharacterCount(sections.chiefComplaint)}/{VALIDATION_RULES.chiefComplaint.maxLength} characters</span>
              {errors.chiefComplaint && (
                <span className="text-red-500">{errors.chiefComplaint.join(', ')}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subjective */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subjective</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* HPI */}
          <div className="space-y-2">
            <Label htmlFor="hpi">History of Present Illness</Label>
            <Textarea
              id="hpi"
              value={sections.subjective.hpi}
              onChange={(e) => updateSection('subjective.hpi', e.target.value)}
              placeholder="OPQRST format: Onset, Provocation, Quality, Region, Severity, Timing..."
              disabled={note.status === 'SIGNED' || readonly}
              className={errors['subjective.hpi'] ? 'border-red-500' : ''}
              rows={6}
            />
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{getCharacterCount(sections.subjective.hpi)}/{VALIDATION_RULES['subjective.hpi'].maxLength} characters</span>
              {errors['subjective.hpi'] && (
                <span className="text-red-500">{errors['subjective.hpi'].join(', ')}</span>
              )}
            </div>
          </div>

          {/* ROS */}
          <div className="space-y-2">
            <Label htmlFor="ros">Review of Systems</Label>
            <Textarea
              id="ros"
              value={sections.subjective.ros}
              onChange={(e) => updateSection('subjective.ros', e.target.value)}
              placeholder="Systems reviewed..."
              disabled={note.status === 'SIGNED' || readonly}
              rows={4}
            />
          </div>

          {/* Medications */}
          <div className="space-y-2">
            <Label htmlFor="medications">Current Medications</Label>
            <Textarea
              id="medications"
              value={sections.subjective.medications.join('\\n')}
              onChange={(e) => updateSection('subjective.medications', e.target.value.split('\\n').filter(Boolean))}
              placeholder="One medication per line with dosage..."
              disabled={note.status === 'SIGNED' || readonly}
              rows={4}
            />
          </div>

          {/* Allergies */}
          <div className="space-y-2">
            <Label htmlFor="allergies">Allergies</Label>
            <Textarea
              id="allergies"
              value={sections.subjective.allergies.join('\\n')}
              onChange={(e) => updateSection('subjective.allergies', e.target.value.split('\\n').filter(Boolean))}
              placeholder="One allergy per line with reaction..."
              disabled={note.status === 'SIGNED' || readonly}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Objective */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Objective</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vitals */}
          <div className="space-y-2">
            <Label>Vital Signs</Label>
            <div className="p-3 bg-muted rounded-md">
              <span className="text-muted-foreground">{sections.objective.vitals}</span>
            </div>
          </div>

          {/* Physical Exam */}
          <div className="space-y-2">
            <Label htmlFor="physicalExam">Physical Examination</Label>
            <Textarea
              id="physicalExam"
              value={sections.objective.physicalExam}
              onChange={(e) => updateSection('objective.physicalExam', e.target.value)}
              placeholder="Physical examination findings..."
              disabled={note.status === 'SIGNED' || readonly}
              className={errors['objective.physicalExam'] ? 'border-red-500' : ''}
              rows={6}
            />
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{getCharacterCount(sections.objective.physicalExam)}/{VALIDATION_RULES['objective.physicalExam'].maxLength} characters</span>
              {errors['objective.physicalExam'] && (
                <span className="text-red-500">{errors['objective.physicalExam'].join(', ')}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Textarea
              value={sections.assessment}
              onChange={(e) => updateSection('assessment', e.target.value)}
              placeholder="Clinical diagnoses and impressions..."
              disabled={note.status === 'SIGNED' || readonly}
              className={errors.assessment ? 'border-red-500' : ''}
              rows={5}
            />
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{getCharacterCount(sections.assessment)}/{VALIDATION_RULES.assessment.maxLength} characters</span>
              {errors.assessment && (
                <span className="text-red-500">{errors.assessment.join(', ')}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Textarea
              value={sections.plan.join('\\n')}
              onChange={(e) => updateSection('plan', e.target.value.split('\\n').filter(Boolean))}
              placeholder="1. Action item one\\n2. Action item two\\n3. Follow-up instructions..."
              disabled={note.status === 'SIGNED' || readonly}
              className={errors.plan ? 'border-red-500' : ''}
              rows={6}
            />
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{getCharacterCount(sections.plan.join('\\n'))}/{VALIDATION_RULES.plan.maxLength} characters</span>
              {errors.plan && (
                <span className="text-red-500">{errors.plan.join(', ')}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {note.status !== 'SIGNED' && !readonly && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Button 
                onClick={saveNote} 
                variant="outline"
                disabled={!hasChanges || saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save Now'}
              </Button>
              
              <Button 
                onClick={handleSignNote}
                disabled={isSigningNote || Object.keys(errors).length > 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSigningNote ? 'Signing...' : 'Sign & Lock Note'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}