const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'ai-scribe-audio-production-194722432945-v2';

async function downloadAndAnalyzeAudio() {
  // Use the S3 key from the logs
  const s3Key = 'recordings/8f69f283-c3ad-4283-854f-e7dd4c0a56b6/25840f12-bc1e-4d17-806c-cbef525a25f7/audio.webm';
  
  console.log(`\nAnalyzing S3 object: ${s3Key}`);
  
  try {
    // First, get object metadata
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    
    const headResponse = await s3Client.send(headCommand);
    console.log('\nObject Metadata:');
    console.log('- Content-Type:', headResponse.ContentType);
    console.log('- Content-Length:', headResponse.ContentLength);
    console.log('- Last Modified:', headResponse.LastModified);
    console.log('- ETag:', headResponse.ETag);
    console.log('- Metadata:', headResponse.Metadata);
    
    // Download the file
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    
    const response = await s3Client.send(getCommand);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log('\nFile Analysis:');
    console.log('- Downloaded size:', buffer.length, 'bytes');
    
    // Analyze first 100 bytes
    const first100 = buffer.slice(0, 100);
    console.log('- First 100 bytes (hex):', first100.toString('hex'));
    console.log('- First 100 bytes (ascii):', first100.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
    
    // Check file signatures
    const signatures = {
      webm: [0x1a, 0x45, 0xdf, 0xa3],
      ogg: [0x4f, 0x67, 0x67, 0x53],
      riff: [0x52, 0x49, 0x46, 0x46],
      id3: [0x49, 0x44, 0x33],
    };
    
    console.log('\nFile Signature Check:');
    for (const [format, sig] of Object.entries(signatures)) {
      const matches = sig.every((byte, i) => buffer[i] === byte);
      console.log(`- ${format}: ${matches ? 'YES' : 'NO'}`);
    }
    
    // Look for specific patterns
    const first4Hex = Array.from(buffer.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('- First 4 bytes:', first4Hex);
    
    // Save to local file for analysis
    const localPath = path.join(__dirname, 'downloaded-audio.webm');
    fs.writeFileSync(localPath, buffer);
    console.log(`\nFile saved to: ${localPath}`);
    console.log('You can analyze it with: file downloaded-audio.webm');
    console.log('Or try playing it with: ffplay downloaded-audio.webm');
    
    // Check if it might be base64 encoded
    const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(buffer.toString('ascii').slice(0, 100));
    if (isBase64) {
      console.log('\n⚠️  File appears to be base64 encoded!');
      try {
        const decoded = Buffer.from(buffer.toString('ascii'), 'base64');
        const decodedPath = path.join(__dirname, 'decoded-audio.webm');
        fs.writeFileSync(decodedPath, decoded);
        console.log(`Decoded file saved to: ${decodedPath}`);
        
        const decodedSig = Array.from(decoded.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log('Decoded signature:', decodedSig);
      } catch (e) {
        console.log('Failed to decode as base64');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.$metadata) {
      console.error('AWS Error Details:', {
        httpStatusCode: error.$metadata.httpStatusCode,
        requestId: error.$metadata.requestId,
      });
    }
  }
}

downloadAndAnalyzeAudio();