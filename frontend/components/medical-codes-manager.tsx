'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MedicalCodes, updateICD10Codes, updateCPTCodes } from '@/lib/notes-api';

interface MedicalCodesManagerProps {
  noteId: string;
  codes: MedicalCodes;
  onCodesUpdate: (codes: MedicalCodes) => void;
  readonly?: boolean;
}

export function MedicalCodesManager({ 
  noteId, 
  codes, 
  onCodesUpdate, 
  readonly = false 
}: MedicalCodesManagerProps) {
  const [newICD10, setNewICD10] = useState({ code: '', description: '', confidence: 0.85 });
  const [newCPT, setNewCPT] = useState({ code: '', description: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  // Add new ICD-10 code
  const handleAddICD10 = async () => {
    if (!newICD10.code || !newICD10.description) {
      toast.error('Please enter both code and description');
      return;
    }

    try {
      setIsUpdating(true);
      const updatedCodes = [...codes.icd10, newICD10];
      await updateICD10Codes(noteId, updatedCodes);
      
      onCodesUpdate({
        ...codes,
        icd10: updatedCodes,
      });
      
      setNewICD10({ code: '', description: '', confidence: 0.85 });
      toast.success('ICD-10 code added');
    } catch (error) {
      toast.error('Failed to add ICD-10 code');
    } finally {
      setIsUpdating(false);
    }
  };

  // Remove ICD-10 code
  const handleRemoveICD10 = async (index: number) => {
    try {
      setIsUpdating(true);
      const updatedCodes = codes.icd10.filter((_, i) => i !== index);
      await updateICD10Codes(noteId, updatedCodes);
      
      onCodesUpdate({
        ...codes,
        icd10: updatedCodes,
      });
      
      toast.success('ICD-10 code removed');
    } catch (error) {
      toast.error('Failed to remove ICD-10 code');
    } finally {
      setIsUpdating(false);
    }
  };

  // Add new CPT code
  const handleAddCPT = async () => {
    if (!newCPT.code || !newCPT.description) {
      toast.error('Please enter both code and description');
      return;
    }

    try {
      setIsUpdating(true);
      const updatedCodes = [...codes.cpt, newCPT];
      await updateCPTCodes(noteId, updatedCodes);
      
      onCodesUpdate({
        ...codes,
        cpt: updatedCodes,
      });
      
      setNewCPT({ code: '', description: '' });
      toast.success('CPT code added');
    } catch (error) {
      toast.error('Failed to add CPT code');
    } finally {
      setIsUpdating(false);
    }
  };

  // Remove CPT code
  const handleRemoveCPT = async (index: number) => {
    try {
      setIsUpdating(true);
      const updatedCodes = codes.cpt.filter((_, i) => i !== index);
      await updateCPTCodes(noteId, updatedCodes);
      
      onCodesUpdate({
        ...codes,
        cpt: updatedCodes,
      });
      
      toast.success('CPT code removed');
    } catch (error) {
      toast.error('Failed to remove CPT code');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ICD-10 Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ICD-10 Diagnosis Codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing ICD-10 codes */}
          <div className="space-y-2">
            {codes.icd10.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ICD-10 codes assigned</p>
            ) : (
              codes.icd10.map((code, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{code.code}</Badge>
                      <span className="text-sm font-medium">{code.description}</span>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(code.confidence * 100)}% confidence
                      </Badge>
                    </div>
                  </div>
                  
                  {!readonly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveICD10(index)}
                      disabled={isUpdating}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add new ICD-10 code */}
          {!readonly && (
            <div className="border-t pt-4 space-y-3">
              <Label>Add ICD-10 Code</Label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input
                  placeholder="Code (e.g., E11.9)"
                  value={newICD10.code}
                  onChange={(e) => setNewICD10(prev => ({ ...prev, code: e.target.value }))}
                  disabled={isUpdating}
                />
                <Input
                  placeholder="Description"
                  value={newICD10.description}
                  onChange={(e) => setNewICD10(prev => ({ ...prev, description: e.target.value }))}
                  className="md:col-span-2"
                  disabled={isUpdating}
                />
                <Button onClick={handleAddICD10} disabled={isUpdating}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CPT Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CPT Procedure Codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing CPT codes */}
          <div className="space-y-2">
            {codes.cpt.length === 0 ? (
              <p className="text-sm text-muted-foreground">No CPT codes assigned</p>
            ) : (
              codes.cpt.map((code, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{code.code}</Badge>
                      <span className="text-sm font-medium">{code.description}</span>
                    </div>
                  </div>
                  
                  {!readonly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCPT(index)}
                      disabled={isUpdating}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add new CPT code */}
          {!readonly && (
            <div className="border-t pt-4 space-y-3">
              <Label>Add CPT Code</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  placeholder="Code (e.g., 99213)"
                  value={newCPT.code}
                  onChange={(e) => setNewCPT(prev => ({ ...prev, code: e.target.value }))}
                  disabled={isUpdating}
                />
                <Input
                  placeholder="Description"
                  value={newCPT.description}
                  onChange={(e) => setNewCPT(prev => ({ ...prev, description: e.target.value }))}
                  disabled={isUpdating}
                />
                <Button onClick={handleAddCPT} disabled={isUpdating}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}