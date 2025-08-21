import { Buffer } from 'buffer';

/**
 * Utility functions for working with WebM audio files
 */

// WebM file signature (first 4 bytes)
const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

/**
 * Check if a buffer contains WebM data by looking for the signature
 */
export function isWebMData(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer.slice(0, 4).equals(WEBM_SIGNATURE);
}

/**
 * Extract WebM header from the first chunk
 * The header typically includes EBML, Segment Info, and Track info
 */
export function extractWebMHeader(firstChunk: Buffer): Buffer | null {
  if (!isWebMData(firstChunk)) {
    return null;
  }

  // Simple approach: assume header is in first 1KB
  // In production, you'd parse EBML structure properly
  const headerSize = Math.min(1024, firstChunk.length);
  return firstChunk.slice(0, headerSize);
}

/**
 * Combine WebM chunks ensuring proper structure
 */
export function combineWebMChunks(chunks: Buffer[]): Buffer {
  if (chunks.length === 0) {
    return Buffer.alloc(0);
  }

  // First chunk should contain the WebM header
  const firstChunk = chunks[0];
  if (!isWebMData(firstChunk)) {
    console.warn('First chunk does not contain WebM signature');
    // Just concatenate as-is
    return Buffer.concat(chunks);
  }

  // For subsequent chunks, skip any duplicate headers
  const processedChunks = [firstChunk];
  
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    // If this chunk starts with WebM signature, it might be a new recording
    // Skip the header portion
    if (isWebMData(chunk)) {
      // Skip first 1KB (approximate header size)
      const dataStart = Math.min(1024, chunk.length);
      processedChunks.push(chunk.slice(dataStart));
    } else {
      processedChunks.push(chunk);
    }
  }

  return Buffer.concat(processedChunks);
}

/**
 * Add proper WebM headers if missing
 */
export function ensureWebMHeaders(audioData: Buffer): Buffer {
  if (isWebMData(audioData)) {
    return audioData; // Already has headers
  }

  // Create a minimal WebM header
  // This is a simplified version - in production you'd create proper EBML structure
  const header = Buffer.concat([
    WEBM_SIGNATURE,
    // Add minimal EBML header structure here
    // For now, we'll just return the data as-is
  ]);

  return Buffer.concat([header, audioData]);
}