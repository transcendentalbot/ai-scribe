import * as medicalCodes from '../data/medical-codes.json';

// Levenshtein distance function for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator, // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return (maxLength - distance) / maxLength;
}

// Tokenize assessment text for keyword matching
function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

interface ICD10Code {
  code: string;
  description: string;
  keywords: string[];
}

interface CPTCode {
  code: string;
  description: string;
  visitType: string;
  minDuration: number;
  maxDuration: number;
}

interface ICD10Match {
  code: string;
  description: string;
  confidence: number;
}

interface CPTMatch {
  code: string;
  description: string;
}

/**
 * Lookup ICD-10 codes based on assessment text
 * Returns top 3 codes with >70% confidence as specified in PRP
 */
export function lookupICD10Codes(assessment: string): ICD10Match[] {
  const tokens = tokenizeText(assessment);
  const icd10Codes = medicalCodes.icd10 as ICD10Code[];
  const matches: Array<ICD10Match & { score: number }> = [];

  for (const icd10 of icd10Codes) {
    let maxScore = 0;

    // Check direct keyword matches
    for (const keyword of icd10.keywords) {
      for (const token of tokens) {
        const similarity = calculateSimilarity(keyword, token);
        if (similarity > maxScore) {
          maxScore = similarity;
        }
      }

      // Check if full keyword appears in assessment
      const keywordInText = assessment.toLowerCase().includes(keyword.toLowerCase());
      if (keywordInText) {
        maxScore = Math.max(maxScore, 0.9);
      }
    }

    // Check description similarity
    const descriptionSimilarity = calculateSimilarity(
      icd10.description.toLowerCase(),
      assessment.toLowerCase()
    );
    maxScore = Math.max(maxScore, descriptionSimilarity * 0.8);

    // Only include if confidence > 0.7 as specified in PRP
    if (maxScore >= 0.7) {
      matches.push({
        code: icd10.code,
        description: icd10.description,
        confidence: Math.round(maxScore * 100) / 100,
        score: maxScore,
      });
    }
  }

  // Sort by score and return top 3
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score, ...match }) => match);
}

/**
 * Select CPT code based on visit type and duration
 * As specified in PRP
 */
export function lookupCPTCode(visitType: string, duration: number): CPTMatch | null {
  const cptCodes = medicalCodes.cpt as CPTCode[];
  
  // Normalize visit type
  const normalizedVisitType = visitType.toLowerCase();
  let mappedVisitType = 'followup'; // default

  if (normalizedVisitType.includes('new') || normalizedVisitType.includes('first')) {
    mappedVisitType = 'new';
  } else if (normalizedVisitType.includes('wellness') || normalizedVisitType.includes('physical') || normalizedVisitType.includes('preventive')) {
    mappedVisitType = 'wellness';
  } else if (normalizedVisitType.includes('minimal') || normalizedVisitType.includes('brief')) {
    mappedVisitType = 'minimal';
  }

  // Find best match based on visit type and duration
  const candidateCodes = cptCodes.filter(code => 
    code.visitType === mappedVisitType || 
    (mappedVisitType === 'followup' && code.visitType === 'followup')
  );

  if (candidateCodes.length === 0) {
    // Fallback to established patient codes
    const fallbackCodes = cptCodes.filter(code => code.visitType === 'followup');
    candidateCodes.push(...fallbackCodes);
  }

  // Find code that best matches duration
  let bestMatch: CPTCode | null = null;
  let smallestDiff = Infinity;

  for (const code of candidateCodes) {
    const midDuration = (code.minDuration + code.maxDuration) / 2;
    const diff = Math.abs(duration - midDuration);
    
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestMatch = code;
    }
  }

  if (!bestMatch) {
    // Ultimate fallback - most common established patient visit
    return {
      code: '99213',
      description: 'Office visit, established patient, 15 minutes',
    };
  }

  return {
    code: bestMatch.code,
    description: bestMatch.description,
  };
}

/**
 * Combined lookup function for both ICD-10 and CPT codes
 * Used by the note generation handler
 */
export function lookupMedicalCodes(
  assessment: string, 
  visitType: string, 
  duration: number
): {
  icd10: ICD10Match[];
  cpt: CPTMatch[];
} {
  const icd10Codes = lookupICD10Codes(assessment);
  const cptCode = lookupCPTCode(visitType, duration);

  return {
    icd10: icd10Codes,
    cpt: cptCode ? [cptCode] : [],
  };
}

/**
 * Handle no matches gracefully as specified in PRP
 */
export function getDefaultCodes(visitType: string, duration: number): {
  icd10: ICD10Match[];
  cpt: CPTMatch[];
} {
  return {
    icd10: [], // No default ICD-10 codes
    cpt: [lookupCPTCode(visitType, duration) || {
      code: '99213',
      description: 'Office visit, established patient, 15 minutes',
    }],
  };
}