import { Buffer } from 'buffer';

/**
 * Fix duration metadata in WebM files created by MediaRecorder
 * Based on: https://github.com/yusitnikov/fix-webm-duration
 */

const TIMECODE_SCALE = 1000000; // 1ms in nanoseconds
const DURATION_OFFSET = 0x1654AE6B;
const TIMECODE_OFFSET = 0xE7;

/**
 * Inject duration metadata into a WebM file
 * @param webmBuffer - The WebM file buffer without duration
 * @param duration - Duration in milliseconds
 * @returns Fixed WebM buffer with duration metadata
 */
export function fixWebmDuration(webmBuffer: Buffer, duration: number): Buffer {
  const durationInTimecodeScale = duration * TIMECODE_SCALE / 1000;
  
  // Find the Segment Info element (0x1549A966)
  const segmentInfoPattern = Buffer.from([0x15, 0x49, 0xA9, 0x66]);
  let segmentInfoIndex = webmBuffer.indexOf(segmentInfoPattern);
  
  if (segmentInfoIndex === -1) {
    console.warn('Segment Info element not found in WebM file');
    return webmBuffer;
  }
  
  // Check if duration already exists
  const durationPattern = Buffer.from([0x44, 0x89]); // Duration element ID
  let durationIndex = webmBuffer.indexOf(durationPattern, segmentInfoIndex);
  
  if (durationIndex !== -1 && durationIndex < segmentInfoIndex + 100) {
    // Duration already exists, update it
    const durationBuffer = Buffer.allocUnsafe(8);
    durationBuffer.writeDoubleBE(durationInTimecodeScale);
    webmBuffer.set(durationBuffer, durationIndex + 2);
    return webmBuffer;
  }
  
  // Duration doesn't exist, we need to inject it
  // This is more complex and requires EBML parsing
  // For now, return the original buffer
  console.warn('Duration injection not implemented - returning original buffer');
  return webmBuffer;
}

/**
 * Simple duration estimation based on file size and bitrate
 * @param fileSize - Size of the WebM file in bytes
 * @param bitrate - Estimated bitrate in bits per second (default 128kbps)
 * @returns Estimated duration in milliseconds
 */
export function estimateDuration(fileSize: number, bitrate: number = 128000): number {
  // Convert bitrate to bytes per second
  const bytesPerSecond = bitrate / 8;
  // Estimate duration (subtract some bytes for headers)
  const contentSize = Math.max(0, fileSize - 1024); // Assume 1KB headers
  const durationSeconds = contentSize / bytesPerSecond;
  return Math.round(durationSeconds * 1000);
}