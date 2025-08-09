# Encounter Management Context

## Requirements
- Primary care focus (15-20 minute visits)
- Patient lookup by name or MRN
- Manual encounter start with consent checkbox
- Track encounter status: draft, completed, signed
- 7-year retention for all encounters/notes

## Database Schema
- PK: ENCOUNTER#{encounterId}
- SK: METADATA
- GSI1PK: PROVIDER#{providerId}
- GSI1SK: DATE#{YYYY-MM-DD}
- Attributes: patientName, patientMRN, encounterType, status, startTime, endTime, consentObtained, audioQuality

## Patient Data
- Minimal PHI: name and MRN only
- No DOB or demographics for MVP
- Encrypt name and MRN in DynamoDB

## Encounter Types
- New Patient Visit
- Follow-up Visit
- Sick Visit
- Wellness Check

## UI Requirements
- Encounter list showing today's patients
- Quick search by name or MRN
- Big "Start Documentation" button
- Consent checkbox (required)
- Clear recording status indicator

**Cursor Prompt**:
```
Build patient and encounter management:
1. Lambda functions for CRUD operations on encounters
2. DynamoDB queries for provider's daily encounters
3. Patient search with encrypted name/MRN
4. React components for encounter list and details
5. Consent capture UI with audit trail
6. Status management (draft to signed workflow)

Ensure all PHI is encrypted and access is logged.
```