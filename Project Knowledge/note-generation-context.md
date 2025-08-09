# Note Generation Context

## Requirements
- Generate SOAP notes for primary care
- Process within 10 seconds
- GPT-4 with medical prompt
- ICD-10 and CPT code suggestions
- Direct editing of generated notes

## SOAP Structure
- Chief Complaint: First patient statement
- Subjective: HPI, ROS, medications, allergies
- Objective: Vitals, physical exam findings
- Assessment: Diagnoses with ICD-10 codes
- Plan: Treatment, medications, follow-up

## Code Suggestions
- Top 3 ICD-10 codes with >70% confidence
- Common CPT codes for primary care
- Basic lookup table (no external API)

## GPT-4 Prompt Template
"Convert this medical conversation to a SOAP note:
- Format for primary care documentation
- Extract all medications with dosages
- Identify chief complaint in first 30 seconds
- Suggest appropriate ICD-10 codes
- Keep assessment concise
- Format plan as numbered list"

## Editing
- Each section independently editable
- Track changes with version history
- Auto-save every 10 seconds
- "Sign Note" button locks the note

**Cursor Prompt**:
```
Build note generation system:
1. Lambda function triggered after transcription
2. GPT-4 integration with medical prompts
3. SOAP note parser and formatter
4. ICD-10/CPT lookup tables
5. React note editor with section-based editing
6. Auto-save and version tracking in DynamoDB

Ensure medical accuracy and fast generation time.
```