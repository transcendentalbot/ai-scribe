# Note Generation System PRP

## Feature: Complete SOAP Note Generation System

### Context
Audio transcriptions from doctor-patient visits need to be converted into structured SOAP notes with ICD-10/CPT codes. Vitals are already in the EHR (entered by MA), so we only capture physical exam findings from transcripts. System must be HIPAA-compliant with full audit logging.

### Data Flow

**Input** (from transcription webhook):
```json
{
  "transcriptionId": "uuid",
  "transcript": "full conversation text",
  "duration": 600,
  "metadata": {
    "patientId": "string",
    "providerId": "string",
    "encounterDate": "ISO-8601",
    "clinicId": "string"
  }
}
```

**Output** (structured note):
```json
{
  "noteId": "uuid",
  "status": "PROCESSING|DRAFT|EDITED|SIGNED|ERROR",
  "sections": {
    "chiefComplaint": "string",
    "subjective": {
      "hpi": "string",
      "ros": "string", 
      "medications": ["med + dosage"],
      "allergies": ["allergy + reaction"]
    },
    "objective": {
      "vitals": "[See EHR flowsheet]",
      "physicalExam": "string"
    },
    "assessment": "string",
    "plan": ["1. action", "2. action"]
  },
  "codes": {
    "icd10": [{"code": "E11.9", "description": "Type 2 diabetes", "confidence": 0.85}],
    "cpt": [{"code": "99213", "description": "Office visit, 15 min"}]
  },
  "metadata": {
    "generatedAt": "ISO-8601",
    "lastModified": "ISO-8601",
    "modifiedBy": "providerId",
    "version": 1,
    "processingTimeMs": 3500
  },
  "audit": {
    "created": {"userId": "string", "timestamp": "ISO-8601"},
    "edits": [{"userId": "string", "timestamp": "ISO-8601", "section": "string"}],
    "signed": {"userId": "string", "timestamp": "ISO-8601"}
  }
}
```

### State Machine
```
PROCESSING → DRAFT → EDITED → SIGNED
     ↓         ↓        ↓
   ERROR    ERROR    ERROR
```

### Lambda Implementation

**Handler with Error Handling & Retry**:
```javascript
// Lambda handler structure
exports.handler = async (event) => {
  // 1. Validate input (required fields)
  // 2. Check JWT token from API Gateway
  // 3. Store transcript in S3 (encrypted)
  // 4. Call GPT-4 with retry logic
  // 5. Parse and validate GPT-4 response
  // 6. Lookup ICD-10/CPT codes
  // 7. Save to DynamoDB with audit log
  // 8. Return note or error with appropriate status code
};

// Error handling:
- Retry GPT-4 once on timeout (8s limit)
- Fallback to template if GPT-4 fails twice
- Log all errors to CloudWatch
- Return partial note with ERROR status if critical failure
```

**GPT-4 Configuration**:
```javascript
const gptConfig = {
  model: "gpt-4-turbo",
  temperature: 0.3,
  max_tokens: 2000,
  timeout: 8000, // 8 seconds, leaving 2s buffer
  messages: [
    {
      role: "system",
      content: `You are a medical scribe for primary care.
      CRITICAL RULES:
      - Extract ONLY information explicitly stated
      - NEVER invent medical information
      - If unsure, mark with [?]
      - Vitals ALWAYS: "[See EHR flowsheet]"
      - Physical exam: ONLY what doctor verbalizes
      - Return valid JSON only`
    },
    {
      role: "user", 
      content: `Convert to SOAP note JSON:
      Chief Complaint: First patient concern (first 30 seconds)
      HPI: Use OPQRST format if applicable
      ROS: Systems mentioned
      Medications: Include dosages
      Assessment: Concise diagnoses
      Plan: Numbered action items
      
      TRANSCRIPT: ${transcript}`
    }
  ]
};
```

### ICD-10/CPT Lookup Module

```javascript
// Static JSON file in Lambda layer
const codes = require('./codes.json');

function lookupCodes(assessment, visitType) {
  // 1. Tokenize assessment text
  // 2. Fuzzy match using Levenshtein distance
  // 3. Filter by confidence threshold (0.7)
  // 4. Return top 3 ICD-10 codes
  // 5. Select CPT based on visit type/duration
  // 6. Handle no matches gracefully
}

// codes.json structure:
{
  "icd10": [
    {"code": "E11.9", "description": "Type 2 diabetes", "keywords": ["diabetes", "DM2", "hyperglycemia"]}
  ],
  "cpt": [
    {"code": "99213", "description": "Office visit, established, 15 min", "visitType": "followup", "minDuration": 10}
  ]
}
```

### DynamoDB Schema

```javascript
// Table: clinical-notes
{
  PK: "NOTE#${noteId}",
  SK: "VERSION#${version}",  // v001, v002, etc.
  GSI1PK: "PROVIDER#${providerId}",
  GSI1SK: "DATE#${encounterDate}",
  GSI2PK: "PATIENT#${patientId}",
  GSI2SK: "DATE#${encounterDate}",
  
  // Attributes
  transcriptId: "string",
  transcriptS3Key: "encrypted-path",
  sections: {}, // SOAP content
  codes: {},    // ICD-10/CPT
  status: "DRAFT|SIGNED|ERROR",
  audit: [],    // All actions logged
  ttl: timestamp + 7 years // HIPAA retention
}

// Encryption at rest enabled
// Point-in-time recovery enabled
// Audit logs to CloudWatch
```

### React Editor Component

**Component with Full Features**:
```javascript
const NoteEditor = () => {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [version, setVersion] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  
  // Features to implement:
  // 1. Fetch note from API (with JWT)
  // 2. Section-level editing (contentEditable)
  // 3. Auto-save every 10 seconds (debounced)
  // 4. Character count per section (max 5000)
  // 5. Required field validation
  // 6. Version history viewer (last 10)
  // 7. Diff highlighting for changes
  // 8. Sign & lock functionality
  // 9. Warning if unsigned after 24 hours
  // 10. ICD-10/CPT code management (add/remove)
  
  return (
    // Editor UI with:
    // - Status indicator (Draft/Signed/Error)
    // - Save status (saving/saved/error)
    // - Character counters
    // - Version selector
    // - Sign button with confirmation
    // - Error notifications
  );
};

// Validation rules:
const validateSection = (section, content) => {
  const rules = {
    chiefComplaint: { required: true, maxLength: 500 },
    'subjective.hpi': { required: true, maxLength: 5000 },
    'objective.physicalExam': { required: false, maxLength: 5000 },
    assessment: { required: true, maxLength: 2000 },
    plan: { required: true, maxLength: 3000 }
  };
  
  // Return validation errors
};

// Auto-save implementation:
useEffect(() => {
  const timer = setTimeout(() => {
    if (hasChanges && status !== 'SIGNED') {
      saveNote();
    }
  }, 10000); // 10 seconds
  
  return () => clearTimeout(timer);
}, [note]);
```

### Security Implementation

```javascript
// 1. API Gateway with JWT validation
const authorizer = async (event) => {
  // Validate JWT token
  // Check provider permissions
  // Return IAM policy
};

// 2. S3 encryption for transcripts
const s3Config = {
  Bucket: 'clinical-transcripts',
  ServerSideEncryption: 'AES256',
  ACL: 'private',
  LifecycleRules: [
    { Status: 'Enabled', ExpirationInDays: 2555 } // 7 years
  ]
};

// 3. Audit logging
const auditLog = {
  action: 'NOTE_CREATED|NOTE_EDITED|NOTE_SIGNED|NOTE_VIEWED',
  userId: 'providerId',
  noteId: 'uuid',
  timestamp: 'ISO-8601',
  changes: {}, // For edits
  ipAddress: 'string',
  userAgent: 'string'
};

// 4. VPC configuration
// - Lambda in private subnet
// - VPC endpoints for S3, DynamoDB
// - No internet gateway needed
```

### Error Handling Strategy

```javascript
// Errors to handle:
const errorTypes = {
  INVALID_INPUT: { status: 400, message: "Missing required fields" },
  UNAUTHORIZED: { status: 401, message: "Invalid authentication" },
  GPT_TIMEOUT: { status: 504, retry: true, fallback: true },
  GPT_ERROR: { status: 502, retry: true, fallback: true },
  DB_ERROR: { status: 503, retry: true },
  VALIDATION_ERROR: { status: 422, message: "Invalid note structure" }
};

// Retry logic:
async function withRetry(fn, maxAttempts = 2) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1 || !error.retry) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}

// Fallback template for GPT-4 failure:
const fallbackTemplate = {
  chiefComplaint: "[Unable to extract - please review transcript]",
  subjective: { hpi: "[See transcript]", medications: [], allergies: [] },
  objective: { vitals: "[See EHR flowsheet]", physicalExam: "" },
  assessment: "[Requires manual entry]",
  plan: ["[Requires manual entry]"]
};
```

### Monitoring & Alerts

```javascript
// CloudWatch metrics to track:
const metrics = {
  'NoteGenerationTime': duration,
  'GPT4Latency': gptTime,
  'GPT4Errors': errorCount,
  'NotesGenerated': count,
  'NotesSigned': count,
  'AutoSaveFailures': count
};

// Alarms:
// - GPT-4 error rate > 10%
// - Average generation time > 8 seconds
// - DynamoDB throttling
// - Lambda errors > 1%
```

### Implementation Checklist

**Lambda Function**:
```
□ Input validation
□ JWT authentication check
□ S3 transcript storage (encrypted)
□ GPT-4 integration with retry
□ Response parsing and validation
□ ICD-10/CPT lookup
□ DynamoDB save with versioning
□ Audit logging
□ Error handling with appropriate status codes
□ CloudWatch metrics
```

**React Editor**:
```
□ Secure API calls with JWT
□ Section-based editing
□ Auto-save every 10 seconds
□ Character limits (5000/section)
□ Required field validation
□ Version history (last 10)
□ Diff visualization
□ Sign & lock mechanism
□ 24-hour unsigned warning
□ ICD-10/CPT code management
□ Loading/error states
□ Accessibility (ARIA labels)
```

**Infrastructure**:
```
□ DynamoDB table with encryption
□ S3 bucket with lifecycle rules
□ Lambda in VPC with endpoints
□ API Gateway with authorizer
□ CloudWatch logs and alarms
□ Secrets Manager for API keys
□ IAM roles with least privilege
```

### Success Criteria
- ✅ Notes generated in <10 seconds (95th percentile)
- ✅ No hallucinated medical information
- ✅ All PHI encrypted at rest and in transit
- ✅ Complete audit trail for compliance
- ✅ Auto-save prevents data loss
- ✅ Version history for all edits
- ✅ Graceful degradation on failures
- ✅ HIPAA-compliant retention (7 years)