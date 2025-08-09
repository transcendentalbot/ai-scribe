# Smart Clipboard Context

## Requirements
- Parse notes into copyable sections
- Manual EHR selection (Epic, MEDITECH, Cerner, Other)
- Section-specific formatting per EHR
- Visual clipboard panel
- Keyboard shortcuts
- Clear clipboard between encounters

## Clipboard Sections
- Full Note (Ctrl+Shift+C)
- Chief Complaint (Ctrl+Shift+1)
- Subjective (Ctrl+Shift+2)
- Objective (Ctrl+Shift+3)
- Assessment (Ctrl+Shift+4)
- Plan (Ctrl+Shift+5)
- Medications (Ctrl+Shift+6)
- ICD-10 Codes (Ctrl+Shift+7)

## EHR Formatting
Epic:
- Use .phrase compatible format
- Numbered lists with **
- Medications as sig format

MEDITECH:
- Plain text with clear headers
- Medications one per line
- Diagnoses with codes first

Cerner:
- RTF-compatible formatting
- Bulleted lists with •
- Bold headers

## Usage Tracking
- Log which sections copied
- Track EHR selected
- Monitor copy success rate

**Cursor Prompt**:
```
Implement smart clipboard system:
1. Note parser to extract sections
2. EHR-specific formatters
3. React clipboard UI panel
4. Keyboard shortcut handler
5. Copy feedback notifications
6. Usage analytics to DynamoDB

Make clipboard intuitive and fast to use.
```