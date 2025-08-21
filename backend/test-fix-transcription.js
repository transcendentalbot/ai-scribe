// Test to understand the WebM chunk issue
const fs = require('fs');

// Simulate what the browser sends - base64 encoded WebM chunks
const testWebMHeader = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, // WebM signature
  0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81,
  0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d,
  0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02
]);

console.log('WebM header (hex):', testWebMHeader.toString('hex'));
console.log('WebM header (base64):', testWebMHeader.toString('base64'));

// What we're getting from the browser
const browserChunk = "6oEWB4B7gyAgJRlWyGVW7B2EnNQO+pKJqzSUf+sarBueqj7e0h0K3BMk7ayKfYAHI2ckCGthMc2GaT8gKo5WTAvsifjj9d6w0yfHTIgyFgn0sXGu84fBSM4Nkv";

const decodedChunk = Buffer.from(browserChunk, 'base64');
console.log('\nBrowser chunk decoded (hex):', decodedChunk.slice(0, 32).toString('hex'));
console.log('First 4 bytes:', decodedChunk.slice(0, 4).toString('hex'));
console.log('Is WebM header:', decodedChunk.slice(0, 4).toString('hex') === '1a45dfa3');

// The problem: MediaRecorder sends WebM in chunks, and only the first chunk
// has the WebM header. Subsequent chunks are just data blocks.
console.log('\nProblem: WebM chunks after the first one don\'t have headers');
console.log('Solution options:');
console.log('1. Buffer all chunks and send complete WebM file');
console.log('2. Use a different audio format that supports streaming');
console.log('3. Use Deepgram\'s streaming API differently');