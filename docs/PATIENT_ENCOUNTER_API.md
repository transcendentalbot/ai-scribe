# Patient & Encounter Management API Documentation

## Overview

The Patient & Encounter Management module provides comprehensive APIs for managing patient records, scheduling encounters, tracking consent, and managing the encounter workflow. All endpoints require authentication via Cognito JWT tokens.

## Base URL
- Production: `https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod`

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Patient Management Endpoints

### 1. Create Patient
**Endpoint:** `POST /patients`  
**Description:** Create a new patient record

**Request Body:**
```json
{
  "mrn": "MRN12345",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1980-05-15",
  "gender": "Male",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "Boston",
    "state": "MA",
    "zipCode": "02101",
    "country": "USA"
  },
  "emergencyContact": {
    "name": "Jane Doe",
    "relationship": "Spouse",
    "phone": "+1234567891"
  },
  "insuranceInfo": {
    "provider": "Blue Cross",
    "policyNumber": "BC123456",
    "groupNumber": "GRP789"
  },
  "allergies": ["Penicillin", "Peanuts"],
  "medications": ["Lisinopril 10mg daily"],
  "conditions": ["Hypertension", "Type 2 Diabetes"]
}
```

**Response (201):**
```json
{
  "patient": {
    "id": "uuid",
    "mrn": "MRN12345",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1980-05-15",
    "gender": "Male",
    // ... all patient fields ...
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z",
    "createdBy": "provider-id",
    "lastModifiedBy": "provider-id"
  }
}
```

### 2. Get Patient
**Endpoint:** `GET /patients/{patientId}`  
**Description:** Retrieve patient information by ID

**Response (200):**
```json
{
  "patient": {
    // Full patient object
  }
}
```

### 3. Search Patients
**Endpoint:** `GET /patients/search`  
**Description:** Search patients by name, MRN, or date of birth

**Query Parameters:**
- `query` (required): Search term (min 2 characters)
- `limit` (optional): Number of results (default: 20)
- `nextToken` (optional): Pagination token

**Response (200):**
```json
{
  "patients": [
    {
      // Patient objects
    }
  ],
  "nextToken": "pagination-token"
}
```

## Encounter Management Endpoints

### 4. Create Encounter
**Endpoint:** `POST /encounters`  
**Description:** Schedule a new encounter

**Request Body:**
```json
{
  "patientId": "patient-uuid",
  "scheduledAt": "2024-01-15T14:00:00Z",
  "type": "FOLLOW_UP",
  "chiefComplaint": "Follow-up for hypertension",
  "reasonForVisit": "3-month check-up",
  "location": {
    "facilityName": "Main Clinic",
    "roomNumber": "Room 203",
    "department": "Internal Medicine"
  }
}
```

**Response (201):**
```json
{
  "encounter": {
    "id": "encounter-uuid",
    "patientId": "patient-uuid",
    "providerId": "provider-uuid",
    "scheduledAt": "2024-01-15T14:00:00Z",
    "status": "SCHEDULED",
    "type": "FOLLOW_UP",
    // ... all encounter fields ...
  }
}
```

### 5. Update Encounter Status
**Endpoint:** `PUT /encounters/{encounterId}/status`  
**Description:** Update encounter status following the workflow

**Request Body:**
```json
{
  "status": "CHECKED_IN",
  "notes": "Patient arrived 10 minutes early"
}
```

**Valid Status Transitions:**
- SCHEDULED → CHECKED_IN, CANCELLED, NO_SHOW
- CHECKED_IN → IN_PROGRESS, CANCELLED, NO_SHOW
- IN_PROGRESS → COMPLETED, CANCELLED
- COMPLETED, CANCELLED, NO_SHOW → (Terminal states)

**Response (200):**
```json
{
  "encounter": {
    // Updated encounter object
  }
}
```

### 6. Capture Consent
**Endpoint:** `POST /encounters/{encounterId}/consent`  
**Description:** Capture patient consent for recording, data sharing, or treatment

**Request Body:**
```json
{
  "type": "RECORDING",
  "granted": true,
  "notes": "Patient verbally consented to audio recording",
  "expiresAt": "2025-01-15T00:00:00Z"
}
```

**Consent Types:**
- `RECORDING`: Consent for audio/video recording
- `DATA_SHARING`: Consent for sharing medical data
- `TREATMENT`: Consent for treatment

**Response (200):**
```json
{
  "encounter": {
    // Encounter with updated consents array
  },
  "message": "Consent for RECORDING has been granted"
}
```

### 7. Get Daily Encounters
**Endpoint:** `GET /encounters/daily`  
**Description:** Get all encounters for a specific date

**Query Parameters:**
- `date` (optional): Date in YYYY-MM-DD format (defaults to today)
- `providerId` (optional): Filter by provider (defaults to current user)
- `status` (optional): Filter by status
- `limit` (optional): Number of results (default: 50)
- `nextToken` (optional): Pagination token

**Response (200):**
```json
{
  "date": "2024-01-15",
  "providerId": "provider-uuid",
  "encounters": [
    {
      "id": "encounter-uuid",
      "patientId": "patient-uuid",
      "status": "SCHEDULED",
      "scheduledAt": "2024-01-15T09:00:00Z",
      "type": "ROUTINE",
      "patient": {
        // Patient information included
        "id": "patient-uuid",
        "firstName": "John",
        "lastName": "Doe",
        "mrn": "MRN12345"
      }
      // ... other encounter fields ...
    }
  ],
  "nextToken": "pagination-token",
  "summary": {
    "total": 15,
    "byStatus": {
      "SCHEDULED": 8,
      "CHECKED_IN": 2,
      "IN_PROGRESS": 1,
      "COMPLETED": 4
    }
  }
}
```

## Error Responses

All endpoints return errors in the following format:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [] // Optional validation errors
}
```

Common HTTP status codes:
- 400: Bad Request (validation errors)
- 401: Unauthorized (invalid or missing token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (patient/encounter not found)
- 409: Conflict (duplicate MRN, invalid status transition)
- 500: Internal Server Error

## Testing with cURL

### Create a patient:
```bash
curl -X POST https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod/patients \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mrn": "TEST001",
    "firstName": "Test",
    "lastName": "Patient",
    "dateOfBirth": "1990-01-01",
    "gender": "Female"
  }'
```

### Search patients:
```bash
curl -X GET "https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod/patients/search?query=Smith" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create an encounter:
```bash
curl -X POST https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod/encounters \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "PATIENT_UUID",
    "scheduledAt": "2024-01-15T14:00:00Z",
    "type": "ROUTINE",
    "chiefComplaint": "Annual check-up"
  }'
```

### Update encounter status:
```bash
curl -X PUT https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod/encounters/ENCOUNTER_UUID/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CHECKED_IN"
  }'
```

### Capture consent:
```bash
curl -X POST https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod/encounters/ENCOUNTER_UUID/consent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "RECORDING",
    "granted": true
  }'
```

### Get daily encounters:
```bash
curl -X GET "https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod/encounters/daily?date=2024-01-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Workflow Example

1. **Schedule Encounter**: Create an encounter with status `SCHEDULED`
2. **Patient Arrival**: Update status to `CHECKED_IN`
3. **Capture Consent**: Record patient consent for recording/treatment
4. **Start Visit**: Update status to `IN_PROGRESS`
5. **During Visit**: 
   - Update vitals
   - Add notes
   - Record audio (if consented)
6. **Complete Visit**: Update status to `COMPLETED`
   - Add diagnoses
   - Add procedures
   - Add medications
   - Add follow-up instructions

## HIPAA Compliance

- All patient data access is logged for audit trails
- PHI access requires authentication and authorization
- All data is encrypted at rest and in transit
- Consent is tracked and verified before recording
- Access logs include provider ID, patient ID, action, and timestamp